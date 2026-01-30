/**
 * PROFILE CONTROLLER
 * ------------------
 * Single API with field-level authorization
 */

const profileModel = require('./profile.model');

/**
 * Fields configuration
 */
const SELF_EDITABLE_FIELDS = [
    'full_name',
    'mobile_number'
];

const RESTRICTED_FIELDS = [
    'role',
    'manager_id',
    'employee_code',
    'joining_date',
    'is_active'
];

/**
 * GET /profile
 */
exports.getProfile = async (req, res) => {
    try {
        const { role, userId } = req.user;

        let targetEmployeeId;

        if (role === 'EMPLOYEE') {
            targetEmployeeId = userId;
        } else {
            targetEmployeeId = req.query.employeeId || userId;
        }

        const employee = await profileModel.getEmployeeById(targetEmployeeId);

        if (!employee) {
            return res.status(404).json({ 
                status: "error",
                statusCode: 404,
                message: 'Employee not found' });
        }

        return res.status(200).json({
            status: "success",
            statusCode: 200,
            message: 'Profile fetched successfully',
            data:{
                employee
            }
            });

    } catch (error) {
        console.error('getProfile error:', error);
        return res.status(500).json({ 
            status: "error",
            statusCode: 500,
            message: 'Internal server error' });
    }
};

/**
 * PUT /profile
 */
exports.updateProfile = async (req, res) => {
    try {
        const { role, userId } = req.user;
        const body = req.body;

        let targetEmployeeId;

        if (role === 'EMPLOYEE') {
            targetEmployeeId = userId;
        } else {
            targetEmployeeId = req.query.employeeId || userId;
        }

        // 🔐 EMPLOYEE: can update only self-editable fields
        if (role === 'EMPLOYEE') {
            const forbidden = Object.keys(body).filter(
                key => !SELF_EDITABLE_FIELDS.includes(key)
            );

            if (forbidden.length > 0) {
                return res.status(403).json({
                    status: "error",
                    statusCode: 403,
                    message: `You cannot update fields: ${forbidden.join(', ')}`
                });
            }
        }

        // 🔐 HR / ADMIN: block self-privilege escalation
        if ((role === 'HR' || role === 'ADMIN') && targetEmployeeId === userId) {
            if ('role' in body || 'is_active' in body) {
                return res.status(403).json({
                    status: "error",
                    statusCode: 403,
                    message: 'You cannot modify your own role or active status'
                });
            }
        }

        // 🧹 Filter allowed fields
        const updateData = {};

        Object.keys(body).forEach(key => {
            if (
                SELF_EDITABLE_FIELDS.includes(key) ||
                (RESTRICTED_FIELDS.includes(key) && role !== 'EMPLOYEE')
            ) {
                updateData[key] = body[key];
            }
        });

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                status: "error",
                statusCode: 400,
                message: 'No valid fields provided for update'
            });
        }

        await profileModel.updateEmployee(targetEmployeeId, updateData);

        return res.status(200).json({
            status: "success",
            statusCode: 200,
            message: 'Profile updated successfully',
            data:{}
        });

    } catch (error) {
        console.error('updateProfile error:', error);
        return res.status(500).json({ 
            status: "error",
            statusCode: 500,
            message: 'Internal server error' });
    }
};
