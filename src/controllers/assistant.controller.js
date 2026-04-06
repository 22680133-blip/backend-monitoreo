/**
 * Controlador del asistente IA — endpoint POST /api/assistant
 *
 * Recibe una pregunta del usuario y la envía a Google Gemini para generar
 * una respuesta inteligente sobre monitoreo de temperatura.
 *
 * Requiere la variable de entorno GEMINI_API_KEY.
 */

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: pregunta }],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Gemini API error:', data);
      return res.status(502).json({
        mensaje: 'Error en la API de Gemini',
        detalle: data.error?.message || 'Respuesta no exitosa de Gemini',
      });
    }

    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';

    res.json({ respuesta: texto });
  } catch (error) {
    console.error('❌ Error en Gemini:', error.message || error);

    res.status(500).json({
      mensaje: 'Error al procesar la consulta del asistente',
      detalle: error.message,
    });
  }
};
