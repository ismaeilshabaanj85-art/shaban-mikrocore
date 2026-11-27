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
import {
  executeRouterOsV7Rest,
  generateAutoRollbackGuard,
} from '../../engine/networkEngine';

interface TroubleshooterTerminalModuleProps {
  lang: Language;
  mode: AppMode;
  activeRouter: RouterProfile;
  onTestInSandbox: (script: string) => void;
}

export const TroubleshooterTerminalModule: React.FC<TroubleshooterTerminalModuleProps> = ({
  lang,
  mode,
  activeRouter,
  onTestInSandbox,
}) => {
  const [selectedId, setSelectedId] = useState<ScenarioId>('block_apps');
  const [answers, setAnswers] = useState<Record<string, string>>({
    osVersion: activeRouter.osVersion,
  });
  const [copied, setCopied] = useState(false);
  const [rollbackActive, setRollbackActive] = useState(false);
  const [rollbackSec, setRollbackSec] = useState(60);
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
    setRollbackActive(true);
    setRollbackSec(60);

    const timer = setInterval(() => {
      setRollbackSec((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    if (mode === 'sandbox') {
      setExecLog(
        lang === 'ar'
          ? `تم التنفيذ التجريبي بنجاح مع تفعيل درع الاستعادة التلقائية (60 ثانية) على ${activeRouter.name}.`
          : `Executed with 60s Auto-Rollback Safety Timer on ${activeRouter.name} (Sandbox).`
      );
      return;
    }

    if (activeRouter.osVersion === 'v6') {
      setExecLog(
        lang === 'ar'
          ? 'RouterOS v6 يتطلب لصق الكود في New Terminal داخل Winbox.'
          : 'RouterOS v6 requires pasting into Winbox New Terminal.'
      );
      return;
    }

    const res = await executeRouterOsV7Rest(activeRouter, '/system/script/add', 'POST', {
      name: `MikroCore_Fix_${Date.now()}`,
      source: `${generateAutoRollbackGuard('v7', 60)}\n${generatedCode}`,
    });

    setExecLog(
      res.ok
        ? lang === 'ar'
          ? 'تم إرسال التعديل مباشرة عبر REST API مع مؤقت استعادة 60 ثانية.'
          : 'Pushed directly via REST API with 60s Auto-Rollback guard.'
        : lang === 'ar'
        ? `تعذر الإرسال المباشر (${res.error || res.status}). انسخ الكود لـ New Terminal.`
        : `Direct REST push failed (${res.error || res.status}). Copy into New Terminal.`
    );
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
              disabled={!ready}
              onClick={handleApplyDirect}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-emerald-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:brightness-110 disabled:opacity-40 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" />
              <span>
                {lang === 'ar' ? 'تطبيق مباشر على الراوتر' : 'Apply Directly to Router'}
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
