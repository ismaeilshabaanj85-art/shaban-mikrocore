import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Globe,
  KeyRound,
  Lock,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { Language, SessionUser } from '../types/mikrocore';
import { useT } from '../i18n/translations';
import {
  MAX_LOGIN_ATTEMPTS,
  evaluateLoginFailure,
  getRemainingLockoutSeconds,
} from '../utils/security';
import {
  authenticateUser,
  clearLockoutState,
  loadLockoutState,
  loadSubscriptionSettings,
  saveLockoutState,
} from '../utils/storage';
import { BrandLogo } from './BrandLogo';

interface LoginGateProps {
  lang: Language;
  onToggleLang: () => void;
  onAuthenticated: (user: SessionUser) => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({
  lang,
  onToggleLang,
  onAuthenticated,
}) => {
  const t = useT(lang);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSuperAdminMode, setIsSuperAdminMode] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lockout, setLockout] = useState(() => loadLockoutState());
  const [lockSeconds, setLockSeconds] = useState(() =>
    getRemainingLockoutSeconds(loadLockoutState())
  );
  const [subSettings] = useState(() => loadSubscriptionSettings());

  useEffect(() => {
    const timer = setInterval(() => {
      const rem = getRemainingLockoutSeconds(lockout);
      setLockSeconds(rem);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockout]);

  const handleLogoTap = () => {
    const next = logoClickCount + 1;
    if (next >= 5) {
      setIsSuperAdminMode((prev) => !prev);
      setLogoClickCount(0);
      setErrorMsg('');
    } else {
      setLogoClickCount(next);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rem = getRemainingLockoutSeconds(lockout);
    if (rem > 0) {
      setLockSeconds(rem);
      return;
    }

    if (!username.trim() || !password) {
      setErrorMsg(t.errInvalidCreds);
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    const result = await authenticateUser(username, password, isSuperAdminMode);
    setSubmitting(false);

    if (result.ok) {
      clearLockoutState();
      setLockout({ failedAttempts: 0, lockedUntil: null });
      onAuthenticated(result.user);
      return;
    }

    const updatedLockout = evaluateLoginFailure(lockout);
    saveLockoutState(updatedLockout);
    setLockout(updatedLockout);
    setLockSeconds(getRemainingLockoutSeconds(updatedLockout));

    if (result.reason === 'suspended') {
      setErrorMsg(t.errSuspended);
    } else if (result.reason === 'expired') {
      setErrorMsg(t.errExpired);
    } else {
      setErrorMsg(t.errInvalidCreds);
    }
  };

  const isLocked = lockSeconds > 0;
  const attemptsLeft = Math.max(0, MAX_LOGIN_ATTEMPTS - lockout.failedAttempts);
  const waText = encodeURIComponent(
    'السلام عليكم أستاذ إسماعيل، أرغب في طلب حساب واشتراك شهري في منصة Shaban MikroCore'
  );
  const waHref = `https://wa.me/${subSettings.whatsappNumber}?text=${waText}`;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-[#050A18] px-4 py-10 overflow-hidden">
      {/* Animated Cyber Grid + Atmospheric Lighting */}
      <div aria-hidden="true" className="cyber-grid-bg pointer-events-none fixed inset-0 opacity-85" />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,229,255,0.16),transparent_48%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_48%)]"
      />

      {/* Language Switcher */}
      <div className="absolute top-5 end-5 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleLang}
          className="flex items-center gap-1.5 rounded-xl border border-cyan-500/35 bg-[#0B142B]/85 px-3.5 py-2 text-xs font-bold text-cyan-200 backdrop-blur-md transition hover:border-cyan-400/70 hover:bg-cyan-500/15 cursor-pointer"
        >
          <Globe className="h-3.5 w-3.5 text-cyan-400" />
          <span>{lang === 'ar' ? 'EN' : 'AR'}</span>
        </button>
      </div>

      <div className="relative z-10 w-full max-w-md space-y-5">
        {/* Clickable Brand Header (Always "Shaban MikroCore" + Developer Badge) */}
        <div className="flex flex-col items-center text-center">
          <button
            type="button"
            onClick={handleLogoTap}
            className="group mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/45 bg-[#0B142B]/90 shadow-[0_0_36px_rgba(0,229,255,0.28)] transition hover:scale-105 cursor-pointer"
            aria-label="Shaban MikroCore Logo"
          >
            <BrandLogo className="h-10 w-10 transition group-hover:scale-105" />
          </button>
          <h1
            dir="ltr"
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_0_16px_rgba(0,229,255,0.25)]"
          >
            Shaban MikroCore
          </h1>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3.5 py-1 text-xs font-bold text-cyan-200 shadow-[0_0_20px_rgba(0,229,255,0.2)]">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            <span>{t.developedBy}</span>
          </div>
        </div>

        {/* Main Secured Login Card */}
        <div className="noc-glass rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">
                {isSuperAdminMode ? t.superAdminLoginTitle : t.loginTitle}
              </h2>
              <p className="mt-1 text-xs text-slate-400">{t.loginSubtitle}</p>
            </div>
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                isSuperAdminMode
                  ? 'border-amber-400/40 bg-amber-500/15 text-amber-300'
                  : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
              }`}
            >
              {isSuperAdminMode ? (
                <UserCheck className="h-5 w-5" />
              ) : (
                <Lock className="h-5 w-5" />
              )}
            </div>
          </div>

          {isLocked && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-bold">
                  {t.lockoutMessage}{' '}
                  <span className="font-mono text-rose-100 tabular-nums">
                    {lockSeconds} {t.seconds}
                  </span>
                </p>
              </div>
            </div>
          )}

          {errorMsg && !isLocked && (
            <div className="mb-5 flex items-center justify-between gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
              <span>{errorMsg}</span>
              <span className="font-mono text-[11px] text-rose-300 tabular-nums whitespace-nowrap">
                {t.attemptsLeft} {attemptsLeft}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="mb-1.5 block text-xs font-semibold text-slate-300"
              >
                {t.username}
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLocked || submitting}
                placeholder="admin"
                className="w-full rounded-xl border border-cyan-500/25 bg-[#050A18]/80 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
                dir="ltr"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-semibold text-slate-300"
              >
                {t.password}
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLocked || submitting}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-cyan-500/25 bg-[#050A18]/80 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={isLocked || submitting}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition cursor-pointer disabled:opacity-50 ${
                isSuperAdminMode
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:brightness-110'
                  : 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110'
              }`}
            >
              <KeyRound className="h-4 w-4" />
              <span>{isSuperAdminMode ? t.signInAdmin : t.signIn}</span>
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-4 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>SHA-256 · Multi-Tenant</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsSuperAdminMode((prev) => !prev);
                setErrorMsg('');
              }}
              className="text-cyan-400/90 hover:text-cyan-300 underline-offset-4 hover:underline cursor-pointer whitespace-nowrap"
            >
              {isSuperAdminMode ? t.backToCustomerLogin : t.adminPortalHint}
            </button>
          </div>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
            {t.closedGateNotice}
          </p>
        </div>

        {/* Luxury Subscription & Account Activation Card */}
        <div className="noc-glass rounded-3xl p-5 shadow-2xl border border-emerald-400/30 bg-gradient-to-br from-[#0B142B]/90 via-[#071525]/95 to-[#061D22]/90">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold text-emerald-300">
                {lang === 'ar' ? 'تفعيل الاشتراك الفوري' : 'Instant Subscription Activation'}
              </p>
              <p className="mt-1.5 text-xs sm:text-sm font-bold leading-relaxed text-white">
                {lang === 'ar'
                  ? `الاشتراك الشهري الشامل: ${subSettings.monthlyPriceUsd}$ / شهرياً — تفعيل فوري وحساب معزول بالكامل لإدارة شبكتك`
                  : `All-Inclusive Monthly Plan: $${subSettings.monthlyPriceUsd} / month — Instant activation & fully isolated tenant account for your network`}
              </p>
            </div>
            <span
              dir="ltr"
              className="shrink-0 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 font-mono text-sm font-black text-emerald-300 tabular-nums"
            >
              ${subSettings.monthlyPriceUsd}/mo
            </span>
          </div>

          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-400 px-4 py-3 text-xs sm:text-sm font-extrabold text-slate-950 shadow-[0_0_24px_rgba(16,185,129,0.38)] transition hover:brightness-110"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span>
              {lang === 'ar'
                ? 'تواصل عبر واتساب لطلب حساب وتفعيل الاشتراك 💬'
                : 'Contact via WhatsApp to Request Account & Activate 💬'}
            </span>
          </a>
        </div>
      </div>
    </div>
  );
};
