/**
 * Inicialización de la base de datos.
 * Crea las tablas necesarias si no existen (users → devices → temperatures → alerts).
 * Se ejecuta una sola vez al arrancar el servidor.
 */
const pool = require('./db');

async function initDB() {
  try {
    // 1. Tabla users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        nombre        VARCHAR(100),
        email         VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        google_id     VARCHAR(255) UNIQUE,
        facebook_id   VARCHAR(255) UNIQUE,
        picture       VARCHAR,
        telefono      VARCHAR DEFAULT NULL,
        ubicacion     VARCHAR DEFAULT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Tabla devices (depende de users)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nombre        VARCHAR(100) DEFAULT 'Mi Refrigerador',
        ubicacion     VARCHAR(255) DEFAULT '',
        limite_min    FLOAT DEFAULT 2,
        limite_max    FLOAT DEFAULT 8,
        device_code   VARCHAR(20) UNIQUE NOT NULL,
        device_id     VARCHAR(255),
        status        VARCHAR(20) DEFAULT 'desconectado',
        created_at    TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3. Tabla temperatures (depende de devices)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS temperatures (
        id            SERIAL PRIMARY KEY,
        device_id     INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        temperatura   FLOAT NOT NULL,
        humedad       FLOAT,
        fecha         TIMESTAMP DEFAULT NOW()
      );
    `);

    // 4. Tabla alerts (depende de devices)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id            SERIAL PRIMARY KEY,
        device_id     INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        tipo          VARCHAR(50),
        mensaje       TEXT,
        fecha         TIMESTAMP DEFAULT NOW(),
        leida         BOOLEAN DEFAULT false
      );
    `);

    // Índices útiles (IF NOT EXISTS evita errores si ya existen)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email            ON users(email);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_devices_user_id        ON devices(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_devices_device_code    ON devices(device_code);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_devices_device_id      ON devices(device_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_temperatures_device_id ON temperatures(device_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_temperatures_fecha     ON temperatures(fecha DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_alerts_device_tipo_fecha ON alerts(device_id, tipo, fecha DESC);`);

    // Agregar columnas que puedan faltar en tablas ya existentes
    const addColumnStatements = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS telefono VARCHAR DEFAULT NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS ubicacion VARCHAR DEFAULT NULL`,
      `ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_id VARCHAR(255)`,
    ];

    for (const stmt of addColumnStatements) {
      try {
        await pool.query(stmt);
      } catch (err) {
        // Ignorar solo errores de "columna ya existe" (código 42701)
        if (err.code !== '42701') {
          console.warn('⚠️ Error al agregar columna:', err.message);
        }
      }
    }

    console.log('✅ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error.message);
  }
}

module.exports = initDB;
