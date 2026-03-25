/**
 * ============================================================
 * MQTT/TLS Client — Integración con sensor ESP32
 * ============================================================
 *
 * Este módulo maneja la conexión con el broker MQTT/TLS para
 * recibir datos de temperatura del sensor ESP32.
 *
 * Flujo de datos:
 *   ESP32 → MQTT Broker (TLS) → Este servidor → PostgreSQL
 *
 * Tópico que publica el ESP32:
 *   fixel/{mqttClientId}/data
 *
 * Formato del mensaje JSON:
 *   {
 *     "temperatura": 3.5,
 *     "humedad": 65,
 *     "compresor": true,
 *     "energia": "Normal"
 *   }
 *
 * ============================================================
 * PASOS PARA ACTIVAR (cuando el ESP32 esté listo):
 *
 * 1. Configura MQTT_BROKER_URL en tu archivo .env
 * 2. (Opcional) Si usas TLS, guarda certificados en certs/
 *    y configura MQTT_CA_CERT_PATH, MQTT_CLIENT_CERT_PATH,
 *    MQTT_CLIENT_KEY_PATH en .env
 * 3. En el firmware del ESP32, usa el mismo DEVICE_ID que
 *    tengas registrado en la base de datos del dispositivo.
 * ============================================================
 */

const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const Device = require('../models/device.model');
const Reading = require('../models/reading.model');

// ============================================================
// Variables de configuración MQTT/TLS
// Todas se leen desde el archivo .env
// ============================================================
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL;       // ej: mqtts://tu-broker.com
const MQTT_PORT = parseInt(process.env.MQTT_PORT || '8883');
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_CA_CERT_PATH = process.env.MQTT_CA_CERT_PATH;
const MQTT_CLIENT_CERT_PATH = process.env.MQTT_CLIENT_CERT_PATH;
const MQTT_CLIENT_KEY_PATH = process.env.MQTT_CLIENT_KEY_PATH;
const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || 'fixel';

// Tópico al que se suscribe el servidor (wildcard para todos los dispositivos)
const SUBSCRIBE_TOPIC = `${MQTT_TOPIC_PREFIX}/+/data`;

let client = null;

/**
 * Procesa un mensaje MQTT recibido del ESP32.
 * Busca el dispositivo por externalDeviceId y guarda la lectura.
 */
const handleMessage = async (topic, message) => {
  try {
    // Extraer el identificador del tópico: fixel/{deviceIdentifier}/data
    const parts = topic.split('/');
    if (parts.length !== 3) return;
    const deviceIdentifier = parts[1];

    const payload = JSON.parse(message.toString());
    const { temperatura, humedad, compresor, energia } = payload;

    if (temperatura === undefined) {
      console.warn(`⚠️ Mensaje sin temperatura del dispositivo: ${deviceIdentifier}`);
      return;
    }

    // Buscar el dispositivo por su externalDeviceId (columna device_id)
    const device = await Device.findOne({ where: { externalDeviceId: deviceIdentifier } });
    if (!device) {
      console.warn(`⚠️ Dispositivo no registrado: ${deviceIdentifier}`);
      return;
    }

    // Guardar la lectura en PostgreSQL
    await Reading.create({
      deviceId: device.id,
      temperatura,
      humedad: humedad ?? null,
      compresor: compresor ?? true,
      energia: energia || 'Normal',
    });

    // Actualizar estado del dispositivo
    device.status = energia === 'Falla' ? 'alerta' : 'activo';
    await device.save();

    console.log(`📡 [${deviceIdentifier}] Temperatura: ${temperatura}°C | Energía: ${energia}`);
  } catch (err) {
    console.error('❌ Error procesando mensaje MQTT:', err.message);
  }
};

/**
 * Conecta al broker MQTT/TLS.
 * Llama a esta función desde server.js después de iniciar el servidor.
 */
const connect = () => {
  if (!MQTT_BROKER_URL) {
    console.log('⚠️  MQTT no configurado — omitiendo conexión (configura MQTT_BROKER_URL en .env)');
    return;
  }

  // Opciones de conexión con TLS mutuo (mTLS)
  const options = {
    port: MQTT_PORT,
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  };

  // Cargar certificados TLS si están configurados
  if (MQTT_CA_CERT_PATH || MQTT_CLIENT_CERT_PATH || MQTT_CLIENT_KEY_PATH) {
    try {
      if (MQTT_CA_CERT_PATH) options.ca = fs.readFileSync(path.resolve(MQTT_CA_CERT_PATH));
      if (MQTT_CLIENT_CERT_PATH) options.cert = fs.readFileSync(path.resolve(MQTT_CLIENT_CERT_PATH));
      if (MQTT_CLIENT_KEY_PATH) options.key = fs.readFileSync(path.resolve(MQTT_CLIENT_KEY_PATH));
      if (options.ca) options.rejectUnauthorized = true;
      console.log('🔐 Certificados TLS cargados para MQTT');
    } catch (certErr) {
      console.warn('⚠️  No se pudieron cargar certificados TLS:', certErr.message);
      console.warn('   Conectando sin mTLS (solo usuario/contraseña)');
    }
  }

  client = mqtt.connect(MQTT_BROKER_URL, options);

  client.on('connect', () => {
    console.log(`✅ MQTT conectado a ${MQTT_BROKER_URL}`);
    client.subscribe(SUBSCRIBE_TOPIC, (err) => {
      if (err) console.error('❌ Error suscribiendo a tópico MQTT:', err.message);
      else console.log(`📡 Suscrito al tópico: ${SUBSCRIBE_TOPIC}`);
    });
  });

  client.on('message', handleMessage);

  client.on('error', (err) => {
    console.error('❌ Error MQTT:', err.message);
  });

  client.on('reconnect', () => {
    console.log('🔄 Reconectando al broker MQTT...');
  });
};

module.exports = { connect };
