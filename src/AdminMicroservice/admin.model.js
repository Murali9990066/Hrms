const pool = require('../database/db.connection');

/**
 * Get all employees
 */
exports.getAllEmployees = async () => {
    const [rows] = await pool.query(
        `SELECT id,full_name, email, role, is_active, created_at
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
        `
    SELECT
      id,
      email,
      role,
      is_active,

      full_name,
      mobile_number,
      address,

      dob,
      gender,
      blood_group,
      emergency_contact,

      designation,
      project_assigned,

      employee_code,
      joining_date,
      manager_name,

      profile_completed,

      created_at,
      updated_at
    FROM employees
    WHERE id = ?
    `,
        [employeeId]
    );

    return rows[0];
};

exports.updateEmployee = async (employeeId, updates) => {
    if (!employeeId) {
        throw new Error('Employee ID required');
    }

    if (!updates || Object.keys(updates).length === 0) {
        throw new Error('No update fields provided');
    }

    // 1️⃣ Fetch table columns dynamically
    const [columns] = await pool.query('DESCRIBE employees');

    const validColumns = columns
        .map(col => col.Field)
        .filter(field => field !== 'id'); // Never allow PK update

    // 2️⃣ Filter incoming updates
    const filteredUpdates = {};

    Object.keys(updates).forEach(key => {
        if (validColumns.includes(key)) {
            filteredUpdates[key] = updates[key];
        }
    });

    if (Object.keys(filteredUpdates).length === 0) {
        throw new Error('No valid columns to update');
    }

    // 3️⃣ Build update query
    const keys = Object.keys(filteredUpdates);
    const values = Object.values(filteredUpdates);

    const setClause = keys.map(key => `${key} = ?`).join(', ');

    const query = `
        UPDATE employees
        SET ${setClause}
        WHERE id = ?
    `;

    const [result] = await pool.query(query, [...values, employeeId]);

    return result;
};

