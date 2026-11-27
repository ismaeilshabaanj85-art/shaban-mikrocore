import React, { useState } from 'react';
import {
  Archive,
  Globe,
  LogOut,
  Radio,
  Router,
  Shield,
} from 'lucide-react';
import {
  AppMode,
  Language,
  RouterProfile,
  SessionUser,
} from '../types/mikrocore';
import { useT } from '../i18n/translations';
import { PWAInstallButton } from './PWAStatus';
import { BrandLogo } from './BrandLogo';

interface TopBarProps {
  lang: Language;
  onToggleLang: () => void;
  mode: AppMode;
  onChangeMode: (mode: AppMode) => void;
  activeRouter: RouterProfile;
  user: SessionUser;
  onOpenVault: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  lang,
  onToggleLang,
  mode,
  onChangeMode,
  activeRouter,
  user,
  onOpenVault,
  onOpenAdmin,
  onLogout,
}) => {
  const t = useT(lang);
  const [logoTaps, setLogoTaps] = useState(0);

  const handleLogoTap = () => {
    const next = logoTaps + 1;
    if (next >= 5) {
      setLogoTaps(0);
      if (user.role === 'superadmin') {
        onOpenAdmin();
      }
    } else {
      setLogoTaps(next);
    }
  };

  const isConnectedLive = mode === 'live' && activeRouter.status === 'connected';
  const statusLabel =
    mode === 'sandbox'
      ? t.statusSandbox
      : isConnectedLive
      ? t.statusConnected
      : t.statusDisconnected;

  return (
    <header className="no-print sticky top-0 z-40 border-b border-cyan-500/25 bg-[#050A18]/92 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-2.5">
        {/* Zone 1: Custom Geometric Brand + Illuminated Developer Badge */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={handleLogoTap}
            className="flex items-center gap-2 text-start cursor-pointer group min-w-0"
            title="Shaban MikroCore"
          >
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/45 bg-[#0B142B] shadow-[0_0_20px_rgba(0,229,255,0.28)] transition group-hover:border-cyan-300">
              <BrandLogo className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <span
              dir="ltr"
              className="truncate text-xs sm:text-base font-extrabold tracking-tight text-white drop-shadow-[0_0_12px_rgba(0,229,255,0.25)]"
            >
              Shaban MikroCore
            </span>
          </button>

          <span className="hidden md:inline-flex items-center rounded-lg border border-cyan-400/45 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-bold text-cyan-200 shadow-[0_0_18px_rgba(0,229,255,0.22)] whitespace-nowrap shrink-0">
            {t.developedBy}
          </span>
        </div>

        {/* Zone 2: Live Router Status & Mode Switcher */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-[#0B142B]/80 px-3 py-1.5 text-xs whitespace-nowrap shrink-0">
            <Router
              className={`h-3.5 w-3.5 ${
                mode === 'sandbox'
                  ? 'text-cyan-400'
                  : isConnectedLive
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            />
            <span
              className={`font-bold ${
                mode === 'sandbox'
                  ? 'text-cyan-300'
                  : isConnectedLive
                  ? 'text-emerald-300'
                  : 'text-amber-300'
              }`}
            >
              {statusLabel}
            </span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-slate-200 tabular-nums" dir="ltr">
              {activeRouter.host}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400 truncate max-w-[140px]">
              {activeRouter.model}
            </span>
          </div>

          <div
            role="group"
            aria-label="Operating Mode"
            className="flex items-center rounded-xl border border-cyan-500/25 bg-[#0B142B]/90 p-1"
          >
            <button
              type="button"
              onClick={() => onChangeMode('sandbox')}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'sandbox'
                  ? 'bg-cyan-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t.modeSandbox}
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('live')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'live'
                  ? 'bg-emerald-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Radio className="h-3 w-3" />
              <span>{t.modeLive}</span>
            </button>
          </div>
        </div>

        {/* Zone 3: Quick Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onChangeMode(mode === 'sandbox' ? 'live' : 'sandbox')}
            className="lg:hidden rounded-lg border border-cyan-500/30 bg-[#0B142B] px-2 py-1.5 text-[10px] font-bold text-cyan-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {mode === 'sandbox' ? 'Sandbox' : 'Live'}
          </button>

          <button
            type="button"
            onClick={onOpenVault}
            aria-label={t.backupVault}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-2 sm:px-3 py-1.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/22 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Archive className="h-3.5 w-3.5 text-emerald-300" />
            <span className="hidden md:inline">{t.backupVault}</span>
          </button>

          <button
            type="button"
            onClick={onToggleLang}
            className="flex items-center gap-1 rounded-xl border border-cyan-500/30 bg-[#0B142B] px-2 sm:px-2.5 py-1.5 text-xs font-bold text-cyan-200 transition hover:border-cyan-400 cursor-pointer whitespace-nowrap shrink-0"
            aria-label="Toggle Language"
          >
            <Globe className="h-3.5 w-3.5 text-cyan-400" />
            <span>{lang === 'ar' ? 'EN' : 'AR'}</span>
          </button>

          <PWAInstallButton lang={lang} />

          {user.role === 'superadmin' && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="hidden sm:flex items-center gap-1 rounded-xl border border-amber-400/40 bg-amber-500/15 px-2.5 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/25 cursor-pointer whitespace-nowrap shrink-0"
              title={t.navAdmin}
              aria-label={t.navAdmin}
            >
              <Shield className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 px-2 sm:px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-rose-500/50 hover:text-rose-200 cursor-pointer whitespace-nowrap shrink-0"
            title={t.logout}
            aria-label={t.logout}
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
