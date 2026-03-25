/**
 * Middleware de autenticación JWT
 * Valida el token Bearer y agrega req.userId, req.userEmail y req.user
 *
 * Compatible con los tokens generados por auth.controller.js:
 *   jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '8h' })
 *
 * Soporta ambos formatos para compatibilidad:
 *   - req.userId / req.userEmail  (backend-railway controllers)
 *   - req.user.id / req.user.email (backend-monitoreo controllers existentes)
 */
const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ mensaje: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.userEmail = decoded.email;
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
};

module.exports = auth;
