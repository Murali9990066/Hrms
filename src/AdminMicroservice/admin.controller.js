const jwt = require('jsonwebtoken');
const adminModel = require('./admin.model');
const profileModel = require('../ProfileMicroservice/profile.model');
const fs = require('fs');
const ExcelJS = require('exceljs');
const multer = require('multer');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';


/**
 * Utility: verify ADMIN
 */
const verifyAdminOrHR = (req) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw { status: 401, message: 'Authorization token missing' };
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const allowedRoles = ['ADMIN', 'HR'];

    if (!allowedRoles.includes(decoded.role)) {
        throw { status: 403, message: 'Admin or HR access required' };
    }

    return decoded;
};

// 

exports.getAllEmployees = async (req, res) => {
    try {
        const { role } = req.user; // From your auth middleware
        const { employeeId } = req.params;

        let data;

        if (employeeId) {
            // --- THE DETAIL VIEW SWITCH ---
            if (['ADMIN', 'HR'].includes(role)) {
                // 1️⃣ ADMIN/HR: Use the existing "Full Data" logic
                const employee = await adminModel.getEmployeeById(employeeId);
                const documents = await profileModel.getEmployeeDocuments(employeeId);
                data = { employee, documents };
            } else {
                // 2️⃣ OTHER ROLES: Use the new "Light Data" logic
                const employee = await adminModel.getPublicDirectoryById(employeeId);
                data = {
                    employee,
                    documents: [] // Strictly no documents for regular users
                };
            }

            if (!data.employee) {
                return res.status(404).json({ status: 'error', message: 'Employee not found' });
            }
        } else {
            // --- THE LIST VIEW (For Dropdowns/Tables) ---
            // This stays as a simplified list for everyone
            data = await adminModel.getAllEmployees();
        }

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: 'Data fetched successfully',
            data
        });

    } catch (err) {
        return res.status(err.status || 500).json({
            message: err.message || 'Internal server error'
        });
    }
};

exports.adminUpdateEmployeeProfile = async (req, res) => {
    try {
        const requesterRole = req.user.role;
        const { employeeId } = req.params;
        const updates = req.body;

        // 1️⃣ Role check
        if (!['ADMIN', 'HR'].includes(requesterRole)) {
            return res.status(403).json({
                status: 'error',
                message: 'Admin or HR access required'
            });
        }

        // 2️⃣ Reject empty body
        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No fields provided for update'
            });
        }

        // 3️⃣ Block system fields
        const blockedFields = ['id', 'created_at', 'updated_at'];

        const invalidFields = Object.keys(updates).filter(field =>
            blockedFields.includes(field)
        );

        if (invalidFields.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: `Cannot update system fields: ${invalidFields.join(', ')}`
            });
        }

        // 4️⃣ Employee existence check
        const employee = await adminModel.getEmployeeById(employeeId);
        if (!employee) {
            return res.status(404).json({
                status: 'error',
                message: 'Employee not found'
            });
        }

        // 5️⃣ Update DB
        await adminModel.updateEmployee(employeeId, updates);

        return res.status(200).json({
            status: 'success',
            message: 'Employee updated successfully'
        });

    } catch (err) {
        console.error('adminUpdateEmployeeProfile error:', err);

        return res.status(err.status || 500).json({
            message: err.message || 'Internal server error'
        });
    }
};

/**
 * PATCH /admin/documents/review
 * Requirements: Auth as ADMIN/HR
 */
exports.reviewEmployeeDocument = async (req, res) => {
    try {
        // 1️⃣ Reuse your verifyAdminOrHR utility
        const reviewer = verifyAdminOrHR(req);
        const adminId = reviewer.employeeId; // Extracted from JWT

        const { document_id, employee_id, status } = req.body;

        // 2️⃣ Input Validation
        if (!document_id || !employee_id || !status) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: document_id, employee_id, or status'
            });
        }

        const normalizedStatus = status.toUpperCase();
        const allowedStatuses = ['APPROVED', 'REJECTED', 'PENDING'];

        if (!allowedStatuses.includes(normalizedStatus)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid status. Use APPROVED, REJECTED, or PENDING'
            });
        }

        // 3️⃣ Update Database via Admin Model
        // Pass document_id (auto-increment) and employee_id for safety
        const isUpdated = await adminModel.updateDocumentStatus(
            document_id,
            employee_id,
            normalizedStatus,
            adminId
        );

        if (!isUpdated) {
            return res.status(404).json({
                status: 'error',
                message: 'Document record not found for this employee'
            });
        }

        // 4️⃣ SYNC COMPLETION FLAGS
        // After an HR action, we re-evaluate the profile_completed status
        await profileModel.syncProfileStatus(employee_id);

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: `Document ${normalizedStatus} successfully`,
            data: {
                document_id,
                reviewed_by: adminId,
                status: normalizedStatus
            }
        });

    } catch (err) {
        console.error('reviewEmployeeDocument error:', err);
        return res.status(err.status || 500).json({
            status: 'error',
            message: err.message || 'Internal server error'
        });
    }
};


/**
 * HELPER: Local Disk Storage
 * Specifically for temporary Excel processing
 */
const localConfig = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = './uploads/temp';
        // Create folder if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `batch-${Date.now()}-${file.originalname}`);
    }
});

// Export this to use in your routes file
exports.uploadLocal = multer({ storage: localConfig });

/**
 * API: Bulk Onboard Employees
 * Reads Excel -> Validates -> Bulk Inserts to DB
 */
exports.bulkOnboard = async (req, res) => {
    try {
        const { role } = req.user;

        // 🛡️ STRICT ROLE GATE: Only ADMIN and HR allowed
        if (!['ADMIN', 'HR'].includes(role)) {
            // If there's a file uploaded locally, delete it before exiting
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

            return res.status(403).json({
                status: 'error',
                statusCode: 403,
                message: 'Access Denied: Only HR or ADMIN can perform bulk onboarding'
            });
        }

        if (!req.file) {
            return res.status(400).json({ status: 'error',
                 statusCode: 400,
                 message: 'No file uploaded' });
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.getWorksheet(1);

        const employees = [];

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return; // Skip Header

            const email = row.getCell(1).value?.toString().trim();
            const empCode = row.getCell(9).value?.toString().trim();
            const fullName = row.getCell(3).value?.toString().trim();

            if (!email || !empCode || !fullName) {
                console.error(`Row ${rowNumber} skipped: Missing mandatory data.`);
                return;
            }

            const empData = [
                email,
                row.getCell(2).value?.toString().toUpperCase() || 'EMPLOYEE',
                fullName,
                row.getCell(4).value?.toString() || null,
                row.getCell(5).value || null,
                row.getCell(6).value ? new Date(row.getCell(6).value) : null,
                row.getCell(7).value || null,
                row.getCell(8).value || 'Software Engineer',
                empCode,
                row.getCell(10).value ? new Date(row.getCell(10).value) : new Date(),
                row.getCell(11).value || 'Unassigned',
                row.getCell(12).value?.toString() || null, // blood_group
                row.getCell(13).value?.toString() || null, // emergency_contact
                row.getCell(14).value?.toString() || null, // emergency_contact_relation
                row.getCell(15).value?.toString() || null  // emergency_contact_name
            ];

            employees.push(empData);
        });

        if (employees.length > 0) {
            await adminModel.bulkInsertEmployees([employees]);
        }

        // Clean up temp file
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: `Successfully processed ${employees.length} employees`,
            data: { count: employees.length }
        });

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error('Bulk Onboard Error:', error);
        return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

