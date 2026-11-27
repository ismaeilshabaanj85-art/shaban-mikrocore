import React, { useState } from 'react';
import {
  Check,
  Download,
  Gauge,
  LayoutTemplate,
  Phone,
  Plus,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { CaptivePortalConfig, Language } from '../../types/mikrocore';
import { generateUUID } from '../../utils/security';

interface CaptivePortalModuleProps {
  lang: Language;
  portal: CaptivePortalConfig;
  onSavePortal: (portal: CaptivePortalConfig) => void;
}

function buildLoginHtml(cfg: CaptivePortalConfig): string {
  const loginMode = cfg.loginMode || 'user_pass';
  const plansHtml = cfg.plans
    .map(
      (p) =>
        `<div class="plan"><strong>${p.name}</strong><span>${p.speed}</span><em>${p.price} / ${p.duration}</em></div>`
    )
    .join('\n        ');

  const formHtml =
    loginMode === 'user_pass'
      ? `    <form name="login" action="$(link-login-only)" method="post">
      <input type="hidden" name="dst" value="$(link-orig)" />
      <input type="hidden" name="popup" value="true" />
      <label>اسم المستخدم</label>
      <input name="username" type="text" value="$(username)" placeholder="اسم المستخدم / رقم البطاقة" required />
      <label>كلمة المرور</label>
      <input name="password" type="password" placeholder="••••••••" required />
      <button type="submit">دخول للشبكة</button>
    </form>`
      : `    <form name="login" action="$(link-login-only)" method="post" onsubmit="this.password.value=this.username.value;">
      <input type="hidden" name="dst" value="$(link-orig)" />
      <input type="hidden" name="popup" value="true" />
      <input type="hidden" name="password" value="" />
      <label>رمز البطاقة (Voucher PIN)</label>
      <input name="username" type="text" value="$(username)" placeholder="أدخل رمز البطاقة" required />
      <button type="submit">دخول للشبكة</button>
    </form>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${cfg.networkTitle} — Login</title>
  <link rel="stylesheet" href="mikrocore-portal.css" />
</head>
<body style="background:${cfg.bgColor};--accent:${cfg.primaryColor};">
  <div class="card">
    <h1>${cfg.networkTitle}</h1>
    <p class="sub">${cfg.subtitle}</p>
    ${cfg.promoBanner ? `<div class="promo">${cfg.promoBanner}</div>` : ''}
${formHtml}
    $(if error)<p class="err">$(error)</p>$(endif)
    <div class="plans">
      <h3>الباقات المتوفرة</h3>
      <div class="grid">
        ${plansHtml}
      </div>
    </div>
    <div class="footer">
      <span>الدعم الفني: ${cfg.supportPhone1} · ${cfg.supportPhone2}</span>
    </div>
  </div>
</body>
</html>`;
}

function buildStatusHtml(cfg: CaptivePortalConfig): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${cfg.networkTitle} — Status</title>
  <link rel="stylesheet" href="mikrocore-portal.css" />
</head>
<body style="background:${cfg.bgColor};--accent:${cfg.primaryColor};">
  <div class="card">
    <h1>أنت متصل الآن — ${cfg.networkTitle}</h1>
    <p class="sub">المستخدم: $(username) · IP: $(ip)</p>
    <div class="plans">
      <div class="plan"><strong>المتبقي من الوقت</strong><span>$(session-time-left)</span></div>
      <div class="plan"><strong>الرفع / التنزيل</strong><span>$(bytes-in-nice) / $(bytes-out-nice)</span></div>
    </div>
    <form action="$(link-logout)" name="logout">
      <button type="submit">تسجيل الخروج</button>
    </form>
  </div>
</body>
</html>`;
}

function buildPortalCss(cfg: CaptivePortalConfig): string {
  return `*{box-sizing:border-box;font-family:system-ui,sans-serif}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;color:#f8fafc}
.card{width:100%;max-width:420px;background:rgba(15,23,42,0.92);border:1px solid ${cfg.primaryColor}44;border-radius:20px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,0.5)}
h1{margin:0;font-size:22px;text-align:center;color:${cfg.primaryColor}}
.sub{text-align:center;font-size:13px;color:#94a3b8;margin:6px 0 16px}
.promo{background:${cfg.primaryColor}22;border:1px solid ${cfg.primaryColor}55;border-radius:12px;padding:10px;font-size:12px;text-align:center;margin-bottom:16px}
label{display:block;font-size:12px;margin-bottom:6px;color:#cbd5e1}
input{width:100%;padding:11px;border-radius:10px;border:1px solid #334155;background:#020617;color:#fff;margin-bottom:12px}
button{width:100%;padding:12px;border:none;border-radius:12px;background:${cfg.primaryColor};color:#020617;font-weight:800;cursor:pointer}
.plans{margin-top:20px}.plans h3{font-size:13px;margin-bottom:8px;color:#cbd5e1}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.plan{background:#020617;border:1px solid #1e293b;border-radius:10px;padding:8px;text-align:center;font-size:11px}
.plan strong,.plan span,.plan em{display:block;font-style:normal}
.plan em{color:${cfg.primaryColor};margin-top:4px;font-weight:700}
.footer{margin-top:16px;text-align:center;font-size:11px;color:#64748b}
.err{color:#fb7185;font-size:12px;text-align:center}`;
}

export const CaptivePortalModule: React.FC<CaptivePortalModuleProps> = ({
  lang,
  portal,
  onSavePortal,
}) => {
  const [speedTestMsg, setSpeedTestMsg] = useState('');
  const [downloaded, setDownloaded] = useState(false);

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    downloadFile('login.html', buildLoginHtml(portal));
    setTimeout(() => downloadFile('status.html', buildStatusHtml(portal)), 200);
    setTimeout(() => downloadFile('mikrocore-portal.css', buildPortalCss(portal)), 400);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  const addPlan = () => {
    onSavePortal({
      ...portal,
      plans: [
        ...portal.plans,
        {
          id: generateUUID(),
          name: lang === 'ar' ? 'باقة جديدة' : 'New Plan',
          speed: '10M / 5M',
          price: '5$',
          duration: '15 يوم',
        },
      ],
    });
  };

  const runPreviewSpeedTest = () => {
    const down = (18 + Math.random() * 42).toFixed(1);
    const ping = Math.floor(8 + Math.random() * 14);
    setSpeedTestMsg(`${down} Mbps · Ping ${ping}ms`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <LayoutTemplate className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'مصمم صفحة الهوت سبوت (Captive Portal Designer)'
                : 'Captive Portal Designer'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'صمم صفحة دخول المشتركين مع معاينة حية على الجوال وتصدير login.html وstatus.html لمجلد Files.'
              : 'Customize hotspot login page with live mobile preview and 1-click export of login.html & status.html.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportAll}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:brightness-110 cursor-pointer"
        >
          {downloaded ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          <span>
            {downloaded
              ? lang === 'ar'
                ? 'تم تصدير الملفات الثلاثة!'
                : 'Exported All 3 Files!'
              : lang === 'ar'
              ? 'تصدير ملفات الهوتسبوت (HTML/CSS)'
              : 'Export login.html + status.html + CSS'}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Visual Editor Controls */}
        <div className="noc-glass rounded-2xl p-5 space-y-4 lg:col-span-7">
          {/* Portal Login Mode Toggle */}
          <div className="rounded-xl border border-cyan-500/25 bg-[#050A18]/80 p-3.5 space-y-2.5">
            <label className="block text-xs font-bold text-cyan-300">
              {lang === 'ar' ? 'نوع تسجيل الدخول في الصفحة' : 'Portal Login Mode'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onSavePortal({ ...portal, loginMode: 'user_pass' })}
                className={`rounded-xl border px-3 py-2.5 text-start text-xs font-bold transition cursor-pointer ${
                  (portal.loginMode || 'user_pass') === 'user_pass'
                    ? 'border-cyan-400 bg-cyan-500/20 text-white shadow-[0_0_15px_rgba(0,229,255,0.18)]'
                    : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-cyan-500/35'
                }`}
              >
                <p>
                  {lang === 'ar'
                    ? 'حقلين (اسم المستخدم + كلمة المرور)'
                    : 'Two Fields (Username & Password)'}
                </p>
                <p className="mt-0.5 text-[10px] font-normal text-slate-400">
                  {lang === 'ar' ? 'الخيار الاحترافي الافتراضي' : 'Default standard login'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => onSavePortal({ ...portal, loginMode: 'pin_only' })}
                className={`rounded-xl border px-3 py-2.5 text-start text-xs font-bold transition cursor-pointer ${
                  portal.loginMode === 'pin_only'
                    ? 'border-cyan-400 bg-cyan-500/20 text-white shadow-[0_0_15px_rgba(0,229,255,0.18)]'
                    : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-cyan-500/35'
                }`}
              >
                <p>
                  {lang === 'ar'
                    ? 'حقل واحد (رمز البطاقة فقط)'
                    : 'Single Field (Voucher PIN Only)'}
                </p>
                <p className="mt-0.5 text-[10px] font-normal text-slate-400">
                  {lang === 'ar' ? 'تطابق تلقائي لكلمة المرور' : 'Auto-syncs PIN as password'}
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="mb-1 block text-xs text-slate-300">
                {lang === 'ar' ? 'عنوان الشبكة الرئيسي' : 'Network Title'}
              </label>
              <input
                type="text"
                value={portal.networkTitle}
                onChange={(e) => onSavePortal({ ...portal, networkTitle: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-300">
                {lang === 'ar' ? 'الوصف الفرعي' : 'Subtitle'}
              </label>
              <input
                type="text"
                value={portal.subtitle}
                onChange={(e) => onSavePortal({ ...portal, subtitle: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-300">
                {lang === 'ar' ? 'اللون الرئيسي (Accent)' : 'Primary Accent Color'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={portal.primaryColor}
                  onChange={(e) => onSavePortal({ ...portal, primaryColor: e.target.value })}
                  className="h-9 w-12 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={portal.primaryColor}
                  onChange={(e) => onSavePortal({ ...portal, primaryColor: e.target.value })}
                  dir="ltr"
                  className="flex-1 rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-300">
                {lang === 'ar' ? 'لون الخلفية' : 'Background Color'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={portal.bgColor}
                  onChange={(e) => onSavePortal({ ...portal, bgColor: e.target.value })}
                  className="h-9 w-12 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={portal.bgColor}
                  onChange={(e) => onSavePortal({ ...portal, bgColor: e.target.value })}
                  dir="ltr"
                  className="flex-1 rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-300">
              {lang === 'ar' ? 'شريط الإعلانات والعروض' : 'Promotional Ad Banner'}
            </label>
            <input
              type="text"
              value={portal.promoBanner}
              onChange={(e) => onSavePortal({ ...portal, promoBanner: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="mb-1 block text-xs text-slate-300">
                {lang === 'ar' ? 'رقم الدعم الفني 1' : 'Support Phone 1'}
              </label>
              <input
                type="text"
                value={portal.supportPhone1}
                onChange={(e) => onSavePortal({ ...portal, supportPhone1: e.target.value })}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-300">
                {lang === 'ar' ? 'رقم الدعم الفني 2' : 'Support Phone 2'}
              </label>
              <input
                type="text"
                value={portal.supportPhone2}
                onChange={(e) => onSavePortal({ ...portal, supportPhone2: e.target.value })}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={portal.showSpeedTestBtn}
              onChange={(e) => onSavePortal({ ...portal, showSpeedTestBtn: e.target.checked })}
              className="accent-cyan-400"
            />
            <span>
              {lang === 'ar'
                ? 'إظهار زر اختبار السرعة المحلي في الصفحة'
                : 'Include local speed-test button in portal'}
            </span>
          </label>

          {/* Pricing Plans Editor */}
          <div className="border-t border-slate-800 pt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300">
                {lang === 'ar' ? 'جدول أسعار الباقات' : 'Portal Pricing Cards'}
              </span>
              <button
                type="button"
                onClick={addPlan}
                className="flex items-center gap-1 rounded-lg border border-cyan-500/35 bg-cyan-500/15 px-2.5 py-1 text-xs font-bold text-cyan-200 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{lang === 'ar' ? 'إضافة باقة' : 'Add Plan'}</span>
              </button>
            </div>

            {portal.plans.map((p, idx) => (
              <div key={p.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => {
                    const next = [...portal.plans];
                    next[idx] = { ...p, name: e.target.value };
                    onSavePortal({ ...portal, plans: next });
                  }}
                  className="rounded-lg border border-slate-700 bg-[#050A18] px-2.5 py-1.5 text-xs text-white"
                />
                <input
                  type="text"
                  value={p.speed}
                  onChange={(e) => {
                    const next = [...portal.plans];
                    next[idx] = { ...p, speed: e.target.value };
                    onSavePortal({ ...portal, plans: next });
                  }}
                  dir="ltr"
                  className="rounded-lg border border-slate-700 bg-[#050A18] px-2.5 py-1.5 font-mono text-xs text-cyan-300"
                />
                <input
                  type="text"
                  value={p.price}
                  onChange={(e) => {
                    const next = [...portal.plans];
                    next[idx] = { ...p, price: e.target.value };
                    onSavePortal({ ...portal, plans: next });
                  }}
                  className="rounded-lg border border-slate-700 bg-[#050A18] px-2.5 py-1.5 font-mono text-xs text-emerald-300"
                />
                <input
                  type="text"
                  value={p.duration}
                  onChange={(e) => {
                    const next = [...portal.plans];
                    next[idx] = { ...p, duration: e.target.value };
                    onSavePortal({ ...portal, plans: next });
                  }}
                  className="rounded-lg border border-slate-700 bg-[#050A18] px-2.5 py-1.5 text-xs text-slate-300"
                />
                <button
                  type="button"
                  onClick={() =>
                    onSavePortal({
                      ...portal,
                      plans: portal.plans.filter((item) => item.id !== p.id),
                    })
                  }
                  className="rounded-lg border border-rose-500/30 p-1.5 text-rose-300 hover:bg-rose-500/15 justify-self-end cursor-pointer"
                  aria-label={`Delete ${p.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Live Mobile Phone Preview */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Smartphone className="h-4 w-4 text-cyan-400" />
            <span>{lang === 'ar' ? 'معاينة حية على الجوال' : 'Live Mobile Preview'}</span>
          </div>

          <div
            style={{ backgroundColor: portal.bgColor }}
            className="w-full max-w-[330px] rounded-[2.2rem] border-4 border-slate-700 p-4 shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-slate-700" />
            <div
              style={{ borderColor: `${portal.primaryColor}55` }}
              className="rounded-2xl border bg-slate-900/90 p-4 text-center space-y-3"
            >
              <h4 style={{ color: portal.primaryColor }} className="text-base font-extrabold">
                {portal.networkTitle}
              </h4>
              <p className="text-[11px] text-slate-300">{portal.subtitle}</p>

              {portal.promoBanner && (
                <div
                  style={{
                    borderColor: `${portal.primaryColor}55`,
                    backgroundColor: `${portal.primaryColor}1A`,
                  }}
                  className="rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold text-white"
                >
                  {portal.promoBanner}
                </div>
              )}

              <div className="space-y-2.5 text-start">
                {(portal.loginMode || 'user_pass') === 'user_pass' ? (
                  <>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-slate-300">
                        {lang === 'ar' ? 'اسم المستخدم' : 'Username'}
                      </label>
                      <input
                        type="text"
                        readOnly
                        value="MC-884102"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-slate-300">
                        {lang === 'ar' ? 'كلمة المرور' : 'Password'}
                      </label>
                      <input
                        type="password"
                        readOnly
                        value="884102"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-slate-300">
                      {lang === 'ar' ? 'رمز البطاقة (PIN)' : 'Voucher PIN'}
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="MC-884102"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                    />
                  </div>
                )}
                <button
                  type="button"
                  style={{ backgroundColor: portal.primaryColor }}
                  className="w-full rounded-xl py-2.5 text-xs font-extrabold text-slate-950"
                >
                  {lang === 'ar' ? 'دخول للشبكة' : 'Connect to Wi-Fi'}
                </button>
              </div>

              {portal.showSpeedTestBtn && (
                <button
                  type="button"
                  onClick={runPreviewSpeedTest}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/80 py-2 text-[11px] font-bold text-cyan-200 hover:border-cyan-400 cursor-pointer"
                >
                  <Gauge className="h-3.5 w-3.5" />
                  <span>
                    {speedTestMsg ||
                      (lang === 'ar' ? 'فحص السرعة المحلي' : 'Local Speed Test')}
                  </span>
                </button>
              )}

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {portal.plans.slice(0, 3).map((pl) => (
                  <div
                    key={pl.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/90 p-1.5 text-[10px]"
                  >
                    <p className="font-bold text-white truncate">{pl.name}</p>
                    <p className="font-mono text-slate-400 truncate">{pl.speed}</p>
                    <p style={{ color: portal.primaryColor }} className="font-mono font-bold">
                      {pl.price}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px] text-slate-400" dir="ltr">
                <Phone className="h-3 w-3" />
                <span>{portal.supportPhone1}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
