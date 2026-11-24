import type {
  PaymentCategory,
  PaymentLog,
  PaymentRule,
  PaymentSummary,
} from '../types/payment';
import { getDaysUntil, getMonthlyMultiplier, getTodayISO } from './formatters';

export function computePaymentSummary(
  rules: PaymentRule[],
  logs: PaymentLog[],
  referenceISO: string = getTodayISO()
): PaymentSummary {
  const currentMonthPrefix = referenceISO.slice(0, 7); // YYYY-MM

  let overdueTotal = 0;
  let overdueCount = 0;
  let dueSoonTotal = 0;
  let dueSoonCount = 0;
  let remainingMonthTotal = 0;
  let remainingMonthCount = 0;
  let paidMonthTotal = 0;
  let paidMonthCount = 0;
  let monthlyBaseline = 0;

  const categoryTotals: Record<PaymentCategory, number> = {
    rent: 0,
    tuition: 0,
    services: 0,
    subscriptions: 0,
    other: 0,
  };

  const categoryCounts: Record<PaymentCategory, number> = {
    rent: 0,
    tuition: 0,
    services: 0,
    subscriptions: 0,
    other: 0,
  };

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    categoryCounts[rule.category] += 1;

    if (rule.paused) {
      continue;
    }

    const daysUntil = getDaysUntil(rule.dueDate, referenceISO);
    const isCurrentMonth = rule.dueDate.startsWith(currentMonthPrefix);

    if (daysUntil < 0) {
      overdueTotal += rule.amount;
      overdueCount += 1;
    } else if (daysUntil <= 7) {
      dueSoonTotal += rule.amount;
      dueSoonCount += 1;
    }

    if (isCurrentMonth || daysUntil < 0) {
      remainingMonthTotal += rule.amount;
      remainingMonthCount += 1;
    }

    const monthlyShare =
      rule.recurrence === 'one_time'
        ? isCurrentMonth
          ? rule.amount
          : 0
        : rule.amount * getMonthlyMultiplier(rule.recurrence);

    monthlyBaseline += monthlyShare;
    categoryTotals[rule.category] +=
      rule.recurrence === 'one_time' ? rule.amount : monthlyShare;
  }

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    if (log.paidDate.startsWith(currentMonthPrefix)) {
      paidMonthTotal += log.amountPaid;
      paidMonthCount += 1;
    }
  }

  const totalMonthPool = paidMonthTotal + remainingMonthTotal;
  const monthCompletionPct =
    totalMonthPool > 0 ? Math.round((paidMonthTotal / totalMonthPool) * 100) : 0;

  return {
    overdueTotal,
    overdueCount,
    dueSoonTotal,
    dueSoonCount,
    remainingMonthTotal,
    remainingMonthCount,
    paidMonthTotal,
    paidMonthCount,
    monthlyBaseline,
    monthCompletionPct,
    categoryTotals,
    categoryCounts,
  };
}

export function buildHistoryCsv(logs: PaymentLog[]): string {
  const headers = [
    'Fecha de pago',
    'Fecha vencimiento',
    'Concepto',
    'Beneficiario',
    'Categoria',
    'Metodo',
    'Monto pagado',
    'Notas',
  ];

  const escapeCell = (val: string | number | undefined): string => {
    const str = String(val ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = logs.map((log) =>
    [
      log.paidDate,
      log.dueDate,
      log.title,
      log.payee,
      log.category,
      log.method,
      log.amountPaid.toFixed(2),
      log.notes ?? '',
    ]
      .map(escapeCell)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
