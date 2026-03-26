/**
 * Controlador de ingesta HTTP — raw pg
 *
 * Endpoint público para que el ESP32 envíe lecturas vía HTTP.
 * El ESP32 se identifica con su device_code (ej: "FRIDGE-A1B2"),
 * ya sea como parámetro en la URL o en el body del request.
 * No requiere JWT — la autenticación se basa en el código único.
 */
const pool = require('../config/db');

// ============================================================
// POST /api/ingest/:deviceCode  — device code en URL
// POST /api/ingest              — device code en body (device_code)
// ============================================================
exports.ingest = async (req, res) => {
  try {
    const rawCode = req.params.deviceCode || req.body.device_code;
    const { temperatura, humedad, compresor, energia } = req.body;

    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      return res.status(400).json({ mensaje: 'device_code es requerido (en URL o body)' });
    }

    const deviceCode = rawCode.trim();

    if (temperatura === undefined || temperatura === null) {
      return res.status(400).json({ mensaje: 'Campo "temperatura" es requerido' });
    }

    // Buscar dispositivo por device_code
    const deviceResult = await pool.query(
      'SELECT id FROM devices WHERE device_code = $1 LIMIT 1',
      [deviceCode]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Dispositivo no registrado' });
    }

    const deviceId = deviceResult.rows[0].id;

    // Guardar la lectura
    const result = await pool.query(
      `INSERT INTO readings (device_id, temperatura, humedad, compresor, energia)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        deviceId,
        temperatura,
        humedad ?? null,
        compresor ?? true,
        energia || 'Normal',
      ]
    );

    // Actualizar estado del dispositivo
    const newStatus = energia === 'Falla' ? 'alerta' : 'activo';
    await pool.query(
      'UPDATE devices SET status = $1 WHERE id = $2',
      [newStatus, deviceId]
    );

    console.log(`📡 [HTTP] [${deviceCode}] Temperatura: ${temperatura}°C | Energía: ${energia || 'Normal'}`);
    res.status(201).json({ mensaje: 'Lectura registrada', reading: result.rows[0] });
  } catch (error) {
    console.error('Error en ingesta HTTP:', error);
    res.status(500).json({ mensaje: 'Error al guardar lectura' });
  }
};
