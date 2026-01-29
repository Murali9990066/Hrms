const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');

/**
 * Auth APIs
 */
router.post('/request-otp', authController.requestOtp);
router.post('/verify-otp', authController.verifyOtp);

module.exports = router;
