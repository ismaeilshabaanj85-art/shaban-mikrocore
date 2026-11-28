import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Check,
  CheckCircle2,
  Construction,
  Copy,
  Download,
  Gauge,
  Globe,
  KeyRound,
  Play,
  RefreshCw,
  RotateCcw,
  SatelliteDish,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Square,
} from 'lucide-react';
import {
  AppMode,
  DailyTrafficSample,
  Language,
  RouterProfile,
  RouterPublicInfo,
} from '../../types/mikrocore';
import {
  RouterCloudTelemetry,
  cloudFetchRouterPublicInfo,
  cloudSendAndAwaitRouterCommand,
} from '../../utils/firebaseCloud';
import {
  analyzeRouterPublicInfo,
  buildFetchPublicIpCommand,
  buildL2tpVpnDisableCommand,
  buildL2tpVpnEnableCommand,
  buildLoopProtectDisableCommand,
  buildLoopProtectEnableCommand,
  buildMaintenanceDisableCommand,
  buildMaintenanceEnableCommand,
  buildQuotaGuardDisableCommand,
  buildQuotaGuardEnableCommand,
  buildStarlinkPeakSaverDisableCommand,
  buildStarlinkPeakSaverEnableCommand,
  resolvePrimaryWinboxVpnHost,
} from '../../engine/enterpriseToolsEngine';
import { CodeTerminalBox } from '../CodeTerminalBox';

export type EnterpriseMikroTikModuleId =
  | 'public_ip'
  | 'vpn_l2tp'
  | 'starlink_quota'
  | 'quota_guard'
  | 'loop_protect'
  | 'maintenance_mode'
  | 'daily_report';

interface MikroTikEnterpriseModulesProps {
  activeModule: EnterpriseMikroTikModuleId;
  lang: Language;
  mode: AppMode;
  activeRouter: RouterProfile;
  tenantUuid: string;
  publicInfo: RouterPublicInfo | null;
  onPublicInfoUpdated: (info: RouterPublicInfo | null) => void;
  liveTelemetry: RouterCloudTelemetry | null;
  dailyTraffic: DailyTrafficSample;
  onResetDailyTraffic: () => void;
  onSaveToVault: (name: string, content: string, type: 'rsc' | 'backup') => void;
}

function useCopyState() {
  const [copiedKey, setCopiedKey] = useState<string>('');
  const copyText = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1800);
  };
  return { copiedKey, copyText };
}

export const MikroTikEnterpriseModules: React.FC<MikroTikEnterpriseModulesProps> = ({
  activeModule,
  lang,
  mode,
  activeRouter,
  tenantUuid,
  publicInfo,
  onPublicInfoUpdated,
  liveTelemetry,
  dailyTraffic,
  onResetDailyTraffic,
  onSaveToVault,
}) => {
  const { copiedKey, copyText } = useCopyState();
  const [busyKey, setBusyKey] = useState<string>('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // 1. Public IP state
  const [fetchingIp, setFetchingIp] = useState(false);

  // 2. L2TP VPN state
  const [vpnUser, setVpnUser] = useState('admin-vpn');
  const [vpnPass, setVpnPass] = useState('Shaban@2026');
  const [vpnSecret, setVpnSecret] = useState('12345678');
  const [vpnSubnet, setVpnSubnet] = useState('192.168.1.0/24');

  // 3. Starlink Quota Saver state
  const [slLanIf, setSlLanIf] = useState('bridge-LAN');
  const [slLanSubnet, setSlLanSubnet] = useState('192.168.88.0/24');
  const [slPeakStart, setSlPeakStart] = useState('19:00:00');
  const [slPeakEnd, setSlPeakEnd] = useState('00:00:00');
  const [slBulkCap, setSlBulkCap] = useState('2M/2M');

  // 4. Smart Quota Guard state
  const [qgService, setQgService] = useState<'hotspot' | 'pppoe'>('hotspot');
  const [qgProfile, setQgProfile] = useState('Home-8M');
  const [qgGb, setQgGb] = useState(10);
  const [qgThrottle, setQgThrottle] = useState('512k/512k');
  const [qgCycle, setQgCycle] = useState<'daily' | 'monthly'>('daily');

  // 5. Loop Protect state
  const [loopBridge, setLoopBridge] = useState('bridge-LAN');

  // 6. Maintenance Mode state
  const [maintPort, setMaintPort] = useState(8080);
  const [maintExemptIp, setMaintExemptIp] = useState('192.168.88.2');

  // 7. Daily Report state & unconditional hourly rows memo (Rules of Hooks safe)
  const [dailyBudgetGb, setDailyBudgetGb] = useState(150);
  const sandboxFallback = mode === 'sandbox' && dailyTraffic.samplesCount === 0;
  const hourlyRows = useMemo(() => {
    if (sandboxFallback) {
      return [
        { hour: '08:00', downGb: 4.2, upGb: 0.7 },
        { hour: '12:00', downGb: 9.8, upGb: 1.8 },
        { hour: '16:00', downGb: 14.5, upGb: 2.5 },
        { hour: '20:00', downGb: 22.1, upGb: 3.9 },
        { hour: '23:00', downGb: 14.2, upGb: 2.5 },
      ];
    }
    return Object.entries(dailyTraffic.hourlyBytes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, vals]) => ({
        hour: `${hour}:00`,
        downGb: vals.down / 1024 ** 3,
        upGb: vals.up / 1024 ** 3,
      }));
  }, [dailyTraffic.hourlyBytes, sandboxFallback]);

  const pushRouterCommand = async (
    key: string,
    script: string,
    msgAr: string,
    msgEn: string
  ) => {
    setBusyKey(key);
    setFeedback({
      ok: true,
      text:
        lang === 'ar'
          ? 'جارٍ إرسال الأمر إلى السحابة لتنفيذه على الراوتر...'
          : 'Sending command to Firebase Cloud Agent...',
    });
    const res = await cloudSendAndAwaitRouterCommand(tenantUuid, activeRouter.id, script);
    setBusyKey('');
    if (!res.ok) {
      setFeedback({
        ok: false,
        text:
          lang === 'ar'
            ? `تعذر إرسال الأمر: ${res.error || 'خطأ شبكة'}`
            : `Command push failed: ${res.error || 'Network error'}`,
      });
      return;
    }
    setFeedback({
      ok: true,
      text:
        mode === 'sandbox'
          ? lang === 'ar'
            ? `${msgAr} (تمت المحاكاة وإيداع الأمر في قائمة الانتظار)`
            : `${msgEn} (Sandbox / queued)`
          : res.executed
          ? lang === 'ar'
            ? `${msgAr} — تم التنفيذ الفوري على الراوتر ✅`
            : `${msgEn} — executed on router ✅`
          : lang === 'ar'
          ? `${msgAr} — في انتظار نبضة الوكيل القادمة ⏳`
          : `${msgEn} — queued for next heartbeat ⏳`,
    });
  };

  const handleFetchPublicIp = async () => {
    setFetchingIp(true);
    setFeedback({
      ok: true,
      text:
        lang === 'ar'
          ? 'تم إرسال أمر تحديث MikroTik Cloud DDNS وسحب الـ Public IP...'
          : 'Pushing Cloud DDNS update & Public IP discovery command...',
    });

    const cmd = buildFetchPublicIpCommand(tenantUuid, activeRouter.id);
    if (mode === 'sandbox') {
      const isDirectSingle = activeRouter.connectionMethod === 'static_ip';
      const simInfo: RouterPublicInfo = {
        publicIp: '185.44.120.77',
        directIp: '185.44.120.77',
        directInterface: 'ether2-PublicWAN',
        cloudExitIp: isDirectSingle ? '185.44.120.77' : '100.84.192.45',
        cloudDns: `${activeRouter.id.replace(/[^a-z0-9]/gi, '').slice(0, 10) || 'a1b2c3d4'}.sn.mynetname.net`,
        updatedAt: Date.now(),
      };
      onPublicInfoUpdated(simInfo);
      setFetchingIp(false);
      setFeedback({
        ok: true,
        text:
          lang === 'ar'
            ? 'تم جلب الآيبي المباشر على المنفذ (185.44.120.77) و Cloud Exit/DDNS في وضع المحاكاة ✅'
            : 'Fetched Direct Interface Public IP & Cloud Exit/DDNS (Sandbox) ✅',
      });
      return;
    }

    const res = await cloudSendAndAwaitRouterCommand(tenantUuid, activeRouter.id, cmd);
    const infoRes = await cloudFetchRouterPublicInfo(tenantUuid, activeRouter.id);
    setFetchingIp(false);

    if (infoRes.ok && infoRes.info) {
      onPublicInfoUpdated(infoRes.info);
      setFeedback({
        ok: true,
        text:
          lang === 'ar'
            ? `تم تحديث وجلب الآيبي الخارجي (${infoRes.info.publicIp}) بنجاح ✅`
            : `Fetched Public IP (${infoRes.info.publicIp}) successfully ✅`,
      });
    } else if (!res.ok) {
      setFeedback({
        ok: false,
        text:
          lang === 'ar'
            ? `فشل إرسال أمر الفحص: ${res.error || 'خطأ شبكة'}`
            : `Failed to push discovery command: ${res.error || 'Network error'}`,
      });
    } else {
      setFeedback({
        ok: true,
        text:
          lang === 'ar'
            ? 'تم إرسال الأمر — أعد الفحص بعد ثوانٍ إذا لم يصل رد الوكيل بعد.'
            : 'Command queued — click again in a few seconds once the agent pushes public_info.json.',
      });
    }
  };

  const feedbackBanner = feedback && (
    <div
      role="status"
      className={`rounded-xl border px-4 py-3 text-xs font-semibold flex items-center gap-2 ${
        feedback.ok
          ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-200'
          : 'border-rose-500/40 bg-rose-500/12 text-rose-200'
      }`}
    >
      {feedback.ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
      )}
      <span>{feedback.text}</span>
    </div>
  );

  // =========================================================
  // 1. PUBLIC IP & CLOUD DDNS
  // =========================================================
  if (activeModule === 'public_ip') {
    const analysis = analyzeRouterPublicInfo(publicInfo);
    const cmd = buildFetchPublicIpCommand(tenantUuid, activeRouter.id);

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Globe className="h-5 w-5 text-cyan-400" />
              <span>
                {lang === 'ar'
                  ? 'جلب الآيبي العالمي واكتشاف CGNAT / ستارلينك'
                  : 'Public IP Discovery & CGNAT Detector'}
              </span>
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {lang === 'ar'
                ? 'يفحص منافذ الراوتر (/ip address) لاستخراج الآيبي العالمي المباشر لـ WinBox و VPN، مع جلب Cloud Exit IP و DDNS.'
                : 'Scans active /ip address interfaces for Direct Public IP (for WinBox/VPN) alongside MikroTik Cloud Exit IP & DDNS.'}
            </p>
          </div>

          <button
            type="button"
            disabled={fetchingIp}
            onClick={handleFetchPublicIp}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg hover:brightness-110 disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`h-4 w-4 ${fetchingIp ? 'animate-spin' : ''}`} />
            <span>
              {lang === 'ar'
                ? 'جلب الآيبي الخارجي للسيرفر الآن 🌐'
                : 'Fetch Server Public IP Now 🌐'}
            </span>
          </button>
        </div>

        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-xs text-cyan-100 leading-relaxed space-y-1.5">
          <p className="font-extrabold text-cyan-300">
            {lang === 'ar' ? 'كيف تعمل ميزة الآيبي العالمي المزدوجة؟' : 'How Dual Public IP Detection Works'}
          </p>
          <p>
            {lang === 'ar'
              ? 'يفحص الأمر كلا المصدرين معاً على v6 و v7: (1) الآيبي العالمي المباشر على منافذ /ip address (مع استبعاد 10.x و 192.168.x و 172.16-31.x و 100.64-127.x ستارلينك) لاعتماده كعنوان رئيسي لـ WinBox و L2TP VPN حتى عند تفعيل دمج الخطوط أو ستارلينك، و(2) عنوان خروج السحابة Cloud Exit IP واسم النطاق Cloud DDNS.'
              : 'Checks both sources on v6 & v7: (1) Direct Interface Public IP from /ip address (filtering out private & CGNAT ranges) as primary endpoint for inbound WinBox/VPN even during Multi-WAN Starlink routing, and (2) Cloud Exit IP & *.sn.mynetname.net DDNS.'}
          </p>
        </div>

        {feedbackBanner}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="noc-glass rounded-2xl p-4 space-y-2 border border-cyan-500/30">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-cyan-300">
                {lang === 'ar'
                  ? 'الآيبي الأساسي للوصول (WinBox & VPN)'
                  : 'Primary IP (WinBox & VPN)'}
              </p>
              {analysis.hasDirectInterfaceIp && (
                <span
                  dir="ltr"
                  className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300 whitespace-nowrap shrink-0"
                >
                  {analysis.directInterface || 'Direct WAN'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xl font-extrabold text-cyan-300 tabular-nums" dir="ltr">
                {analysis.primaryIp || '—'}
              </span>
              {analysis.primaryIp && (
                <button
                  type="button"
                  onClick={() => copyText('pub_ip', analysis.primaryIp)}
                  className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/20 cursor-pointer flex items-center gap-1 shrink-0"
                >
                  {copiedKey === 'pub_ip' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedKey === 'pub_ip' ? (lang === 'ar' ? 'نُسخ' : 'Copied') : lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {analysis.hasDirectInterfaceIp
                ? lang === 'ar'
                  ? 'مأخوذ مباشرة من /ip address للاتصال المباشر الثابت'
                  : 'Sourced directly from /ip address for reliable inbound access'
                : lang === 'ar'
                ? 'لا يوجد IP عام مباشر على المنافذ — يعرض Cloud Exit'
                : 'No direct interface public IP — showing Cloud Exit fallback'}
            </p>
          </div>

          <div className="noc-glass rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-300">
                {lang === 'ar' ? 'خروج السحابة (Cloud Exit IP)' : 'Cloud Exit IP (/ip cloud)'}
              </p>
              {analysis.hasMultiWanHybrid && (
                <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 whitespace-nowrap shrink-0">
                  {lang === 'ar' ? 'مسار الخروج' : 'Exit Route'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xl font-extrabold text-amber-300 tabular-nums" dir="ltr">
                {analysis.cloudExitIp || '—'}
              </span>
              {analysis.cloudExitIp && (
                <button
                  type="button"
                  onClick={() => copyText('cloud_exit_ip', analysis.cloudExitIp)}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/20 cursor-pointer flex items-center gap-1 shrink-0"
                >
                  {copiedKey === 'cloud_exit_ip' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedKey === 'cloud_exit_ip' ? (lang === 'ar' ? 'نُسخ' : 'Copied') : lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {lang === 'ar'
                ? 'الآيبي الذي يخرج منه الراوتر للإنترنت (مثل ستارلينك أو الخط الافتراضي)'
                : 'Default WAN gateway IP seen by MikroTik Cloud'}
            </p>
          </div>

          <div className="noc-glass rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-300">
              {lang === 'ar' ? 'نطاق السحابة (Cloud DDNS)' : 'MikroTik Cloud DDNS'}
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-sm font-bold text-emerald-300" dir="ltr">
                {analysis.cloudDns || '—'}
              </span>
              {analysis.cloudDns && (
                <button
                  type="button"
                  onClick={() => copyText('cloud_dns', analysis.cloudDns)}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/20 cursor-pointer flex items-center gap-1 shrink-0"
                >
                  {copiedKey === 'cloud_dns' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedKey === 'cloud_dns' ? (lang === 'ar' ? 'نُسخ' : 'Copied') : lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {lang === 'ar'
                ? 'النطاق التلقائي المربوط بخدمة MikroTik Cloud DDNS'
                : 'Auto-updated MikroTik Cloud DDNS hostname'}
            </p>
          </div>

          <div className="noc-glass rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-300">
              {lang === 'ar' ? 'تشخيص الاتصال التلقائي' : 'Auto Network Classification'}
            </p>
            <p
              className={`text-sm font-extrabold ${
                analysis.isDirectPublic
                  ? 'text-emerald-300'
                  : analysis.classification === 'cgnat_starlink'
                  ? 'text-amber-300'
                  : 'text-slate-300'
              }`}
            >
              {lang === 'ar' ? analysis.labelAr : analysis.labelEn}
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {lang === 'ar' ? analysis.detailAr : analysis.detailEn}
            </p>
          </div>
        </div>

        <CodeTerminalBox
          title={lang === 'ar' ? 'أمر الفحص السحابي المزدوج (v6 & v7)' : 'Dual Public IP Discovery Command (v6 & v7)'}
          code={cmd}
          filename="mikrocore_public_ip.rsc"
          lang={lang}
          mode={mode}
          activeRouter={activeRouter}
          tenantUuid={tenantUuid}
          onSaveToVault={onSaveToVault}
        />
      </div>
    );
  }

  // =========================================================
  // 2. MIKROTIK L2TP/IPSec VPN
  // =========================================================
  if (activeModule === 'vpn_l2tp') {
    const enableCmd = buildL2tpVpnEnableCommand({
      osVersion: activeRouter.osVersion,
      username: vpnUser,
      password: vpnPass,
      ipsecSecret: vpnSecret,
      dishesSubnet: vpnSubnet,
    });
    const disableCmd = buildL2tpVpnDisableCommand();
    const vpnHost = resolvePrimaryWinboxVpnHost(publicInfo, activeRouter.host);

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <KeyRound className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'ربط VPN لميكروتك (L2TP / IPSec PSK للصحون والأبراج)'
                : 'MikroTik L2TP/IPSec VPN Server'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'الوصول الآمن من جوالك إلى صحون 192.168.x.x و 10.x.x.x بدون إبطاء سرعة المشتركين.'
              : 'Secure mobile/laptop tunnel to reach internal sector dishes without affecting subscriber throughput.'}
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-xs text-cyan-100 leading-relaxed space-y-1">
          <p className="font-extrabold text-cyan-300">
            {lang === 'ar'
              ? 'لماذا نستخدم L2TP/IPSec PSK لإدارة الشبكة؟'
              : 'Why L2TP/IPSec PSK for WISP Management?'}
          </p>
          <p>
            {lang === 'ar'
              ? 'يعمل بروتوكول L2TP/IPSec PSK أصلياً على RouterOS v6 و v7 وعلى هواتف Android و iOS و Windows بدون الحاجة لتثبيت تطبيقات إضافية، ويتيح لك فتح واجهات الصحون الداخلية (192.168.x.x / 10.x.x.x) أو WinBox من أي مكان دون تمرير أو إبطاء ترافيك المشتركين.'
              : 'L2TP/IPSec PSK runs natively on both RouterOS v6/v7 and Android/iOS/Windows, letting you manage local 192.168.x.x/10.x.x.x radios remotely without routing subscriber traffic.'}
          </p>
        </div>

        {feedbackBanner}

        <div className="noc-glass rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'اسم المستخدم (VPN User)' : 'VPN Username'}
              </label>
              <input
                type="text"
                value={vpnUser}
                onChange={(e) => setVpnUser(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'كلمة المرور' : 'VPN Password'}
              </label>
              <input
                type="text"
                value={vpnPass}
                onChange={(e) => setVpnPass(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'مفتاح IPSec Secret' : 'IPSec Pre-Shared Key'}
              </label>
              <input
                type="text"
                value={vpnSecret}
                onChange={(e) => setVpnSecret(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-cyan-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'شبكة الصحون والأبراج' : 'Dishes Subnet'}
              </label>
              <input
                type="text"
                value={vpnSubnet}
                onChange={(e) => setVpnSubnet(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={busyKey === 'vpn_on'}
              onClick={() =>
                pushRouterCommand(
                  'vpn_on',
                  enableCmd,
                  'تم تفعيل سيرفر L2TP/IPSec VPN',
                  'Enabled L2TP/IPSec VPN Server'
                )
              }
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-110 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{lang === 'ar' ? 'تفعيل سيرفر الـ VPN 🚀' : 'Enable VPN Server 🚀'}</span>
            </button>

            <button
              type="button"
              disabled={busyKey === 'vpn_off'}
              onClick={() =>
                pushRouterCommand(
                  'vpn_off',
                  disableCmd,
                  'تم إيقاف سيرفر الـ VPN وحذف قواعد MikroCore_VPN فقط',
                  'Disabled VPN server and removed MikroCore_VPN rules'
                )
              }
              className="flex items-center gap-2 rounded-xl border border-rose-500/45 bg-rose-500/15 px-4 py-2.5 text-xs font-extrabold text-rose-200 hover:bg-rose-500/25 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Square className="h-3.5 w-3.5" />
              <span>{lang === 'ar' ? 'إيقاف الـ VPN 🛑' : 'Disable VPN 🛑'}</span>
            </button>
          </div>
        </div>

        {/* Ready-to-Use Phone Connection Card */}
        <div className="noc-glass rounded-2xl p-5 space-y-4 border border-emerald-500/25">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span>
                {lang === 'ar'
                  ? 'بطاقة إعداد اتصال الهاتف الجاهزة (L2TP/IPSec PSK)'
                  : 'Ready-to-Use Mobile Connection Card'}
              </span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {publicInfo?.directIp
                ? lang === 'ar'
                  ? 'معبأة تلقائياً بالآيبي المباشر على المنفذ ✅'
                  : 'Auto-filled from Direct Interface Public IP ✅'
                : publicInfo?.cloudDns || publicInfo?.publicIp
                ? lang === 'ar'
                  ? 'معبأة تلقائياً من الآيبي العالمي ✅'
                  : 'Auto-filled from Public IP ✅'
                : lang === 'ar'
                ? 'استخدم تبويب الآيبي العالمي لتعبئة النطاق تلقائياً'
                : 'Fetch Public IP first to auto-fill DDNS'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { key: 'host', label: lang === 'ar' ? 'عنوان الخادم (Server)' : 'Server Address', val: vpnHost },
              { key: 'user', label: lang === 'ar' ? 'اسم المستخدم' : 'Username', val: vpnUser },
              { key: 'pass', label: lang === 'ar' ? 'كلمة المرور' : 'Password', val: vpnPass },
              { key: 'psk', label: lang === 'ar' ? 'مفتاح IPSec PSK' : 'IPSec Secret', val: vpnSecret },
            ].map((row) => (
              <div
                key={row.key}
                className="rounded-xl border border-slate-800 bg-[#050A18]/80 p-3 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400">{row.label}</p>
                  <p className="truncate font-mono text-xs font-bold text-white" dir="ltr">
                    {row.val}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(`vpn_${row.key}`, row.val)}
                  className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-1.5 text-cyan-200 hover:bg-cyan-500/20 cursor-pointer shrink-0"
                  title={lang === 'ar' ? 'نسخ' : 'Copy'}
                >
                  {copiedKey === `vpn_${row.key}` ? (
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-300 space-y-1.5">
            <p className="font-bold text-cyan-300">
              {lang === 'ar' ? 'دليل الاتصال السريع (3 خطوات):' : '3-Step Quick Phone Setup:'}
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                {lang === 'ar'
                  ? 'افتح إعدادات الهاتف -> الشبكة والإنترنت -> VPN -> إضافة ملف تعريف جديد من نوع L2TP/IPSec PSK.'
                  : 'Open Settings -> Network -> VPN -> Add profile of type L2TP/IPSec PSK.'}
              </li>
              <li>
                {lang === 'ar'
                  ? `أدخل عنوان الخادم (${vpnHost}) ومفتاح IPSec المشترك (${vpnSecret}) ثم احفظ.`
                  : `Enter Server Address (${vpnHost}) and IPSec Pre-Shared Key (${vpnSecret}).`}
              </li>
              <li>
                {lang === 'ar'
                  ? `اضغط اتصال وأدخل (${vpnUser} / كلمة المرور)، ثم افتح متصفحك على أي IP صحن داخل ${vpnSubnet}.`
                  : `Connect with (${vpnUser} / password) and browse any dish IP inside ${vpnSubnet}.`}
              </li>
            </ol>
          </div>
        </div>

        <CodeTerminalBox
          title={lang === 'ar' ? 'سكريبت تفعيل L2TP/IPSec VPN (v6 & v7)' : 'L2TP/IPSec Enable Script'}
          code={enableCmd}
          filename="mikrocore_vpn_l2tp.rsc"
          lang={lang}
          mode={mode}
          activeRouter={activeRouter}
          tenantUuid={tenantUuid}
          onSaveToVault={onSaveToVault}
        />
      </div>
    );
  }

  // =========================================================
  // 3. STARLINK QUOTA SAVER
  // =========================================================
  if (activeModule === 'starlink_quota') {
    const enableCmd = buildStarlinkPeakSaverEnableCommand({
      osVersion: activeRouter.osVersion,
      lanInterface: slLanIf,
      lanSubnet: slLanSubnet,
      peakStartTime: slPeakStart,
      peakEndTime: slPeakEnd,
      bulkCapLimit: slBulkCap,
    });
    const disableCmd = buildStarlinkPeakSaverDisableCommand();

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <SatelliteDish className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'حماية حصة الستارلينك وقت الذروة (Starlink Quota Saver)'
                : 'Starlink Peak Quota Saver'}
            </span>
          </h2>
        </div>

        {/* Mandatory Top Arabic Explanation Card */}
        <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-xs text-amber-100 leading-relaxed space-y-1.5">
          <p className="font-extrabold text-amber-300">
            {lang === 'ar'
              ? 'لماذا هذه الميزة ضرورية لخطوط ستارلينك؟'
              : 'Why Peak Quota Shaping Protects Starlink?'}
          </p>
          <p>
            {lang === 'ar'
              ? 'تستهلك التحميلات الثقيلة (مثل التورنت وتحديثات Windows ورفع الفيديو 4K) حصة الستارلينك بسرعة وتتسبب في ارتفاع البنق وتقطيع الشبكة لجميع المشتركين. يقوم هذا النظام بتحديد سقف ذكي للتحميلات الثقيلة تلقائياً خلال ساعات الذروة (7 مساءً – 12 ليلاً)، مما يوفر حتى 40% من الحصة مع بقاء ألعاب PUBG و FreeFire ورسائل WhatsApp بأقصى سرعة وأقل بنق!'
              : 'Heavy bulk downloads drain Starlink priority data and spike latency. Scheduled peak-hour shaping (19:00–00:00) saves up to 40% quota while keeping PUBG, FreeFire, and WhatsApp in priority fast-path.'}
          </p>
        </div>

        {feedbackBanner}

        <div className="noc-glass rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'منفذ LAN / Bridge' : 'LAN Bridge'}
              </label>
              <input
                type="text"
                value={slLanIf}
                onChange={(e) => setSlLanIf(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'شبكة المشتركين (Subnet)' : 'LAN Subnet'}
              </label>
              <input
                type="text"
                value={slLanSubnet}
                onChange={(e) => setSlLanSubnet(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'بداية الذروة' : 'Peak Start'}
              </label>
              <input
                type="text"
                value={slPeakStart}
                onChange={(e) => setSlPeakStart(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-cyan-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'نهاية الذروة' : 'Peak End'}
              </label>
              <input
                type="text"
                value={slPeakEnd}
                onChange={(e) => setSlPeakEnd(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-cyan-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'سقف التحميل الثقيل' : 'Bulk Download Cap'}
              </label>
              <input
                type="text"
                value={slBulkCap}
                onChange={(e) => setSlBulkCap(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-amber-300"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={busyKey === 'starlink_on'}
              onClick={() =>
                pushRouterCommand(
                  'starlink_on',
                  enableCmd,
                  'تم تفعيل توفير ذروة الستارلينك المجدول (7م–12م)',
                  'Enabled scheduled Starlink peak quota saver'
                )
              }
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-110 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" />
              <span>
                {lang === 'ar'
                  ? 'تفعيل توفير ذروة الستارلينك 🚀'
                  : 'Activate Starlink Peak Saver 🚀'}
              </span>
            </button>

            <button
              type="button"
              disabled={busyKey === 'starlink_off'}
              onClick={() =>
                pushRouterCommand(
                  'starlink_off',
                  disableCmd,
                  'تم إيقاف توفير الذروة وإزالة قواعد MikroCore_StarlinkSaver',
                  'Disabled peak saver and removed MikroCore_StarlinkSaver rules'
                )
              }
              className="flex items-center gap-2 rounded-xl border border-rose-500/45 bg-rose-500/15 px-4 py-2.5 text-xs font-extrabold text-rose-200 hover:bg-rose-500/25 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Square className="h-3.5 w-3.5" />
              <span>{lang === 'ar' ? 'إيقاف توفير الذروة 🛑' : 'Disable Peak Saver 🛑'}</span>
            </button>
          </div>
        </div>

        <CodeTerminalBox
          title={lang === 'ar' ? 'سكريبت توفير ذروة الستارلينك (v6 & v7)' : 'Starlink Peak Saver Script'}
          code={enableCmd}
          filename="mikrocore_starlink_saver.rsc"
          lang={lang}
          mode={mode}
          activeRouter={activeRouter}
          tenantUuid={tenantUuid}
          onSaveToVault={onSaveToVault}
        />
      </div>
    );
  }

  // =========================================================
  // 4. SMART QUOTA GUARD & AUTO RESET
  // =========================================================
  if (activeModule === 'quota_guard') {
    const enableCmd = buildQuotaGuardEnableCommand({
      osVersion: activeRouter.osVersion,
      serviceType: qgService,
      targetProfile: qgProfile,
      quotaGb: qgGb,
      throttleRate: qgThrottle,
      resetCycle: qgCycle,
    });
    const disableCmd = buildQuotaGuardDisableCommand();

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Gauge className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'حارس الحصص والتصفير التلقائي (Smart Quota Guard)'
                : 'Smart Quota Guard & Auto Reset'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'خفض سرعة المشترك تلقائياً إلى 512kbps لتصفح الواتساب بدلاً من فصله عند نفاد الحصة، مع تصفير تلقائي يومي أو شهري.'
              : 'Throttles exceeded accounts to 512kbps for WhatsApp/messaging instead of cutting service, with automatic midnight or monthly reset.'}
          </p>
        </div>

        {feedbackBanner}

        <div className="noc-glass rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'نوع الخدمة' : 'Service Type'}
              </label>
              <select
                value={qgService}
                onChange={(e) => setQgService(e.target.value as 'hotspot' | 'pppoe')}
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 text-xs text-white"
              >
                <option value="hotspot">Hotspot Users</option>
                <option value="pppoe">PPPoE Secrets</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'اسم الباقة المستهدفة' : 'Target Profile'}
              </label>
              <input
                type="text"
                value={qgProfile}
                onChange={(e) => setQgProfile(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'سقف الاستهلاك (GB)' : 'Quota Limit (GB)'}
              </label>
              <input
                type="number"
                min={1}
                max={5000}
                value={qgGb}
                onChange={(e) => setQgGb(Number(e.target.value) || 5)}
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-cyan-300 tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'السرعة البديلة (واتساب)' : 'Fallback Speed'}
              </label>
              <input
                type="text"
                value={qgThrottle}
                onChange={(e) => setQgThrottle(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-emerald-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'جدول التصفير التلقائي' : 'Auto Reset Cycle'}
              </label>
              <select
                value={qgCycle}
                onChange={(e) => setQgCycle(e.target.value as 'daily' | 'monthly')}
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 text-xs text-white"
              >
                <option value="daily">{lang === 'ar' ? 'يومي منتصف الليل (00:00)' : 'Daily Midnight (00:00)'}</option>
                <option value="monthly">{lang === 'ar' ? 'شهري (كل 30 يوم 00:00)' : 'Monthly (Day 1 · 00:00)'}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={busyKey === 'qg_on'}
              onClick={() =>
                pushRouterCommand(
                  'qg_on',
                  enableCmd,
                  'تم تفعيل حارس الحصص والتصفير التلقائي',
                  'Enabled Smart Quota Guard & Auto Reset'
                )
              }
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-110 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" />
              <span>
                {lang === 'ar'
                  ? 'تفعيل حارس الحصص والتصفير 🚀'
                  : 'Enable Quota Guard & Reset 🚀'}
              </span>
            </button>

            <button
              type="button"
              disabled={busyKey === 'qg_off'}
              onClick={() =>
                pushRouterCommand(
                  'qg_off',
                  disableCmd,
                  'تم إيقاف حارس الحصص وإزالة المجدول الخاص به فقط',
                  'Disabled Quota Guard cleanly'
                )
              }
              className="flex items-center gap-2 rounded-xl border border-rose-500/45 bg-rose-500/15 px-4 py-2.5 text-xs font-extrabold text-rose-200 hover:bg-rose-500/25 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Square className="h-3.5 w-3.5" />
              <span>{lang === 'ar' ? 'إيقاف الحارس 🛑' : 'Disable Guard 🛑'}</span>
            </button>
          </div>
        </div>

        <CodeTerminalBox
          title={lang === 'ar' ? 'سكريبت حارس الحصص والتصفير (v6 & v7)' : 'Smart Quota Guard Script'}
          code={enableCmd}
          filename="mikrocore_quota_guard.rsc"
          lang={lang}
          mode={mode}
          activeRouter={activeRouter}
          tenantUuid={tenantUuid}
          onSaveToVault={onSaveToVault}
        />
      </div>
    );
  }

  // =========================================================
  // 5. LOOP & BROADCAST STORM PROTECTION
  // =========================================================
  if (activeModule === 'loop_protect') {
    const enableCmd = buildLoopProtectEnableCommand(loopBridge);
    const disableCmd = buildLoopProtectDisableCommand();

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'الحماية من الحلقات وعواصف البث (Loop & Storm Protect)'
                : 'Loop Protect & Broadcast Storm Guard'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'يمنع انهيار المعالج وتجمد الشبكة عند توصيل سلك خاطئ (Loop) أو هجمات Broadcast/ARP.'
              : 'Prevents router CPU freezes caused by accidental switch/cable loops or broadcast storms.'}
          </p>
        </div>

        {feedbackBanner}

        <div className="noc-glass rounded-2xl p-5 space-y-4">
          <div className="max-w-sm">
            <label className="mb-1 block text-[11px] text-slate-400">
              {lang === 'ar' ? 'اسم الجسر الرئيسي (Bridge)' : 'Target LAN Bridge'}
            </label>
            <input
              type="text"
              value={loopBridge}
              onChange={(e) => setLoopBridge(e.target.value)}
              dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busyKey === 'loop_on'}
              onClick={() =>
                pushRouterCommand(
                  'loop_on',
                  enableCmd,
                  'تم تفعيل الحماية من الحلقات وعواصف البث على المنافذ والجسر',
                  'Enabled Loop Protect & Broadcast Storm Guard'
                )
              }
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-110 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{lang === 'ar' ? 'تفعيل الحماية من الحلقات 🚀' : 'Enable Loop Protect 🚀'}</span>
            </button>

            <button
              type="button"
              disabled={busyKey === 'loop_off'}
              onClick={() =>
                pushRouterCommand(
                  'loop_off',
                  disableCmd,
                  'تم إيقاف الحماية من الحلقات وإزالة قواعد MikroCore_LoopProtect',
                  'Disabled Loop Protect cleanly'
                )
              }
              className="flex items-center gap-2 rounded-xl border border-rose-500/45 bg-rose-500/15 px-4 py-2.5 text-xs font-extrabold text-rose-200 hover:bg-rose-500/25 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Square className="h-3.5 w-3.5" />
              <span>{lang === 'ar' ? 'إيقاف الحماية 🛑' : 'Disable Protection 🛑'}</span>
            </button>
          </div>
        </div>

        <CodeTerminalBox
          title={lang === 'ar' ? 'سكريبت الحماية من الحلقات (v6 & v7)' : 'Loop & Storm Protection Script'}
          code={enableCmd}
          filename="mikrocore_loop_protect.rsc"
          lang={lang}
          mode={mode}
          activeRouter={activeRouter}
          tenantUuid={tenantUuid}
          onSaveToVault={onSaveToVault}
        />
      </div>
    );
  }

  // =========================================================
  // 6. EMERGENCY MAINTENANCE MODE
  // =========================================================
  if (activeModule === 'maintenance_mode') {
    const enableCmd = buildMaintenanceEnableCommand({
      osVersion: activeRouter.osVersion,
      exemptAdminIp: maintExemptIp,
      proxyPort: maintPort,
    });
    const disableCmd = buildMaintenanceDisableCommand();

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Construction className="h-5 w-5 text-amber-400" />
            <span>
              {lang === 'ar'
                ? 'وضع الصيانة الطارئة (Emergency Maintenance Mode)'
                : 'Emergency Maintenance Mode'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'تحويل حركة التصفح مؤقتاً بضغطة واحدة أثناء صيانة الأبراج وإعادة الخدمة فور الانتهاء.'
              : 'Temporarily redirects HTTP traffic during tower repairs and restores normal routing in one click.'}
          </p>
        </div>

        {feedbackBanner}

        <div className="noc-glass rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-xl">
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'استثناء آيبي الإدارة (اختياري)' : 'Exempt Admin IP (Optional)'}
              </label>
              <input
                type="text"
                value={maintExemptIp}
                onChange={(e) => setMaintExemptIp(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'منفذ صفحة الصيانة (Proxy Port)' : 'Maintenance Proxy Port'}
              </label>
              <input
                type="number"
                min={1024}
                max={65535}
                value={maintPort}
                onChange={(e) => setMaintPort(Number(e.target.value) || 8080)}
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-amber-300 tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busyKey === 'maint_on'}
              onClick={() =>
                pushRouterCommand(
                  'maint_on',
                  enableCmd,
                  'تم تفعيل وضع الصيانة الطارئة',
                  'Activated Emergency Maintenance Mode'
                )
              }
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-110 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Construction className="h-4 w-4" />
              <span>{lang === 'ar' ? 'تفعيل وضع الصيانة 🚧' : 'Enable Maintenance Mode 🚧'}</span>
            </button>

            <button
              type="button"
              disabled={busyKey === 'maint_off'}
              onClick={() =>
                pushRouterCommand(
                  'maint_off',
                  disableCmd,
                  'تم إنهاء وضع الصيانة وإعادة الخدمة للمشتركين بنجاح ✅',
                  'Ended maintenance mode and restored service ✅'
                )
              }
              className="flex items-center gap-2 rounded-xl border border-emerald-500/45 bg-emerald-500/15 px-4 py-2.5 text-xs font-extrabold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {lang === 'ar'
                  ? 'إنهاء الصيانة وإعادة الخدمة ✅'
                  : 'End Maintenance & Restore Service ✅'}
              </span>
            </button>
          </div>
        </div>

        <CodeTerminalBox
          title={lang === 'ar' ? 'سكريبت وضع الصيانة الطارئة (v6 & v7)' : 'Maintenance Mode Script'}
          code={enableCmd}
          filename="mikrocore_maintenance.rsc"
          lang={lang}
          mode={mode}
          activeRouter={activeRouter}
          tenantUuid={tenantUuid}
          onSaveToVault={onSaveToVault}
        />
      </div>
    );
  }

  // =========================================================
  // 7. DAILY SERVER TRAFFIC REPORT
  // =========================================================
  const downBytes = sandboxFallback ? 64.8 * 1024 ** 3 : dailyTraffic.downloadBytes;
  const upBytes = sandboxFallback ? 11.4 * 1024 ** 3 : dailyTraffic.uploadBytes;
  const totalBytes = downBytes + upBytes;
  const downGb = downBytes / 1024 ** 3;
  const upGb = upBytes / 1024 ** 3;
  const totalGb = totalBytes / 1024 ** 3;
  const peakRx = sandboxFallback ? 186.4 : dailyTraffic.peakRxMbps;
  const peakTx = sandboxFallback ? 42.1 : dailyTraffic.peakTxMbps;
  const budgetPct = Math.min(100, (totalGb / Math.max(1, dailyBudgetGb)) * 100);

  const handleExportDailyCsv = () => {
    const csv = [
      'Date,Router,Download_GB,Upload_GB,Total_GB,Peak_RX_Mbps,Peak_TX_Mbps,Daily_Budget_GB',
      `${dailyTraffic.dateYmd},${activeRouter.name},${downGb.toFixed(2)},${upGb.toFixed(2)},${totalGb.toFixed(2)},${peakRx.toFixed(1)},${peakTx.toFixed(1)},${dailyBudgetGb}`,
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MikroCore_Daily_Traffic_${dailyTraffic.dateYmd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'تقرير استهلاك السيرفر اليومي (Daily Traffic Report)'
                : 'Daily Server Traffic & Quota Report'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'حساب إجمالي الجيجابايت المسحوبة والمرفوعة يومياً من نبضات السرعة الحية لمقارنتها مع حصة ستارلينك أو المزود.'
              : 'Tracks daily downloaded & uploaded GB from live RX/TX telemetry to compare against Starlink/ISP daily quota.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportDailyCsv}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/12 px-3.5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'تصدير CSV' : 'Export CSV'}</span>
          </button>
          <button
            type="button"
            onClick={onResetDailyTraffic}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-300 hover:border-rose-400 hover:text-rose-200 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'تصفير عداد اليوم' : 'Reset Today'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="noc-glass rounded-2xl p-4 space-y-1">
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ArrowDownToLine className="h-3.5 w-3.5 text-cyan-400" />
            <span>{lang === 'ar' ? 'التنزيل اليومي (Download)' : 'Daily Download'}</span>
          </p>
          <p className="font-mono text-2xl font-extrabold text-cyan-300 tabular-nums" dir="ltr">
            {downGb.toFixed(2)} GB
          </p>
          <p className="text-[11px] text-slate-400 font-mono" dir="ltr">
            Peak: {peakRx.toFixed(1)} Mbps
          </p>
        </div>

        <div className="noc-glass rounded-2xl p-4 space-y-1">
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ArrowUpFromLine className="h-3.5 w-3.5 text-emerald-400" />
            <span>{lang === 'ar' ? 'الرفع اليومي (Upload)' : 'Daily Upload'}</span>
          </p>
          <p className="font-mono text-2xl font-extrabold text-emerald-300 tabular-nums" dir="ltr">
            {upGb.toFixed(2)} GB
          </p>
          <p className="text-[11px] text-slate-400 font-mono" dir="ltr">
            Peak: {peakTx.toFixed(1)} Mbps
          </p>
        </div>

        <div className="noc-glass rounded-2xl p-4 space-y-1">
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-amber-400" />
            <span>{lang === 'ar' ? 'الإجمالي المستهلك اليوم' : 'Combined Daily Total'}</span>
          </p>
          <p className="font-mono text-2xl font-extrabold text-white tabular-nums" dir="ltr">
            {totalGb.toFixed(2)} GB
          </p>
          <p className="text-[11px] text-slate-400 font-mono" dir="ltr">
            {dailyTraffic.dateYmd}
          </p>
        </div>

        <div className="noc-glass rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              {lang === 'ar' ? 'مقارنة بسقف الحصة (GB)' : 'Daily Quota Target (GB)'}
            </span>
            <input
              type="number"
              min={10}
              max={5000}
              value={dailyBudgetGb}
              onChange={(e) => setDailyBudgetGb(Number(e.target.value) || 150)}
              className="w-20 rounded-lg border border-slate-700 bg-[#050A18] px-2 py-0.5 font-mono text-xs text-cyan-300 tabular-nums"
            />
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all ${
                budgetPct > 85 ? 'bg-rose-400' : budgetPct > 65 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <p className="font-mono text-xs text-slate-300 tabular-nums" dir="ltr">
            {budgetPct.toFixed(1)}% of {dailyBudgetGb} GB
          </p>
        </div>
      </div>

      <div className="noc-glass rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">
            {lang === 'ar' ? 'توزيع الاستهلاك الساعي اليوم' : 'Hourly Traffic Breakdown'}
          </h3>
          <span className="text-[11px] text-slate-400">
            {liveTelemetry
              ? lang === 'ar'
                ? `متصل حالياً: ${((liveTelemetry.rxBps ?? 0) / 1_000_000).toFixed(1)} Mbps ↓ / ${((liveTelemetry.txBps ?? 0) / 1_000_000).toFixed(1)} Mbps ↑`
                : `Live: ${((liveTelemetry.rxBps ?? 0) / 1_000_000).toFixed(1)} Mbps ↓ / ${((liveTelemetry.txBps ?? 0) / 1_000_000).toFixed(1)} Mbps ↑`
              : sandboxFallback
              ? lang === 'ar'
                ? 'عرض بيانات محاكاة مرجعية في Sandbox'
                : 'Showing Sandbox reference curve'
              : lang === 'ar'
              ? 'يتراكم العداد تلقائياً مع كل نبضة حية كل 5 ثوانٍ'
              : 'Accumulates automatically every 5s telemetry pulse'}
          </span>
        </div>

        <div className="space-y-2.5">
          {hourlyRows.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              {lang === 'ar'
                ? 'بانتظار نبضات السرعة الحية لتسجيل استهلاك الساعات...'
                : 'Waiting for live bandwidth pulses to log hourly GB totals...'}
            </p>
          ) : (
            hourlyRows.map((row) => {
              const sum = row.downGb + row.upGb;
              const barPct = Math.min(100, Math.max(4, (sum / Math.max(5, dailyBudgetGb * 0.25)) * 100));
              return (
                <div key={row.hour} className="grid grid-cols-[64px_1fr_140px] items-center gap-3 text-xs">
                  <span className="font-mono text-slate-400 tabular-nums" dir="ltr">
                    {row.hour}
                  </span>
                  <div className="h-3 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className="font-mono text-end text-cyan-200 tabular-nums" dir="ltr">
                    {row.downGb.toFixed(2)}↓ / {row.upGb.toFixed(2)}↑ GB
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
