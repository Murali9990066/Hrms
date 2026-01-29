const pool = require('../database/db.connection');

/**
 * Get employee by ID
 */
exports.getEmployeeById = async (employeeId) => {
    const [rows] = await pool.query(
        `SELECT 
        id,
        email,
        role,
        is_active,
        full_name,
        mobile_number,
        joining_date,
        employee_code,
        manager_id,
        profile_completed,
        created_at,
        updated_at
     FROM employees
     WHERE id = ?`,
        [employeeId]
    );
    return rows[0];
};

/**
 * Update employee fields dynamically
 */
exports.updateEmployee = async (employeeId, fields) => {
    const keys = Object.keys(fields);
    const values = Object.values(fields);

    if (keys.length === 0) return;

    const setClause = keys.map(key => `${key} = ?`).join(', ');

    await pool.query(
        `UPDATE employees
     SET ${setClause}
     WHERE id = ?`,
        [...values, employeeId]
    );
};
