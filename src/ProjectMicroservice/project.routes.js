const express = require('express');
const router = express.Router();

const projectController = require('./project.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');
// creating projects
router.post('/CreateProject', authenticate, projectController.createProject);
router.put('/UpdateProject/:projectId', authenticate, projectController.updateProject);
router.delete('/DeleteProject/:projectId', authenticate, projectController.deleteProject);
router.get('/', authenticate, projectController.getProjects);
router.get('/:projectId', authenticate, projectController.getProjects);
// project assignments
router.post('/project-assignments',authenticate,projectController.assignEmployee);
router.put('/project-assignments/remove', authenticate, projectController.removeAssignment);
router.get('/:projectId/team', authenticate, projectController.getProjectTeam);
router.get('/employees/:employeeId', authenticate, projectController.getEmployeeProjects);
module.exports = router;