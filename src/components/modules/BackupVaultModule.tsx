import React, { useRef, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Database,
  Download,
  Eye,
  FileJson,
  HardDriveDownload,
  RotateCcw,
  Send,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AppMode,
  BackupVaultItem,
  Language,
  RouterProfile,
  SessionUser,
} from '../../types/mikrocore';
import { generateUUID } from '../../utils/security';
import {
  exportTenantDatabaseJson,
  importTenantDatabaseJson,
} from '../../utils/storage';
import { executeRouterOsV7Rest } from '../../engine/networkEngine';

interface BackupVaultModuleProps {
  lang: Language;
  mode: AppMode;
  user: SessionUser;
  activeRouter: RouterProfile;
  items: BackupVaultItem[];
  onAddItem: (item: BackupVaultItem) => void;
  onDeleteItem: (id: string) => void;
  onRestoreToSandbox: (script: string) => void;
  onReloadTenantData: () => void;
}

export const BackupVaultModule: React.FC<BackupVaultModuleProps> = ({
  lang,
  mode,
  user,
  activeRouter,
  items,
  onAddItem,
  onDeleteItem,
  onRestoreToSandbox,
  onReloadTenantData,
}) => {
  const [previewItem, setPreviewItem] = useState<BackupVaultItem | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createSnapshot = async (type: 'rsc' | 'backup') => {
    setBusy(true);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name = `${activeRouter.name}_${stamp}.${type}`;

    let content =
      type === 'rsc'
        ? [
            `# Shaban MikroCore Snapshot (${activeRouter.osVersion.toUpperCase()})`,
            `# Router: ${activeRouter.name} (${activeRouter.host}) | Mode: ${mode.toUpperCase()}`,
            `# Created: ${new Date().toISOString()}`,
            `/system identity set name="${activeRouter.name}"`,
            `/ip dns set allow-remote-requests=yes`,
            `/export terse`,
          ].join('\n')
        : `# Binary Backup Task (${activeRouter.name})\n/system backup save name="${name}" dont-encrypt=yes`;

    if (mode === 'live' && activeRouter.osVersion === 'v7' && type === 'rsc') {
      const res = await executeRouterOsV7Rest(activeRouter, '/system/resource', 'GET');
      if (res.ok) {
        content = `# Live REST Pull Verified from ${activeRouter.host}\n${content}\n# Resource JSON: ${JSON.stringify(res.data).slice(0, 300)}`;
      }
    }

    onAddItem({
      id: generateUUID(),
      name,
      type,
      createdAt: new Date().toISOString(),
      routerHost: activeRouter.host,
      sizeLabel: `${Math.max(0.6, content.length / 1024).toFixed(1)} KB`,
      content,
    });
    setStatusMsg({
      ok: true,
      text:
        lang === 'ar'
          ? `تم حفظ اللقطة ${name} في الخزنة المشفرة.`
          : `Saved snapshot ${name} to Backup Vault.`,
    });
    setBusy(false);
  };

  const downloadFile = (filename: string, content: string, mime = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestoreItem = async (item: BackupVaultItem) => {
    if (mode === 'sandbox') {
      onRestoreToSandbox(item.content);
      return;
    }

    if (activeRouter.osVersion === 'v7') {
      const res = await executeRouterOsV7Rest(activeRouter, '/system/script/add', 'POST', {
        name: `Restore_${Date.now()}`,
        source: item.content,
      });
      setStatusMsg({
        ok: res.ok,
        text: res.ok
          ? lang === 'ar'
            ? `تم رفع نسخة الاستعادة ${item.name} إلى الراوتر بنجاح.`
            : `Uploaded restore script ${item.name} to live router.`
          : lang === 'ar'
          ? `تعذر الرفع المباشر (${res.error || res.status}). استخدم التنزيل واللصق في Winbox.`
          : `Live push failed (${res.error || res.status}). Download & import in Winbox.`,
      });
    } else {
      downloadFile(item.name, item.content);
      setStatusMsg({
        ok: true,
        text:
          lang === 'ar'
            ? 'تم تنزيل ملف الاستعادة لـ RouterOS v6 — ارفعه في Winbox Files ثم نفذ /import.'
            : 'Downloaded RouterOS v6 restore file — upload to Winbox Files and run /import.',
      });
    }
  };

  const handleExportTenantJson = () => {
    const json = exportTenantDatabaseJson(user.tenantUuid);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`Shaban_MikroCore_DB_${user.username}_${stamp}.json`, json, 'application/json');
    setStatusMsg({
      ok: true,
      text:
        lang === 'ar'
          ? 'تم تصدير قاعدة بيانات حسابك المعزولة بالكامل بصيغة JSON.'
          : 'Exported full isolated tenant database as JSON.',
    });
  };

  const handleImportTenantJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importTenantDatabaseJson(user.tenantUuid, String(reader.result || ''));
      if (result.ok) {
        onReloadTenantData();
      }
      setStatusMsg({
        ok: result.ok,
        text: result.ok
          ? lang === 'ar'
            ? 'تم استيراد واستعادة قاعدة بيانات المنصة بنجاح!'
            : 'Tenant database JSON restored successfully!'
          : lang === 'ar'
          ? 'ملف JSON غير صالح للاستيراد.'
          : result.message,
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Archive className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'الخزنة والنسخ الاحتياطي وقابلية النقل'
                : 'Backup Vault & App Data Portability'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'أرشفة لقطات الراوتر (.rsc / .backup)، المشاركة عبر واتساب وتيليغرام، وتصدير/استيراد قاعدة البيانات الكاملة.'
              : 'Timestamped router snapshots (.rsc / .backup), instant WhatsApp/Telegram share, and full tenant JSON portability.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => createSnapshot('rsc')}
            className="flex items-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/15 px-3.5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer"
          >
            <HardDriveDownload className="h-4 w-4" />
            <span>{lang === 'ar' ? 'سحب لقطة .rsc' : 'New .rsc Snapshot'}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => createSnapshot('backup')}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
          >
            <Archive className="h-4 w-4" />
            <span>{lang === 'ar' ? 'لقطة كاملة .backup' : 'New .backup Task'}</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs ${
            statusMsg.ok
              ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-200'
              : 'border-rose-500/35 bg-rose-500/12 text-rose-200'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Tenant Full Database Portability Card */}
      <div className="noc-glass rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/15">
            <Database className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              {lang === 'ar'
                ? 'نقل ونسخ قاعدة بيانات التطبيق المعزولة (JSON)'
                : 'Isolated Tenant Database Portability (JSON)'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {lang === 'ar'
                ? 'يشمل الراوترات، البطاقات، الموزعين، السجلات المالية، الأبراج، المستودع، وصفحة الهوتسبوت.'
                : 'Includes routers, vouchers, resellers, financial ledger, towers, CPE inventory, and portal config.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportTenantJson}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:brightness-110 cursor-pointer"
          >
            <FileJson className="h-4 w-4" />
            <span>{lang === 'ar' ? 'تصدير قاعدة البيانات JSON' : 'Export App DB JSON'}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportTenantJson}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20 cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>{lang === 'ar' ? 'استيراد JSON' : 'Import DB JSON'}</span>
          </button>
        </div>
      </div>

      {/* Router Snapshots Table */}
      <div className="noc-glass rounded-2xl overflow-hidden">
        <div className="border-b border-cyan-500/20 px-5 py-3.5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            {lang === 'ar'
              ? `سجل النسخ الاحتياطية المحفوظة (${items.length})`
              : `Stored Router Snapshots (${items.length})`}
          </h3>
          <span className="text-[11px] font-mono text-slate-400" dir="ltr">
            {activeRouter.name} ({activeRouter.host})
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            {lang === 'ar'
              ? 'لا توجد نسخ احتياطية محفوظة بعد. اضغط على زر "سحب لقطة .rsc" أعلاه لإنشاء أول نسخة.'
              : 'No router snapshots saved yet. Click "New .rsc Snapshot" above to create one.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {items.map((item) => {
              const waHref = `https://wa.me/?text=${encodeURIComponent(
                `Shaban MikroCore Backup: ${item.name}\nRouter: ${item.routerHost}\n\n${item.content.slice(0, 750)}`
              )}`;
              const tgHref = `https://t.me/share/url?url=${encodeURIComponent(
                'https://mikrocore.local'
              )}&text=${encodeURIComponent(
                `Shaban MikroCore Backup: ${item.name} (${item.routerHost})`
              )}`;

              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-900/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs font-bold text-white">
                        {item.name}
                      </span>
                      <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-cyan-300">
                        {item.type}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
                      {item.routerHost} · {item.sizeLabel} ·{' '}
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-cyan-400 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>{lang === 'ar' ? 'معاينة' : 'View'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRestoreItem(item)}
                      className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/20 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{lang === 'ar' ? 'استعادة' : 'Restore'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadFile(item.name, item.content)}
                      className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-200 hover:border-cyan-400 hover:text-cyan-300 cursor-pointer"
                      aria-label={`Download ${item.name}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>

                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-1.5 text-emerald-300 hover:bg-emerald-500/20"
                      aria-label={`WhatsApp ${item.name}`}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </a>

                    <a
                      href={tgHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 p-1.5 text-cyan-300 hover:bg-cyan-500/20"
                      aria-label={`Telegram ${item.name}`}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      className="rounded-lg border border-rose-500/35 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewItem && (
        <div className="noc-glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-cyan-500/20 bg-slate-950/75 px-4 py-2.5">
            <span className="font-mono text-xs font-bold text-cyan-300">{previewItem.name}</span>
            <button
              type="button"
              onClick={() => setPreviewItem(null)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </button>
          </div>
          <pre dir="ltr" className="max-h-72 overflow-auto bg-[#030712] p-4 font-mono text-xs text-cyan-100">
            <code>{previewItem.content}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
