import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Rocket,
  Wand2,
} from 'lucide-react';
import {
  AppMode,
  Language,
  RouterOSVersion,
  RouterProfile,
  ZeroTouchConfig,
} from '../../types/mikrocore';
import { generateZeroTouchBootstrap } from '../../engine/networkEngine';
import { CodeTerminalBox } from '../CodeTerminalBox';

interface ZeroTouchWizardModuleProps {
  lang: Language;
  mode: AppMode;
  activeRouter: RouterProfile;
  tenantUuid: string;
  onSaveToVault: (name: string, content: string, type: 'rsc' | 'backup') => void;
}

export const ZeroTouchWizardModule: React.FC<ZeroTouchWizardModuleProps> = ({
  lang,
  mode,
  activeRouter,
  tenantUuid,
  onSaveToVault,
}) => {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(1);

  const [config, setConfig] = useState<ZeroTouchConfig>({
    osVersion: activeRouter.osVersion,
    routerIdentity: activeRouter.name || 'Shaban-MikroCore',
    wanType: 'starlink_dhcp',
    wanInterface: 'ether1',
    wanPppoeUser: 'isp_user',
    wanPppoePass: 'isp_pass',
    wanStaticIp: '192.168.1.2/24',
    wanGateway: '192.168.1.1',
    hasSecondaryWan: false,
    secondaryWanInterface: 'ether2',
    secondaryWanType: 'dhcp',
    secondaryWanStaticIp: '192.168.2.2/24',
    secondaryWanGateway: '192.168.2.1',
    lanBridgeName: 'bridge-LAN',
    lanPorts: ['ether3', 'ether4', 'ether5'],
    lanSubnet: '192.168.88.1/24',
    dhcpRange: '192.168.88.10-192.168.88.254',
    serviceMode: 'dual',
    hotspotDnsName: 'login.shaban.net',
    dnsProvider: 'cloudflare_doh',
    adminPassword: 'StrongAdmin@2026',
    apiUsername: 'mikrocore-api',
    apiPassword: activeRouter.apiPassword || 'MikroCore@2026',
    tenantUuid,
  });

  const bootstrapScript = generateZeroTouchBootstrap(config);

  const stepTitles =
    lang === 'ar'
      ? [
          '1. إصدار النظام والهوية',
          '2. خط الإنترنت الأساسي (WAN 1)',
          '3. خط الاحتياط (WAN 2)',
          '4. الجسر والشبكة المحلية (LAN)',
          '5. وضع الخدمة (Hotspot / PPPoE)',
          '6. DNS وتأمين الدخول و REST',
        ]
      : [
          '1. RouterOS Version & Identity',
          '2. Primary WAN Link',
          '3. Secondary Failover WAN',
          '4. LAN Bridge & DHCP',
          '5. Service Mode (Hotspot / PPPoE)',
          '6. Encrypted DoH DNS & Security',
        ];

  if (!started) {
    return (
      <div className="noc-glass rounded-3xl p-8 sm:p-12 text-center max-w-3xl mx-auto">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-500/15 shadow-[0_0_28px_rgba(0,229,255,0.2)]">
          <Wand2 className="h-8 w-8 text-cyan-300" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
          {lang === 'ar' ? 'معالج البرمجة من الصفر (Zero-Touch)' : 'Zero-Touch Master Setup Wizard'}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300 max-w-xl mx-auto">
          {lang === 'ar'
            ? 'جهّز راوتر MikroTik جديد من الصفر في 6 خطوات هندسية دقيقة: ضبط WAN ستارلينك أو PPPoE، الجسر، DHCP، الهوتسبوت/PPPoE، DoH DNS، وتفعيل REST API بأمان تام.'
            : 'Configure a brand-new MikroTik router from scratch in 6 precision steps: Starlink/PPPoE WAN, LAN Bridge, DHCP, Hotspot/PPPoE, DoH DNS, and isolated REST API.'}
        </p>

        <div className="mt-8">
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-4 text-base font-extrabold text-slate-950 shadow-[0_0_32px_rgba(0,229,255,0.3)] transition hover:scale-[1.02] cursor-pointer"
          >
            <Rocket className="h-5 w-5" />
            <span>{lang === 'ar' ? 'لنبدأ 🚀' : "Let's Start 🚀"}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps Bar */}
      <div className="noc-glass rounded-2xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {stepTitles.map((title, idx) => {
            const num = idx + 1;
            const active = step === num;
            const done = step > num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => setStep(num)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold text-start transition cursor-pointer ${
                  active
                    ? 'border-cyan-400 bg-cyan-500/20 text-white'
                    : done
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                    : 'border-slate-800 bg-[#050A18]/60 text-slate-400'
                }`}
              >
                {done && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
                <span className="truncate">{title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="noc-glass rounded-2xl p-6 space-y-5">
        <h3 className="text-base font-bold text-cyan-300">{stepTitles[step - 1]}</h3>

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                {lang === 'ar' ? 'إصدار نظام التشغيل' : 'RouterOS Version'}
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {(['v7', 'v6'] as RouterOSVersion[]).map((ver) => (
                  <button
                    key={ver}
                    type="button"
                    onClick={() => setConfig({ ...config, osVersion: ver })}
                    className={`rounded-xl border py-3 text-xs font-bold cursor-pointer ${
                      config.osVersion === ver
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-slate-700 bg-[#050A18]/80 text-slate-400'
                    }`}
                  >
                    RouterOS {ver.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                {lang === 'ar' ? 'اسم الراوتر (Identity)' : 'Router Identity'}
              </label>
              <input
                type="text"
                value={config.routerIdentity}
                onChange={(e) => setConfig({ ...config, routerIdentity: e.target.value })}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-cyan-400"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                {lang === 'ar' ? 'نوع خط الإنترنت (WAN 1)' : 'Primary WAN Type'}
              </label>
              <select
                value={config.wanType}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    wanType: e.target.value as ZeroTouchConfig['wanType'],
                  })
                }
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400"
              >
                <option value="starlink_dhcp">Starlink / DHCP Client</option>
                <option value="pppoe_client">PPPoE Client</option>
                <option value="static_ip">Static IP</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                {lang === 'ar' ? 'منفذ WAN 1' : 'WAN 1 Interface'}
              </label>
              <input
                type="text"
                value={config.wanInterface}
                onChange={(e) => setConfig({ ...config, wanInterface: e.target.value })}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>
            {config.wanType === 'pppoe_client' && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    PPPoE Username
                  </label>
                  <input
                    type="text"
                    value={config.wanPppoeUser}
                    onChange={(e) => setConfig({ ...config, wanPppoeUser: e.target.value })}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    PPPoE Password
                  </label>
                  <input
                    type="text"
                    value={config.wanPppoePass}
                    onChange={(e) => setConfig({ ...config, wanPppoePass: e.target.value })}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white outline-none focus:border-cyan-400"
                  />
                </div>
              </>
            )}
            {config.wanType === 'static_ip' && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    Static IP / CIDR
                  </label>
                  <input
                    type="text"
                    value={config.wanStaticIp}
                    onChange={(e) => setConfig({ ...config, wanStaticIp: e.target.value })}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    Gateway IP
                  </label>
                  <input
                    type="text"
                    value={config.wanGateway}
                    onChange={(e) => setConfig({ ...config, wanGateway: e.target.value })}
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white outline-none focus:border-cyan-400"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <label className="flex items-center gap-2.5 text-xs font-bold text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={config.hasSecondaryWan}
                onChange={(e) => setConfig({ ...config, hasSecondaryWan: e.target.checked })}
                className="accent-cyan-400"
              />
              <span>
                {lang === 'ar'
                  ? 'تفعيل خط احتياطي ثانٍ (Secondary Failover WAN)'
                  : 'Enable Secondary Failover WAN Link'}
              </span>
            </label>

            {config.hasSecondaryWan && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs text-slate-300">
                    {lang === 'ar' ? 'منفذ WAN 2' : 'WAN 2 Interface'}
                  </label>
                  <input
                    type="text"
                    value={config.secondaryWanInterface}
                    onChange={(e) =>
                      setConfig({ ...config, secondaryWanInterface: e.target.value })
                    }
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-300">
                    {lang === 'ar' ? 'النوع' : 'Type'}
                  </label>
                  <select
                    value={config.secondaryWanType}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        secondaryWanType: e.target.value as 'dhcp' | 'pppoe' | 'static',
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 text-xs text-white"
                  >
                    <option value="dhcp">DHCP Client</option>
                    <option value="static">Static IP</option>
                    <option value="pppoe">PPPoE Client</option>
                  </select>
                </div>
                {config.secondaryWanType === 'static' && (
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-300">Gateway IP</label>
                    <input
                      type="text"
                      value={config.secondaryWanGateway}
                      onChange={(e) =>
                        setConfig({ ...config, secondaryWanGateway: e.target.value })
                      }
                      dir="ltr"
                      className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'اسم الجسر (Bridge)' : 'LAN Bridge Name'}
              </label>
              <input
                type="text"
                value={config.lanBridgeName}
                onChange={(e) => setConfig({ ...config, lanBridgeName: e.target.value })}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'منافذ LAN (مفصولة بفاصلة)' : 'LAN Ports (comma separated)'}
              </label>
              <input
                type="text"
                value={config.lanPorts.join(',')}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    lanPorts: e.target.value
                      .split(',')
                      .map((p) => p.trim())
                      .filter(Boolean),
                  })
                }
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'شبكة LAN (Gateway/CIDR)' : 'LAN Subnet'}
              </label>
              <input
                type="text"
                value={config.lanSubnet}
                onChange={(e) => setConfig({ ...config, lanSubnet: e.target.value })}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'نطاق DHCP Pool' : 'DHCP IP Range'}
              </label>
              <input
                type="text"
                value={config.dhcpRange}
                onChange={(e) => setConfig({ ...config, dhcpRange: e.target.value })}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white"
              />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'وضع التشغيل' : 'Subscriber Service Mode'}
              </label>
              <select
                value={config.serviceMode}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    serviceMode: e.target.value as ZeroTouchConfig['serviceMode'],
                  })
                }
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 text-xs text-white"
              >
                <option value="dual">Hotspot + PPPoE (Dual Stack)</option>
                <option value="hotspot">Hotspot Portal Only</option>
                <option value="pppoe">PPPoE Server Only</option>
                <option value="nat_only">Pure NAT Router (No Auth)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'نطاق صفحة دخول الهوتسبوت' : 'Hotspot Login DNS Name'}
              </label>
              <input
                type="text"
                value={config.hotspotDnsName}
                onChange={(e) => setConfig({ ...config, hotspotDnsName: e.target.value })}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white"
              />
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'مزود DNS المشفّر' : 'Encrypted DoH DNS'}
              </label>
              <select
                value={config.dnsProvider}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    dnsProvider: e.target.value as ZeroTouchConfig['dnsProvider'],
                  })
                }
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 text-xs text-white"
              >
                <option value="cloudflare_doh">Cloudflare 1.1.1.1 (DoH)</option>
                <option value="google_doh">Google 8.8.8.8 (DoH)</option>
                <option value="quad9">Quad9 Security (9.9.9.9)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'كلمة مرور Admin الجديدة' : 'New Admin Password'}
              </label>
              <input
                type="text"
                value={config.adminPassword}
                onChange={(e) => setConfig({ ...config, adminPassword: e.target.value })}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'مستخدم API المعزول' : 'Isolated API User'}
              </label>
              <input
                type="text"
                value={config.apiUsername}
                onChange={(e) => setConfig({ ...config, apiUsername: e.target.value })}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-300">
                {lang === 'ar' ? 'كلمة مرور API' : 'API Password'}
              </label>
              <input
                type="text"
                value={config.apiPassword}
                onChange={(e) => setConfig({ ...config, apiPassword: e.target.value })}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 font-mono text-xs text-white"
              />
            </div>
          </div>
        )}

        {/* Step Navigation Buttons */}
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-4">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            {lang === 'ar' ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
            <span>{lang === 'ar' ? 'السابق' : 'Previous'}</span>
          </button>

          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {step} / 6
          </span>

          <button
            type="button"
            disabled={step === 6}
            onClick={() => setStep((s) => Math.min(6, s + 1))}
            className="flex items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-40 cursor-pointer"
          >
            <span>{lang === 'ar' ? 'التالي' : 'Next'}</span>
            {lang === 'ar' ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Generated Master Bootstrap Script */}
      <CodeTerminalBox
        title={
          lang === 'ar'
            ? `سكربت البرمجة الشامل من الصفر (${config.osVersion.toUpperCase()})`
            : `Master Zero-Touch Bootstrap Script (${config.osVersion.toUpperCase()})`
        }
        code={bootstrapScript}
        filename={`ZeroTouch_${config.routerIdentity}_${config.osVersion}.rsc`}
        lang={lang}
        mode={mode}
        activeRouter={{ ...activeRouter, osVersion: config.osVersion }}
        onSaveToVault={onSaveToVault}
      />
    </div>
  );
};
