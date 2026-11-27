import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { Language } from '../types/mikrocore';
import { useT } from '../i18n/translations';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ lang: Language }> = ({ lang }) => {
  const t = useT(lang);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25 whitespace-nowrap shrink-0 cursor-pointer"
        title={t.installApp}
      >
        <Download className="h-3.5 w-3.5 text-cyan-300" />
        <span className="hidden xl:inline">{t.installApp}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">{t.installApp}</span>
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="noc-glass w-full max-w-sm rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'تثبيت التطبيق على iPhone / iPad' : 'Install on iPhone / iPad'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm leading-relaxed text-slate-300">
                {lang === 'ar'
                  ? '1. اضغط على زر المشاركة (Share) في شريط Safari.\n2. اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                  : '1. Tap the Share icon in the Safari toolbar.\n2. Scroll down and tap Add to Home Screen.'}
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC<{ lang: Language }> = ({ lang }) => {
  const isOnline = useOnlineStatus();
  const t = useT(lang);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/90 px-3.5 py-2 text-xs font-medium text-amber-200 shadow-lg backdrop-blur-md">
      <WifiOff className="h-3.5 w-3.5 text-amber-400" />
      <span>{t.offlineBanner}</span>
    </div>
  );
};
