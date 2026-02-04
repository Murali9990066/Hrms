const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');

router.get('/employees', adminController.getAllEmployees);
router.patch('/employees/:employeeId/status', adminController.updateEmployeeStatus);
router.patch('/employees/:employeeId/role', adminController.updateEmployeeRole);

module.exports = router;
