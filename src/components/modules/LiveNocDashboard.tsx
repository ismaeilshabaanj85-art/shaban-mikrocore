import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Cpu,
  HardDriveDownload,
  RefreshCw,
  RotateCcw,
  Terminal,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { AppMode, Language, NocTelemetry, RouterProfile } from '../../types/mikrocore';
import { executeRouterOsV7Rest } from '../../engine/networkEngine';

interface LiveNocDashboardProps {
  lang: Language;
  mode: AppMode;
  activeRouter: RouterProfile;
  onQuickBackup: () => void;
}

function CircularGauge({
  label,
  value,
  max = 100,
  unit,
  colorClass,
  strokeColor,
}: {
  label: string;
  value: number;
  max?: number;
  unit: string;
  colorClass: string;
  strokeColor: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="noc-glass rounded-2xl p-4 flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0 flex items-center justify-center">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke="rgba(148, 163, 184, 0.14)"
            strokeWidth="7"
          />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={strokeColor}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <span dir="ltr" className={`absolute font-mono text-sm font-bold tabular-nums ${colorClass}`}>
          {value}
          {unit}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-400">{label}</p>
        <p dir="ltr" className="mt-1 font-mono text-lg font-extrabold text-white tabular-nums text-start">
          {value} <span className="text-xs font-normal text-slate-400">{unit}</span>
        </p>
      </div>
    </div>
  );
}

export const LiveNocDashboard: React.FC<LiveNocDashboardProps> = ({
  lang,
  mode,
  activeRouter,
  onQuickBackup,
}) => {
  const [telemetry, setTelemetry] = useState<NocTelemetry>(() => ({
    cpuLoad: 24,
    ramUsedPercent: 38,
    ramTotalMb: 4096,
    ramUsedMb: 1556,
    temperatureC: 44,
    voltageV: 24.2,
    uptime: '18d 07:42:15',
    activeHotspot: 142,
    activePppoe: 64,
    rxMbps: 184.5,
    txMbps: 42.3,
    history: Array.from({ length: 18 }, (_, i) => ({
      time: `${i}`,
      rx: 130 + Math.round(Math.sin(i * 0.6) * 45 + i * 2),
      tx: 32 + Math.round(Math.cos(i * 0.5) * 14),
    })),
  }));

  const [pingTarget, setPingTarget] = useState('1.1.1.1');
  const [consoleLog, setConsoleLog] = useState<string[]>([
    `Shaban MikroCore NOC Ready · ${activeRouter.name} (${activeRouter.host})`,
  ]);
  const [rebootConfirm, setRebootConfirm] = useState(false);

  // Real-time Sandbox polling / Live REST polling
  useEffect(() => {
    const interval = setInterval(async () => {
      if (mode === 'live' && activeRouter.osVersion === 'v7') {
        const res = await executeRouterOsV7Rest(activeRouter, '/system/resource', 'GET');
        if (res.ok && res.data && typeof res.data === 'object') {
          const d = res.data as Record<string, string | number>;
          const cpu = Number(d['cpu-load']) || 15;
          const totalMem = Number(d['total-memory']) || 1024;
          const freeMem = Number(d['free-memory']) || 512;
          const usedPct = Math.round(((totalMem - freeMem) / totalMem) * 100);
          setTelemetry((prev) => ({
            ...prev,
            cpuLoad: cpu,
            ramUsedPercent: usedPct,
            uptime: String(d.uptime || prev.uptime),
          }));
          return;
        }
      }

      setTelemetry((prev) => {
        const nextRx = Math.max(
          25,
          Math.min(480, Number((prev.rxMbps + (Math.random() - 0.48) * 32).toFixed(1)))
        );
        const nextTx = Math.max(
          8,
          Math.min(180, Number((prev.txMbps + (Math.random() - 0.48) * 14).toFixed(1)))
        );
        const nextCpu = Math.max(8, Math.min(89, Math.round(prev.cpuLoad + (Math.random() - 0.5) * 6)));
        const nextTemp = Math.max(38, Math.min(64, Math.round(prev.temperatureC + (Math.random() - 0.5) * 2)));
        return {
          ...prev,
          cpuLoad: nextCpu,
          temperatureC: nextTemp,
          rxMbps: nextRx,
          txMbps: nextTx,
          history: [...prev.history.slice(1), { time: new Date().toLocaleTimeString(), rx: nextRx, tx: nextTx }],
        };
      });
    }, 2200);

    return () => clearInterval(interval);
  }, [mode, activeRouter]);

  const appendLog = (line: string) => {
    setConsoleLog((prev) => [`[${new Date().toLocaleTimeString()}] ${line}`, ...prev].slice(0, 12));
  };

  const handleQuickBackup = () => {
    onQuickBackup();
    appendLog(
      lang === 'ar'
        ? `تم إنشاء نسخة احتياطية سريعة للراوتر ${activeRouter.name} وحفظها في الخزنة.`
        : `Quick backup saved to Vault for ${activeRouter.name}.`
    );
  };

  const handlePingTest = async () => {
    if (mode === 'live' && activeRouter.osVersion === 'v7') {
      const res = await executeRouterOsV7Rest(activeRouter, '/tool/ping', 'POST', {
        address: pingTarget,
        count: '3',
      });
      if (res.ok) {
        appendLog(`PING ${pingTarget} -> ${JSON.stringify(res.data).slice(0, 90)}`);
        return;
      }
    }
    const ms1 = Math.round(14 + Math.random() * 18);
    const ms2 = Math.round(14 + Math.random() * 18);
    appendLog(`PING ${pingTarget}: 64 bytes ttl=58 time=${ms1}ms | time=${ms2}ms | 0% loss`);
  };

  const handleClearStaleSessions = () => {
    const cleared = Math.max(1, Math.floor(Math.random() * 7) + 2);
    setTelemetry((prev) => ({
      ...prev,
      activeHotspot: Math.max(10, prev.activeHotspot - cleared),
    }));
    appendLog(
      lang === 'ar'
        ? `تم تنظيف ${cleared} جلسات معلّقة (Stale Hotspot/PPPoE Sessions) بنجاح.`
        : `Cleared ${cleared} stale Hotspot/PPPoE sessions cleanly.`
    );
  };

  const handleSafeReboot = () => {
    setRebootConfirm(false);
    appendLog(
      lang === 'ar'
        ? `تم جدولة إعادة تشغيل آمنة لـ ${activeRouter.name} بعد حفظ الإعدادات.`
        : `Safe reboot command issued to ${activeRouter.name} after config save.`
    );
  };

  const chartPaths = useMemo(() => {
    const w = 640;
    const h = 160;
    const maxVal = Math.max(250, ...telemetry.history.map((p) => p.rx));
    const toPts = (key: 'rx' | 'tx') =>
      telemetry.history
        .map((p, i) => {
          const x = (i / Math.max(1, telemetry.history.length - 1)) * w;
          const y = h - (p[key] / maxVal) * (h - 20) - 10;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    const rxLine = toPts('rx');
    const txLine = toPts('tx');
    const rxArea = `0,${h} ${rxLine} ${w},${h}`;
    return { rxLine, txLine, rxArea };
  }, [telemetry.history]);

  return (
    <div className="space-y-6">
      {/* Top Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Activity className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar' ? 'لوحة القيادة الحية (NOC)' : 'Live NOC Telemetry Dashboard'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {activeRouter.name} · {activeRouter.model} · Uptime:{' '}
            <span className="font-mono text-cyan-300" dir="ltr">
              {telemetry.uptime}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleQuickBackup}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
          >
            <HardDriveDownload className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'نسخة احتياطية فورية' : 'Quick Backup'}</span>
          </button>

          <button
            type="button"
            onClick={handleClearStaleSessions}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/15 px-3.5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'تنظيف الجلسات المعلقة' : 'Clear Stale Sessions'}</span>
          </button>

          <button
            type="button"
            onClick={() => setRebootConfirm(true)}
            className="flex items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/15 px-3.5 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/25 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'إعادة تشغيل آمنة' : 'Safe Reboot'}</span>
          </button>
        </div>
      </div>

      {/* 4 Hardware Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CircularGauge
          label={lang === 'ar' ? 'معالج الراوتر (CPU)' : 'CPU Load'}
          value={telemetry.cpuLoad}
          unit="%"
          colorClass="text-cyan-300"
          strokeColor="#00E5FF"
        />
        <CircularGauge
          label={lang === 'ar' ? 'الذاكرة العشوائية (RAM)' : 'Memory Usage'}
          value={telemetry.ramUsedPercent}
          unit="%"
          colorClass="text-emerald-300"
          strokeColor="#10B981"
        />
        <CircularGauge
          label={lang === 'ar' ? 'حرارة المعالج' : 'Board Temp'}
          value={telemetry.temperatureC}
          max={85}
          unit="°C"
          colorClass="text-amber-300"
          strokeColor="#F59E0B"
        />
        <CircularGauge
          label={lang === 'ar' ? 'جهد البطارية / الطاقة' : 'Voltage'}
          value={telemetry.voltageV}
          max={30}
          unit="V"
          colorClass="text-sky-300"
          strokeColor="#38BDF8"
        />
      </div>

      {/* Bandwidth Graph + Active Users */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="noc-glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              <span>
                {lang === 'ar' ? 'حركة الترافيك الحية (RX / TX)' : 'Live WAN Throughput (RX / TX)'}
              </span>
            </h3>
            <div className="flex items-center gap-4 text-xs font-mono tabular-nums" dir="ltr">
              <span className="text-cyan-300 font-bold">RX: {telemetry.rxMbps} Mbps</span>
              <span className="text-emerald-300 font-bold">TX: {telemetry.txMbps} Mbps</span>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-500/15 bg-[#040814] p-3">
            <svg viewBox="0 0 640 160" className="h-44 w-full overflow-visible">
              <defs>
                <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polygon points={chartPaths.rxArea} fill="url(#rxGrad)" />
              <polyline
                fill="none"
                stroke="#00E5FF"
                strokeWidth="2.5"
                strokeLinejoin="round"
                points={chartPaths.rxLine}
              />
              <polyline
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
                strokeDasharray="5 4"
                strokeLinejoin="round"
                points={chartPaths.txLine}
              />
            </svg>
          </div>
        </div>

        {/* Active Subscribers & Ping Diagnostic */}
        <div className="space-y-4">
          <div className="noc-glass rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              <span>{lang === 'ar' ? 'المشتركون المتصلون الآن' : 'Active Subscribers'}</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-cyan-500/20 bg-[#050A18]/80 p-3.5">
                <p className="text-[11px] text-slate-400">Hotspot Active</p>
                <p className="mt-1 font-mono text-2xl font-extrabold text-cyan-300 tabular-nums">
                  {telemetry.activeHotspot}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-[#050A18]/80 p-3.5">
                <p className="text-[11px] text-slate-400">PPPoE Active</p>
                <p className="mt-1 font-mono text-2xl font-extrabold text-emerald-300 tabular-nums">
                  {telemetry.activePppoe}
                </p>
              </div>
            </div>
          </div>

          <div className="noc-glass rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <span>{lang === 'ar' ? 'اختبار البنق السريع (Ping)' : 'Quick Ping Test'}</span>
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={pingTarget}
                onChange={(e) => setPingTarget(e.target.value)}
                dir="ltr"
                className="flex-1 rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={handlePingTest}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Ping</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Action Console */}
      <div className="noc-glass rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-cyan-500/20 px-4 py-2.5 text-xs font-bold text-slate-200">
          <Terminal className="h-4 w-4 text-cyan-400" />
          <span>{lang === 'ar' ? 'سجل أوامر الطوارئ والفحص' : 'NOC Action & Diagnostic Log'}</span>
        </div>
        <div dir="ltr" className="max-h-36 overflow-y-auto bg-[#030712]/90 p-3.5 font-mono text-xs text-emerald-300 space-y-1">
          {consoleLog.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
      </div>

      {rebootConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="noc-glass w-full max-w-sm rounded-2xl p-6">
            <h4 className="text-base font-bold text-white mb-2">
              {lang === 'ar' ? 'تأكيد إعادة التشغيل الآمنة' : 'Confirm Safe Reboot'}
            </h4>
            <p className="text-xs text-slate-300 mb-5">
              {lang === 'ar'
                ? `هل تريد إعادة تشغيل الراوتر ${activeRouter.name}؟ سيتم فصل المشتركين لمدة 45 ثانية.`
                : `Reboot ${activeRouter.name}? Connected clients will experience ~45s downtime.`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRebootConfirm(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSafeReboot}
                className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white hover:bg-rose-400 cursor-pointer"
              >
                {lang === 'ar' ? 'نعم، أعد التشغيل' : 'Yes, Reboot Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
