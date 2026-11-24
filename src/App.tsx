import {
  CalendarDays,
  Cloud,
  Clock,
  History,
  LogIn,
  LogOut,
  Menu,
  Plus,
  RotateCcw,
  Table2,
  Upload,
  X,
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { lazy, Suspense, useState } from 'react';
import { FlowQueueView } from './components/FlowQueueView';
import { LedgerTableView } from './components/LedgerTableView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { type DrawerState, PaymentDrawer } from './components/PaymentDrawer';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SummaryStrip } from './components/SummaryStrip';
import { usePaymentStore } from './hooks/usePaymentStore';
import { TRANSLATIONS } from './i18n/translations';
import type {
  AppView,
  CurrencyCode,
  LanguageCode,
  PaymentCategory,
} from './types/payment';
import { formatCurrency } from './utils/formatters';

const CalendarView = lazy(() => import('./components/CalendarView'));
const HistoryView = lazy(() => import('./components/HistoryView'));
const ImportView = lazy(() => import('./components/ImportView'));

function ViewSkeleton() {
  return (
    <div
      aria-busy="true"
      className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
    >
      <div className="h-5 w-48 bg-slate-100 rounded animate-pulse" />
      <div className="h-11 bg-slate-100 rounded animate-pulse" />
      <div className="h-11 bg-slate-100 rounded animate-pulse" />
      <div className="h-11 bg-slate-100 rounded animate-pulse" />
    </div>
  );
}

export default function App() {
  const {
    user,
    authReady,
    cloudReady,
    authError,
    syncError,
    signingIn,
    signInWithGoogle,
    signOutUser,
    rules,
    logs,
    localRecordCount,
    hasLegacySampleData,
    importLocalToCloud,
    currency,
    setCurrency,
    language,
    setLanguage,
    summary,
    undoSnapshot,
    undoLastAction,
    dismissUndo,
    upsertRule,
    addRulesBulk,
    togglePauseRule,
    deleteRule,
    markAsPaid,
    deleteLog,
    restoreDemoData,
    clearAllData,
  } = usePaymentStore();

  const [activeView, setActiveView] = useState<AppView>('queue');
  const [categoryFilter, setCategoryFilter] = useState<PaymentCategory | 'all'>(
    'all'
  );
  const [drawerState, setDrawerState] = useState<DrawerState>({
    mode: 'closed',
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const t = TRANSLATIONS[language];

  const navItems: Array<{
    id: AppView;
    label: string;
    icon: typeof Clock;
    count?: number;
  }> = [
    {
      id: 'queue',
      label: t.nav.queue,
      icon: Clock,
      count: summary.overdueCount + summary.dueSoonCount,
    },
    {
      id: 'ledger',
      label: t.nav.ledger,
      icon: Table2,
      count: rules.length,
    },
    { id: 'calendar', label: t.nav.calendar, icon: CalendarDays },
    { id: 'history', label: t.nav.history, icon: History, count: logs.length },
    { id: 'import', label: t.nav.import, icon: Upload },
  ];

  const categoriesList: PaymentCategory[] = [
    'rent',
    'tuition',
    'services',
    'subscriptions',
    'other',
  ];

  const currentViewLabel =
    navItems.find((n) => n.id === activeView)?.label ?? t.nav.queue;

  const handleSelectCategory = (cat: PaymentCategory) => {
    setCategoryFilter((prev) => (prev === cat ? 'all' : cat));
    if (
      activeView === 'calendar' ||
      activeView === 'history' ||
      activeView === 'import'
    ) {
      setActiveView('queue');
    }
    setMobileMenuOpen(false);
  };

  const userInitial = (
    user?.displayName?.[0] ||
    user?.email?.[0] ||
    'U'
  ).toUpperCase();

  const isWaitingForCloud = Boolean(user && !cloudReady);

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-white overflow-y-auto">
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between px-2 pt-1">
          <span className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0">
            {t.brand}
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav aria-label="Navegación principal" className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveView(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-blue-700' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span className="text-xs font-mono tabular-nums text-slate-500 ml-2">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-slate-200 space-y-2">
          <div className="px-2 text-xs font-medium text-slate-500">
            {t.nav.categoriesHeading}
          </div>
          <ul className="space-y-1">
            {categoriesList.map((cat) => {
              const selected =
                categoryFilter === cat &&
                (activeView === 'queue' || activeView === 'ledger');
              const amount = summary.categoryTotals[cat];
              return (
                <li key={cat}>
                  <button
                    type="button"
                    onClick={() => handleSelectCategory(cat)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-colors cursor-pointer ${
                      selected
                        ? 'bg-blue-50 text-blue-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="truncate">{t.categories[cat]}</span>
                    <span className="font-mono tabular-nums text-slate-500 ml-2 shrink-0">
                      {formatCurrency(amount, currency, language)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 space-y-3 bg-slate-50/60">
        {/* Account Sync Section */}
        <div className="pb-3 border-b border-slate-200">
          {user ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL && !avatarFailed ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName ?? user.email ?? 'Cuenta'}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold shrink-0">
                    {userInitial}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {user.displayName ?? user.email}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                    <Cloud className="w-3 h-3 text-green-600 shrink-0" />
                    <span className="truncate">
                      {cloudReady ? t.account.cloudSynced : t.account.syncing}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.account.signOut}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                disabled={!authReady || signingIn}
                onClick={() => void signInWithGoogle()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-700" />
                <span>{t.account.signInGoogle}</span>
              </button>
              {authError && (
                <p className="text-[11px] text-red-600 leading-snug">
                  {authError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              {t.preferences.currency}
            </label>
            <select
              aria-label={t.preferences.currency}
              value={currency}
              onChange={(e) => void setCurrency(e.target.value as CurrencyCode)}
              className="w-full h-8 px-2 text-xs font-mono bg-white border border-slate-200 rounded-md text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="CRC">CRC (₡)</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              {t.preferences.language}
            </label>
            <select
              aria-label={t.preferences.language}
              value={language}
              onChange={(e) => void setLanguage(e.target.value as LanguageCode)}
              className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              void restoreDemoData();
              setConfirmClear(false);
              setMobileMenuOpen(false);
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 shrink-0" />
            <span>{t.actions.restoreDemo}</span>
          </button>

          {confirmClear ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  void clearAllData();
                  setConfirmClear(false);
                }}
                className="px-2 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md cursor-pointer"
              >
                {t.actions.delete}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-2 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                {t.actions.cancel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:text-red-600 hover:border-red-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              {t.actions.clearAll}
            </button>
          )}
        </div>

        <PWAInstallButton language={language} variant="sidebar" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200 bg-white sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex">
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/35"
            />
            <m.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-72 max-w-[85vw] h-full border-r border-slate-200 bg-white"
            >
              {sidebarContent}
            </m.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir navegación"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-semibold text-slate-900 font-display whitespace-nowrap shrink-0 lg:hidden">
                {t.brand}
              </span>
              <span aria-hidden="true" className="text-slate-300 lg:hidden">
                /
              </span>
              <h1 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                {currentViewLabel}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDrawerState({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span>{t.actions.newPayment}</span>
          </button>
        </header>

        <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Cloud Sync Callout when Signed Out */}
          {authReady && !user && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {t.account.localModeTitle}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {t.account.localModeBody}
                </p>
              </div>
              <button
                type="button"
                disabled={signingIn}
                onClick={() => void signInWithGoogle()}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-700" />
                <span>{t.account.signInGoogle}</span>
              </button>
            </div>
          )}

          {/* Legacy Example Refresh Banner (for accounts seeded before Costa Rica update) */}
          {hasLegacySampleData && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {language === 'es'
                    ? 'Hay ejemplos anteriores guardados en esta cuenta'
                    : 'Previous sample records are still stored in this account'}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {language === 'es'
                    ? 'Reemplázalos con instituciones y servicios reales de Costa Rica (CNFL, AyA, Kölbi, Liberty, UCR, Colegio La Salle, INS).'
                    : 'Replace them with real Costa Rican institutions and utilities (CNFL, AyA, Kölbi, Liberty, UCR, Colegio La Salle, INS).'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void restoreDemoData()}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {language === 'es'
                    ? 'Actualizar a ejemplos de Costa Rica'
                    : 'Update to Costa Rica examples'}
                </span>
              </button>
            </div>
          )}

          {syncError && (
            <div className="bg-white border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
              {syncError}
            </div>
          )}

          {/* Optional Local-to-Cloud Migration Banner on Empty New Account */}
          {user &&
            cloudReady &&
            rules.length === 0 &&
            logs.length === 0 &&
            localRecordCount > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  {t.account.importLocalBtn(localRecordCount)}
                </div>
                <button
                  type="button"
                  onClick={() => void importLocalToCloud()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t.account.importLocalBtn(localRecordCount)}</span>
                </button>
              </div>
            )}

          <SummaryStrip
            summary={summary}
            currency={currency}
            language={language}
          />

          {isWaitingForCloud ? (
            <ViewSkeleton />
          ) : (
            <>
              {activeView === 'queue' && (
                <FlowQueueView
                  rules={rules}
                  currency={currency}
                  language={language}
                  categoryFilter={categoryFilter}
                  onCategoryFilterChange={setCategoryFilter}
                  onMarkPaid={(ruleId) => void markAsPaid(ruleId)}
                  onOpenCustomSettle={(rule) =>
                    setDrawerState({ mode: 'settle', rule })
                  }
                  onEditRule={(rule) => setDrawerState({ mode: 'edit', rule })}
                  onDeleteRule={(ruleId) => void deleteRule(ruleId)}
                  onTogglePause={(ruleId) => void togglePauseRule(ruleId)}
                  onCreateNew={() => setDrawerState({ mode: 'create' })}
                  onRestoreDemo={() => void restoreDemoData()}
                />
              )}

              {activeView === 'ledger' && (
                <LedgerTableView
                  rules={rules}
                  currency={currency}
                  language={language}
                  categoryFilter={categoryFilter}
                  onCategoryFilterChange={setCategoryFilter}
                  onMarkPaid={(ruleId) => void markAsPaid(ruleId)}
                  onEditRule={(rule) => setDrawerState({ mode: 'edit', rule })}
                  onDeleteRule={(ruleId) => void deleteRule(ruleId)}
                  onCreateNew={() => setDrawerState({ mode: 'create' })}
                  onRestoreDemo={() => void restoreDemoData()}
                />
              )}

              {activeView === 'calendar' && (
                <Suspense fallback={<ViewSkeleton />}>
                  <CalendarView
                    rules={rules}
                    currency={currency}
                    language={language}
                    subDrawerOpen={drawerState.mode !== 'closed'}
                    onMarkPaid={(ruleId) => void markAsPaid(ruleId)}
                    onOpenCustomSettle={(rule) =>
                      setDrawerState({ mode: 'settle', rule })
                    }
                    onEditRule={(rule) => setDrawerState({ mode: 'edit', rule })}
                    onCreateForDate={(isoDate) =>
                      setDrawerState({ mode: 'create', initialDate: isoDate })
                    }
                  />
                </Suspense>
              )}

              {activeView === 'history' && (
                <Suspense fallback={<ViewSkeleton />}>
                  <HistoryView
                    logs={logs}
                    currency={currency}
                    language={language}
                    onDeleteLog={(logId) => void deleteLog(logId)}
                  />
                </Suspense>
              )}

              {activeView === 'import' && (
                <Suspense fallback={<ViewSkeleton />}>
                  <ImportView
                    currency={currency}
                    language={language}
                    onImportBulk={addRulesBulk}
                    onNavigateQueue={() => setActiveView('queue')}
                  />
                </Suspense>
              )}
            </>
          )}
        </main>
      </div>

      {/* Slide-Over Payment Drawer */}
      <PaymentDrawer
        state={drawerState}
        language={language}
        onClose={() => setDrawerState({ mode: 'closed' })}
        onSaveRule={(input) => void upsertRule(input)}
        onConfirmSettle={(ruleId, opts) => void markAsPaid(ruleId, opts)}
      />

      {/* Undo Toast */}
      <AnimatePresence>
        {undoSnapshot && (
          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-5 right-5 z-40 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-4 text-sm max-w-sm"
          >
            <span className="truncate">{undoSnapshot.label}</span>
            <button
              type="button"
              onClick={() => void undoLastAction()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:text-blue-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.actions.undo}</span>
            </button>
            <button
              type="button"
              onClick={dismissUndo}
              aria-label={t.actions.cancel}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </m.div>
        )}
      </AnimatePresence>
      <OfflineIndicator language={language} />
    </div>
  );
}
