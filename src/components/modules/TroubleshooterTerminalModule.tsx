import React, { useState } from 'react';
import {
  Check,
  Copy,
  FlaskConical,
  HelpCircle,
  Play,
  ShieldAlert,
  TerminalSquare,
  Wrench,
} from 'lucide-react';
import { AppMode, Language, RouterProfile } from '../../types/mikrocore';
import {
  DIAGNOSTIC_SCENARIOS,
  ScenarioId,
  generateScenarioScript,
  getMissingScenarioQuestions,
} from '../../engine/troubleshooterEngine';
import { generateAutoRollbackGuard } from '../../engine/networkEngine';
import { cloudSendAndAwaitRouterCommand } from '../../utils/firebaseCloud';
import { loadSession } from '../../utils/storage';

interface TroubleshooterTerminalModuleProps {
  lang: Language;
  mode: AppMode;
  activeRouter: RouterProfile;
  tenantUuid?: string;
  onTestInSandbox: (script: string) => void;
}

export const TroubleshooterTerminalModule: React.FC<TroubleshooterTerminalModuleProps> = ({
  lang,
  mode,
  activeRouter,
  tenantUuid,
  onTestInSandbox,
}) => {
  const [selectedId, setSelectedId] = useState<ScenarioId>('block_apps');
  const [answers, setAnswers] = useState<Record<string, string>>({
    osVersion: activeRouter.osVersion,
  });
  const [copied, setCopied] = useState(false);
  const [rollbackActive, setRollbackActive] = useState(false);
  const [rollbackSec, setRollbackSec] = useState(60);
  const [pushing, setPushing] = useState(false);
  const [execLog, setExecLog] = useState<string>('');

  const scenario =
    DIAGNOSTIC_SCENARIOS.find((s) => s.id === selectedId) || DIAGNOSTIC_SCENARIOS[0];
  const missing = getMissingScenarioQuestions(selectedId, answers);
  const ready = missing.length === 0;
  const generatedCode = ready
    ? generateScenarioScript(selectedId, answers, activeRouter.osVersion)
    : '';

  const handleSelectScenario = (id: ScenarioId) => {
    setSelectedId(id);
    setAnswers({ osVersion: activeRouter.osVersion });
    setExecLog('');
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
    } catch {
      // ignore
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleApplyDirect = async () => {
    if (!generatedCode) return;
    const effectiveTenant =
      tenantUuid || loadSession()?.tenantUuid || '00000000-0000-4000-8000-000000000001';

    setRollbackActive(true);
    setRollbackSec(60);
    setPushing(true);

    const timer = setInterval(() => {
      setRollbackSec((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setExecLog(
      lang === 'ar'
        ? `جارٍ إرسال التعديل إلى سحابة Firebase لراوتر ${activeRouter.name} (${activeRouter.osVersion.toUpperCase()})...`
        : `Pushing script to Firebase Cloud for ${activeRouter.name} (${activeRouter.osVersion.toUpperCase()})...`
    );

    const fullPayload = `${generateAutoRollbackGuard(activeRouter.osVersion, 60)}\n${generatedCode}`;
    const res = await cloudSendAndAwaitRouterCommand(
      effectiveTenant,
      activeRouter.id,
      fullPayload,
      () => {
        setExecLog(
          lang === 'ar'
            ? 'تم وضع الأمر في قائمة التنفيذ السحابية — بانتظار سحب الوكيل MikroCore_CloudAgent وتنفيذه...'
            : 'Command queued in Firebase — waiting for MikroCore_CloudAgent to pull & execute...'
        );
      }
    );

    setPushing(false);

    if (!res.ok) {
      setExecLog(
        lang === 'ar'
          ? `تعذر الإرسال إلى السحابة (${res.error || 'خطأ شبكة'}).`
          : `Cloud push failed (${res.error || 'network error'}).`
      );
      return;
    }

    if (res.executed) {
      setExecLog(
        lang === 'ar'
          ? `تم سحب الكود وتنفيذه على الراوتر ${activeRouter.name} بنجاح! ✅ (مؤقت الاستعادة: 60 ثانية)`
          : `Command pulled and executed on ${activeRouter.name} successfully! ✅ (60s Rollback guard)`
      );
    } else {
      setExecLog(
        mode === 'sandbox'
          ? lang === 'ar'
            ? `تم وضع التعديل في قائمة الانتظار السحابية للراوتر ${activeRouter.name} مع درع 60 ثانية.`
            : `Script queued in Firebase for ${activeRouter.name} with 60s Rollback guard.`
          : lang === 'ar'
          ? 'تم وضع الأمر في قائمة التنفيذ السحابية — سينفذه الراوتر تلقائياً فور نبضة الوكيل القادمة.'
          : 'Command queued in Firebase — router will execute on next Cloud Agent heartbeat.'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
          <Wrench className="h-5 w-5 text-cyan-400" />
          <span>
            {lang === 'ar'
              ? 'تعديلات ومساعدات + النيو تيرمينال الذكي'
              : 'Troubleshooter & Smart New Terminal'}
          </span>
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          {lang === 'ar'
            ? 'اختر المشكلة أو التعديل، ثم أجب عن الأسئلة التفاعلية لتوليد أوامر دقيقة ومفحوصة.'
            : 'Select a scenario and answer the required diagnostic questions to generate verified RouterOS commands.'}
        </p>
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {DIAGNOSTIC_SCENARIOS.map((s) => {
          const active = s.id === selectedId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelectScenario(s.id)}
              className={`rounded-2xl border p-4 text-start transition cursor-pointer ${
                active
                  ? 'border-cyan-400 bg-cyan-500/18 shadow-[0_0_20px_rgba(0,229,255,0.16)]'
                  : 'border-slate-800 bg-[#0B142B]/75 hover:border-cyan-500/35'
              }`}
            >
              <p className="text-xs font-extrabold text-white">
                {lang === 'ar' ? s.titleAr : s.titleEn}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                {lang === 'ar' ? s.descAr : s.descEn}
              </p>
            </button>
          );
        })}
      </div>

      {/* Mandatory Interactive Q&A Panel */}
      <div className="noc-glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            <span>
              {lang === 'ar'
                ? 'الأسئلة التفاعلية الإلزامية قبل توليد الكود'
                : 'Mandatory Interactive Q&A Before Code Generation'}
            </span>
          </h3>
          <span
            className={`text-xs font-bold ${
              ready ? 'text-emerald-400' : 'text-amber-300'
            }`}
          >
            {ready
              ? lang === 'ar'
                ? 'مكتمل — الكود جاهز'
                : 'Complete — Code Ready'
              : lang === 'ar'
              ? `متبقي ${missing.length} حقول مطلوبة`
              : `${missing.length} required inputs remaining`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenario.questions.map((q) => (
            <div key={q.key}>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                {lang === 'ar' ? q.labelAr : q.labelEn}
              </label>
              {q.type === 'select' && q.options ? (
                <select
                  value={answers[q.key] || ''}
                  onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/90 px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="">{lang === 'ar' ? '-- اختر --' : '-- Select --'}</option>
                  {q.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {lang === 'ar' ? opt.labelAr : opt.labelEn}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={answers[q.key] || ''}
                  onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                  placeholder={q.placeholder}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/90 px-3.5 py-2.5 font-mono text-xs text-white outline-none focus:border-cyan-400"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dark New Terminal Console */}
      <div className="noc-glass rounded-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 bg-slate-950/75 px-4 py-3">
          <div className="flex items-center gap-2">
            <TerminalSquare className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold text-white" dir="ltr">
              New Terminal — [{activeRouter.apiUser}@{activeRouter.name}] &gt;
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!ready}
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40 cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{lang === 'ar' ? 'نسخ الكود' : 'Copy Code'}</span>
            </button>

            <button
              type="button"
              disabled={!ready}
              onClick={() => onTestInSandbox(generatedCode)}
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40 cursor-pointer"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <span>{lang === 'ar' ? 'اختبار في المحاكي' : 'Test in Sandbox'}</span>
            </button>

            <button
              type="button"
              disabled={!ready || pushing}
              onClick={handleApplyDirect}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-emerald-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:brightness-110 disabled:opacity-40 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" />
              <span>
                {pushing
                  ? lang === 'ar'
                    ? 'جارٍ الإرسال...'
                    : 'Pushing...'
                  : lang === 'ar'
                  ? 'إرسال وتنفيذ مباشر على الراوتر 🚀'
                  : 'Push & Execute on Router 🚀'}
              </span>
            </button>
          </div>
        </div>

        {rollbackActive && (
          <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              <span>
                {lang === 'ar'
                  ? 'درع الاستعادة التلقائية مفعل — المتبقي للتأكيد:'
                  : '60-Second Auto-Rollback Safety Guard active:'}
              </span>
            </div>
            <span className="font-mono font-bold tabular-nums">{rollbackSec}s</span>
          </div>
        )}

        {execLog && (
          <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
            {execLog}
          </div>
        )}

        {!ready ? (
          <div className="bg-[#030712]/95 p-6 text-center text-xs text-slate-400">
            {lang === 'ar'
              ? 'يرجى استكمال إجابات الأسئلة أعلاه ليقوم المحرك بتوليد أوامر New Terminal الآمنة.'
              : 'Answer all clarifying questions above to unlock and generate verified New Terminal commands.'}
          </div>
        ) : (
          <pre dir="ltr" className="overflow-auto bg-[#030712]/95 p-4 font-mono text-xs leading-relaxed text-cyan-100">
            <code>{generatedCode}</code>
          </pre>
        )}
      </div>
    </div>
  );
};
