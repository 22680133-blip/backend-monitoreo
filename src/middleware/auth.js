const jwt = require('jsonwebtoken');

/**
 * Middleware de autenticación JWT
 * Verifica el token y agrega req.user
 */
module.exports = (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ mensaje: 'Token requerido' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (error) {
    console.error('Error en autenticación:', error.message);
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
};
