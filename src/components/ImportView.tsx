import {
  Camera,
  Check,
  Download,
  FileSpreadsheet,
  ImageUp,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TRANSLATIONS } from '../i18n/translations';
import type {
  CurrencyCode,
  LanguageCode,
  PaymentCategory,
  PaymentMethod,
  PaymentRule,
  RecurrenceCycle,
} from '../types/payment';
import { formatCurrency, getTodayISO } from '../utils/formatters';
import {
  captureVideoFrame,
  compressImageForUpload,
  downloadTemplateExcel,
  type ImportedDraft,
  normalizeExtractedItems,
  parseDelimitedText,
  parseSpreadsheetFile,
} from '../utils/importParsers';

interface ImportViewProps {
  currency: CurrencyCode;
  language: LanguageCode;
  onImportBulk: (
    rules: Array<Omit<PaymentRule, 'id' | 'createdAt'>>
  ) => Promise<number>;
  onNavigateQueue: () => void;
}

type ImportTab = 'file' | 'photo';

export default function ImportView({
  currency,
  language,
  onImportBulk,
  onNavigateQueue,
}: ImportViewProps) {
  const t = TRANSLATIONS[language];
  const [tab, setTab] = useState<ImportTab>('file');
  const [pastedText, setPastedText] = useState('');
  const [drafts, setDrafts] = useState<ImportedDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Live camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment'
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  useEffect(() => {
    if (tab !== 'photo') {
      stopCameraStream();
    }
  }, [tab, stopCameraStream]);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

  const startCamera = async (requestedMode: 'environment' | 'user' = facingMode) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg(t.importer.cameraUnavailable);
      return;
    }

    stopCameraStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: requestedMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setFacingMode(requestedMode);
      setCameraOpen(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setErrorMsg(t.importer.cameraDenied);
      } else {
        setErrorMsg(t.importer.cameraUnavailable);
      }
    }
  };

  const handleSwitchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    void startCamera(nextMode);
  };

  const extractViaServer = async (payload: {
    text?: string;
    imageBase64?: string;
    mimeType?: string;
  }) => {
    const res = await fetch('/api/extract-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, todayISO: getTodayISO() }),
    });
    const data = (await res.json()) as { items?: unknown[]; error?: string };
    if (!res.ok) {
      throw new Error(data.error || 'Error al analizar los datos.');
    }
    return normalizeExtractedItems(data.items ?? []);
  };

  const handleCaptureFromCamera = async () => {
    if (!videoRef.current) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
      const { base64, mimeType, previewUrl } = captureVideoFrame(videoRef.current);
      setPhotoPreview(previewUrl);
      stopCameraStream();

      const parsed = await extractViaServer({ imageBase64: base64, mimeType });
      if (parsed.length === 0) {
        setErrorMsg(t.importer.noRowsError);
      } else {
        setDrafts(parsed);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.importer.noRowsError);
    } finally {
      setLoading(false);
    }
  };

  const handleSpreadsheetUpload = async (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      let parsed = await parseSpreadsheetFile(file);
      if (parsed.length === 0 && file.name.toLowerCase().endsWith('.txt')) {
        const text = await file.text();
        if (text.trim()) {
          parsed = await extractViaServer({ text });
        }
      }
      if (parsed.length === 0) {
        setErrorMsg(t.importer.noRowsError);
      } else {
        setDrafts(parsed);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.importer.noRowsError);
    } finally {
      setLoading(false);
    }
  };

  const handleParseText = async () => {
    const trimmed = pastedText.trim();
    if (!trimmed) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      let parsed = parseDelimitedText(trimmed);
      if (parsed.length === 0) {
        parsed = await extractViaServer({ text: trimmed });
      }
      if (parsed.length === 0) {
        setErrorMsg(t.importer.noRowsError);
      } else {
        setDrafts(parsed);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.importer.noRowsError);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    stopCameraStream();
    try {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
      const { base64, mimeType, previewUrl } = await compressImageForUpload(file);
      setPhotoPreview(previewUrl);
      const parsed = await extractViaServer({ imageBase64: base64, mimeType });
      if (parsed.length === 0) {
        setErrorMsg(t.importer.noRowsError);
      } else {
        setDrafts(parsed);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.importer.noRowsError);
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (tempId: string, patch: Partial<ImportedDraft>) => {
    setDrafts((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, ...patch } : row))
    );
  };

  const removeDraft = (tempId: string) => {
    setDrafts((prev) => prev.filter((row) => row.tempId !== tempId));
  };

  const selectedDrafts = drafts.filter(
    (d) => d.selected && d.title.trim() && d.amount > 0
  );

  const toggleAll = () => {
    const allSelected = drafts.every((d) => d.selected);
    setDrafts((prev) => prev.map((d) => ({ ...d, selected: !allSelected })));
  };

  const handleConfirmImport = async () => {
    if (selectedDrafts.length === 0) return;
    setImporting(true);
    setErrorMsg(null);
    try {
      const payload = selectedDrafts.map(
        ({ tempId: _t, selected: _s, ...rule }) => rule
      );
      const count = await onImportBulk(payload);
      setDrafts([]);
      setPastedText('');
      setSuccessMsg(t.importer.importedSuccess(count));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudieron guardar los pagos.'
      );
    } finally {
      setImporting(false);
    }
  };

  const totalPreviewAmount = selectedDrafts.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-5">
      {/* Mode Switch + Template Action */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTab('file')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'file'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t.importer.tabFile}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('photo')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'photo'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{t.importer.tabPhoto}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => void downloadTemplateExcel()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t.importer.downloadTemplate}</span>
        </button>
      </div>

      {/* Upload / Live Camera Area */}
      {tab === 'file' ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void handleSpreadsheetUpload(f);
            }}
            className="border border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50/50 space-y-3"
          >
            <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {t.importer.dropFileTitle}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
                {t.importer.dropFileHint}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt,.tsv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleSpreadsheetUpload(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t.importer.chooseFile}</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2.5">
            <label className="block text-xs font-medium text-slate-700">
              {t.importer.pasteLabel}
            </label>
            <textarea
              rows={4}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={t.importer.pastePlaceholder}
              className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={loading || !pastedText.trim()}
                onClick={() => void handleParseText()}
                className="px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {t.importer.parseTextBtn}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          {cameraOpen ? (
            <div className="space-y-3">
              <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-200 aspect-video max-h-[420px] w-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSwitchCamera}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t.importer.switchCamera}</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCameraStream}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{t.importer.closeCamera}</span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleCaptureFromCamera()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{t.importer.capturePhoto}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50/50 space-y-3">
              <Camera className="w-8 h-8 text-slate-400 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {t.importer.dropPhotoTitle}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
                  {t.importer.dropPhotoHint}
                </p>
              </div>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePhotoUpload(f);
                  e.target.value = '';
                }}
              />

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void startCamera('environment')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{t.importer.openCamera}</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => photoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  <ImageUp className="w-3.5 h-3.5" />
                  <span>{t.importer.choosePhoto}</span>
                </button>
              </div>
            </div>
          )}

          {photoPreview && !cameraOpen && (
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 bg-slate-50 flex items-center justify-center">
              <img
                src={photoPreview}
                alt="Vista previa de tabla o recibo"
                referrerPolicy="no-referrer"
                className="max-h-60 object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* Status Messages */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 text-sm text-slate-700">
          <Loader2 className="w-4 h-4 animate-spin text-blue-700 shrink-0" />
          <span>{t.importer.analyzing}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-white border border-red-200 rounded-xl p-4 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="bg-white border border-green-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-sm font-medium text-green-800">{successMsg}</span>
          <button
            type="button"
            onClick={onNavigateQueue}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors self-start sm:self-auto cursor-pointer"
          >
            {t.nav.queue}
          </button>
        </div>
      )}

      {/* Editable Preview Table */}
      {drafts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {t.importer.previewTitle(drafts.length)}
              </h2>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
              >
                {t.importer.selectAll}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono tabular-nums font-semibold text-slate-700">
                {formatCurrency(totalPreviewAmount, currency, language)}
              </span>
              <button
                type="button"
                onClick={() => setDrafts([])}
                className="text-xs text-slate-500 hover:text-red-600 cursor-pointer"
              >
                {t.importer.clearPreview}
              </button>
              <button
                type="button"
                disabled={importing || selectedDrafts.length === 0}
                onClick={() => void handleConfirmImport()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t.importer.importSelected(selectedDrafts.length)}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2.5 px-3 w-8" />
                  <th className="py-2.5 px-3">{t.drawer.conceptLabel}</th>
                  <th className="py-2.5 px-3">{t.drawer.payeeLabel}</th>
                  <th className="py-2.5 px-3">{t.drawer.categoryLabel}</th>
                  <th className="py-2.5 px-3">{t.drawer.amountLabel}</th>
                  <th className="py-2.5 px-3">{t.table.dueDate}</th>
                  <th className="py-2.5 px-3">{t.drawer.recurrenceLabel}</th>
                  <th className="py-2.5 px-3">{t.table.method}</th>
                  <th className="py-2.5 px-3 text-center">Auto</th>
                  <th className="py-2.5 px-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {drafts.map((row) => (
                  <tr key={row.tempId} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) =>
                          updateDraft(row.tempId, { selected: e.target.checked })
                        }
                        className="w-4 h-4 accent-blue-700 rounded cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-3 min-w-[160px]">
                      <input
                        type="text"
                        maxLength={120}
                        value={row.title}
                        onChange={(e) =>
                          updateDraft(row.tempId, { title: e.target.value })
                        }
                        className="w-full h-8 px-2 bg-white border border-slate-200 rounded text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </td>
                    <td className="py-2 px-3 min-w-[160px]">
                      <input
                        type="text"
                        maxLength={120}
                        value={row.payee}
                        onChange={(e) =>
                          updateDraft(row.tempId, { payee: e.target.value })
                        }
                        className="w-full h-8 px-2 bg-white border border-slate-200 rounded text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={row.category}
                        onChange={(e) =>
                          updateDraft(row.tempId, {
                            category: e.target.value as PaymentCategory,
                          })
                        }
                        className="h-8 px-2 bg-white border border-slate-200 rounded text-slate-800 focus:border-blue-600 focus:outline-none"
                      >
                        <option value="rent">{t.categories.rent}</option>
                        <option value="tuition">{t.categories.tuition}</option>
                        <option value="services">{t.categories.services}</option>
                        <option value="subscriptions">
                          {t.categories.subscriptions}
                        </option>
                        <option value="other">{t.categories.other}</option>
                      </select>
                    </td>
                    <td className="py-2 px-3 min-w-[110px]">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={row.amount}
                        onChange={(e) =>
                          updateDraft(row.tempId, {
                            amount: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full h-8 px-2 font-mono tabular-nums text-right bg-white border border-slate-200 rounded text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="date"
                        value={row.dueDate}
                        onChange={(e) =>
                          updateDraft(row.tempId, { dueDate: e.target.value })
                        }
                        className="h-8 px-2 font-mono tabular-nums bg-white border border-slate-200 rounded text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={row.recurrence}
                        onChange={(e) =>
                          updateDraft(row.tempId, {
                            recurrence: e.target.value as RecurrenceCycle,
                          })
                        }
                        className="h-8 px-2 bg-white border border-slate-200 rounded text-slate-800 focus:border-blue-600 focus:outline-none"
                      >
                        <option value="monthly">{t.recurrences.monthly}</option>
                        <option value="bimonthly">
                          {t.recurrences.bimonthly}
                        </option>
                        <option value="quarterly">
                          {t.recurrences.quarterly}
                        </option>
                        <option value="semester">{t.recurrences.semester}</option>
                        <option value="annual">{t.recurrences.annual}</option>
                        <option value="one_time">{t.recurrences.one_time}</option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={row.method}
                        onChange={(e) =>
                          updateDraft(row.tempId, {
                            method: e.target.value as PaymentMethod,
                          })
                        }
                        className="h-8 px-2 bg-white border border-slate-200 rounded text-slate-800 focus:border-blue-600 focus:outline-none"
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
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.autopay}
                        onChange={(e) =>
                          updateDraft(row.tempId, { autopay: e.target.checked })
                        }
                        className="w-4 h-4 accent-blue-700 rounded cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeDraft(row.tempId)}
                        aria-label={t.actions.delete}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
