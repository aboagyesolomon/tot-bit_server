const express = require('express');
const authController = require('../controllers/authControllers');
const router = express.Router();

router.post('api/auth', authController.loginUser);

module.exports = router;
