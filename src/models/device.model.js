const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Device = sequelize.define(
  'Device',
  {
    // Dueño del dispositivo
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },

    // Código legible del dispositivo (ej: "FRIDGE-A1B2"), generado por el backend.
    // Se almacena en la columna 'device_code' de la tabla devices.
    deviceId: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      field: 'device_code',
    },

    // Nombre descriptivo (el usuario puede editarlo en Configuración)
    nombre: {
      type: DataTypes.STRING,
      defaultValue: 'Mi Refrigerador',
      set(value) {
        this.setDataValue('nombre', value ? value.trim() : 'Mi Refrigerador');
      },
    },

    // Ubicación física del dispositivo (ej: "Cocina", "Almacén")
    ubicacion: {
      type: DataTypes.STRING,
      defaultValue: '',
    },

    // Límites de temperatura configurados por el usuario
    limiteMin: { type: DataTypes.FLOAT, defaultValue: 2 },
    limiteMax: { type: DataTypes.FLOAT, defaultValue: 8 },

    // Estado actual del dispositivo
    status: {
      type: DataTypes.STRING,
      defaultValue: 'desconectado',
    },

    // Identificador externo del dispositivo (columna device_id)
    externalDeviceId: {
      type: DataTypes.STRING,
      field: 'device_id',
      defaultValue: null,
    },
  },
  { tableName: 'devices', timestamps: true, underscored: true, updatedAt: false }
);

module.exports = Device;
