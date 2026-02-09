const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');
router.get('/employees', authenticate, adminController.getAllEmployees);
router.get('/employees/:employeeId', authenticate, adminController.getAllEmployees);
router.patch('/employees/:employeeId/profile', authenticate, adminController.adminUpdateEmployeeProfile);


module.exports = router;
