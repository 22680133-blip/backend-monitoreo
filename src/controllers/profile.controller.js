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

    // Build dynamic SET clause — only update columns that were sent
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (nombre !== undefined) {
      setClauses.push(`nombre = $${paramIndex++}`);
      values.push(String(nombre).trim());
    }
    if (telefono !== undefined) {
      setClauses.push(`telefono = $${paramIndex++}`);
      values.push(String(telefono).trim());
    }
    if (ubicacion !== undefined) {
      setClauses.push(`ubicacion = $${paramIndex++}`);
      values.push(String(ubicacion).trim());
    }
    if (picture !== undefined) {
      setClauses.push(`picture = $${paramIndex++}`);
      values.push(picture || null);
    }

    if (setClauses.length === 0) {
      const user = current.rows[0];
      return res.json({ usuario: formatUser(user) });
    }

    values.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    res.json({ usuario: formatUser(result.rows[0]) });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);

    // If a column doesn't exist (e.g. telefono/ubicacion not yet added),
    // retry with only the core columns (nombre, picture).
    if (error.code === '42703') {
      try {
        const { nombre, picture } = req.body;
        const userId = getUserId(req);
        const cur = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (cur.rows.length === 0) {
          return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }
        const user = cur.rows[0];
        const fallbackSet = [];
        const fallbackVals = [];
        let idx = 1;
        if (nombre !== undefined) {
          fallbackSet.push(`nombre = $${idx++}`);
          fallbackVals.push(String(nombre).trim());
        }
        if (picture !== undefined) {
          fallbackSet.push(`picture = $${idx++}`);
          fallbackVals.push(picture || null);
        }
        if (fallbackSet.length === 0) {
          return res.json({ usuario: formatUser(user) });
        }
        fallbackVals.push(userId);
        const result = await pool.query(
          `UPDATE users SET ${fallbackSet.join(', ')} WHERE id = $${idx} RETURNING *`,
          fallbackVals,
        );
        return res.json({ usuario: formatUser(result.rows[0]) });
      } catch (fallbackError) {
        console.error('Error en fallback de perfil:', fallbackError);
        return res.status(500).json({ mensaje: 'Error al actualizar perfil' });
      }
    }

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
