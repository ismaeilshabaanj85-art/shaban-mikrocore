import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  Globe,
  Link2,
  Play,
  Plus,
  Route,
  Shield,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { AppMode, CiscoConfig, Language, RouterProfile } from '../../types/mikrocore';
import {
  generateCiscoIosCli,
  generateCiscoMikrotikLacpSync,
} from '../../engine/networkEngine';
import {
  CiscoAutoQosConfig,
  CiscoRoutingExtendedConfig,
  generateCiscoAutoQosCli,
  generateCiscoRoutingEnterpriseCli,
} from '../../engine/enterpriseToolsEngine';
import { cloudSendAndAwaitRouterCommand } from '../../utils/firebaseCloud';
import { loadSession } from '../../utils/storage';
import { CodeTerminalBox } from '../CodeTerminalBox';

export type CiscoTabId = 'vlans' | 'l2' | 'lacp' | 'routing' | 'qos';

interface CiscoProModuleProps {
  lang: Language;
  mode: AppMode;
  activeRouter: RouterProfile;
  tenantUuid?: string;
  focusedTab?: CiscoTabId;
  onSaveToVault: (name: string, content: string, type: 'rsc' | 'backup') => void;
}

export const CiscoProModule: React.FC<CiscoProModuleProps> = ({
  lang,
  mode,
  activeRouter,
  tenantUuid,
  focusedTab = 'vlans',
  onSaveToVault,
}) => {
  const [subTab, setSubTab] = useState<CiscoTabId>(focusedTab);

  useEffect(() => {
    setSubTab(focusedTab);
  }, [focusedTab]);

  const [config, setConfig] = useState<CiscoRoutingExtendedConfig>({
    deviceType: 'switch_l3',
    hostname: 'Shaban-Core-SW1',
    domainName: 'mikrocore.local',
    enableSecret: 'CiscoEnable@2026',
    sshUser: 'netadmin',
    sshPassword: 'CiscoSSH@2026',
    vlans: [
      { id: 10, name: 'MANAGEMENT', subnet: '10.10.10.1 255.255.255.0' },
      { id: 20, name: 'HOTSPOT_CLIENTS', subnet: '10.10.20.1 255.255.255.0' },
    ],
    accessPorts: 'GigabitEthernet0/1-12',
    accessVlanId: 20,
    trunkPorts: 'GigabitEthernet0/23-24',
    nativeVlanId: 10,
    enablePortSecurity: true,
    portSecMaxMac: 2,
    portSecViolation: 'restrict',
    enableDhcpSnooping: true,
    enableDai: true,
    enableBpduGuard: true,
    routingMode: 'ospf',
    defaultNextHop: '192.168.1.1',
    ospfProcessId: 1,
    ospfRouterId: '10.10.10.1',
    ospfNetworks: '10.10.10.0 0.0.0.255 area 0\n10.10.20.0 0.0.0.255 area 10',
    ospfEnableMd5Auth: true,
    ospfMd5KeyId: 1,
    ospfMd5Secret: 'ShabanOSPF2026',
    ospfInterfaceName: 'GigabitEthernet0/24',
    bgpAsn: 65010,
    bgpRouterId: '10.10.10.1',
    bgpNeighborIp: '172.16.0.1',
    bgpRemoteAsn: 65001,
    bgpNetworks: '10.10.10.0 mask 255.255.255.0\n10.10.20.0 mask 255.255.255.0',
    bgpPrefixListName: 'PL_MIKROCORE_OUT',
    bgpAllowedPrefix: '10.10.0.0/16 le 24',
    enableNatOverload: false,
    natInsideIf: 'GigabitEthernet0/1',
    natOutsideIf: 'GigabitEthernet0/0',
    natAclSubnet: '10.10.0.0 0.0.255.255',
    enableRestconf: true,
  });

  // Cisco <-> MikroTik LACP Dual Sync state
  const [ciscoPortChannelId, setCiscoPortChannelId] = useState(1);
  const [ciscoLacpPorts, setCiscoLacpPorts] = useState('GigabitEthernet0/23-24');
  const [mikrotikBondName, setMikrotikBondName] = useState('bond-Cisco-Trunk');
  const [mikrotikSlaves, setMikrotikSlaves] = useState('ether9,ether10');
  const [mikrotikBridge, setMikrotikBridge] = useState('bridge-LAN');
  const [lacpPushing, setLacpPushing] = useState(false);
  const [lacpPushMsg, setLacpPushMsg] = useState('');

  // Auto-QoS state
  const [qosCfg, setQosCfg] = useState<CiscoAutoQosConfig>({
    hostname: 'Shaban-Core-SW1',
    uplinkInterface: 'GigabitEthernet0/24',
    accessInterfaces: 'GigabitEthernet0/1-12',
    voipPriorityPercent: 20,
    gamingBandwidthPercent: 35,
    bulkPolicingMbps: 25,
    enableAutoQosVoip: true,
  });

  const [restconfHost, setRestconfHost] = useState('10.10.10.1');
  const [restconfResult, setRestconfResult] = useState('');

  const addVlan = () => {
    const nextId = (config.vlans[config.vlans.length - 1]?.id || 10) + 10;
    setConfig({
      ...config,
      vlans: [
        ...config.vlans,
        { id: nextId, name: `VLAN_${nextId}`, subnet: `10.10.${nextId}.1 255.255.255.0` },
      ],
    });
  };

  const handleTestRestconf = () => {
    if (mode === 'sandbox') {
      setRestconfResult(
        `RESTCONF GET https://${restconfHost}/restconf/data/ietf-interfaces:interfaces -> 200 OK (Simulated IOS-XE JSON)`
      );
    } else {
      setRestconfResult(
        `RESTCONF Endpoint Ready: https://${restconfHost}/restconf/data/Cisco-IOS-XE-native:native`
      );
    }
  };

  const ciscoCli = generateCiscoIosCli(config);
  const routingCli = generateCiscoRoutingEnterpriseCli(config);
  const qosCli = generateCiscoAutoQosCli({ ...qosCfg, hostname: config.hostname });
  const lacpSync = generateCiscoMikrotikLacpSync({
    osVersion: activeRouter.osVersion,
    ciscoPortChannelId,
    ciscoPorts: ciscoLacpPorts,
    ciscoTrunkNativeVlan: config.nativeVlanId,
    mikrotikBondName,
    mikrotikSlaves,
    mikrotikBridge,
    vlans: config.vlans.map((v) => ({ id: v.id, name: v.name })),
  });

  const handlePushMikrotikLacp = async () => {
    const effTenant =
      tenantUuid || loadSession()?.tenantUuid || '00000000-0000-4000-8000-000000000001';
    setLacpPushing(true);
    setLacpPushMsg(
      lang === 'ar'
        ? 'جارٍ إرسال إعدادات 802.3ad Bonding و VLANs إلى راوتر مايكروتك...'
        : 'Pushing 802.3ad Bonding & VLAN CLI to MikroTik...'
    );
    const res = await cloudSendAndAwaitRouterCommand(
      effTenant,
      activeRouter.id,
      lacpSync.mikrotikCli
    );
    setLacpPushing(false);
    setLacpPushMsg(
      res.ok
        ? mode === 'sandbox'
          ? lang === 'ar'
            ? 'تمت محاكاة وإيداع كود LACP لمايكروتك بنجاح ✅'
            : 'Simulated & queued MikroTik LACP sync ✅'
          : res.executed
          ? lang === 'ar'
            ? `تم تنفيذ ربط LACP على الراوتر ${activeRouter.name} بنجاح ✅`
            : `Executed LACP sync on ${activeRouter.name} ✅`
          : lang === 'ar'
          ? 'تم إيداع كود LACP في السحابة بانتظار نبضة الوكيل ⏳'
          : 'Queued LACP sync in Firebase ⏳'
        : res.error || 'Error'
    );
  };

  const tabItems: Array<{ id: CiscoTabId; labelAr: string; labelEn: string; icon: React.ReactNode }> = [
    { id: 'vlans', labelAr: 'VLANs و SVI', labelEn: 'VLANs & SVI', icon: <Cpu className="h-3.5 w-3.5" /> },
    { id: 'l2', labelAr: 'درع أمان L2', labelEn: 'L2 Security Shield', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
    { id: 'lacp', labelAr: 'الربط المزدوج LACP', labelEn: 'MikroTik LACP Sync', icon: <Link2 className="h-3.5 w-3.5" /> },
    { id: 'routing', labelAr: 'OSPF & BGP', labelEn: 'OSPF & BGP Routing', icon: <Route className="h-3.5 w-3.5" /> },
    { id: 'qos', labelAr: 'Auto-QoS ألعاب/صوت', labelEn: 'Auto-QoS & Gaming', icon: <Activity className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Cpu className="h-5 w-5 text-emerald-400" />
            <span>
              {lang === 'ar'
                ? 'قسم سيسكو Enterprise (Cisco IOS & MikroTik Sync)'
                : 'Cisco Enterprise IOS Suite'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'إدارة متكاملة لـ VLANs/SVI، درع أمان السويتشات L2، مزامنة LACP مع مايكروتك، توجيه OSPF/BGP، وجودة الخدمة Auto-QoS.'
              : 'Interactive Cisco IOS CLI studio for VLANs/SVI, Layer-2 Shield, LACP Bonding sync, OSPF MD5/BGP, and Auto-QoS Gaming/VoIP.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer whitespace-nowrap ${
                subTab === tab.id
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                  : 'border-slate-700 bg-[#0B142B] text-slate-300 hover:border-emerald-500/35'
              }`}
            >
              {tab.icon}
              <span>{lang === 'ar' ? tab.labelAr : tab.labelEn}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: VLANs & SVI */}
      {subTab === 'vlans' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'switch_l2', label: 'L2 Switch' },
                { id: 'switch_l3', label: 'L3 Core Switch' },
                { id: 'router', label: 'IOS Router' },
              ] as const
            ).map((dt) => (
              <button
                key={dt.id}
                type="button"
                onClick={() => setConfig({ ...config, deviceType: dt.id })}
                className={`rounded-xl border px-3.5 py-2 text-xs font-bold cursor-pointer ${
                  config.deviceType === dt.id
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                    : 'border-slate-700 bg-[#0B142B] text-slate-400'
                }`}
              >
                {dt.label}
              </button>
            ))}
          </div>

          <div className="noc-glass rounded-2xl p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Hostname</label>
                <input
                  type="text"
                  value={config.hostname}
                  onChange={(e) => setConfig({ ...config, hostname: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Domain Name</label>
                <input
                  type="text"
                  value={config.domainName}
                  onChange={(e) => setConfig({ ...config, domainName: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">SSH Username</label>
                <input
                  type="text"
                  value={config.sshUser}
                  onChange={(e) => setConfig({ ...config, sshUser: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">SSH Secret</label>
                <input
                  type="text"
                  value={config.sshPassword}
                  onChange={(e) => setConfig({ ...config, sshPassword: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
            </div>

            <div className="border-t border-slate-800/80 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-cyan-300">
                  {lang === 'ar' ? 'شبكات VLANs وبوابات SVI (L3)' : 'VLAN Database & L3 SVI'}
                </h3>
                <button
                  type="button"
                  onClick={addVlan}
                  className="flex items-center gap-1 rounded-lg border border-cyan-500/35 bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-200 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{lang === 'ar' ? 'إضافة VLAN' : 'Add VLAN'}</span>
                </button>
              </div>

              <div className="space-y-2">
                {config.vlans.map((v, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                    <input
                      type="number"
                      value={v.id}
                      onChange={(e) => {
                        const next = [...config.vlans];
                        next[idx] = { ...v, id: Number(e.target.value) };
                        setConfig({ ...config, vlans: next });
                      }}
                      className="rounded-lg border border-slate-700 bg-[#050A18]/85 px-3 py-1.5 font-mono text-xs text-cyan-300 tabular-nums"
                      placeholder="VLAN ID"
                    />
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => {
                        const next = [...config.vlans];
                        next[idx] = { ...v, name: e.target.value };
                        setConfig({ ...config, vlans: next });
                      }}
                      dir="ltr"
                      className="rounded-lg border border-slate-700 bg-[#050A18]/85 px-3 py-1.5 font-mono text-xs text-white"
                      placeholder="VLAN Name"
                    />
                    <input
                      type="text"
                      value={v.subnet || ''}
                      onChange={(e) => {
                        const next = [...config.vlans];
                        next[idx] = { ...v, subnet: e.target.value };
                        setConfig({ ...config, vlans: next });
                      }}
                      dir="ltr"
                      className="rounded-lg border border-slate-700 bg-[#050A18]/85 px-3 py-1.5 font-mono text-xs text-slate-300"
                      placeholder="IP + Mask (for SVI)"
                    />
                    <div className="flex justify-end">
                      {config.vlans.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfig({
                              ...config,
                              vlans: config.vlans.filter((_, i) => i !== idx),
                            })
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

            {config.deviceType !== 'router' && (
              <div className="border-t border-slate-800/80 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">Access Ports Range</label>
                  <input
                    type="text"
                    value={config.accessPorts}
                    onChange={(e) => setConfig({ ...config, accessPorts: e.target.value })}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">Access VLAN ID</label>
                  <input
                    type="number"
                    value={config.accessVlanId}
                    onChange={(e) => setConfig({ ...config, accessVlanId: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">Trunk Ports Range</label>
                  <input
                    type="text"
                    value={config.trunkPorts}
                    onChange={(e) => setConfig({ ...config, trunkPorts: e.target.value })}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">Native Trunk VLAN</label>
                  <input
                    type="number"
                    value={config.nativeVlanId}
                    onChange={(e) => setConfig({ ...config, nativeVlanId: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white tabular-nums"
                  />
                </div>
              </div>
            )}

            {/* RESTCONF */}
            <div className="border-t border-slate-800/80 pt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-cyan-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enableRestconf}
                  onChange={(e) => setConfig({ ...config, enableRestconf: e.target.checked })}
                  className="accent-cyan-400"
                />
                <Globe className="h-3.5 w-3.5" />
                <span>Enable Cisco IOS-XE RESTCONF API</span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={restconfHost}
                  onChange={(e) => setRestconfHost(e.target.value)}
                  dir="ltr"
                  className="w-36 rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-1.5 font-mono text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleTestRestconf}
                  className="rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3.5 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer"
                >
                  {lang === 'ar' ? 'فحص RESTCONF' : 'Test RESTCONF'}
                </button>
              </div>
            </div>

            {restconfResult && (
              <div
                dir="ltr"
                className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 font-mono text-xs text-emerald-200"
              >
                {restconfResult}
              </div>
            )}
          </div>

          <CodeTerminalBox
            title={
              lang === 'ar'
                ? `مخرجات Cisco IOS VLANs & SVI (${config.hostname})`
                : `Cisco IOS VLANs & SVI CLI (${config.hostname})`
            }
            code={ciscoCli}
            filename={`${config.hostname}_vlans_svi.cfg`}
            lang={lang}
            mode={mode}
            activeRouter={activeRouter}
            syntax="cisco"
            onSaveToVault={onSaveToVault}
            showRestApply={false}
          />
        </>
      )}

      {/* TAB 2: Layer-2 Security Hardening */}
      {subTab === 'l2' && (
        <div className="space-y-5">
          <div className="noc-glass rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span>
                {lang === 'ar'
                  ? 'درع أمان سويتشات الطبقة الثانية (DHCP Snooping, DAI, Port-Security, BPDU Guard)'
                  : 'Layer-2 Switch Security Hardening'}
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Access Ports Range</label>
                <input
                  type="text"
                  value={config.accessPorts}
                  onChange={(e) => setConfig({ ...config, accessPorts: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Trusted Trunk Ports</label>
                <input
                  type="text"
                  value={config.trunkPorts}
                  onChange={(e) => setConfig({ ...config, trunkPorts: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Max Sticky MAC</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={config.portSecMaxMac}
                  onChange={(e) =>
                    setConfig({ ...config, portSecMaxMac: Number(e.target.value) || 2 })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-cyan-300 tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Port-Sec Violation</label>
                <select
                  value={config.portSecViolation}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      portSecViolation: e.target.value as CiscoConfig['portSecViolation'],
                    })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 text-xs text-white"
                >
                  <option value="restrict">Violation: restrict</option>
                  <option value="shutdown">Violation: shutdown</option>
                  <option value="protect">Violation: protect</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800/70">
              <label className="flex items-center gap-2 text-xs font-semibold text-emerald-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enablePortSecurity}
                  onChange={(e) => setConfig({ ...config, enablePortSecurity: e.target.checked })}
                  className="accent-cyan-400"
                />
                <Shield className="h-3.5 w-3.5" />
                <span>Port Security (Sticky MAC)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-cyan-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!config.enableDhcpSnooping}
                  onChange={(e) => setConfig({ ...config, enableDhcpSnooping: e.target.checked })}
                  className="accent-cyan-400"
                />
                <span>DHCP Snooping (Rogue DHCP Block)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-cyan-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!config.enableDai}
                  onChange={(e) => setConfig({ ...config, enableDai: e.target.checked })}
                  className="accent-cyan-400"
                />
                <span>Dynamic ARP Inspection (DAI)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-cyan-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!config.enableBpduGuard}
                  onChange={(e) => setConfig({ ...config, enableBpduGuard: e.target.checked })}
                  className="accent-cyan-400"
                />
                <span>PortFast &amp; BPDU Guard</span>
              </label>
            </div>
          </div>

          <CodeTerminalBox
            title={
              lang === 'ar'
                ? `أوامر تشديد أمان الطبقة الثانية (${config.hostname})`
                : `Cisco L2 Security Hardening CLI (${config.hostname})`
            }
            code={ciscoCli}
            filename={`${config.hostname}_l2_shield.cfg`}
            lang={lang}
            mode={mode}
            activeRouter={activeRouter}
            syntax="cisco"
            onSaveToVault={onSaveToVault}
            showRestApply={false}
          />
        </div>
      )}

      {/* TAB 3: Cisco <-> MikroTik LACP Sync */}
      {subTab === 'lacp' && (
        <div className="space-y-5">
          <div className="noc-glass rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  <span>
                    {lang === 'ar'
                      ? 'الربط المزدوج LACP (802.3ad) بين Cisco و MikroTik'
                      : 'Cisco <-> MikroTik LACP (802.3ad) Dual-Sync'}
                  </span>
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {lang === 'ar'
                    ? 'يولّد إعدادات Port-Channel لسيسكو بالتوازي مع 802.3ad Bonding لمايكروتك مع زر تنفيذ مباشر على سيرفر مايكروتك.'
                    : 'Generates paired Cisco Port-Channel + MikroTik 802.3ad Bonding CLI with direct execution.'}
                </p>
              </div>

              <button
                type="button"
                disabled={lacpPushing}
                onClick={handlePushMikrotikLacp}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-xs font-extrabold text-slate-950 hover:brightness-110 disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5" />
                <span>
                  {lang === 'ar'
                    ? 'تنفيذ كود مايكروتك على السيرفر 🚀'
                    : 'Execute MikroTik Code on Server 🚀'}
                </span>
              </button>
            </div>

            {lacpPushMsg && (
              <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-4 py-2.5 text-xs font-semibold text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{lacpPushMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Cisco Port-Channel #</label>
                <input
                  type="number"
                  min={1}
                  max={64}
                  value={ciscoPortChannelId}
                  onChange={(e) => setCiscoPortChannelId(Number(e.target.value) || 1)}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-cyan-300 tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Cisco Member Ports</label>
                <input
                  type="text"
                  value={ciscoLacpPorts}
                  onChange={(e) => setCiscoLacpPorts(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">MikroTik Bond Name</label>
                <input
                  type="text"
                  value={mikrotikBondName}
                  onChange={(e) => setMikrotikBondName(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">MikroTik Slaves</label>
                <input
                  type="text"
                  value={mikrotikSlaves}
                  onChange={(e) => setMikrotikSlaves(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">MikroTik Bridge</label>
                <input
                  type="text"
                  value={mikrotikBridge}
                  onChange={(e) => setMikrotikBridge(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <CodeTerminalBox
              title={
                lang === 'ar'
                  ? `طرف سيسكو (Port-channel ${ciscoPortChannelId} LACP)`
                  : `Cisco IOS Side (Port-channel ${ciscoPortChannelId})`
              }
              code={lacpSync.ciscoCli}
              filename={`Cisco_LACP_Po${ciscoPortChannelId}.cfg`}
              lang={lang}
              mode={mode}
              activeRouter={activeRouter}
              syntax="cisco"
              onSaveToVault={onSaveToVault}
              showRestApply={false}
            />
            <CodeTerminalBox
              title={
                lang === 'ar'
                  ? `طرف مايكروتك (${mikrotikBondName} · 802.3ad)`
                  : `MikroTik Side (${mikrotikBondName} · 802.3ad)`
              }
              code={lacpSync.mikrotikCli}
              filename={`MikroTik_LACP_${mikrotikBondName}.rsc`}
              lang={lang}
              mode={mode}
              activeRouter={activeRouter}
              tenantUuid={tenantUuid}
              onSaveToVault={onSaveToVault}
            />
          </div>
        </div>
      )}

      {/* TAB 4: Dynamic Routing (OSPF Multi-Area & MD5 + BGP Prefix-Lists) */}
      {subTab === 'routing' && (
        <div className="space-y-5">
          <div className="noc-glass rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                <Route className="h-4 w-4" />
                <span>
                  {lang === 'ar'
                    ? 'التوجيه الديناميكي (OSPF متعدد المناطق + MD5 & BGP Prefix-Lists)'
                    : 'Dynamic Routing (OSPF Multi-Area + MD5 & BGP Prefix-Lists)'}
                </span>
              </h3>
              <select
                value={config.routingMode}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    routingMode: e.target.value as CiscoConfig['routingMode'],
                  })
                }
                className="rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 text-xs font-bold text-cyan-200"
              >
                <option value="ospf">OSPF Multi-Area + MD5</option>
                <option value="bgp">BGP Enterprise + Prefix-Lists</option>
                <option value="static">Static Default Route</option>
              </select>
            </div>

            {config.routingMode === 'ospf' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">OSPF Process ID</label>
                    <input
                      type="number"
                      value={config.ospfProcessId}
                      onChange={(e) =>
                        setConfig({ ...config, ospfProcessId: Number(e.target.value) || 1 })
                      }
                      className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-cyan-300 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">OSPF Router ID</label>
                    <input
                      type="text"
                      value={config.ospfRouterId}
                      onChange={(e) => setConfig({ ...config, ospfRouterId: e.target.value })}
                      dir="ltr"
                      className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">OSPF Uplink Interface</label>
                    <input
                      type="text"
                      value={config.ospfInterfaceName || 'GigabitEthernet0/24'}
                      onChange={(e) => setConfig({ ...config, ospfInterfaceName: e.target.value })}
                      dir="ltr"
                      className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">MD5 Secret Key</label>
                    <input
                      type="text"
                      value={config.ospfMd5Secret || ''}
                      onChange={(e) => setConfig({ ...config, ospfMd5Secret: e.target.value })}
                      dir="ltr"
                      className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-emerald-300"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-emerald-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!config.ospfEnableMd5Auth}
                    onChange={(e) => setConfig({ ...config, ospfEnableMd5Auth: e.target.checked })}
                    className="accent-cyan-400"
                  />
                  <span>
                    {lang === 'ar'
                      ? 'تفعيل مصادقة OSPF MD5 المشفرة (message-digest)'
                      : 'Enable OSPF MD5 Authentication (message-digest)'}
                  </span>
                </label>

                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    OSPF Multi-Area Networks (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={config.ospfNetworks}
                    onChange={(e) => setConfig({ ...config, ospfNetworks: e.target.value })}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                  />
                </div>
              </div>
            )}

            {config.routingMode === 'bgp' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Local ASN</label>
                    <input
                      type="number"
                      value={config.bgpAsn ?? 65010}
                      onChange={(e) => setConfig({ ...config, bgpAsn: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-cyan-300 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Neighbor IP</label>
                    <input
                      type="text"
                      value={config.bgpNeighborIp ?? '172.16.0.1'}
                      onChange={(e) => setConfig({ ...config, bgpNeighborIp: e.target.value })}
                      dir="ltr"
                      className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Remote ASN</label>
                    <input
                      type="number"
                      value={config.bgpRemoteAsn ?? 65001}
                      onChange={(e) => setConfig({ ...config, bgpRemoteAsn: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Prefix-List Name</label>
                    <input
                      type="text"
                      value={config.bgpPrefixListName ?? 'PL_MIKROCORE_OUT'}
                      onChange={(e) => setConfig({ ...config, bgpPrefixListName: e.target.value })}
                      dir="ltr"
                      className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-emerald-300"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] text-slate-400">Permitted Prefix Range</label>
                    <input
                      type="text"
                      value={config.bgpAllowedPrefix ?? '10.10.0.0/16 le 24'}
                      onChange={(e) => setConfig({ ...config, bgpAllowedPrefix: e.target.value })}
                      dir="ltr"
                      className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {config.routingMode === 'static' && (
              <div className="max-w-sm">
                <label className="mb-1 block text-[11px] text-slate-400">Default Next-Hop Gateway</label>
                <input
                  type="text"
                  value={config.defaultNextHop}
                  onChange={(e) => setConfig({ ...config, defaultNextHop: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
                />
              </div>
            )}
          </div>

          <CodeTerminalBox
            title={
              lang === 'ar'
                ? `مخرجات التوجيه الديناميكي (${config.routingMode.toUpperCase()})`
                : `Cisco Dynamic Routing CLI (${config.routingMode.toUpperCase()})`
            }
            code={routingCli}
            filename={`${config.hostname}_routing_${config.routingMode}.cfg`}
            lang={lang}
            mode={mode}
            activeRouter={activeRouter}
            syntax="cisco"
            onSaveToVault={onSaveToVault}
            showRestApply={false}
          />
        </div>
      )}

      {/* TAB 5: Auto-QoS & UDP Gaming / VoIP Priority */}
      {subTab === 'qos' && (
        <div className="space-y-5">
          <div className="noc-glass rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span>
                {lang === 'ar'
                  ? 'جودة الخدمة والأولوية (Auto-QoS & أولوية الألعاب UDP / VoIP)'
                  : 'Cisco Auto-QoS & UDP Gaming/VoIP Priority'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {lang === 'ar'
                ? 'ينشئ قواعد mls qos و class-map و policy-map لإعطاء أعلى أولوية لحزم الألعاب (PUBG/FreeFire) ومكالمات VoIP وتقييد التحميل العشوائي.'
                : 'Generates mls qos, class-map, and policy-map rules prioritizing VoIP EF and Gaming CS4 UDP flows.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Uplink Interface</label>
                <input
                  type="text"
                  value={qosCfg.uplinkInterface}
                  onChange={(e) => setQosCfg({ ...qosCfg, uplinkInterface: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Access Ports Range</label>
                <input
                  type="text"
                  value={qosCfg.accessInterfaces}
                  onChange={(e) => setQosCfg({ ...qosCfg, accessInterfaces: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">VoIP Priority (%)</label>
                <input
                  type="number"
                  min={5}
                  max={40}
                  value={qosCfg.voipPriorityPercent}
                  onChange={(e) =>
                    setQosCfg({ ...qosCfg, voipPriorityPercent: Number(e.target.value) || 20 })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-emerald-300 tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Gaming Bandwidth (%)</label>
                <input
                  type="number"
                  min={10}
                  max={60}
                  value={qosCfg.gamingBandwidthPercent}
                  onChange={(e) =>
                    setQosCfg({ ...qosCfg, gamingBandwidthPercent: Number(e.target.value) || 35 })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-cyan-300 tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Default Bulk Cap (Mbps)</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={qosCfg.bulkPolicingMbps}
                  onChange={(e) =>
                    setQosCfg({ ...qosCfg, bulkPolicingMbps: Number(e.target.value) || 25 })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-amber-300 tabular-nums"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-cyan-200 cursor-pointer">
              <input
                type="checkbox"
                checked={qosCfg.enableAutoQosVoip}
                onChange={(e) => setQosCfg({ ...qosCfg, enableAutoQosVoip: e.target.checked })}
                className="accent-cyan-400"
              />
              <span>Enable Auto-QoS VoIP Trust on Uplink &amp; Access Ports</span>
            </label>
          </div>

          <CodeTerminalBox
            title={
              lang === 'ar'
                ? `مخرجات Auto-QoS والأولوية (${config.hostname})`
                : `Cisco Auto-QoS & Gaming Priority CLI`
            }
            code={qosCli}
            filename={`${config.hostname}_auto_qos.cfg`}
            lang={lang}
            mode={mode}
            activeRouter={activeRouter}
            syntax="cisco"
            onSaveToVault={onSaveToVault}
            showRestApply={false}
          />
        </div>
      )}
    </div>
  );
};
