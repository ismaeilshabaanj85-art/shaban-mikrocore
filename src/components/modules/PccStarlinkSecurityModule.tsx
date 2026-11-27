import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Gamepad2,
  Network,
  Plus,
  RotateCcw,
  Satellite,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  AppMode,
  Language,
  PccConfig,
  RouterOSVersion,
  RouterProfile,
  SecurityShieldConfig,
  StarlinkGamingConfig,
} from '../../types/mikrocore';
import {
  SafeFamilyConfig,
  generateAntiNetcutSecurityShield,
  generateMultiWanPcc,
  generateSafeFamilyRollbackScript,
  generateSafeFamilyShieldScript,
  generateStarlinkGamingOptimizer,
} from '../../engine/networkEngine';
import { generateUUID } from '../../utils/security';
import { CodeTerminalBox } from '../CodeTerminalBox';

interface PccStarlinkSecurityModuleProps {
  lang: Language;
  mode: AppMode;
  activeRouter: RouterProfile;
  onSaveToVault: (name: string, content: string, type: 'rsc' | 'backup') => void;
}

export const PccStarlinkSecurityModule: React.FC<PccStarlinkSecurityModuleProps> = ({
  lang,
  mode,
  activeRouter,
  onSaveToVault,
}) => {
  const [subTab, setSubTab] = useState<'pcc' | 'starlink' | 'shield' | 'safe_family'>('pcc');
  const [osVersion, setOsVersion] = useState<RouterOSVersion>(activeRouter.osVersion);
  const [copiedRollback, setCopiedRollback] = useState(false);

  const [safeFamily, setSafeFamily] = useState<SafeFamilyConfig>({
    osVersion: activeRouter.osVersion,
    lanInterface: 'bridge-LAN',
    dnsPreset: 'combined',
    forceDnsRedirect: true,
    blockDohAndDot: true,
  });

  const [pcc, setPcc] = useState<PccConfig>({
    osVersion: activeRouter.osVersion,
    lanInterface: 'bridge-LAN',
    lanSubnet: '192.168.88.0/24',
    wans: [
      { id: 'wan1', name: 'Starlink-Main', interfaceName: 'ether1', gateway: '192.168.1.1', weight: 2 },
      { id: 'wan2', name: 'Fiber-Backup', interfaceName: 'ether2', gateway: '192.168.2.1', weight: 1 },
    ],
    enableFailover: true,
    pingTarget: '1.1.1.1',
  });

  const [starlink, setStarlink] = useState<StarlinkGamingConfig>({
    osVersion: activeRouter.osVersion,
    wanInterface: 'ether1',
    lanInterface: 'bridge-LAN',
    enableDoh: true,
    dohProvider: 'cloudflare',
    enableMssClamp: true,
    mssValue: 1440,
    enableGamingQos: true,
    totalDownMbps: 220,
    totalUpMbps: 30,
    prioritizeGames: ['pubg', 'freefire', 'voip'],
  });

  const [shield, setShield] = useState<SecurityShieldConfig>({
    osVersion: activeRouter.osVersion,
    lanBridge: 'bridge-LAN',
    dhcpServerName: 'dhcp-LAN',
    wanInterfaceList: 'WAN',
    blockNetcutArp: true,
    closeInsecurePorts: true,
    antiHotspotSharingTtl: true,
    protectWinboxLanOnly: true,
    lanTrustedSubnet: '192.168.88.0/24',
  });

  const addWanLink = () => {
    if (pcc.wans.length >= 4) return;
    const idx = pcc.wans.length + 1;
    setPcc({
      ...pcc,
      wans: [
        ...pcc.wans,
        {
          id: generateUUID(),
          name: `WAN-${idx}`,
          interfaceName: `ether${idx}`,
          gateway: `192.168.${idx}.1`,
          weight: 1,
        },
      ],
    });
  };

  const toggleGame = (game: 'pubg' | 'freefire' | 'cod' | 'voip') => {
    const exists = starlink.prioritizeGames.includes(game);
    setStarlink({
      ...starlink,
      prioritizeGames: exists
        ? starlink.prioritizeGames.filter((g) => g !== game)
        : [...starlink.prioritizeGames, game],
    });
  };

  const pccScript = generateMultiWanPcc({ ...pcc, osVersion });
  const starlinkScript = generateStarlinkGamingOptimizer({ ...starlink, osVersion });
  const shieldScript = generateAntiNetcutSecurityShield({ ...shield, osVersion });
  const safeFamilyScript = generateSafeFamilyShieldScript({ ...safeFamily, osVersion });
  const safeFamilyRollbackScript = generateSafeFamilyRollbackScript(osVersion);

  const copyRollback = async () => {
    try {
      await navigator.clipboard.writeText(safeFamilyRollbackScript);
    } catch {
      // ignore
    }
    setCopiedRollback(true);
    setTimeout(() => setCopiedRollback(false), 1800);
  };

  const downloadRollback = () => {
    const blob = new Blob([safeFamilyRollbackScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SafeFamily_Rollback_${osVersion}.rsc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Network className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'الهندسة ودمج الخطوط والحماية'
                : 'Multi-WAN PCC, Starlink & Security Shield'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'فصل برمجي كامل بين RouterOS v6 و v7 مع تحسين ستارلينك والألعاب وحماية Netcut.'
              : 'Strictly separated RouterOS v6/v7 syntax for PCC Load Balancing, Starlink QoS, and Anti-Netcut.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(['v7', 'v6'] as RouterOSVersion[]).map((ver) => (
            <button
              key={ver}
              type="button"
              onClick={() => setOsVersion(ver)}
              className={`rounded-xl border px-3.5 py-2 text-xs font-bold cursor-pointer ${
                osVersion === ver
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                  : 'border-slate-700 bg-[#0B142B] text-slate-400'
              }`}
            >
              RouterOS {ver.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab('pcc')}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold cursor-pointer ${
            subTab === 'pcc'
              ? 'border-cyan-400 bg-cyan-500/20 text-white'
              : 'border-slate-800 bg-[#0B142B]/80 text-slate-300'
          }`}
        >
          <Network className="h-4 w-4 text-cyan-400" />
          <span>{lang === 'ar' ? 'دمج الخطوط (PCC)' : 'Multi-WAN PCC'}</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('starlink')}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold cursor-pointer ${
            subTab === 'starlink'
              ? 'border-cyan-400 bg-cyan-500/20 text-white'
              : 'border-slate-800 bg-[#0B142B]/80 text-slate-300'
          }`}
        >
          <Satellite className="h-4 w-4 text-emerald-400" />
          <span>{lang === 'ar' ? 'محسّن ستارلينك والألعاب' : 'Starlink & Gaming QoS'}</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('shield')}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold cursor-pointer ${
            subTab === 'shield'
              ? 'border-cyan-400 bg-cyan-500/20 text-white'
              : 'border-slate-800 bg-[#0B142B]/80 text-slate-300'
          }`}
        >
          <ShieldAlert className="h-4 w-4 text-amber-400" />
          <span>{lang === 'ar' ? 'درع الحماية و Netcut' : 'Anti-Netcut Shield'}</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('safe_family')}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold cursor-pointer ${
            subTab === 'safe_family'
              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,0.22)]'
              : 'border-emerald-500/30 bg-[#0B142B]/80 text-emerald-200 hover:border-emerald-400/60'
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>
            {lang === 'ar'
              ? 'درع حظر المواقع الإباحية (Safe Family)'
              : 'Safe Family & Anti-Porn Shield'}
          </span>
        </button>
      </div>

      {subTab === 'pcc' && (
        <div className="space-y-5">
          <div className="noc-glass rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs text-slate-300">LAN Bridge</label>
                <input
                  type="text"
                  value={pcc.lanInterface}
                  onChange={(e) => setPcc({ ...pcc, lanInterface: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">LAN Subnet</label>
                <input
                  type="text"
                  value={pcc.lanSubnet}
                  onChange={(e) => setPcc({ ...pcc, lanSubnet: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Failover Ping Check</label>
                <input
                  type="text"
                  value={pcc.pingTarget}
                  onChange={(e) => setPcc({ ...pcc, pingTarget: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300">
                  {lang === 'ar' ? 'خطوط الإنترنت المدمجة (WANs)' : 'WAN Interfaces & Weights'}
                </span>
                {pcc.wans.length < 4 && (
                  <button
                    type="button"
                    onClick={addWanLink}
                    className="flex items-center gap-1 rounded-lg border border-cyan-500/35 bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-200 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{lang === 'ar' ? 'إضافة خط WAN' : 'Add WAN'}</span>
                  </button>
                )}
              </div>

              {pcc.wans.map((w, idx) => (
                <div key={w.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-center rounded-xl border border-slate-800 bg-[#050A18]/70 p-3">
                  <input
                    type="text"
                    value={w.name}
                    onChange={(e) => {
                      const next = [...pcc.wans];
                      next[idx] = { ...w, name: e.target.value };
                      setPcc({ ...pcc, wans: next });
                    }}
                    placeholder="WAN Name"
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={w.interfaceName}
                    onChange={(e) => {
                      const next = [...pcc.wans];
                      next[idx] = { ...w, interfaceName: e.target.value };
                      setPcc({ ...pcc, wans: next });
                    }}
                    dir="ltr"
                    placeholder="ether1"
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-white"
                  />
                  <input
                    type="text"
                    value={w.gateway}
                    onChange={(e) => {
                      const next = [...pcc.wans];
                      next[idx] = { ...w, gateway: e.target.value };
                      setPcc({ ...pcc, wans: next });
                    }}
                    dir="ltr"
                    placeholder="192.168.1.1"
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-white"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      {lang === 'ar' ? 'الوزن:' : 'Weight:'}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={w.weight}
                      onChange={(e) => {
                        const next = [...pcc.wans];
                        next[idx] = { ...w, weight: Number(e.target.value) || 1 };
                        setPcc({ ...pcc, wans: next });
                      }}
                      className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-cyan-300 tabular-nums"
                    />
                  </div>
                  <div className="flex justify-end">
                    {pcc.wans.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPcc({ ...pcc, wans: pcc.wans.filter((item) => item.id !== w.id) })
                        }
                        className="rounded-lg border border-rose-500/30 p-1.5 text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <CodeTerminalBox
            title={
              lang === 'ar'
                ? `سكربت دمج الخطوط PCC (${osVersion.toUpperCase()})`
                : `Multi-WAN PCC Load Balancing (${osVersion.toUpperCase()})`
            }
            code={pccScript}
            filename={`PCC_LoadBalance_${osVersion}.rsc`}
            lang={lang}
            mode={mode}
            activeRouter={{ ...activeRouter, osVersion }}
            onSaveToVault={onSaveToVault}
          />
        </div>
      )}

      {subTab === 'starlink' && (
        <div className="space-y-5">
          <div className="noc-glass rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="mb-1 block text-xs text-slate-300">Starlink WAN Interface</label>
                <input
                  type="text"
                  value={starlink.wanInterface}
                  onChange={(e) => setStarlink({ ...starlink, wanInterface: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">LAN Interface</label>
                <input
                  type="text"
                  value={starlink.lanInterface}
                  onChange={(e) => setStarlink({ ...starlink, lanInterface: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Down Bandwidth (Mbps)</label>
                <input
                  type="number"
                  value={starlink.totalDownMbps}
                  onChange={(e) => setStarlink({ ...starlink, totalDownMbps: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Up Bandwidth (Mbps)</label>
                <input
                  type="number"
                  value={starlink.totalUpMbps}
                  onChange={(e) => setStarlink({ ...starlink, totalUpMbps: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={starlink.enableMssClamp}
                  onChange={(e) => setStarlink({ ...starlink, enableMssClamp: e.target.checked })}
                  className="accent-cyan-400"
                />
                <span>TCP MSS Clamping ({starlink.mssValue})</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={starlink.enableDoh}
                  onChange={(e) => setStarlink({ ...starlink, enableDoh: e.target.checked })}
                  className="accent-cyan-400"
                />
                <span>DNS over HTTPS (DoH)</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={starlink.enableGamingQos}
                  onChange={(e) => setStarlink({ ...starlink, enableGamingQos: e.target.checked })}
                  className="accent-cyan-400"
                />
                <span>
                  {osVersion === 'v7' ? 'CAKE Anti-Bufferbloat QoS' : 'PCQ Gaming Priority Queue'}
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-emerald-400" />
              {(['pubg', 'freefire', 'cod', 'voip'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGame(g)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase cursor-pointer ${
                    starlink.prioritizeGames.includes(g)
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                      : 'border-slate-700 bg-[#050A18]/60 text-slate-400'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <CodeTerminalBox
            title={
              lang === 'ar'
                ? `سكربت تحسين ستارلينك والألعاب (${osVersion.toUpperCase()})`
                : `Starlink & Gaming QoS Optimizer (${osVersion.toUpperCase()})`
            }
            code={starlinkScript}
            filename={`Starlink_Gaming_${osVersion}.rsc`}
            lang={lang}
            mode={mode}
            activeRouter={{ ...activeRouter, osVersion }}
            onSaveToVault={onSaveToVault}
          />
        </div>
      )}

      {subTab === 'shield' && (
        <div className="space-y-5">
          <div className="noc-glass rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs text-slate-300">LAN Bridge</label>
                <input
                  type="text"
                  value={shield.lanBridge}
                  onChange={(e) => setShield({ ...shield, lanBridge: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">DHCP Server Name</label>
                <input
                  type="text"
                  value={shield.dhcpServerName}
                  onChange={(e) => setShield({ ...shield, dhcpServerName: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Trusted LAN Subnet</label>
                <input
                  type="text"
                  value={shield.lanTrustedSubnet}
                  onChange={(e) => setShield({ ...shield, lanTrustedSubnet: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shield.blockNetcutArp}
                  onChange={(e) => setShield({ ...shield, blockNetcutArp: e.target.checked })}
                  className="accent-cyan-400"
                />
                <span>
                  {lang === 'ar'
                    ? 'منع Netcut وانتحال ARP (reply-only + bridge filter)'
                    : 'Block Netcut & ARP Spoofing (reply-only + bridge filter)'}
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shield.closeInsecurePorts}
                  onChange={(e) => setShield({ ...shield, closeInsecurePorts: e.target.checked })}
                  className="accent-cyan-400"
                />
                <span>
                  {lang === 'ar'
                    ? 'إغلاق المنافذ غير الآمنة وحماية WAN'
                    : 'Close Telnet/FTP/WWW & Harden WAN Input'}
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shield.antiHotspotSharingTtl}
                  onChange={(e) =>
                    setShield({ ...shield, antiHotspotSharingTtl: e.target.checked })
                  }
                  className="accent-cyan-400"
                />
                <span>
                  {lang === 'ar'
                    ? 'منع بث ومشاركة الهوتسبوت (change-ttl=1)'
                    : 'Prevent Hotspot Tethering/Sharing (change-ttl=1)'}
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shield.protectWinboxLanOnly}
                  onChange={(e) =>
                    setShield({ ...shield, protectWinboxLanOnly: e.target.checked })
                  }
                  className="accent-cyan-400"
                />
                <span>
                  {lang === 'ar'
                    ? 'قصر Winbox على الشبكة المحلية وإيقاف MAC Server'
                    : 'Restrict Winbox to Trusted LAN & Disable MAC Discovery'}
                </span>
              </label>
            </div>
          </div>

          <CodeTerminalBox
            title={
              lang === 'ar'
                ? `درع الحماية ومكافحة Netcut (${osVersion.toUpperCase()})`
                : `Anti-Netcut & Cyber Security Shield (${osVersion.toUpperCase()})`
            }
            code={shieldScript}
            filename={`Security_Shield_${osVersion}.rsc`}
            lang={lang}
            mode={mode}
            activeRouter={{ ...activeRouter, osVersion }}
            onSaveToVault={onSaveToVault}
          />
        </div>
      )}

      {subTab === 'safe_family' && (
        <div className="space-y-5">
          <div className="noc-glass rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {lang === 'ar'
                      ? 'درع حظر المواقع الإباحية والمحتوى الضار (Safe Family & Anti-Porn Shield)'
                      : 'Safe Family & Anti-Porn DNS/Firewall Shield'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {lang === 'ar'
                      ? 'فرض CleanBrowsing Family و Cloudflare Family عبر dstnat 53 ومنع DoH/DoT لمنع التجاوز من الهواتف.'
                      : 'Enforces CleanBrowsing & Cloudflare Family DNS with port 53 dstnat redirect and DoH/DoT blocking.'}
                  </p>
                </div>
              </div>
              <span className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-300">
                185.228.168.168 · 1.1.1.3
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  {lang === 'ar' ? 'منفذ أو جسر المشتركين (LAN Interface)' : 'LAN Bridge / Interface'}
                </label>
                <input
                  type="text"
                  value={safeFamily.lanInterface}
                  onChange={(e) =>
                    setSafeFamily({ ...safeFamily, lanInterface: e.target.value })
                  }
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  {lang === 'ar' ? 'خوادم DNS العائلية الآمنة' : 'Safe Family DNS Preset'}
                </label>
                <select
                  value={safeFamily.dnsPreset}
                  onChange={(e) =>
                    setSafeFamily({
                      ...safeFamily,
                      dnsPreset: e.target.value as SafeFamilyConfig['dnsPreset'],
                    })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 text-xs text-white"
                >
                  <option value="combined">
                    CleanBrowsing (185.228.168.168) + Cloudflare Family (1.1.1.3)
                  </option>
                  <option value="cleanbrowsing">
                    CleanBrowsing Family Only (185.228.168.168 / .169.168)
                  </option>
                  <option value="cloudflare_family">
                    Cloudflare Family Only (1.1.1.3 / 1.0.0.3)
                  </option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={safeFamily.forceDnsRedirect}
                  onChange={(e) =>
                    setSafeFamily({ ...safeFamily, forceDnsRedirect: e.target.checked })
                  }
                  className="accent-emerald-400"
                />
                <span>
                  {lang === 'ar'
                    ? 'إجبار جميع المشتركين عبر Firewall NAT (dstnat بورت 53 TCP/UDP)'
                    : 'Force All DNS via Firewall NAT Redirect (dstnat Port 53 TCP/UDP)'}
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={safeFamily.blockDohAndDot}
                  onChange={(e) =>
                    setSafeFamily({ ...safeFamily, blockDohAndDot: e.target.checked })
                  }
                  className="accent-emerald-400"
                />
                <span>
                  {lang === 'ar'
                    ? 'حظر DoH و Private DNS (بورت 853) لمنع التجاوز من إعدادات الهاتف'
                    : 'Block DoH & Private DNS (DoT 853) to Prevent Phone Bypass'}
                </span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-7">
              <CodeTerminalBox
                title={
                  lang === 'ar'
                    ? `كود تفعيل درع حظر الإباحية (${osVersion.toUpperCase()})`
                    : `Safe Family Activation Script (${osVersion.toUpperCase()})`
                }
                code={safeFamilyScript}
                filename={`SafeFamily_Shield_${osVersion}.rsc`}
                lang={lang}
                mode={mode}
                activeRouter={{ ...activeRouter, osVersion }}
                onSaveToVault={onSaveToVault}
              />
            </div>

            {/* Dedicated Red/Orange Rollback / Undo Script Panel */}
            <div className="xl:col-span-5 rounded-2xl border border-rose-500/45 bg-gradient-to-b from-rose-950/35 via-[#180C14]/85 to-[#0B142B]/90 overflow-hidden shadow-[0_0_25px_rgba(244,63,94,0.14)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/35 bg-rose-950/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-amber-400" />
                  <div>
                    <h4 className="text-xs font-extrabold text-rose-200">
                      {lang === 'ar'
                        ? 'كود التراجع وإلغاء الحظر (Rollback / Undo Script)'
                        : 'Rollback / Undo Script (Remove Safe Family)'}
                    </h4>
                    <p className="text-[10px] text-amber-300/90">
                      {lang === 'ar'
                        ? 'يزيل قواعد الحظر ويعيد DNS للوضع الطبيعي دون أي أخطاء'
                        : 'Cleanly removes filter rules and restores standard DNS'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={copyRollback}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-gradient-to-r from-rose-500 to-amber-500 px-3 py-1.5 text-[11px] font-extrabold text-slate-950 hover:brightness-110 cursor-pointer"
                  >
                    {copiedRollback ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {copiedRollback
                        ? lang === 'ar'
                          ? 'تم النسخ!'
                          : 'Copied!'
                        : lang === 'ar'
                        ? 'نسخ كود التراجع'
                        : 'Copy Rollback'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={downloadRollback}
                    aria-label="Download Rollback Script"
                    className="rounded-lg border border-rose-500/40 bg-rose-500/15 p-1.5 text-rose-200 hover:bg-rose-500/25 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <pre
                dir="ltr"
                className="max-h-96 overflow-auto bg-[#09040A]/90 p-4 font-mono text-[11px] leading-relaxed text-amber-100"
              >
                <code>{safeFamilyRollbackScript}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
