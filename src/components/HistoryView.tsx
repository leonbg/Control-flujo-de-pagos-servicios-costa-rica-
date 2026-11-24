import { CheckCircle2, Download, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TRANSLATIONS } from '../i18n/translations';
import type { CurrencyCode, LanguageCode, PaymentLog } from '../types/payment';
import { buildHistoryCsv } from '../utils/calculations';
import { formatCurrency, formatDisplayDate } from '../utils/formatters';

interface HistoryViewProps {
  logs: PaymentLog[];
  currency: CurrencyCode;
  language: LanguageCode;
  onDeleteLog: (logId: string) => void;
}

const PAGE_SIZE = 15;

export default function HistoryView({
  logs,
  currency,
  language,
  onDeleteLog,
}: HistoryViewProps) {
  const t = TRANSLATIONS[language];
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [page, setPage] = useState(1);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) {
      set.add(log.paidDate.slice(0, 7));
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [logs]);

  const { filtered, totalFiltered } = useMemo(() => {
    const query = search.trim().toLowerCase();
    let sum = 0;
    const rows = logs.filter((log) => {
      if (monthFilter !== 'all' && !log.paidDate.startsWith(monthFilter)) {
        return false;
      }
      if (query) {
        const hay = `${log.title} ${log.payee} ${log.notes ?? ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      sum += log.amountPaid;
      return true;
    });

    rows.sort((a, b) => b.paidDate.localeCompare(a.paidDate));
    return { filtered: rows, totalFiltered: sum };
  }, [logs, monthFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const handleExportCsv = () => {
    const csv = buildHistoryCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `flujopago-historial-${monthFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t.filters.searchPlaceholder}
              className="w-full h-10 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          <select
            aria-label={t.history.allMonths}
            value={monthFilter}
            onChange={(e) => {
              setMonthFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 px-3 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">{t.history.allMonths}</option>
            {availableMonths.map((ym) => (
              <option key={ym} value={ym}>
                {formatDisplayDate(`${ym}-01`, language, 'monthYear')}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
          <div className="text-right">
            <div className="text-xs text-slate-500">{t.history.totalFiltered}</div>
            <div className="text-sm font-semibold font-mono tabular-nums text-slate-900">
              {formatCurrency(totalFiltered, currency, language)}
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.actions.exportCsv}</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            {t.empty.historyTitle}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
            {t.empty.historyBody}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4 whitespace-nowrap">{t.table.paidDate}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.table.concept}</th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    {t.table.categoryCycle}
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.table.method}</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">
                    {t.table.amount}
                  </th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">
                    {t.table.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {pageRows.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 font-mono tabular-nums text-xs text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                        <span>{formatDisplayDate(log.paidDate, language)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 min-w-[220px]">
                      <div className="font-medium text-slate-900">{log.title}</div>
                      <div className="text-xs text-slate-500">
                        {log.payee}
                        {log.notes ? ` · ${log.notes}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                      {t.categories[log.category]}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                      {t.methods[log.method]}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrency(log.amountPaid, currency, language)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteLog(log.id)}
                        title={t.actions.delete}
                        aria-label={t.actions.delete}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between gap-4 text-xs text-slate-600">
              <span className="font-mono tabular-nums">
                {t.history.showingRange(
                  startIdx + 1,
                  Math.min(startIdx + PAGE_SIZE, filtered.length),
                  filtered.length
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 font-medium bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  {t.history.prevPage}
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 font-medium bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  {t.history.nextPage}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
