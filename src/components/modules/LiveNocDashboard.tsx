import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Ban,
  Bell,
  Cpu,
  Gauge,
  HardDriveDownload,
  Network,
  Power,
  Radar,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  ShieldAlert,
  Sparkles,
  Terminal,
  Trash2,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import {
  AppMode,
  Language,
  NocAlertItem,
  NocTelemetry,
  RouterProfile,
} from '../../types/mikrocore';
import {
  RouterActiveSession,
  RouterCloudInventory,
  RouterCloudTelemetry,
  RouterDishNeighbor,
  RouterInjectedAccount,
  RouterIpEntry,
  RouterLogEntry,
  cloudRequestInventorySync,
  cloudSendAndAwaitRouterCommand,
  detectIpConflicts,
} from '../../utils/firebaseCloud';
import {
  buildBanMacCommand,
  buildCleanExpiredAccountsCommand,
  buildDeleteAccountCommand,
  buildKickSessionCommand,
  buildPingDishCommand,
  buildSpeedLimitCommand,
  buildToggleAccountCommand,
} from '../../engine/networkEngine';
import {
  buildMigrateInjectedAccountsCommand,
  buildRebootDishCommand,
} from '../../engine/enterpriseToolsEngine';
import { loadSession } from '../../utils/storage';

type NocTab = 'sessions' | 'accounts' | 'dishes' | 'ips' | 'logs';

interface LiveNocDashboardProps {
  lang: Language;
  mode: AppMode;
  activeRouter: RouterProfile;
  tenantUuid?: string;
  liveTelemetry?: RouterCloudTelemetry | null;
  liveInventory?: RouterCloudInventory | null;
  nocAlerts?: NocAlertItem[];
  onInventoryUpdated?: (inv: RouterCloudInventory) => void;
  onQuickBackup: () => void;
}

const SANDBOX_INVENTORY: RouterCloudInventory = {
  injected_accounts: [
    { name: 'MC-88412', type: 'hotspot', profile: '8M-Plus', disabled: false },
    { name: 'ahmad_pppoe', type: 'pppoe', profile: '16M-Turbo', disabled: false },
    { name: 'MC-40199', type: 'hotspot', profile: '4M-Standard', disabled: true },
    { name: 'samer_fiber', type: 'pppoe', profile: '25M-Pro', disabled: false },
  ],
  dishes: [
    {
      identity: 'Sector-North-Rocket5AC',
      address: '10.20.0.11',
      mac: '74:83:C2:91:44:10',
      interface: 'ether3-Towers',
      platform: 'Ubiquiti airOS',
    },
    {
      identity: 'PTP-Starlink-Dish',
      address: '10.20.0.12',
      mac: 'D4:CA:6D:41:09:B2',
      interface: 'ether4-PTP',
      platform: 'MikroTik LHG',
    },
  ],
  ip_table: [
    {
      address: '192.168.88.45',
      mac: 'A4:50:46:11:2B:90',
      hostName: 'Galaxy-S24',
      status: 'bound',
      source: 'dhcp',
    },
    {
      address: '192.168.88.77',
      mac: '48:2C:A0:89:1F:03',
      hostName: 'iPhone-15-Pro',
      status: 'bound',
      source: 'dhcp',
    },
    {
      address: '192.168.88.90',
      mac: '00:1A:2B:3C:4D:5E',
      hostName: 'Laptop-Office',
      status: 'bound',
      source: 'dhcp',
    },
  ],
  logs: [
    {
      time: '00:18:42',
      topics: 'hotspot,info,debug',
      message: 'MC-88412 (192.168.88.45): logged in',
    },
    {
      time: '00:19:15',
      topics: 'pppoe,ppp,error',
      message: '<pppoe-user99>: authentication failed - wrong password',
    },
    {
      time: '00:21:03',
      topics: 'interface,warning',
      message: 'ether2 link down - check physical cable',
    },
  ],
  timestamp: Date.now(),
};

const SANDBOX_SESSIONS: RouterActiveSession[] = [
  {
    user: 'MC-88412',
    type: 'hotspot',
    address: '192.168.88.45',
    mac: 'A4:50:46:11:2B:90',
    uptime: '02:14:09',
  },
  {
    user: 'ahmad_pppoe',
    type: 'pppoe',
    address: '10.10.20.14',
    mac: '48:2C:A0:89:1F:03',
    uptime: '1d 06:11:44',
  },
  {
    user: 'samer_fiber',
    type: 'pppoe',
    address: '10.10.20.22',
    mac: '00:1A:2B:3C:4D:5E',
    uptime: '05:42:18',
  },
];

function translateLogHighlight(topics: string, message: string, lang: Language): {
  isError: boolean;
  isWarning: boolean;
  hint: string;
} {
  const lower = `${topics} ${message}`.toLowerCase();
  const isError =
    lower.includes('error') ||
    lower.includes('critical') ||
    lower.includes('failed') ||
    lower.includes('link down') ||
    lower.includes('conflict');
  const isWarning =
    !isError && (lower.includes('warning') || lower.includes('timeout') || lower.includes('retry'));

  if (lower.includes('authentication failed') || lower.includes('wrong password')) {
    return {
      isError: true,
      isWarning: false,
      hint: lang === 'ar' ? 'خطأ مصادقة: كلمة مرور غير صحيحة' : 'Auth failure: invalid credentials',
    };
  }
  if (lower.includes('link down')) {
    return {
      isError: true,
      isWarning: false,
      hint: lang === 'ar' ? 'انقطاع كابل أو توقف المنفذ الفيزيائي' : 'Physical link down detected',
    };
  }
  if (lower.includes('timeout')) {
    return {
      isError: false,
      isWarning: true,
      hint: lang === 'ar' ? 'تأخر استجابة / انتهاء المهلة' : 'Timeout / delayed response',
    };
  }
  if (lower.includes('conflict') || lower.includes('duplicate')) {
    return {
      isError: true,
      isWarning: false,
      hint: lang === 'ar' ? 'تعارض عنوان IP داخل الشبكة' : 'IP address conflict detected',
    };
  }
  if (isError) {
    return {
      isError: true,
      isWarning: false,
      hint: lang === 'ar' ? 'خطأ نظام يتطلب المراجعة' : 'System error requires review',
    };
  }
  return { isError: false, isWarning, hint: '' };
}

function CircularGauge({
  label,
  value,
  displayText,
  max = 100,
  unit,
  colorClass,
  strokeColor,
  subLabel,
}: {
  label: string;
  value: number | null;
  displayText?: string;
  max?: number;
  unit: string;
  colorClass: string;
  strokeColor: string;
  subLabel?: string;
}) {
  const unsupported = value === null;
  const numericVal = value ?? 0;
  const pct = unsupported ? 0 : Math.max(0, Math.min(100, (numericVal / max) * 100));
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
            stroke={unsupported ? 'rgba(148, 163, 184, 0.25)' : strokeColor}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <span
          dir="ltr"
          className={`absolute font-mono text-xs font-bold tabular-nums ${
            unsupported ? 'text-slate-500' : colorClass
          }`}
        >
          {unsupported ? 'N/A' : `${numericVal}${unit}`}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-400">{label}</p>
        <p
          className={`mt-1 text-base font-extrabold tabular-nums text-start ${
            unsupported ? 'text-slate-400 text-sm' : 'font-mono text-lg text-white'
          }`}
        >
          {displayText || (unsupported ? 'غير مدعوم' : `${numericVal} ${unit}`)}
        </p>
        {subLabel && <p className="mt-0.5 text-[11px] font-mono text-slate-400">{subLabel}</p>}
      </div>
    </div>
  );
}

export const LiveNocDashboard: React.FC<LiveNocDashboardProps> = ({
  lang,
  mode,
  activeRouter,
  tenantUuid,
  liveTelemetry,
  liveInventory,
  nocAlerts = [],
  onInventoryUpdated,
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
    pingMs: 24,
    interfaces: [
      { name: 'ether1-WAN', running: true },
      { name: 'ether2-Backup', running: false },
      { name: 'bridge-LAN', running: true },
    ],
    history: Array.from({ length: 18 }, (_, i) => ({
      time: `${i}`,
      rx: 130 + Math.round(Math.sin(i * 0.6) * 45 + i * 2),
      tx: 32 + Math.round(Math.cos(i * 0.5) * 14),
    })),
  }));

  const [activeTab, setActiveTab] = useState<NocTab>('sessions');
  const [sessionSearch, setSessionSearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [speedModalSession, setSpeedModalSession] = useState<RouterActiveSession | null>(null);
  const [speedInput, setSpeedInput] = useState('4M/4M');

  const [sandboxSessions, setSandboxSessions] = useState<RouterActiveSession[]>(SANDBOX_SESSIONS);
  const [sandboxInventory, setSandboxInventory] = useState<RouterCloudInventory>(SANDBOX_INVENTORY);
  const [syncingInventory, setSyncingInventory] = useState(false);
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<string>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const [pingTarget, setPingTarget] = useState('1.1.1.1');
  const [consoleLog, setConsoleLog] = useState<string[]>([
    `Shaban MikroCore NOC Ready · ${activeRouter.name} (${activeRouter.host})`,
  ]);
  const [rebootConfirm, setRebootConfirm] = useState(false);
  const [dishRebootConfirmKey, setDishRebootConfirmKey] = useState<string | null>(null);

  // Sync directly from Firebase Cloud Agent telemetry when available in Live mode
  useEffect(() => {
    if (mode !== 'live' || !liveTelemetry) return;

    const totalMem = liveTelemetry.totalMem || 0;
    const freeMem = liveTelemetry.freeMem || 0;
    const totalMb = totalMem > 0 ? Math.round(totalMem / (1024 * 1024)) : 0;
    const usedMb = totalMem > 0 ? Math.max(0, Math.round((totalMem - freeMem) / (1024 * 1024))) : 0;
    const usedPct =
      totalMem > 0 ? Math.min(100, Math.max(0, Math.round(((totalMem - freeMem) / totalMem) * 100))) : 0;

    const rxMbps = Number((liveTelemetry.rxBps / 1_000_000).toFixed(2));
    const txMbps = Number((liveTelemetry.txBps / 1_000_000).toFixed(2));

    setTelemetry((prev) => ({
      ...prev,
      cpuLoad: liveTelemetry.cpu,
      ramUsedPercent: usedPct,
      ramTotalMb: totalMb > 0 ? totalMb : prev.ramTotalMb,
      ramUsedMb: totalMb > 0 ? usedMb : prev.ramUsedMb,
      temperatureC: liveTelemetry.temp,
      voltageV: liveTelemetry.volt,
      uptime: liveTelemetry.uptime || prev.uptime,
      activeHotspot: liveTelemetry.hotspot,
      activePppoe: liveTelemetry.ppp,
      rxMbps,
      txMbps,
      pingMs: liveTelemetry.pingMs,
      interfaces: liveTelemetry.interfaces,
      history: [
        ...prev.history.slice(1),
        {
          time: new Date(liveTelemetry.timestamp || Date.now()).toLocaleTimeString(),
          rx: rxMbps,
          tx: txMbps,
        },
      ],
    }));
  }, [mode, liveTelemetry]);

  // Sandbox simulation ticks (disabled whenever real Cloud Agent liveTelemetry is active)
  useEffect(() => {
    if (mode === 'live' && liveTelemetry) return;

    const interval = setInterval(() => {
      if (mode === 'live') return;
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
        const nextTemp =
          prev.temperatureC === null
            ? null
            : Math.max(38, Math.min(64, Math.round(prev.temperatureC + (Math.random() - 0.5) * 2)));
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
  }, [mode, liveTelemetry]);

  const effectiveTenant =
    tenantUuid || loadSession()?.tenantUuid || '00000000-0000-4000-8000-000000000001';

  const appendLog = (line: string) => {
    setConsoleLog((prev) => [`[${new Date().toLocaleTimeString()}] ${line}`, ...prev].slice(0, 14));
  };

  const activeSessions =
    mode === 'live' && liveTelemetry ? liveTelemetry.active_sessions : sandboxSessions;

  const currentInventory =
    mode === 'live'
      ? liveInventory || { injected_accounts: [], dishes: [], ip_table: [], logs: [], timestamp: 0 }
      : sandboxInventory;

  const ipConflicts = useMemo(
    () => detectIpConflicts(currentInventory.ip_table),
    [currentInventory.ip_table]
  );

  const filteredSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    if (!q) return activeSessions;
    return activeSessions.filter(
      (s) =>
        s.user.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.mac.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q)
    );
  }, [activeSessions, sessionSearch]);

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return currentInventory.injected_accounts;
    return currentInventory.injected_accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.profile.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q)
    );
  }, [currentInventory.injected_accounts, accountSearch]);

  const sendCloudAction = async (
    actionKey: string,
    script: string,
    successAr: string,
    successEn: string,
    sandboxMutate?: () => void
  ) => {
    if (mode === 'sandbox') {
      sandboxMutate?.();
      appendLog(lang === 'ar' ? `${successAr} (محاكاة)` : `${successEn} (Sandbox)`);
      return;
    }

    setBusyActionKey(actionKey);
    appendLog(
      lang === 'ar'
        ? `جارٍ إرسال الأمر إلى الراوتر ${activeRouter.name} عبر السحابة...`
        : `Sending command to ${activeRouter.name} via Cloud Agent...`
    );

    const res = await cloudSendAndAwaitRouterCommand(effectiveTenant, activeRouter.id, script);
    setBusyActionKey(null);

    if (!res.ok) {
      appendLog(
        lang === 'ar'
          ? `فشل الإرسال (${res.error || 'خطأ شبكة'}).`
          : `Failed to push (${res.error || 'network error'}).`
      );
      return;
    }

    appendLog(
      res.executed
        ? lang === 'ar'
          ? `${successAr} ✅`
          : `${successEn} ✅`
        : lang === 'ar'
        ? `تم وضع الأمر في قائمة التنفيذ السحابية (سينفذه الراوتر خلال ثوانٍ).`
        : `Command queued in Firebase (router will execute within seconds).`
    );
  };

  const handleSyncInventory = async () => {
    if (mode === 'sandbox') {
      setSyncingInventory(true);
      await new Promise((r) => setTimeout(r, 350));
      setSandboxInventory({ ...SANDBOX_INVENTORY, timestamp: Date.now() });
      setSyncingInventory(false);
      appendLog(
        lang === 'ar'
          ? 'تمت مزامنة الجرد الثقيل في وضع المحاكاة (الحسابات، الصحون، الآيبيات، السجل).'
          : 'Synced Sandbox heavy inventory (accounts, dishes, IP table, logs).'
      );
      return;
    }

    setSyncingInventory(true);
    appendLog(
      lang === 'ar'
        ? 'تم إرسال أمر SYNC_INVENTORY إلى الراوتر — بانتظار سحب الوكيل ورفع الجرد خلال ثوانٍ...'
        : 'Queued SYNC_INVENTORY — waiting for Cloud Agent to upload heavy inventory...'
    );

    const res = await cloudRequestInventorySync(effectiveTenant, activeRouter.id);
    setSyncingInventory(false);

    if (res.ok && res.inventory) {
      onInventoryUpdated?.(res.inventory);
      appendLog(
        lang === 'ar'
          ? `تم تحديث الجرد الحي بنجاح: ${res.inventory.injected_accounts.length} حساب · ${res.inventory.dishes.length} صحن · ${res.inventory.ip_table.length} IP · ${res.inventory.logs.length} سجل ✅`
          : `Inventory synced: ${res.inventory.injected_accounts.length} accounts · ${res.inventory.dishes.length} dishes · ${res.inventory.ip_table.length} IPs ✅`
      );
    } else {
      appendLog(
        lang === 'ar'
          ? 'تم إرسال طلب SYNC_INVENTORY، أعد الفحص أو انتظر نبضة الوكيل القادمة.'
          : 'SYNC_INVENTORY queued; retry or wait for next agent heartbeat.'
      );
    }
  };

  const handleEnableBrowserNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
    } catch {
      // ignore unsupported browsers
    }
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
    if (mode === 'live') {
      const safeTarget = pingTarget.replace(/[^a-zA-Z0-9.:-]/g, '') || '1.1.1.1';
      await sendCloudAction(
        'quick_ping',
        buildPingDishCommand(safeTarget),
        `تم تنفيذ Ping إلى ${safeTarget} على ${activeRouter.name}`,
        `Ping to ${safeTarget} executed on ${activeRouter.name}`
      );
      return;
    }
    const ms1 = Math.round(14 + Math.random() * 18);
    const ms2 = Math.round(14 + Math.random() * 18);
    appendLog(`PING ${pingTarget}: 64 bytes ttl=58 time=${ms1}ms | time=${ms2}ms | 0% loss`);
  };

  const handleClearStaleSessions = async () => {
    await sendCloudAction(
      'clear_stale',
      '/ip hotspot active remove [find idle-time>15m]',
      'تم تنظيف الجلسات المعلقة بنجاح',
      'Cleared stale Hotspot/PPPoE sessions',
      () => {
        setSandboxSessions((prev) => prev.slice(0, Math.max(1, prev.length - 1)));
      }
    );
  };

  const handleSafeReboot = async () => {
    setRebootConfirm(false);
    await sendCloudAction(
      'safe_reboot',
      '/system reboot',
      `تم إرسال أمر إعادة التشغيل الآمنة إلى ${activeRouter.name}`,
      `Safe reboot issued to ${activeRouter.name}`
    );
  };

  const chartPaths = useMemo(() => {
    const w = 640;
    const h = 160;
    const maxVal = Math.max(50, ...telemetry.history.map((p) => p.rx));
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

  const pingValue: number | null = telemetry.pingMs ?? null;
  const pingLabel =
    pingValue === null
      ? lang === 'ar'
        ? 'انقطاع / فقدان حزم'
        : 'Timeout / Loss'
      : `${pingValue} ms`;

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
            {activeRouter.name} · {liveTelemetry?.board || activeRouter.model}
            {liveTelemetry?.version ? ` · v${liveTelemetry.version}` : ''} · Uptime:{' '}
            <span className="font-mono text-cyan-300" dir="ltr">
              {telemetry.uptime}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {notifPerm === 'default' && (
            <button
              type="button"
              onClick={handleEnableBrowserNotifications}
              className="flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/25 cursor-pointer whitespace-nowrap"
            >
              <Bell className="h-3.5 w-3.5" />
              <span>{lang === 'ar' ? 'تفعيل تنبيهات المتصفح' : 'Enable Push Alerts'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleQuickBackup}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer whitespace-nowrap"
          >
            <HardDriveDownload className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'نسخة احتياطية فورية' : 'Quick Backup'}</span>
          </button>

          <button
            type="button"
            onClick={handleClearStaleSessions}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/15 px-3.5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'تنظيف الجلسات المعلقة' : 'Clear Stale Sessions'}</span>
          </button>

          <button
            type="button"
            onClick={() => setRebootConfirm(true)}
            className="flex items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/15 px-3.5 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/25 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'إعادة تشغيل آمنة' : 'Safe Reboot'}</span>
          </button>
        </div>
      </div>

      {/* Smart NOC Alerts Banner */}
      {nocAlerts.length > 0 && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/45 bg-rose-500/12 p-4 space-y-2"
        >
          <div className="flex items-center gap-2 text-xs font-extrabold text-rose-200">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>
              {lang === 'ar'
                ? `تنبيهات المراقبة الذكية (${nocAlerts.length})`
                : `Smart NOC Alerts (${nocAlerts.length})`}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {nocAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  alert.severity === 'critical'
                    ? 'border-rose-500/40 bg-rose-950/50 text-rose-100'
                    : 'border-amber-500/40 bg-amber-950/40 text-amber-100'
                }`}
              >
                <p className="font-bold">{lang === 'ar' ? alert.titleAr : alert.titleEn}</p>
                <p className="mt-0.5 text-[11px] opacity-85">
                  {lang === 'ar' ? alert.detailAr : alert.detailEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 Hardware Gauges (Real Sensors or "غير مدعوم") */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CircularGauge
          label={lang === 'ar' ? 'معالج الراوتر (CPU)' : 'CPU Load'}
          value={telemetry.cpuLoad}
          unit="%"
          colorClass={telemetry.cpuLoad > 85 ? 'text-rose-300' : 'text-cyan-300'}
          strokeColor={telemetry.cpuLoad > 85 ? '#F43F5E' : '#00E5FF'}
        />
        <CircularGauge
          label={lang === 'ar' ? 'الذاكرة العشوائية (RAM)' : 'Memory Usage'}
          value={telemetry.ramUsedPercent}
          unit="%"
          colorClass="text-emerald-300"
          strokeColor="#10B981"
          subLabel={`${telemetry.ramUsedMb} / ${telemetry.ramTotalMb} MB`}
        />
        <CircularGauge
          label={lang === 'ar' ? 'حرارة المعالج' : 'Board Temp'}
          value={telemetry.temperatureC}
          displayText={
            telemetry.temperatureC === null
              ? lang === 'ar'
                ? 'غير مدعوم'
                : 'Unsupported'
              : `${telemetry.temperatureC} °C`
          }
          max={85}
          unit="°C"
          colorClass={
            telemetry.temperatureC !== null && telemetry.temperatureC > 65
              ? 'text-rose-300'
              : 'text-amber-300'
          }
          strokeColor={
            telemetry.temperatureC !== null && telemetry.temperatureC > 65 ? '#F43F5E' : '#F59E0B'
          }
        />
        <CircularGauge
          label={lang === 'ar' ? 'جهد البطارية / الطاقة' : 'Voltage'}
          value={telemetry.voltageV}
          displayText={
            telemetry.voltageV === null
              ? lang === 'ar'
                ? 'غير مدعوم'
                : 'Unsupported'
              : `${telemetry.voltageV} V`
          }
          max={30}
          unit="V"
          colorClass="text-sky-300"
          strokeColor="#38BDF8"
        />
      </div>

      {/* Bandwidth Graph + Ping & WAN Interfaces */}
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

          {/* Interface Running Status Strip */}
          {telemetry.interfaces && telemetry.interfaces.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400">
                {lang === 'ar' ? 'منافذ الشبكة والـ WAN:' : 'Router Interfaces:'}
              </span>
              {telemetry.interfaces.map((iface) => (
                <span
                  key={iface.name}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-mono ${
                    iface.running
                      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                      : 'border-rose-500/35 bg-rose-500/10 text-rose-200'
                  }`}
                >
                  {iface.running ? (
                    <Wifi className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <WifiOff className="h-3 w-3 text-rose-400" />
                  )}
                  <span dir="ltr">{iface.name}</span>
                  <span>
                    · {iface.running ? (lang === 'ar' ? 'يعمل' : 'UP') : lang === 'ar' ? 'متوقف' : 'DOWN'}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Active Subscribers & Ping Latency */}
        <div className="space-y-4">
          <div className="noc-glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                <span>{lang === 'ar' ? 'المشتركون المتصلون الآن' : 'Active Subscribers'}</span>
              </h3>
              <span
                dir="ltr"
                className={`text-xs font-mono font-bold tabular-nums whitespace-nowrap shrink-0 ${
                  pingValue === null || pingValue > 150
                    ? 'text-rose-300'
                    : pingValue > 80
                    ? 'text-amber-300'
                    : 'text-emerald-300'
                }`}
              >
                Ping 1.1.1.1: {pingLabel}
              </span>
            </div>

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
                aria-label={lang === 'ar' ? 'هدف فحص البنق' : 'Ping target'}
                className="flex-1 rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={handlePingTest}
                disabled={busyActionKey === 'quick_ping'}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Ping</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5-Tab Enterprise Live NOC Workspace */}
      <div className="noc-glass rounded-2xl overflow-hidden">
        <div
          role="tablist"
          aria-label={lang === 'ar' ? 'أقسام المراقبة والتحكم المباشر' : 'NOC Live Sub-Tabs'}
          className="flex flex-wrap items-center gap-1.5 border-b border-cyan-500/20 bg-slate-950/65 p-3"
        >
          {(
            [
              {
                id: 'sessions' as NocTab,
                icon: Users,
                labelAr: 'المتصلون الآن',
                labelEn: 'Active Sessions',
                count: activeSessions.length,
              },
              {
                id: 'accounts' as NocTab,
                icon: UserCheck,
                labelAr: 'الحسابات المحقونة',
                labelEn: 'Injected Accounts',
                count: currentInventory.injected_accounts.length,
              },
              {
                id: 'dishes' as NocTab,
                icon: Radar,
                labelAr: 'الصحون والأبراج',
                labelEn: 'Dishes & Neighbors',
                count: currentInventory.dishes.length,
              },
              {
                id: 'ips' as NocTab,
                icon: Network,
                labelAr: 'الآيبيات وكاشف المتطفلين',
                labelEn: 'IP & Anti-Sniffer',
                count: currentInventory.ip_table.length,
              },
              {
                id: 'logs' as NocTab,
                icon: ScrollText,
                labelAr: 'سجل النظام',
                labelEn: 'Live Router Logs',
                count: currentInventory.logs.length,
              },
            ] as const
          ).map((tabItem) => {
            const Icon = tabItem.icon;
            const isActive = activeTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setActiveTab(tabItem.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-cyan-400 text-slate-950 shadow-sm'
                    : 'border border-slate-800 bg-[#0B142B]/80 text-slate-300 hover:border-cyan-500/40 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{lang === 'ar' ? tabItem.labelAr : tabItem.labelEn}</span>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    isActive ? 'text-slate-900' : 'text-cyan-300'
                  }`}
                >
                  ({tabItem.count})
                </span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: Active Sessions */}
        {activeTab === 'sessions' && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute top-2.5 start-3" />
                <input
                  type="text"
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  placeholder={
                    lang === 'ar' ? 'ابحث باسم المشترك أو IP أو MAC...' : 'Search user, IP, or MAC...'
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 ps-8 pe-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
              <span className="text-xs text-slate-400">
                {lang === 'ar'
                  ? `عرض ${filteredSessions.length} جلسة متصلة (بحد أقصى 30 لكل نبضة)`
                  : `Showing ${filteredSessions.length} live sessions (up to 30/pulse)`}
              </span>
            </div>

            {filteredSessions.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                {lang === 'ar'
                  ? 'لا توجد جلسات مطابقة حالياً.'
                  : 'No active sessions match your filter.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                    <tr>
                      <th className="px-3 py-2.5 text-start">{lang === 'ar' ? 'المشترك' : 'User'}</th>
                      <th className="px-3 py-2.5 text-start">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                      <th className="px-3 py-2.5 text-start">IP</th>
                      <th className="px-3 py-2.5 text-start">MAC</th>
                      <th className="px-3 py-2.5 text-start">{lang === 'ar' ? 'المدة' : 'Uptime'}</th>
                      <th className="px-3 py-2.5 text-end">{lang === 'ar' ? 'تحكم فوري' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredSessions.map((ses, idx) => (
                      <tr key={`${ses.type}-${ses.user}-${idx}`} className="hover:bg-cyan-500/5">
                        <td className="px-3 py-2.5 font-mono font-bold text-cyan-200" dir="ltr">
                          {ses.user}
                        </td>
                        <td className="px-3 py-2.5 font-mono uppercase text-[11px] text-emerald-300">
                          {ses.type}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-200 tabular-nums" dir="ltr">
                          {ses.address}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-400 tabular-nums" dir="ltr">
                          {ses.mac}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-300 tabular-nums" dir="ltr">
                          {ses.uptime}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={busyActionKey === `kick_${ses.user}`}
                              onClick={() =>
                                sendCloudAction(
                                  `kick_${ses.user}`,
                                  buildKickSessionCommand(ses.type, ses.user),
                                  `تم طرد المشترك ${ses.user}`,
                                  `Kicked session ${ses.user}`,
                                  () => {
                                    setSandboxSessions((prev) =>
                                      prev.filter((item) => item.user !== ses.user)
                                    );
                                  }
                                )
                              }
                              className="rounded-lg border border-amber-500/35 bg-amber-500/12 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25 cursor-pointer whitespace-nowrap"
                            >
                              {lang === 'ar' ? 'طرد (Kick)' : 'Kick'}
                            </button>
                            <button
                              type="button"
                              disabled={busyActionKey === `ban_${ses.mac}`}
                              onClick={() =>
                                sendCloudAction(
                                  `ban_${ses.mac}`,
                                  buildBanMacCommand(ses.mac, ses.user),
                                  `تم حظر MAC (${ses.mac}) للمشترك ${ses.user}`,
                                  `Banned MAC ${ses.mac} (${ses.user})`,
                                  () => {
                                    setSandboxSessions((prev) =>
                                      prev.filter((item) => item.mac !== ses.mac)
                                    );
                                  }
                                )
                              }
                              className="rounded-lg border border-rose-500/35 bg-rose-500/12 px-2.5 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500/25 cursor-pointer whitespace-nowrap"
                            >
                              {lang === 'ar' ? 'حظر MAC' : 'Ban MAC'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSpeedModalSession(ses);
                                setSpeedInput('4M/4M');
                              }}
                              className="flex items-center gap-1 rounded-lg border border-cyan-500/35 bg-cyan-500/12 px-2.5 py-1 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer whitespace-nowrap"
                            >
                              <Gauge className="h-3 w-3" />
                              <span>{lang === 'ar' ? 'تحديد سرعة' : 'Speed Limit'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Injected Accounts */}
        {activeTab === 'accounts' && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute top-2.5 start-3" />
                <input
                  type="text"
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  placeholder={lang === 'ar' ? 'بحث في الحسابات المحقونة...' : 'Search accounts...'}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 ps-8 pe-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={syncingInventory}
                  onClick={handleSyncInventory}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:brightness-110 disabled:opacity-60 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncingInventory ? 'animate-spin' : ''}`} />
                  <span>{lang === 'ar' ? 'تحديث القائمة الآن 🔄' : 'Refresh List Now 🔄'}</span>
                </button>
                <button
                  type="button"
                  disabled={busyActionKey === 'clean_expired'}
                  onClick={() =>
                    sendCloudAction(
                      'clean_expired',
                      buildCleanExpiredAccountsCommand(),
                      'تم إرسال أمر تنظيف الحسابات المنتهية والمعطلة',
                      'Cleaned expired and disabled accounts',
                      () => {
                        setSandboxInventory((prev) => ({
                          ...prev,
                          injected_accounts: prev.injected_accounts.filter((a) => !a.disabled),
                        }));
                      }
                    )
                  }
                  className="flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/25 cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{lang === 'ar' ? 'تنظيف المنتهية 🧹' : 'Clean Expired 🧹'}</span>
                </button>
                <button
                  type="button"
                  disabled={
                    busyActionKey === 'migrate_all_accounts' ||
                    currentInventory.injected_accounts.length === 0
                  }
                  onClick={() =>
                    sendCloudAction(
                      'migrate_all_accounts',
                      buildMigrateInjectedAccountsCommand(
                        currentInventory.injected_accounts,
                        activeRouter.osVersion
                      ),
                      `تم ترحيل ${currentInventory.injected_accounts.length} حساب إلى السيرفر النشط (${activeRouter.name})`,
                      `Migrated ${currentInventory.injected_accounts.length} accounts to active router (${activeRouter.name})`
                    )
                  }
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:brightness-110 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>
                    {lang === 'ar'
                      ? 'ترحيل كل الحسابات للسيرفر النشط 🚀'
                      : 'Migrate All Accounts to Active Router 🚀'}
                  </span>
                </button>
              </div>
            </div>

            {filteredAccounts.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-xs text-slate-400">
                  {lang === 'ar'
                    ? 'لم يتم جلب قائمة الحسابات المحقونة بعد. اضغط على "تحديث القائمة الآن 🔄" لسحبها من الراوتر.'
                    : 'No injected accounts synced yet. Click "Refresh List Now 🔄" to pull from router.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                    <tr>
                      <th className="px-3 py-2.5 text-start">{lang === 'ar' ? 'الحساب' : 'Account'}</th>
                      <th className="px-3 py-2.5 text-start">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                      <th className="px-3 py-2.5 text-start">{lang === 'ar' ? 'الباقة' : 'Profile'}</th>
                      <th className="px-3 py-2.5 text-start">{lang === 'ar' ? 'الحالة' : 'State'}</th>
                      <th className="px-3 py-2.5 text-end">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredAccounts.map((acc: RouterInjectedAccount, idx) => (
                      <tr key={`${acc.type}-${acc.name}-${idx}`} className="hover:bg-cyan-500/5">
                        <td className="px-3 py-2.5 font-mono font-bold text-white" dir="ltr">
                          {acc.name}
                        </td>
                        <td className="px-3 py-2.5 font-mono uppercase text-[11px] text-cyan-300">
                          {acc.type}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-300" dir="ltr">
                          {acc.profile}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`font-bold ${
                              acc.disabled ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {acc.disabled
                              ? lang === 'ar'
                                ? 'معطّل'
                                : 'Disabled'
                              : lang === 'ar'
                              ? 'مفعّل'
                              : 'Active'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                sendCloudAction(
                                  `toggle_${acc.name}`,
                                  buildToggleAccountCommand(acc.type, acc.name, !acc.disabled),
                                  acc.disabled
                                    ? `تم تفعيل الحساب ${acc.name}`
                                    : `تم تعطيل الحساب ${acc.name}`,
                                  acc.disabled
                                    ? `Enabled account ${acc.name}`
                                    : `Disabled account ${acc.name}`,
                                  () => {
                                    setSandboxInventory((prev) => ({
                                      ...prev,
                                      injected_accounts: prev.injected_accounts.map((item) =>
                                        item.name === acc.name && item.type === acc.type
                                          ? { ...item, disabled: !acc.disabled }
                                          : item
                                      ),
                                    }));
                                  }
                                )
                              }
                              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:border-cyan-400 cursor-pointer whitespace-nowrap"
                            >
                              <Power className="h-3 w-3 text-cyan-400" />
                              <span>
                                {acc.disabled
                                  ? lang === 'ar'
                                    ? 'تفعيل'
                                    : 'Enable'
                                  : lang === 'ar'
                                  ? 'تعطيل'
                                  : 'Disable'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                sendCloudAction(
                                  `del_${acc.name}`,
                                  buildDeleteAccountCommand(acc.type, acc.name),
                                  `تم حذف الحساب ${acc.name}`,
                                  `Deleted account ${acc.name}`,
                                  () => {
                                    setSandboxInventory((prev) => ({
                                      ...prev,
                                      injected_accounts: prev.injected_accounts.filter(
                                        (item) => !(item.name === acc.name && item.type === acc.type)
                                      ),
                                    }));
                                  }
                                )
                              }
                              className="rounded-lg border border-rose-500/35 bg-rose-500/12 px-2.5 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500/25 cursor-pointer whitespace-nowrap"
                            >
                              {lang === 'ar' ? 'حذف' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Dishes & Neighbors */}
        {activeTab === 'dishes' && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-300">
                {lang === 'ar'
                  ? 'الصحون والأبراج المكتشفة عبر بروتوكول Neighbor / ARP'
                  : 'Discovered Wireless Dishes, Towers & Neighbors'}
              </p>
              <button
                type="button"
                disabled={syncingInventory}
                onClick={handleSyncInventory}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:brightness-110 disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingInventory ? 'animate-spin' : ''}`} />
                <span>{lang === 'ar' ? 'تحديث الصحون 🔄' : 'Refresh Dishes 🔄'}</span>
              </button>
            </div>

            {currentInventory.dishes.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                {lang === 'ar'
                  ? 'اضغط على "تحديث الصحون 🔄" لجلب الأجهزة والصحون المتصلة بالراوتر.'
                  : 'Click "Refresh Dishes 🔄" to discover antennas and neighboring devices.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                    <tr>
                      <th className="px-3 py-2.5 text-start">{lang === 'ar' ? 'الهوية' : 'Identity'}</th>
                      <th className="px-3 py-2.5 text-start">IP</th>
                      <th className="px-3 py-2.5 text-start">MAC</th>
                      <th className="px-3 py-2.5 text-start">{lang === 'ar' ? 'المنفذ' : 'Interface'}</th>
                      <th className="px-3 py-2.5 text-start">{lang === 'ar' ? 'النظام' : 'Platform'}</th>
                      <th className="px-3 py-2.5 text-end">{lang === 'ar' ? 'تحكم بالصحن' : 'Dish Control'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {currentInventory.dishes.map((d: RouterDishNeighbor, idx) => {
                      const dishKey = `${d.mac || d.address}-${idx}`;
                      const confirmingReboot = dishRebootConfirmKey === dishKey;
                      return (
                        <tr key={dishKey} className="hover:bg-cyan-500/5">
                          <td className="px-3 py-2.5 font-semibold text-white">{d.identity || '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-cyan-300 tabular-nums" dir="ltr">
                            {d.address || '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-300 tabular-nums" dir="ltr">
                            {d.mac || '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-emerald-300" dir="ltr">
                            {d.interface || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-300">{d.platform || '—'}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={!d.address}
                                onClick={() =>
                                  sendCloudAction(
                                    `ping_dish_${d.address}`,
                                    buildPingDishCommand(d.address),
                                    `تم إرسال Ping إلى الصحن ${d.identity} (${d.address})`,
                                    `Ping issued to ${d.identity} (${d.address})`
                                  )
                                }
                                className="rounded-lg border border-cyan-500/35 bg-cyan-500/12 px-2.5 py-1 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                              >
                                Ping 📡
                              </button>

                              {confirmingReboot ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={busyActionKey === `reboot_dish_${dishKey}`}
                                    onClick={() => {
                                      setDishRebootConfirmKey(null);
                                      sendCloudAction(
                                        `reboot_dish_${dishKey}`,
                                        buildRebootDishCommand(d.interface || 'ether1', d.identity || d.address),
                                        `تم إرسال أمر إعادة تشغيل الصحن/المنفذ ${d.identity} (${d.interface})`,
                                        `Sent PoE/interface reboot for ${d.identity} (${d.interface})`
                                      );
                                    }}
                                    className="rounded-lg bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-400 cursor-pointer whitespace-nowrap"
                                  >
                                    {lang === 'ar' ? 'تأكيد 🔄' : 'Confirm 🔄'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDishRebootConfirmKey(null)}
                                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 cursor-pointer whitespace-nowrap"
                                  >
                                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!d.interface && !d.address}
                                  onClick={() => setDishRebootConfirmKey(dishKey)}
                                  className="rounded-lg border border-amber-500/35 bg-amber-500/12 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                                >
                                  Reboot 🔄
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: IP & Anti-Sniffer */}
        {activeTab === 'ips' && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-300">
                {lang === 'ar'
                  ? 'جدول DHCP Leases و ARP وكشف تعارض العناوين'
                  : 'DHCP Leases, ARP Table & IP Conflict Detector'}
              </p>
              <button
                type="button"
                disabled={syncingInventory}
                onClick={handleSyncInventory}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:brightness-110 disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingInventory ? 'animate-spin' : ''}`} />
                <span>{lang === 'ar' ? 'تحديث الآيبيات 🔄' : 'Refresh IP Table 🔄'}</span>
              </button>
            </div>

            {ipConflicts.length > 0 && (
              <div className="rounded-xl border border-rose-500/45 bg-rose-500/12 px-4 py-3 text-xs text-rose-100 flex items-start gap-2.5">
                <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold">
                    {lang === 'ar'
                      ? 'تحذير تعارض IP / اشتباه انتحال ARP!'
                      : 'IP Conflict / Potential ARP Spoofing Detected!'}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px]" dir="ltr">
                    {ipConflicts.join(', ')}
                  </p>
                </div>
              </div>
            )}

            {currentInventory.ip_table.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                {lang === 'ar'
                  ? 'اضغط على "تحديث الآيبيات 🔄" لجلب جدول الأجهزة والعناوين من الراوتر.'
                  : 'Click "Refresh IP Table 🔄" to fetch DHCP leases and ARP table.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                    <tr>
                      <th className="px-3 py-2.5 text-start">IP</th>
                      <th className="px-3 py-2.5 text-start">MAC</th>
                      <th className="px-3 py-2.5 text-start">{lang === 'ar' ? 'الاسم / المنفذ' : 'Host / Port'}</th>
                      <th className="px-3 py-2.5 text-start">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                      <th className="px-3 py-2.5 text-end">{lang === 'ar' ? 'حظر' : 'Block'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {currentInventory.ip_table.map((entry: RouterIpEntry, idx) => {
                      const hasConflict = ipConflicts.includes(entry.address);
                      return (
                        <tr
                          key={`${entry.address}-${entry.mac}-${idx}`}
                          className={hasConflict ? 'bg-rose-500/10' : 'hover:bg-cyan-500/5'}
                        >
                          <td className="px-3 py-2.5 font-mono font-bold text-cyan-300 tabular-nums" dir="ltr">
                            {entry.address}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-300 tabular-nums" dir="ltr">
                            {entry.mac}
                          </td>
                          <td className="px-3 py-2.5 text-slate-200">{entry.hostName || '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400">
                            {entry.status} {entry.source ? `· ${entry.source}` : ''}
                            {hasConflict && (
                              <span className="ms-2 font-sans font-bold text-rose-300">
                                ({lang === 'ar' ? 'تعارض!' : 'CONFLICT'})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-end">
                            <button
                              type="button"
                              disabled={!entry.mac}
                              onClick={() =>
                                sendCloudAction(
                                  `block_ip_mac_${entry.mac}`,
                                  buildBanMacCommand(entry.mac, entry.hostName || entry.address),
                                  `تم حظر MAC المتطفل (${entry.mac})`,
                                  `Blocked MAC ${entry.mac}`,
                                  () => {
                                    setSandboxInventory((prev) => ({
                                      ...prev,
                                      ip_table: prev.ip_table.filter((i) => i.mac !== entry.mac),
                                    }));
                                  }
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/12 px-2.5 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500/25 cursor-pointer whitespace-nowrap"
                            >
                              <Ban className="h-3 w-3" />
                              <span>{lang === 'ar' ? 'حظر MAC' : 'Block MAC'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Live Router Logs */}
        {activeTab === 'logs' && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-300">
                {lang === 'ar'
                  ? 'آخر 25 سجل من نظام MikroTik (/log) مع تمييز الأخطاء بالعربية'
                  : 'Last 25 RouterOS /log entries with smart diagnostic highlights'}
              </p>
              <button
                type="button"
                disabled={syncingInventory}
                onClick={handleSyncInventory}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:brightness-110 disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingInventory ? 'animate-spin' : ''}`} />
                <span>{lang === 'ar' ? 'جلب السجلات 🔄' : 'Fetch Logs 🔄'}</span>
              </button>
            </div>

            {currentInventory.logs.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                {lang === 'ar'
                  ? 'اضغط على "جلب السجلات 🔄" لقراءة آخر أحداث الراوتر.'
                  : 'Click "Fetch Logs 🔄" to load the latest router events.'}
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {currentInventory.logs.map((entry: RouterLogEntry, idx) => {
                  const analysis = translateLogHighlight(entry.topics, entry.message, lang);
                  return (
                    <div
                      key={`${entry.time}-${idx}`}
                      className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                        analysis.isError
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
                          : analysis.isWarning
                          ? 'border-amber-500/35 bg-amber-500/10 text-amber-100'
                          : 'border-slate-800 bg-[#050A18]/80 text-slate-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-cyan-300" dir="ltr">
                          {entry.time} · {entry.topics}
                        </span>
                        {analysis.hint && (
                          <span
                            className={`font-bold text-[11px] ${
                              analysis.isError ? 'text-rose-300' : 'text-amber-300'
                            }`}
                          >
                            {analysis.hint}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[11px] opacity-90" dir="ltr">
                        {entry.message}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
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

      {/* Speed Limit Modal */}
      {speedModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="noc-glass w-full max-w-sm rounded-2xl p-6 space-y-4">
            <h4 className="text-base font-bold text-white">
              {lang === 'ar'
                ? `تحديد سرعة فوري: ${speedModalSession.user}`
                : `Instant Speed Limit: ${speedModalSession.user}`}
            </h4>
            <p className="text-xs text-slate-400 font-mono" dir="ltr">
              {speedModalSession.type.toUpperCase()} · {speedModalSession.address}
            </p>
            <div className="flex flex-wrap gap-2">
              {['1M/1M', '2M/2M', '4M/4M', '8M/8M', '16M/8M'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSpeedInput(preset)}
                  className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs font-bold cursor-pointer ${
                    speedInput === preset
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={speedInput}
              onChange={(e) => setSpeedInput(e.target.value)}
              dir="ltr"
              placeholder="4M/4M"
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/90 px-3.5 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSpeedModalSession(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = speedModalSession;
                  const rate = speedInput;
                  setSpeedModalSession(null);
                  void sendCloudAction(
                    `speed_${target.user}`,
                    buildSpeedLimitCommand(target.type, target.user, rate, target.address),
                    `تم تطبيق تحديد السرعة (${rate}) على ${target.user}`,
                    `Applied speed limit (${rate}) to ${target.user}`
                  );
                }}
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 cursor-pointer"
              >
                {lang === 'ar' ? 'تطبيق السرعة 🚀' : 'Apply Limit 🚀'}
              </button>
            </div>
          </div>
        </div>
      )}

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
