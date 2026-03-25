const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const auth = require('../middleware/auth.middleware');
const User = require('../models/user.model');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/** Genera un JWT para el usuario dado */
const generateToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/** Formatea la respuesta de usuario para el frontend */
const formatUser = (user) => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  picture: user.picture,
  telefono: user.telefono || '',
  ubicacion: user.ubicacion || '',
});

/** Verifica si el error es de conexión a la base de datos */
const isConnectionError = (error) =>
  error.name === 'SequelizeConnectionError' ||
  error.name === 'SequelizeConnectionRefusedError' ||
  error.name === 'SequelizeHostNotFoundError' ||
  error.name === 'SequelizeConnectionTimedOutError';

// ============================================================
// POST /api/auth/register
// ============================================================
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ mensaje: 'Nombre, email y contraseña son requeridos' });
    }

    const existe = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existe) {
      return res.status(400).json({ mensaje: 'Este correo ya está registrado' });
    }

    const user = await User.create({ nombre, email, password });
    const token = generateToken(user);

    return res.status(201).json({ token, usuario: formatUser(user) });
  } catch (error) {
    console.error('❌ Error register:', error.message, error.stack);
    if (isConnectionError(error)) {
      return res.status(503).json({ mensaje: 'Error de conexión con la base de datos. Intenta de nuevo.' });
    }
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ============================================================
// POST /api/auth/login
// ============================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ mensaje: 'Email y contraseña son requeridos' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ mensaje: 'Correo no encontrado' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
    }

    const token = generateToken(user);
    return res.json({ token, usuario: formatUser(user) });
  } catch (error) {
    console.error('❌ Error login:', error.message, error.stack);
    if (isConnectionError(error)) {
      return res.status(503).json({ mensaje: 'Error de conexión con la base de datos. Intenta de nuevo.' });
    }
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ============================================================
// POST /api/auth/google-login
// ============================================================
router.post('/google-login', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ mensaje: 'Token de Google requerido' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { sub, email, name, picture } = ticket.getPayload();

    let user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      user = await User.create({ nombre: name || email.split('@')[0], email, picture, googleId: sub });
    } else if (!user.googleId) {
      user.googleId = sub;
      if (!user.picture && picture) user.picture = picture;
      await user.save();
    }

    const jwtToken = generateToken(user);
    return res.json({ token: jwtToken, usuario: formatUser(user) });
  } catch (error) {
    console.error('❌ Error google-login:', error.message, error.stack);
    if (isConnectionError(error)) {
      return res.status(503).json({ mensaje: 'Error de conexión con la base de datos. Intenta de nuevo.' });
    }
    return res.status(401).json({ mensaje: 'Token de Google inválido o expirado' });
  }
});

// ============================================================
// POST /api/auth/facebook-login
// ============================================================
router.post('/facebook-login', async (req, res) => {
  try {
    const { accessToken, userID } = req.body;
    if (!accessToken || !userID) {
      return res.status(400).json({ mensaje: 'accessToken y userID son requeridos' });
    }

    const graphRes = await axios.get(`https://graph.facebook.com/v18.0/${userID}`, {
      params: { access_token: accessToken, fields: 'id,email,name,picture' },
    });

    const fb = graphRes.data;
    if (!fb.email) {
      return res.status(400).json({ mensaje: 'El correo no está disponible en tu cuenta de Facebook' });
    }

    let user = await User.findOne({ where: { email: fb.email.toLowerCase() } });
    if (!user) {
      user = await User.create({
        nombre: fb.name || fb.email.split('@')[0],
        email: fb.email,
        picture: fb.picture?.data?.url || null,
        facebookId: fb.id,
      });
    } else if (!user.facebookId) {
      user.facebookId = fb.id;
      await user.save();
    }

    const jwtToken = generateToken(user);
    return res.json({ token: jwtToken, usuario: formatUser(user) });
  } catch (error) {
    console.error('❌ Error facebook-login:', error.message);
    return res.status(401).json({ mensaje: 'Error al validar token de Facebook' });
  }
});

// ============================================================
// GET /api/auth/me — Obtener datos actuales del usuario
// ============================================================
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    return res.json({ usuario: formatUser(user) });
  } catch (error) {
    console.error('❌ Error get me:', error.message);
    return res.status(500).json({ mensaje: 'Error al obtener perfil' });
  }
});

// ============================================================
// PUT /api/auth/profile — Actualizar perfil del usuario
// ============================================================
router.put('/profile', auth, async (req, res) => {
  try {
    const { nombre, telefono, ubicacion, picture } = req.body;
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    if (nombre !== undefined) user.nombre = nombre;
    if (telefono !== undefined) user.telefono = telefono;
    if (ubicacion !== undefined) user.ubicacion = ubicacion;
    if (picture !== undefined) user.picture = picture || null;

    await user.save();
    return res.json({ usuario: formatUser(user) });
  } catch (error) {
    console.error('❌ Error update profile:', error.message);

    // If column doesn't exist, retry saving only core fields
    if (error.message && (error.message.includes('telefono') || error.message.includes('ubicacion'))) {
      try {
        const user = await User.findByPk(req.userId);
        if (!user) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        const { nombre, picture } = req.body;
        if (nombre !== undefined) user.nombre = nombre;
        if (picture !== undefined) user.picture = picture || null;
        await user.save();
        return res.json({ usuario: formatUser(user) });
      } catch (fallbackError) {
        console.error('❌ Error fallback profile:', fallbackError.message);
        return res.status(500).json({ mensaje: 'Error al actualizar perfil' });
      }
    }

    return res.status(500).json({ mensaje: 'Error al actualizar perfil' });
  }
});

// ============================================================
// PUT /api/auth/password — Cambiar contraseña
// ============================================================
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ mensaje: 'Contraseña actual y nueva son requeridas' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ mensaje: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    if (!user.password) {
      return res.status(400).json({ mensaje: 'Tu cuenta usa autenticación social. No puedes cambiar contraseña.' });
    }

    const valid = await user.comparePassword(currentPassword);
    if (!valid) {
      return res.status(401).json({ mensaje: 'Contraseña actual incorrecta' });
    }

    user.password = newPassword;
    await user.save();
    return res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('❌ Error change password:', error.message);
    return res.status(500).json({ mensaje: 'Error al cambiar contraseña' });
  }
});

module.exports = router;