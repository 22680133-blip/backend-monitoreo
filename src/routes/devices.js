const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const auth = require('../middleware/auth');
const deviceController = require('../controllers/device.controller');

// Rate limiter para las lecturas del dispositivo (120 req/min por IP)
const readingsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas peticiones, intenta más tarde' },
});

// Todas las rutas de dispositivos requieren autenticación
router.use(auth);

router.get('/', deviceController.getDevices);
router.get('/:id', deviceController.getDevice);
router.get('/:id/readings', readingsLimiter, deviceController.getDeviceReadings);
router.post('/', deviceController.createDevice);
router.put('/:id', deviceController.updateDevice);
router.delete('/:id', deviceController.deleteDevice);

module.exports = router;