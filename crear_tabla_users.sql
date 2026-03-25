-- ============================================================
-- Schema para App-Fixel Backend
-- Sequelize sincroniza las tablas automáticamente,
-- pero este archivo sirve como referencia y para migraciones manuales.
-- ============================================================

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  facebook_id VARCHAR(255) UNIQUE,
  picture TEXT,
  telefono VARCHAR DEFAULT NULL,
  ubicacion VARCHAR DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Tabla de dispositivos
CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_code VARCHAR UNIQUE NOT NULL,
  nombre VARCHAR DEFAULT 'Mi Refrigerador',
  ubicacion VARCHAR DEFAULT '',
  limite_min FLOAT DEFAULT 2,
  limite_max FLOAT DEFAULT 8,
  status VARCHAR DEFAULT 'desconectado',
  device_id VARCHAR DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de lecturas de temperatura
CREATE TABLE IF NOT EXISTS readings (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  temperatura FLOAT NOT NULL,
  humedad FLOAT,
  compresor BOOLEAN DEFAULT TRUE,
  energia VARCHAR DEFAULT 'Normal',
  "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_readings_device_timestamp ON readings(device_id, "timestamp");

-- Migraciones para bases de datos existentes de backend-monitoreo
ALTER TABLE users ADD COLUMN IF NOT EXISTS telefono VARCHAR DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ubicacion VARCHAR DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_id VARCHAR UNIQUE;
