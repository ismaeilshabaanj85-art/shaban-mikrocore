import React from 'react';
import {
  Archive,
  Download,
  HardDriveDownload,
  Send,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import {
  AppMode,
  BackupVaultItem,
  Language,
  RouterProfile,
} from '../types/mikrocore';
import { useT } from '../i18n/translations';
import { generateUUID } from '../utils/security';

interface BackupVaultModalProps {
  open: boolean;
  onClose: () => void;
  lang: Language;
  mode: AppMode;
  activeRouter: RouterProfile;
  items: BackupVaultItem[];
  onAddItem: (item: BackupVaultItem) => void;
  onDeleteItem: (id: string) => void;
}

export const BackupVaultModal: React.FC<BackupVaultModalProps> = ({
  open,
  onClose,
  lang,
  mode,
  activeRouter,
  items,
  onAddItem,
  onDeleteItem,
}) => {
  const t = useT(lang);

  if (!open) return null;

  const triggerPullBackup = (type: 'rsc' | 'backup') => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name = `${activeRouter.name}_${stamp}.${type}`;
    const content =
      type === 'rsc'
        ? [
            `# Shaban MikroCore Snapshot Export (${activeRouter.osVersion.toUpperCase()})`,
            `# Router: ${activeRouter.name} (${activeRouter.host}) | Mode: ${mode.toUpperCase()}`,
            `# Timestamp: ${new Date().toISOString()}`,
            `/system identity set name="${activeRouter.name}"`,
            `/ip dns set allow-remote-requests=yes`,
            `/export terse`,
          ].join('\n')
        : `# Binary Backup Manifest (${activeRouter.name})\n# Run on RouterOS Terminal:\n/system backup save name=${name} dont-encrypt=yes\n/tool fetch address=... mode=ftp`;

    onAddItem({
      id: generateUUID(),
      name,
      type,
      createdAt: new Date().toISOString(),
      routerHost: activeRouter.host,
      sizeLabel: type === 'rsc' ? '14.2 KB' : '248 KB',
      content,
    });
  };

  const downloadItem = (item: BackupVaultItem) => {
    const blob = new Blob([item.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const shareWhatsApp = (item: BackupVaultItem) => {
    const preview = item.content.slice(0, 900);
    const text = encodeURIComponent(
      `Shaban MikroCore Backup: ${item.name}\nRouter: ${item.routerHost}\n\n${preview}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const shareTelegram = (item: BackupVaultItem) => {
    const text = encodeURIComponent(
      `Shaban MikroCore Backup: ${item.name} (${item.routerHost})\n\n${item.content.slice(0, 600)}`
    );
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent('https://mikrocore.local')}&text=${text}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="noc-glass flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-cyan-500/20 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Archive className="h-5 w-5 text-cyan-400" />
            <div>
              <h3 className="text-base font-bold text-white">{t.backupVault}</h3>
              <p className="text-xs text-slate-400">
                {activeRouter.name} · {activeRouter.host}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            aria-label={t.cancel}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => triggerPullBackup('rsc')}
              className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/15 px-4 py-3 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/25 cursor-pointer"
            >
              <HardDriveDownload className="h-4 w-4 text-cyan-300" />
              <span>
                {lang === 'ar'
                  ? 'سحب نسخة نصية (.rsc) للخزنة'
                  : 'Pull .rsc Config Snapshot'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => triggerPullBackup('backup')}
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-3 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/25 cursor-pointer"
            >
              <Archive className="h-4 w-4 text-emerald-300" />
              <span>
                {lang === 'ar'
                  ? 'إنشاء نسخة كاملة (.backup)'
                  : 'Create Binary .backup Task'}
              </span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center">
              <p className="text-sm text-slate-400">
                {lang === 'ar'
                  ? 'الخزنة فارغة حالياً. اضغط أحد الأزرار أعلاه لحفظ أول نسخة احتياطية.'
                  : 'Vault is empty. Pull a .rsc or .backup snapshot above to store it safely.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-cyan-500/15 bg-slate-950/60 p-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs font-semibold text-white">
                        {item.name}
                      </span>
                      <span className="text-[11px] font-mono text-cyan-400 uppercase">
                        {item.type}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                      {item.routerHost} · {item.sizeLabel} ·{' '}
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadItem(item)}
                      className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-200 hover:border-cyan-500/40 hover:text-cyan-300 cursor-pointer"
                      title={lang === 'ar' ? 'تحميل الملف' : 'Download File'}
                      aria-label={`Download ${item.name}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => shareWhatsApp(item)}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                      title={t.whatsappShare}
                      aria-label={`WhatsApp ${item.name}`}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => shareTelegram(item)}
                      className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2 text-cyan-300 hover:bg-cyan-500/20 cursor-pointer"
                      title={t.telegramShare}
                      aria-label={`Telegram ${item.name}`}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                      title={t.delete}
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
