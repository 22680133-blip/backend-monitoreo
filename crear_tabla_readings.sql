-- Tabla para almacenar lecturas enviadas por el ESP32
CREATE TABLE IF NOT EXISTS readings (
  id            SERIAL PRIMARY KEY,
  device_id     INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  temperatura   FLOAT   NOT NULL,
  humedad       FLOAT,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_readings_device_id   ON readings(device_id);
CREATE INDEX IF NOT EXISTS idx_readings_created_at  ON readings(created_at DESC);
