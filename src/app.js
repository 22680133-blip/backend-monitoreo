const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const deviceRoutes = require('./routes/devices');
const profileRoutes = require('./routes/profile');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rutas de autenticación (sin cambios)
app.use('/api/auth', authRoutes);

// Rutas de perfil y contraseña (montadas en /api/auth para compartir prefijo)
app.use('/api/auth', profileRoutes);

// Rutas de dispositivos
app.use('/api/devices', deviceRoutes);

app.get('/', (req, res) => {
  res.json({ mensaje: "API Monitoreo funcionando 🔥" });
});

module.exports = app;