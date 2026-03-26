/**
 * Controlador de lecturas — endpoint público GET /api/readings
 *
 * Devuelve las últimas lecturas de todos los dispositivos o filtradas
 * por device_code. No requiere JWT.
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
      // Filtrar por device_code exacto (soporta acentos como "FRIGORÍFICO-9A50")
      console.log(`📖 GET /api/readings — Filtrando por device_code: "${device_code}"`);

      query = `
        SELECT d.device_code,
               r.temperatura,
               r.humedad,
               r.created_at AS timestamp
        FROM readings r
        JOIN devices d ON d.id = r.device_id
        WHERE d.device_code = $1 OR d.device_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2
      `;
      params = [device_code, limit];
    } else {
      // Sin filtro — devolver lecturas de todos los dispositivos
      console.log('📖 GET /api/readings — Sin filtro, devolviendo últimas lecturas');

      query = `
        SELECT d.device_code,
               r.temperatura,
               r.humedad,
               r.created_at AS timestamp
        FROM readings r
        JOIN devices d ON d.id = r.device_id
        ORDER BY r.created_at DESC
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
