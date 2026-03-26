-- Tabla para almacenar lecturas enviadas por el ESP32
CREATE TABLE IF NOT EXISTS temperatures (
  id            SERIAL PRIMARY KEY,
  device_id     INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  temperatura   FLOAT   NOT NULL,
  humedad       FLOAT,
  fecha         TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temperatures_device_id ON temperatures(device_id);
CREATE INDEX IF NOT EXISTS idx_temperatures_fecha     ON temperatures(fecha DESC);
