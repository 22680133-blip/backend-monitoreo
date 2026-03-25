const express = require('express');
const crypto = require('crypto');
const auth = require('../middleware/auth.middleware');
const Device = require('../models/device.model');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(auth);

// ============================================================
// Genera un deviceId único con formato "FRIDGE-XXXX"
// ============================================================
async function generateDeviceId() {
  let deviceId;
  let exists = true;
  while (exists) {
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    deviceId = `FRIDGE-${suffix}`;
    const count = await Device.count({ where: { deviceId } });
    exists = count > 0;
  }
  return deviceId;
}

// ============================================================
// GET /api/devices — Listar dispositivos del usuario
// ============================================================
router.get('/', async (req, res) => {
  try {
    const devices = await Device.findAll({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']],
    });
    return res.json({ devices });
  } catch (error) {
    console.error('❌ Error get devices:', error.message);
    return res.status(500).json({ mensaje: 'Error al obtener dispositivos' });
  }
});

// ============================================================
// GET /api/devices/:id — Obtener un dispositivo
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const device = await Device.findOne({ where: { id: req.params.id, userId: req.userId } });
    if (!device) return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });
    return res.json({ device });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener dispositivo' });
  }
});

// ============================================================
// POST /api/devices — Crear un nuevo dispositivo
// Genera automáticamente un deviceId único (ej: "FRIDGE-A1B2")
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { nombre, ubicacion, limiteMin, limiteMax } = req.body;
    const deviceId = await generateDeviceId();
    const device = await Device.create({
      userId: req.userId,
      deviceId,
      nombre: nombre || 'Mi Refrigerador',
      ubicacion: ubicacion || '',
      limiteMin: limiteMin ?? 2,
      limiteMax: limiteMax ?? 8,
    });
    return res.status(201).json({ device });
  } catch (error) {
    console.error('❌ Error create device:', error.message);
    return res.status(500).json({ mensaje: 'Error al crear dispositivo' });
  }
});

// ============================================================
// PUT /api/devices/:id — Actualizar configuración de un dispositivo
// ============================================================
router.put('/:id', async (req, res) => {
  try {
    const { nombre, ubicacion, limiteMin, limiteMax } = req.body;

    const device = await Device.findOne({ where: { id: req.params.id, userId: req.userId } });

    if (!device) return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });

    await device.update({ nombre, ubicacion, limiteMin, limiteMax });
    return res.json({ device });
  } catch (error) {
    console.error('❌ Error update device:', error.message);
    return res.status(500).json({ mensaje: 'Error al actualizar dispositivo' });
  }
});

// ============================================================
// DELETE /api/devices/:id — Eliminar un dispositivo
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    const device = await Device.findOne({ where: { id: req.params.id, userId: req.userId } });
    if (!device) return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });
    await device.destroy();
    return res.json({ mensaje: 'Dispositivo eliminado' });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al eliminar dispositivo' });
  }
});

module.exports = router;
