const jwt = require('jsonwebtoken');
const adminModel = require('./admin.model');
const profileModel = require('../ProfileMicroservice/profile.model');

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


