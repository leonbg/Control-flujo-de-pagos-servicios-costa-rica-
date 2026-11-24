import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSeedData } from '../data/seedPayments';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { TRANSLATIONS } from '../i18n/translations';
import type {
  CurrencyCode,
  LanguageCode,
  PaymentLog,
  PaymentRule,
  PaymentSummary,
  UndoSnapshot,
} from '../types/payment';
import { computePaymentSummary } from '../utils/calculations';
import { advanceDateByCycle, getTodayISO } from '../utils/formatters';
import {
  sanitizeId,
  sanitizeLogPayload,
  sanitizeRulePayload,
} from '../utils/validation';

const STORAGE_KEY = 'flujopago:v4';

interface StoredPayload {
  rules: PaymentRule[];
  logs: PaymentLog[];
  currency: CurrencyCode;
  language: LanguageCode;
}

function readLocalPayload(): StoredPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPayload>;
    if (Array.isArray(parsed.rules) && Array.isArray(parsed.logs)) {
      const validCurrency =
        parsed.currency === 'CRC' ||
        parsed.currency === 'USD' ||
        parsed.currency === 'EUR'
          ? parsed.currency
          : 'CRC';
      return {
        rules: parsed.rules,
        logs: parsed.logs,
        currency: validCurrency,
        language: parsed.language ?? 'es',
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function loadInitialLocalState(): StoredPayload {
  const existing = readLocalPayload();
  if (existing) return existing;
  const seed = createSeedData();
  return { ...seed, currency: 'CRC', language: 'es' };
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function mapRuleDoc(id: string, data: DocumentData): PaymentRule {
  return {
    id,
    title: String(data.title ?? ''),
    payee: String(data.payee ?? ''),
    category: data.category ?? 'other',
    amount: Number(data.amount ?? 0),
    dueDate: String(data.dueDate ?? getTodayISO()),
    recurrence: data.recurrence ?? 'monthly',
    method: data.method ?? 'transfer',
    autopay: Boolean(data.autopay),
    paused: Boolean(data.paused),
    reference: typeof data.reference === 'string' ? data.reference : undefined,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    createdAt: getTodayISO(),
  };
}

function mapLogDoc(id: string, data: DocumentData): PaymentLog {
  return {
    id,
    ruleId: typeof data.ruleId === 'string' ? data.ruleId : null,
    title: String(data.title ?? ''),
    payee: String(data.payee ?? ''),
    category: data.category ?? 'other',
    amountPaid: Number(data.amountPaid ?? 0),
    dueDate: String(data.dueDate ?? getTodayISO()),
    paidDate: String(data.paidDate ?? getTodayISO()),
    method: data.method ?? 'transfer',
    notes: typeof data.notes === 'string' ? data.notes : undefined,
  };
}

export function usePaymentStore() {
  const [initialLocal] = useState<StoredPayload>(loadInitialLocalState);
  const [localRules, setLocalRules] = useState<PaymentRule[]>(initialLocal.rules);
  const [localLogs, setLocalLogs] = useState<PaymentLog[]>(initialLocal.logs);
  const [currency, setCurrencyState] = useState<CurrencyCode>(
    initialLocal.currency
  );
  const [language, setLanguageState] = useState<LanguageCode>(
    initialLocal.language
  );

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudRules, setCloudRules] = useState<PaymentRule[]>([]);
  const [cloudLogs, setCloudLogs] = useState<PaymentLog[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);

  const persistTimerRef = useRef<number | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setAuthError(null);
      if (!nextUser) {
        setCloudReady(false);
        setCloudRules([]);
        setCloudLogs([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Initialize user doc and attach real-time Firestore listeners once authenticated
  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;
    let unsubUserDoc: (() => void) | undefined;
    let unsubRules: (() => void) | undefined;
    let unsubLogs: (() => void) | undefined;

    const uid = user.uid;
    const userDocPath = `users/${uid}`;
    const rulesPath = `users/${uid}/rules`;
    const logsPath = `users/${uid}/logs`;

    async function setupUserSync() {
      setCloudReady(false);
      const userRef = doc(db, 'users', uid);

      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            uid,
            currency,
            language,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, userDocPath);
      }

      if (cancelled) return;

      let gotSettings = false;
      let gotRules = false;
      let gotLogs = false;

      const markReadyIfLoaded = () => {
        if (gotSettings && gotRules && gotLogs && !cancelled) {
          setCloudReady(true);
        }
      };

      unsubUserDoc = onSnapshot(
        userRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (
              data.currency === 'CRC' ||
              data.currency === 'USD' ||
              data.currency === 'EUR'
            ) {
              setCurrencyState(data.currency);
            } else {
              setCurrencyState('CRC');
            }
            if (data.language === 'es' || data.language === 'en') {
              setLanguageState(data.language);
            }
          }
          gotSettings = true;
          markReadyIfLoaded();
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, userDocPath);
        }
      );

      const rulesQuery = query(
        collection(db, 'users', uid, 'rules'),
        where('ownerId', '==', uid)
      );
      unsubRules = onSnapshot(
        rulesQuery,
        (snapshot) => {
          const next = snapshot.docs.map((d) => mapRuleDoc(d.id, d.data()));
          setCloudRules(next);
          gotRules = true;
          markReadyIfLoaded();
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, rulesPath);
        }
      );

      const logsQuery = query(
        collection(db, 'users', uid, 'logs'),
        where('ownerId', '==', uid)
      );
      unsubLogs = onSnapshot(
        logsQuery,
        (snapshot) => {
          const next = snapshot.docs.map((d) => mapLogDoc(d.id, d.data()));
          setCloudLogs(next);
          gotLogs = true;
          markReadyIfLoaded();
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, logsPath);
        }
      );
    }

    void setupUserSync();

    return () => {
      cancelled = true;
      unsubUserDoc?.();
      unsubRules?.();
      unsubLogs?.();
    };
    // Intentionally sync only when auth user identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user?.uid]);

  // Debounced localStorage persistence while in local mode
  useEffect(() => {
    if (typeof window === 'undefined' || user) return;
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      try {
        const payload: StoredPayload = {
          rules: localRules,
          logs: localLogs,
          currency,
          language,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Ignore storage quota errors
      }
    }, 150);

    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, [user, localRules, localLogs, currency, language]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const rules = user ? cloudRules : localRules;
  const logs = user ? cloudLogs : localLogs;

  const pushUndo = useCallback(
    (label: string, prevRules: PaymentRule[], prevLogs: PaymentLog[]) => {
      setUndoSnapshot({ label, rules: prevRules, logs: prevLogs });
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
      undoTimerRef.current = window.setTimeout(() => {
        setUndoSnapshot(null);
      }, 6500);
    },
    []
  );

  const dismissUndo = useCallback(() => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }
    setUndoSnapshot(null);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const t = TRANSLATIONS[language];
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (code === 'auth/popup-blocked') {
        setAuthError(t.account.popupBlocked);
      } else if (code !== 'auth/popup-closed-by-user') {
        setAuthError(t.account.authErrorGeneric);
      }
    } finally {
      setSigningIn(false);
    }
  }, [language]);

  const signOutUser = useCallback(async () => {
    setUndoSnapshot(null);
    await signOut(auth);
  }, []);

  const setCurrency = useCallback(
    async (nextCurrency: CurrencyCode) => {
      setCurrencyState(nextCurrency);
      if (user) {
        const path = `users/${user.uid}`;
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            currency: nextCurrency,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [user]
  );

  const setLanguage = useCallback(
    async (nextLanguage: LanguageCode) => {
      setLanguageState(nextLanguage);
      if (user) {
        const path = `users/${user.uid}`;
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            language: nextLanguage,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [user]
  );

  const summary: PaymentSummary = useMemo(
    () => computePaymentSummary(rules, logs),
    [rules, logs]
  );

  const upsertRule = useCallback(
    async (input: Omit<PaymentRule, 'id' | 'createdAt'> & { id?: string }) => {
      if (!user) {
        if (input.id) {
          setLocalRules((prev) =>
            prev.map((item) =>
              item.id === input.id ? { ...item, ...input, id: item.id } : item
            )
          );
        } else {
          const newRule: PaymentRule = {
            ...input,
            id: createId('rule'),
            createdAt: getTodayISO(),
          };
          setLocalRules((prev) => [newRule, ...prev]);
        }
        return;
      }

      const uid = user.uid;
      const ruleId = input.id ? sanitizeId(input.id, 'rule') : createId('rule');
      const path = `users/${uid}/rules/${ruleId}`;
      const payload = sanitizeRulePayload(input, uid);

      try {
        if (input.id) {
          await updateDoc(doc(db, 'users', uid, 'rules', ruleId), {
            ...payload,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'users', uid, 'rules', ruleId), {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(
          err,
          input.id ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    },
    [user]
  );

  const addRulesBulk = useCallback(
    async (inputs: Array<Omit<PaymentRule, 'id' | 'createdAt'>>) => {
      if (inputs.length === 0) return 0;
      pushUndo(
        language === 'es'
          ? `Importación (${inputs.length})`
          : `Import (${inputs.length})`,
        rules,
        logs
      );

      if (!user) {
        const createdAt = getTodayISO();
        const created: PaymentRule[] = inputs.map((item) => ({
          ...item,
          id: createId('rule'),
          createdAt,
        }));
        setLocalRules((prev) => [...created, ...prev]);
        return created.length;
      }

      const uid = user.uid;
      setSyncError(null);
      try {
        for (let i = 0; i < inputs.length; i += 400) {
          const chunk = inputs.slice(i, i + 400);
          const batch = writeBatch(db);
          for (const item of chunk) {
            const ruleId = createId('rule');
            batch.set(doc(db, 'users', uid, 'rules', ruleId), {
              ...sanitizeRulePayload(item, uid),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }
        return inputs.length;
      } catch (err) {
        setSyncError(
          err instanceof Error ? err.message : 'Error al importar obligaciones.'
        );
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/rules`);
      }
    },
    [user, rules, logs, language, pushUndo]
  );

  const togglePauseRule = useCallback(
    async (ruleId: string) => {
      const target = rules.find((r) => r.id === ruleId);
      if (!target) return;

      if (!user) {
        setLocalRules((prev) =>
          prev.map((item) =>
            item.id === ruleId ? { ...item, paused: !item.paused } : item
          )
        );
        return;
      }

      const path = `users/${user.uid}/rules/${ruleId}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'rules', ruleId), {
          paused: !target.paused,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user, rules]
  );

  const deleteRule = useCallback(
    async (ruleId: string) => {
      const target = rules.find((r) => r.id === ruleId);
      if (!target) return;
      pushUndo(target.title, rules, logs);

      if (!user) {
        setLocalRules((prev) => prev.filter((r) => r.id !== ruleId));
        return;
      }

      const path = `users/${user.uid}/rules/${ruleId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'rules', ruleId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user, rules, logs, pushUndo]
  );

  const markAsPaid = useCallback(
    async (
      ruleId: string,
      options?: { amountPaid?: number; paidDate?: string; notes?: string }
    ) => {
      const target = rules.find((r) => r.id === ruleId);
      if (!target) return;

      pushUndo(target.title, rules, logs);

      const newLogId = createId('log');
      const newLog: PaymentLog = {
        id: newLogId,
        ruleId: target.id,
        title: target.title,
        payee: target.payee,
        category: target.category,
        amountPaid: options?.amountPaid ?? target.amount,
        dueDate: target.dueDate,
        paidDate: options?.paidDate ?? getTodayISO(),
        method: target.method,
        notes: options?.notes ?? target.notes,
      };

      const nextDueDate = advanceDateByCycle(target.dueDate, target.recurrence);

      if (!user) {
        setLocalLogs((prev) => [newLog, ...prev]);
        if (nextDueDate) {
          setLocalRules((prev) =>
            prev.map((r) =>
              r.id === ruleId ? { ...r, dueDate: nextDueDate } : r
            )
          );
        } else {
          setLocalRules((prev) => prev.filter((r) => r.id !== ruleId));
        }
        return;
      }

      const uid = user.uid;
      const batch = writeBatch(db);
      const logRef = doc(db, 'users', uid, 'logs', newLogId);
      batch.set(logRef, {
        ...sanitizeLogPayload(newLog, uid),
        createdAt: serverTimestamp(),
      });

      const ruleRef = doc(db, 'users', uid, 'rules', ruleId);
      if (nextDueDate) {
        batch.update(ruleRef, {
          dueDate: nextDueDate,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.delete(ruleRef);
      }

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/logs/${newLogId}`);
      }
    },
    [user, rules, logs, pushUndo]
  );

  const deleteLog = useCallback(
    async (logId: string) => {
      const target = logs.find((l) => l.id === logId);
      if (!target) return;
      pushUndo(target.title, rules, logs);

      if (!user) {
        setLocalLogs((prev) => prev.filter((l) => l.id !== logId));
        return;
      }

      const path = `users/${user.uid}/logs/${logId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'logs', logId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user, rules, logs, pushUndo]
  );

  const replaceCloudWorkspace = useCallback(
    async (uid: string, nextRules: PaymentRule[], nextLogs: PaymentLog[]) => {
      setSyncError(null);
      type BatchOp = (batch: ReturnType<typeof writeBatch>) => void;
      const deleteOps: BatchOp[] = [];
      const createOps: BatchOp[] = [];

      for (const r of cloudRules) {
        deleteOps.push((b) => b.delete(doc(db, 'users', uid, 'rules', r.id)));
      }
      for (const l of cloudLogs) {
        deleteOps.push((b) => b.delete(doc(db, 'users', uid, 'logs', l.id)));
      }
      for (const r of nextRules) {
        const safeId = sanitizeId(r.id, 'rule');
        createOps.push((b) =>
          b.set(doc(db, 'users', uid, 'rules', safeId), {
            ...sanitizeRulePayload(r, uid),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
      for (const l of nextLogs) {
        const safeId = sanitizeId(l.id, 'log');
        createOps.push((b) =>
          b.set(doc(db, 'users', uid, 'logs', safeId), {
            ...sanitizeLogPayload(l, uid),
            createdAt: serverTimestamp(),
          })
        );
      }

      try {
        for (let i = 0; i < deleteOps.length; i += 400) {
          const chunk = deleteOps.slice(i, i + 400);
          const batch = writeBatch(db);
          for (const op of chunk) op(batch);
          await batch.commit();
        }
        for (let i = 0; i < createOps.length; i += 400) {
          const chunk = createOps.slice(i, i + 400);
          const batch = writeBatch(db);
          for (const op of chunk) op(batch);
          await batch.commit();
        }
      } catch (err) {
        setSyncError(
          err instanceof Error ? err.message : 'Error al sincronizar datos.'
        );
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      }
    },
    [cloudRules, cloudLogs]
  );

  const undoLastAction = useCallback(async () => {
    if (!undoSnapshot) return;
    const prevRules = undoSnapshot.rules;
    const prevLogs = undoSnapshot.logs;
    dismissUndo();

    if (!user) {
      setLocalRules(prevRules);
      setLocalLogs(prevLogs);
      return;
    }

    const uid = user.uid;
    const batch = writeBatch(db);
    const currentRuleMap = new Map(cloudRules.map((r) => [r.id, r]));
    const prevRuleMap = new Map(prevRules.map((r) => [r.id, r]));

    for (const r of cloudRules) {
      if (!prevRuleMap.has(r.id)) {
        batch.delete(doc(db, 'users', uid, 'rules', r.id));
      }
    }
    for (const r of prevRules) {
      const safeId = sanitizeId(r.id, 'rule');
      const cur = currentRuleMap.get(r.id);
      if (!cur) {
        batch.set(doc(db, 'users', uid, 'rules', safeId), {
          ...sanitizeRulePayload(r, uid),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (
        cur.dueDate !== r.dueDate ||
        cur.paused !== r.paused ||
        cur.amount !== r.amount ||
        cur.title !== r.title
      ) {
        batch.update(doc(db, 'users', uid, 'rules', safeId), {
          ...sanitizeRulePayload(r, uid),
          updatedAt: serverTimestamp(),
        });
      }
    }

    const prevLogMap = new Map(prevLogs.map((l) => [l.id, l]));
    const currentLogMap = new Map(cloudLogs.map((l) => [l.id, l]));

    for (const l of cloudLogs) {
      if (!prevLogMap.has(l.id)) {
        batch.delete(doc(db, 'users', uid, 'logs', l.id));
      }
    }
    for (const l of prevLogs) {
      if (!currentLogMap.has(l.id)) {
        const safeId = sanitizeId(l.id, 'log');
        batch.set(doc(db, 'users', uid, 'logs', safeId), {
          ...sanitizeLogPayload(l, uid),
          createdAt: serverTimestamp(),
        });
      }
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
    }
  }, [undoSnapshot, dismissUndo, user, cloudRules, cloudLogs]);

  const restoreDemoData = useCallback(async () => {
    pushUndo(language === 'es' ? 'Datos anteriores' : 'Previous data', rules, logs);
    const seed = createSeedData();
    await setCurrency('CRC');
    if (!user) {
      setLocalRules(seed.rules);
      setLocalLogs(seed.logs);
      return;
    }
    await replaceCloudWorkspace(user.uid, seed.rules, seed.logs);
  }, [rules, logs, language, pushUndo, user, setCurrency, replaceCloudWorkspace]);

  const hasLegacySampleData = useMemo(() => {
    const legacyMarkers = [
      'Comisión Federal de Electricidad',
      'Instituto Tecnológico del Valle',
      'Totalplay Residencial',
      'Sistema de Aguas Municipal',
      'Gas Metropolitano',
      'Administración Residencial Alameda',
      'Administradora Inmobiliaria Escalante',
      'Universidad Latina de Costa Rica',
      'Centro Cultural Costarricense Norteamericano',
      'Condominio Torres de la Sabana',
      'Workspace Cloud',
    ];
    return (
      rules.some((r) => legacyMarkers.includes(r.payee)) ||
      logs.some((l) => legacyMarkers.includes(l.payee))
    );
  }, [rules, logs]);

  const clearAllData = useCallback(async () => {
    pushUndo(language === 'es' ? 'Datos anteriores' : 'Previous data', rules, logs);
    if (!user) {
      setLocalRules([]);
      setLocalLogs([]);
      return;
    }
    await replaceCloudWorkspace(user.uid, [], []);
  }, [rules, logs, language, pushUndo, user, replaceCloudWorkspace]);

  const importLocalToCloud = useCallback(async () => {
    if (!user) return;
    await replaceCloudWorkspace(user.uid, localRules, localLogs);
  }, [user, localRules, localLogs, replaceCloudWorkspace]);

  return {
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
    localRecordCount: localRules.length + localLogs.length,
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
  };
}
