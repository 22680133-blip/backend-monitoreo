/**
 * Controlador del asistente IA — endpoint POST /api/assistant
 *
 * Chatbot basado en reglas que interpreta la pregunta del usuario,
 * consulta la base de datos y responde dinámicamente con datos reales
 * del sistema de monitoreo.
 *
 * ✅ No usa APIs externas (sin OpenAI, sin Gemini).
 * ✅ Completamente gratuito — funciona con lógica local + PostgreSQL.
 * ✅ SIEMPRE filtra por req.user.id — solo datos del usuario autenticado.
 */

const pool = require('../config/db');

// ── Patrones de reconocimiento ───────────────────────────────
// Cada regla: { test: función(pregunta) → bool, handler: async (userId, pregunta) → string }
const rules = [

  // ── Fallas / problemas ──────────────────────────────────────
  {
    test: (q) => /falla|fallo|problema|error|anomalia|fuera de rango/.test(q),
    handler: async (userId) => {
      const devices = await getUserDevices(userId);
      if (devices.length === 0) return 'No tienes dispositivos registrados.';

      const deviceIds = devices.map((d) => d.id);
      const { rows: temps } = await pool.query(
        `SELECT DISTINCT ON (t.device_id) t.temperatura, t.fecha, d.nombre, d.id AS device_id
         FROM temperatures t
         JOIN devices d ON d.id = t.device_id
         WHERE t.device_id = ANY($1)
         ORDER BY t.device_id, t.fecha DESC`,
        [deviceIds]
      );

      const fallas = [];
      for (const device of devices) {
        const lectura = temps.find((t) => t.device_id === device.id);
        if (!lectura) continue;
        if (lectura.temperatura > device.limite_max) {
          fallas.push(`⚠️ ${device.nombre}: temperatura ALTA (${lectura.temperatura}°C, límite máx: ${device.limite_max}°C)`);
        } else if (lectura.temperatura < device.limite_min) {
          fallas.push(`⚠️ ${device.nombre}: temperatura BAJA (${lectura.temperatura}°C, límite mín: ${device.limite_min}°C)`);
        }
      }

      if (fallas.length === 0) {
        return '✅ No se detectaron fallas. Todos tus dispositivos están dentro de los parámetros normales.';
      }
      return `Se detectaron ${fallas.length} falla(s):\n${fallas.join('\n')}`;
    },
  },

  // ── Temperatura ─────────────────────────────────────────────
  {
    test: (q) => /temperatura/.test(q),
    handler: async (userId) => {
      const devices = await getUserDevices(userId);
      if (devices.length === 0) return 'No tienes dispositivos registrados.';

      const deviceIds = devices.map((d) => d.id);
      const { rows } = await pool.query(
        `SELECT DISTINCT ON (t.device_id) t.temperatura, t.fecha, d.nombre, d.device_code,
                d.limite_min, d.limite_max
         FROM temperatures t
         JOIN devices d ON d.id = t.device_id
         WHERE t.device_id = ANY($1)
         ORDER BY t.device_id, t.fecha DESC`,
        [deviceIds]
      );
      if (rows.length === 0) {
        return 'No hay lecturas de temperatura registradas aún en tus dispositivos.';
      }

      const lineas = rows.map((r) => {
        const cuando = formatFecha(r.fecha);
        let estado = '✅';
        if (r.temperatura > r.limite_max) estado = '⚠️ ALTA';
        else if (r.temperatura < r.limite_min) estado = '⚠️ BAJA';
        return `• ${r.nombre} (${r.device_code}): ${r.temperatura}°C ${estado} — ${cuando}`;
      });
      return `Temperaturas de tus dispositivos:\n${lineas.join('\n')}`;
    },
  },

  // ── Humedad ─────────────────────────────────────────────────
  {
    test: (q) => /humedad/.test(q),
    handler: async (userId) => {
      const devices = await getUserDevices(userId);
      if (devices.length === 0) return 'No tienes dispositivos registrados.';

      const deviceIds = devices.map((d) => d.id);
      const { rows } = await pool.query(
        `SELECT DISTINCT ON (t.device_id) t.humedad, t.fecha, d.nombre, d.device_code
         FROM temperatures t
         JOIN devices d ON d.id = t.device_id
         WHERE t.device_id = ANY($1)
         ORDER BY t.device_id, t.fecha DESC`,
        [deviceIds]
      );
      if (rows.length === 0) {
        return 'No hay lecturas de humedad registradas aún en tus dispositivos.';
      }

      const conHumedad = rows.filter((r) => r.humedad != null);
      if (conHumedad.length === 0) {
        return 'Tus dispositivos no tienen lecturas de humedad disponibles.';
      }

      const lineas = conHumedad.map((r) => {
        const cuando = formatFecha(r.fecha);
        return `• ${r.nombre} (${r.device_code}): ${r.humedad}% — ${cuando}`;
      });
      return `Humedad de tus dispositivos:\n${lineas.join('\n')}`;
    },
  },

  // ── Alertas ─────────────────────────────────────────────────
  {
    test: (q) => /alerta|alarma|warning|aviso/.test(q),
    handler: async (userId) => {
      const { rows } = await pool.query(
        `SELECT a.tipo, a.mensaje, a.fecha, a.leida, d.nombre, d.device_code
         FROM alerts a
         JOIN devices d ON d.id = a.device_id
         WHERE d.user_id = $1
         ORDER BY a.fecha DESC LIMIT 5`,
        [userId]
      );
      if (rows.length === 0) {
        return 'No tienes alertas registradas. ¡Todo está en orden! ✅';
      }
      const noLeidas = rows.filter((r) => !r.leida).length;
      const ultima = rows[0];
      const cuando = formatFecha(ultima.fecha);
      let respuesta = `Tienes ${rows.length} alerta(s) reciente(s)`;
      if (noLeidas > 0) {
        respuesta += ` (${noLeidas} sin leer)`;
      }
      respuesta += `. La más reciente: "${ultima.mensaje}" (${ultima.tipo}) del dispositivo "${ultima.nombre}" — ${cuando}.`;
      return respuesta;
    },
  },

  // ── Dispositivos ────────────────────────────────────────────
  {
    test: (q) => /dispositivo|equipo|refrigerador|sensor|cuanto/.test(q),
    handler: async (userId) => {
      const devices = await getUserDevices(userId);
      if (devices.length === 0) {
        return 'No tienes dispositivos registrados.';
      }
      const lineas = devices.map(
        (d) => `• ${d.nombre} (${d.device_code}) — ${d.status}${d.ubicacion ? ', ubicación: ' + d.ubicacion : ''}`
      );
      return `Tienes ${devices.length} dispositivo(s) registrado(s):\n${lineas.join('\n')}`;
    },
  },

  // ── Estado del sistema ──────────────────────────────────────
  {
    test: (q) => /estado|sistema|funciona|status/.test(q),
    handler: async (userId) => {
      const devices = await getUserDevices(userId);
      const deviceIds = devices.map((d) => d.id);

      const dbCheck = await pool.query('SELECT NOW() AS now');
      const lecturas1h = deviceIds.length > 0
        ? (await pool.query(
            `SELECT COUNT(*) AS total FROM temperatures
             WHERE device_id = ANY($1) AND fecha > NOW() - INTERVAL '1 hour'`,
            [deviceIds]
          )).rows[0].total
        : 0;
      const alertasPendientes = deviceIds.length > 0
        ? (await pool.query(
            `SELECT COUNT(*) AS total FROM alerts
             WHERE device_id = ANY($1) AND leida = false`,
            [deviceIds]
          )).rows[0].total
        : 0;

      // Detección de fallas
      let estadoGeneral = '✅ Todos tus dispositivos están dentro de los parámetros normales.';
      if (deviceIds.length > 0) {
        const { rows: temps } = await pool.query(
          `SELECT DISTINCT ON (t.device_id) t.temperatura, d.nombre, d.limite_min, d.limite_max
           FROM temperatures t
           JOIN devices d ON d.id = t.device_id
           WHERE t.device_id = ANY($1)
           ORDER BY t.device_id, t.fecha DESC`,
          [deviceIds]
        );
        const fallas = [];
        for (const t of temps) {
          if (t.temperatura > t.limite_max) {
            fallas.push(`⚠️ ${t.nombre}: ${t.temperatura}°C (máx: ${t.limite_max}°C)`);
          } else if (t.temperatura < t.limite_min) {
            fallas.push(`⚠️ ${t.nombre}: ${t.temperatura}°C (mín: ${t.limite_min}°C)`);
          }
        }
        if (fallas.length > 0) {
          estadoGeneral = `⚠️ Se detectaron fallas:\n${fallas.join('\n')}`;
        }
      }

      return `Estado de tu sistema de monitoreo:\n• Base de datos: conectada (${dbCheck.rows[0].now.toISOString()})\n• Tus dispositivos: ${devices.length}\n• Lecturas en la última hora: ${lecturas1h}\n• Alertas sin leer: ${alertasPendientes}\n• ${estadoGeneral}`;
    },
  },

  // ── Resumen / reporte ───────────────────────────────────────
  {
    test: (q) => /resumen|reporte|informe|dashboard/.test(q),
    handler: async (userId) => {
      const devices = await getUserDevices(userId);
      if (devices.length === 0) return 'No tienes dispositivos registrados.';

      const deviceIds = devices.map((d) => d.id);
      const { rows: tempRow } = await pool.query(
        `SELECT MIN(temperatura) AS min_temp, MAX(temperatura) AS max_temp,
                ROUND(AVG(temperatura)::numeric, 1) AS avg_temp, COUNT(*) AS total
         FROM temperatures
         WHERE device_id = ANY($1) AND fecha > NOW() - INTERVAL '24 hours'`,
        [deviceIds]
      );
      const { rows: alertRow } = await pool.query(
        `SELECT COUNT(*) AS total FROM alerts
         WHERE device_id = ANY($1) AND fecha > NOW() - INTERVAL '24 hours'`,
        [deviceIds]
      );
      const t = tempRow[0];
      const alertas24h = alertRow[0].total;
      if (Number(t.total) === 0) {
        return 'No hay lecturas en las últimas 24 horas en tus dispositivos para generar un resumen.';
      }
      return `📊 Resumen de tus dispositivos (últimas 24 horas):\n• Lecturas registradas: ${t.total}\n• Temperatura mínima: ${t.min_temp}°C\n• Temperatura máxima: ${t.max_temp}°C\n• Temperatura promedio: ${t.avg_temp}°C\n• Alertas generadas: ${alertas24h}`;
    },
  },

  // ── Ayuda ───────────────────────────────────────────────────
  {
    test: (q) => /ayuda|help|qu[eé] puedo|c[oó]mo funciona|opciones|comandos/.test(q),
    handler: async () => {
      return '🤖 Puedo ayudarte con lo siguiente:\n• Pregunta por la **temperatura** de tus dispositivos\n• Pregunta por la **humedad** de tus dispositivos\n• Consulta tus **alertas**\n• Pregunta por tus **dispositivos** registrados\n• Pide el **estado** de tu sistema\n• Solicita un **resumen** de las últimas 24 horas\n• Pregunta si hay **fallas** en tus dispositivos\n\nEjemplos: "¿Cuál es la temperatura?", "¿Hay alertas?", "¿Hay fallas?", "Estado del sistema"';
    },
  },

  // ── Saludos ─────────────────────────────────────────────────
  {
    test: (q) => /^(hola|buenas|hey|saludos|buenos d[ií]as|buenas tardes|buenas noches)/.test(q),
    handler: async () => {
      return '¡Hola! 👋 Soy el asistente de tu sistema de monitoreo. Puedes preguntarme sobre temperatura, humedad, alertas, dispositivos, fallas o el estado de tu sistema. Escribe "ayuda" para más opciones.';
    },
  },

  // ── Gracias ─────────────────────────────────────────────────
  {
    test: (q) => /gracias|thanks|genial|perfecto/.test(q),
    handler: async () => {
      return '¡De nada! 😊 Si necesitas algo más, aquí estoy.';
    },
  },
];

// ── Utilidades ───────────────────────────────────────────────

/**
 * Obtiene los dispositivos del usuario autenticado.
 * Se usa en múltiples handlers para garantizar que NUNCA se mezclen datos.
 */
async function getUserDevices(userId) {
  const { rows } = await pool.query(
    'SELECT id, nombre, ubicacion, limite_min, limite_max, device_code, status FROM devices WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

/**
 * Ejecuta un handler con un timeout de seguridad.
 * Si la consulta a la BD tarda más de `ms` milisegundos, devuelve un mensaje
 * de error en vez de dejar la petición colgada para siempre.
 */
function withTimeout(fn, ms = 15000) {
  return (...args) => {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Tiempo de espera agotado consultando la base de datos')), ms);
    });
    return Promise.race([fn(...args), timeout]).finally(() => clearTimeout(timer));
  };
}

function formatFecha(fecha) {
  if (!fecha) return '';
  const diff = Date.now() - new Date(fecha).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'hace unos segundos';
  if (mins < 60) return `hace ${mins} ${mins === 1 ? 'minuto' : 'minutos'}`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[¿?¡!.,;:]/g, '')     // quitar puntuación
    .trim();
}

// ============================================================
// POST /api/assistant — Pregunta al asistente IA (requiere JWT)
// ============================================================
exports.ask = async (req, res) => {
  try {
    const userId = req.user.id;
    const pregunta = req.body?.pregunta;

    if (!pregunta || typeof pregunta !== 'string' || pregunta.trim().length === 0) {
      return res.status(400).json({ respuesta: 'Debes escribir una pregunta.' });
    }

    const normalizada = normalize(pregunta);

    console.log(`📥 Pregunta recibida (usuario ${userId}):`, pregunta);

    // Buscar la primera regla que coincida
    for (const rule of rules) {
      if (rule.test(normalizada)) {
        console.log('🔍 Regla coincidente encontrada, ejecutando handler…');
        const respuesta = await withTimeout(rule.handler)(userId, normalizada);
        console.log('✅ Respuesta generada, enviando al cliente');
        return res.json({ respuesta });
      }
    }

    // Respuesta por defecto
    console.log('ℹ️ Ninguna regla coincidió, enviando respuesta por defecto');
    return res.json({
      respuesta:
        'No entendí tu pregunta. Puedes preguntarme sobre temperatura, humedad, alertas, dispositivos, fallas o el estado de tu sistema. Escribe "ayuda" para ver todas las opciones.',
    });
  } catch (error) {
    console.error('❌ Error en asistente:', error.message || error);
    return res.status(500).json({
      respuesta: 'Ocurrió un error al procesar tu pregunta. Intenta de nuevo.',
    });
  }
};
