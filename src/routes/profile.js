const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const profileController = require('../controllers/profile.controller');

// Todas las rutas de perfil requieren autenticación
router.get('/me', auth, profileController.getMe);
router.put('/profile', auth, profileController.updateProfile);
router.put('/password', auth, profileController.changePassword);

module.exports = router;
