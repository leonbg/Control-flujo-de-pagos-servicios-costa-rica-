import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { TRANSLATIONS } from '../i18n/translations';
import type { LanguageCode } from '../types/payment';

interface OfflineIndicatorProps {
  language: LanguageCode;
}

export function OfflineIndicator({ language }: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();
  const t = TRANSLATIONS[language];

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>{t.pwa.offlineBanner}</span>
    </div>
  );
}
