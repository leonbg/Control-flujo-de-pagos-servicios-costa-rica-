import type { CurrencyCode, LanguageCode, RecurrenceCycle } from '../types/payment';

const currencyFormatterCache = new Map<string, Intl.NumberFormat>();
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  language: LanguageCode
): string {
  const locale = language === 'es' ? 'es-CR' : 'en-US';
  const key = `${locale}:${currency}`;
  let formatter = currencyFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatterCache.set(key, formatter);
  }
  return formatter.format(amount);
}

export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISODateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayISO(): string {
  return toISODateLocal(new Date());
}

export function formatDisplayDate(
  isoDate: string,
  language: LanguageCode,
  variant: 'short' | 'monthYear' | 'weekdayShort' | 'weekdayLong' = 'short'
): string {
  const locale = language === 'es' ? 'es-CR' : 'en-US';
  const key = `${locale}:${variant}`;
  let formatter = dateFormatterCache.get(key);
  if (!formatter) {
    const options: Intl.DateTimeFormatOptions =
      variant === 'monthYear'
        ? { month: 'long', year: 'numeric' }
        : variant === 'weekdayShort'
          ? { weekday: 'short', day: 'numeric', month: 'short' }
          : variant === 'weekdayLong'
            ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
            : { day: '2-digit', month: 'short', year: 'numeric' };
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatterCache.set(key, formatter);
  }
  return formatter.format(parseLocalDate(isoDate));
}

export function getDaysUntil(isoDate: string, fromISO: string = getTodayISO()): number {
  const target = parseLocalDate(isoDate);
  const origin = parseLocalDate(fromISO);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - origin.getTime()) / msPerDay);
}

export function addDaysISO(isoDate: string, days: number): string {
  const date = parseLocalDate(isoDate);
  date.setDate(date.getDate() + days);
  return toISODateLocal(date);
}

const RECURRENCE_MONTHS: Record<RecurrenceCycle, number> = {
  one_time: 0,
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semester: 6,
  annual: 12,
};

export function advanceDateByCycle(
  isoDate: string,
  cycle: RecurrenceCycle
): string | null {
  const monthsToAdd = RECURRENCE_MONTHS[cycle];
  if (monthsToAdd === 0) return null;

  const [y, m, d] = isoDate.split('-').map(Number);
  const targetMonthIndex = (m - 1) + monthsToAdd;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const maxDaysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const clampedDay = Math.min(d, maxDaysInTargetMonth);

  return toISODateLocal(new Date(targetYear, normalizedMonth, clampedDay));
}

export function getMonthlyMultiplier(cycle: RecurrenceCycle): number {
  switch (cycle) {
    case 'monthly':
      return 1;
    case 'bimonthly':
      return 0.5;
    case 'quarterly':
      return 1 / 3;
    case 'semester':
      return 1 / 6;
    case 'annual':
      return 1 / 12;
    case 'one_time':
      return 0;
  }
}
