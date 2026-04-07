const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const auth = require('../middleware/auth');
const assistantController = require('../controllers/assistant.controller');

// Limitar a 30 peticiones por minuto por IP (sin costo — lógica local)
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas peticiones al asistente, intenta más tarde' },
});

// POST /api/assistant — requiere autenticación JWT
router.post('/', auth, assistantLimiter, assistantController.ask);

module.exports = router;
