const pool = require('../database/db.connection');

/**
 * Get employee by ID
 * Used by:
 *  - get profile
 *  - update profile
 *  - restricted updates
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

/**
 * Update employee fields dynamically
 * Used by:
 *  - updateProfile
 *  - updateRestrictedProfile
 */
exports.updateEmployee = async (employeeId, fields) => {
    const keys = Object.keys(fields);
    const values = Object.values(fields);

    if (keys.length === 0) return;

    const setClause = keys.map(key => `${key} = ?`).join(', ');

    await pool.query(
        `
    UPDATE employees
    SET ${setClause}
    WHERE id = ?
    `,
        [...values, employeeId]
    );
};

/**
 * Mark profile as completed
 * (can be triggered after required fields + documents)
 */
exports.markProfileCompleted = async (employeeId) => {
    await pool.query(
        `
    UPDATE employees
    SET profile_completed = TRUE
    WHERE id = ?
    `,
        [employeeId]
    );
};

/**
 * Insert document metadata after successful S3 upload
 */
exports.insertDocument = async ({
    employee_id,
    document_type,
    file_key,
    original_file_name
}) => {
    await pool.query(
        `
    INSERT INTO documents
      (employee_id, document_type, file_key, original_file_name)
    VALUES (?, ?, ?, ?)
    `,
        [employee_id, document_type, file_key, original_file_name]
    );
};

/**
 * Get documents for an employee
 * Used by profile view / HR view
 */
exports.getEmployeeDocuments = async (employeeId) => {
    const [rows] = await pool.query(
        `
    SELECT
      id,
      document_type,
      file_key,
      original_file_name,
      status,
      uploaded_at,
      approved_by,
      approved_at
    FROM documents
    WHERE employee_id = ?
    ORDER BY uploaded_at DESC
    `,
        [employeeId]
    );

    return rows;
};

exports.getEmployeeDocuments = async (employeeId) => {
    const [rows] = await pool.query(
        `
    SELECT
      id,
      document_type,
      original_file_name,
      status,
      uploaded_at,
      approved_by,
      approved_at
    FROM documents
    WHERE employee_id = ?
    ORDER BY uploaded_at DESC
    `,
        [employeeId]
    );

    return rows;
};

exports.getEmployeeDocumentByType = async (employeeId, documentType) => {
    const [rows] = await pool.query(
        `
    SELECT
      id,
      file_key,
      original_file_name,
      status
    FROM documents
    WHERE employee_id = ?
      AND document_type = ?
    ORDER BY uploaded_at DESC
    LIMIT 1
    `,
        [employeeId, documentType]
    );

    return rows[0];
};
