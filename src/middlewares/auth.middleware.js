const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

/**
 * Authenticate JWT
 * - verifies token
 * - attaches user info to req.user
 */
exports.authenticate = (req, res, next) => {
    console.log('🔥 AUTH MIDDLEWARE HIT');

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('❌ Missing header');
        return res.status(401).json({ message: 'Authorization token missing' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        console.log('✅ DECODED JWT:', decoded);
        console.log('👉 isActive type:', typeof decoded.isActive);

        // TEMPORARILY COMMENT CHECK
        // if (decoded.isActive !== 1 && decoded.isActive !== true) {
        //   console.log('❌ BLOCKED BY isActive CHECK');
        //   return res.status(403).json({ message: 'Account is not active' });
        // }

        req.user = {
            userId: decoded.employeeId,
            role: decoded.role
        };

        console.log('✅ AUTH PASSED');
        next();
    } catch (err) {
        console.log('❌ JWT ERROR', err.message);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

/**
 * Role-based authorization
 * Usage: authorizeRoles('ADMIN', 'HR')
 */
exports.authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: 'You do not have permission to perform this action'
            });
        }
        next();
    };
};
