/**
 * Controlador de lecturas — endpoint público GET /api/readings
 *
 * Devuelve las últimas lecturas de todos los dispositivos o filtradas
 * por device_code. No requiere JWT.
 *
 * Tabla origen: temperatures (id, device_id, temperatura, humedad, fecha)
 * Campo fecha en DB → se devuelve como "timestamp" en la API.
 */
const pool = require('../config/db');

// ============================================================
// GET /api/readings — Últimas lecturas (público)
// ============================================================
exports.getReadings = async (req, res) => {
  try {
    const { device_code } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);

    let query;
    let params;

    if (device_code) {
      console.log(`📖 GET /api/readings — Filtrando por device_code: "${device_code}"`);

      query = `
        SELECT d.device_code,
               t.temperatura,
               t.humedad,
               t.fecha AS timestamp
        FROM temperatures t
        JOIN devices d ON d.id = t.device_id
        WHERE d.device_code = $1 OR d.device_id = $1
        ORDER BY t.fecha DESC
        LIMIT $2
      `;
      params = [device_code, limit];
    } else {
      console.log('📖 GET /api/readings — Sin filtro, devolviendo últimas lecturas');

      query = `
        SELECT d.device_code,
               t.temperatura,
               t.humedad,
               t.fecha AS timestamp
        FROM temperatures t
        JOIN devices d ON d.id = t.device_id
        ORDER BY t.fecha DESC
        LIMIT $1
      `;
      params = [limit];
    }

    const result = await pool.query(query, params);

    console.log(`📖 GET /api/readings — Devolviendo ${result.rows.length} lecturas`);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en GET /api/readings:', error);
    res.status(500).json({ mensaje: 'Error al obtener lecturas' });
  }
};
