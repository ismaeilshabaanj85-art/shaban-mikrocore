import React, { useState } from 'react';
import {
  Activity,
  Download,
  Edit3,
  MessageCircle,
  Plus,
  Shield,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import {
  AuditLogEntry,
  CustomerAccount,
  Language,
  SubscriptionSettings,
} from '../types/mikrocore';
import { useT } from '../i18n/translations';
import { generateUUID, sanitizeInput, sha256Hex } from '../utils/security';
import {
  appendAuditLog,
  exportFullSystemBackup,
  importFullSystemBackup,
  loadAuditLogs,
  loadCustomers,
  loadSubscriptionSettings,
  saveCustomers,
  saveSubscriptionSettings,
} from '../utils/storage';

interface SuperAdminPanelProps {
  lang: Language;
}

export const SuperAdminPanel: React.FC<SuperAdminPanelProps> = ({ lang }) => {
  const t = useT(lang);
  const [customers, setCustomers] = useState<CustomerAccount[]>(() => loadCustomers());
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => loadAuditLogs());
  const [subSettings, setSubSettings] = useState<SubscriptionSettings>(() =>
    loadSubscriptionSettings()
  );
  const [subSavedMsg, setSubSavedMsg] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [maxRouters, setMaxRouters] = useState(5);
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [statusMsg, setStatusMsg] = useState('');

  const handleSaveSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = saveSubscriptionSettings(subSettings);
    setSubSettings(saved);
    setLogs(
      appendAuditLog({
        actor: 'ismaeil',
        tenantUuid: 'admin',
        action: 'SUBSCRIPTION_SETTINGS_UPDATED',
        severity: 'info',
        details: `Updated plan $${saved.monthlyPriceUsd}/mo · WhatsApp ${saved.whatsappNumber}`,
      })
    );
    setSubSavedMsg(
      lang === 'ar'
        ? 'تم تحديث إعدادات الاشتراك والواتساب وستظهر فوراً في شاشة الدخول.'
        : 'Subscription price & WhatsApp updated immediately for the Login Gate.'
    );
    setTimeout(() => setSubSavedMsg(''), 3500);
  };

  const resetForm = () => {
    setEditingId(null);
    setUsername('');
    setPassword('');
    setCustomerName('');
    setMaxRouters(5);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = sanitizeInput(username).toLowerCase();
    const cleanName = sanitizeInput(customerName);
    if (!cleanUser || !cleanName || (!editingId && !password)) {
      setStatusMsg(
        lang === 'ar'
          ? 'يرجى تعبئة اسم المستخدم واسم العميل وكلمة المرور.'
          : 'Please complete username, customer name, and password.'
      );
      return;
    }

    if (cleanUser === 'ismaeil') {
      setStatusMsg(
        lang === 'ar'
          ? 'اسم المستخدم محجوز للإدارة العليا.'
          : 'This username is reserved for Super Admin.'
      );
      return;
    }

    if (editingId) {
      const updated = await Promise.all(
        customers.map(async (c) => {
          if (c.id !== editingId) return c;
          const nextHash = password ? await sha256Hex(password) : c.passwordHash;
          return {
            ...c,
            username: cleanUser,
            customerName: cleanName,
            passwordHash: nextHash,
            maxRouters: Math.max(1, Math.min(500, Number(maxRouters) || 1)),
            expiryDate,
          };
        })
      );
      saveCustomers(updated);
      setCustomers(updated);
      setLogs(
        appendAuditLog({
          actor: 'ismaeil',
          tenantUuid: 'admin',
          action: 'CUSTOMER_UPDATED',
          severity: 'info',
          details: `Updated tenant account ${cleanUser}`,
        })
      );
      setStatusMsg(
        lang === 'ar' ? 'تم تحديث بيانات العميل بنجاح.' : 'Customer account updated.'
      );
      resetForm();
      return;
    }

    if (customers.some((c) => c.username.toLowerCase() === cleanUser)) {
      setStatusMsg(
        lang === 'ar' ? 'اسم المستخدم موجود مسبقاً.' : 'Username already exists.'
      );
      return;
    }

    const passwordHash = await sha256Hex(password);
    const newAccount: CustomerAccount = {
      id: generateUUID(),
      tenantUuid: generateUUID(),
      username: cleanUser,
      passwordHash,
      customerName: cleanName,
      maxRouters: Math.max(1, Math.min(500, Number(maxRouters) || 1)),
      expiryDate,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const nextList = [newAccount, ...customers];
    saveCustomers(nextList);
    setCustomers(nextList);
    setLogs(
      appendAuditLog({
        actor: 'ismaeil',
        tenantUuid: newAccount.tenantUuid,
        action: 'CUSTOMER_CREATED',
        severity: 'info',
        details: `Created tenant ${cleanName} (${cleanUser})`,
      })
    );
    setStatusMsg(
      lang === 'ar'
        ? `تم إنشاء حساب ${cleanName} بمعرّف عزل فريد.`
        : `Created tenant account ${cleanName} with isolated UUID.`
    );
    resetForm();
  };

  const toggleStatus = (account: CustomerAccount) => {
    const nextStatus: 'active' | 'suspended' =
      account.status === 'active' ? 'suspended' : 'active';
    const nextList = customers.map((c) =>
      c.id === account.id ? { ...c, status: nextStatus } : c
    );
    saveCustomers(nextList);
    setCustomers(nextList);
    setLogs(
      appendAuditLog({
        actor: 'ismaeil',
        tenantUuid: account.tenantUuid,
        action: nextStatus === 'active' ? 'CUSTOMER_ACTIVATED' : 'CUSTOMER_SUSPENDED',
        severity: nextStatus === 'active' ? 'info' : 'warning',
        details: `${account.username} -> ${nextStatus}`,
      })
    );
  };

  const deleteCustomer = (account: CustomerAccount) => {
    const nextList = customers.filter((c) => c.id !== account.id);
    saveCustomers(nextList);
    setCustomers(nextList);
    setLogs(
      appendAuditLog({
        actor: 'ismaeil',
        tenantUuid: account.tenantUuid,
        action: 'CUSTOMER_DELETED',
        severity: 'critical',
        details: `Removed tenant ${account.username}`,
      })
    );
  };

  const startEdit = (account: CustomerAccount) => {
    setEditingId(account.id);
    setUsername(account.username);
    setCustomerName(account.customerName);
    setMaxRouters(account.maxRouters);
    setExpiryDate(account.expiryDate);
    setPassword('');
  };

  const handleExportSystem = () => {
    const json = exportFullSystemBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MikroCore_SystemBackup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportSystem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = importFullSystemBackup(String(reader.result || ''));
      if (res.ok) {
        setCustomers(loadCustomers());
        setLogs(loadAuditLogs());
        setSubSettings(loadSubscriptionSettings());
        setStatusMsg(
          lang === 'ar'
            ? `تم استعادة ${res.count} حساب عميل بنجاح.`
            : `Restored ${res.count} customer accounts successfully.`
        );
      } else {
        setStatusMsg(
          lang === 'ar' ? 'ملف النسخة الاحتياطية غير صالح.' : 'Invalid backup JSON file.'
        );
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <Shield className="h-6 w-6 text-amber-400" />
            <span>
              {lang === 'ar'
                ? 'لوحة تحكم السوبر أدمن — إسماعيل شعبان'
                : 'Super Admin Control Panel — Ismaeil Shaban'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'إدارة حسابات العملاء، التشفير، أسعار الاشتراك، العزل متعدد المستأجرين، وسجلات الأمان.'
              : 'Manage tenant credentials, subscription pricing, multi-tenant isolation, and security audit logs.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportSystem}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/15 px-3.5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'تصدير نسخة النظام' : 'Export System JSON'}</span>
          </button>

          <label className="flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            <span>{lang === 'ar' ? 'استيراد نسخة' : 'Import JSON'}</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportSystem}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Subscription & Contact Settings */}
      <form onSubmit={handleSaveSubscription} className="noc-glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            <span>
              {lang === 'ar'
                ? 'إعدادات الاشتراك والتواصل'
                : 'Subscription & Contact Settings'}
            </span>
          </h3>
        </div>

        {subSavedMsg && (
          <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
            {subSavedMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">
              {lang === 'ar' ? 'سعر الاشتراك الشهري ($)' : 'Monthly Subscription Price (USD)'}
            </label>
            <input
              type="number"
              min={1}
              value={subSettings.monthlyPriceUsd}
              onChange={(e) =>
                setSubSettings({ ...subSettings, monthlyPriceUsd: Number(e.target.value) })
              }
              dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/90 px-3 py-2 font-mono text-xs text-white tabular-nums outline-none focus:border-emerald-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">
              {lang === 'ar' ? 'رقم واتساب للتفعيل (مع الرمز الدولي)' : 'WhatsApp Number (International)'}
            </label>
            <input
              type="text"
              value={subSettings.whatsappNumber}
              onChange={(e) =>
                setSubSettings({ ...subSettings, whatsappNumber: e.target.value })
              }
              dir="ltr"
              placeholder="963945597617"
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/90 px-3 py-2 font-mono text-xs text-white outline-none focus:border-emerald-400"
            />
          </div>

          <button
            type="submit"
            className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-300 cursor-pointer"
          >
            {lang === 'ar' ? 'حفظ إعدادات الاشتراك' : 'Save Subscription Settings'}
          </button>
        </div>
      </form>

      {/* Create / Edit Customer Form */}
      <div className="noc-glass rounded-2xl p-5">
        <h3 className="mb-4 text-sm font-bold text-cyan-300 flex items-center gap-2">
          <Plus className="h-4 w-4" />
          <span>
            {editingId
              ? lang === 'ar'
                ? 'تعديل بيانات العميل'
                : 'Edit Customer Account'
              : lang === 'ar'
              ? 'إنشاء حساب عميل جديد'
              : 'Create New Customer Account'}
          </span>
        </h3>

        {statusMsg && (
          <div className="mb-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-xs text-cyan-200">
            {statusMsg}
          </div>
        )}

        <form onSubmit={handleSaveCustomer} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">
              {lang === 'ar' ? 'اسم العميل / الشبكة' : 'Customer Name'}
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={lang === 'ar' ? 'شبكة النجم السريع' : 'Starlink Net'}
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/90 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">
              {t.username}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="client_net"
              dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/90 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">
              {t.password} {editingId ? (lang === 'ar' ? '(اختياري)' : '(optional)') : ''}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/90 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">
              {lang === 'ar' ? 'أقصى عدد راوترات' : 'Max Routers'}
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={maxRouters}
              onChange={(e) => setMaxRouters(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/90 px-3 py-2 text-xs text-white tabular-nums outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">
              {lang === 'ar' ? 'تاريخ انتهاء الاشتراك' : 'Expiry Date'}
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-[#050A18]/90 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 hover:brightness-110 cursor-pointer"
            >
              {editingId ? t.save : lang === 'ar' ? 'إضافة العميل' : 'Add Tenant'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                {t.cancel}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Customers Table */}
      <div className="noc-glass rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-cyan-500/20 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              {lang === 'ar' ? 'حسابات العملاء المسجلين' : 'Provisioned Customer Tenants'}
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {customers.length}
          </span>
        </div>

        {customers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            {lang === 'ar'
              ? 'لا توجد حسابات عملاء بعد. أنشئ أول حساب عميل من النموذج أعلاه.'
              : 'No customer accounts created yet. Use the form above to provision your first tenant.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold">
                    {lang === 'ar' ? 'العميل' : 'Customer'}
                  </th>
                  <th className="px-4 py-3 text-start font-semibold">{t.username}</th>
                  <th className="px-4 py-3 text-start font-semibold">Tenant UUID</th>
                  <th className="px-4 py-3 text-start font-semibold">
                    {lang === 'ar' ? 'الراوترات' : 'Routers'}
                  </th>
                  <th className="px-4 py-3 text-start font-semibold">
                    {lang === 'ar' ? 'الانتهاء' : 'Expiry'}
                  </th>
                  <th className="px-4 py-3 text-start font-semibold">
                    {lang === 'ar' ? 'الحالة' : 'Status'}
                  </th>
                  <th className="px-4 py-3 text-end font-semibold">
                    {lang === 'ar' ? 'إجراءات' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-cyan-500/5 transition">
                    <td className="px-4 py-3 font-semibold text-white">{c.customerName}</td>
                    <td className="px-4 py-3 font-mono text-cyan-300" dir="ltr">
                      {c.username}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400" dir="ltr">
                      {c.tenantUuid.slice(0, 13)}...
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-200">
                      {c.maxRouters}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-300" dir="ltr">
                      {c.expiryDate}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-bold ${
                          c.status === 'active' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {c.status === 'active'
                          ? lang === 'ar'
                            ? 'نشط'
                            : 'Active'
                          : lang === 'ar'
                          ? 'موقوف'
                          : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleStatus(c)}
                          className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-200 hover:border-cyan-500/40 cursor-pointer"
                          title={c.status === 'active' ? t.suspend : t.activate}
                          aria-label={`Toggle ${c.username}`}
                        >
                          {c.status === 'active' ? (
                            <UserX className="h-3.5 w-3.5 text-amber-400" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-cyan-300 hover:border-cyan-500/40 cursor-pointer"
                          title={t.edit}
                          aria-label={`Edit ${c.username}`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCustomer(c)}
                          className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                          title={t.delete}
                          aria-label={`Delete ${c.username}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Security Audit Logs */}
      <div className="noc-glass rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-cyan-500/20 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              {lang === 'ar' ? 'سجلات التدقيق الأمني' : 'System Security Audit Logs'}
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">{logs.length}</span>
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60">
          {logs.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500">
              {lang === 'ar' ? 'لا توجد سجلات بعد.' : 'No security events logged yet.'}
            </p>
          ) : (
            logs.slice(0, 40).map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`font-mono font-bold ${
                      log.severity === 'critical'
                        ? 'text-rose-400'
                        : log.severity === 'warning'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {log.action}
                  </span>
                  <span className="text-slate-300 truncate">{log.details}</span>
                </div>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums" dir="ltr">
                  {log.actor} · {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
