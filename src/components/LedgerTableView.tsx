import { ArrowDown, ArrowUp, Check, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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

interface LedgerTableViewProps {
  rules: PaymentRule[];
  currency: CurrencyCode;
  language: LanguageCode;
  categoryFilter: PaymentCategory | 'all';
  onCategoryFilterChange: (cat: PaymentCategory | 'all') => void;
  onMarkPaid: (ruleId: string) => void;
  onEditRule: (rule: PaymentRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onCreateNew: () => void;
  onRestoreDemo?: () => void;
}

type SortKey = 'dueDate' | 'title' | 'category' | 'amount';
type StatusFilter = 'all' | 'active' | 'overdue' | 'paused';

export function LedgerTableView({
  rules,
  currency,
  language,
  categoryFilter,
  onCategoryFilterChange,
  onMarkPaid,
  onEditRule,
  onDeleteRule,
  onCreateNew,
  onRestoreDemo,
}: LedgerTableViewProps) {
  const t = TRANSLATIONS[language];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortAsc, setSortAsc] = useState(true);

  const todayISO = getTodayISO();

  const sortedRules = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = rules.filter((rule) => {
      if (categoryFilter !== 'all' && rule.category !== categoryFilter) {
        return false;
      }
      if (statusFilter === 'paused' && !rule.paused) return false;
      if (statusFilter === 'active' && rule.paused) return false;
      if (statusFilter === 'overdue') {
        if (rule.paused || getDaysUntil(rule.dueDate, todayISO) >= 0) {
          return false;
        }
      }
      if (query) {
        const hay = `${rule.title} ${rule.payee} ${rule.reference ?? ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'dueDate':
          cmp = a.dueDate.localeCompare(b.dueDate);
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'category':
          cmp = a.category.localeCompare(b.category);
          break;
        case 'amount':
          cmp = a.amount - b.amount;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return filtered;
  }, [rules, categoryFilter, statusFilter, search, sortKey, sortAsc, todayISO]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortAsc ? (
      <ArrowUp className="w-3.5 h-3.5 inline ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 inline ml-1" />
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.filters.searchPlaceholder}
            className="w-full h-10 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label={t.drawer.categoryLabel}
            value={categoryFilter}
            onChange={(e) =>
              onCategoryFilterChange(e.target.value as PaymentCategory | 'all')
            }
            className="h-9 px-3 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">{t.filters.allCategories}</option>
            <option value="rent">{t.categories.rent}</option>
            <option value="services">{t.categories.services}</option>
            <option value="tuition">{t.categories.tuition}</option>
            <option value="subscriptions">{t.categories.subscriptions}</option>
            <option value="other">{t.categories.other}</option>
          </select>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: t.filters.allStatuses },
                { id: 'active', label: t.filters.activeOnly },
                { id: 'overdue', label: t.filters.overdueOnly },
                { id: 'paused', label: t.filters.pausedOnly },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            {t.empty.queueTitle}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">{t.empty.queueBody}</p>
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
      ) : sortedRules.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            {t.empty.filteredTitle}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">{t.empty.filteredBody}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('title')}
                      className="hover:text-slate-900 cursor-pointer"
                    >
                      {t.table.concept}
                      {renderSortIcon('title')}
                    </button>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('category')}
                      className="hover:text-slate-900 cursor-pointer"
                    >
                      {t.table.categoryCycle}
                      {renderSortIcon('category')}
                    </button>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('dueDate')}
                      className="hover:text-slate-900 cursor-pointer"
                    >
                      {t.table.dueDate}
                      {renderSortIcon('dueDate')}
                    </button>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    {t.table.method}
                  </th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('amount')}
                      className="hover:text-slate-900 cursor-pointer"
                    >
                      {t.table.amount}
                      {renderSortIcon('amount')}
                    </button>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    {t.table.status}
                  </th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">
                    {t.table.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {sortedRules.map((rule) => {
                  const days = getDaysUntil(rule.dueDate, todayISO);
                  let statusLabel = t.status.scheduled;
                  let statusColor = 'text-slate-600';

                  if (rule.paused) {
                    statusLabel = t.status.paused;
                    statusColor = 'text-slate-500';
                  } else if (days < 0) {
                    statusLabel = t.status.overdue;
                    statusColor = 'text-red-600 font-medium';
                  } else if (days <= 7) {
                    statusLabel =
                      days === 0 ? t.status.dueToday : t.status.dueInDays(days);
                    statusColor = 'text-amber-700 font-medium';
                  }

                  return (
                    <tr
                      key={rule.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 min-w-[220px]">
                        <div className="font-medium text-slate-900">
                          {rule.title}
                        </div>
                        <div className="text-xs text-slate-500">
                          {rule.payee}
                          {rule.reference ? ` · ${rule.reference}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                        <div>{t.categories[rule.category]}</div>
                        <div className="text-slate-500">
                          {t.recurrences[rule.recurrence]}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-xs text-slate-700">
                        {formatDisplayDate(rule.dueDate, language)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                        <div>{t.methods[rule.method]}</div>
                        <div className="text-slate-500">
                          {rule.autopay ? t.status.autopay : t.status.manual}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatCurrency(rule.amount, currency, language)}
                      </td>
                      <td
                        className={`py-3 px-4 whitespace-nowrap text-xs ${statusColor}`}
                      >
                        {statusLabel}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          {!rule.paused && (
                            <button
                              type="button"
                              onClick={() => onMarkPaid(rule.id)}
                              title={t.actions.markPaid}
                              aria-label={t.actions.markPaid}
                              className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEditRule(rule)}
                            title={t.actions.edit}
                            aria-label={t.actions.edit}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRule(rule.id)}
                            title={t.actions.delete}
                            aria-label={t.actions.delete}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
