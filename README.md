# backend-monitoreo

Backend API para **App-Fixel** — Sistema de monitoreo de temperatura para refrigeradores.

## Tecnologías

- **Node.js** + **Express 4.x**
- **PostgreSQL** con **Sequelize ORM**
- **JWT** para autenticación
- **Google OAuth** y **Facebook OAuth**
- **MQTT/TLS** para integración con sensor ESP32
- **Railway** para despliegue en la nube

## Instalación

```bash
npm install
cp .env.example .env
# Edita .env con tus credenciales
npm run dev
```

## Variables de Entorno

Ver `.env.example` para la lista completa de variables requeridas.

## Endpoints API

### Autenticación (`/api/auth`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/register` | No | Registrar nuevo usuario |
| POST | `/login` | No | Iniciar sesión |
| POST | `/google-login` | No | Login con Google OAuth |
| POST | `/facebook-login` | No | Login con Facebook OAuth |
| GET | `/me` | Sí | Obtener perfil actual |
| PUT | `/profile` | Sí | Actualizar perfil |
| PUT | `/password` | Sí | Cambiar contraseña |

### Dispositivos (`/api/devices`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/` | Sí | Listar dispositivos |
| GET | `/:id` | Sí | Obtener dispositivo |
| POST | `/` | Sí | Crear dispositivo |
| PUT | `/:id` | Sí | Actualizar dispositivo |
| DELETE | `/:id` | Sí | Eliminar dispositivo |

### Lecturas (`/api/readings`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/latest/:deviceId` | Sí | Última lectura |
| GET | `/history/:deviceId` | Sí | Historial 24h |
| POST | `/:deviceId` | Sí | Guardar lectura manual |

### Ingesta ESP32 (`/api/ingest`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/:deviceCode` | No* | Recibir lectura del ESP32 |

\* Autenticación basada en el código único del dispositivo.

## MQTT

El backend se suscribe al tópico `fixel/+/data` para recibir lecturas del sensor ESP32 en tiempo real. Configura `MQTT_BROKER_URL` en `.env` para activar.

## Despliegue en Railway

1. Conecta tu repositorio a Railway
2. Configura las variables de entorno en el dashboard
3. Railway despliega automáticamente con cada push