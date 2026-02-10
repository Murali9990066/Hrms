const projectModel = require('./project.model');

/**
 * CREATE PROJECT
 * Roles: ADMIN, HR, MANAGER
 */
exports.createProject = async (req, res) => {
    try {
        const { role } = req.user;

        if (!['ADMIN', 'HR', 'MANAGER'].includes(role)) {
            return res.status(403).json({
                status: 'error',
                statusCode: 403,
                message: 'You are not allowed to create projects'
            });
        }

        const {
            name,
            type,
            client_name,
            project_manager,
            start_date,
            end_date,
            status
        } = req.body;

        if (!name || !type || !project_manager || !start_date) {
            return res.status(400).json({
                status: 'error',
                statusCode: 400,
                message: 'Missing required fields'
            });
        }

        if (type === 'CLIENT' && !client_name) {
            return res.status(400).json({
                status: 'error',
                statusCode: 400,
                message: 'Client name required for CLIENT project'
            });
        }

        const projectId = await projectModel.createProject(req.body);

        return res.status(201).json({
            status: 'success',
            statusCode: 201,
            message: 'Project created successfully',
            data: { projectId }
        });

    } catch (error) {
        console.error('createProject error:', error);
        return res.status(500).json({
            status: 'error',
            statusCode: 500,
            message: 'Internal server error'
        });
    }
};


/**
 * UPDATE PROJECT
 * Roles: ADMIN, HR, MANAGER
 */
exports.updateProject = async (req, res) => {
    try {
        const { role } = req.user;
        const { projectId } = req.params;

        if (!['ADMIN', 'HR', 'MANAGER'].includes(role)) {
            return res.status(403).json({
                status: 'error',
                statusCode: 403,
                message: 'You are not allowed to update projects'
            });
        }

        const existingProject = await projectModel.getProjectById(projectId);

        if (!existingProject) {
            return res.status(404).json({
                status: 'error',
                statusCode: 404,
                message: 'Project not found'
            });
        }

        await projectModel.updateProject(projectId, req.body);

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: 'Project updated successfully',
            data: {}
        });

    } catch (error) {
        console.error('updateProject error:', error);
        return res.status(500).json({
            status: 'error',
            statusCode: 500,
            message: 'Internal server error'
        });
    }
};


/**
 * DELETE PROJECT
 * Roles: ADMIN, HR only
 */
exports.deleteProject = async (req, res) => {
    try {
        const { role } = req.user;
        const { projectId } = req.params;

        if (!['ADMIN', 'HR'].includes(role)) {
            return res.status(403).json({
                status: 'error',
                statusCode: 403,
                message: 'Only HR or ADMIN can delete projects'
            });
        }

        const existingProject = await projectModel.getProjectById(projectId);

        if (!existingProject) {
            return res.status(404).json({
                status: 'error',
                statusCode: 404,
                message: 'Project not found'
            });
        }

        await projectModel.deleteProject(projectId);

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: 'Project deleted successfully',
            data: {}
        });

    } catch (error) {
        console.error('deleteProject error:', error);
        return res.status(500).json({
            status: 'error',
            statusCode: 500,
            message: 'Internal server error'
        });
    }
};

/**
 * GET PROJECTS
 * - /projects → all projects
 * - /projects/:projectId → single project
 */
exports.getProjects = async (req, res) => {
    try {
        const { projectId } = req.params;

        let data;

        if (projectId) {
            data = await projectModel.getProjectById(projectId);

            if (!data) {
                return res.status(404).json({
                    status: 'error',
                    statusCode: 404,
                    message: 'Project not found'
                });
            }
        } else {
            data = await projectModel.getAllProjects();
        }

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: projectId
                ? 'Project fetched successfully'
                : 'Projects fetched successfully',
            data
        });

    } catch (error) {
        console.error('getProjects error:', error);
        return res.status(500).json({
            status: 'error',
            statusCode: 500,
            message: 'Internal server error'
        });
    }
};

exports.assignEmployee = async (req, res) => {
    try {
        const { role } = req.user;

        if (!['ADMIN', 'HR', 'MANAGER'].includes(role)) {
            return res.status(403).json({
                status: 'error',
                statusCode: 403,
                message: 'Not authorized'
            });
        }

        const {
            project_id,
            employee_id,
            assigned_from,
            assigned_to
        } = req.body;

        if (!project_id || !employee_id || !assigned_from) {
            return res.status(400).json({
                status: 'error',
                statusCode: 400,
                message: 'Missing required fields'
            });
        }

        const existing =
            await projectModel.getActiveAssignment(
                project_id,
                employee_id
            );

        if (existing) {
            return res.status(409).json({
                status: 'error',
                statusCode: 409,
                message: 'Employee already assigned'
            });
        }

        const id = await projectModel.assignEmployee(req.body);

        return res.status(201).json({
            status: 'success',
            statusCode: 201,
            message: 'Employee assigned successfully',
            data: { assignmentId: id }
        });

    } catch (error) {
        console.error('assignEmployee error:', error);
        return res.status(500).json({
            status: 'error',
            statusCode: 500,
            message: 'Internal server error'
        });
    }
};


/**
 * REMOVE EMPLOYEE FROM PROJECT (soft remove)
 */
exports.removeAssignment = async (req, res) => {
    try {
        const { role } = req.user;

        if (!['ADMIN', 'HR', 'MANAGER'].includes(role)) {
            return res.status(403).json({
                status: 'error',
                statusCode: 403,
                message: 'Not authorized'
            });
        }

        const { project_id, employee_id } = req.body;

        if (!project_id || !employee_id) {
            return res.status(400).json({
                status: 'error',
                statusCode: 400,
                message: 'project_id and employee_id required'
            });
        }

        await projectModel.removeAssignment(
            project_id,
            employee_id,
            new Date()
        );

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: 'Employee removed from project',
            data: {}
        });

    } catch (error) {
        console.error('removeAssignment error:', error);
        return res.status(500).json({
            status: 'error',
            statusCode: 500,
            message: 'Internal server error'
        });
    }
};


/**
 * GET PROJECT TEAM
 */
exports.getProjectTeam = async (req, res) => {
    try {
        const { projectId } = req.params;

        const team = await projectModel.getProjectTeam(projectId);

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: 'Project team fetched',
            data: team
        });

    } catch (error) {
        console.error('getProjectTeam error:', error);
        return res.status(500).json({
            status: 'error',
            statusCode: 500,
            message: 'Internal server error'
        });
    }
};


/**
 * GET EMPLOYEE PROJECT HISTORY
 */
exports.getEmployeeProjects = async (req, res) => {
    try {
        const { employeeId } = req.params;

        const projects =
            await projectModel.getEmployeeProjects(employeeId);

        return res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: 'Employee projects fetched',
            data: projects
        });

    } catch (error) {
        console.error('getEmployeeProjects error:', error);
        return res.status(500).json({
            status: 'error',
            statusCode: 500,
            message: 'Internal server error'
        });
    }
};