const { Pool } = require('pg');

const isSSL = process.env.DB_SSL === "true";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isSSL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,   // 5 s máx para obtener una conexión
  statement_timeout: 30000,        // 30 s máx por consulta
  idle_in_transaction_session_timeout: 30000,
  keepAlive: true,
});

module.exports = pool;

// Test de conexión
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error de conexión:', err.message);
  } else {
    console.log('✅ Conectado a PostgreSQL:', res.rows);
  }
});