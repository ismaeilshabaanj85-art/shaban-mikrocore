import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Coins,
  Download,
  MessageCircle,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Store,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  AppMode,
  CurrencyCode,
  ExchangeRates,
  FinanceTransaction,
  Language,
  PppoeSubscriber,
  ResellerAccount,
  RouterProfile,
} from '../../types/mikrocore';
import {
  buildPppoeExpiryRedirectCommand,
  buildWhatsAppBillingUrl,
} from '../../engine/networkEngine';
import { cloudSendAndAwaitRouterCommand } from '../../utils/firebaseCloud';
import { generateUUID, sanitizeInput } from '../../utils/security';

interface FinancePosModuleProps {
  lang: Language;
  resellers: ResellerAccount[];
  onSaveResellers: (list: ResellerAccount[]) => void;
  transactions: FinanceTransaction[];
  onSaveTransactions: (list: FinanceTransaction[]) => void;
  rates: ExchangeRates;
  onSaveRates: (rates: ExchangeRates) => void;
  subscribers?: PppoeSubscriber[];
  onSaveSubscribers?: (list: PppoeSubscriber[]) => void;
  activeRouter?: RouterProfile;
  tenantUuid?: string;
  mode?: AppMode;
  networkTitle?: string;
}

export const FinancePosModule: React.FC<FinancePosModuleProps> = ({
  lang,
  resellers,
  onSaveResellers,
  transactions,
  onSaveTransactions,
  rates,
  onSaveRates,
  subscribers = [],
  onSaveSubscribers,
  activeRouter,
  tenantUuid,
  mode = 'sandbox',
  networkTitle = 'Shaban Fiber & Starlink',
}) => {
  const [tab, setTab] = useState<'pos' | 'pppoe_billing' | 'accounting'>('pos');
  const [resellerName, setResellerName] = useState('');
  const [resellerPhone, setResellerPhone] = useState('');
  const [resellerComm, setResellerComm] = useState(10);
  const [resellerLimit, setResellerLimit] = useState(150);

  // Batch sale to reseller
  const [selectedResellerId, setSelectedResellerId] = useState(resellers[0]?.id || '');
  const [cardsQty, setCardsQty] = useState(25);
  const [unitPriceUsd, setUnitPriceUsd] = useState(1);
  const [posAlert, setPosAlert] = useState<{ ok: boolean; text: string } | null>(null);

  // Payment log
  const [paymentUsd, setPaymentUsd] = useState(50);

  // Accounting TX form
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txCategory, setTxCategory] = useState('Starlink');
  const [txDesc, setTxDesc] = useState('');
  const [txAmount, setTxAmount] = useState(75);
  const [txCurrency, setTxCurrency] = useState<CurrencyCode>('USD');

  // PPPoE Home Billing form
  const [subName, setSubName] = useState('');
  const [subUser, setSubUser] = useState('');
  const [subPhone, setSubPhone] = useState('+9639');
  const [subFee, setSubFee] = useState(15);
  const [subSpeed, setSubSpeed] = useState('10M/4M');
  const [subExpiry, setSubExpiry] = useState(() =>
    new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10)
  );
  const [billingRedirectIp, setBillingRedirectIp] = useState('192.168.88.1');
  const [billingNotice, setBillingNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pushingSubId, setPushingSubId] = useState<string | null>(null);

  const toUsd = (amount: number, currency: CurrencyCode): number => {
    if (currency === 'USD') return amount;
    if (currency === 'SYP') return amount / Math.max(1, rates.SYP);
    return amount / Math.max(0.1, rates.TRY);
  };

  const handleAddReseller = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeInput(resellerName);
    if (!clean) return;
    const item: ResellerAccount = {
      id: generateUUID(),
      name: clean,
      phone: sanitizeInput(resellerPhone) || '-',
      commissionPercent: Math.max(0, Math.min(50, Number(resellerComm) || 0)),
      maxDebtUsd: Math.max(10, Number(resellerLimit) || 100),
      currentDebtUsd: 0,
      cardsSoldCount: 0,
      totalRevenueUsd: 0,
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...resellers];
    onSaveResellers(next);
    setSelectedResellerId(item.id);
    setResellerName('');
    setResellerPhone('');
  };

  const handleAssignCardsToReseller = () => {
    const r = resellers.find((x) => x.id === selectedResellerId);
    if (!r) return;
    const gross = cardsQty * unitPriceUsd;
    const netCost = Number((gross * (1 - r.commissionPercent / 100)).toFixed(2));
    const projectedDebt = r.currentDebtUsd + netCost;

    // Strict Credit / Debt Limit Enforcement
    if (projectedDebt > r.maxDebtUsd) {
      setPosAlert({
        ok: false,
        text:
          lang === 'ar'
            ? `تم حظر إصدار البطاقات! دين الموزع (${projectedDebt.toFixed(2)}$) يتجاوز الحد الأقصى المسموح (${r.maxDebtUsd}$).`
            : `Blocked! Projected debt ($${projectedDebt.toFixed(2)}) exceeds reseller max limit ($${r.maxDebtUsd}).`,
      });
      return;
    }

    const updatedResellers = resellers.map((item) =>
      item.id === r.id
        ? {
            ...item,
            currentDebtUsd: Number(projectedDebt.toFixed(2)),
            cardsSoldCount: item.cardsSoldCount + cardsQty,
            totalRevenueUsd: Number((item.totalRevenueUsd + netCost).toFixed(2)),
          }
        : item
    );
    onSaveResellers(updatedResellers);

    const newTx: FinanceTransaction = {
      id: generateUUID(),
      date: new Date().toISOString().slice(0, 10),
      type: 'income',
      category: 'POS Reseller',
      description: `${r.name} — ${cardsQty} cards`,
      amount: netCost,
      currency: 'USD',
      amountUsd: netCost,
      resellerId: r.id,
    };
    onSaveTransactions([newTx, ...transactions]);
    setPosAlert({
      ok: true,
      text:
        lang === 'ar'
          ? `تم تسليم ${cardsQty} بطاقة إلى ${r.name} بقيمة ${netCost}$ بنجاح.`
          : `Assigned ${cardsQty} cards to ${r.name} ($${netCost} net after commission).`,
    });
  };

  const handleLogResellerPayment = () => {
    const r = resellers.find((x) => x.id === selectedResellerId);
    if (!r || paymentUsd <= 0) return;
    const paid = Math.min(r.currentDebtUsd, Number(paymentUsd));
    const updatedResellers = resellers.map((item) =>
      item.id === r.id
        ? { ...item, currentDebtUsd: Number(Math.max(0, item.currentDebtUsd - paid).toFixed(2)) }
        : item
    );
    onSaveResellers(updatedResellers);
    onSaveTransactions([
      {
        id: generateUUID(),
        date: new Date().toISOString().slice(0, 10),
        type: 'payment',
        category: 'Reseller Payment',
        description: `دفعة مالية من ${r.name}`,
        amount: paid,
        currency: 'USD',
        amountUsd: paid,
        resellerId: r.id,
      },
      ...transactions,
    ]);
    setPosAlert({
      ok: true,
      text:
        lang === 'ar'
          ? `تم تسجيل دفعة ${paid}$ من ${r.name}.`
          : `Logged $${paid} payment from ${r.name}.`,
    });
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const usd = Number(toUsd(Number(txAmount) || 0, txCurrency).toFixed(2));
    const tx: FinanceTransaction = {
      id: generateUUID(),
      date: new Date().toISOString().slice(0, 10),
      type: txType,
      category: sanitizeInput(txCategory) || 'General',
      description: sanitizeInput(txDesc) || txCategory,
      amount: Number(txAmount) || 0,
      currency: txCurrency,
      amountUsd: usd,
    };
    onSaveTransactions([tx, ...transactions]);
    setTxDesc('');
  };

  const summary = useMemo(() => {
    const revenue = transactions
      .filter((t) => t.type === 'income')
      .reduce((acc, t) => acc + t.amountUsd, 0);
    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => acc + t.amountUsd, 0);
    const profit = revenue - expenses;
    return {
      revenue: Number(revenue.toFixed(2)),
      expenses: Number(expenses.toFixed(2)),
      profit: Number(profit.toFixed(2)),
    };
  }, [transactions]);

  const handleExportCsv = () => {
    const header = 'Date,Type,Category,Description,Amount,Currency,USD Equivalent\n';
    const rows = transactions
      .map(
        (t) =>
          `${t.date},${t.type},${t.category},"${t.description.replace(/"/g, '""')}",${t.amount},${t.currency},${t.amountUsd}`
      )
      .join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MikroCore_Finance_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const maxBar = Math.max(100, summary.revenue, summary.expenses, Math.abs(summary.profit));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Coins className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'النظام المالي متعدد العملات والموزعون (POS)'
                : 'Multi-Currency Finance & POS System'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'إدارة الموزعين وسقف الدين، العملات الثلاث (USD · SYP · TRY)، وتصدير Excel/CSV وPDF.'
              : 'POS reseller debt limits, USD/SYP/TRY multi-currency accounting, and Excel/CSV & PDF reports.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-cyan-500/25 bg-[#0B142B] p-1">
          <button
            type="button"
            onClick={() => setTab('pos')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold cursor-pointer ${
              tab === 'pos' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'
            }`}
          >
            <Store className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'نقاط البيع والموزعون' : 'POS & Resellers'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('pppoe_billing')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold cursor-pointer ${
              tab === 'pppoe_billing' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'
            }`}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            <span>
              {lang === 'ar'
                ? 'فوترة المنزلي PPPoE وتنبيهات واتساب'
                : 'PPPoE Home Billing & WhatsApp'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('accounting')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold cursor-pointer ${
              tab === 'accounting' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'المحاسبة والعملات' : 'Multi-Currency Ledger'}</span>
          </button>
        </div>
      </div>

      {/* Multi-Currency KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="noc-glass rounded-2xl p-4">
          <p className="text-xs text-slate-400">{lang === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}</p>
          <p dir="ltr" className="mt-1 font-mono text-2xl font-extrabold text-emerald-300 tabular-nums text-start">
            ${summary.revenue.toLocaleString()}
          </p>
          <p dir="ltr" className="mt-1 font-mono text-[11px] text-slate-400 tabular-nums text-start">
            {Math.round(summary.revenue * rates.SYP).toLocaleString()} SYP ·{' '}
            {Math.round(summary.revenue * rates.TRY).toLocaleString()} TRY
          </p>
        </div>

        <div className="noc-glass rounded-2xl p-4">
          <p className="text-xs text-slate-400">{lang === 'ar' ? 'المصاريف التشغيلية' : 'Operating Expenses'}</p>
          <p dir="ltr" className="mt-1 font-mono text-2xl font-extrabold text-rose-300 tabular-nums text-start">
            ${summary.expenses.toLocaleString()}
          </p>
          <p dir="ltr" className="mt-1 font-mono text-[11px] text-slate-400 tabular-nums text-start">
            {Math.round(summary.expenses * rates.SYP).toLocaleString()} SYP ·{' '}
            {Math.round(summary.expenses * rates.TRY).toLocaleString()} TRY
          </p>
        </div>

        <div className="noc-glass rounded-2xl p-4">
          <p className="text-xs text-slate-400">{lang === 'ar' ? 'صافي الربح' : 'Net Profit'}</p>
          <p dir="ltr" className="mt-1 font-mono text-2xl font-extrabold text-cyan-300 tabular-nums text-start">
            ${summary.profit.toLocaleString()}
          </p>
          <p dir="ltr" className="mt-1 font-mono text-[11px] text-slate-400 tabular-nums text-start">
            {Math.round(summary.profit * rates.SYP).toLocaleString()} SYP ·{' '}
            {Math.round(summary.profit * rates.TRY).toLocaleString()} TRY
          </p>
        </div>
      </div>

      {tab === 'pos' && (
        <div className="space-y-5">
          {/* Assign Cards & Log Payment */}
          <div className="noc-glass rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-cyan-300">
                {lang === 'ar'
                  ? 'صرف بطاقات للموزع أو تسجيل دفعة (مع حظر تجاوز سقف الدين)'
                  : 'Assign Voucher Batch / Log Payment (Credit Limit Guard)'}
              </h3>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-cyan-400 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-cyan-400" />
                <span>{lang === 'ar' ? 'طباعة كشف حساب (PDF)' : 'Print PDF Statement'}</span>
              </button>
            </div>

            {posAlert && (
              <div
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold ${
                  posAlert.ok
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                    : 'border-rose-500/45 bg-rose-500/15 text-rose-200'
                }`}
              >
                {!posAlert.ok && <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />}
                <span>{posAlert.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'اختر الموزع / البقالة' : 'Select Reseller'}
                </label>
                <select
                  value={selectedResellerId}
                  onChange={(e) => setSelectedResellerId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 text-xs text-white"
                >
                  {resellers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (${r.currentDebtUsd}/${r.maxDebtUsd})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'عدد البطاقات' : 'Cards Qty'}
                </label>
                <input
                  type="number"
                  min={1}
                  value={cardsQty}
                  onChange={(e) => setCardsQty(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'سعر البطاقة ($)' : 'Unit Price ($)'}
                </label>
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={unitPriceUsd}
                  onChange={(e) => setUnitPriceUsd(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>
              <button
                type="button"
                onClick={handleAssignCardsToReseller}
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 cursor-pointer"
              >
                {lang === 'ar' ? 'توريد البطاقات' : 'Issue Batch'}
              </button>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={1}
                  value={paymentUsd}
                  onChange={(e) => setPaymentUsd(Number(e.target.value))}
                  className="w-20 rounded-xl border border-slate-700 bg-[#050A18] px-2.5 py-2 font-mono text-xs text-white tabular-nums"
                />
                <button
                  type="button"
                  onClick={handleLogResellerPayment}
                  className="flex-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 cursor-pointer"
                >
                  {lang === 'ar' ? 'تسديد ($)' : 'Pay ($)'}
                </button>
              </div>
            </div>
          </div>

          {/* Add New Reseller */}
          <form onSubmit={handleAddReseller} className="noc-glass rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'اسم الموزع الجديد' : 'New Reseller Name'}
              </label>
              <input
                type="text"
                value={resellerName}
                onChange={(e) => setResellerName(e.target.value)}
                placeholder={lang === 'ar' ? 'متجر السلام' : 'Al-Salam Store'}
                className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'رقم الهاتف' : 'Phone'}
              </label>
              <input
                type="text"
                value={resellerPhone}
                onChange={(e) => setResellerPhone(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'العمولة (%)' : 'Commission (%)'}
              </label>
              <input
                type="number"
                value={resellerComm}
                onChange={(e) => setResellerComm(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                {lang === 'ar' ? 'سقف الدين الأقصى ($)' : 'Max Debt Limit ($)'}
              </label>
              <input
                type="number"
                value={resellerLimit}
                onChange={(e) => setResellerLimit(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white tabular-nums"
              />
            </div>
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-xs font-bold text-cyan-200 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{lang === 'ar' ? 'إضافة موزع' : 'Add Reseller'}</span>
            </button>
          </form>

          {/* Resellers Table */}
          <div className="print-only-container noc-glass rounded-2xl overflow-hidden">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/70 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-start">{lang === 'ar' ? 'الموزع' : 'Reseller'}</th>
                  <th className="px-4 py-3 text-start">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                  <th className="px-4 py-3 text-start">{lang === 'ar' ? 'العمولة' : 'Comm.'}</th>
                  <th className="px-4 py-3 text-start">{lang === 'ar' ? 'البطاقات' : 'Cards'}</th>
                  <th className="px-4 py-3 text-start">{lang === 'ar' ? 'الدين الحالي / السقف' : 'Debt / Limit'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {resellers.map((r) => {
                  const nearMax = r.currentDebtUsd >= r.maxDebtUsd * 0.9;
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-bold text-white">{r.name}</td>
                      <td className="px-4 py-3 font-mono text-slate-300" dir="ltr">{r.phone}</td>
                      <td className="px-4 py-3 font-mono text-cyan-300 tabular-nums">{r.commissionPercent}%</td>
                      <td className="px-4 py-3 font-mono text-slate-200 tabular-nums">{r.cardsSoldCount}</td>
                      <td className="px-4 py-3 font-mono tabular-nums" dir="ltr">
                        <span className={nearMax ? 'text-rose-400 font-bold' : 'text-emerald-300'}>
                          ${r.currentDebtUsd}
                        </span>{' '}
                        / ${r.maxDebtUsd}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'accounting' && (
        <div className="space-y-5">
          {/* Custom Exchange Rates + CSV Export */}
          <div className="noc-glass rounded-2xl p-5 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'سعر صرف 1$ بالليرة السورية (SYP)' : '1 USD = SYP'}
                </label>
                <input
                  type="number"
                  value={rates.SYP}
                  onChange={(e) => onSaveRates({ ...rates, SYP: Number(e.target.value) || 1 })}
                  className="w-36 rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-cyan-300 tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'سعر صرف 1$ بالليرة التركية (TRY)' : '1 USD = TRY'}
                </label>
                <input
                  type="number"
                  step={0.1}
                  value={rates.TRY}
                  onChange={(e) => onSaveRates({ ...rates, TRY: Number(e.target.value) || 1 })}
                  className="w-36 rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-emerald-300 tabular-nums"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{lang === 'ar' ? 'تصدير Excel / CSV' : 'Export Excel / CSV'}</span>
            </button>
          </div>

          {/* Profit SVG Bar Chart */}
          <div className="noc-glass rounded-2xl p-5">
            <h3 className="mb-3 text-xs font-bold text-slate-300">
              {lang === 'ar' ? 'ملخص الإيرادات والمصاريف (USD)' : 'Revenue vs Expenses Summary (USD)'}
            </h3>
            <div className="space-y-3">
              {[
                { label: lang === 'ar' ? 'الإيرادات' : 'Revenue', val: summary.revenue, color: 'bg-emerald-400' },
                { label: lang === 'ar' ? 'المصاريف' : 'Expenses', val: summary.expenses, color: 'bg-rose-400' },
                { label: lang === 'ar' ? 'صافي الربح' : 'Net Profit', val: Math.max(0, summary.profit), color: 'bg-cyan-400' },
              ].map((b) => (
                <div key={b.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">{b.label}</span>
                    <span className="font-mono font-bold text-white tabular-nums" dir="ltr">
                      ${b.val.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${b.color}`}
                      style={{ width: `${Math.min(100, (b.val / maxBar) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Log Transaction */}
          <form onSubmit={handleAddTransaction} className="noc-glass rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
            <select
              value={txType}
              onChange={(e) => setTxType(e.target.value as 'income' | 'expense')}
              className="rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 text-xs text-white"
            >
              <option value="expense">{lang === 'ar' ? 'مصروف تشغيلي' : 'Expense'}</option>
              <option value="income">{lang === 'ar' ? 'إيراد مباشر' : 'Income'}</option>
            </select>
            <input
              type="text"
              value={txCategory}
              onChange={(e) => setTxCategory(e.target.value)}
              placeholder="Starlink / Fiber / Tower"
              className="rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              value={txDesc}
              onChange={(e) => setTxDesc(e.target.value)}
              placeholder={lang === 'ar' ? 'البيان / الوصف' : 'Description'}
              className="sm:col-span-2 rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 text-xs text-white"
            />
            <div className="flex gap-1.5">
              <input
                type="number"
                value={txAmount}
                onChange={(e) => setTxAmount(Number(e.target.value))}
                className="w-24 rounded-xl border border-slate-700 bg-[#050A18] px-2.5 py-2 font-mono text-xs text-white tabular-nums"
              />
              <select
                value={txCurrency}
                onChange={(e) => setTxCurrency(e.target.value as CurrencyCode)}
                className="rounded-xl border border-slate-700 bg-[#050A18] px-2 py-2 font-mono text-xs text-cyan-300"
              >
                <option value="USD">USD</option>
                <option value="SYP">SYP</option>
                <option value="TRY">TRY</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 cursor-pointer"
            >
              {lang === 'ar' ? 'تسجيل القيد' : 'Record Entry'}
            </button>
          </form>

          {/* Transactions Table */}
          <div className="noc-glass rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-start text-xs">
              <thead className="sticky top-0 bg-slate-950/90 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                  <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                  <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'البيان' : 'Description'}</th>
                  <th className="px-4 py-2.5 text-end">{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                  <th className="px-4 py-2.5 text-end">{lang === 'ar' ? 'المعادل ($)' : 'USD'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-2 font-mono text-slate-400 tabular-nums" dir="ltr">{tx.date}</td>
                    <td className={`px-4 py-2 font-bold ${tx.type === 'expense' ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {tx.category}
                    </td>
                    <td className="px-4 py-2 text-slate-200">{tx.description}</td>
                    <td className="px-4 py-2 text-end font-mono tabular-nums text-white" dir="ltr">
                      {tx.amount.toLocaleString()} {tx.currency}
                    </td>
                    <td className="px-4 py-2 text-end font-mono tabular-nums text-cyan-300" dir="ltr">
                      ${tx.amountUsd}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === 'pppoe_billing' && (
        <div className="space-y-5">
          <div className="noc-glass rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  <span>
                    {lang === 'ar'
                      ? 'إدارة اشتراكات المنزلي PPPoE والتذكير بضغطة زر عبر واتساب'
                      : 'PPPoE Home Subscribers & 1-Click WhatsApp Renewal Reminder'}
                  </span>
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {lang === 'ar'
                    ? 'سجّل المشتركين المنزليين وأرسل رسالة تجديد جاهزة عبر واتساب أو ادفع قاعدة تحويل صفحة التذكير على الراوتر.'
                    : 'Track home PPPoE subscribers, launch pre-filled Arabic WhatsApp reminders, and push billing expiry redirect rules.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">
                  {lang === 'ar' ? 'IP صفحة التذكير:' : 'Expiry Redirect IP:'}
                </span>
                <input
                  type="text"
                  value={billingRedirectIp}
                  onChange={(e) => setBillingRedirectIp(e.target.value)}
                  dir="ltr"
                  className="w-32 rounded-xl border border-slate-700 bg-[#050A18] px-2.5 py-1.5 font-mono text-xs text-cyan-200"
                />
              </div>
            </div>

            {billingNotice && (
              <div
                className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${
                  billingNotice.ok
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                    : 'border-rose-500/40 bg-rose-500/15 text-rose-200'
                }`}
              >
                {billingNotice.text}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!onSaveSubscribers) return;
                const cleanName = sanitizeInput(subName);
                const cleanUser = sanitizeInput(subUser) || cleanName.replace(/\s+/g, '_').toLowerCase();
                if (!cleanName || !cleanUser) return;
                const created: PppoeSubscriber = {
                  id: generateUUID(),
                  clientName: cleanName,
                  pppoeUsername: cleanUser,
                  phone: sanitizeInput(subPhone) || '+963900000000',
                  monthlyFeeUsd: Math.max(1, Number(subFee) || 10),
                  expiryDate: subExpiry,
                  speedLabel: sanitizeInput(subSpeed) || '10M/4M',
                  createdAt: new Date().toISOString(),
                };
                onSaveSubscribers([created, ...subscribers]);
                setSubName('');
                setSubUser('');
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
            >
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'اسم المشترك' : 'Client Name'}
                </label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder={lang === 'ar' ? 'أحمد السعيد' : 'Ahmad Al-Saeed'}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'حساب PPPoE' : 'PPPoE Username'}
                </label>
                <input
                  type="text"
                  value={subUser}
                  onChange={(e) => setSubUser(e.target.value)}
                  placeholder="ppp_ahmad"
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'رقم الواتساب' : 'WhatsApp Phone'}
                </label>
                <input
                  type="text"
                  required
                  value={subPhone}
                  onChange={(e) => setSubPhone(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'الاشتراك الشهري ($)' : 'Monthly Fee ($)'}
                </label>
                <input
                  type="number"
                  min={1}
                  value={subFee}
                  onChange={(e) => setSubFee(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  {lang === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}
                </label>
                <input
                  type="date"
                  value={subExpiry}
                  onChange={(e) => setSubExpiry(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-700 bg-[#050A18] px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-xs font-extrabold text-slate-950 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{lang === 'ar' ? 'إضافة مشترك' : 'Add Client'}</span>
              </button>
            </form>
          </div>

          <div className="noc-glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/75 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-start">{lang === 'ar' ? 'المشترك' : 'Subscriber'}</th>
                    <th className="px-4 py-3 text-start">PPPoE</th>
                    <th className="px-4 py-3 text-start">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                    <th className="px-4 py-3 text-start">{lang === 'ar' ? 'الاشتراك' : 'Fee'}</th>
                    <th className="px-4 py-3 text-start">{lang === 'ar' ? 'تاريخ الانتهاء' : 'Expiry'}</th>
                    <th className="px-4 py-3 text-end">{lang === 'ar' ? 'إجراءات فورية' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {subscribers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        {lang === 'ar'
                          ? 'لا يوجد مشتركون منزليون بعد.'
                          : 'No home PPPoE subscribers added yet.'}
                      </td>
                    </tr>
                  ) : (
                    subscribers.map((sub) => {
                      const daysLeft = Math.ceil(
                        (new Date(sub.expiryDate).getTime() - Date.now()) / 86400_000
                      );
                      const statusBadge =
                        daysLeft < 0
                          ? {
                              label: lang === 'ar' ? 'منتهي' : 'Expired',
                              cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
                            }
                          : daysLeft <= 3
                          ? {
                              label: lang === 'ar' ? 'ينتهي قريباً' : 'Expiring Soon',
                              cls: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
                            }
                          : {
                              label: lang === 'ar' ? 'نشط' : 'Active',
                              cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                            };
                      const waUrl = buildWhatsAppBillingUrl(sub, networkTitle);
                      return (
                        <tr key={sub.id} className="hover:bg-slate-900/45">
                          <td className="px-4 py-3 font-bold text-white">
                            {sub.clientName}
                            <p className="font-mono text-[10px] text-cyan-300">{sub.speedLabel}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-200" dir="ltr">
                            {sub.pppoeUsername}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-300" dir="ltr">
                            {sub.phone}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-emerald-300 tabular-nums" dir="ltr">
                            ${sub.monthlyFeeUsd}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-200 tabular-nums" dir="ltr">
                                {sub.expiryDate}
                              </span>
                              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusBadge.cls}`}>
                                {statusBadge.label}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/30"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                <span>{lang === 'ar' ? 'تذكير واتساب 💬' : 'WhatsApp 💬'}</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!onSaveSubscribers) return;
                                  const base = Math.max(Date.now(), new Date(sub.expiryDate).getTime());
                                  const nextExpiry = new Date(base + 30 * 86400_000)
                                    .toISOString()
                                    .slice(0, 10);
                                  onSaveSubscribers(
                                    subscribers.map((s) =>
                                      s.id === sub.id ? { ...s, expiryDate: nextExpiry } : s
                                    )
                                  );
                                  onSaveTransactions([
                                    {
                                      id: generateUUID(),
                                      date: new Date().toISOString().slice(0, 10),
                                      type: 'income',
                                      category: 'PPPoE Home',
                                      description: `${sub.clientName} (${sub.pppoeUsername}) +30d`,
                                      amount: sub.monthlyFeeUsd,
                                      currency: 'USD',
                                      amountUsd: sub.monthlyFeeUsd,
                                    },
                                    ...transactions,
                                  ]);
                                  setBillingNotice({
                                    ok: true,
                                    text:
                                      lang === 'ar'
                                        ? `تم تجديد اشتراك ${sub.clientName} لمدة 30 يوماً حتى ${nextExpiry} وتسجيل الإيراد.`
                                        : `Renewed ${sub.clientName} for 30 days until ${nextExpiry} and logged revenue.`,
                                  });
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1.5 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer"
                              >
                                <RefreshCw className="h-3 w-3" />
                                <span>+30d</span>
                              </button>
                              <button
                                type="button"
                                disabled={pushingSubId === sub.id}
                                onClick={async () => {
                                  const cmd = buildPppoeExpiryRedirectCommand(
                                    sub.pppoeUsername,
                                    billingRedirectIp,
                                    activeRouter?.osVersion || 'v7'
                                  );
                                  if (mode !== 'live' || !tenantUuid || !activeRouter) {
                                    setBillingNotice({
                                      ok: true,
                                      text:
                                        lang === 'ar'
                                          ? `تم تجهيز قاعدة تحويل صفحة انتهاء الاشتراك للمشترك ${sub.pppoeUsername} (${cmd.split('\n')[1]}).`
                                          : `Prepared PPPoE expiry redirect command for ${sub.pppoeUsername}.`,
                                    });
                                    return;
                                  }
                                  setPushingSubId(sub.id);
                                  const res = await cloudSendAndAwaitRouterCommand(
                                    tenantUuid,
                                    activeRouter.id,
                                    cmd
                                  );
                                  setPushingSubId(null);
                                  setBillingNotice({
                                    ok: res.ok,
                                    text: res.ok
                                      ? lang === 'ar'
                                        ? `تم تطبيق قاعدة تحويل انتهاء الاشتراك على الراوتر لحساب ${sub.pppoeUsername}! ✅`
                                        : `Expiry redirect rule pushed for ${sub.pppoeUsername}! ✅`
                                      : res.error || 'Push failed',
                                  });
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-400/45 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25 disabled:opacity-50 cursor-pointer"
                              >
                                <Play className="h-3 w-3" />
                                <span>
                                  {lang === 'ar' ? 'تحويل الانتهاء 🚀' : 'Expiry Redirect 🚀'}
                                </span>
                              </button>
                              {onSaveSubscribers && (
                                <button
                                  type="button"
                                  aria-label="Delete Subscriber"
                                  onClick={() =>
                                    onSaveSubscribers(subscribers.filter((s) => s.id !== sub.id))
                                  }
                                  className="rounded-lg p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
