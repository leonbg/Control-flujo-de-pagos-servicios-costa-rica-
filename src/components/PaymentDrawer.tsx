import { X } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useState } from 'react';
import { TRANSLATIONS } from '../i18n/translations';
import type {
  LanguageCode,
  PaymentCategory,
  PaymentMethod,
  PaymentRule,
  RecurrenceCycle,
} from '../types/payment';
import { advanceDateByCycle, getTodayISO } from '../utils/formatters';

export type DrawerState =
  | { mode: 'closed' }
  | { mode: 'create'; initialDate?: string }
  | { mode: 'edit'; rule: PaymentRule }
  | { mode: 'settle'; rule: PaymentRule };

interface PaymentDrawerProps {
  state: DrawerState;
  language: LanguageCode;
  onClose: () => void;
  onSaveRule: (
    input: Omit<PaymentRule, 'id' | 'createdAt'> & { id?: string }
  ) => void;
  onConfirmSettle: (
    ruleId: string,
    options: { amountPaid: number; paidDate: string; notes?: string }
  ) => void;
}

export function PaymentDrawer({
  state,
  language,
  onClose,
  onSaveRule,
  onConfirmSettle,
}: PaymentDrawerProps) {
  const t = TRANSLATIONS[language];
  const isOpen = state.mode !== 'closed';

  const [title, setTitle] = useState('');
  const [payee, setPayee] = useState('');
  const [category, setCategory] = useState<PaymentCategory>('services');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(getTodayISO());
  const [recurrence, setRecurrence] = useState<RecurrenceCycle>('monthly');
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [autopay, setAutopay] = useState(false);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [paused, setPaused] = useState(false);

  // Settle mode fields
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState(getTodayISO());
  const [settleNotes, setSettleNotes] = useState('');

  useEffect(() => {
    if (state.mode === 'create') {
      setTitle('');
      setPayee('');
      setCategory('services');
      setAmount('');
      setDueDate(state.initialDate ?? getTodayISO());
      setRecurrence('monthly');
      setMethod('transfer');
      setAutopay(false);
      setReference('');
      setNotes('');
      setPaused(false);
    } else if (state.mode === 'edit') {
      const r = state.rule;
      setTitle(r.title);
      setPayee(r.payee);
      setCategory(r.category);
      setAmount(String(r.amount));
      setDueDate(r.dueDate);
      setRecurrence(r.recurrence);
      setMethod(r.method);
      setAutopay(r.autopay);
      setReference(r.reference ?? '');
      setNotes(r.notes ?? '');
      setPaused(Boolean(r.paused));
    } else if (state.mode === 'settle') {
      const r = state.rule;
      setSettleAmount(String(r.amount));
      setSettleDate(getTodayISO());
      setSettleNotes(r.notes ?? '');
    }
  }, [state]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!title.trim() || !payee.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return;
    }

    onSaveRule({
      id: state.mode === 'edit' ? state.rule.id : undefined,
      title: title.trim(),
      payee: payee.trim(),
      category,
      amount: numericAmount,
      dueDate,
      recurrence,
      method,
      autopay,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      paused,
    });
    onClose();
  };

  const handleSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (state.mode !== 'settle') return;
    const numericAmount = Number(settleAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;

    onConfirmSettle(state.rule.id, {
      amountPaid: numericAmount,
      paidDate: settleDate,
      notes: settleNotes.trim() || undefined,
    });
    onClose();
  };

  const heading =
    state.mode === 'edit'
      ? t.drawer.editTitle
      : state.mode === 'settle'
        ? t.drawer.settleTitle
        : t.drawer.createTitle;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-heading"
        >
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/35"
          />

          <m.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <h2
                id="drawer-heading"
                className="text-base font-semibold text-slate-900"
              >
                {heading}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.actions.cancel}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {state.mode === 'settle' ? (
              <form
                onSubmit={handleSettleSubmit}
                className="flex-1 overflow-y-auto p-5 flex flex-col justify-between gap-6"
              >
                <div className="space-y-4">
                  <div className="pb-3 border-b border-slate-200">
                    <div className="text-sm font-semibold text-slate-900">
                      {state.rule.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {state.rule.payee} · {t.methods[state.rule.method]}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {t.drawer.settleAmountLabel}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="100000000"
                      required
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                      className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {t.drawer.settleDateLabel}
                    </label>
                    <input
                      type="date"
                      required
                      value={settleDate}
                      onChange={(e) => setSettleDate(e.target.value)}
                      className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {t.drawer.notesLabel}
                    </label>
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={settleNotes}
                      onChange={(e) => setSettleNotes(e.target.value)}
                      placeholder={t.drawer.notesPlaceholder}
                      className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none resize-none"
                    />
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
                    {t.drawer.advanceNote(
                      advanceDateByCycle(
                        state.rule.dueDate,
                        state.rule.recurrence
                      )
                    )}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                  >
                    {t.actions.cancel}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
                  >
                    {t.drawer.confirmSettle}
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={handleRuleSubmit}
                className="flex-1 overflow-y-auto p-5 flex flex-col justify-between gap-6"
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {t.drawer.conceptLabel}
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t.drawer.conceptPlaceholder}
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {t.drawer.payeeLabel}
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={payee}
                      onChange={(e) => setPayee(e.target.value)}
                      placeholder={t.drawer.payeePlaceholder}
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        {t.drawer.categoryLabel}
                      </label>
                      <select
                        value={category}
                        onChange={(e) =>
                          setCategory(e.target.value as PaymentCategory)
                        }
                        className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                      >
                        <option value="rent">{t.categories.rent}</option>
                        <option value="tuition">{t.categories.tuition}</option>
                        <option value="services">{t.categories.services}</option>
                        <option value="subscriptions">
                          {t.categories.subscriptions}
                        </option>
                        <option value="other">{t.categories.other}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        {t.drawer.amountLabel}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="100000000"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        {t.drawer.dueDateLabel}
                      </label>
                      <input
                        type="date"
                        required
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        {t.drawer.recurrenceLabel}
                      </label>
                      <select
                        value={recurrence}
                        onChange={(e) =>
                          setRecurrence(e.target.value as RecurrenceCycle)
                        }
                        className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                      >
                        <option value="monthly">{t.recurrences.monthly}</option>
                        <option value="bimonthly">
                          {t.recurrences.bimonthly}
                        </option>
                        <option value="quarterly">
                          {t.recurrences.quarterly}
                        </option>
                        <option value="semester">
                          {t.recurrences.semester}
                        </option>
                        <option value="annual">{t.recurrences.annual}</option>
                        <option value="one_time">
                          {t.recurrences.one_time}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {t.drawer.methodLabel}
                    </label>
                    <select
                      value={method}
                      onChange={(e) =>
                        setMethod(e.target.value as PaymentMethod)
                      }
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                    >
                      <option value="transfer">{t.methods.transfer}</option>
                      <option value="debit_card">{t.methods.debit_card}</option>
                      <option value="credit_card">
                        {t.methods.credit_card}
                      </option>
                      <option value="direct_debit">
                        {t.methods.direct_debit}
                      </option>
                      <option value="cash">{t.methods.cash}</option>
                    </select>
                  </div>

                  <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autopay}
                      onChange={(e) => setAutopay(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-blue-700 rounded cursor-pointer"
                    />
                    <span className="text-xs">
                      <span className="block font-medium text-slate-900">
                        {t.drawer.autopayLabel}
                      </span>
                      <span className="block text-slate-500 mt-0.5">
                        {t.drawer.autopayHint}
                      </span>
                    </span>
                  </label>

                  {state.mode === 'edit' && (
                    <label className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paused}
                        onChange={(e) => setPaused(e.target.checked)}
                        className="w-4 h-4 accent-blue-700 rounded cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-800">
                        {t.drawer.pausedLabel}
                      </span>
                    </label>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {t.drawer.referenceLabel}
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder={t.drawer.referencePlaceholder}
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {t.drawer.notesLabel}
                    </label>
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t.drawer.notesPlaceholder}
                      className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                  >
                    {t.actions.cancel}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
                  >
                    {t.actions.save}
                  </button>
                </div>
              </form>
            )}
          </m.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
