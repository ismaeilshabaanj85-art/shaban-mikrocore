import React, { useMemo, useState } from 'react';
import {
  Clock,
  Layers,
  Play,
  Plus,
  Printer,
  Search,
  Ticket,
  Trash2,
} from 'lucide-react';
import {
  AppMode,
  GeneratedVoucher,
  Language,
  RouterProfile,
  SpeedProfile,
} from '../../types/mikrocore';
import {
  PRESET_SPEED_PROFILES,
  generateSpeedProfileScript,
  generateVoucherBatch,
  generateVoucherBatchRsc,
} from '../../engine/networkEngine';
import { cloudSendAndAwaitRouterCommand } from '../../utils/firebaseCloud';
import { generateUUID, sanitizeInput } from '../../utils/security';
import { loadSession } from '../../utils/storage';
import { CodeTerminalBox } from '../CodeTerminalBox';
import { VoucherPrintStudio } from './VoucherPrintStudio';

interface RadiusVouchersModuleProps {
  lang: Language;
  mode: AppMode;
  activeRouter: RouterProfile;
  tenantUuid?: string;
  portalNetworkName?: string;
  portalSupportPhone?: string;
  customProfiles: SpeedProfile[];
  onSaveCustomProfiles: (profiles: SpeedProfile[]) => void;
  vouchers: GeneratedVoucher[];
  onSaveVouchers: (vouchers: GeneratedVoucher[]) => void;
  onSaveToVault: (name: string, content: string, type: 'rsc' | 'backup') => void;
}

export const RadiusVouchersModule: React.FC<RadiusVouchersModuleProps> = ({
  lang,
  mode,
  activeRouter,
  tenantUuid,
  portalNetworkName,
  portalSupportPhone,
  customProfiles,
  onSaveCustomProfiles,
  vouchers,
  onSaveVouchers,
  onSaveToVault,
}) => {
  const allProfiles = useMemo(
    () => [...PRESET_SPEED_PROFILES, ...customProfiles],
    [customProfiles]
  );

  const [tab, setTab] = useState<'generator' | 'profiles' | 'print'>('generator');
  const [selectedProfileId, setSelectedProfileId] = useState<string>(allProfiles[2].id);
  const [serviceType, setServiceType] = useState<'hotspot' | 'pppoe'>('hotspot');
  const [batchCount, setBatchCount] = useState(20);
  const [prefix, setPrefix] = useState('MC-');
  const [codeLength, setCodeLength] = useState(6);
  const [charsetMode, setCharsetMode] = useState<'numeric' | 'alphanumeric'>('alphanumeric');
  const [pinMode, setPinMode] = useState<'same_as_code' | 'random_pin'>('same_as_code');
  const [searchQuery, setSearchQuery] = useState('');

  // Custom Profile Builder state
  const [newName, setNewName] = useState('VIP-15M');
  const [newDown, setNewDown] = useState(15);
  const [newUp, setNewUp] = useState(6);
  const [newQuotaGb, setNewQuotaGb] = useState(50);
  const [durDays, setDurDays] = useState(30);
  const [durHours, setDurHours] = useState(0);
  const [durMinutes, setDurMinutes] = useState(0);
  const [durSeconds, setDurSeconds] = useState(0);
  const [newShared, setNewShared] = useState(2);
  const [newPrice, setNewPrice] = useState(12);
  const [pushingRemote, setPushingRemote] = useState(false);
  const [remoteNotice, setRemoteNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const activeProfile =
    allProfiles.find((p) => p.id === selectedProfileId) || allProfiles[0];

  const handleGenerateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const generated = generateVoucherBatch({
      count: batchCount,
      prefix,
      codeLength,
      charsetMode,
      pinMode,
      serviceType,
      profile: activeProfile,
      lang,
    });
    const merged = [...generated, ...vouchers].slice(0, 1000);
    onSaveVouchers(merged);
  };

  const handleCreateCustomProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const totalSec = Math.max(
      60,
      durDays * 86400 + durHours * 3600 + durMinutes * 60 + durSeconds
    );
    const label = `${durDays}d ${durHours}h ${durMinutes}m ${durSeconds}s`;
    const created: SpeedProfile = {
      id: generateUUID(),
      name: sanitizeInput(newName) || `Custom-${newDown}M`,
      downloadMbps: Math.max(1, Number(newDown) || 1),
      uploadMbps: Math.max(1, Number(newUp) || 1),
      dataQuotaGb: Math.max(0, Number(newQuotaGb) || 0),
      durationSeconds: totalSec,
      durationLabelAr: label,
      durationLabelEn: label,
      sharedUsers: Math.max(1, Number(newShared) || 1),
      price: Math.max(0, Number(newPrice) || 0),
      currency: '$',
      serviceType: 'both',
    };
    const next = [...customProfiles, created];
    onSaveCustomProfiles(next);
    setSelectedProfileId(created.id);
    setTab('generator');
  };

  const filteredVouchers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return vouchers;
    return vouchers.filter(
      (v) =>
        v.code.toLowerCase().includes(q) ||
        v.profileName.toLowerCase().includes(q) ||
        v.serviceType.toLowerCase().includes(q)
    );
  }, [vouchers, searchQuery]);

  const batchRsc = useMemo(
    () =>
      generateVoucherBatchRsc(
        vouchers.slice(0, 1000),
        activeProfile,
        activeRouter.osVersion
      ),
    [vouchers, activeProfile, activeRouter.osVersion]
  );

  const profileScript = useMemo(
    () => generateSpeedProfileScript(activeProfile, activeRouter.osVersion),
    [activeProfile, activeRouter.osVersion]
  );

  const handlePushScriptToRouter = async (scriptToSend: string, labelAr: string, labelEn: string) => {
    const effectiveTenant =
      tenantUuid || loadSession()?.tenantUuid || '00000000-0000-4000-8000-000000000001';
    setPushingRemote(true);
    setRemoteNotice({
      ok: true,
      message:
        lang === 'ar'
          ? `جارٍ إرسال ${labelAr} إلى الراوتر ${activeRouter.name} عبر السحابة...`
          : `Pushing ${labelEn} to ${activeRouter.name} via Firebase Cloud...`,
    });

    const res = await cloudSendAndAwaitRouterCommand(
      effectiveTenant,
      activeRouter.id,
      scriptToSend,
      () => {
        setRemoteNotice({
          ok: true,
          message:
            lang === 'ar'
              ? `تم رفع ${labelAr} إلى قائمة التنفيذ السحابية — بانتظار سحب الراوتر وتنفيذه...`
              : `${labelEn} queued in Firebase — waiting for router agent to execute...`,
        });
      }
    );

    setPushingRemote(false);
    if (!res.ok) {
      setRemoteNotice({
        ok: false,
        message:
          lang === 'ar'
            ? `تعذر الإرسال إلى السحابة (${res.error || 'خطأ شبكة'}).`
            : `Failed to push to cloud (${res.error || 'network error'}).`,
      });
      return;
    }

    setRemoteNotice({
      ok: true,
      message: res.executed
        ? lang === 'ar'
          ? `تم سحب ${labelAr} وتنفيذها على الراوتر ${activeRouter.name} بنجاح! ✅`
          : `${labelEn} pulled and executed on ${activeRouter.name} successfully! ✅`
        : lang === 'ar'
        ? `تم وضع ${labelAr} في قائمة التنفيذ السحابية — سينفذها الراوتر فور نبضة الوكيل القادمة.`
        : `${labelEn} queued in Firebase — router will execute on next agent heartbeat.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Ticket className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'مركز الراديوس والبطاقات الذكية'
                : 'Full RADIUS & Vouchers Center'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'باقات 1M إلى 100M + إغلاق تلقائي دقيق بالثانية (Auto-Expiry Scheduler) + استوديو طباعة.'
              : '1M–100M profiles + second-accurate Auto-Expiry scheduler + 4-template Print Studio.'}
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-cyan-500/25 bg-[#0B142B] p-1">
          <button
            type="button"
            onClick={() => setTab('generator')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              tab === 'generator' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Ticket className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'توليد البطاقات' : 'Voucher Batch'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('profiles')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              tab === 'profiles' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'منشئ الباقات' : 'Profile Builder'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('print')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              tab === 'print' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Printer className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'استوديو الطباعة' : 'Print Studio'}</span>
          </button>
        </div>
      </div>

      {/* Preset 1M-100M Speed Selector */}
      <div className="noc-glass rounded-2xl p-4">
        <p className="mb-3 text-xs font-bold text-slate-300">
          {lang === 'ar'
            ? 'اختر الباقة السريعة (من 1M إلى 100M) أو باقة مخصصة:'
            : 'Select Speed Profile (1M to 100M) or Custom:'}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {allProfiles.map((p) => {
            const active = p.id === activeProfile.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProfileId(p.id)}
                className={`rounded-xl border p-2.5 text-start transition cursor-pointer ${
                  active
                    ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_16px_rgba(0,229,255,0.18)]'
                    : 'border-slate-800 bg-[#050A18]/75 hover:border-cyan-500/35'
                }`}
              >
                <p className="font-mono text-xs font-extrabold text-white truncate">{p.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-cyan-300 tabular-nums">
                  {p.downloadMbps}M / {p.uploadMbps}M
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400 truncate">
                  {lang === 'ar' ? p.durationLabelAr : p.durationLabelEn} · {p.price}
                  {p.currency}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'generator' && (
        <div className="space-y-6">
          <form onSubmit={handleGenerateBatch} className="noc-glass rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                  {lang === 'ar' ? 'نوع الخدمة' : 'Service Type'}
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as 'hotspot' | 'pppoe')}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 text-xs text-white"
                >
                  <option value="hotspot">Hotspot</option>
                  <option value="pppoe">PPPoE</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                  {lang === 'ar' ? 'العدد (1 - 1000)' : 'Batch Count (1-1000)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={batchCount}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                  {lang === 'ar' ? 'البادئة (Prefix)' : 'Prefix'}
                </label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                  {lang === 'ar' ? 'طول الرمز' : 'Code Length'}
                </label>
                <input
                  type="number"
                  min={4}
                  max={12}
                  value={codeLength}
                  onChange={(e) => setCodeLength(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                  {lang === 'ar' ? 'نوع الأحرف' : 'Charset'}
                </label>
                <select
                  value={charsetMode}
                  onChange={(e) => setCharsetMode(e.target.value as 'numeric' | 'alphanumeric')}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 text-xs text-white"
                >
                  <option value="alphanumeric">
                    {lang === 'ar' ? 'أرقام + حروف' : 'Alphanumeric'}
                  </option>
                  <option value="numeric">{lang === 'ar' ? 'أرقام فقط' : 'Numeric Only'}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                  {lang === 'ar' ? 'كلمة المرور' : 'PIN Mode'}
                </label>
                <select
                  value={pinMode}
                  onChange={(e) => setPinMode(e.target.value as 'same_as_code' | 'random_pin')}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 text-xs text-white"
                >
                  <option value="same_as_code">
                    {lang === 'ar' ? 'نفس الكود (موحد)' : 'Same as Code'}
                  </option>
                  <option value="random_pin">
                    {lang === 'ar' ? 'رقم سري عشوائي' : 'Separate PIN'}
                  </option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-emerald-300">
                <Clock className="h-4 w-4" />
                <span>
                  {lang === 'ar'
                    ? `تفعيل الإغلاق التلقائي بالثانية: ${activeProfile.durationSeconds.toLocaleString()} ثانية`
                    : `Second-accurate auto-expiry armed: ${activeProfile.durationSeconds.toLocaleString()}s`}
                </span>
              </div>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-2.5 text-xs font-bold text-slate-950 transition hover:brightness-110 cursor-pointer"
              >
                {lang === 'ar' ? `توليد ${batchCount} بطاقة الآن` : `Generate ${batchCount} Vouchers`}
              </button>
            </div>
          </form>

          {/* Vouchers Table */}
          <div className="noc-glass rounded-2xl overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'البطاقات المولّدة' : 'Generated Vouchers'}
                </span>
                <span className="font-mono text-xs text-cyan-300 tabular-nums">
                  ({vouchers.length})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute top-2.5 start-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === 'ar' ? 'بحث بالكود...' : 'Search code...'}
                    className="rounded-xl border border-slate-700 bg-[#050A18]/85 ps-8 pe-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                  />
                </div>
                {vouchers.length > 0 && (
                  <>
                    <button
                      type="button"
                      disabled={pushingRemote}
                      onClick={() =>
                        handlePushScriptToRouter(
                          batchRsc,
                          'البطاقات',
                          'voucher batch'
                        )
                      }
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:brightness-110 disabled:opacity-60 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>
                        {pushingRemote
                          ? lang === 'ar'
                            ? 'جارٍ الإرسال...'
                            : 'Pushing...'
                          : lang === 'ar'
                          ? 'إرسال للسيرفر مباشرة 🚀'
                          : 'Push Directly to Server 🚀'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('print')}
                      className="flex items-center gap-1.5 rounded-xl border border-cyan-400/45 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>
                        {lang === 'ar'
                          ? 'طباعة صفحة A4 احترافية (PDF) 🖨️'
                          : 'Pro A4 Print Studio (PDF) 🖨️'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveVouchers([])}
                      className="flex items-center gap-1 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{lang === 'ar' ? 'مسح الكل' : 'Clear'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {remoteNotice && (
              <div
                className={`border-b px-4 py-2.5 text-xs font-semibold ${
                  remoteNotice.ok
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                }`}
              >
                {remoteNotice.message}
              </div>
            )}

            {filteredVouchers.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">
                {lang === 'ar'
                  ? 'لا توجد بطاقات حالياً. اضغط على "توليد" لإنشاء دفعة جديدة.'
                  : 'No vouchers yet. Click Generate to create a batch.'}
              </p>
            ) : (
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-start text-xs">
                  <thead className="sticky top-0 bg-slate-950/95 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5 text-start">#</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'الكود' : 'Code'}</th>
                      <th className="px-4 py-2.5 text-start">PIN</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'الباقة' : 'Profile'}</th>
                      <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'المدة' : 'Duration'}</th>
                      <th className="px-4 py-2.5 text-end">{lang === 'ar' ? 'السعر' : 'Price'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredVouchers.slice(0, 120).map((v, i) => (
                      <tr key={v.id} className="hover:bg-cyan-500/5">
                        <td className="px-4 py-2 font-mono text-slate-500 tabular-nums">{i + 1}</td>
                        <td className="px-4 py-2 font-mono font-bold text-cyan-300" dir="ltr">
                          {v.code}
                        </td>
                        <td className="px-4 py-2 font-mono text-slate-300" dir="ltr">
                          {v.password}
                        </td>
                        <td className="px-4 py-2 uppercase font-mono text-[11px] text-emerald-300">
                          {v.serviceType}
                        </td>
                        <td className="px-4 py-2 text-slate-200">{v.profileName}</td>
                        <td className="px-4 py-2 text-slate-300">{v.durationLabel}</td>
                        <td className="px-4 py-2 text-end font-mono font-bold text-white tabular-nums">
                          {v.price}
                          {v.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* .rsc Export Script */}
          {vouchers.length > 0 && (
            <CodeTerminalBox
              title={
                lang === 'ar'
                  ? `سكربت تصدير البطاقات مع الإغلاق التلقائي بالثانية (${activeRouter.osVersion.toUpperCase()})`
                  : `Vouchers + Second-Accurate Auto-Expiry Script (${activeRouter.osVersion.toUpperCase()})`
              }
              code={batchRsc}
              filename={`Vouchers_${activeProfile.name}_${vouchers.length}.rsc`}
              lang={lang}
              mode={mode}
              activeRouter={activeRouter}
              tenantUuid={tenantUuid}
              onSaveToVault={onSaveToVault}
            />
          )}
        </div>
      )}

      {tab === 'profiles' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateCustomProfile} className="noc-glass rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>
                {lang === 'ar' ? 'بناء باقة سرعة وحجم مخصصة' : 'Custom Speed & Quota Profile Builder'}
              </span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'اسم الباقة' : 'Profile Name'}
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Download (Mbps)</label>
                <input
                  type="number"
                  min={1}
                  value={newDown}
                  onChange={(e) => setNewDown(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Upload (Mbps)</label>
                <input
                  type="number"
                  min={1}
                  value={newUp}
                  onChange={(e) => setNewUp(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'الكوتا GB (0=مفتوح)' : 'Data Quota GB (0=∞)'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={newQuotaGb}
                  onChange={(e) => setNewQuotaGb(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'السعر ($)' : 'Price ($)'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={newPrice}
                  onChange={(e) => setNewPrice(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'الأيام' : 'Days'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={durDays}
                  onChange={(e) => setDurDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'الساعات' : 'Hours'}
                </label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={durHours}
                  onChange={(e) => setDurHours(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'الدقائق' : 'Minutes'}
                </label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={durMinutes}
                  onChange={(e) => setDurMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'الثواني' : 'Seconds'}
                </label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={durSeconds}
                  onChange={(e) => setDurSeconds(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'الأجهزة المسموحة' : 'Shared Users'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={newShared}
                  onChange={(e) => setNewShared(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={pushingRemote}
                onClick={() =>
                  handlePushScriptToRouter(
                    profileScript,
                    `باقة ${activeProfile.name}`,
                    `profile ${activeProfile.name}`
                  )
                }
                className="flex items-center gap-1.5 rounded-xl border border-emerald-400/45 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-60 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                <span>
                  {lang === 'ar'
                    ? 'إرسال وتنفيذ مباشر على الراوتر 🚀'
                    : 'Push & Execute on Router 🚀'}
                </span>
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-2.5 text-xs font-bold text-slate-950 cursor-pointer"
              >
                {lang === 'ar' ? 'حفظ الباقة المخصصة' : 'Save Custom Profile'}
              </button>
            </div>
            {remoteNotice && (
              <div
                className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${
                  remoteNotice.ok
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                }`}
              >
                {remoteNotice.message}
              </div>
            )}
          </form>

          <CodeTerminalBox
            title={
              lang === 'ar'
                ? `سكربت الباقة مع الإغلاق بالثانية (${activeProfile.name})`
                : `Second-Accurate Auto-Expiry Profile Script (${activeProfile.name})`
            }
            code={profileScript}
            filename={`Profile_${activeProfile.name}_${activeRouter.osVersion}.rsc`}
            lang={lang}
            mode={mode}
            activeRouter={activeRouter}
            tenantUuid={tenantUuid}
            onSaveToVault={onSaveToVault}
          />
        </div>
      )}

      {tab === 'print' && (
        <VoucherPrintStudio
          lang={lang}
          vouchers={vouchers}
          hotspotDns="login.mikrocore.net"
          defaultNetworkName={portalNetworkName}
          defaultSupportPhone={portalSupportPhone}
        />
      )}
    </div>
  );
};
