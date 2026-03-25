require('dotenv').config();
const app = require('./src/app');
const initDB = require('./src/config/initDB');

const PORT = process.env.PORT || 3000;

// Inicializar tablas y luego arrancar el servidor
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
  });
});

