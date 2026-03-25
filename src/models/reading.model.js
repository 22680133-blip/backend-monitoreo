const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * Lectura de temperatura enviada por el sensor ESP32 vía MQTT/TLS.
 *
 * El ESP32 publicará un mensaje JSON al tópico:
 *   fixel/{mqttClientId}/data
 *
 * Formato del mensaje:
 *   {
 *     "temperatura": 3.5,
 *     "humedad": 65,
 *     "compresor": true,
 *     "energia": "Normal"
 *   }
 *
 * El servidor MQTT recibe el mensaje y lo guarda aquí.
 */
const Reading = sequelize.define(
  'Reading',
  {
    deviceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'devices', key: 'id' },
    },

    // ============================================================
    // Datos del sensor ESP32
    // ============================================================

    // Temperatura en grados Celsius (sensor DS18B20 o similar)
    temperatura: { type: DataTypes.FLOAT, allowNull: false },

    // Humedad relativa % (sensor DHT22, opcional)
    humedad: { type: DataTypes.FLOAT, defaultValue: null },

    // Estado del compresor (true = funcionando)
    compresor: { type: DataTypes.BOOLEAN, defaultValue: true },

    // Estado del suministro eléctrico
    energia: {
      type: DataTypes.ENUM('Normal', 'Falla'),
      defaultValue: 'Normal',
    },

    // Marca de tiempo de la lectura (enviada por el ESP32 o asignada al recibirla)
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: 'readings',
    timestamps: false,
    underscored: true,
    indexes: [
      // Índice para consultas rápidas por dispositivo y tiempo
      { fields: ['device_id', 'timestamp'] },
    ],
  }
);

module.exports = Reading;
