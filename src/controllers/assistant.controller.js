/**
 * Controlador del asistente IA — endpoint POST /api/assistant
 *
 * Recibe una pregunta del usuario y la envía a OpenAI para generar
 * una respuesta inteligente sobre monitoreo de temperatura.
 *
 * Requiere la variable de entorno OPENAI_API_KEY.
 */
const OpenAI = require('openai');

// ============================================================
// POST /api/assistant — Pregunta al asistente IA
// ============================================================
exports.ask = async (req, res) => {
  try {
    const { pregunta } = req.body;

    if (!pregunta) {
      return res.status(400).json({ mensaje: 'La pregunta es requerida' });
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Falta OPENAI_API_KEY');
    }

    console.log('📥 Pregunta recibida:', pregunta);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente para monitoreo de temperatura de refrigeradores. Responde claro y breve.',
        },
        {
          role: 'user',
          content: pregunta,
        },
      ],
    });

    res.json({
      respuesta: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error('❌ Error en assistant:', error.response?.data || error.message || error);

    res.status(500).json({
      mensaje: 'Error al procesar la consulta del asistente',
      detalle: error.message,
    });
  }
};
