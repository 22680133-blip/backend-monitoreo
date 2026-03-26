/**
 * Controlador de alertas — endpoint público GET /api/alerts
 *
 * Devuelve las alertas generadas automáticamente al recibir lecturas
 * fuera de los límites configurados en cada dispositivo.
 *
 * Tabla origen: alerts (id, device_id, tipo, mensaje, fecha, leida)
 */
const pool = require('../config/db');

// ============================================================
// GET /api/alerts — Últimas alertas (público)
// ============================================================
exports.getAlerts = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);

    const result = await pool.query(`
      SELECT a.*, d.device_code
      FROM alerts a
      JOIN devices d ON a.device_id = d.id
      ORDER BY a.fecha DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en GET /api/alerts:', error);
    res.status(500).json({ mensaje: 'Error al obtener alertas' });
  }
};
