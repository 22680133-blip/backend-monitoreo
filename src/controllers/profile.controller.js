/**
 * Controlador de perfil de usuario — raw pg
 *
 * Columnas usadas de la tabla users:
 *   id, nombre, email, picture, telefono, ubicacion, password_hash
 *
 * Para agregar las columnas telefono y ubicacion ejecuta:
 *   ALTER TABLE users ADD COLUMN IF NOT EXISTS telefono VARCHAR DEFAULT NULL;
 *   ALTER TABLE users ADD COLUMN IF NOT EXISTS ubicacion VARCHAR DEFAULT NULL;
 */
const bcrypt = require('bcrypt');
const pool = require('../config/db');

// Helper: obtener userId del request (compatible con ambos middleware)
function getUserId(req) {
  return req.userId || req.user?.id;
}

// Helper: convierte fila de DB a formato JSON del frontend
function formatUser(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    picture: row.picture || null,
    telefono: row.telefono || '',
    ubicacion: row.ubicacion || '',
  };
}

// ============================================================
// PUT /api/auth/profile — Actualizar perfil del usuario
// ============================================================
exports.updateProfile = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { nombre, telefono, ubicacion, picture } = req.body;

    // Obtener usuario actual
    const current = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (current.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    const user = current.rows[0];

    const result = await pool.query(
      `UPDATE users
       SET nombre = $1, telefono = $2, ubicacion = $3, picture = $4
       WHERE id = $5
       RETURNING *`,
      [
        nombre !== undefined ? String(nombre).trim() : user.nombre,
        telefono !== undefined ? String(telefono).trim() : user.telefono,
        ubicacion !== undefined ? String(ubicacion).trim() : user.ubicacion,
        picture !== undefined ? picture : user.picture,
        userId,
      ]
    );

    res.json({ usuario: formatUser(result.rows[0]) });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ mensaje: 'Error al actualizar perfil' });
  }
};

// ============================================================
// PUT /api/auth/password — Cambiar contraseña
// ============================================================
exports.changePassword = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ mensaje: 'Contraseña actual y nueva son requeridas' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ mensaje: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({ mensaje: 'Tu cuenta usa autenticación social. No puedes cambiar contraseña.' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ mensaje: 'Contraseña actual incorrecta' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ mensaje: 'Error al cambiar contraseña' });
  }
};

// ============================================================
// GET /api/auth/me — Obtener datos actuales del usuario
// ============================================================
exports.getMe = async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json({ usuario: formatUser(result.rows[0]) });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ mensaje: 'Error al obtener perfil' });
  }
};
