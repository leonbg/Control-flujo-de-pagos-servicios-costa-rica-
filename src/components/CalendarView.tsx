import {
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { TRANSLATIONS } from '../i18n/translations';
import type { CurrencyCode, LanguageCode, PaymentRule } from '../types/payment';
import {
  addDaysISO,
  advanceDateByCycle,
  formatCurrency,
  formatDisplayDate,
  getDaysUntil,
  getTodayISO,
  parseLocalDate,
  toISODateLocal,
} from '../utils/formatters';

interface CalendarViewProps {
  rules: PaymentRule[];
  currency: CurrencyCode;
  language: LanguageCode;
  subDrawerOpen?: boolean;
  onMarkPaid: (ruleId: string) => void;
  onOpenCustomSettle?: (rule: PaymentRule) => void;
  onEditRule: (rule: PaymentRule) => void;
  onCreateForDate: (isoDate: string) => void;
}

type CalendarViewMode = 'month' | 'week' | 'day';

interface ProjectedOccurrence {
  rule: PaymentRule;
  date: string;
  isExactDueDate: boolean;
}

function getMondayOfISO(isoDate: string): string {
  const date = parseLocalDate(isoDate);
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDaysISO(isoDate, -mondayOffset);
}

function getOccurrencesInRange(
  rules: PaymentRule[],
  startISO: string,
  endISO: string
): Map<string, ProjectedOccurrence[]> {
  const map = new Map<string, ProjectedOccurrence[]>();

  for (const rule of rules) {
    if (rule.paused) continue;

    let current: string | null = rule.dueDate;
    let guard = 0;

    while (current && current <= endISO && guard < 180) {
      guard += 1;
      if (current >= startISO && current <= endISO) {
        const existing = map.get(current) ?? [];
        existing.push({
          rule,
          date: current,
          isExactDueDate: current === rule.dueDate,
        });
        map.set(current, existing);
      }
      current = advanceDateByCycle(current, rule.recurrence);
    }
  }

  return map;
}

export default function CalendarView({
  rules,
  currency,
  language,
  subDrawerOpen = false,
  onMarkPaid,
  onOpenCustomSettle,
  onEditRule,
  onCreateForDate,
}: CalendarViewProps) {
  const t = TRANSLATIONS[language];
  const todayISO = getTodayISO();

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDayISO, setSelectedDayISO] = useState<string>(todayISO);
  const [dayDrawerOpen, setDayDrawerOpen] = useState(false);

  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
  const monthLabel = formatDisplayDate(`${monthPrefix}-01`, language, 'monthYear');

  // Week range (Monday to Sunday) anchored on selectedDayISO
  const weekStartISO = useMemo(
    () => getMondayOfISO(selectedDayISO),
    [selectedDayISO]
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i)),
    [weekStartISO]
  );
  const weekEndISO = weekDays[6];

  useEffect(() => {
    if (!dayDrawerOpen || subDrawerOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDayDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dayDrawerOpen, subDrawerOpen]);

  // Monthly occurrences + weekly breakdown
  const { monthDayMap, weeklyTotals, maxWeekTotal, monthTotal } = useMemo(() => {
    const monthStart = `${monthPrefix}-01`;
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const monthEnd = `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`;

    const map = getOccurrencesInRange(rules, monthStart, monthEnd);
    const weeks = [0, 0, 0, 0, 0];
    let total = 0;

    for (const [iso, occurrences] of map.entries()) {
      const dayNum = Number(iso.slice(8, 10));
      const weekIdx = Math.min(4, Math.floor((dayNum - 1) / 7));
      for (const occ of occurrences) {
        weeks[weekIdx] += occ.rule.amount;
        total += occ.rule.amount;
      }
    }

    const maxWeek = Math.max(1, ...weeks);
    return {
      monthDayMap: map,
      weeklyTotals: weeks,
      maxWeekTotal: maxWeek,
      monthTotal: total,
    };
  }, [rules, cursor.year, cursor.month, monthPrefix]);

  // Weekly occurrences (handles cross-month and cross-year weeks cleanly)
  const { weekDayMap, weekTotal, weekMaxDayTotal, pendingBeforeWeek } =
    useMemo(() => {
      const map = getOccurrencesInRange(rules, weekStartISO, weekEndISO);
      let total = 0;
      let maxDay = 1;

      const scheduledInWeekIds = new Set<string>();
      for (const dayISO of weekDays) {
        const occs = map.get(dayISO) ?? [];
        const daySum = occs.reduce((s, o) => s + o.rule.amount, 0);
        total += daySum;
        if (daySum > maxDay) maxDay = daySum;
        for (const occ of occs) {
          scheduledInWeekIds.add(occ.rule.id);
        }
      }

      const priorPending = rules
        .filter(
          (rule) =>
            !rule.paused &&
            rule.dueDate < weekStartISO &&
            !scheduledInWeekIds.has(rule.id)
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      return {
        weekDayMap: map,
        weekTotal: total,
        weekMaxDayTotal: maxDay,
        pendingBeforeWeek: priorPending,
      };
    }, [rules, weekStartISO, weekEndISO, weekDays]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(cursor.year, cursor.month, 1);
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;

    const cells: Array<{ iso: string | null; dayNumber: number | null }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ iso: null, dayNumber: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toISODateLocal(new Date(cursor.year, cursor.month, d));
      cells.push({ iso, dayNumber: d });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ iso: null, dayNumber: null });
    }
    return cells;
  }, [cursor.year, cursor.month]);

  const syncCursorToISO = (isoDate: string) => {
    const date = parseLocalDate(isoDate);
    setCursor({ year: date.getFullYear(), month: date.getMonth() });
  };

  const handleSelectViewMode = (mode: CalendarViewMode) => {
    setViewMode(mode);
    if (mode === 'day') {
      setDayDrawerOpen(false);
    }
    if (mode === 'week' || mode === 'day') {
      const selectedPrefix = selectedDayISO.slice(0, 7);
      if (selectedPrefix !== monthPrefix) {
        const nextFocus =
          todayISO.slice(0, 7) === monthPrefix ? todayISO : `${monthPrefix}-01`;
        setSelectedDayISO(nextFocus);
      }
    } else {
      syncCursorToISO(selectedDayISO);
    }
  };

  const shiftPeriod = (delta: number) => {
    if (viewMode === 'month') {
      setCursor((prev) => {
        const next = new Date(prev.year, prev.month + delta, 1);
        return { year: next.getFullYear(), month: next.getMonth() };
      });
    } else if (viewMode === 'week') {
      const nextISO = addDaysISO(selectedDayISO, delta * 7);
      setSelectedDayISO(nextISO);
      syncCursorToISO(nextISO);
    } else {
      const nextISO = addDaysISO(selectedDayISO, delta);
      setSelectedDayISO(nextISO);
      syncCursorToISO(nextISO);
    }
  };

  const jumpToToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDayISO(todayISO);
    if (viewMode === 'month') {
      setDayDrawerOpen(true);
    }
  };

  const openDayDrawer = (isoDate: string) => {
    setSelectedDayISO(isoDate);
    syncCursorToISO(isoDate);
    setDayDrawerOpen(true);
  };

  const openFullDayView = (isoDate: string) => {
    setSelectedDayISO(isoDate);
    syncCursorToISO(isoDate);
    setDayDrawerOpen(false);
    setViewMode('day');
  };

  const openMonthWeekBar = (weekIdx: number) => {
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const targetDay = Math.min(daysInMonth, weekIdx * 7 + 1);
    const targetISO = `${monthPrefix}-${String(targetDay).padStart(2, '0')}`;
    setSelectedDayISO(targetISO);
    setDayDrawerOpen(false);
    setViewMode('week');
  };

  const shiftSelectedDay = (delta: number) => {
    const nextISO = addDaysISO(selectedDayISO, delta);
    setSelectedDayISO(nextISO);
    syncCursorToISO(nextISO);
  };

  // Exact day occurrences for selectedDayISO (works in any month/year)
  const selectedItems = useMemo(() => {
    if (selectedDayISO >= weekStartISO && selectedDayISO <= weekEndISO) {
      return weekDayMap.get(selectedDayISO) ?? [];
    }
    if (selectedDayISO.slice(0, 7) === monthPrefix) {
      return monthDayMap.get(selectedDayISO) ?? [];
    }
    const singleMap = getOccurrencesInRange(rules, selectedDayISO, selectedDayISO);
    return singleMap.get(selectedDayISO) ?? [];
  }, [
    monthDayMap,
    monthPrefix,
    rules,
    selectedDayISO,
    weekDayMap,
    weekEndISO,
    weekStartISO,
  ]);

  const earlierPendingRules = useMemo(() => {
    const onDayIds = new Set(selectedItems.map((item) => item.rule.id));
    return rules
      .filter(
        (rule) =>
          !rule.paused &&
          rule.dueDate < selectedDayISO &&
          !onDayIds.has(rule.id)
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [rules, selectedDayISO, selectedItems]);

  const selectedDayTotal = selectedItems.reduce(
    (sum, item) => sum + item.rule.amount,
    0
  );
  const earlierPendingTotal = earlierPendingRules.reduce(
    (sum, rule) => sum + rule.amount,
    0
  );
  const accumulatedPendingCount =
    selectedItems.length + earlierPendingRules.length;
  const accumulatedPendingTotal = selectedDayTotal + earlierPendingTotal;
  const pendingBeforeWeekTotal = pendingBeforeWeek.reduce(
    (sum, rule) => sum + rule.amount,
    0
  );

  const getStatusPresentation = (dueDate: string) => {
    const days = getDaysUntil(dueDate, todayISO);
    if (days < 0) {
      return {
        label: t.status.overdueByDays(Math.abs(days)),
        className: 'text-red-600 font-medium',
        isOverdue: true,
      };
    }
    if (days === 0) {
      return {
        label: t.status.dueToday,
        className: 'text-amber-700 font-medium',
        isOverdue: false,
      };
    }
    if (days <= 7) {
      return {
        label: t.status.dueInDays(days),
        className: 'text-amber-700 font-medium',
        isOverdue: false,
      };
    }
    return {
      label: t.status.scheduled,
      className: 'text-slate-600',
      isOverdue: false,
    };
  };

  const weekRangeLabel = `${formatDisplayDate(
    weekStartISO,
    language,
    'weekdayShort'
  )} – ${formatDisplayDate(weekEndISO, language, 'weekdayShort')}`;

  const headerTitle =
    viewMode === 'month'
      ? monthLabel
      : viewMode === 'week'
        ? weekRangeLabel
        : formatDisplayDate(selectedDayISO, language, 'weekdayLong');

  const headerAmount =
    viewMode === 'month'
      ? monthTotal
      : viewMode === 'week'
        ? weekTotal
        : selectedDayTotal;

  const headerHint =
    viewMode === 'month'
      ? t.calendar.tapDayHint
      : viewMode === 'week'
        ? t.calendar.tapWeekHint
        : t.calendar.tapDayViewHint;

  const prevAriaLabel =
    viewMode === 'month'
      ? t.actions.prevMonth
      : viewMode === 'week'
        ? t.calendar.prevWeek
        : t.calendar.prevDay;

  const nextAriaLabel =
    viewMode === 'month'
      ? t.actions.nextMonth
      : viewMode === 'week'
        ? t.calendar.nextWeek
        : t.calendar.nextDay;

  const renderOccurrenceRow = (
    { rule, date, isExactDueDate }: ProjectedOccurrence,
    compact = false
  ) => {
    const status = getStatusPresentation(date);
    return (
      <li
        key={`${rule.id}:${date}`}
        className={`${compact ? 'px-4 sm:px-5 py-3.5' : 'px-5 py-4'} space-y-2.5 hover:bg-slate-50/60 transition-colors`}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onEditRule(rule)}
            className="min-w-0 flex-1 text-left group cursor-pointer"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                {rule.title}
              </span>
              <span className="text-xs text-slate-500">{rule.payee}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span>{t.categories[rule.category]}</span>
              <span aria-hidden="true">·</span>
              <span>{t.recurrences[rule.recurrence]}</span>
              <span aria-hidden="true">·</span>
              <span>{t.methods[rule.method]}</span>
              <span aria-hidden="true">·</span>
              <span>{rule.autopay ? t.status.autopay : t.status.manual}</span>
              {rule.reference && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{rule.reference}</span>
                </>
              )}
            </div>
          </button>

          <div className="text-right shrink-0">
            <div className="text-sm font-semibold font-mono tabular-nums text-slate-900">
              {formatCurrency(rule.amount, currency, language)}
            </div>
            {isExactDueDate && (
              <div
                className={`text-[11px] flex items-center justify-end gap-1 mt-0.5 ${status.className}`}
              >
                {status.isOverdue && (
                  <AlertCircle className="w-3 h-3 shrink-0" />
                )}
                <span>{status.label}</span>
              </div>
            )}
          </div>
        </div>

        {!isExactDueDate && (
          <p className="text-xs text-slate-500">
            {t.calendar.projectedNote(formatDisplayDate(rule.dueDate, language))}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {isExactDueDate && (
            <button
              type="button"
              onClick={() => onMarkPaid(rule.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t.actions.markPaid}</span>
            </button>
          )}

          {isExactDueDate && onOpenCustomSettle && (
            <button
              type="button"
              onClick={() => onOpenCustomSettle(rule)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{t.actions.customSettle}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onEditRule(rule)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>{t.actions.edit}</span>
          </button>
        </div>
      </li>
    );
  };

  const renderPendingRuleRow = (rule: PaymentRule) => {
    const status = getStatusPresentation(rule.dueDate);
    return (
      <li
        key={rule.id}
        className="px-5 py-4 space-y-2.5 hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onEditRule(rule)}
            className="min-w-0 flex-1 text-left group cursor-pointer"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                {rule.title}
              </span>
              <span className="text-xs text-slate-500">{rule.payee}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="font-mono tabular-nums text-slate-700 font-medium">
                {formatDisplayDate(rule.dueDate, language)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{t.categories[rule.category]}</span>
              <span aria-hidden="true">·</span>
              <span>{t.methods[rule.method]}</span>
              <span aria-hidden="true">·</span>
              <span>{rule.autopay ? t.status.autopay : t.status.manual}</span>
            </div>
          </button>

          <div className="text-right shrink-0">
            <div className="text-sm font-semibold font-mono tabular-nums text-slate-900">
              {formatCurrency(rule.amount, currency, language)}
            </div>
            <div
              className={`text-[11px] flex items-center justify-end gap-1 mt-0.5 ${status.className}`}
            >
              {status.isOverdue ? (
                <AlertCircle className="w-3 h-3 shrink-0" />
              ) : (
                <Clock className="w-3 h-3 shrink-0" />
              )}
              <span>{status.label}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => onMarkPaid(rule.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t.actions.markPaid}</span>
          </button>

          {onOpenCustomSettle && (
            <button
              type="button"
              onClick={() => onOpenCustomSettle(rule)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{t.actions.customSettle}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onEditRule(rule)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>{t.actions.edit}</span>
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      {/* Unified Calendar Controls + Mode Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 capitalize truncate">
              {headerTitle}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-mono tabular-nums text-slate-700 font-medium">
                {formatCurrency(headerAmount, currency, language)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{headerHint}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* View Mode Segmented Switcher */}
            <div
              role="group"
              aria-label={t.nav.calendar}
              className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
            >
              {(
                [
                  { id: 'month', label: t.calendar.viewMonth },
                  { id: 'week', label: t.calendar.viewWeek },
                  { id: 'day', label: t.calendar.viewDay },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectViewMode(opt.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    viewMode === opt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Period Navigation */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftPeriod(-1)}
                aria-label={prevAriaLabel}
                title={prevAriaLabel}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={jumpToToday}
                className="px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t.actions.today}
              </button>
              <button
                type="button"
                onClick={() => shiftPeriod(1)}
                aria-label={nextAriaLabel}
                title={nextAriaLabel}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Monthly Weekly-Load Bars (clickable to open each week) */}
        {viewMode === 'month' && (
          <div className="pt-3 border-t border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-2.5">
              {t.calendar.weeklyLoadTitle}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {weeklyTotals.map((weekSum, idx) => {
                const pct = Math.round((weekSum / maxWeekTotal) * 100);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => openMonthWeekBar(idx)}
                    title={t.calendar.openWeekAction}
                    className="text-left p-2 -m-1 rounded-lg hover:bg-slate-50 transition-colors space-y-1.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-700 group"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-600 group-hover:text-blue-700 font-medium transition-colors whitespace-nowrap">
                        {t.calendar.weekLabel(idx + 1)}
                      </span>
                      <span className="font-mono tabular-nums text-slate-800 font-medium truncate">
                        {formatCurrency(weekSum, currency, language)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-700 transition-[width] duration-200"
                        style={{
                          width: `${weekSum > 0 ? Math.max(6, pct) : 0}%`,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Interactive 7-Day Strip (shared for Weekly & Daily views) */}
        {(viewMode === 'week' || viewMode === 'day') && (
          <div className="pt-3 border-t border-slate-200">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {weekDays.map((dayISO, idx) => {
                const occs = weekDayMap.get(dayISO) ?? [];
                const daySum = occs.reduce((s, o) => s + o.rule.amount, 0);
                const pct = Math.round((daySum / weekMaxDayTotal) * 100);
                const dayNumber = Number(dayISO.slice(8, 10));
                const isToday = dayISO === todayISO;
                const isSelected = dayISO === selectedDayISO;
                const hasOverdueExact = occs.some(
                  (o) => o.isExactDueDate && o.date < todayISO
                );

                return (
                  <button
                    key={dayISO}
                    type="button"
                    onClick={() => {
                      if (viewMode === 'day') {
                        setSelectedDayISO(dayISO);
                        syncCursorToISO(dayISO);
                      } else {
                        openDayDrawer(dayISO);
                      }
                    }}
                    className={`p-2 sm:p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex flex-col justify-between gap-1.5 focus-visible:outline-2 focus-visible:outline-blue-700 ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-600'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-medium text-slate-500">
                        {t.calendar.weekdays[idx]}
                      </span>
                      {occs.length > 0 && (
                        <span
                          className={`text-[11px] font-mono tabular-nums ${
                            hasOverdueExact
                              ? 'text-red-600 font-semibold'
                              : 'text-slate-500'
                          }`}
                        >
                          {occs.length}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between gap-1">
                      <span
                        className={`text-xs sm:text-sm font-mono tabular-nums ${
                          isToday
                            ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-700 text-white font-semibold'
                            : isSelected
                              ? 'text-blue-700 font-semibold'
                              : 'text-slate-900 font-medium'
                        }`}
                      >
                        {dayNumber}
                      </span>
                    </div>

                    <div className="space-y-1 w-full">
                      <div
                        className={`hidden sm:block text-[11px] font-mono tabular-nums truncate ${
                          daySum > 0
                            ? hasOverdueExact
                              ? 'text-red-700 font-semibold'
                              : 'text-slate-800 font-medium'
                            : 'text-slate-400'
                        }`}
                      >
                        {daySum > 0
                          ? formatCurrency(daySum, currency, language)
                          : '—'}
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-[width] duration-200 ${
                            hasOverdueExact ? 'bg-red-600' : 'bg-blue-700'
                          }`}
                          style={{
                            width: `${daySum > 0 ? Math.max(10, pct) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MONTHLY VIEW */}
      {viewMode === 'month' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {t.calendar.weekdays.map((dayName) => (
              <div
                key={dayName}
                className="py-2.5 px-2 text-center text-xs font-medium text-slate-500"
              >
                {dayName}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
            {calendarCells.map((cell, idx) => {
              if (!cell.iso || !cell.dayNumber) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[86px] sm:min-h-[110px] bg-slate-50/40"
                  />
                );
              }

              const occurrences = monthDayMap.get(cell.iso) ?? [];
              const daySum = occurrences.reduce(
                (sum, o) => sum + o.rule.amount,
                0
              );
              const hasOverdueExact = occurrences.some(
                (o) => o.isExactDueDate && o.date < todayISO
              );
              const isToday = cell.iso === todayISO;
              const isSelected = dayDrawerOpen && cell.iso === selectedDayISO;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => openDayDrawer(cell.iso!)}
                  aria-label={`${formatDisplayDate(cell.iso, language, 'weekdayLong')}${
                    occurrences.length > 0
                      ? ` · ${occurrences.length} · ${formatCurrency(daySum, currency, language)}`
                      : ''
                  }`}
                  className={`min-h-[86px] sm:min-h-[110px] p-2 sm:p-2.5 text-left flex flex-col justify-between transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-700 ${
                    isSelected
                      ? 'bg-blue-50/80 ring-1 ring-inset ring-blue-600'
                      : 'bg-white hover:bg-slate-50/90'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        isToday
                          ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-700 text-white font-semibold'
                          : isSelected
                            ? 'text-blue-700 font-semibold'
                            : 'text-slate-700'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {occurrences.length > 0 && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-mono tabular-nums ${
                          hasOverdueExact
                            ? 'text-red-600 font-semibold'
                            : 'text-slate-500'
                        }`}
                      >
                        {hasOverdueExact && (
                          <AlertCircle className="w-3 h-3 shrink-0" />
                        )}
                        <span>{occurrences.length}</span>
                      </span>
                    )}
                  </div>

                  {occurrences.length > 0 && (
                    <div className="mt-1.5 space-y-0.5 w-full">
                      <div
                        className={`text-[11px] sm:text-xs font-mono tabular-nums font-semibold truncate ${
                          hasOverdueExact ? 'text-red-700' : 'text-slate-900'
                        }`}
                      >
                        {formatCurrency(daySum, currency, language)}
                      </div>
                      <div className="hidden sm:block text-[11px] text-slate-600 truncate">
                        {occurrences[0].rule.title}
                      </div>
                      {occurrences.length > 1 && (
                        <div className="hidden md:block text-[11px] text-slate-500 truncate">
                          {occurrences.length === 2
                            ? occurrences[1].rule.title
                            : t.calendar.moreCount(occurrences.length - 1)}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEKLY INTERACTIVE VIEW */}
      {viewMode === 'week' && (
        <div className="space-y-5">
          {pendingBeforeWeek.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 sm:px-5 py-3 bg-slate-50/70 border-b border-slate-200 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {t.calendar.pendingBeforeWeekTitle} (
                      {pendingBeforeWeek.length})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.calendar.pendingBeforeWeekHint}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-800 whitespace-nowrap shrink-0">
                  {formatCurrency(pendingBeforeWeekTotal, currency, language)}
                </span>
              </div>
              <ul className="divide-y divide-slate-200">
                {pendingBeforeWeek.map((rule) => renderPendingRuleRow(rule))}
              </ul>
            </div>
          )}

          {/* Day-by-Day Interactive Week Agenda */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
            {weekDays.map((dayISO) => {
              const occs = weekDayMap.get(dayISO) ?? [];
              const daySum = occs.reduce((s, o) => s + o.rule.amount, 0);
              const isToday = dayISO === todayISO;
              const isSelected = dayISO === selectedDayISO;

              return (
                <section key={dayISO}>
                  <div
                    className={`px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200/80 ${
                      isSelected ? 'bg-blue-50/50' : 'bg-slate-50/70'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => openDayDrawer(dayISO)}
                      className="flex items-center gap-2.5 min-w-0 text-left group cursor-pointer"
                    >
                      <span
                        className={`text-sm font-semibold capitalize group-hover:text-blue-700 transition-colors ${
                          isToday ? 'text-blue-700' : 'text-slate-900'
                        }`}
                      >
                        {formatDisplayDate(dayISO, language, 'weekdayLong')}
                      </span>
                      {isToday && (
                        <span className="text-xs font-medium text-blue-700">
                          · {t.actions.today}
                        </span>
                      )}
                      {occs.length > 0 && (
                        <span className="text-xs font-mono tabular-nums text-slate-500">
                          ({occs.length})
                        </span>
                      )}
                    </button>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                      {daySum > 0 && (
                        <span className="text-xs font-mono tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                          {formatCurrency(daySum, currency, language)}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => openFullDayView(dayISO)}
                        className="text-xs font-medium text-slate-600 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {t.calendar.openFullDayView}
                      </button>

                      <button
                        type="button"
                        onClick={() => onCreateForDate(dayISO)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-white border border-slate-200 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t.calendar.addShort}</span>
                      </button>
                    </div>
                  </div>

                  {occs.length > 0 ? (
                    <ul className="divide-y divide-slate-200">
                      {occs.map((occ) => renderOccurrenceRow(occ, true))}
                    </ul>
                  ) : (
                    <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>{t.calendar.noPaymentsDayShort}</span>
                      <button
                        type="button"
                        onClick={() => openDayDrawer(dayISO)}
                        className="font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {t.calendar.viewPendingByDate}
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* DAILY INTERACTIVE VIEW */}
      {viewMode === 'day' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-5 min-w-0">
              <div>
                <div className="text-[11px] text-slate-500">
                  {t.calendar.dayTotalLabel} ({selectedItems.length})
                </div>
                <div className="text-sm font-semibold font-mono tabular-nums text-slate-900">
                  {formatCurrency(selectedDayTotal, currency, language)}
                </div>
              </div>
              <div className="pl-5 border-l border-slate-200">
                <div className="text-[11px] text-slate-500">
                  {t.calendar.accumulatedTotalLabel} ({accumulatedPendingCount})
                </div>
                <div className="text-sm font-semibold font-mono tabular-nums text-blue-700">
                  {formatCurrency(accumulatedPendingTotal, currency, language)}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onCreateForDate(selectedDayISO)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.calendar.addForDay}</span>
            </button>
          </div>

          {selectedItems.length === 0 && earlierPendingRules.length === 0 ? (
            <div className="p-10 text-center space-y-4">
              <CalendarPlus className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm text-slate-600 max-w-xs mx-auto">
                {t.calendar.noPaymentsDay}
              </p>
              <button
                type="button"
                onClick={() => onCreateForDate(selectedDayISO)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.calendar.addForDay}</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {selectedItems.length > 0 && (
                <section>
                  <div className="px-5 py-2.5 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between gap-3">
                    <h3 className="text-xs font-semibold text-slate-800">
                      {t.calendar.dueOnDayTitle} ({selectedItems.length})
                    </h3>
                    <span className="text-xs font-mono tabular-nums font-medium text-slate-700">
                      {formatCurrency(selectedDayTotal, currency, language)}
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-200">
                    {selectedItems.map((occ) => renderOccurrenceRow(occ))}
                  </ul>
                </section>
              )}

              {earlierPendingRules.length > 0 && (
                <section>
                  <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-200 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-800">
                        {t.calendar.pendingByDateTitle} (
                        {earlierPendingRules.length})
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t.calendar.pendingByDateHint}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-medium text-slate-700 whitespace-nowrap shrink-0">
                      {formatCurrency(earlierPendingTotal, currency, language)}
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-200">
                    {earlierPendingRules.map((rule) =>
                      renderPendingRuleRow(rule)
                    )}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* Interactive Day Payments Slide-Over Drawer (used from Monthly & Weekly views) */}
      <AnimatePresence>
        {dayDrawerOpen && (
          <div
            className="fixed inset-0 z-40 flex justify-end"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-day-drawer-heading"
          >
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setDayDrawerOpen(false)}
              className="fixed inset-0 bg-slate-900/35"
            />

            <m.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-lg bg-white h-full border-l border-slate-200 flex flex-col"
            >
              {/* Drawer Header */}
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3
                    id="calendar-day-drawer-heading"
                    className="text-base font-semibold text-slate-900 capitalize truncate"
                  >
                    {formatDisplayDate(selectedDayISO, language, 'weekdayLong')}
                  </h3>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openFullDayView(selectedDayISO)}
                    title={t.calendar.openFullDayView}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {t.calendar.openFullDayView}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftSelectedDay(-1)}
                    aria-label={t.calendar.prevDay}
                    title={t.calendar.prevDay}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftSelectedDay(1)}
                    aria-label={t.calendar.nextDay}
                    title={t.calendar.nextDay}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDayDrawerOpen(false)}
                    aria-label={t.calendar.closeDrawer}
                    className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Drawer Summary + Schedule CTA */}
              <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-5 min-w-0">
                  <div>
                    <div className="text-[11px] text-slate-500">
                      {t.calendar.dayTotalLabel} ({selectedItems.length})
                    </div>
                    <div className="text-sm font-semibold font-mono tabular-nums text-slate-900">
                      {formatCurrency(selectedDayTotal, currency, language)}
                    </div>
                  </div>
                  <div className="pl-5 border-l border-slate-200">
                    <div className="text-[11px] text-slate-500">
                      {t.calendar.accumulatedTotalLabel} (
                      {accumulatedPendingCount})
                    </div>
                    <div className="text-sm font-semibold font-mono tabular-nums text-blue-700">
                      {formatCurrency(
                        accumulatedPendingTotal,
                        currency,
                        language
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onCreateForDate(selectedDayISO)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.calendar.addForDay}</span>
                </button>
              </div>

              {/* Scrollable Pending Payments Body */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
                {selectedItems.length === 0 &&
                earlierPendingRules.length === 0 ? (
                  <div className="p-10 text-center space-y-4">
                    <CalendarPlus className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-sm text-slate-600 max-w-xs mx-auto">
                      {t.calendar.noPaymentsDay}
                    </p>
                    <button
                      type="button"
                      onClick={() => onCreateForDate(selectedDayISO)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.calendar.addForDay}</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {selectedItems.length > 0 && (
                      <section>
                        <div className="px-5 py-2.5 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between gap-3">
                          <h4 className="text-xs font-semibold text-slate-800">
                            {t.calendar.dueOnDayTitle} ({selectedItems.length})
                          </h4>
                          <span className="text-xs font-mono tabular-nums font-medium text-slate-700">
                            {formatCurrency(
                              selectedDayTotal,
                              currency,
                              language
                            )}
                          </span>
                        </div>

                        <ul className="divide-y divide-slate-200">
                          {selectedItems.map((occ) => renderOccurrenceRow(occ))}
                        </ul>
                      </section>
                    )}

                    {earlierPendingRules.length > 0 && (
                      <section>
                        <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-200 flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-xs font-semibold text-slate-800">
                              {t.calendar.pendingByDateTitle} (
                              {earlierPendingRules.length})
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {t.calendar.pendingByDateHint}
                            </p>
                          </div>
                          <span className="text-xs font-mono tabular-nums font-medium text-slate-700 whitespace-nowrap shrink-0">
                            {formatCurrency(
                              earlierPendingTotal,
                              currency,
                              language
                            )}
                          </span>
                        </div>

                        <ul className="divide-y divide-slate-200">
                          {earlierPendingRules.map((rule) =>
                            renderPendingRuleRow(rule)
                          )}
                        </ul>
                      </section>
                    )}
                  </>
                )}
              </div>
            </m.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
