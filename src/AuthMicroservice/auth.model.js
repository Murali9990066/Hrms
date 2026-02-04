const pool = require('../database/db.connection');

/* ===================== EMPLOYEES ===================== */

/**
 * Find employee by email
 */
exports.findEmployeeByEmail = async (email) => {
    const [rows] = await pool.query(
        `SELECT 
        id,
        role,
        is_active,
        profile_completed
     FROM employees
     WHERE email = ?`,
        [email]
    );

    return rows[0];
};

/**
 * Create employee with default values
 */
exports.createEmployee = async (email) => {
    await pool.query(
        `INSERT INTO employees (email)
     VALUES (?)`,
        [email]
    );
};

/* ===================== OTP LOGS ===================== */

/**
 * Insert OTP record
 */
exports.insertOtp = async (email, otpHash, expiresAt) => {
    await pool.query(
        `INSERT INTO otp_logs (email, otp_hash, expires_at)
     VALUES (?, ?, ?)`,
        [email, otpHash, expiresAt]
    );
};

/**
 * Get latest OTP by email
 */
exports.getLatestOtpByEmail = async (email) => {
    const [rows] = await pool.query(
        `SELECT *
     FROM otp_logs
     WHERE email = ?
     ORDER BY created_at DESC
     LIMIT 1`,
        [email]
    );

    return rows[0];
};

/**
 * Increment OTP attempts
 */
exports.incrementOtpAttempts = async (otpId) => {
    await pool.query(
        `UPDATE otp_logs
     SET attempts = attempts + 1
     WHERE id = ?`,
        [otpId]
    );
};

/**
 * Mark OTP as used
 */
exports.markOtpAsUsed = async (otpId) => {
    await pool.query(
        `UPDATE otp_logs
     SET is_used = TRUE,
         verified_at = NOW()
     WHERE id = ?`,
        [otpId]
    );
};

/* ===================== LOGIN META ===================== */


