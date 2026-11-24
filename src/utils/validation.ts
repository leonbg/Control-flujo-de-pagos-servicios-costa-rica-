import type { PaymentLog, PaymentRule } from '../types/payment';

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export function sanitizeId(rawId: string, fallbackPrefix = 'item'): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  if (ID_PATTERN.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}-${Date.now().toString(36)}`;
}

export function sanitizeRulePayload(
  rule: Omit<PaymentRule, 'id' | 'createdAt'>,
  ownerId: string
) {
  const title = rule.title.trim().slice(0, 120);
  const payee = rule.payee.trim().slice(0, 120);
  const amount = Math.min(100000000, Math.max(0.01, Number(rule.amount) || 0.01));
  const dueDate = DATE_PATTERN.test(rule.dueDate)
    ? rule.dueDate
    : new Date().toISOString().slice(0, 10);

  const payload: Record<string, unknown> = {
    ownerId,
    title: title || 'Pago',
    payee: payee || 'Proveedor',
    category: rule.category,
    amount,
    dueDate,
    recurrence: rule.recurrence,
    method: rule.method,
    autopay: Boolean(rule.autopay),
    paused: Boolean(rule.paused),
  };

  const ref = rule.reference?.trim().slice(0, 100);
  if (ref) {
    payload.reference = ref;
  }

  const notes = rule.notes?.trim().slice(0, 500);
  if (notes) {
    payload.notes = notes;
  }

  return payload;
}

export function sanitizeLogPayload(
  log: Omit<PaymentLog, 'id'>,
  ownerId: string
) {
  const title = log.title.trim().slice(0, 120);
  const payee = log.payee.trim().slice(0, 120);
  const amountPaid = Math.min(
    100000000,
    Math.max(0.01, Number(log.amountPaid) || 0.01)
  );
  const today = new Date().toISOString().slice(0, 10);
  const dueDate = DATE_PATTERN.test(log.dueDate) ? log.dueDate : today;
  const paidDate = DATE_PATTERN.test(log.paidDate) ? log.paidDate : today;

  const payload: Record<string, unknown> = {
    ownerId,
    title: title || 'Pago',
    payee: payee || 'Proveedor',
    category: log.category,
    amountPaid,
    dueDate,
    paidDate,
    method: log.method,
  };

  if (log.ruleId && ID_PATTERN.test(log.ruleId)) {
    payload.ruleId = log.ruleId;
  }

  const notes = log.notes?.trim().slice(0, 500);
  if (notes) {
    payload.notes = notes;
  }

  return payload;
}
