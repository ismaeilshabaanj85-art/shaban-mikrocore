import React, { useState } from 'react';
import {
  Check,
  Copy,
  Globe,
  Plus,
  Router,
  Server,
  Shield,
  Trash2,
  Wifi,
} from 'lucide-react';
import {
  AppMode,
  ConnectionMethod,
  Language,
  RouterOSVersion,
  RouterProfile,
  SessionUser,
} from '../../types/mikrocore';
import {
  executeRouterOsV7Rest,
  generateOneLineConnector,
} from '../../engine/networkEngine';
import { generateUUID, sanitizeInput } from '../../utils/security';
import { CodeTerminalBox } from '../CodeTerminalBox';

interface ServerConnectionModuleProps {
  lang: Language;
  mode: AppMode;
  user: SessionUser;
  routers: RouterProfile[];
  activeRouterId: string;
  onSelectRouter: (id: string) => void;
  onSaveRouters: (routers: RouterProfile[]) => void;
  onSaveToVault: (name: string, content: string, type: 'rsc' | 'backup') => void;
}

export const ServerConnectionModule: React.FC<ServerConnectionModuleProps> = ({
  lang,
  mode,
  user,
  routers,
  activeRouterId,
  onSelectRouter,
  onSaveRouters,
  onSaveToVault,
}) => {
  const activeRouter = routers.find((r) => r.id === activeRouterId) || routers[0];

  const [copiedUuid, setCopiedUuid] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    boardInfo?: string;
  } | null>(null);

  const [name, setName] = useState(activeRouter.name);
  const [model, setModel] = useState(activeRouter.model);
  const [osVersion, setOsVersion] = useState<RouterOSVersion>(activeRouter.osVersion);
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>(
    activeRouter.connectionMethod
  );
  const [host, setHost] = useState(activeRouter.host);
  const [port, setPort] = useState(activeRouter.port);
  const [apiUser, setApiUser] = useState(activeRouter.apiUser);
  const [apiPassword, setApiPassword] = useState(activeRouter.apiPassword || 'MikroCore@2026');
  const [enableCloudDdns, setEnableCloudDdns] = useState(
    activeRouter.osVersion === 'v7' || activeRouter.connectionMethod === 'cloud_ddns'
  );

  const syncFormToRouter = (r: RouterProfile) => {
    setName(r.name);
    setModel(r.model);
    setOsVersion(r.osVersion);
    setConnectionMethod(r.connectionMethod);
    setHost(r.host);
    setPort(r.port);
    setApiUser(r.apiUser);
    setApiPassword(r.apiPassword || 'MikroCore@2026');
    setEnableCloudDdns(r.osVersion === 'v7' || r.connectionMethod === 'cloud_ddns');
    setTestResult(null);
  };

  const handleCopyUuid = async () => {
    try {
      await navigator.clipboard.writeText(user.tenantUuid);
    } catch {
      // ignore
    }
    setCopiedUuid(true);
    setTimeout(() => setCopiedUuid(false), 1800);
  };

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedPort = Number(port) || (osVersion === 'v7' ? 80 : 8728);
    const updated = routers.map((r) =>
      r.id === activeRouter.id
        ? {
            ...r,
            name: sanitizeInput(name) || r.name,
            model: sanitizeInput(model) || r.model,
            osVersion,
            connectionMethod,
            host: sanitizeInput(host) || '192.168.88.1',
            port: resolvedPort,
            apiUser: sanitizeInput(apiUser) || 'mikrocore-api',
            apiPassword,
            useHttps: osVersion === 'v7' && resolvedPort !== 80,
          }
        : r
    );
    onSaveRouters(updated);
    setTestResult({
      ok: true,
      message:
        lang === 'ar' ? 'تم حفظ إعدادات السيرفر داخل مساحتك المعزولة.' : 'Server profile saved in isolated tenant storage.',
    });
  };

  const handleAddNewRouter = () => {
    if (routers.length >= user.maxRouters) {
      setTestResult({
        ok: false,
        message:
          lang === 'ar'
            ? `وصلت للحد الأقصى المسموح (${user.maxRouters} أجهزة).`
            : `Router limit reached (${user.maxRouters} devices max).`,
      });
      return;
    }
    const newRouter: RouterProfile = {
      id: generateUUID(),
      name: `MikroTik-Node-${routers.length + 1}`,
      model: 'RB5009UG+S+IN',
      osVersion: 'v7',
      connectionMethod: 'local_ip',
      host: `192.168.${88 + routers.length}.1`,
      port: 80,
      apiUser: `mikrocore_${user.username}`,
      apiPassword: 'MikroCore@2026',
      useHttps: false,
      status: mode === 'sandbox' ? 'sandbox' : 'disconnected',
    };
    const next = [...routers, newRouter];
    onSaveRouters(next);
    onSelectRouter(newRouter.id);
    syncFormToRouter(newRouter);
  };

  const handleDeleteRouter = (id: string) => {
    if (routers.length <= 1) return;
    const filtered = routers.filter((r) => r.id !== id);
    onSaveRouters(filtered);
    if (id === activeRouter.id) {
      onSelectRouter(filtered[0].id);
      syncFormToRouter(filtered[0]);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    const resolvedPort = Number(port) || (osVersion === 'v7' ? 80 : 8728);
    const candidate: RouterProfile = {
      ...activeRouter,
      name,
      model,
      osVersion,
      connectionMethod,
      host,
      port: resolvedPort,
      apiUser,
      apiPassword,
      useHttps: osVersion === 'v7' && resolvedPort !== 80,
    };

    if (mode === 'sandbox') {
      await new Promise((r) => setTimeout(r, 550));
      setTesting(false);
      const updated = routers.map((r) =>
        r.id === activeRouter.id
          ? { ...candidate, status: 'sandbox' as const, lastConnectedAt: new Date().toISOString() }
          : r
      );
      onSaveRouters(updated);
      setTestResult({
        ok: true,
        message:
          lang === 'ar'
            ? 'نجح فحص الاتصال في وضع المحاكاة الذكي (REST API & Terminal Ready).'
            : 'Sandbox handshake succeeded (REST API & Terminal Ready).',
        boardInfo: `${candidate.model} · RouterOS ${candidate.osVersion.toUpperCase()} · RTT: 2ms`,
      });
      return;
    }

    if (osVersion === 'v6') {
      setTesting(false);
      setTestResult({
        ok: true,
        message:
          lang === 'ar'
            ? 'الراوتر مضبوط على RouterOS v6. استخدم سكربت الربط أحادي السطر أدناه في New Terminal للتفعيل الفوري.'
            : 'Configured for RouterOS v6. Paste the One-Line Connector script below into New Terminal.',
      });
      return;
    }

    const res = await executeRouterOsV7Rest(candidate, '/system/resource', 'GET');
    setTesting(false);
    if (res.ok) {
      const updated = routers.map((r) =>
        r.id === activeRouter.id
          ? { ...candidate, status: 'connected' as const, lastConnectedAt: new Date().toISOString() }
          : r
      );
      onSaveRouters(updated);
      setTestResult({
        ok: true,
        message:
          lang === 'ar'
            ? 'تم الاتصال الحي بنجاح عبر RouterOS v7 REST API!'
            : 'Live RouterOS v7 REST API connection succeeded!',
        boardInfo: JSON.stringify(res.data).slice(0, 120),
      });
    } else {
      const updated = routers.map((r) =>
        r.id === activeRouter.id ? { ...candidate, status: 'disconnected' as const } : r
      );
      onSaveRouters(updated);
      setTestResult({
        ok: false,
        message:
          lang === 'ar'
            ? `تعذر الوصول إلى الراوتر عبر الجسر السحابي (${res.error || res.status}). تأكد من لصق سكربت الربط ومن تفعيل النطاق العام/Cloud DDNS.`
            : `Router unreachable via Cloud Bridge (${res.error || res.status}). Ensure the One-Line Connector script was run and Cloud DDNS is reachable.`,
      });
    }
  };

  const connectorScript = generateOneLineConnector({
    osVersion,
    tenantUuid: user.tenantUuid,
    apiUser,
    apiPassword,
    enableCloudDdns,
    port,
  });

  return (
    <div className="space-y-6">
      {/* Header + Tenant Isolation Banner */}
      <div className="noc-glass rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Server className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'ربط السيرفر والعزل متعدد المستأجرين'
                : 'Server Connection & Multi-Tenant Isolation'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'اربط راوتر MikroTik عبر IP محلي (ستارلينك)، IP ثابت، أو MikroTik Cloud DDNS مع تمرير آمن عبر الجسر السحابي.'
              : 'Connect MikroTik via Local Starlink IP, Static Public IP, or Cloud DDNS routed securely through the Cloud Bridge.'}
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-[#050A18]/80 px-4 py-2.5">
          <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-slate-400">
              {lang === 'ar' ? 'معرّف العزل الخاص بك (Tenant UUID)' : 'Your Isolated Tenant UUID'}
            </p>
            <p className="truncate font-mono text-xs font-bold text-cyan-300" dir="ltr">
              {user.tenantUuid}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyUuid}
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-200 hover:border-cyan-400 cursor-pointer"
            aria-label="Copy Tenant UUID"
          >
            {copiedUuid ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Saved Routers Strip */}
      <div className="flex flex-wrap items-center gap-2.5">
        {routers.map((r) => {
          const isSelected = r.id === activeRouter.id;
          return (
            <div
              key={r.id}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                isSelected
                  ? 'border-cyan-400/60 bg-cyan-500/15 text-white'
                  : 'border-slate-800 bg-[#0B142B]/70 text-slate-300 hover:border-cyan-500/30'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  onSelectRouter(r.id);
                  syncFormToRouter(r);
                }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Router className="h-3.5 w-3.5 text-cyan-400" />
                <span>{r.name}</span>
                <span className="font-mono text-[11px] text-slate-400" dir="ltr">
                  ({r.host})
                </span>
              </button>
              {routers.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteRouter(r.id)}
                  className="text-slate-500 hover:text-rose-400 cursor-pointer"
                  aria-label={`Remove ${r.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleAddNewRouter}
          className="flex items-center gap-1.5 rounded-xl border border-dashed border-cyan-500/40 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/10 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>
            {lang === 'ar' ? 'إضافة راوتر' : 'Add Router'} ({routers.length}/{user.maxRouters})
          </span>
        </button>
      </div>

      {/* Connection Form */}
      <form onSubmit={handleSaveCurrent} className="noc-glass rounded-2xl p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              {lang === 'ar' ? 'اسم السيرفر' : 'Router Name'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              {lang === 'ar' ? 'موديل الجهاز' : 'Hardware Model'}
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              {lang === 'ar' ? 'إصدار النظام' : 'RouterOS Version'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['v7', 'v6'] as RouterOSVersion[]).map((ver) => (
                <button
                  key={ver}
                  type="button"
                  onClick={() => {
                    setOsVersion(ver);
                    setPort(ver === 'v7' ? 80 : 8728);
                  }}
                  className={`rounded-xl border py-2.5 text-xs font-bold transition cursor-pointer ${
                    osVersion === ver
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                      : 'border-slate-700 bg-[#050A18]/70 text-slate-400 hover:text-white'
                  }`}
                >
                  RouterOS {ver.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              {lang === 'ar' ? 'طريقة الربط' : 'Connection Method'}
            </label>
            <select
              value={connectionMethod}
              onChange={(e) => {
                const val = e.target.value as ConnectionMethod;
                setConnectionMethod(val);
                setEnableCloudDdns(val === 'cloud_ddns');
              }}
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400"
            >
              <option value="local_ip">
                {lang === 'ar' ? 'IP محلي / ستارلينك (LAN)' : 'Local IP / Starlink LAN'}
              </option>
              <option value="static_ip">
                {lang === 'ar' ? 'IP عام ثابت (Static Public)' : 'Static Public IP'}
              </option>
              <option value="cloud_ddns">
                {lang === 'ar' ? 'سحابة مايكروتك (Cloud DDNS)' : 'MikroTik Cloud DDNS'}
              </option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              {connectionMethod === 'cloud_ddns'
                ? lang === 'ar'
                  ? 'نطاق Cloud DDNS'
                  : 'Cloud DDNS Hostname'
                : lang === 'ar'
                ? 'عنوان IP السيرفر'
                : 'Router IP / Host'}
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={
                connectionMethod === 'cloud_ddns' ? 'xxxxxx.sn.mynetname.net' : '192.168.88.1'
              }
              dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              {lang === 'ar' ? 'منفذ API / REST' : 'API / REST Port'}
            </label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 text-xs text-white font-mono tabular-nums outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              {lang === 'ar' ? 'مستخدم API المعزول' : 'Isolated API Username'}
            </label>
            <input
              type="text"
              value={apiUser}
              onChange={(e) => setApiUser(e.target.value)}
              dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              {lang === 'ar' ? 'كلمة مرور API' : 'API Password'}
            </label>
            <input
              type="password"
              value={apiPassword}
              onChange={(e) => setApiPassword(e.target.value)}
              dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {testResult && (
          <div
            className={`rounded-xl border px-4 py-3 text-xs ${
              testResult.ok
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            }`}
          >
            <p className="font-bold">{testResult.message}</p>
            {testResult.boardInfo && (
              <p className="mt-1 font-mono text-[11px] opacity-90" dir="ltr">
                {testResult.boardInfo}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={enableCloudDdns}
              onChange={(e) => setEnableCloudDdns(e.target.checked)}
              className="rounded border-slate-600 accent-cyan-400"
            />
            <Globe className="h-3.5 w-3.5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'فتح منفذي 443,80 + تفعيل www و Cloud DDNS + شهادة SSL تلقائية وطباعة النطاق'
                : 'Open ports 443,80, enable www & Cloud DDNS, free SSL & print domain'}
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={testing}
              onClick={handleTestConnection}
              className="flex items-center gap-2 rounded-xl border border-emerald-400/45 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/25 cursor-pointer disabled:opacity-60"
            >
              <Wifi className="h-4 w-4" />
              <span>
                {testing
                  ? lang === 'ar'
                    ? 'جارٍ الفحص...'
                    : 'Testing...'
                  : lang === 'ar'
                  ? 'فحص الاتصال المباشر'
                  : 'Test Live Connection'}
              </span>
            </button>

            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:brightness-110 cursor-pointer"
            >
              {lang === 'ar' ? 'حفظ إعدادات السيرفر' : 'Save Server Profile'}
            </button>
          </div>
        </div>
      </form>

      {/* Personalized One-Line Connector Script */}
      <CodeTerminalBox
        title={
          lang === 'ar'
            ? 'سكربت الربط أحادي السطر (الصقه في New Terminal داخل Winbox)'
            : 'Personalized One-Line Connector Script (Paste in Winbox New Terminal)'
        }
        code={connectorScript}
        filename={`connector_${activeRouter.name}.rsc`}
        lang={lang}
        mode={mode}
        activeRouter={{ ...activeRouter, osVersion, host, port, apiUser, apiPassword }}
        onSaveToVault={onSaveToVault}
        showRestApply={false}
      />
    </div>
  );
};
