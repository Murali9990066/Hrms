const pool = require('../database/db.connection');

exports.createProject = async (data) => {
    const {
        name,
        type,
        client_name,
        project_manager,
        start_date,
        end_date,
        status = 'ACTIVE'
    } = data;

    const [result] = await pool.query(
        `INSERT INTO projects
        (name, type, client_name, project_manager, start_date, end_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, type, client_name, project_manager, start_date, end_date, status]
    );

    return result.insertId;
};

exports.updateProject = async (projectId, data) => {
    const {
        name,
        type,
        client_name,
        project_manager,
        start_date,
        end_date,
        status
    } = data;

    await pool.query(
        `UPDATE projects SET
            name=?,
            type=?,
            client_name=?,
            project_manager=?,
            start_date=?,
            end_date=?,
            status=?
        WHERE id=?`,
        [
            name,
            type,
            client_name,
            project_manager,
            start_date,
            end_date,
            status,
            projectId
        ]
    );
};

exports.deleteProject = async (projectId) => {
    await pool.query(
        `DELETE FROM projects WHERE id=?`,
        [projectId]
    );
};

exports.getProjectById = async (projectId) => {
    const [rows] = await pool.query(
        `SELECT * FROM projects WHERE id=?`,
        [projectId]
    );

    return rows[0];
};

exports.getAllProjects = async () => {
    const [rows] = await pool.query(`
        SELECT 
            p.*,
            e.full_name AS project_manager_name
        FROM projects p
        LEFT JOIN employees e
        ON p.project_manager = e.id
        ORDER BY p.created_at DESC
    `);

    return rows;
};

/**
 * Assign employee to project
 */
exports.assignEmployee = async ({
    project_id,
    employee_id,
    assigned_from,
    assigned_to
}) => {
    const [result] = await pool.query(
        `INSERT INTO project_assignments
        (project_id, employee_id, assigned_from, assigned_to)
        VALUES (?, ?, ?, ?)`,
        [project_id, employee_id, assigned_from, assigned_to]
    );

    return result.insertId;
};


/**
 * Soft remove assignment (set assigned_to)
 */
exports.removeAssignment = async (
    project_id,
    employee_id,
    assigned_to
) => {
    await pool.query(
        `UPDATE project_assignments
         SET assigned_to = ?
         WHERE project_id = ?
         AND employee_id = ?
         AND assigned_to IS NULL`,
        [assigned_to, project_id, employee_id]
    );
};


/**
 * Check existing active assignment
 */
exports.getActiveAssignment = async (
    project_id,
    employee_id
) => {
    const [rows] = await pool.query(
        `SELECT * FROM project_assignments
         WHERE project_id = ?
         AND employee_id = ?
         AND assigned_to IS NULL`,
        [project_id, employee_id]
    );

    return rows[0];
};


/**
 * Get project team
 * Links projects.project_manager to employees.id (Auto-increment ID)
 */
exports.getProjectTeam = async (projectId) => {
    const query = `
        SELECT
            pa.id AS assignment_id,
            pa.project_id,
            pa.employee_id,
            pa.assigned_from,
            e.full_name,
            e.designation,
            m.full_name AS reporting_manager -- Fetches manager name using auto-increment ID
        FROM project_assignments pa
        JOIN employees e ON pa.employee_id = e.id
        JOIN projects p ON pa.project_id = p.id
        JOIN employees m ON p.project_manager = m.id -- Join project_manager ID to employees.id
        WHERE pa.project_id = ?
        AND pa.assigned_to IS NULL -- Ensures removed employees don't show up
        ORDER BY pa.assigned_from DESC
    `;

    const [rows] = await pool.query(query, [projectId]);
    return rows;
};


/**
 * Get employee project history
 */
exports.getEmployeeProjects = async (employeeId) => {
    const query = `
        SELECT
            pa.id AS assignment_id,
            pa.project_id,
            pa.assigned_from,
            pa.assigned_to,
            p.name AS project_name,
            p.status AS project_status,
            m.full_name AS reporting_manager -- Links project_manager to employees.id
        FROM project_assignments pa
        JOIN projects p ON pa.project_id = p.id
        JOIN employees m ON p.project_manager = m.id
        WHERE pa.employee_id = ?
        ORDER BY pa.assigned_from DESC
    `;

    const [rows] = await pool.query(query, [employeeId]);
    return rows;
};
