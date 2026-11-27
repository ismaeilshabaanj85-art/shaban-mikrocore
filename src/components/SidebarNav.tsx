import React from 'react';
import {
  Activity,
  Archive,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Coins,
  Cpu,
  FlaskConical,
  LayoutTemplate,
  Network,
  RadioTower,
  Server,
  Shield,
  TerminalSquare,
  Ticket,
  Wand2,
} from 'lucide-react';
import { Language, ModuleId, SessionUser } from '../types/mikrocore';
import { useT } from '../i18n/translations';

interface SidebarNavProps {
  lang: Language;
  activeModule: ModuleId;
  onSelectModule: (id: ModuleId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  user: SessionUser;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  lang,
  activeModule,
  onSelectModule,
  collapsed,
  onToggleCollapse,
  user,
}) => {
  const t = useT(lang);

  const items: Array<{ id: ModuleId; label: string; shortLabel: string; icon: React.ReactNode }> = [
    {
      id: 'noc',
      label: t.navNoc,
      shortLabel: lang === 'ar' ? 'القيادة' : 'NOC',
      icon: <Activity className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'connection',
      label: t.navConnection,
      shortLabel: lang === 'ar' ? 'الربط' : 'Link',
      icon: <Server className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'wizard',
      label: t.navWizard,
      shortLabel: lang === 'ar' ? 'المعالج' : 'Setup',
      icon: <Wand2 className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'radius',
      label: t.navRadius,
      shortLabel: lang === 'ar' ? 'البطاقات' : 'RADIUS',
      icon: <Ticket className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'pcc_security',
      label: t.navPccSecurity,
      shortLabel: lang === 'ar' ? 'الحماية' : 'PCC',
      icon: <Network className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'cisco',
      label: t.navCisco,
      shortLabel: lang === 'ar' ? 'سيسكو' : 'Cisco',
      icon: <Cpu className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'troubleshooter',
      label: t.navTroubleshooter,
      shortLabel: lang === 'ar' ? 'التيرمينال' : 'Terminal',
      icon: <TerminalSquare className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'portal',
      label: t.navPortal,
      shortLabel: lang === 'ar' ? 'البوابة' : 'Portal',
      icon: <LayoutTemplate className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'finance',
      label: t.navFinance,
      shortLabel: lang === 'ar' ? 'المالية' : 'Finance',
      icon: <Coins className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'vault',
      label: t.navVault,
      shortLabel: lang === 'ar' ? 'الخزنة' : 'Vault',
      icon: <Archive className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'towers',
      label: t.navTowers,
      shortLabel: lang === 'ar' ? 'الأبراج' : 'Towers',
      icon: <RadioTower className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'sandbox',
      label: t.navSandbox,
      shortLabel: lang === 'ar' ? 'المحاكي' : 'Sandbox',
      icon: <FlaskConical className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'guide',
      label: t.navGuide,
      shortLabel: lang === 'ar' ? 'الدليل' : 'Guide',
      icon: <BookOpen className="h-4 w-4 shrink-0" />,
    },
  ];

  if (user.role === 'superadmin') {
    items.push({
      id: 'admin',
      label: t.navAdmin,
      shortLabel: lang === 'ar' ? 'الإدارة' : 'Admin',
      icon: <Shield className="h-4 w-4 shrink-0 text-amber-400" />,
    });
  }

  return (
    <>
      {/* Desktop Collapsible Sidebar (RTL right / LTR left) */}
      <aside
        className={`no-print hidden md:flex flex-col border-e border-cyan-500/20 bg-[#060D20]/90 backdrop-blur-xl transition-all duration-200 shrink-0 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="flex items-center justify-between border-b border-cyan-500/15 px-4 py-3">
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">{user.displayName}</p>
              <p className="truncate font-mono text-[10px] text-cyan-400/80" dir="ltr">
                {user.tenantUuid.slice(0, 14)}...
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-lg border border-slate-700/80 bg-slate-900/70 p-1.5 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-300 cursor-pointer mx-auto"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {lang === 'ar' ? (
              collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-2.5 overflow-y-auto" aria-label="Primary Navigation">
          {items.map((item) => {
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectModule(item.id)}
                title={item.label}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                  active
                    ? 'border border-cyan-400/45 bg-cyan-500/18 text-cyan-100 shadow-[0_0_20px_rgba(0,229,255,0.12)]'
                    : 'border border-transparent text-slate-300 hover:border-cyan-500/20 hover:bg-slate-900/70 hover:text-white'
                } ${collapsed ? 'justify-center px-2' : ''}`}
              >
                <span className={active ? 'text-cyan-300' : 'text-slate-400'}>{item.icon}</span>
                {!collapsed && <span className="truncate whitespace-nowrap">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="border-t border-cyan-500/15 p-3.5 text-[11px] text-slate-400">
            <p className="font-semibold text-slate-300">
              {lang === 'ar' ? 'الحد المسموح للراوترات' : 'Router Quota'}
            </p>
            <p className="mt-0.5 font-mono text-cyan-300 tabular-nums">
              {user.maxRouters} {lang === 'ar' ? 'أجهزة' : 'Devices'}
            </p>
          </div>
        )}
      </aside>

      {/* Mobile Floating Smart Bottom Navigation Bar (horizontally scrollable for all 14 modules) */}
      <nav
        aria-label="Mobile Navigation"
        className="no-print md:hidden fixed bottom-2 inset-x-2 z-40 rounded-2xl border border-cyan-500/30 bg-[#071026]/95 px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.65)] backdrop-blur-xl overflow-x-auto"
      >
        <div className="flex items-center gap-1 min-w-max">
          {items.map((item) => {
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectModule(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 px-2.5 text-[10px] font-bold transition cursor-pointer shrink-0 ${
                  active
                    ? 'bg-cyan-500/20 text-cyan-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.icon}
                <span className="whitespace-nowrap">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
