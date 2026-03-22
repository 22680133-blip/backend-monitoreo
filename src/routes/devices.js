const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const deviceController = require('../controllers/device.controller');

// Todas las rutas de dispositivos requieren autenticación
router.use(auth);

router.get('/', deviceController.getDevices);
router.get('/:id', deviceController.getDevice);
router.post('/', deviceController.createDevice);
router.put('/:id', deviceController.updateDevice);
router.delete('/:id', deviceController.deleteDevice);

module.exports = router;