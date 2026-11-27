import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Cpu,
  FlaskConical,
  Play,
  Rocket,
  RotateCcw,
  Terminal,
} from 'lucide-react';
import {
  Language,
  RouterOSVersion,
  SandboxState,
} from '../../types/mikrocore';
import {
  createInitialSandboxState,
  executeSandboxCommand,
} from '../../engine/sandboxEngine';

interface SandboxSimulatorModuleProps {
  lang: Language;
  sandboxState: SandboxState;
  onUpdateSandboxState: (next: SandboxState) => void;
  pendingScript: string;
  onClearPendingScript: () => void;
  onPromoteToLive: (script: string) => void;
}

interface ConsoleEntry {
  id: string;
  device: 'mikrotik' | 'cisco';
  command: string;
  output: string;
  ok: boolean;
  errorHighlight?: string;
}

export const SandboxSimulatorModule: React.FC<SandboxSimulatorModuleProps> = ({
  lang,
  sandboxState,
  onUpdateSandboxState,
  pendingScript,
  onClearPendingScript,
  onPromoteToLive,
}) => {
  const [device, setDevice] = useState<'mikrotik' | 'cisco'>('mikrotik');
  const [commandInput, setCommandInput] = useState('/interface print');
  const [history, setHistory] = useState<ConsoleEntry[]>([
    {
      id: 'boot',
      device: 'mikrotik',
      command: '/system resource print',
      output:
        'uptime: 18d07:42:15\nversion: 7.16.1 (stable)\nboard-name: RB4011iGS+\ncpu-load: 18%\nfree-memory: 642.0MiB',
      ok: true,
    },
  ]);

  const runCommand = (rawCmd: string, targetDevice: 'mikrotik' | 'cisco' = device) => {
    const res = executeSandboxCommand(sandboxState, targetDevice, rawCmd);
    if (res.ok) {
      onUpdateSandboxState(res.nextState);
    }
    setHistory((prev) => [
      {
        id: `cmd_${Date.now()}_${Math.random()}`,
        device: targetDevice,
        command: rawCmd,
        output: res.output,
        ok: res.ok,
        errorHighlight: res.errorHighlight,
      },
      ...prev,
    ]);
  };

  // Auto-run script sent from Module 7 ("Test in Sandbox")
  useEffect(() => {
    if (!pendingScript.trim()) return;
    setDevice('mikrotik');
    setCommandInput(pendingScript);
    runCommand(pendingScript, 'mikrotik');
    onClearPendingScript();
  }, [pendingScript]);

  const handleVersionSwitch = (ver: RouterOSVersion) => {
    onUpdateSandboxState({ ...sandboxState, mikrotikVersion: ver });
  };

  const quickCommands =
    device === 'mikrotik'
      ? [
          '/interface print',
          '/ip address print',
          '/ip route print',
          '/ip hotspot active print',
          '/ip address add address=10.90.0.1/24 interface=ether5-Tower',
          '/routing table add name=to_WAN2 fib',
          'bad-command-test',
        ]
      : [
          'show ip interface brief',
          'show vlan',
          'show running-config',
          'vlan 30',
          'hostname Core-SW-Shaban',
          'invalid-ios-cmd',
        ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <FlaskConical className="h-5 w-5 text-amber-300" />
            <span>
              {lang === 'ar'
                ? 'محاكي التدريب العالمي (MikroTik RB4011 & Cisco 3650)'
                : 'Pro MikroTik & Cisco Sandbox Simulator'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'اختبر السكربتات والأوامر على أجهزة افتراضية متكاملة مع فحص الأخطاء البرمجية باللون الأحمر قبل الترحيل للراوتر الحقيقي.'
              : 'Validate RouterOS & Cisco IOS scripts on virtual devices with red syntax error highlighting before promoting to Live Router.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onUpdateSandboxState(createInitialSandboxState(sandboxState.mikrotikVersion))}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:border-cyan-400 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'إعادة ضبط المعمل' : 'Reset Lab'}</span>
          </button>

          <button
            type="button"
            onClick={() => onPromoteToLive(commandInput)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-xs font-extrabold text-slate-950 hover:brightness-110 cursor-pointer"
          >
            <Rocket className="h-4 w-4" />
            <span>
              {lang === 'ar' ? 'ترقية ونقل للراوتر الحقيقي' : 'Promote to Live Router'}
            </span>
          </button>
        </div>
      </div>

      {/* Virtual Device Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDevice('mikrotik');
              setCommandInput('/interface print');
            }}
            className={`rounded-xl border px-4 py-2 text-xs font-bold cursor-pointer ${
              device === 'mikrotik'
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                : 'border-slate-800 bg-[#0B142B] text-slate-300'
            }`}
          >
            MikroTik RB4011iGS+ ({sandboxState.mikrotikIdentity})
          </button>

          <button
            type="button"
            onClick={() => {
              setDevice('cisco');
              setCommandInput('show ip interface brief');
            }}
            className={`rounded-xl border px-4 py-2 text-xs font-bold cursor-pointer ${
              device === 'cisco'
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                : 'border-slate-800 bg-[#0B142B] text-slate-300'
            }`}
          >
            Cisco Catalyst 3650 ({sandboxState.ciscoHostname})
          </button>
        </div>

        {device === 'mikrotik' && (
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-[#050A18] p-1 text-xs">
            <button
              type="button"
              onClick={() => handleVersionSwitch('v7')}
              className={`rounded-lg px-2.5 py-1 font-bold cursor-pointer ${
                sandboxState.mikrotikVersion === 'v7'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-400'
              }`}
            >
              RouterOS v7
            </button>
            <button
              type="button"
              onClick={() => handleVersionSwitch('v6')}
              className={`rounded-lg px-2.5 py-1 font-bold cursor-pointer ${
                sandboxState.mikrotikVersion === 'v6'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-400'
              }`}
            >
              RouterOS v6
            </button>
          </div>
        )}
      </div>

      {/* Interactive Virtual Terminal + Virtual Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CLI Console */}
        <div className="lg:col-span-7 noc-glass rounded-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-cyan-500/20 bg-slate-950/75 px-4 py-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <span className="font-mono text-xs font-bold text-white" dir="ltr">
                {device === 'mikrotik'
                  ? `[admin@${sandboxState.mikrotikIdentity}] >`
                  : `${sandboxState.ciscoHostname}#`}
              </span>
            </div>
            <span className="font-mono text-[11px] text-amber-300">SANDBOX VM</span>
          </div>

          {/* Quick Command Chips */}
          <div className="flex flex-wrap gap-1.5 border-b border-slate-800/80 bg-[#050A18]/80 px-3 py-2.5">
            {quickCommands.map((qc) => (
              <button
                key={qc}
                type="button"
                onClick={() => setCommandInput(qc)}
                dir="ltr"
                className={`rounded-lg border px-2.5 py-1 font-mono text-[10px] cursor-pointer ${
                  qc.includes('bad') || qc.includes('invalid')
                    ? 'border-rose-500/35 bg-rose-500/10 text-rose-300'
                    : 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200 hover:border-cyan-400'
                }`}
              >
                {qc}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3.5 border-b border-slate-800/80 bg-[#030712] space-y-2.5">
            <textarea
              rows={3}
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              dir="ltr"
              placeholder={
                device === 'mikrotik'
                  ? 'Enter RouterOS commands (e.g. /ip address print)...'
                  : 'Enter Cisco IOS commands (e.g. show vlan)...'
              }
              className="w-full rounded-xl border border-slate-700 bg-[#070E20] p-3 font-mono text-xs text-cyan-100 outline-none focus:border-cyan-400"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => runCommand(commandInput, device)}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-cyan-300 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                <span>{lang === 'ar' ? 'تنفيذ في المحاكي' : 'Execute in Sandbox'}</span>
              </button>
            </div>
          </div>

          {/* Output History */}
          <div className="max-h-80 overflow-y-auto bg-[#030712]/95 p-3.5 space-y-3" dir="ltr">
            {history.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-xl border p-3 font-mono text-xs ${
                  entry.ok
                    ? 'border-slate-800 bg-[#070D1D]'
                    : 'border-rose-500/60 bg-rose-500/12'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className={entry.ok ? 'text-emerald-300' : 'text-rose-300 font-bold'}>
                    $ {entry.command.split('\n')[0]}
                    {entry.command.includes('\n') ? ' ...' : ''}
                  </span>
                  {!entry.ok && (
                    <span className="inline-flex items-center gap-1 text-rose-300 font-bold">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      SYNTAX ERROR
                    </span>
                  )}
                </div>
                {entry.errorHighlight && (
                  <p className="mb-1.5 rounded bg-rose-500/25 px-2 py-1 text-[11px] text-rose-200 underline decoration-rose-400">
                    Offending line: {entry.errorHighlight}
                  </p>
                )}
                <pre
                  className={`whitespace-pre-wrap text-[11px] leading-relaxed ${
                    entry.ok ? 'text-cyan-100' : 'text-rose-200'
                  }`}
                >
                  {entry.output}
                </pre>
              </div>
            ))}
          </div>
        </div>

        {/* Live Virtual Device State Tables */}
        <div className="lg:col-span-5 space-y-4">
          <div className="noc-glass rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-cyan-300 flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              <span>
                {device === 'mikrotik'
                  ? lang === 'ar'
                    ? 'منافذ الراوتر الافتراضي RB4011'
                    : 'Virtual RB4011 Interfaces'
                  : lang === 'ar'
                  ? 'منافذ سويتش Cisco Catalyst 3650'
                  : 'Virtual Catalyst 3650 Interfaces'}
              </span>
            </h3>
            <div className="space-y-1.5 text-xs" dir="ltr">
              {(device === 'mikrotik'
                ? sandboxState.mikrotikInterfaces
                : sandboxState.ciscoInterfaces
              ).map((iface) => (
                <div
                  key={iface.name}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#050A18]/80 px-3 py-2 font-mono"
                >
                  <div>
                    <span className="font-bold text-white">{iface.name}</span>
                    {iface.ip && <span className="ms-2 text-[10px] text-cyan-300">{iface.ip}</span>}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase ${
                      iface.status === 'up' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {iface.status} · {iface.rxMbps}M
                  </span>
                </div>
              ))}
            </div>
          </div>

          {device === 'mikrotik' ? (
            <div className="noc-glass rounded-2xl p-4 space-y-2.5">
              <h3 className="text-xs font-bold text-white">
                {lang === 'ar' ? 'الجلسات النشطة & جدول التوجيه' : 'Active Sessions & Routes'}
              </h3>
              <div className="space-y-1.5 text-[11px] font-mono" dir="ltr">
                {sandboxState.mikrotikActiveUsers.map((u) => (
                  <div
                    key={u.user}
                    className="flex items-center justify-between rounded-lg bg-[#050A18]/75 px-3 py-1.5 text-slate-300"
                  >
                    <span>
                      {u.user} ({u.service})
                    </span>
                    <span className="text-cyan-300">{u.ip}</span>
                  </div>
                ))}
                {sandboxState.mikrotikRoutes.map((r, i) => (
                  <div
                    key={`${r.dst}_${i}`}
                    className="flex items-center justify-between rounded-lg border border-slate-800/70 px-3 py-1.5 text-slate-400"
                  >
                    <span>{r.dst}</span>
                    <span className="text-emerald-300">gw: {r.gateway}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="noc-glass rounded-2xl p-4 space-y-2.5">
              <h3 className="text-xs font-bold text-white">
                {lang === 'ar' ? 'جدول VLANs الافتراضي' : 'Virtual Catalyst VLAN Database'}
              </h3>
              <div className="space-y-1.5 text-[11px] font-mono" dir="ltr">
                {sandboxState.ciscoVlans.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-lg bg-[#050A18]/75 px-3 py-1.5 text-slate-200"
                  >
                    <span>
                      VLAN {v.id} — {v.name}
                    </span>
                    <span className="text-cyan-300">{v.ports}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
