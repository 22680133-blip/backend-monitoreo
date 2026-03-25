const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const deviceRoutes = require('./routes/devices');
const profileRoutes = require('./routes/profile');
const ingestRoutes = require('./routes/ingest');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiter general para endpoints públicos ligeros
const statusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas peticiones, intenta más tarde' },
});

// Rutas de autenticación (sin cambios)
app.use('/api/auth', authRoutes);

// Rutas de perfil y contraseña (montadas en /api/auth para compartir prefijo)
app.use('/api/auth', profileRoutes);

// Rutas de dispositivos
app.use('/api/devices', deviceRoutes);

// Ruta de ingesta — el ESP32 envía lecturas aquí (Content-Type: application/json)
app.use('/api/ingest', ingestRoutes);

app.get('/', (req, res) => {
  res.json({ mensaje: "API Monitoreo funcionando 🔥" });
});

// Endpoint de estado — útil para verificar conectividad desde el ESP32 o la app
app.get('/api/status', statusLimiter, async (req, res) => {
  try {
    const pool = require('./config/db');
    const dbResult = await pool.query('SELECT NOW() AS now');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: 'connected',
      dbTime: dbResult.rows[0].now,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      db: 'disconnected',
      error: error.message,
    });
  }
});

module.exports = app;