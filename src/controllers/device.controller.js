/**
 * Controlador de dispositivos — CRUD con raw pg
 *
 * Tabla devices en PostgreSQL:
 *   id            SERIAL PRIMARY KEY
 *   user_id       INTEGER REFERENCES users(id)
 *   nombre        VARCHAR
 *   ubicacion     VARCHAR
 *   limite_min    FLOAT  (default 2)
 *   limite_max    FLOAT  (default 8)
 *   created_at    TIMESTAMP DEFAULT NOW()
 *   status        VARCHAR DEFAULT 'desconectado'
 *   device_code   VARCHAR UNIQUE  (auto-generado: "FRIDGE-XXXX")
 *   device_id     VARCHAR          (nullable, para integración externa)
 */
const crypto = require('crypto');
const pool = require('../config/db');

// ============================================================
// Helper: convierte fila de DB a formato JSON del frontend
// ============================================================
function formatDevice(row) {
  return {
    id: row.id,
    deviceId: row.device_code,
    deviceCode: row.device_code,
    device_id: row.device_id || null,
    nombre: row.nombre,
    ubicacion: row.ubicacion,
    limiteMin: parseFloat(row.limite_min),
    limiteMax: parseFloat(row.limite_max),
    status: row.status,
    createdAt: row.created_at,
  };
}

// ============================================================
// Helper: genera un device_code único "FRIDGE-XXXX"
// ============================================================
async function generateDeviceCode() {
  let code;
  let exists = true;

  while (exists) {
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    code = `FRIDGE-${suffix}`;

    const result = await pool.query(
      'SELECT 1 FROM devices WHERE device_code = $1 LIMIT 1',
      [code]
    );
    exists = result.rows.length > 0;
  }

  return code;
}

// Helper: obtener userId del request (compatible con ambos middleware)
function getUserId(req) {
  return req.userId || req.user?.id;
}

// ============================================================
// GET /api/devices — Listar dispositivos del usuario
// ============================================================
exports.getDevices = async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await pool.query(
      'SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const devices = result.rows.map(formatDevice);
    res.json({ devices });
  } catch (error) {
    console.error('Error al obtener dispositivos:', error);
    res.status(500).json({ mensaje: 'Error al obtener dispositivos' });
  }
};

// ============================================================
// GET /api/devices/:id — Obtener un dispositivo
// ============================================================
exports.getDevice = async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await pool.query(
      'SELECT * FROM devices WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });
    }

    res.json({ device: formatDevice(result.rows[0]) });
  } catch (error) {
    console.error('Error al obtener dispositivo:', error);
    res.status(500).json({ mensaje: 'Error al obtener dispositivo' });
  }
};

// ============================================================
// POST /api/devices — Crear un nuevo dispositivo
// ============================================================
exports.createDevice = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { nombre, ubicacion, limiteMin, limiteMax, device_id } = req.body;
    const deviceCode = await generateDeviceCode();

    const result = await pool.query(
      `INSERT INTO devices (user_id, nombre, ubicacion, limite_min, limite_max, device_code, device_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        (nombre || 'Mi Refrigerador').trim(),
        (ubicacion || '').trim(),
        limiteMin ?? 2,
        limiteMax ?? 8,
        deviceCode,
        device_id ? String(device_id).trim() : null,
        'desconectado',
      ]
    );

    res.status(201).json({ device: formatDevice(result.rows[0]) });
  } catch (error) {
    console.error('Error al crear dispositivo:', error);
    res.status(500).json({ mensaje: 'Error al crear dispositivo' });
  }
};

// ============================================================
// PUT /api/devices/:id — Actualizar configuración
// ============================================================
exports.updateDevice = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { nombre, ubicacion, limiteMin, limiteMax, device_id } = req.body;

    // Verificar que el dispositivo pertenece al usuario
    const check = await pool.query(
      'SELECT * FROM devices WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });
    }

    const current = check.rows[0];

    const result = await pool.query(
      `UPDATE devices
       SET nombre = $1, ubicacion = $2, limite_min = $3, limite_max = $4, device_id = $5
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [
        (nombre !== undefined && nombre !== null) ? String(nombre).trim() : current.nombre,
        (ubicacion !== undefined && ubicacion !== null) ? String(ubicacion).trim() : current.ubicacion,
        limiteMin !== undefined ? limiteMin : current.limite_min,
        limiteMax !== undefined ? limiteMax : current.limite_max,
        device_id !== undefined ? (device_id ? String(device_id).trim() : null) : current.device_id,
        req.params.id,
        userId,
      ]
    );

    res.json({ device: formatDevice(result.rows[0]) });
  } catch (error) {
    console.error('Error al actualizar dispositivo:', error);
    res.status(500).json({ mensaje: 'Error al actualizar dispositivo' });
  }
};

// ============================================================
// DELETE /api/devices/:id — Eliminar un dispositivo
// ============================================================
exports.deleteDevice = async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await pool.query(
      'DELETE FROM devices WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });
    }

    res.json({ mensaje: 'Dispositivo eliminado' });
  } catch (error) {
    console.error('Error al eliminar dispositivo:', error);
    res.status(500).json({ mensaje: 'Error al eliminar dispositivo' });
  }
};

// ============================================================
// GET /api/devices/:id/readings — Lecturas de un dispositivo (para el dashboard)
// ============================================================
exports.getDeviceReadings = async (req, res) => {
  try {
    const userId = getUserId(req);
    const parsed = parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(parsed > 0 ? parsed : 50, 1), 500);

    // Verificar que el dispositivo pertenece al usuario
    const check = await pool.query(
      'SELECT id FROM devices WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });
    }

    const deviceId = check.rows[0].id;

    const readings = await pool.query(
      `SELECT id, temperatura, humedad, created_at
       FROM readings
       WHERE device_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [deviceId, limit]
    );

    res.json({ readings: readings.rows });
  } catch (error) {
    console.error('Error al obtener lecturas del dispositivo:', error);
    res.status(500).json({ mensaje: 'Error al obtener lecturas' });
  }
};

// ============================================================
// Aliases para compatibilidad con rutas existentes en backend-monitoreo
// (las rutas desplegadas usan .create, .getAll, .getOne, .update, .remove)
// ============================================================
exports.create = exports.createDevice;
exports.getAll = exports.getDevices;
exports.getOne = exports.getDevice;
exports.update = exports.updateDevice;
exports.remove = exports.deleteDevice;
