-- Tabla para almacenar los dispositivos (refrigeradores) del usuario
-- Ejecuta esto ANTES de crear_tabla_readings.sql, ya que readings referencia devices.
-- Usa: psql -U postgres -d monitoreo_db -f crear_tabla_devices.sql

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

CREATE INDEX IF NOT EXISTS idx_devices_user_id     ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_code ON devices(device_code);
CREATE INDEX IF NOT EXISTS idx_devices_device_id   ON devices(device_id);
