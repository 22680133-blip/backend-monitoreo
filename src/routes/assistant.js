const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const assistantController = require('../controllers/assistant.controller');

// Limitar a 10 peticiones por minuto por IP para conservar la cuota de Gemini
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas peticiones al asistente, intenta más tarde' },
});

// POST /api/assistant
router.post('/', assistantLimiter, assistantController.ask);

module.exports = router;
