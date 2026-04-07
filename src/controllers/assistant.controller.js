/**
 * Controlador del asistente IA — endpoint POST /api/assistant
 *
 * Recibe una pregunta del usuario y la envía a Google Gemini para generar
 * una respuesta inteligente sobre monitoreo de temperatura.
 *
 * Incluye:
 *  - Caché en memoria (5 min) para evitar llamadas duplicadas a la API.
 *  - Reintento con back-off exponencial ante errores 429 transitorios.
 *  - Manejo específico de RESOURCE_EXHAUSTED (cuota agotada).
 *
 * Requiere la variable de entorno GEMINI_API_KEY.
 */

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = 'Eres un asistente para monitoreo de temperatura de refrigeradores. Responde claro y breve.';

// ── Caché simple en memoria ──────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const MAX_CACHE_SIZE = 200;
const cache = new Map();

function getCachedResponse(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedResponse(key, value) {
  // Evitar crecimiento ilimitado
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { value, ts: Date.now() });
}

// ── Reintento con back-off ───────────────────────────────────
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 2000;

async function callGemini(body) {
  let lastError;
  let lastHttpStatus = 502;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok) {
      return data;
    }

    lastError = data;
    lastHttpStatus = response.status;

    // Solo reintentar en 429 (rate-limit transitorio)
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`⏳ Gemini 429 — reintentando en ${delay} ms (intento ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    // Error no recuperable
    break;
  }

  // Lanzar con metadata para que el handler distinga 429 de otros errores
  const err = new Error(lastError?.error?.message || 'Error en la API de Gemini');
  err.status = lastHttpStatus;
  err.errorData = lastError;
  throw err;
}

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

    // ── Revisar caché ──────────────────────────────────────
    const cacheKey = pregunta.trim().toLowerCase();
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      console.log('📦 Respuesta desde caché');
      return res.json({ respuesta: cached });
    }

    console.log('📥 Pregunta recibida:', pregunta);

    const data = await callGemini({
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          parts: [{ text: pregunta }],
        },
      ],
    });

    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!texto) {
      return res.status(502).json({ mensaje: 'No se obtuvo respuesta del modelo de IA' });
    }

    setCachedResponse(cacheKey, texto);
    res.json({ respuesta: texto });
  } catch (error) {
    console.error('❌ Error en Gemini:', error.message || error);

    // Manejo específico de cuota agotada (429 / RESOURCE_EXHAUSTED)
    if (error.status === 429) {
      return res.status(429).json({
        mensaje: 'El servicio de asistente está temporalmente no disponible debido a límites de uso. Por favor, intenta de nuevo más tarde.',
        detalle: error.message,
      });
    }

    // Otros errores de la API de Gemini
    if (error.errorData) {
      return res.status(502).json({
        mensaje: 'Error en la API de Gemini',
        detalle: error.message,
      });
    }

    res.status(500).json({
      mensaje: 'Error al procesar la consulta del asistente',
      detalle: error.message,
    });
  }
};
