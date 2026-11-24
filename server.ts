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
app.use(express.json({ limit: '10mb' }));

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
  const ai = getAiClient();
  if (!ai) {
    res.status(503).json({
      error:
        'Falta configurar GEMINI_API_KEY en el entorno del servidor para analizar fotos o texto libre.',
    });
    return;
  }

  const { text, imageBase64, mimeType, todayISO } = req.body as {
    text?: string;
    imageBase64?: string;
    mimeType?: string;
    todayISO?: string;
  };

  if (!text && !imageBase64) {
    res.status(400).json({
      error: 'Debes enviar una imagen o texto con las obligaciones a extraer.',
    });
    return;
  }

  const referenceDate =
    typeof todayISO === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(todayISO)
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
      const safeMime =
        typeof mimeType === 'string' && mimeType.startsWith('image/')
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
    const message =
      err instanceof Error ? err.message : 'Error al procesar con Gemini.';
    const status = message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
      ? 429
      : 500;
    res.status(status).json({ error: message });
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
