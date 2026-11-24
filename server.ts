import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '6mb' }));

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const MAX_TEXT_LENGTH = 50_000;
const MAX_IMAGE_BASE64_LENGTH = 6_000_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(clientKey);
  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(clientKey, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    if (rateLimitBuckets.size > 1000) {
      for (const [key, val] of rateLimitBuckets.entries()) {
        if (now >= val.resetAt) rateLimitBuckets.delete(key);
      }
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const EXTRACT_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Nombre corto del cobro u obligación de pago (máximo 120 caracteres).',
      },
      payee: {
        type: Type.STRING,
        description: 'Proveedor, empresa, institución, colegio, universidad o arrendador.',
      },
      category: {
        type: Type.STRING,
        description: 'Debe ser exactamente uno de: rent, tuition, services, subscriptions, other.',
      },
      amount: {
        type: Type.NUMBER,
        description: 'Monto numérico positivo mayor a 0.',
      },
      dueDate: {
        type: Type.STRING,
        description: 'Fecha de vencimiento en formato YYYY-MM-DD. Si solo se indica día del mes, usar el próximo mes vigente.',
      },
      recurrence: {
        type: Type.STRING,
        description: 'Debe ser exactamente uno de: one_time, monthly, bimonthly, quarterly, semester, annual.',
      },
      method: {
        type: Type.STRING,
        description: 'Debe ser exactamente uno de: transfer, credit_card, debit_card, cash, direct_debit.',
      },
      autopay: {
        type: Type.BOOLEAN,
        description: 'true si indica domiciliado, cargo automático o débito automático.',
      },
      reference: {
        type: Type.STRING,
        description: 'Número de servicio, NIS, contrato, carné o referencia si aparece.',
      },
      notes: {
        type: Type.STRING,
        description: 'Observaciones adicionales si aparecen.',
      },
    },
    required: [
      'title',
      'payee',
      'category',
      'amount',
      'dueDate',
      'recurrence',
      'method',
      'autopay',
    ],
  },
};

app.post('/api/extract-payments', async (req, res) => {
  const clientIp =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
      : '') ||
    req.socket.remoteAddress ||
    'unknown';

  if (isRateLimited(clientIp)) {
    res.status(429).json({
      error: 'Demasiadas solicitudes de análisis. Espera un minuto e intenta de nuevo.',
    });
    return;
  }

  const ai = getAiClient();
  if (!ai) {
    res.status(503).json({
      error:
        'El servicio de análisis no está configurado en el servidor.',
    });
    return;
  }

  const body =
    typeof req.body === 'object' && req.body !== null
      ? (req.body as Record<string, unknown>)
      : {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const imageBase64 =
    typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : '';
  const todayISO = typeof body.todayISO === 'string' ? body.todayISO.trim() : '';

  if (!text && !imageBase64) {
    res.status(400).json({
      error: 'Debes enviar una imagen o texto con las obligaciones a extraer.',
    });
    return;
  }

  if (text.length > MAX_TEXT_LENGTH) {
    res.status(400).json({
      error: 'El texto enviado excede el límite permitido (50,000 caracteres).',
    });
    return;
  }

  if (imageBase64) {
    if (
      imageBase64.length > MAX_IMAGE_BASE64_LENGTH ||
      !/^[A-Za-z0-9+/=]+$/.test(imageBase64)
    ) {
      res.status(400).json({
        error: 'La imagen enviada no es válida o excede el tamaño máximo permitido.',
      });
      return;
    }
    if (mimeType && !ALLOWED_IMAGE_MIMES.has(mimeType)) {
      res.status(400).json({
        error: 'Formato de imagen no compatible. Usa JPG, PNG o WebP.',
      });
      return;
    }
  }

  const referenceDate =
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(todayISO)
      ? todayISO
      : new Date().toISOString().slice(0, 10);

  const systemInstruction = [
    'Eres un extractor estructurado de obligaciones y recibos de pago.',
    `La fecha actual de referencia es ${referenceDate}.`,
    'Extrae cada fila o concepto de pago visible en la tabla, captura de Excel, foto o texto.',
    'Ignora filas de encabezados o totales generales (como "Total" o "Subtotal").',
    'Reglas de clasificación:',
    '- category: "rent" (alquiler, renta, condominio, mantenimiento vivienda), "tuition" (colegiatura, mensualidad colegio, matrícula universidad, cursos), "services" (electricidad CNFL/ICE, agua AyA, internet Kölbi/Liberty/Tigo, gas, teléfono), "subscriptions" (gimnasio, streaming, nube, membresías), "other" (seguros, impuestos, otros).',
    '- recurrence: "one_time", "monthly", "bimonthly", "quarterly", "semester", "annual". Si es mensual o no se especifica en servicios/alquileres, usa "monthly".',
    '- method: "transfer" (SINPE, transferencia, IBAN), "credit_card", "debit_card", "cash", "direct_debit" (domiciliado, cargo automático).',
    '- dueDate: siempre formato YYYY-MM-DD.',
    '- amount: número positivo sin símbolos ni comas.',
  ].join('\n');

  try {
    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];

    if (imageBase64) {
      const safeMime = ALLOWED_IMAGE_MIMES.has(mimeType)
        ? mimeType
        : 'image/jpeg';
      parts.push({
        inlineData: {
          mimeType: safeMime,
          data: imageBase64,
        },
      });
    }

    parts.push({
      text: text
        ? `Extrae todas las obligaciones de pago de este contenido:\n\n${text}`
        : 'Extrae todas las filas de obligaciones de pago que aparecen en esta foto o captura de Excel.',
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: EXTRACT_SCHEMA,
      },
    });

    const rawText = (response.text ?? '[]').trim();
    const parsed: unknown = JSON.parse(rawText);
    const items = Array.isArray(parsed) ? parsed : [];

    res.json({ items });
  } catch (err) {
    console.error('Error in /api/extract-payments:', err);
    const rawMsg = err instanceof Error ? err.message : '';
    const isQuota =
      rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED');
    res.status(isQuota ? 429 : 500).json({
      error: isQuota
        ? 'Se alcanzó temporalmente el límite de análisis. Intenta nuevamente en unos minutos.'
        : 'No se pudo completar el análisis en este momento. Intenta con una imagen más nítida o archivo CSV/Excel.',
    });
  }
});

async function startServer() {
  const httpServer = http.createServer(app);

  if (IS_PROD) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('sw.js') ||
            filePath.endsWith('manifest.webmanifest')
          ) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: { server: httpServer },
        watch: disableHmr ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
