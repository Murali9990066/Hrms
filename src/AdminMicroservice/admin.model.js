const pool = require('../database/db.connection');

/**
 * Get all employees
 */
exports.getAllEmployees = async () => {
    const [rows] = await pool.query(
        `SELECT id, email, role, is_active, created_at
     FROM employees
     ORDER BY created_at DESC`
    );
    return rows;
};

/**
 * Get employee by ID
 */
exports.getEmployeeById = async (employeeId) => {
    const [rows] = await pool.query(
        `SELECT id, role
     FROM employees
     WHERE id = ?`,
        [employeeId]
    );
    return rows[0];
};

/**
 * Update employee status
 */
exports.updateEmployeeStatus = async (employeeId, status) => {
    await pool.query(
        `UPDATE employees
     SET is_active = ?
     WHERE id = ?`,
        [status, employeeId]
    );
};

/**
 * Update employee role
 */
exports.updateEmployeeRole = async (employeeId, role) => {
    await pool.query(
        `UPDATE employees
     SET role = ?
     WHERE id = ?`,
        [role, employeeId]
    );
};
