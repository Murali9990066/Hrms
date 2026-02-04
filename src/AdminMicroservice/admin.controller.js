const jwt = require('jsonwebtoken');
const adminModel = require('./admin.model');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

const ALLOWED_ROLES = ['EMPLOYEE', 'MANAGER', 'HR'];
const ALLOWED_STATUSES = ['0', '1'];

/**
 * Utility: verify ADMIN
 */
const verifyAdmin = (req) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw { status: 401, message: 'Authorization token missing' };
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== 'ADMIN') {
        throw { status: 403, message: 'Admin access required' };
    }

    return decoded;
};

/**
 * GET /admin/employees
 */
exports.getAllEmployees = async (req, res) => {
    try {
        verifyAdmin(req);

        const employees = await adminModel.getAllEmployees();

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: 'Employees fetched successfully',
            data: employees
        });

    } catch (err) {
        return res.status(err.status || 500).json({
            message: err.message || 'Internal server error'
        });
    }
};

/**
 * PATCH /admin/employees/:employeeId/status
 */
exports.updateEmployeeStatus = async (req, res) => {
    try {
        verifyAdmin(req);

        const { employeeId } = req.params;
        const { status } = req.body;

        if (!ALLOWED_STATUSES.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        const employee = await adminModel.getEmployeeById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        await adminModel.updateEmployeeStatus(employeeId, status);

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: 'Employee status updated successfully',
            data: {}
        });

    } catch (err) {
        return res.status(err.status || 500).json({
            message: err.message || 'Internal server error'
        });
    }
};

/**
 * PATCH /admin/employees/:employeeId/role
 */
exports.updateEmployeeRole = async (req, res) => {
    try {
        const admin = verifyAdmin(req);
        const { employeeId } = req.params;
        const { role } = req.body;

        if (!ALLOWED_ROLES.includes(role)) {
            return res.status(400).json({ message: 'Invalid role value' });
        }

        // Prevent self-demotion
        if (Number(employeeId) === admin.employeeId) {
            return res.status(400).json({
                message: 'Admin cannot change their own role'
            });
        }

        const employee = await adminModel.getEmployeeById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        await adminModel.updateEmployeeRole(employeeId, role);

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: 'Employee role updated successfully',
            data: {}
        });

    } catch (err) {
        return res.status(err.status || 500).json({
            message: err.message || 'Internal server error'
        });
    }
};
