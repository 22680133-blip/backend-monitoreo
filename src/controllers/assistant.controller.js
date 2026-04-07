/**
 * Controlador del asistente IA — endpoint POST /api/assistant
 *
 * Recibe una pregunta del usuario y la envía a Google Gemini para generar
 * una respuesta inteligente sobre monitoreo de temperatura.
 *
 * Requiere la variable de entorno GEMINI_API_KEY.
 */

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = 'Eres un asistente para monitoreo de temperatura de refrigeradores. Responde claro y breve.';

// ============================================================
// POST /api/assistant — Pregunta al asistente IA
// ============================================================
exports.ask = async (req, res) => {
  try {
    const pregunta = req.body?.pregunta;

    if (!pregunta) {
      return res.status(400).json({ mensaje: 'Debes enviar { pregunta: \'...\' }' });
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Falta GEMINI_API_KEY');
    }

    console.log('📥 Pregunta recibida:', pregunta);

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            parts: [{ text: pregunta }],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Gemini API error:', data);
      return res.status(502).json({
        mensaje: 'Error en la API de Gemini',
        detalle: data.error?.message || 'Respuesta no exitosa de Gemini',
      });
    }

    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!texto) {
      return res.status(502).json({ mensaje: 'No se obtuvo respuesta del modelo de IA' });
    }

    res.json({ respuesta: texto });
  } catch (error) {
    console.error('❌ Error en Gemini:', error.message || error);

    res.status(500).json({
      mensaje: 'Error al procesar la consulta del asistente',
      detalle: error.message,
    });
  }
};
