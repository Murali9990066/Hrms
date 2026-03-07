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
      employee_id,
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



exports.getEmployeeDocumentByType = async (employeeId, documentType) => {
    const [rows] = await pool.query(`
        SELECT
          id,
          file_key,
          original_file_name,
          status
        FROM documents
        WHERE employee_id = ?
          AND UPPER(TRIM(document_type)) = UPPER(TRIM(?))
        ORDER BY uploaded_at DESC
        LIMIT 1
    `, [employeeId, documentType]);

    return rows[0];
};

/**
 * Delete employee document by type
 */
exports.deleteDocumentByType = async (employeeId, documentType) => {
    await pool.query(
        `
        DELETE FROM documents
        WHERE employee_id = ?
          AND document_type = ?
        `,
        [employeeId, documentType]
    );
};

exports.syncProfileStatus = async (employeeId) => {
    // 1. Fetch current employee data
    const [empRows] = await pool.query('SELECT * FROM employees WHERE id = ?', [employeeId]);
    const emp = empRows[0];
    if (!emp) return;

    // 2. Calculate Profile Flag (Check mandatory fields)
    const mandatoryFields = [
        'full_name', 'mobile_number', 'dob', 'gender',
        'emergency_contact_name', 'emergency_contact_relation'
    ];
    const isProfileUpdated = mandatoryFields.every(field =>
        emp[field] && emp[field].toString().trim() !== ''
    );

    // 3. Calculate Document Flag (Check if mandatory docs are 'APPROVED')
    const [docRows] = await pool.query(
        'SELECT document_type FROM documents WHERE employee_id = ? AND status = "APPROVED"',
        [employeeId]
    );
    const approvedTypes = docRows.map(d => d.document_type);
    const mandatoryDocs = ['DEGREE', 'AADHAAR', 'PREVIOUS_EMPLOYMENT_DOCUMENTS', 'BANK_ACCOUNT_DETAILS', 'CV'];

    const isDocumentUpdated = mandatoryDocs.every(type => approvedTypes.includes(type));

    // 4. Calculate Master Flag
    const profile_completed = isProfileUpdated && isDocumentUpdated;

    // 5. Save all 3 to the database
    await pool.query(
        `UPDATE employees SET 
            is_profile_updated = ?, 
            is_document_updated = ?, 
            profile_completed = ? 
         WHERE id = ?`,
        [isProfileUpdated, isDocumentUpdated, profile_completed, employeeId]
    );

    return { isProfileUpdated, isDocumentUpdated, profile_completed };
};


