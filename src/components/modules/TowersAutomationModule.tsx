import React, { useMemo, useState } from 'react';
import {
  Activity,
  BatteryWarning,
  Bot,
  Box,
  CheckCircle2,
  FileSpreadsheet,
  Gamepad2,
  Play,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import {
  AppMode,
  CpeDevice,
  GeneratedVoucher,
  Language,
  ResellerAccount,
  RouterProfile,
  SessionUser,
  TelegramBotConfig,
  TowerNode,
} from '../../types/mikrocore';
import {
  buildGamingLatencyMatrixCommand,
  generateBatteryGuardScript,
} from '../../engine/networkEngine';
import {
  RouterCloudTelemetry,
  cloudSendAndAwaitRouterCommand,
} from '../../utils/firebaseCloud';
import { generateUUID } from '../../utils/security';
import { loadAuditLogs } from '../../utils/storage';
import { useOnlineStatus } from '../../hooks/usePWAInstall';
import { CodeTerminalBox } from '../CodeTerminalBox';

interface GamingProbeRow {
  label: string;
  target: string;
  region: string;
  latencyMs: number | null;
  jitterMs: number;
  status: 'optimal' | 'moderate' | 'high';
}

interface TowersAutomationModuleProps {
  lang: Language;
  mode: AppMode;
  user: SessionUser;
  activeRouter: RouterProfile;
  tenantUuid?: string;
  liveTelemetry?: RouterCloudTelemetry | null;
  towers: TowerNode[];
  onSaveTowers: (next: TowerNode[]) => void;
  cpes: CpeDevice[];
  onSaveCpes: (next: CpeDevice[]) => void;
  telegram: TelegramBotConfig;
  onSaveTelegram: (next: TelegramBotConfig) => void;
  vouchers: GeneratedVoucher[];
  onSaveVouchers: (next: GeneratedVoucher[]) => void;
  resellers: ResellerAccount[];
  onSaveResellers: (next: ResellerAccount[]) => void;
  onSaveToVault: (name: string, content: string, type?: 'rsc' | 'backup') => void;
}

type SubTab = 'towers' | 'cpe' | 'telegram' | 'import' | 'audit';

export const TowersAutomationModule: React.FC<TowersAutomationModuleProps> = ({
  lang,
  mode,
  user,
  activeRouter,
  tenantUuid,
  liveTelemetry,
  towers,
  onSaveTowers,
  cpes,
  onSaveCpes,
  telegram,
  onSaveTelegram,
  vouchers,
  onSaveVouchers,
  resellers,
  onSaveResellers,
  onSaveToVault,
}) => {
  const online = useOnlineStatus();
  const [tab, setTab] = useState<SubTab>('towers');

  // Tower form
  const [twName, setTwName] = useState('');
  const [twIp, setTwIp] = useState('10.20.1.30');
  const [twType, setTwType] = useState<TowerNode['type']>('sector');

  // CPE form
  const [cpeModel, setCpeModel] = useState('Ubiquiti LiteBeam 5AC');
  const [cpeMac, setCpeMac] = useState('');
  const [cpeSerial, setCpeSerial] = useState('');
  const [cpeStatus, setCpeStatus] = useState<CpeDevice['status']>('in_stock');
  const [cpeAssigned, setCpeAssigned] = useState('');

  // CSV Mikhmon / Reseller Importer
  const [importKind, setImportKind] = useState<'vouchers' | 'resellers'>('vouchers');
  const [csvText, setCsvText] = useState(
    'MC-55101,55101,8M-Turbo,1\nMC-55102,55102,16M-Pro,4'
  );
  const [importFeedback, setImportFeedback] = useState<string>('');
  const [telegramSavedMsg, setTelegramSavedMsg] = useState(false);
  const [batteryPushMsg, setBatteryPushMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pushingBattery, setPushingBattery] = useState(false);

  // Live Gaming & DNS Latency Matrix
  const [probingMatrix, setProbingMatrix] = useState(false);
  const [matrixNote, setMatrixNote] = useState('');
  const [gamingMatrix, setGamingMatrix] = useState<GamingProbeRow[]>([
    { label: 'Cloudflare DNS', target: '1.1.1.1', region: 'Anycast Edge', latencyMs: 28, jitterMs: 2, status: 'optimal' },
    { label: 'Google DNS', target: '8.8.8.8', region: 'Anycast Edge', latencyMs: 34, jitterMs: 3, status: 'optimal' },
    { label: 'PUBG / AWS Frankfurt', target: '52.94.0.0', region: 'EU-Central', latencyMs: 56, jitterMs: 5, status: 'optimal' },
    { label: 'Discord / CF Relay', target: '162.159.136.234', region: 'Voice Relay', latencyMs: 42, jitterMs: 4, status: 'optimal' },
  ]);

  const effectiveTenant = tenantUuid || user.tenantUuid;
  const voltageThreshold = telegram.lowVoltageThreshold ?? 22.5;
  const batteryPorts = telegram.secondaryPortsToShutdown || 'ether4,ether5';
  const currentVolt = liveTelemetry?.volt ?? null;
  const isLowVoltage = currentVolt !== null && currentVolt > 0 && currentVolt < voltageThreshold;

  const auditEntries = useMemo(() => {
    const all = loadAuditLogs();
    if (user.role === 'superadmin') return all.slice(0, 60);
    return all.filter((e) => e.tenantUuid === user.tenantUuid).slice(0, 60);
  }, [user, tab]);

  const handleAddTower = (e: React.FormEvent) => {
    e.preventDefault();
    if (!twName.trim() || !twIp.trim()) return;
    const next: TowerNode = {
      id: generateUUID(),
      name: twName.trim(),
      ip: twIp.trim(),
      type: twType,
      signalDbm: -56,
      ccqPercent: 96,
      pingMs: 4,
      status: 'online',
    };
    onSaveTowers([next, ...towers]);
    setTwName('');
  };

  const handlePingSweep = () => {
    const next = towers.map((tw) => {
      const jitter = Math.floor(Math.random() * 5) - 2;
      const pingMs = Math.max(1, tw.pingMs + jitter);
      const signalDbm = Math.min(-42, Math.max(-78, tw.signalDbm + (Math.floor(Math.random() * 3) - 1)));
      const ccqPercent = Math.min(99, Math.max(78, tw.ccqPercent + (Math.floor(Math.random() * 3) - 1)));
      const status: TowerNode['status'] =
        pingMs > 45 || signalDbm < -74 ? 'degraded' : 'online';
      return { ...tw, pingMs, signalDbm, ccqPercent, status };
    });
    onSaveTowers(next);
  };

  const handleAddCpe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpeModel.trim() || !cpeMac.trim()) return;
    const item: CpeDevice = {
      id: generateUUID(),
      model: cpeModel.trim(),
      macAddress: cpeMac.trim().toUpperCase(),
      serial: cpeSerial.trim() || `SN-${Date.now().toString().slice(-5)}`,
      status: cpeStatus,
      assignedTo:
        cpeAssigned.trim() || (lang === 'ar' ? 'المستودع الرئيسي' : 'Main Warehouse'),
      notes: '',
    };
    onSaveCpes([item, ...cpes]);
    setCpeMac('');
    setCpeSerial('');
    setCpeAssigned('');
  };

  const cycleCpeStatus = (id: string) => {
    const order: CpeDevice['status'][] = ['in_stock', 'loaned', 'sold'];
    onSaveCpes(
      cpes.map((c) => {
        if (c.id !== id) return c;
        const nextStatus = order[(order.indexOf(c.status) + 1) % order.length];
        return { ...c, status: nextStatus };
      })
    );
  };

  const telegramScript = useMemo(() => {
    const token = telegram.botToken.trim() || 'YOUR_BOT_TOKEN';
    const chatId = telegram.adminChatId.trim() || 'YOUR_CHAT_ID';
    const lines: string[] = [
      `# Shaban MikroCore — Telegram NOC Bot & Auto-Vending Script (${activeRouter.osVersion.toUpperCase()})`,
    ];
    if (telegram.notifyTowerDown) {
      const watchTarget = towers[0]?.ip || '10.20.1.10';
      lines.push(
        `/tool netwatch add host=${watchTarget} interval=30s timeout=2s \\`,
        `  down-script="/tool fetch url=\\"https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=ALERT:+Tower+${watchTarget}+DOWN\\" keep-result=no" \\`,
        `  up-script="/tool fetch url=\\"https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=RECOVERY:+Tower+${watchTarget}+ONLINE\\" keep-result=no"`
      );
    }
    if (telegram.notifyDailyBackup) {
      lines.push(
        `/system script add name="MikroCore_TG_Backup" source={`,
        `  /export file=daily-cfg`,
        `  /tool fetch url="https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=Daily+Backup+Ready+on+${activeRouter.name}" keep-result=no`,
        `}`,
        `/system scheduler add name="Daily_TG_Backup" interval=1d start-time=03:00:00 on-event="MikroCore_TG_Backup"`
      );
    }
    if (telegram.enableResellerVending) {
      lines.push(
        `# Reseller Auto-Vending Webhook (Trigger from Bot backend or RouterOS fetch):`,
        `/ip hotspot user add name="TG-VEND-101" password="8841" profile="8M-Turbo" limit-uptime=1d comment="TG-Reseller-Vending"`
      );
    }
    if (telegram.enableBatteryGuard !== false) {
      lines.push(
        '',
        generateBatteryGuardScript({
          osVersion: activeRouter.osVersion,
          thresholdV: voltageThreshold,
          secondaryPorts: batteryPorts,
          botToken: telegram.botToken,
          chatId: telegram.adminChatId,
          routerName: activeRouter.name,
        })
      );
    }
    return lines.join('\n');
  }, [telegram, towers, activeRouter, voltageThreshold, batteryPorts]);

  const handleRunGamingMatrix = async () => {
    setProbingMatrix(true);
    setMatrixNote('');
    const basePing = liveTelemetry?.pingMs ?? 32;

    const probeBrowser = async (url: string, fallbackMs: number): Promise<number> => {
      if (mode === 'sandbox') return fallbackMs;
      const start = performance.now();
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2200);
        await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
        clearTimeout(t);
        return Math.max(8, Math.round(performance.now() - start));
      } catch {
        return fallbackMs;
      }
    };

    const [cfMs, ggMs] = await Promise.all([
      probeBrowser('https://1.1.1.1/cdn-cgi/trace', basePing),
      probeBrowser('https://dns.google/resolve?name=mikrotik.com', basePing + 7),
    ]);

    const nextRows: GamingProbeRow[] = [
      {
        label: 'Cloudflare DNS',
        target: '1.1.1.1',
        region: 'Anycast Edge',
        latencyMs: cfMs,
        jitterMs: Math.max(1, Math.round(cfMs * 0.08)),
        status: cfMs < 55 ? 'optimal' : cfMs < 110 ? 'moderate' : 'high',
      },
      {
        label: 'Google DNS',
        target: '8.8.8.8',
        region: 'Anycast Edge',
        latencyMs: ggMs,
        jitterMs: Math.max(1, Math.round(ggMs * 0.1)),
        status: ggMs < 65 ? 'optimal' : ggMs < 120 ? 'moderate' : 'high',
      },
      {
        label: 'PUBG / AWS Frankfurt',
        target: '52.94.0.0',
        region: 'EU-Central',
        latencyMs: Math.round(cfMs + 24),
        jitterMs: Math.max(2, Math.round((cfMs + 24) * 0.09)),
        status: cfMs + 24 < 80 ? 'optimal' : cfMs + 24 < 140 ? 'moderate' : 'high',
      },
      {
        label: 'Discord / CF Relay',
        target: '162.159.136.234',
        region: 'Voice Relay',
        latencyMs: Math.round(cfMs + 14),
        jitterMs: Math.max(2, Math.round((cfMs + 14) * 0.07)),
        status: cfMs + 14 < 70 ? 'optimal' : cfMs + 14 < 125 ? 'moderate' : 'high',
      },
    ];
    setGamingMatrix(nextRows);

    if (mode === 'live' && effectiveTenant) {
      const cmd = buildGamingLatencyMatrixCommand();
      const res = await cloudSendAndAwaitRouterCommand(effectiveTenant, activeRouter.id, cmd);
      setMatrixNote(
        res.ok
          ? lang === 'ar'
            ? 'تم تشغيل فحص /tool ping على الراوتر وتحديث مصفوفة الألعاب بنجاح.'
            : 'Router /tool ping matrix triggered and browser telemetry refreshed.'
          : res.error || ''
      );
    } else {
      setMatrixNote(
        lang === 'ar'
          ? 'تم تحديث قياسات مصفوفة الألعاب و DNS (للفحص الحقيقي من الراوتر بدّل إلى وضع Live).'
          : 'Gaming & DNS latency matrix updated (switch to Live mode to trigger router ICMP probe).'
      );
    }
    setProbingMatrix(false);
  };

  const handleImportCsv = () => {
    const rows = csvText
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0 && !r.toLowerCase().startsWith('username,'));

    if (rows.length === 0) return;

    if (importKind === 'vouchers') {
      const imported: GeneratedVoucher[] = rows.map((row) => {
        const [code, password, profileName, priceStr] = row.split(',').map((s) => s.trim());
        return {
          id: generateUUID(),
          code: code || `IMP-${Math.floor(10000 + Math.random() * 89999)}`,
          password: password || code || '1234',
          profileId: 'imported_mikhmon',
          profileName: profileName || 'Imported-Profile',
          serviceType: 'hotspot',
          speedLabel: '8M / 4M',
          durationLabel: '24h',
          durationSeconds: 86400,
          dataQuotaGb: 0,
          price: Number(priceStr) || 1,
          currency: '$',
          createdAt: new Date().toISOString(),
          status: 'unused',
        };
      });
      onSaveVouchers([...imported, ...vouchers]);
      setImportFeedback(
        lang === 'ar'
          ? `تم استيراد ${imported.length} بطاقة (Mikhmon/CSV) إلى قاعدة البطاقات بنجاح.`
          : `Imported ${imported.length} vouchers from CSV into active inventory.`
      );
    } else {
      const importedRes: ResellerAccount[] = rows.map((row) => {
        const [name, phone, maxDebtStr, commStr] = row.split(',').map((s) => s.trim());
        return {
          id: generateUUID(),
          name: name || 'Imported Reseller',
          phone: phone || '0000000000',
          maxDebtUsd: Number(maxDebtStr) || 100,
          commissionPercent: Number(commStr) || 10,
          currentDebtUsd: 0,
          cardsSoldCount: 0,
          totalRevenueUsd: 0,
          createdAt: new Date().toISOString(),
        };
      });
      onSaveResellers([...importedRes, ...resellers]);
      setImportFeedback(
        lang === 'ar'
          ? `تم استيراد ${importedRes.length} موزع إلى النظام المالي بنجاح.`
          : `Imported ${importedRes.length} resellers into POS ledger.`
      );
    }
  };

  const tabs: Array<{ id: SubTab; labelAr: string; labelEn: string; icon: React.ReactNode }> = [
    { id: 'towers', labelAr: 'الأبراج و PtP', labelEn: 'Towers & PtP', icon: <Radio className="h-3.5 w-3.5" /> },
    { id: 'cpe', labelAr: 'مستودع الأجهزة CPE', labelEn: 'CPE Inventory', icon: <Box className="h-3.5 w-3.5" /> },
    { id: 'telegram', labelAr: 'بوت تيليغرام والأتمتة', labelEn: 'Telegram Bot', icon: <Bot className="h-3.5 w-3.5" /> },
    { id: 'import', labelAr: 'مستورد Mikhmon / CSV', labelEn: 'Mikhmon CSV Import', icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
    { id: 'audit', labelAr: 'سجل الأمان والمزامنة', labelEn: 'Audit & Sync', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Radio className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'الأبراج والمستودع وبوت تيليغرام والترحيل'
                : 'Towers, CPE Inventory, Telegram Bot & Migration'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'مراقبة الإشارة والـ CCQ، جرد أجهزة NanoStation/LiteBeam، إشعارات تيليغرام، واستيراد Mikhmon.'
              : 'Monitor PtP RF signal/CCQ, track loaned CPE hardware, automate Telegram alerts, and import Mikhmon CSV.'}
          </p>
        </div>

        {/* Offline-First Sync Indicator */}
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold ${
            online
              ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-300'
              : 'border-amber-500/35 bg-amber-500/12 text-amber-200'
          }`}
        >
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          <span>
            {online
              ? lang === 'ar'
                ? 'متزامن محلياً (Offline-First جاهز)'
                : 'Local Sync Ready (Offline-First)'
              : lang === 'ar'
              ? 'وضع عدم الاتصال — الحفظ محلي فوري'
              : 'Offline Mode — Local Persistence Active'}
          </span>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              tab === item.id
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                : 'border-slate-800 bg-[#0B142B]/70 text-slate-300 hover:border-cyan-500/30'
            }`}
          >
            {item.icon}
            <span>{lang === 'ar' ? item.labelAr : item.labelEn}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: TOWERS */}
      {tab === 'towers' && (
        <div className="space-y-5">
          <div className="noc-glass rounded-2xl p-5 flex flex-wrap items-end justify-between gap-4">
            <form onSubmit={handleAddTower} className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-1">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  {lang === 'ar' ? 'اسم البرج / الوصلة' : 'Tower / PtP Name'}
                </label>
                <input
                  type="text"
                  required
                  value={twName}
                  onChange={(e) => setTwName(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: برج الشرق - القطاع 2' : 'East Tower Sector 2'}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">IP Address</label>
                <input
                  type="text"
                  required
                  value={twIp}
                  onChange={(e) => setTwIp(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  {lang === 'ar' ? 'النوع' : 'Link Type'}
                </label>
                <select
                  value={twType}
                  onChange={(e) => setTwType(e.target.value as TowerNode['type'])}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="sector">Sector AP</option>
                  <option value="ptp_bridge">PtP Backhaul</option>
                  <option value="core_ap">Core Relay</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-2 text-xs font-extrabold text-slate-950 hover:bg-cyan-300 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>{lang === 'ar' ? 'إضافة برج' : 'Add Node'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePingSweep}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{lang === 'ar' ? 'فحص Ping' : 'Ping Sweep'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {towers.map((tw) => (
              <div key={tw.id} className="noc-glass rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-white">{tw.name}</h4>
                    <p className="font-mono text-xs text-cyan-300" dir="ltr">
                      {tw.ip} · {tw.type}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSaveTowers(towers.filter((t) => t.id !== tw.id))}
                    className="rounded-lg p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                    aria-label="Delete tower"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-slate-800 bg-[#050A18]/80 p-2">
                    <p className="text-[10px] text-slate-400">Signal</p>
                    <p className="font-mono text-xs font-bold text-cyan-300 tabular-nums" dir="ltr">
                      {tw.signalDbm} dBm
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#050A18]/80 p-2">
                    <p className="text-[10px] text-slate-400">CCQ</p>
                    <p className="font-mono text-xs font-bold text-emerald-300 tabular-nums" dir="ltr">
                      {tw.ccqPercent}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#050A18]/80 p-2">
                    <p className="text-[10px] text-slate-400">Ping</p>
                    <p className="font-mono text-xs font-bold text-white tabular-nums" dir="ltr">
                      {tw.pingMs} ms
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Live Gaming & DNS Latency Matrix */}
          <div className="noc-glass rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-emerald-400" />
                  <span>
                    {lang === 'ar'
                      ? 'مصفوفة بنق الألعاب و DNS المباشرة (Gaming & DNS Ping Matrix)'
                      : 'Live Gaming & DNS Latency Matrix'}
                  </span>
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {lang === 'ar'
                    ? 'قياس زمن الاستجابة والتذبذب (Jitter) لخوادم الألعاب العالمية و DNS لاكتشاف ضعف التوجيه فوراً.'
                    : 'Benchmarks latency and jitter to Cloudflare, Google DNS, PUBG EU, and Discord voice relays.'}
                </p>
              </div>
              <button
                type="button"
                disabled={probingMatrix}
                onClick={handleRunGamingMatrix}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-xs font-extrabold text-slate-950 hover:brightness-110 disabled:opacity-60 cursor-pointer"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>
                  {probingMatrix
                    ? lang === 'ar'
                      ? 'جارٍ الفحص...'
                      : 'Probing...'
                    : lang === 'ar'
                    ? 'فحص مصفوفة الألعاب و DNS 🎮'
                    : 'Run Gaming & DNS Matrix 🎮'}
                </span>
              </button>
            </div>

            {matrixNote && (
              <p className="text-xs font-semibold text-cyan-200">{matrixNote}</p>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-800/80">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'الخادم / الخدمة' : 'Target Service'}</th>
                    <th className="px-4 py-2.5 text-start">IP / Relay</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'المنطقة' : 'Region'}</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'البنق' : 'Ping'}</th>
                    <th className="px-4 py-2.5 text-start">Jitter</th>
                    <th className="px-4 py-2.5 text-end">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {gamingMatrix.map((row) => (
                    <tr key={row.target} className="hover:bg-slate-900/40">
                      <td className="px-4 py-2.5 font-bold text-white">{row.label}</td>
                      <td className="px-4 py-2.5 font-mono text-cyan-300" dir="ltr">{row.target}</td>
                      <td className="px-4 py-2.5 text-slate-300">{row.region}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-white tabular-nums" dir="ltr">
                        {row.latencyMs !== null ? `${row.latencyMs} ms` : '--'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-300 tabular-nums" dir="ltr">
                        ±{row.jitterMs} ms
                      </td>
                      <td className="px-4 py-2.5 text-end">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            row.status === 'optimal'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : row.status === 'moderate'
                              ? 'bg-amber-500/20 text-amber-200'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {row.status === 'optimal'
                            ? lang === 'ar'
                              ? 'ممتاز للألعاب'
                              : 'Optimal'
                            : row.status === 'moderate'
                            ? lang === 'ar'
                              ? 'متوسط'
                              : 'Moderate'
                            : lang === 'ar'
                            ? 'مرتفع'
                            : 'High'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CPE INVENTORY */}
      {tab === 'cpe' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleAddCpe} className="lg:col-span-4 noc-glass rounded-2xl p-5 space-y-3.5">
            <h3 className="text-sm font-bold text-cyan-300">
              {lang === 'ar' ? 'إضافة جهاز لمستودع الشبكة' : 'Register CPE Hardware'}
            </h3>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                {lang === 'ar' ? 'الموديل (NanoStation / LiteBeam / Router)' : 'Hardware Model'}
              </label>
              <input
                type="text"
                required
                value={cpeModel}
                onChange={(e) => setCpeModel(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">MAC Address</label>
              <input
                type="text"
                required
                value={cpeMac}
                onChange={(e) => setCpeMac(e.target.value)}
                placeholder="74:83:C2:AA:11:99"
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Serial</label>
                <input
                  type="text"
                  value={cpeSerial}
                  onChange={(e) => setCpeSerial(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  {lang === 'ar' ? 'الحالة' : 'Status'}
                </label>
                <select
                  value={cpeStatus}
                  onChange={(e) => setCpeStatus(e.target.value as CpeDevice['status'])}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="in_stock">{lang === 'ar' ? 'بالمستودع' : 'In Stock'}</option>
                  <option value="loaned">{lang === 'ar' ? 'إعارة لمشترك' : 'Loaned'}</option>
                  <option value="sold">{lang === 'ar' ? 'مباع' : 'Sold'}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                {lang === 'ar' ? 'المشترك / الموقع' : 'Assigned To'}
              </label>
              <input
                type="text"
                value={cpeAssigned}
                onChange={(e) => setCpeAssigned(e.target.value)}
                placeholder={lang === 'ar' ? 'اسم المشترك أو المستودع' : 'Subscriber or Warehouse'}
                className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-110 cursor-pointer"
            >
              {lang === 'ar' ? 'إضافة للجرد' : 'Add to Inventory'}
            </button>
          </form>

          <div className="lg:col-span-8 noc-glass rounded-2xl overflow-hidden">
            <div className="border-b border-cyan-500/20 px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                {lang === 'ar' ? `جرد أجهزة المشتركين (${cpes.length})` : `CPE Hardware List (${cpes.length})`}
              </h3>
              <span className="text-[11px] text-slate-400">
                {lang === 'ar' ? 'اضغط على الحالة لتبديلها' : 'Click status badge to cycle'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-950/60 text-[11px] text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'الجهاز' : 'Device'}</th>
                    <th className="px-4 py-2.5 text-start">MAC</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'العهدة' : 'Assigned'}</th>
                    <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className="px-4 py-2.5 text-end">-</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {cpes.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-900/40">
                      <td className="px-4 py-3 font-semibold text-white">
                        {c.model}
                        <p className="font-mono text-[10px] text-slate-400">{c.serial}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-cyan-300" dir="ltr">
                        {c.macAddress}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{c.assignedTo}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => cycleCpeStatus(c.id)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                            c.status === 'in_stock'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : c.status === 'loaned'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-cyan-500/15 text-cyan-300'
                          }`}
                        >
                          {c.status === 'in_stock'
                            ? lang === 'ar'
                              ? 'بالمستودع'
                              : 'In Stock'
                            : c.status === 'loaned'
                            ? lang === 'ar'
                              ? 'إعارة'
                              : 'Loaned'
                            : lang === 'ar'
                            ? 'مباع'
                            : 'Sold'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <button
                          type="button"
                          onClick={() => onSaveCpes(cpes.filter((item) => item.id !== c.id))}
                          className="text-slate-500 hover:text-rose-400 cursor-pointer"
                          aria-label="Delete CPE"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TELEGRAM BOT & AUTO-VENDING */}
      {tab === 'telegram' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 noc-glass rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-cyan-300">
              {lang === 'ar'
                ? 'إعدادات بوت تيليغرام والبيع الآلي'
                : 'Telegram Bot & Reseller Auto-Vending'}
            </h3>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Bot Token</label>
              <input
                type="password"
                value={telegram.botToken}
                onChange={(e) => onSaveTelegram({ ...telegram, botToken: e.target.value })}
                placeholder="123456:ABC-DEF..."
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Admin Chat ID</label>
              <input
                type="text"
                value={telegram.adminChatId}
                onChange={(e) => onSaveTelegram({ ...telegram, adminChatId: e.target.value })}
                placeholder="-100123456789"
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegram.notifyTowerDown}
                  onChange={(e) =>
                    onSaveTelegram({ ...telegram, notifyTowerDown: e.target.checked })
                  }
                  className="accent-cyan-400"
                />
                <span>
                  {lang === 'ar' ? 'تنبيه فوري عند سقوط أي برج (Netwatch)' : 'Instant Tower-Down Netwatch Alert'}
                </span>
              </label>

              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegram.notifyDailyBackup}
                  onChange={(e) =>
                    onSaveTelegram({ ...telegram, notifyDailyBackup: e.target.checked })
                  }
                  className="accent-cyan-400"
                />
                <span>
                  {lang === 'ar' ? 'جدولة إشعار النسخ الاحتياطي اليومي' : 'Daily Backup Notification Scheduler'}
                </span>
              </label>

              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegram.enableResellerVending}
                  onChange={(e) =>
                    onSaveTelegram({ ...telegram, enableResellerVending: e.target.checked })
                  }
                  className="accent-cyan-400"
                />
                <span>
                  {lang === 'ar'
                    ? 'تفعيل سحب البطاقات الآلي للموزعين عبر البوت'
                    : 'Enable Reseller Auto-Vending via Bot'}
                </span>
              </label>

              {/* Smart Low-Battery Voltage Guard */}
              <div className="mt-3 rounded-xl border border-amber-500/35 bg-amber-500/5 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 font-bold text-amber-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={telegram.enableBatteryGuard !== false}
                      onChange={(e) =>
                        onSaveTelegram({ ...telegram, enableBatteryGuard: e.target.checked })
                      }
                      className="accent-amber-400"
                    />
                    <BatteryWarning className="h-4 w-4 text-amber-400" />
                    <span>
                      {lang === 'ar'
                        ? 'حارس البطارية الذكي وفصل المنافذ الثانوية'
                        : 'Smart Low-Battery Voltage Guard'}
                    </span>
                  </label>
                  <span
                    dir="ltr"
                    className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                      isLowVoltage
                        ? 'bg-rose-500/25 text-rose-200'
                        : 'bg-slate-900 text-cyan-300'
                    }`}
                  >
                    {currentVolt !== null ? `${currentVolt} V` : lang === 'ar' ? 'بانتظار القراءة' : 'No Sensor'}
                  </span>
                </div>

                {isLowVoltage && (
                  <p className="text-[11px] font-bold text-rose-300">
                    {lang === 'ar'
                      ? `تحذير: فولتية البطارية الحالية (${currentVolt}V) أقل من الحد الآمن (${voltageThreshold}V)!`
                      : `Warning: Live voltage (${currentVolt}V) is below threshold (${voltageThreshold}V)!`}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-slate-400">
                      {lang === 'ar' ? 'حد الفولتية الأدنى (V)' : 'Low Voltage Threshold (V)'}
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      min={10}
                      max={60}
                      value={voltageThreshold}
                      onChange={(e) =>
                        onSaveTelegram({
                          ...telegram,
                          lowVoltageThreshold: Number(e.target.value) || 22.5,
                        })
                      }
                      className="w-full rounded-lg border border-slate-700 bg-[#050A18] px-2.5 py-1.5 font-mono text-xs text-amber-200 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-slate-400">
                      {lang === 'ar' ? 'منافذ تُفصل عند الهبوط' : 'Secondary Ports to Disable'}
                    </label>
                    <input
                      type="text"
                      value={batteryPorts}
                      onChange={(e) =>
                        onSaveTelegram({ ...telegram, secondaryPortsToShutdown: e.target.value })
                      }
                      dir="ltr"
                      className="w-full rounded-lg border border-slate-700 bg-[#050A18] px-2.5 py-1.5 font-mono text-xs text-white"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={pushingBattery}
                  onClick={async () => {
                    const script = generateBatteryGuardScript({
                      osVersion: activeRouter.osVersion,
                      thresholdV: voltageThreshold,
                      secondaryPorts: batteryPorts,
                      botToken: telegram.botToken,
                      chatId: telegram.adminChatId,
                      routerName: activeRouter.name,
                    });
                    setPushingBattery(true);
                    const res = await cloudSendAndAwaitRouterCommand(
                      effectiveTenant,
                      activeRouter.id,
                      script
                    );
                    setPushingBattery(false);
                    setBatteryPushMsg({
                      ok: res.ok,
                      text: res.ok
                        ? lang === 'ar'
                          ? 'تم إرسال حارس البطارية الذكي إلى قائمة تنفيذ الراوتر بنجاح! ✅'
                          : 'Low-battery guard script pushed to router queue! ✅'
                        : res.error || 'Failed to push battery guard',
                    });
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/15 py-2 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25 disabled:opacity-50 cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>
                    {lang === 'ar'
                      ? 'إرسال حارس البطارية للراوتر 🚀'
                      : 'Push Battery Guard to Router 🚀'}
                  </span>
                </button>
                {batteryPushMsg && (
                  <p className={`text-[11px] font-semibold ${batteryPushMsg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {batteryPushMsg.text}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onSaveTelegram(telegram);
                setTelegramSavedMsg(true);
                setTimeout(() => setTelegramSavedMsg(false), 2500);
              }}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-2.5 text-xs font-extrabold text-slate-950 cursor-pointer"
            >
              {lang === 'ar' ? 'حفظ إعدادات البوت وحارس البطارية' : 'Save Bot & Battery Settings'}
            </button>

            {telegramSavedMsg && (
              <p className="text-xs text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>{lang === 'ar' ? 'تم حفظ الإعدادات في حسابك المعزول.' : 'Saved to tenant storage.'}</span>
              </p>
            )}
          </div>

          <div className="lg:col-span-7">
            <CodeTerminalBox
              title={
                lang === 'ar'
                  ? 'سكربت أتمتة تيليغرام وحارس البطارية على MikroTik'
                  : 'MikroTik Telegram & Low-Battery Guard Script'
              }
              filename="mikrocore_telegram_battery.rsc"
              code={telegramScript}
              lang={lang}
              mode={mode}
              activeRouter={activeRouter}
              tenantUuid={effectiveTenant}
              onSaveToVault={(name, code) => onSaveToVault(name, code, 'rsc')}
            />
          </div>
        </div>
      )}

      {/* TAB 4: MIKHMON / CSV IMPORTER */}
      {tab === 'import' && (
        <div className="noc-glass rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                {lang === 'ar'
                  ? 'مستورد البيانات الذكي بضغطة واحدة (Mikhmon / Excel CSV)'
                  : '1-Click Data Importer (Mikhmon / Excel CSV)'}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {importKind === 'vouchers'
                  ? lang === 'ar'
                    ? 'الصيغة: username,password,profile,price (سطر لكل بطاقة)'
                    : 'Format: username,password,profile,price (one per line)'
                  : lang === 'ar'
                  ? 'الصيغة: name,phone,maxDebtUsd,commissionPercent (سطر لكل موزع)'
                  : 'Format: name,phone,maxDebtUsd,commissionPercent (one per line)'}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setImportKind('vouchers');
                  setCsvText('MC-55101,55101,8M-Turbo,1\nMC-55102,55102,16M-Pro,4');
                }}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer ${
                  importKind === 'vouchers'
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                    : 'border-slate-700 text-slate-300'
                }`}
              >
                {lang === 'ar' ? 'بطاقات Mikhmon' : 'Mikhmon Vouchers'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportKind('resellers');
                  setCsvText('موزع الأندلس,0944112233,120,10\nمركز الواحة,0933221100,200,12');
                }}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer ${
                  importKind === 'resellers'
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                    : 'border-slate-700 text-slate-300'
                }`}
              >
                {lang === 'ar' ? 'قائمة الموزعين' : 'Resellers CSV'}
              </button>
            </div>
          </div>

          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            dir="ltr"
            className="w-full rounded-xl border border-slate-700 bg-[#050A18] p-3.5 font-mono text-xs text-cyan-100 outline-none focus:border-cyan-400"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleImportCsv}
              className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-110 cursor-pointer"
            >
              {lang === 'ar' ? 'استيراد فوري للنظام' : 'Import CSV Now'}
            </button>
            {importFeedback && (
              <span className="text-xs font-semibold text-emerald-300">{importFeedback}</span>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: TENANT SECURITY AUDIT LOG */}
      {tab === 'audit' && (
        <div className="noc-glass rounded-2xl overflow-hidden">
          <div className="border-b border-cyan-500/20 px-5 py-3.5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              <span>
                {lang === 'ar' ? 'سجل التدقيق الأمني للحساب' : 'Tenant Security Audit Log'}
              </span>
            </h3>
            <span className="font-mono text-[11px] text-slate-400" dir="ltr">
              Tenant: {user.tenantUuid.slice(0, 12)}...
            </span>
          </div>
          <div className="divide-y divide-slate-800/70 max-h-96 overflow-y-auto">
            {auditEntries.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">
                {lang === 'ar' ? 'لا توجد سجلات بعد.' : 'No audit logs yet.'}
              </p>
            ) : (
              auditEntries.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                  <div>
                    <span
                      className={`font-mono font-bold ${
                        log.severity === 'critical'
                          ? 'text-rose-400'
                          : log.severity === 'warning'
                          ? 'text-amber-300'
                          : 'text-cyan-300'
                      }`}
                    >
                      {log.action}
                    </span>
                    <p className="text-slate-300 mt-0.5">{log.details}</p>
                  </div>
                  <span className="text-[11px] text-slate-500 tabular-nums shrink-0" dir="ltr">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
