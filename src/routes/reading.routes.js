const express = require('express');
const { Op } = require('sequelize');
const auth = require('../middleware/auth.middleware');
const Reading = require('../models/reading.model');
const Device = require('../models/device.model');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(auth);

// ============================================================
// GET /api/readings/latest/:deviceId
// Última lectura de temperatura del dispositivo
// ============================================================
router.get('/latest/:deviceId', async (req, res) => {
  try {
    const device = await Device.findOne({ where: { id: req.params.deviceId, userId: req.userId } });
    if (!device) return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });

    const reading = await Reading.findOne({
      where: { deviceId: req.params.deviceId },
      order: [['timestamp', 'DESC']],
      raw: true,
    });

    return res.json({ reading: reading || null });
  } catch (error) {
    console.error('❌ Error get latest reading:', error.message);
    return res.status(500).json({ mensaje: 'Error al obtener lectura' });
  }
});

// ============================================================
// GET /api/readings/history/:deviceId
// Historial de lecturas de las últimas 24 horas
// ============================================================
router.get('/history/:deviceId', async (req, res) => {
  try {
    const device = await Device.findOne({ where: { id: req.params.deviceId, userId: req.userId } });
    if (!device) return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const readings = await Reading.findAll({
      where: {
        deviceId: req.params.deviceId,
        timestamp: { [Op.gte]: since },
      },
      order: [['timestamp', 'ASC']],
      raw: true,
    });

    return res.json({ readings });
  } catch (error) {
    console.error('❌ Error get history:', error.message);
    return res.status(500).json({ mensaje: 'Error al obtener historial' });
  }
});

// ============================================================
// POST /api/readings/:deviceId
// Guardar una lectura manualmente (para pruebas sin ESP32)
// En producción las lecturas llegan vía MQTT
// ============================================================
router.post('/:deviceId', async (req, res) => {
  try {
    const device = await Device.findOne({ where: { id: req.params.deviceId, userId: req.userId } });
    if (!device) return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });

    const { temperatura, humedad, compresor, energia } = req.body;
    const reading = await Reading.create({
      deviceId: req.params.deviceId,
      temperatura,
      humedad: humedad ?? null,
      compresor: compresor ?? true,
      energia: energia || 'Normal',
    });

    // Actualizar estado del dispositivo
    device.status = energia === 'Falla' ? 'alerta' : 'activo';
    await device.save();

    return res.status(201).json({ reading });
  } catch (error) {
    console.error('❌ Error save reading:', error.message);
    return res.status(500).json({ mensaje: 'Error al guardar lectura' });
  }
});

module.exports = router;
