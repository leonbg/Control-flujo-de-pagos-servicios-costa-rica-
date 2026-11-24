import { readSheet } from 'read-excel-file/browser';
import writeXlsxFile, { type SheetData } from 'write-excel-file/browser';
import type {
  PaymentCategory,
  PaymentMethod,
  PaymentRule,
  RecurrenceCycle,
} from '../types/payment';
import { getTodayISO, toISODateLocal } from './formatters';

export type ImportedDraft = Omit<PaymentRule, 'id' | 'createdAt'> & {
  tempId: string;
  selected: boolean;
};

function createTempId(): string {
  return `imp-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function parseAmountValue(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw * 100) / 100 : 0;
  }
  const str = String(raw ?? '').trim();
  if (!str) return 0;

  // Strip currency symbols and spaces
  let cleaned = str.replace(/[^\d.,-]/g, '');
  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is decimal
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // Check if comma looks like decimal (2 digits after) vs thousands (3 digits)
    const afterComma = cleaned.slice(lastComma + 1);
    if (afterComma.length <= 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  const num = Number(cleaned);
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : 0;
}

export function parseDateValue(raw: unknown): string {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return toISODateLocal(raw);
  }
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
    // Excel 1900 serial date (epoch 1899-12-30 UTC)
    const utcMs = Date.UTC(1899, 11, 30) + Math.floor(raw) * 86_400_000;
    const d = new Date(utcMs);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  const str = String(raw ?? '').trim();
  if (!str) return getTodayISO();

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Day of month only (e.g. "15" or "día 5")
  const dayOnly = str.match(/^(?:dia\s+)?(\d{1,2})$/i);
  if (dayOnly) {
    const day = Math.min(28, Math.max(1, Number(dayOnly[1])));
    const now = new Date();
    const candidate = new Date(now.getFullYear(), now.getMonth(), day);
    if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      candidate.setMonth(candidate.getMonth() + 1);
    }
    return toISODateLocal(candidate);
  }

  return getTodayISO();
}

export function mapCategory(raw: unknown, titleHint = ''): PaymentCategory {
  const val = `${normalizeText(raw)} ${normalizeText(titleHint)}`;
  if (/rent|alquil|condo|vivienda|apart|casa|cuota/.test(val)) return 'rent';
  if (/tuit|coleg|univ|ucr|tec|escuel|matric|curso|mensualidad/.test(val))
    return 'tuition';
  if (
    /servic|luz|elect|cnfl|ice|kolbi|agua|aya|inter|tel|liberty|tigo|gas|cable/.test(
      val
    )
  )
    return 'services';
  if (/sub|susc|gim|smart fit|cloud|stream|netflix|spotify|membres/.test(val))
    return 'subscriptions';
  return 'other';
}

export function mapRecurrence(raw: unknown): RecurrenceCycle {
  const val = normalizeText(raw);
  if (/unic|one_time|once|solo una/.test(val)) return 'one_time';
  if (/bimes|bimonth/.test(val)) return 'bimonthly';
  if (/trimes|quarter/.test(val)) return 'quarterly';
  if (/semes|cuatrim|ciclo/.test(val)) return 'semester';
  if (/anual|annual|year/.test(val)) return 'annual';
  return 'monthly';
}

export function mapMethod(raw: unknown): PaymentMethod {
  const val = normalizeText(raw);
  if (/domicil|direct_debit|cargo auto|debito auto|autopay/.test(val))
    return 'direct_debit';
  if (/credit|credito|tc|visa|master/.test(val)) return 'credit_card';
  if (/debit|debito|td/.test(val)) return 'debit_card';
  if (/efect|cash/.test(val)) return 'cash';
  return 'transfer';
}

function mapAutopay(raw: unknown, methodHint: PaymentMethod): boolean {
  if (typeof raw === 'boolean') return raw;
  const val = normalizeText(raw);
  if (/si|yes|true|1|auto|domicil/.test(val)) return true;
  if (/no|false|0|manual/.test(val)) return false;
  return methodHint === 'direct_debit';
}

function rowsToDrafts(rows: unknown[][]): ImportedDraft[] {
  if (rows.length === 0) return [];

  // Find header row in first 5 rows
  let headerIdx = -1;
  const headerKeywords = [
    'concepto',
    'title',
    'descripcion',
    'pago',
    'nombre',
    'servicio',
    'proveedor',
    'payee',
    'empresa',
    'institucion',
    'monto',
    'amount',
    'importe',
    'valor',
    'total',
    'fecha',
    'vencimiento',
    'due',
  ];

  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const cells = rows[i].map(normalizeText);
    const hits = cells.filter((c) =>
      headerKeywords.some((kw) => c.includes(kw))
    ).length;
    if (hits >= 2) {
      headerIdx = i;
      break;
    }
  }

  const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;
  const headers =
    headerIdx >= 0 ? rows[headerIdx].map(normalizeText) : [];

  const findCol = (patterns: RegExp[], fallback: number): number => {
    if (headers.length === 0) return fallback;
    const idx = headers.findIndex((h) => patterns.some((re) => re.test(h)));
    return idx >= 0 ? idx : -1;
  };

  const colTitle = findCol([/concept|titulo|title|descrip|servicio|pago|nombre/], 0);
  const colPayee = findCol([/proveed|benefic|payee|empresa|instituc|entidad|coleg|univ/], 1);
  const colAmount = findCol([/monto|amount|importe|cuota|valor|precio|total/], 2);
  const colDate = findCol([/fecha|venc|due|dia|date/], 3);
  const colCategory = findCol([/categ|tipo|rubro/], -1);
  const colRecurrence = findCol([/frecu|ciclo|recurr|period/], -1);
  const colMethod = findCol([/metod|medio|forma|cuenta/], -1);
  const colAutopay = findCol([/domicil|auto/], -1);
  const colRef = findCol([/ref|contrat|nis|carne|poliza|servicio/], -1);
  const colNotes = findCol([/nota|observ|coment|detalle/], -1);

  const drafts: ImportedDraft[] = [];

  for (const row of dataRows) {
    const rawCells = row.map((c) => String(c ?? '').trim());
    if (rawCells.every((c) => !c)) continue;

    // Skip total summary rows
    const firstNonEmpty = normalizeText(rawCells.find((c) => c !== '') ?? '');
    if (/^(total|subtotal|suma|gran total)\b/.test(firstNonEmpty)) continue;

    const titleRaw = colTitle >= 0 ? row[colTitle] : row[0];
    const payeeRaw = colPayee >= 0 ? row[colPayee] : row[1] ?? titleRaw;

    // If headerless, search row for amount if col 2 wasn't numeric
    let amount = colAmount >= 0 ? parseAmountValue(row[colAmount]) : 0;
    if (amount <= 0 && headerIdx < 0) {
      for (const cell of row) {
        const parsed = parseAmountValue(cell);
        if (parsed > 0) {
          amount = parsed;
          break;
        }
      }
    }

    const title = String(titleRaw ?? '').trim().slice(0, 120);
    const payee = String(payeeRaw ?? title).trim().slice(0, 120);
    if (!title || amount <= 0) continue;

    const dueDate = parseDateValue(colDate >= 0 ? row[colDate] : undefined);
    const category = mapCategory(
      colCategory >= 0 ? row[colCategory] : '',
      `${title} ${payee}`
    );
    const recurrence = mapRecurrence(
      colRecurrence >= 0 ? row[colRecurrence] : ''
    );
    const method = mapMethod(colMethod >= 0 ? row[colMethod] : '');
    const autopay = mapAutopay(
      colAutopay >= 0 ? row[colAutopay] : '',
      method
    );
    const reference =
      colRef >= 0 ? String(row[colRef] ?? '').trim().slice(0, 100) : '';
    const notes =
      colNotes >= 0 ? String(row[colNotes] ?? '').trim().slice(0, 500) : '';

    drafts.push({
      tempId: createTempId(),
      selected: true,
      title,
      payee: payee || title,
      category,
      amount,
      dueDate,
      recurrence,
      method,
      autopay,
      paused: false,
      reference: reference || undefined,
      notes: notes || undefined,
    });
  }

  return drafts;
}

export async function parseSpreadsheetFile(file: File): Promise<ImportedDraft[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.txt') || lower.endsWith('.tsv') || lower.endsWith('.csv')) {
    const text = await file.text();
    return parseDelimitedText(text);
  }

  const rows = await readSheet(file);
  return rowsToDrafts(rows as unknown[][]);
}

export function parseDelimitedText(text: string): ImportedDraft[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // Detect delimiter: tab, semicolon, pipe, or comma
  const sample = lines.slice(0, 5).join('\n');
  const delimiters = ['\t', ';', '|', ','];
  let bestDelim = ',';
  let bestScore = 0;
  for (const d of delimiters) {
    const count = sample.split(d).length - 1;
    if (count > bestScore) {
      bestScore = count;
      bestDelim = d;
    }
  }

  if (bestScore === 0) return [];

  const rows = lines.map((line) => {
    if (bestDelim === ',') {
      // Handle basic quoted CSV cells
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      cells.push(current.trim());
      return cells;
    }
    return line.split(bestDelim).map((c) => c.trim());
  });

  return rowsToDrafts(rows);
}

export function normalizeExtractedItems(rawItems: unknown[]): ImportedDraft[] {
  const drafts: ImportedDraft[] = [];
  for (const raw of rawItems) {
    if (typeof raw !== 'object' || raw === null) continue;
    const item = raw as Record<string, unknown>;
    const title = String(item.title ?? '').trim().slice(0, 120);
    const payee = String(item.payee ?? title).trim().slice(0, 120);
    const amount = parseAmountValue(item.amount);
    if (!title || amount <= 0) continue;

    const method = mapMethod(item.method);
    drafts.push({
      tempId: createTempId(),
      selected: true,
      title,
      payee: payee || title,
      category: mapCategory(item.category, `${title} ${payee}`),
      amount,
      dueDate: parseDateValue(item.dueDate),
      recurrence: mapRecurrence(item.recurrence),
      method,
      autopay: mapAutopay(item.autopay, method),
      paused: false,
      reference:
        typeof item.reference === 'string' && item.reference.trim()
          ? item.reference.trim().slice(0, 100)
          : undefined,
      notes:
        typeof item.notes === 'string' && item.notes.trim()
          ? item.notes.trim().slice(0, 500)
          : undefined,
    });
  }
  return drafts;
}

export async function compressImageForUpload(
  file: File
): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  const previewUrl = URL.createObjectURL(file);
  const img = new Image();
  img.src = previewUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
  });

  const maxDim = 1800;
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo procesar la imagen.');
  }
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  const base64 = dataUrl.split(',')[1] ?? '';
  return { base64, mimeType: 'image/jpeg', previewUrl };
}

export function captureVideoFrame(video: HTMLVideoElement): {
  base64: string;
  mimeType: string;
  previewUrl: string;
} {
  const maxDim = 1800;
  let width = video.videoWidth || 1280;
  let height = video.videoHeight || 720;

  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo capturar el cuadro de la cámara.');
  }
  ctx.drawImage(video, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const base64 = dataUrl.split(',')[1] ?? '';
  return { base64, mimeType: 'image/jpeg', previewUrl: dataUrl };
}

export async function downloadTemplateExcel(): Promise<void> {
  const today = getTodayISO();
  const rows: SheetData = [
    [
      'Concepto',
      'Proveedor',
      'Monto',
      'Vencimiento',
      'Categoria',
      'Frecuencia',
      'Metodo',
      'Domiciliado',
      'Referencia',
      'Notas',
    ],
    [
      'Servicio Eléctrico (CNFL)',
      'Compañía Nacional de Fuerza y Luz (CNFL)',
      34800,
      today,
      'services',
      'monthly',
      'debit_card',
      'No',
      'N.º Servicio 4920184421',
      'Confirmar factura electrónica',
    ],
    [
      'Internet Fibra Óptica',
      'Kölbi (ICE)',
      29900,
      today,
      'services',
      'monthly',
      'direct_debit',
      'Sí',
      'Cuenta 01948271',
      '',
    ],
    [
      'Mensualidad Colegio',
      'Colegio La Salle Costa Rica',
      215000,
      today,
      'tuition',
      'monthly',
      'transfer',
      'No',
      'Est. LS-2026-304',
      'Enviar comprobante SINPE',
    ],
  ];

  await writeXlsxFile(rows, { sheet: 'Obligaciones' }).toFile(
    'plantilla-flujopago.xlsx'
  );
}
