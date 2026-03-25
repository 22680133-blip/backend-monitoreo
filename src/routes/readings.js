const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const readingsController = require('../controllers/readings.controller');

// Limitar a 120 peticiones por minuto por IP
const readingsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas peticiones, intenta más tarde' },
});

// GET /api/readings?device_code=FRIGORÍFICO-9A50&limit=50
router.get('/', readingsLimiter, readingsController.getReadings);

module.exports = router;
