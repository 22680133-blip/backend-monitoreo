const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const ingestController = require('../controllers/ingest.controller');

// Limitar a 120 peticiones por minuto por IP (aprox. 1 lectura cada 0.5 s)
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas peticiones, intenta más tarde' },
});

// ESP32 envía lecturas aquí (sin JWT, autenticado por device_code)
router.post('/', ingestLimiter, ingestController.createReading);

// Consultar últimas lecturas de un dispositivo
router.get('/:device_code', ingestLimiter, ingestController.getReadings);

module.exports = router;
