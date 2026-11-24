import {
  AlertCircle,
  Check,
  Clock,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { TRANSLATIONS } from '../i18n/translations';
import type {
  CurrencyCode,
  LanguageCode,
  PaymentCategory,
  PaymentRule,
} from '../types/payment';
import {
  formatCurrency,
  formatDisplayDate,
  getDaysUntil,
  getTodayISO,
} from '../utils/formatters';

interface FlowQueueViewProps {
  rules: PaymentRule[];
  currency: CurrencyCode;
  language: LanguageCode;
  categoryFilter: PaymentCategory | 'all';
  onCategoryFilterChange: (cat: PaymentCategory | 'all') => void;
  onMarkPaid: (ruleId: string) => void;
  onOpenCustomSettle: (rule: PaymentRule) => void;
  onEditRule: (rule: PaymentRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onTogglePause: (ruleId: string) => void;
  onCreateNew: () => void;
  onRestoreDemo?: () => void;
}

type ExecutionModeFilter = 'all' | 'manual' | 'autopay';

export function FlowQueueView({
  rules,
  currency,
  language,
  categoryFilter,
  onCategoryFilterChange,
  onMarkPaid,
  onOpenCustomSettle,
  onEditRule,
  onDeleteRule,
  onTogglePause,
  onCreateNew,
  onRestoreDemo,
}: FlowQueueViewProps) {
  const t = TRANSLATIONS[language];
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<ExecutionModeFilter>('all');

  const todayISO = getTodayISO();

  const { overdue, dueWeek, upcoming, paused, filteredCount } = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = rules.filter((rule) => {
      if (categoryFilter !== 'all' && rule.category !== categoryFilter) {
        return false;
      }
      if (modeFilter === 'manual' && rule.autopay) return false;
      if (modeFilter === 'autopay' && !rule.autopay) return false;

      if (query) {
        const haystack =
          `${rule.title} ${rule.payee} ${rule.reference ?? ''} ${rule.notes ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate)
    );

    const overdueList: PaymentRule[] = [];
    const dueWeekList: PaymentRule[] = [];
    const upcomingList: PaymentRule[] = [];
    const pausedList: PaymentRule[] = [];

    for (const item of sorted) {
      if (item.paused) {
        pausedList.push(item);
        continue;
      }
      const days = getDaysUntil(item.dueDate, todayISO);
      if (days < 0) {
        overdueList.push(item);
      } else if (days <= 7) {
        dueWeekList.push(item);
      } else {
        upcomingList.push(item);
      }
    }

    return {
      overdue: overdueList,
      dueWeek: dueWeekList,
      upcoming: upcomingList,
      paused: pausedList,
      filteredCount: filtered.length,
    };
  }, [rules, categoryFilter, modeFilter, search, todayISO]);

  const categories: Array<{ id: PaymentCategory | 'all'; label: string }> = [
    { id: 'all', label: t.filters.allCategories },
    { id: 'rent', label: t.categories.rent },
    { id: 'services', label: t.categories.services },
    { id: 'tuition', label: t.categories.tuition },
    { id: 'subscriptions', label: t.categories.subscriptions },
    { id: 'other', label: t.categories.other },
  ];

  const hasActiveFilters =
    search.trim() !== '' || categoryFilter !== 'all' || modeFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    onCategoryFilterChange('all');
    setModeFilter('all');
  };

  const renderGroup = (
    title: string,
    items: PaymentRule[],
    tone: 'overdue' | 'dueWeek' | 'upcoming' | 'paused'
  ) => {
    if (items.length === 0) return null;

    const groupTotal = items.reduce((sum, item) => sum + item.amount, 0);

    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {tone === 'overdue' && (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            {tone === 'dueWeek' && (
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <h2 className="text-sm font-semibold text-slate-900 truncate">
              {title}
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              ({items.length})
            </span>
          </div>
          <span className="text-xs font-mono tabular-nums font-medium text-slate-700 whitespace-nowrap shrink-0">
            {formatCurrency(groupTotal, currency, language)}
          </span>
        </div>

        <ul className="divide-y divide-slate-200">
          {items.map((rule) => {
            const days = getDaysUntil(rule.dueDate, todayISO);
            let statusLabel = t.status.scheduled;
            let statusClass = 'text-slate-600';

            if (rule.paused) {
              statusLabel = t.status.paused;
              statusClass = 'text-slate-500';
            } else if (days < 0) {
              statusLabel = t.status.overdueByDays(Math.abs(days));
              statusClass = 'text-red-600 font-medium';
            } else if (days === 0) {
              statusLabel = t.status.dueToday;
              statusClass = 'text-amber-700 font-medium';
            } else if (days <= 7) {
              statusLabel = t.status.dueInDays(days);
              statusClass = 'text-amber-700 font-medium';
            }

            return (
              <li
                key={rule.id}
                className="px-4 sm:px-5 py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                    <span className="text-sm font-medium text-slate-900">
                      {rule.title}
                    </span>
                    <span className="text-xs text-slate-500">
                      {rule.payee}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span>{t.categories[rule.category]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{t.recurrences[rule.recurrence]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{t.methods[rule.method]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-600">
                      {rule.autopay ? t.status.autopay : t.status.manual}
                    </span>
                    {rule.reference && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-slate-500">
                          {rule.reference}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-4 sm:gap-5 shrink-0">
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-mono tabular-nums text-slate-700">
                      {formatDisplayDate(rule.dueDate, language)}
                    </div>
                    <div className={`text-xs ${statusClass}`}>{statusLabel}</div>
                  </div>

                  <div className="text-right min-w-[104px]">
                    <span className="text-sm font-semibold font-mono tabular-nums text-slate-900">
                      {formatCurrency(rule.amount, currency, language)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!rule.paused && (
                      <button
                        type="button"
                        onClick={() => onMarkPaid(rule.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{t.actions.markPaid}</span>
                      </button>
                    )}

                    {!rule.paused && (
                      <button
                        type="button"
                        onClick={() => onOpenCustomSettle(rule)}
                        title={t.actions.customSettle}
                        aria-label={t.actions.customSettle}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onTogglePause(rule.id)}
                      title={rule.paused ? t.actions.resume : t.actions.pause}
                      aria-label={rule.paused ? t.actions.resume : t.actions.pause}
                      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      {rule.paused ? (
                        <Play className="w-4 h-4" />
                      ) : (
                        <Pause className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditRule(rule)}
                      title={t.actions.edit}
                      aria-label={t.actions.edit}
                      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteRule(rule.id)}
                      title={t.actions.delete}
                      aria-label={t.actions.delete}
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Toolbar: Search + Execution Mode + Category Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.filters.searchPlaceholder}
              className="w-full h-10 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div
            role="group"
            aria-label="Modo de pago"
            className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start md:self-auto"
          >
            {(
              [
                { id: 'all', label: t.filters.allMethods },
                { id: 'manual', label: t.filters.manualOnly },
                { id: 'autopay', label: t.filters.autopayOnly },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setModeFilter(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  modeFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {categories.map((cat) => {
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onCategoryFilterChange(cat.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty States */}
      {rules.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            {t.empty.queueTitle}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
            {t.empty.queueBody}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.actions.newPayment}</span>
            </button>
            {onRestoreDemo && (
              <button
                type="button"
                onClick={onRestoreDemo}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                <span>{t.actions.restoreDemo}</span>
              </button>
            )}
          </div>
        </div>
      ) : filteredCount === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            {t.empty.filteredTitle}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
            {t.empty.filteredBody}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              {t.empty.resetFilters}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {renderGroup(t.sections.overdue, overdue, 'overdue')}
          {renderGroup(t.sections.dueWeek, dueWeek, 'dueWeek')}
          {renderGroup(t.sections.upcoming, upcoming, 'upcoming')}
          {renderGroup(t.sections.paused, paused, 'paused')}
        </div>
      )}
    </div>
  );
}
