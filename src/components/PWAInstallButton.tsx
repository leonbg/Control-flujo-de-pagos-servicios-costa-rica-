import { Download, Share, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { TRANSLATIONS } from '../i18n/translations';
import type { LanguageCode } from '../types/payment';

interface PWAInstallButtonProps {
  language: LanguageCode;
  variant?: 'sidebar' | 'banner';
}

export function PWAInstallButton({
  language,
  variant = 'sidebar',
}: PWAInstallButtonProps) {
  const t = TRANSLATIONS[language];
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const iosGuideModal = showIOSGuide ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-heading"
    >
      <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3
            id="ios-install-heading"
            className="text-base font-semibold text-slate-900"
          >
            {t.pwa.iosTitle}
          </h3>
          <button
            type="button"
            onClick={() => setShowIOSGuide(false)}
            aria-label={t.pwa.close}
            className="p-1 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ol className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="font-mono font-semibold text-blue-700 shrink-0">
              1.
            </span>
            <span>
              {t.pwa.iosStep1}{' '}
              <Share className="inline w-3.5 h-3.5 text-blue-700 align-text-bottom" />
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-semibold text-blue-700 shrink-0">
              2.
            </span>
            <span>{t.pwa.iosStep2}</span>
          </li>
        </ol>

        <button
          type="button"
          onClick={() => setShowIOSGuide(false)}
          className="w-full py-2 px-4 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          {t.pwa.close}
        </button>
      </div>
    </div>
  ) : null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={
          variant === 'banner'
            ? 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer'
            : 'w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{t.pwa.installApp}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'banner'
              ? 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer'
              : 'w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer'
          }
        >
          <Download className="w-3.5 h-3.5 text-blue-700 shrink-0" />
          <span>{t.pwa.installIOS}</span>
        </button>
        {iosGuideModal}
      </>
    );
  }

  return null;
}
