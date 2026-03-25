require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { connectDB, sequelize } = require('./src/config/db');
const mqttClient = require('./src/mqtt/mqtt.client');

const authRoutes = require('./src/routes/auth.routes');
const deviceRoutes = require('./src/routes/device.routes');
const readingRoutes = require('./src/routes/reading.routes');
const ingestRoutes = require('./src/routes/ingest.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: en producción, permite orígenes configurados + orígenes de Capacitor/Ionic
// Si ALLOWED_ORIGINS no está definido, refleja el origen de la solicitud (permite cualquiera)
const configuredOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
const allowedOrigins = process.env.NODE_ENV === 'production' && configuredOrigins.length > 0
  ? [
      ...configuredOrigins,
      'capacitor://localhost',
      'ionic://localhost',
      'http://localhost',
      'http://localhost:8100',
    ]
  : null; // null = allow all origins (development or when ALLOWED_ORIGINS is not configured)

const corsOptions = {
  origin: allowedOrigins === null
    ? true // reflect request origin in development (supports credentials)
    : function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        console.warn(`⚠️ CORS bloqueó origen: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      },
  credentials: true,
};

// Rate limiting para rutas de autenticación (más restrictivo)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 20,                    // máximo 20 intentos por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
});

// Rate limiting general para rutas protegidas
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.' },
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Rutas
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/devices', apiLimiter, deviceRoutes);
app.use('/api/readings', apiLimiter, readingRoutes);
app.use('/api/ingest', apiLimiter, ingestRoutes);

// Health check
app.get('/', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    await sequelize.authenticate();
    dbStatus = 'connected';
  } catch (err) {
    console.error('❌ Health check — DB disconnected:', err.message);
    dbStatus = 'disconnected';
  }
  res.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    app: 'App-Fixel Backend',
    version: '1.0.0',
    database: dbStatus,
  });
});

// Iniciar servidor
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    mqttClient.connect();
  });
});

