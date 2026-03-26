const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const assistantController = require('../controllers/assistant.controller');

// Limitar a 20 peticiones por minuto por IP (más restrictivo que otros endpoints)
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas peticiones al asistente, intenta más tarde' },
});

// POST /api/assistant
router.post('/', assistantLimiter, assistantController.ask);

module.exports = router;
