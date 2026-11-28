import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, QrCode } from 'lucide-react';
import {
  GeneratedVoucher,
  Language,
  VoucherTemplateType,
} from '../../types/mikrocore';

interface VoucherQrProps {
  value: string;
  darkColor?: string;
  size?: number;
}

const VoucherQrSvg: React.FC<VoucherQrProps> = ({
  value,
  darkColor = '#050A18',
  size = 56,
}) => {
  const [svgMarkup, setSvgMarkup] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toString(value, {
      type: 'svg',
      margin: 1,
      width: size,
      color: {
        dark: darkColor,
        light: '#ffffff',
      },
    })
      .then((svg) => {
        if (active) setSvgMarkup(svg);
      })
      .catch(() => {
        if (active) setSvgMarkup('');
      });
    return () => {
      active = false;
    };
  }, [value, darkColor, size]);

  if (!svgMarkup) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded bg-white text-slate-800"
      >
        <QrCode className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="overflow-hidden rounded bg-white p-0.5 shrink-0"
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
};

interface VoucherPrintStudioProps {
  lang: Language;
  vouchers: GeneratedVoucher[];
  hotspotDns: string;
  defaultNetworkName?: string;
  defaultSupportPhone?: string;
}

export const VoucherPrintStudio: React.FC<VoucherPrintStudioProps> = ({
  lang,
  vouchers,
  hotspotDns,
  defaultNetworkName,
  defaultSupportPhone,
}) => {
  const [template, setTemplate] = useState<VoucherTemplateType>('cyber_modern');
  const [networkName, setNetworkName] = useState(
    defaultNetworkName?.trim() || 'Shaban Fiber & Starlink'
  );
  const [supportPhone, setSupportPhone] = useState(
    defaultSupportPhone?.trim() || '+963-900-000-000'
  );
  const [maxPreviewCount, setMaxPreviewCount] = useState<number>(24);

  const previewList = vouchers.slice(0, maxPreviewCount);

  const templates: Array<{ id: VoucherTemplateType; labelAr: string; labelEn: string }> = [
    { id: 'classic', labelAr: 'كلاسيكي رسمي', labelEn: 'Classic' },
    { id: 'royal_gold', labelAr: 'الذهبي الملكي', labelEn: 'Royal Gold' },
    { id: 'cyber_modern', labelAr: 'سايبر مودرن', labelEn: 'Cyber Modern' },
    { id: 'thermal_58mm', labelAr: 'كاشير حراري 58mm', labelEn: '58mm Thermal POS' },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Studio Controls */}
      <div className="no-print noc-glass rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">
              {lang === 'ar'
                ? 'استوديو طباعة صفحة A4 احترافية والبطاقات الذكية'
                : 'Pro A4 Voucher Print Studio (24 / 32 Cut-Ready Cards)'}
            </h3>
            <p className="text-xs text-slate-400">
              {lang === 'ar'
                ? 'صفحة A4 مقسمة للقص (24 أو 32 بطاقة) مع اسم الشبكة، رقم الدعم، السعر، المدة/السرعة، ورمز QR فوري.'
                : 'Cut-ready A4 grid (24 or 32 cards per page) displaying Network Name, Support Phone, Price, Validity/Speed, and instant-login QR.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            disabled={vouchers.length === 0}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-2.5 text-xs font-extrabold text-slate-950 transition hover:brightness-110 disabled:opacity-40 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>
              {template === 'thermal_58mm'
                ? lang === 'ar'
                  ? 'طباعة حراري 58mm 🖨️'
                  : 'Print 58mm Thermal 🖨️'
                : lang === 'ar'
                ? 'طباعة صفحة A4 احترافية (PDF) 🖨️'
                : 'Print Pro A4 Page (PDF) 🖨️'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">
              {lang === 'ar' ? 'اسم الشبكة على البطاقة' : 'Network Brand Title'}
            </label>
            <input
              type="text"
              value={networkName}
              onChange={(e) => setNetworkName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">
              {lang === 'ar' ? 'رقم الدعم الفني' : 'Support Phone'}
            </label>
            <input
              type="text"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">
              {lang === 'ar' ? 'تخطيط صفحة A4 (بطاقة/صفحة)' : 'A4 Sheet Density (Cards/Page)'}
            </label>
            <select
              value={maxPreviewCount}
              onChange={(e) => setMaxPreviewCount(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/85 px-3 py-2 text-xs text-white"
            >
              <option value={24}>
                {lang === 'ar' ? '24 بطاقة / صفحة A4 (4×6 قياسي)' : '24 Cards / A4 Page (4×6)'}
              </option>
              <option value={32}>
                {lang === 'ar' ? '32 بطاقة / صفحة A4 (4×8 اقتصادي)' : '32 Cards / A4 Page (4×8)'}
              </option>
              <option value={64}>
                {lang === 'ar' ? '64 بطاقة (صفحتان A4)' : '64 Cards (2 A4 Pages)'}
              </option>
              <option value={1000}>
                {lang === 'ar' ? `الكل (${vouchers.length})` : `All (${vouchers.length})`}
              </option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">
              {lang === 'ar' ? 'اختر القالب' : 'Template Style'}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplate(tpl.id)}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold transition cursor-pointer truncate ${
                    template === tpl.id
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                      : 'border-slate-700 bg-[#050A18]/70 text-slate-400 hover:text-white'
                  }`}
                >
                  {lang === 'ar' ? tpl.labelAr : tpl.labelEn}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Printable Grid */}
      {vouchers.length === 0 ? (
        <div className="noc-glass rounded-2xl p-10 text-center text-xs text-slate-400">
          {lang === 'ar'
            ? 'قم بتوليد دفعة بطاقات أولاً من تبويب "توليد البطاقات" لعرضها وطباعتها هنا.'
            : 'Generate a batch of vouchers first to preview and print them here.'}
        </div>
      ) : (
        <div
          data-a4-density={maxPreviewCount === 32 ? '32' : '24'}
          className={`print-only-container ${
            template === 'thermal_58mm'
              ? 'mx-auto max-w-[240px] space-y-3'
              : `a4-print-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
                  maxPreviewCount === 32 ? 'gap-2.5' : 'gap-3.5'
                }`
          }`}
        >
          {previewList.map((v) => {
            const qrPayload = `http://${hotspotDns}/login?username=${encodeURIComponent(v.code)}&password=${encodeURIComponent(v.password)}`;
            const compactCard = maxPreviewCount === 32;

            if (template === 'thermal_58mm') {
              return (
                <div
                  key={v.id}
                  className="voucher-card-print rounded-lg border-2 border-dashed border-slate-800 bg-white p-3 text-slate-950 text-center font-mono"
                >
                  <p className="text-xs font-extrabold uppercase tracking-wide">{networkName}</p>
                  <p className="text-[10px] text-slate-600">{v.profileName} · {v.speedLabel}</p>
                  <div className="my-2 border-y border-dashed border-slate-400 py-1.5">
                    <p className="text-[10px] uppercase text-slate-500">USER / PASS</p>
                    <p className="text-base font-black tracking-widest">{v.code}</p>
                    <p className="text-[11px] font-bold">PASS: {v.password}</p>
                  </div>
                  <div className="flex items-center justify-center my-1.5">
                    <VoucherQrSvg value={qrPayload} size={64} darkColor="#000000" />
                  </div>
                  <p className="text-[10px] font-bold">
                    {v.durationLabel} · {v.price}
                    {v.currency}
                  </p>
                  <p className="text-[9px] text-slate-600" dir="ltr">{supportPhone}</p>
                </div>
              );
            }

            if (template === 'royal_gold') {
              return (
                <div
                  key={v.id}
                  className={`voucher-card-print rounded-2xl border-2 border-dashed border-amber-400/75 bg-gradient-to-br from-[#141109] via-[#1C160A] to-[#0A0805] ${
                    compactCard ? 'p-2.5' : 'p-3.5'
                  } text-amber-50 shadow-lg`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-amber-400/25 pb-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-extrabold text-amber-300">{networkName}</p>
                      <p className="text-[10px] text-amber-200/75 truncate">
                        {v.profileName} · {v.speedLabel}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-black text-amber-300 tabular-nums shrink-0">
                      {v.price}{v.currency}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[9px] text-amber-200/65">
                        {lang === 'ar' ? 'اسم المستخدم' : 'USERNAME'}
                      </p>
                      <p className="font-mono text-sm font-black tracking-wider text-white truncate" dir="ltr">
                        {v.code}
                      </p>
                      <p className="font-mono text-[10px] text-amber-300 truncate" dir="ltr">
                        {lang === 'ar' ? 'كلمة المرور:' : 'PASS:'} {v.password}
                      </p>
                      <p className="mt-1 text-[10px] text-amber-200/85 truncate">
                        {v.durationLabel} · {v.dataQuotaGb > 0 ? `${v.dataQuotaGb} GB` : '∞'}
                      </p>
                    </div>
                    <VoucherQrSvg value={qrPayload} size={compactCard ? 46 : 54} darkColor="#141109" />
                  </div>
                  <div className="mt-1.5 border-t border-amber-400/20 pt-1 flex items-center justify-between text-[9px] text-amber-200/70">
                    <span>{lang === 'ar' ? 'الدعم الفني' : 'Support'}</span>
                    <span className="font-mono" dir="ltr">{supportPhone}</span>
                  </div>
                </div>
              );
            }

            if (template === 'classic') {
              return (
                <div
                  key={v.id}
                  className={`voucher-card-print rounded-xl border-2 border-dashed border-slate-700 bg-white ${
                    compactCard ? 'p-2.5' : 'p-3.5'
                  } text-slate-900 shadow`}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span className="truncate text-xs font-extrabold text-slate-900">{networkName}</span>
                    <span className="font-mono text-xs font-black text-slate-900 shrink-0">
                      {v.price}{v.currency}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-slate-500 truncate">{v.speedLabel}</p>
                      <p className="font-mono text-sm font-black text-slate-950 truncate" dir="ltr">
                        {v.code}
                      </p>
                      <p className="font-mono text-[10px] text-slate-700 truncate" dir="ltr">
                        PASS: {v.password}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-600 truncate">{v.durationLabel}</p>
                    </div>
                    <VoucherQrSvg value={qrPayload} size={compactCard ? 46 : 54} darkColor="#0f172a" />
                  </div>
                  <div className="mt-1.5 border-t border-slate-200 pt-1 flex items-center justify-between text-[9px] text-slate-500">
                    <span>{lang === 'ar' ? 'الدعم' : 'Support'}</span>
                    <span className="font-mono" dir="ltr">{supportPhone}</span>
                  </div>
                </div>
              );
            }

            // cyber_modern
            return (
              <div
                key={v.id}
                className={`voucher-card-print rounded-2xl border border-dashed border-cyan-400/60 bg-gradient-to-br from-[#07142B] via-[#050A18] to-[#061C2C] ${
                  compactCard ? 'p-2.5' : 'p-3.5'
                } text-white shadow-[0_0_20px_rgba(0,229,255,0.12)]`}
              >
                <div className="flex items-start justify-between gap-2 border-b border-cyan-500/25 pb-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-cyan-300">{networkName}</p>
                    <p className="text-[10px] text-emerald-300 font-mono truncate">
                      {v.profileName} · {v.speedLabel}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-black text-cyan-300 tabular-nums shrink-0">
                    {v.price}{v.currency}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] text-slate-400">
                      {lang === 'ar' ? 'المستخدم / الكود' : 'USER / VOUCHER'}
                    </p>
                    <p className="font-mono text-sm font-black tracking-wider text-white truncate" dir="ltr">
                      {v.code}
                    </p>
                    <p className="font-mono text-[10px] text-cyan-300 truncate" dir="ltr">
                      PASS: {v.password}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-300 truncate">
                      {v.durationLabel} · {v.dataQuotaGb > 0 ? `${v.dataQuotaGb}GB` : '∞'}
                    </p>
                  </div>
                  <VoucherQrSvg value={qrPayload} size={compactCard ? 46 : 54} darkColor="#050A18" />
                </div>
                <div className="mt-1.5 border-t border-cyan-500/20 pt-1 flex items-center justify-between text-[9px] text-slate-400">
                  <span>{lang === 'ar' ? 'الدعم الفني' : 'Support'}</span>
                  <span className="font-mono text-cyan-200/90" dir="ltr">{supportPhone}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
