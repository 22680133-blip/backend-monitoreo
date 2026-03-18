const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/login-or-register', authController.loginOrRegister);
router.post('/google-login', authController.googleLogin);

module.exports = router;