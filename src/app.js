const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const deviceRoutes = require('./routes/devices');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);

app.get('/', (req, res) => {
  res.json({ mensaje: "API Monitoreo funcionando 🔥" });
});

module.exports = app;