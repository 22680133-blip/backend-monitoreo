/**
 * Controlador de ingesta HTTP — raw pg
 *
 * Endpoint público para que el ESP32 envíe lecturas vía HTTP.
 * El ESP32 se identifica con su device_code (ej: "FRIGORIFICO-9A50"),
 * ya sea como parámetro en la URL o en el body del request.
 * No requiere JWT — la autenticación se basa en el código único.
 *
 * Tabla destino: temperatures (id, device_id, temperatura, humedad, fecha)
 */
const pool = require('../config/db');

// ============================================================
// POST /api/ingest/:deviceCode  — device code en URL
// POST /api/ingest              — device code en body (device_code)
// ============================================================
exports.ingest = async (req, res) => {
  try {
    console.log('Datos recibidos:', { device_code: req.body.device_code, temperatura: req.body.temperatura, humedad: req.body.humedad });

    const rawCode = req.params.deviceCode || req.body.device_code || req.body.device_id;
    const { temperatura, humedad } = req.body;

    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      return res.status(400).json({ mensaje: 'device_code es requerido (en URL o body)' });
    }

    const deviceCode = rawCode.trim();

    if (temperatura === undefined || temperatura === null) {
      return res.status(400).json({ mensaje: 'Campo "temperatura" es requerido' });
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

    // Buscar dispositivo por device_code o device_id
    const deviceResult = await pool.query(
      'SELECT id FROM devices WHERE device_code = $1 OR device_id = $1 LIMIT 1',
      [deviceCode]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Dispositivo no registrado' });
    }

    const deviceId = deviceResult.rows[0].id;

    // Guardar la lectura en tabla temperatures
    const result = await pool.query(
      `INSERT INTO temperatures (device_id, temperatura, humedad, fecha)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [deviceId, temp, hum]
    );

    // Actualizar estado del dispositivo a activo
    await pool.query(
      'UPDATE devices SET status = $1 WHERE id = $2',
      ['activo', deviceId]
    );

    console.log(`Datos guardados correctamente — [${deviceCode}] Temperatura: ${temp}°C`);
    res.status(201).json({ mensaje: 'Lectura registrada', reading: result.rows[0] });
  } catch (error) {
    console.error('Error en ingesta HTTP:', error);
    res.status(500).json({ mensaje: 'Error al guardar lectura' });
  }
};
