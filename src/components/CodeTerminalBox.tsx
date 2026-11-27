import React, { useState } from 'react';
import {
  Archive,
  Check,
  Copy,
  Download,
  Play,
  Terminal,
} from 'lucide-react';
import { AppMode, Language, RouterProfile } from '../types/mikrocore';
import { useT } from '../i18n/translations';
import { cloudSendAndAwaitRouterCommand } from '../utils/firebaseCloud';
import { loadSession } from '../utils/storage';

interface CodeTerminalBoxProps {
  title: string;
  code: string;
  filename: string;
  lang: Language;
  mode: AppMode;
  activeRouter: RouterProfile;
  tenantUuid?: string;
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
  tenantUuid,
  syntax = 'routeros',
  onSaveToVault,
  showRestApply = true,
}) => {
  const t = useT(lang);
  const [copied, setCopied] = useState(false);
  const [savedVault, setSavedVault] = useState(false);
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

  const handleCloudPushDirect = async () => {
    const effectiveTenant =
      tenantUuid || loadSession()?.tenantUuid || '00000000-0000-4000-8000-000000000001';

    setApplying(true);
    setApplyFeedback({
      ok: true,
      message:
        lang === 'ar'
          ? 'جارٍ إرسال الكود إلى سحابة Firebase وانتظار سحبه وتنفيذه بواسطة وكيل الراوتر...'
          : 'Pushing RouterOS script to Firebase Cloud and waiting for router agent execution...',
    });

    const res = await cloudSendAndAwaitRouterCommand(
      effectiveTenant,
      activeRouter.id,
      code,
      () => {
        setApplyFeedback({
          ok: true,
          message:
            lang === 'ar'
              ? 'تم رفع الأمر إلى قائمة التنفيذ السحابية — بانتظار سحب الراوتر (خلال 15 ثانية)...'
              : 'Command queued in Firebase — waiting for MikroCore_CloudAgent to pull & execute (up to 15s)...',
        });
      }
    );

    setApplying(false);

    if (!res.ok) {
      setApplyFeedback({
        ok: false,
        message:
          lang === 'ar'
            ? `تعذر إرسال الأمر إلى السحابة (${res.error || 'خطأ شبكة'}).`
            : `Failed to push command to cloud (${res.error || 'network error'}).`,
      });
      return;
    }

    if (res.executed) {
      setApplyFeedback({
        ok: true,
        message:
          lang === 'ar'
            ? `تم سحب الكود وتنفيذه على الراوتر ${activeRouter.name} بنجاح! ✅`
            : `Command pulled and executed on ${activeRouter.name} successfully! ✅`,
      });
    } else {
      setApplyFeedback({
        ok: true,
        message:
          mode === 'sandbox'
            ? lang === 'ar'
              ? `تم وضع الأمر في قائمة الانتظار السحابية للراوتر ${activeRouter.name} (تأكد من تشغيل MikroCore_CloudAgent على الراوتر الحقيقي).`
              : `Command queued in Firebase for ${activeRouter.name} (ensure MikroCore_CloudAgent is running on the live router).`
            : lang === 'ar'
            ? 'تم وضع الأمر في قائمة الانتظار السحابية — سينفذه الراوتر تلقائياً فور نبضة الوكيل القادمة.'
            : 'Command queued in Firebase — the router will execute it automatically on the next agent heartbeat.',
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
              disabled={applying}
              onClick={handleCloudPushDirect}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:brightness-110 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" />
              <span>
                {applying
                  ? lang === 'ar'
                    ? 'جارٍ الإرسال للراوتر...'
                    : 'Executing on Router...'
                  : lang === 'ar'
                  ? 'إرسال وتنفيذ مباشر على الراوتر 🚀'
                  : 'Push & Execute on Router 🚀'}
              </span>
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
    </div>
  );
};
