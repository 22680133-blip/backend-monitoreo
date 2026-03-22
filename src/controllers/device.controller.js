const pool = require('../config/db');

/**
 * Genera código automático tipo FRIDGE-XXXX
 */
function generarCodigo() {
  const numero = Math.floor(1000 + Math.random() * 9000);
  return `FRIDGE-${numero}`;
}

/**
 * POST /api/devices — Crear dispositivo
 */
exports.create = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nombre, ubicacion, temp_min, temp_max } = req.body;

    const codigo = generarCodigo();

    const result = await pool.query(
      `INSERT INTO devices (user_id, codigo, nombre, ubicacion, temp_min, temp_max)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, codigo, nombre || null, ubicacion || null, temp_min || null, temp_max || null]
    );

    res.status(201).json({
      mensaje: 'Dispositivo creado',
      device: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear dispositivo:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/devices — Listar dispositivos del usuario
 */
exports.getAll = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT * FROM devices WHERE user_id = $1`,
      [userId]
    );

    res.json({ devices: result.rows });
  } catch (error) {
    console.error('Error al listar dispositivos:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/devices/:id — Obtener un dispositivo
 */
exports.getOne = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM devices WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });
    }

    res.json({ device: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener dispositivo:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * PUT /api/devices/:id — Actualizar nombre, ubicación, límites
 */
exports.update = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { nombre, ubicacion, temp_min, temp_max } = req.body;

    const result = await pool.query(
      `UPDATE devices
       SET nombre = COALESCE($1, nombre),
           ubicacion = COALESCE($2, ubicacion),
           temp_min = COALESCE($3, temp_min),
           temp_max = COALESCE($4, temp_max)
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [nombre, ubicacion, temp_min, temp_max, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });
    }

    res.json({
      mensaje: 'Dispositivo actualizado',
      device: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar dispositivo:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /api/devices/:id — Eliminar dispositivo
 */
exports.remove = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM devices WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Dispositivo no encontrado' });
    }

    res.json({ mensaje: 'Dispositivo eliminado' });
  } catch (error) {
    console.error('Error al eliminar dispositivo:', error);
    res.status(500).json({ error: error.message });
  }
};
