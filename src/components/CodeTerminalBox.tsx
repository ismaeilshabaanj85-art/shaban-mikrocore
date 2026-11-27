import React, { useState } from 'react';
import {
  Archive,
  Check,
  Copy,
  Download,
  Play,
  ShieldAlert,
  Terminal,
  X,
} from 'lucide-react';
import { AppMode, Language, RouterProfile } from '../types/mikrocore';
import { useT } from '../i18n/translations';
import {
  executeRouterOsV7Rest,
  generateAutoRollbackGuard,
} from '../engine/networkEngine';

interface CodeTerminalBoxProps {
  title: string;
  code: string;
  filename: string;
  lang: Language;
  mode: AppMode;
  activeRouter: RouterProfile;
  syntax?: 'routeros' | 'cisco';
  onSaveToVault?: (name: string, content: string, type: 'rsc' | 'backup') => void;
  showRestApply?: boolean;
}

export const CodeTerminalBox: React.FC<CodeTerminalBoxProps> = ({
  title,
  code,
  filename,
  lang,
  mode,
  activeRouter,
  syntax = 'routeros',
  onSaveToVault,
  showRestApply = true,
}) => {
  const t = useT(lang);
  const [copied, setCopied] = useState(false);
  const [savedVault, setSavedVault] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback textarea copy
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleVaultSave = () => {
    if (!onSaveToVault) return;
    onSaveToVault(filename, code, 'rsc');
    setSavedVault(true);
    setTimeout(() => setSavedVault(false), 2000);
  };

  const handleApplyRest = async () => {
    setApplying(true);
    setApplyFeedback(null);

    if (mode === 'sandbox') {
      await new Promise((r) => setTimeout(r, 650));
      setApplying(false);
      setConfirmApply(false);
      setApplyFeedback({
        ok: true,
        message:
          lang === 'ar'
            ? `تمت محاكاة تنفيذ السكربت مع تفعيل درع الاستعادة التلقائية (60 ثانية) على ${activeRouter.name}.`
            : `Simulated execution with 60s Auto-Rollback Safety Guard armed on ${activeRouter.name}.`,
      });
      return;
    }

    if (activeRouter.osVersion === 'v6') {
      setApplying(false);
      setConfirmApply(false);
      setApplyFeedback({
        ok: false,
        message:
          lang === 'ar'
            ? 'RouterOS v6 لا يدعم REST API مباشرة؛ يرجى تحميل ملف .rsc أو لصقه في New Terminal.'
            : 'RouterOS v6 does not expose native REST API; please download .rsc or paste in New Terminal.',
      });
      return;
    }

    const res = await executeRouterOsV7Rest(activeRouter, '/system/script/add', 'POST', {
      name: `MikroCore_${Date.now()}`,
      source: `${generateAutoRollbackGuard('v7', 60)}\n${code}`,
    });

    setApplying(false);
    setConfirmApply(false);
    if (res.ok) {
      setApplyFeedback({
        ok: true,
        message:
          lang === 'ar'
            ? 'تم إرسال السكربت بنجاح عبر REST API مع تفعيل حماية 60 ثانية.'
            : 'Script pushed via REST API with 60-second Auto-Rollback Safety Guard.',
      });
    } else {
      setApplyFeedback({
        ok: false,
        message:
          lang === 'ar'
            ? `تعذر الاتصال المباشر بالراوتر (${res.error || res.status}). استخدم تحميل .rsc أو لصقه في Terminal.`
            : `Direct REST push failed (${res.error || res.status}). Use Download .rsc or paste in Terminal.`,
      });
    }
  };

  return (
    <div className="noc-glass rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 bg-slate-950/60 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Terminal className="h-4 w-4 shrink-0 text-cyan-400" />
          <span className="truncate text-sm font-semibold text-slate-100">{title}</span>
          <span className="text-xs font-mono text-cyan-400/80 whitespace-nowrap shrink-0">
            {syntax === 'cisco' ? 'Cisco IOS' : activeRouter.osVersion.toUpperCase()}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? t.copied : t.copyScript}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-500/40 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-cyan-400" />
            <span>{syntax === 'cisco' ? t.downloadCfg : t.downloadRsc}</span>
          </button>

          {onSaveToVault && (
            <button
              type="button"
              onClick={handleVaultSave}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-emerald-500/40 hover:text-emerald-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {savedVault ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Archive className="h-3.5 w-3.5 text-emerald-400" />
              )}
              <span>{t.saveToVault}</span>
            </button>
          )}

          {showRestApply && syntax === 'routeros' && (
            <button
              type="button"
              onClick={() => setConfirmApply(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:brightness-110 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{t.applyViaRest}</span>
            </button>
          )}
        </div>
      </div>

      {applyFeedback && (
        <div
          className={`border-b px-4 py-2.5 text-xs font-medium ${
            applyFeedback.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          }`}
        >
          {applyFeedback.message}
        </div>
      )}

      <pre
        dir="ltr"
        className="max-h-96 overflow-auto bg-[#030712]/90 p-4 font-mono text-xs leading-relaxed text-cyan-100/95 text-left"
      >
        <code>{code}</code>
      </pre>

      {confirmApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="noc-glass w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-300">
                <ShieldAlert className="h-5 w-5" />
                <h4 className="text-base font-bold text-white">
                  {lang === 'ar'
                    ? 'تفعيل درع الاستعادة التلقائية (60 ثانية)'
                    : '60-Second Auto-Rollback Safety Guard'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setConfirmApply(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-slate-300 mb-4">{t.rollbackNotice}</p>
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 font-mono text-[11px] text-emerald-300 mb-5" dir="ltr">
              {generateAutoRollbackGuard(activeRouter.osVersion, 60)}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmApply(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={applying}
                onClick={handleApplyRest}
                className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60 cursor-pointer"
              >
                {applying
                  ? lang === 'ar'
                    ? 'جارٍ التنفيذ...'
                    : 'Executing...'
                  : lang === 'ar'
                  ? 'تأكيد وتطبيق بأمان'
                  : 'Confirm Safe Execution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
