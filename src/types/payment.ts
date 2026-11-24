export type PaymentCategory =
  | 'rent'
  | 'tuition'
  | 'services'
  | 'subscriptions'
  | 'other';

export type RecurrenceCycle =
  | 'one_time'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semester'
  | 'annual';

export type PaymentMethod =
  | 'transfer'
  | 'credit_card'
  | 'debit_card'
  | 'cash'
  | 'direct_debit';

export type CurrencyCode = 'CRC' | 'USD' | 'EUR';
export type LanguageCode = 'es' | 'en';

export type AppView = 'queue' | 'ledger' | 'calendar' | 'history' | 'import';

export interface PaymentRule {
  id: string;
  title: string;
  payee: string;
  category: PaymentCategory;
  amount: number;
  dueDate: string; // YYYY-MM-DD (local date)
  recurrence: RecurrenceCycle;
  method: PaymentMethod;
  autopay: boolean;
  reference?: string;
  notes?: string;
  paused?: boolean;
  createdAt: string;
}

export interface PaymentLog {
  id: string;
  ruleId: string | null;
  title: string;
  payee: string;
  category: PaymentCategory;
  amountPaid: number;
  dueDate: string; // YYYY-MM-DD
  paidDate: string; // YYYY-MM-DD
  method: PaymentMethod;
  notes?: string;
}

export interface PaymentSummary {
  overdueTotal: number;
  overdueCount: number;
  dueSoonTotal: number; // within 0..7 days
  dueSoonCount: number;
  remainingMonthTotal: number;
  remainingMonthCount: number;
  paidMonthTotal: number;
  paidMonthCount: number;
  monthlyBaseline: number;
  monthCompletionPct: number;
  categoryTotals: Record<PaymentCategory, number>;
  categoryCounts: Record<PaymentCategory, number>;
}

export interface UndoSnapshot {
  label: string;
  rules: PaymentRule[];
  logs: PaymentLog[];
}
