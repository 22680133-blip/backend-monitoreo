/**
 * Controlador del asistente IA — endpoint POST /api/assistant
 *
 * Chatbot basado en reglas que interpreta la pregunta del usuario,
 * consulta la base de datos y responde dinámicamente con datos reales
 * del sistema de monitoreo.
 *
 * ✅ No usa APIs externas (sin OpenAI, sin Gemini).
 * ✅ Completamente gratuito — funciona con lógica local + PostgreSQL.
 */

const pool = require('../config/db');

// ── Patrones de reconocimiento ───────────────────────────────
// Cada regla: { test: función(pregunta) → bool, handler: async (pregunta) → string }
const rules = [

  // ── Temperatura ─────────────────────────────────────────────
  {
    test: (q) => /temperatura/.test(q),
    handler: async () => {
      const { rows } = await pool.query(
        'SELECT t.temperatura, t.fecha, d.nombre, d.device_code FROM temperatures t JOIN devices d ON d.id = t.device_id ORDER BY t.fecha DESC LIMIT 1'
      );
      if (rows.length === 0) {
        return 'No hay lecturas de temperatura registradas aún.';
      }
      const { temperatura, fecha, nombre, device_code } = rows[0];
      const cuando = formatFecha(fecha);
      return `La temperatura más reciente es ${temperatura}°C, registrada ${cuando} por el dispositivo "${nombre}" (${device_code}).`;
    },
  },

  // ── Humedad ─────────────────────────────────────────────────
  {
    test: (q) => /humedad/.test(q),
    handler: async () => {
      const { rows } = await pool.query(
        'SELECT t.humedad, t.fecha, d.nombre, d.device_code FROM temperatures t JOIN devices d ON d.id = t.device_id ORDER BY t.fecha DESC LIMIT 1'
      );
      if (rows.length === 0) {
        return 'No hay lecturas de humedad registradas aún.';
      }
      const { humedad, fecha, nombre, device_code } = rows[0];
      if (humedad == null) {
        return 'La última lectura no incluye datos de humedad.';
      }
      const cuando = formatFecha(fecha);
      return `La humedad más reciente es ${humedad}%, registrada ${cuando} por el dispositivo "${nombre}" (${device_code}).`;
    },
  },

  // ── Alertas ─────────────────────────────────────────────────
  {
    test: (q) => /alerta|alarma|warning|aviso/.test(q),
    handler: async () => {
      const { rows } = await pool.query(
        'SELECT a.tipo, a.mensaje, a.fecha, a.leida, d.nombre, d.device_code FROM alerts a JOIN devices d ON d.id = a.device_id ORDER BY a.fecha DESC LIMIT 5'
      );
      if (rows.length === 0) {
        return 'No hay alertas registradas en el sistema. ¡Todo está en orden! ✅';
      }
      const noLeidas = rows.filter((r) => !r.leida).length;
      const ultima = rows[0];
      const cuando = formatFecha(ultima.fecha);
      let respuesta = `Hay ${rows.length} alerta(s) reciente(s)`;
      if (noLeidas > 0) {
        respuesta += ` (${noLeidas} sin leer)`;
      }
      respuesta += `. La más reciente: "${ultima.mensaje}" (${ultima.tipo}) del dispositivo "${ultima.nombre}" — ${cuando}.`;
      return respuesta;
    },
  },

  // ── Dispositivos ────────────────────────────────────────────
  {
    test: (q) => /dispositivo|equipo|refrigerador|sensor/.test(q),
    handler: async () => {
      const { rows } = await pool.query(
        'SELECT nombre, device_code, status, ubicacion FROM devices ORDER BY created_at DESC'
      );
      if (rows.length === 0) {
        return 'No hay dispositivos registrados en el sistema.';
      }
      const lineas = rows.map(
        (d) => `• ${d.nombre} (${d.device_code}) — ${d.status}${d.ubicacion ? ', ubicación: ' + d.ubicacion : ''}`
      );
      return `Hay ${rows.length} dispositivo(s) registrado(s):\n${lineas.join('\n')}`;
    },
  },

  // ── Estado del sistema ──────────────────────────────────────
  {
    test: (q) => /estado|sistema|funciona|status/.test(q),
    handler: async () => {
      const dbCheck = await pool.query('SELECT NOW() AS now');
      const { rows: devRows } = await pool.query('SELECT COUNT(*) AS total FROM devices');
      const { rows: tempRows } = await pool.query(
        'SELECT COUNT(*) AS total FROM temperatures WHERE fecha > NOW() - INTERVAL \'1 hour\''
      );
      const { rows: alertRows } = await pool.query(
        'SELECT COUNT(*) AS total FROM alerts WHERE leida = false'
      );
      const dispositivos = devRows[0].total;
      const lecturas1h = tempRows[0].total;
      const alertasPendientes = alertRows[0].total;
      return `El sistema está funcionando correctamente ✅\n• Base de datos: conectada (${dbCheck.rows[0].now.toISOString()})\n• Dispositivos registrados: ${dispositivos}\n• Lecturas en la última hora: ${lecturas1h}\n• Alertas sin leer: ${alertasPendientes}`;
    },
  },

  // ── Resumen / reporte ───────────────────────────────────────
  {
    test: (q) => /resumen|reporte|informe|dashboard/.test(q),
    handler: async () => {
      const { rows: tempRow } = await pool.query(
        'SELECT MIN(temperatura) AS min_temp, MAX(temperatura) AS max_temp, ROUND(AVG(temperatura)::numeric, 1) AS avg_temp, COUNT(*) AS total FROM temperatures WHERE fecha > NOW() - INTERVAL \'24 hours\''
      );
      const { rows: alertRow } = await pool.query(
        'SELECT COUNT(*) AS total FROM alerts WHERE fecha > NOW() - INTERVAL \'24 hours\''
      );
      const t = tempRow[0];
      const alertas24h = alertRow[0].total;
      if (Number(t.total) === 0) {
        return 'No hay lecturas en las últimas 24 horas para generar un resumen.';
      }
      return `📊 Resumen de las últimas 24 horas:\n• Lecturas registradas: ${t.total}\n• Temperatura mínima: ${t.min_temp}°C\n• Temperatura máxima: ${t.max_temp}°C\n• Temperatura promedio: ${t.avg_temp}°C\n• Alertas generadas: ${alertas24h}`;
    },
  },

  // ── Ayuda ───────────────────────────────────────────────────
  {
    test: (q) => /ayuda|help|qu[eé] puedo|c[oó]mo funciona|opciones|comandos/.test(q),
    handler: async () => {
      return '🤖 Puedo ayudarte con lo siguiente:\n• Pregunta por la **temperatura** actual\n• Pregunta por la **humedad** actual\n• Consulta las **alertas** del sistema\n• Pregunta por los **dispositivos** registrados\n• Pide el **estado** del sistema\n• Solicita un **resumen** de las últimas 24 horas\n\nEjemplos: "¿Cuál es la temperatura?", "¿Hay alertas?", "Estado del sistema"';
    },
  },

  // ── Saludos ─────────────────────────────────────────────────
  {
    test: (q) => /^(hola|buenas|hey|saludos|buenos d[ií]as|buenas tardes|buenas noches)/.test(q),
    handler: async () => {
      return '¡Hola! 👋 Soy el asistente del sistema de monitoreo. Puedes preguntarme sobre temperatura, humedad, alertas, dispositivos o el estado del sistema. Escribe "ayuda" para más opciones.';
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
// POST /api/assistant — Pregunta al asistente IA
// ============================================================
exports.ask = async (req, res) => {
  try {
    const pregunta = req.body?.pregunta;

    if (!pregunta || typeof pregunta !== 'string' || pregunta.trim().length === 0) {
      return res.status(400).json({ respuesta: 'Debes escribir una pregunta.' });
    }

    const normalizada = normalize(pregunta);

    console.log('📥 Pregunta recibida:', pregunta);

    // Buscar la primera regla que coincida
    for (const rule of rules) {
      if (rule.test(normalizada)) {
        console.log('🔍 Regla coincidente encontrada, ejecutando handler…');
        const respuesta = await withTimeout(rule.handler)(normalizada);
        console.log('✅ Respuesta generada, enviando al cliente');
        return res.json({ respuesta });
      }
    }

    // Respuesta por defecto
    console.log('ℹ️ Ninguna regla coincidió, enviando respuesta por defecto');
    return res.json({
      respuesta:
        'No entendí tu pregunta. Puedes preguntarme sobre temperatura, humedad, alertas, dispositivos o el estado del sistema. Escribe "ayuda" para ver todas las opciones.',
    });
  } catch (error) {
    console.error('❌ Error en asistente:', error.message || error);
    return res.status(500).json({
      respuesta: 'Ocurrió un error al procesar tu pregunta. Intenta de nuevo.',
    });
  }
};
