const pool = require('../database/db.connection');

/**
 * Get all employees
 */
exports.getAllEmployees = async () => {
    const [rows] = await pool.query(
        `SELECT id,full_name, email,mobile_number, role,manager_name, is_active, created_at
     FROM employees
     ORDER BY id ASC`
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
      emergency_contact_name,
      emergency_contact_relation,

      designation,
      project_assigned,

      employee_code,
      joining_date,
      manager_name,

      profile_completed,
      is_profile_updated,
      is_document_updated,

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

/**
 * Update document status and save the Reviewer's Name instead of ID
 */
exports.updateDocumentStatus = async (document_id, employee_id, status, reviewerId) => {
    const query = `
        UPDATE documents 
        SET 
            status = ?, 
            approved_at = CURRENT_TIMESTAMP,
            approved_by = (SELECT full_name FROM employees WHERE id = ?) -- 👈 Lookup name by ID
        WHERE id = ? AND employee_id = ?
    `;

    const [result] = await pool.query(query, [
        status.toUpperCase(),
        reviewerId,    // Used for the subquery lookup
        document_id,
        employee_id
    ]);

    return result.affectedRows > 0;
};

/**
 * NEW: Fetch only the public directory fields for regular employees
 */
exports.getPublicDirectoryById = async (employeeId) => {
    const query = `
        SELECT 
            e.full_name, e.email, e.mobile_number, e.dob, 
            e.employee_code, e.designation, e.project_assigned,
            m.full_name AS reporting_manager
        FROM employees e
        LEFT JOIN employees m ON e.manager_name = m.id
        WHERE e.id = ?
    `;
    const [rows] = await pool.query(query, [employeeId]);
    return rows[0];
};

exports.bulkInsertEmployees = async (employees) => {
    const query = `
        INSERT INTO employees (
            email, role, full_name, mobile_number, address, dob, gender, 
            designation, employee_code, joining_date, manager_name,
            blood_group, emergency_contact, emergency_contact_relation, emergency_contact_name
        ) VALUES ? 
        ON DUPLICATE KEY UPDATE 
            full_name = VALUES(full_name),
            mobile_number = VALUES(mobile_number),
            address = VALUES(address),
            designation = VALUES(designation),
            manager_name = VALUES(manager_name),
            blood_group = VALUES(blood_group),
            emergency_contact = VALUES(emergency_contact),
            emergency_contact_relation = VALUES(emergency_contact_relation),
            emergency_contact_name = VALUES(emergency_contact_name),
            updated_at = CURRENT_TIMESTAMP;
    `;
    // Using 'pool' as defined in your model file
    const [result] = await pool.query(query, employees);
    return result;
};
