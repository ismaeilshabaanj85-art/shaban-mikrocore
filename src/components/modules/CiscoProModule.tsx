import React, { useState } from 'react';
import { Cpu, Globe, Plus, Shield, Trash2 } from 'lucide-react';
import { AppMode, CiscoConfig, Language, RouterProfile } from '../../types/mikrocore';
import { generateCiscoIosCli } from '../../engine/networkEngine';
import { CodeTerminalBox } from '../CodeTerminalBox';

interface CiscoProModuleProps {
  lang: Language;
  mode: AppMode;
  activeRouter: RouterProfile;
  onSaveToVault: (name: string, content: string, type: 'rsc' | 'backup') => void;
}

export const CiscoProModule: React.FC<CiscoProModuleProps> = ({
  lang,
  mode,
  activeRouter,
  onSaveToVault,
}) => {
  const [config, setConfig] = useState<CiscoConfig>({
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
    routingMode: 'ospf',
    defaultNextHop: '192.168.1.1',
    ospfProcessId: 1,
    ospfRouterId: '10.10.10.1',
    ospfNetworks: '10.10.10.0 0.0.0.255 area 0\n10.10.20.0 0.0.0.255 area 0',
    enableNatOverload: false,
    natInsideIf: 'GigabitEthernet0/1',
    natOutsideIf: 'GigabitEthernet0/0',
    natAclSubnet: '10.10.0.0 0.0.255.255',
    enableRestconf: true,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Cpu className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'قسم سيسكو الشامل (Cisco IOS & Switches Pro)'
                : 'Cisco IOS & Switches Pro'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'توليد أوامر Cisco IOS دقيقة للـ VLANs، Trunk، Port Security، OSPF/Static، NAT، و RESTCONF.'
              : 'Precision Cisco IOS CLI generator for VLANs, 802.1Q Trunk, Port Security, OSPF, NAT Overload, and RESTCONF.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
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
      </div>

      {/* Base & SSH Setup */}
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

        {/* VLANs Section */}
        <div className="border-t border-slate-800/80 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-cyan-300">
              {lang === 'ar' ? 'شبكات VLANs و SVI' : 'VLAN Database & L3 SVI'}
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
                  placeholder="IP + Mask (for L3)"
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

        {/* Switch Ports & Port Security */}
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

            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-4 pt-1">
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

              {config.enablePortSecurity && (
                <>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Max MAC:</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={config.portSecMaxMac}
                      onChange={(e) =>
                        setConfig({ ...config, portSecMaxMac: Number(e.target.value) })
                      }
                      className="w-16 rounded-lg border border-slate-700 bg-[#050A18] px-2 py-1 font-mono text-xs text-white"
                    />
                  </div>
                  <select
                    value={config.portSecViolation}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        portSecViolation: e.target.value as CiscoConfig['portSecViolation'],
                      })
                    }
                    className="rounded-lg border border-slate-700 bg-[#050A18] px-2.5 py-1 text-xs text-white"
                  >
                    <option value="restrict">Violation: restrict</option>
                    <option value="shutdown">Violation: shutdown</option>
                    <option value="protect">Violation: protect</option>
                  </select>
                </>
              )}
            </div>
          </div>
        )}

        {/* Routing & RESTCONF */}
        <div className="border-t border-slate-800/80 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {config.deviceType !== 'switch_l2' && (
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'التوجيه (Routing)' : 'Routing Protocol'}
              </label>
              <select
                value={config.routingMode}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    routingMode: e.target.value as CiscoConfig['routingMode'],
                  })
                }
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 text-xs text-white"
              >
                <option value="ospf">OSPF Dynamic Routing</option>
                <option value="static">Static Default Route</option>
                <option value="none">None</option>
              </select>
            </div>
          )}

          {config.deviceType !== 'switch_l2' && config.routingMode === 'ospf' && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] text-slate-400">
                OSPF Networks (one per line)
              </label>
              <textarea
                rows={2}
                value={config.ospfNetworks}
                onChange={(e) => setConfig({ ...config, ospfNetworks: e.target.value })}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
          )}

          {config.deviceType === 'router' && (
            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableNatOverload}
                onChange={(e) => setConfig({ ...config, enableNatOverload: e.target.checked })}
                className="accent-cyan-400"
              />
              <span>Enable NAT Overload (PAT)</span>
            </label>
          )}
        </div>

        {/* RESTCONF Connector */}
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

      {/* Live Cisco IOS CLI Output */}
      <CodeTerminalBox
        title={
          lang === 'ar'
            ? `مخرجات Cisco IOS CLI (${config.hostname})`
            : `Cisco IOS CLI Configuration (${config.hostname})`
        }
        code={ciscoCli}
        filename={`${config.hostname}_ios.cfg`}
        lang={lang}
        mode={mode}
        activeRouter={activeRouter}
        syntax="cisco"
        onSaveToVault={onSaveToVault}
        showRestApply={false}
      />
    </div>
  );
};
