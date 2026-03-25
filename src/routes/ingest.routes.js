const express = require('express');
const Device = require('../models/device.model');
const Reading = require('../models/reading.model');

const router = express.Router();

/**
 * ============================================================
 * POST /api/ingest/:deviceCode
 * ============================================================
 *
 * Endpoint público para que el ESP32 envíe lecturas vía HTTP
 * como alternativa al canal MQTT.
 *
 * El ESP32 se identifica con su device_code (ej: "FRIDGE-A1B2").
 * No requiere JWT — la autenticación se basa en el código único
 * del dispositivo registrado en la base de datos.
 *
 * Body JSON esperado (mismo formato que el payload MQTT):
 *   {
 *     "temperatura": 5.2,
 *     "humedad": 65.0,
 *     "compresor": true,
 *     "energia": "Normal"
 *   }
 */
router.post('/:deviceCode', async (req, res) => {
  try {
    const { deviceCode } = req.params;
    const { temperatura, humedad, compresor, energia } = req.body;

    if (temperatura === undefined || temperatura === null) {
      return res.status(400).json({ mensaje: 'Campo "temperatura" es requerido' });
    }

    // Buscar dispositivo por device_code o por external device_id
    const device = await Device.findOne({
      where: { deviceId: deviceCode },
    });

    if (!device) {
      return res.status(404).json({ mensaje: 'Dispositivo no registrado' });
    }

    // Guardar la lectura en PostgreSQL
    const reading = await Reading.create({
      deviceId: device.id,
      temperatura,
      humedad: humedad ?? null,
      compresor: compresor ?? true,
      energia: energia || 'Normal',
    });

    // Actualizar estado del dispositivo
    device.status = energia === 'Falla' ? 'alerta' : 'activo';
    await device.save();

    console.log(`📡 [HTTP] [${deviceCode}] Temperatura: ${temperatura}°C | Energía: ${energia || 'Normal'}`);
    return res.status(201).json({ mensaje: 'Lectura registrada', reading });
  } catch (error) {
    console.error('❌ Error en ingesta HTTP:', error.message);
    return res.status(500).json({ mensaje: 'Error al guardar lectura' });
  }
});

module.exports = router;
