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
    console.log("Datos recibidos:", req.body);

    const rawCode = req.params.deviceCode || req.body.device_code;
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

    // Validar que el device_code existe en la tabla devices
    const deviceResult = await pool.query(
      'SELECT id FROM devices WHERE device_code = $1',
      [deviceCode]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Dispositivo no registrado' });
    }

    const deviceId = deviceResult.rows[0].id;

    // Guardar la lectura en tabla temperatures
    await pool.query(
      `INSERT INTO temperatures (device_id, temperatura, humedad, fecha)
       VALUES ($1, $2, $3, NOW())`,
      [deviceId, temp, hum]
    );

    console.log("Insert ejecutado correctamente");

    // --- Generación de alertas (no afecta el guardado de temperatura) ---
    try {
      const limitsResult = await pool.query(
        'SELECT limite_min, limite_max FROM devices WHERE id = $1',
        [deviceId]
      );

      if (limitsResult.rows.length > 0) {
        const { limite_min, limite_max } = limitsResult.rows[0];
        let tipo = null;
        let mensaje = null;

        if (limite_max !== null && temp > limite_max) {
          tipo = 'ALTA';
          mensaje = `Temperatura alta: ${temp}°C supera el límite de ${limite_max}°C`;
        } else if (limite_min !== null && temp < limite_min) {
          tipo = 'BAJA';
          mensaje = `Temperatura baja: ${temp}°C por debajo del límite de ${limite_min}°C`;
        }

        if (tipo) {
          // Evitar duplicar alertas: verificar si ya existe una alerta reciente del mismo tipo
          const recentAlert = await pool.query(
            `SELECT id FROM alert
             WHERE device_id = $1 AND tipo = $2
             AND fecha > NOW() - INTERVAL '10 minutes'
             ORDER BY fecha DESC LIMIT 1`,
            [deviceId, tipo]
          );

          if (recentAlert.rows.length === 0) {
            await pool.query(
              `INSERT INTO alert (device_id, tipo, mensaje, fecha, leida)
               VALUES ($1, $2, $3, NOW(), false)`,
              [deviceId, tipo, mensaje]
            );
            console.log("Alerta generada:", tipo);
          }
        }
      }
    } catch (alertError) {
      console.error('⚠️ Error al generar alerta (no afecta lectura):', alertError.message);
    }
    // --- Fin generación de alertas ---

    res.status(201).json({ mensaje: 'Lectura registrada' });
  } catch (error) {
    console.error('Error en ingesta HTTP:', error);
    res.status(500).json({ mensaje: 'Error al guardar lectura' });
  }
};
