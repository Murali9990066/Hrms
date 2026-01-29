const express = require('express');
const router = express.Router();

const profileController = require('./profile.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * Profile APIs
 */
router.get('/getProfile', authenticate, profileController.getProfile);
router.put('/updateProfile', authenticate, profileController.updateProfile);

module.exports = router;
