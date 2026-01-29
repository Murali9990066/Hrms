const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const authModel = require('./auth.model');

const COMPANY_DOMAIN = '@intellious.tech';
const DUMMY_OTP = process.env.DUMMY_OTP || '123456';
const OTP_EXPIRY_MINUTES = 5;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';
const JWT_EXPIRY = '15m';

/**
 * POST /auth/request-otp
 */
exports.requestOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                status: "error",
                statusCode: 400,
                message: 'Invalid email format' 
            });
        }

        if (!email.toLowerCase().endsWith(COMPANY_DOMAIN)) {
            return res.status(403).json({
                status: "error",
                statusCode: 403, 
                message: 'Only @intellious.tech email addresses are allowed'
            });
        }

        // ✅ UPDATED FUNCTION NAMES
        let employee = await authModel.findEmployeeByEmail(email);
        if (!employee) {
            await authModel.createEmployee(email);
            employee = await authModel.findEmployeeByEmail(email);
        }

        const otpHash = crypto
            .createHash('sha256')
            .update(DUMMY_OTP)
            .digest('hex');

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

        await authModel.insertOtp(email, otpHash, expiresAt);

        return res.status(200).json({
            status: "success",
            statusCode: 200,
            message: 'OTP generated successfully',
            expiresIn: OTP_EXPIRY_MINUTES * 60 // in seconds
        });

    } catch (error) {
        console.error('Request OTP error:', error);
        return res.status(500).json({
            status: "error",
            statusCode: 500,
            message: 'Internal server error' 
            });
    }
};

/**
 * POST /auth/verify-otp
 */
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                status: "error",
                statusCode: 400,
                message: 'Email and OTP are required'
            });
        }

        if (!email.toLowerCase().endsWith(COMPANY_DOMAIN)) {
            return res.status(403).json({
                status: "error",
                statusCode: 403,
                message: 'Invalid email domain'
            });
        }

        const otpRecord = await authModel.getLatestOtpByEmail(email);
        if (!otpRecord) {
            return res.status(400).json({ 
                status: "error",
                statusCode: 400,
                message: 'OTP not found' 
            });
        }

        if (otpRecord.is_used) {
            return res.status(400).json({ 
                status: "error",
                statusCode: 400,
                message: 'OTP already used' 
            });
        }

        if (new Date() > new Date(otpRecord.expires_at)) {
            return res.status(400).json({ 
                status: "error",
                statusCode: 400,
                message: 'OTP expired' 
            });
        }

        const otpHash = crypto
            .createHash('sha256')
            .update(otp)
            .digest('hex');

        if (otpHash !== otpRecord.otp_hash) {
            await authModel.incrementOtpAttempts(otpRecord.id);
            return res.status(400).json({ 
                status: "error",
                statusCode: 400,
                message: 'Invalid OTP' 
            });
        }

        await authModel.markOtpAsUsed(otpRecord.id);

        // ✅ UPDATED FUNCTION NAME
        const employee = await authModel.findEmployeeByEmail(email);
        if (!employee) {
            return res.status(404).json({ 
                status: "error",
                statusCode: 404,
                message: 'Employee not found' 
            });
        }

        await authModel.updateLoginMeta(employee.id);

        // ✅ UPDATED JWT PAYLOAD (NO status)
        const token = jwt.sign(
            {
                employeeId: employee.id,
                role: employee.role,
                isActive: employee.is_active
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        return res.status(200).json({
            status: "success",
            statusCode: 200,
            message: 'OTP verified successfully',
            accessToken: token,
            data: {
            employee: {
                id: employee.id,
                email,
                role: employee.role,
                firstLogin: employee.first_login,
                profileCompleted: employee.profile_completed,
                nextStep: employee.profile_completed ? 'DASHBOARD' : 'PROFILE_CREATION'
            },
        },
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        return res.status(500).json({ 
            status: "error",
            statusCode: 500,
            message: 'Internal server error' 
        });
    }
};
