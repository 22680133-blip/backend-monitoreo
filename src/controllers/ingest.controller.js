/**
 * Controlador de ingesta — recibe lecturas del ESP32
 *
 * El ESP32 envía un POST con Content-Type: application/json y un cuerpo como:
 *   { "device_code": "FRIDGE-XXXX", "temperatura": 5.2, "humedad": 60 }
 *
 * No requiere JWT; se autentica por el device_code único del dispositivo.
 */
const pool = require('../config/db');

// ============================================================
// POST /api/ingest — Recibir lectura del ESP32
// ============================================================
exports.createReading = async (req, res) => {
  try {
    const { device_code, temperatura, humedad } = req.body;

    // --- Validación básica ------------------------------------------------
    if (!device_code) {
      return res.status(400).json({ mensaje: 'device_code es requerido' });
    }

    if (temperatura === undefined || temperatura === null) {
      return res.status(400).json({ mensaje: 'temperatura es requerida' });
    }

    const temp = parseFloat(temperatura);
    if (isNaN(temp)) {
      return res.status(400).json({ mensaje: 'temperatura debe ser un número válido' });
    }

    let hum = null;
    if (humedad !== undefined && humedad !== null) {
      hum = parseFloat(humedad);
      if (isNaN(hum)) {
        return res.status(400).json({ mensaje: 'humedad debe ser un número válido' });
      }
    }

    // --- Buscar dispositivo por device_code --------------------------------
    const deviceResult = await pool.query(
      'SELECT id FROM devices WHERE device_code = $1 LIMIT 1',
      [device_code]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });
    }

    const deviceId = deviceResult.rows[0].id;

    // --- Insertar lectura --------------------------------------------------
    const reading = await pool.query(
      `INSERT INTO readings (device_id, temperatura, humedad)
       VALUES ($1, $2, $3)
       RETURNING id, device_id, temperatura, humedad, created_at`,
      [deviceId, temp, hum]
    );

    // --- Actualizar estado del dispositivo a "conectado" -------------------
    await pool.query(
      `UPDATE devices SET status = 'conectado' WHERE id = $1`,
      [deviceId]
    );

    res.status(201).json({
      mensaje: 'Lectura registrada',
      reading: reading.rows[0],
    });
  } catch (error) {
    console.error('Error en ingesta:', error);
    res.status(500).json({ mensaje: 'Error al registrar lectura' });
  }
};

// ============================================================
// GET /api/ingest/:device_code — Últimas lecturas (público)
// ============================================================
exports.getReadings = async (req, res) => {
  try {
    const { device_code } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);

    const deviceResult = await pool.query(
      'SELECT id FROM devices WHERE device_code = $1 LIMIT 1',
      [device_code]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });
    }

    const deviceId = deviceResult.rows[0].id;

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
    console.error('Error al obtener lecturas:', error);
    res.status(500).json({ mensaje: 'Error al obtener lecturas' });
  }
};
