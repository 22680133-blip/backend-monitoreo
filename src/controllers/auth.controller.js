const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * Registro de usuario
 */
exports.register = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ mensaje: "Email y contraseña requeridos" });
    }

    // Verificar si el usuario ya existe
    const existingUser = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ mensaje: "El email ya está registrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (nombre, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, email`,
      [nombre || email.split('@')[0], email, hashedPassword]
    );

    res.status(201).json({
      mensaje: "Usuario creado correctamente",
      usuario: result.rows[0]
    });

  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Login simple - NO registra automáticamente
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ mensaje: "Email y contraseña requeridos" });
    }

    console.log(`🔍 Buscando usuario: ${email}`);

    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      console.log(`❌ Usuario no encontrado: ${email}`);
      return res.status(400).json({ mensaje: "Usuario no encontrado. Debes registrarte primero" });
    }

    const user = result.rows[0];

    // Si el usuario se registró con Google, no tiene contraseña
    if (user.google_id || !user.password_hash) {
      return res.status(400).json({ mensaje: 'Este usuario se registró con Google. Por favor, usa el login de Google.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      console.log(`❌ Contraseña incorrecta para: ${email}`);
      return res.status(400).json({ mensaje: "Contraseña incorrecta" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log(`✅ Login exitoso: ${email}`);

    res.json({
      mensaje: "Login exitoso",
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email
      }
    });

  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Login o Registro automático
 * Si el usuario no existe, lo crea. Si existe, lo autentica.
 */
exports.loginOrRegister = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ mensaje: "Email y contraseña requeridos" });
    }

    // Buscar usuario existente
    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    let user = result.rows[0];

    // Si no existe, crear nuevo usuario
    if (!user) {
      console.log(`Creando nuevo usuario: ${email}`);
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const createResult = await pool.query(
        `INSERT INTO users (nombre, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, nombre, email`,
        [email.split('@')[0], email, hashedPassword]
      );

      user = createResult.rows[0];
      console.log(`Usuario creado: ${email}`);
    } else {
      
      // Si existe, verificar contraseña
      console.log(`Usuario encontrado: ${email}`);
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        return res.status(400).json({ mensaje: "Contraseña incorrecta" });
      }
    }

    // Generar JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log(`🎉 Autenticación exitosa: ${email}`);

    res.json({
      mensaje: "Autenticación exitosa",
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email
      }
    });

  } catch (error) {
    console.error("Error en loginOrRegister:", error);
    res.status(500).json({ error: error.message });
  }
};

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Login con Google OAuth
 * El token viene del cliente y se valida en el backend
 */



exports.googleLogin = async (req, res) => {
  console.log('🔵 Petición a /google-login recibida');
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ mensaje: "Token requerido" });
    }

    // VERIFICAR el token de Google
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    console.log(`🔵 Token de Google verificado:`, payload);

    const { email, name: nombre, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({ mensaje: "Email no encontrado en token de Google" });
    }

    // Buscar usuario existente por email o googleId
    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1 OR google_id = $2`,
      [email, googleId]
    );

    let user = result.rows[0];

    // Si no existe, crear nuevo usuario
    if (!user) {
      console.log(`📝 Creando nuevo usuario desde Google: ${email}`);
      
      const createResult = await pool.query(
        `INSERT INTO users (nombre, email, google_id, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, nombre, email`,
        [nombre || email.split('@')[0], email, googleId, null] // password_hash es null para logins sociales
      );

      user = createResult.rows[0];
      console.log(`✅ Usuario creado desde Google: ${email}`);
    } else {
      // Si el usuario existe pero no tiene google_id, actualizarlo
      if (!user.google_id) {
        console.log(`🔗 Vinculando Google ID al usuario existente: ${email}`);
        await pool.query(
          `UPDATE users SET google_id = $1 WHERE id = $2`,
          [googleId, user.id]
        );
      }
      console.log(`🔍 Usuario encontrado: ${email}`);
    }

    // Generar JWT para la app
    const appToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log(`✅ Login Google exitoso: ${email}`);

    res.json({
      mensaje: "Login Google exitoso",
      token: appToken,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email
      }
    });

  } catch (error) {
    console.error("Error en Google Login:", error);
    // Si el error es por token inválido
    if (error.message.includes('Invalid token signature')) {
      return res.status(401).json({ mensaje: 'Token de Google inválido o expirado' });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getDevices = async (req,res)=>{

 const userId = req.user.id;

 const result = await pool.query(
   `SELECT * FROM devices WHERE user_id=$1`,
   [userId]
 );

 res.json({
   devices: result.rows
 });

}