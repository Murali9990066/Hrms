const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');
router.get('/employees', authenticate, adminController.getAllEmployees);
router.get('/employees/:employeeId', authenticate, adminController.getAllEmployees);
router.patch('/employees/:employeeId/profile', authenticate, adminController.adminUpdateEmployeeProfile);
router.patch('/documents/review', authenticate, adminController.reviewEmployeeDocument);

router.post(
    '/bulk-onboard',
    authenticate,
    authorizeRoles('ADMIN', 'HR'), 
    adminController.uploadLocal.single('file'),
    adminController.bulkOnboard
);


module.exports = router;
