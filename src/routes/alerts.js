const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const alertController = require('../controllers/alert.controller');

// Limitar a 120 peticiones por minuto por IP
const alertsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas peticiones, intenta más tarde' },
});

// GET /api/alerts
router.get('/', alertsLimiter, alertController.getAlerts);

module.exports = router;
