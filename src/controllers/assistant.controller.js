/**
 * Controlador del asistente IA — endpoint POST /api/assistant
 *
 * Recibe una pregunta del usuario, consulta datos recientes de la base
 * de datos (temperaturas y alertas) y envía todo como contexto a OpenAI
 * para generar una respuesta inteligente.
 *
 * Requiere la variable de entorno OPENAI_API_KEY.
 */
const pool = require('../config/db');
const OpenAI = require('openai');

// ============================================================
// POST /api/assistant — Pregunta al asistente IA
// ============================================================
exports.ask = async (req, res) => {
  try {
    const { pregunta } = req.body;

    if (!pregunta || typeof pregunta !== 'string' || pregunta.trim().length === 0) {
      return res.status(400).json({ mensaje: 'Se requiere el campo "pregunta"' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ mensaje: 'Servicio de IA no configurado' });
    }

    // ── 1. Consultar datos relevantes de la base de datos ───────────
    const [tempResult, alertResult] = await Promise.all([
      pool.query('SELECT * FROM temperatures ORDER BY fecha DESC LIMIT 20'),
      pool.query('SELECT * FROM alerts ORDER BY fecha DESC LIMIT 10'),
    ]);

    const temperaturas = tempResult.rows;
    const alertas = alertResult.rows;

    // ── 2. Construir el contexto para la IA ─────────────────────────
    const contexto = `Eres un asistente de monitoreo de temperatura y humedad. ` +
      `Responde en español basándote SOLO en los datos proporcionados.\n\n` +
      `Datos recientes:\n` +
      `Temperaturas (últimas 20 lecturas):\n${JSON.stringify(temperaturas, null, 2)}\n\n` +
      `Alertas (últimas 10):\n${JSON.stringify(alertas, null, 2)}\n\n` +
      `Pregunta del usuario: ${pregunta.trim()}`;

    // ── 3. Enviar a OpenAI ──────────────────────────────────────────
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Eres un asistente experto en monitoreo de temperatura, humedad y alertas. ' +
            'Responde de forma clara, concisa y en español.',
        },
        { role: 'user', content: contexto },
      ],
      max_tokens: 512,
    });

    const respuesta =
      completion.choices && completion.choices.length > 0
        ? completion.choices[0].message.content
        : null;

    if (!respuesta) {
      return res.status(502).json({ mensaje: 'No se obtuvo respuesta del modelo de IA' });
    }

    // ── 4. Devolver la respuesta ────────────────────────────────────
    res.json({ respuesta });
  } catch (error) {
    console.error('❌ Error en POST /api/assistant:', error);
    res.status(500).json({ mensaje: 'Error al procesar la consulta del asistente' });
  }
};
