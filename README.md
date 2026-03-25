# backend-monitoreo

API de monitoreo de refrigeradores con Express.js y PostgreSQL, desplegada en Railway.

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registrar usuario |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/devices` | Listar dispositivos (JWT) |
| POST | `/api/devices` | Crear dispositivo (JWT) |
| **POST** | **`/api/ingest`** | **Recibir lectura del ESP32** |
| GET | `/api/ingest/:device_code` | Consultar lecturas |

## Conexión del ESP32

El endpoint `POST /api/ingest` recibe lecturas de temperatura y humedad desde el ESP32. No requiere JWT — se autentica por el código del dispositivo.

### Cuerpo del POST

```json
{
  "device_code": "FRIDGE-E31B",
  "temperatura": 5.2,
  "humedad": 60.5
}
```

También se acepta `device_id` en lugar de `device_code` para compatibilidad con sketches existentes.

### Ejemplo en Arduino (ESP32)

```cpp
HTTPClient http;
http.begin("https://backend-monitoreo-production.up.railway.app/api/ingest");
http.addHeader("Content-Type", "application/json");

String json = "{\"device_code\":\"FRIDGE-E31B\",\"temperatura\":5.2,\"humedad\":60.5}";
int httpCode = http.POST(json);

Serial.println(httpCode);   // 201 = lectura registrada
http.end();
```

Consulta [`esp32/monitor.ino`](esp32/monitor.ino) para un sketch completo con lectura de sensor DHT y reconexión WiFi.

### Errores comunes del ESP32

| Problema | Causa | Solución |
|----------|-------|----------|
| HTTP -1 | URL incorrecta | Usar `https://…/api/ingest` (no la raíz `/`) |
| HTTP 400 | Campos faltantes | Enviar `device_code` y `temperatura` |
| HTTP 404 | Dispositivo no existe | Crear el dispositivo primero desde la app |

## Ejecución local

```bash
npm install
npm run dev     # con nodemon
npm start       # producción
```

Variables de entorno requeridas: ver `.env` (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET).