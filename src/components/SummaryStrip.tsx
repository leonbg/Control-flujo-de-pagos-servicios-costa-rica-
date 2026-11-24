import { TRANSLATIONS } from '../i18n/translations';
import type { CurrencyCode, LanguageCode, PaymentSummary } from '../types/payment';
import { formatCurrency } from '../utils/formatters';

interface SummaryStripProps {
  summary: PaymentSummary;
  currency: CurrencyCode;
  language: LanguageCode;
}

export function SummaryStrip({
  summary,
  currency,
  language,
}: SummaryStripProps) {
  const t = TRANSLATIONS[language];
  const urgentAmount = summary.overdueTotal + summary.dueSoonTotal;
  const hasOverdue = summary.overdueCount > 0;

  return (
    <section
      aria-label="Resumen de flujo de pagos"
      className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
    >
      <div className="p-4 sm:p-5">
        <p className="text-xs font-medium text-slate-500">{t.kpis.dueSoon}</p>
        <p
          className={`mt-1.5 text-2xl font-semibold font-mono tabular-nums tracking-tight ${
            hasOverdue ? 'text-red-600' : 'text-slate-900'
          }`}
        >
          {formatCurrency(urgentAmount, currency, language)}
        </p>
        <p
          className={`mt-1 text-xs ${
            hasOverdue ? 'text-red-600 font-medium' : 'text-slate-500'
          }`}
        >
          {t.kpis.dueSoonSub(summary.dueSoonCount, summary.overdueCount)}
        </p>
      </div>

      <div className="p-4 sm:p-5">
        <p className="text-xs font-medium text-slate-500">
          {t.kpis.remainingMonth}
        </p>
        <p className="mt-1.5 text-2xl font-semibold font-mono tabular-nums tracking-tight text-slate-900">
          {formatCurrency(summary.remainingMonthTotal, currency, language)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {t.kpis.remainingMonthSub(summary.remainingMonthCount)}
        </p>
      </div>

      <div className="p-4 sm:p-5">
        <p className="text-xs font-medium text-slate-500">{t.kpis.paidMonth}</p>
        <p className="mt-1.5 text-2xl font-semibold font-mono tabular-nums tracking-tight text-green-700">
          {formatCurrency(summary.paidMonthTotal, currency, language)}
        </p>
        <div className="mt-2 flex items-center gap-2.5">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 transition-[width] duration-200"
              style={{ width: `${Math.min(100, summary.monthCompletionPct)}%` }}
            />
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
            {summary.monthCompletionPct}%
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <p className="text-xs font-medium text-slate-500">{t.kpis.monthlyBase}</p>
        <p className="mt-1.5 text-2xl font-semibold font-mono tabular-nums tracking-tight text-slate-900">
          {formatCurrency(summary.monthlyBaseline, currency, language)}
        </p>
        <p className="mt-1 text-xs text-slate-500">{t.kpis.monthlyBaseSub}</p>
      </div>
    </section>
  );
}
