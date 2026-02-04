const express = require('express');
const router = express.Router();

const profileController = require('./profile.controller');
const { authenticate,authorizeRoles } = require('../middlewares/auth.middleware');

/**
 * Profile APIs
 */
router.get('/getProfile', authenticate, profileController.getProfile);
router.put('/updateProfile', authenticate, profileController.updateProfile);
router.patch('/:employeeId/restricted',authenticate,authorizeRoles('MANAGER', 'HR', 'ADMIN'),profileController.updateRestrictedProfile);
router.post('/documents/upload', authenticate, profileController.upload.single('file'), profileController.uploadDocument);
router.get('/documents',authenticate,profileController.getDocuments);
router.get('/documents/access',authenticate,profileController.accessDocument);


module.exports = router;
