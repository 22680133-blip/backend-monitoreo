-- Ejecuta esto en PostgreSQL para crear la tabla users
-- Usa: psql -U postgres -d monitoreo_db -f crear_tabla_users.sql

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  facebook_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índice en email para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Ver la tabla
SELECT * FROM users;
