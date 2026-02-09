const jwt = require('jsonwebtoken');
const adminModel = require('./admin.model');

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

/**
 * GET /admin/employees
 */
exports.getAllEmployees = async (req, res) => {
    try {
        verifyAdminOrHR(req);

        const { employeeId } = req.params;

        let data;

        // If employeeId present → fetch single employee
        if (employeeId) {
            data = await adminModel.getEmployeeById(employeeId);

            if (!data) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Employee not found'
                });
            }
        } else {
            // Otherwise fetch all employees
            data = await adminModel.getAllEmployees();
        }

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: employeeId
                ? 'Employee fetched successfully'
                : 'Employees fetched successfully',
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

