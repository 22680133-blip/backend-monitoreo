require('dotenv').config();
const app = require('./src/app');
const initDB = require('./src/config/initDB');

const PORT = process.env.PORT || 3000;

// Inicializar tablas y luego arrancar el servidor
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor iniciado correctamente en puerto ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ Error al inicializar DB, iniciando servidor de todas formas:', error.message);
    app.listen(PORT, () => {
      console.log(`Servidor iniciado en puerto ${PORT} (DB init falló, modo degradado)`);
    });
  });

