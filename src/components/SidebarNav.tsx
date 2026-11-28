import React, { useEffect } from 'react';
import {
  Activity,
  Archive,
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Coins,
  Construction,
  Cpu,
  FlaskConical,
  Gauge,
  Globe,
  KeyRound,
  LayoutTemplate,
  Link2,
  Network,
  RadioTower,
  Route,
  SatelliteDish,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
  Ticket,
  Wand2,
  X,
} from 'lucide-react';
import { Language, ModuleId, SessionUser } from '../types/mikrocore';
import { useT } from '../i18n/translations';

interface SidebarNavProps {
  lang: Language;
  activeModule: ModuleId;
  onSelectModule: (id: ModuleId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  user: SessionUser;
}

interface NavItem {
  id: ModuleId;
  label: string;
  icon: React.ReactNode;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  lang,
  activeModule,
  onSelectModule,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  user,
}) => {
  const t = useT(lang);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const mikrotikItems: NavItem[] = [
    { id: 'noc', label: t.navNoc, icon: <Activity className="h-4 w-4 shrink-0" /> },
    { id: 'connection', label: t.navConnection, icon: <Server className="h-4 w-4 shrink-0" /> },
    { id: 'wizard', label: t.navWizard, icon: <Wand2 className="h-4 w-4 shrink-0" /> },
    { id: 'radius', label: t.navRadius, icon: <Ticket className="h-4 w-4 shrink-0" /> },
    { id: 'pcc_security', label: t.navPccSecurity, icon: <Network className="h-4 w-4 shrink-0" /> },
    { id: 'troubleshooter', label: t.navTroubleshooter, icon: <TerminalSquare className="h-4 w-4 shrink-0" /> },
    { id: 'portal', label: t.navPortal, icon: <LayoutTemplate className="h-4 w-4 shrink-0" /> },
    { id: 'finance', label: t.navFinance, icon: <Coins className="h-4 w-4 shrink-0" /> },
    { id: 'vault', label: t.navVault, icon: <Archive className="h-4 w-4 shrink-0" /> },
    { id: 'towers', label: t.navTowers, icon: <RadioTower className="h-4 w-4 shrink-0" /> },
    // 7 New Enterprise MikroTik Tabs
    { id: 'public_ip', label: t.navPublicIp, icon: <Globe className="h-4 w-4 shrink-0" /> },
    { id: 'vpn_l2tp', label: t.navVpnL2tp, icon: <KeyRound className="h-4 w-4 shrink-0" /> },
    { id: 'starlink_quota', label: t.navStarlinkQuota, icon: <SatelliteDish className="h-4 w-4 shrink-0" /> },
    { id: 'quota_guard', label: t.navQuotaGuard, icon: <Gauge className="h-4 w-4 shrink-0" /> },
    { id: 'loop_protect', label: t.navLoopProtect, icon: <ShieldAlert className="h-4 w-4 shrink-0" /> },
    { id: 'maintenance_mode', label: t.navMaintenanceMode, icon: <Construction className="h-4 w-4 shrink-0" /> },
    { id: 'daily_report', label: t.navDailyReport, icon: <BarChart3 className="h-4 w-4 shrink-0" /> },
  ];

  const ciscoItems: NavItem[] = [
    { id: 'cisco_vlans', label: t.navCiscoVlans, icon: <Cpu className="h-4 w-4 shrink-0" /> },
    { id: 'cisco_l2', label: t.navCiscoL2, icon: <ShieldCheck className="h-4 w-4 shrink-0" /> },
    { id: 'cisco_lacp', label: t.navCiscoLacp, icon: <Link2 className="h-4 w-4 shrink-0" /> },
    { id: 'cisco_routing', label: t.navCiscoRouting, icon: <Route className="h-4 w-4 shrink-0" /> },
    { id: 'cisco_qos', label: t.navCiscoQos, icon: <Activity className="h-4 w-4 shrink-0" /> },
  ];

  const systemItems: NavItem[] = [
    { id: 'sandbox', label: t.navSandbox, icon: <FlaskConical className="h-4 w-4 shrink-0" /> },
    { id: 'guide', label: t.navGuide, icon: <BookOpen className="h-4 w-4 shrink-0" /> },
  ];

  if (user.role === 'superadmin') {
    systemItems.push({
      id: 'admin',
      label: t.navAdmin,
      icon: <Shield className="h-4 w-4 shrink-0 text-amber-400" />,
    });
  }

  const handleSelect = (id: ModuleId) => {
    onSelectModule(id);
    onCloseMobile();
  };

  const closedTranslateClass = lang === 'ar' ? 'translate-x-full' : '-translate-x-full';

  const renderGroup = (header: string, items: NavItem[], accent: 'cyan' | 'emerald' | 'slate') => {
    const headerColor =
      accent === 'emerald'
        ? 'text-emerald-300 border-emerald-500/20'
        : accent === 'cyan'
        ? 'text-cyan-300 border-cyan-500/20'
        : 'text-slate-400 border-slate-800';

    return (
      <div className="space-y-1">
        {(!collapsed || mobileOpen) && (
          <div
            className={`px-3 pt-2.5 pb-1 text-[10px] font-extrabold tracking-wide border-b ${headerColor}`}
          >
            {header}
          </div>
        )}
        {items.map((item) => {
          const active =
            activeModule === item.id ||
            (activeModule === 'cisco' && item.id === 'cisco_vlans');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              title={item.label}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 lg:py-2 text-xs font-bold transition cursor-pointer ${
                active
                  ? accent === 'emerald'
                    ? 'border border-emerald-400/45 bg-emerald-500/18 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.14)]'
                    : 'border border-cyan-400/45 bg-cyan-500/18 text-cyan-100 shadow-[0_0_20px_rgba(0,229,255,0.12)]'
                  : 'border border-transparent text-slate-300 hover:border-cyan-500/20 hover:bg-slate-900/70 hover:text-white'
              } ${collapsed && !mobileOpen ? 'lg:justify-center lg:px-2' : ''}`}
            >
              <span
                className={
                  active
                    ? accent === 'emerald'
                      ? 'text-emerald-300'
                      : 'text-cyan-300'
                    : 'text-slate-400'
                }
              >
                {item.icon}
              </span>
              <span className={`truncate whitespace-nowrap ${collapsed && !mobileOpen ? 'lg:hidden' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          aria-hidden="true"
          className="no-print fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
        />
      )}

      <aside
        aria-label="Sidebar Navigation"
        className={`no-print fixed inset-y-0 start-0 z-50 flex flex-col border-e border-cyan-500/25 bg-[#060D20]/98 backdrop-blur-2xl shadow-2xl transition-all duration-300 ease-out w-72 max-w-[85vw] shrink-0 lg:static lg:z-auto lg:bg-[#060D20]/90 lg:shadow-none ${
          mobileOpen
            ? 'translate-x-0 pointer-events-auto'
            : `${closedTranslateClass} pointer-events-none lg:translate-x-0 lg:pointer-events-auto`
        } ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        <div className="flex items-center justify-between border-b border-cyan-500/15 px-4 py-3">
          {(!collapsed || mobileOpen) && (
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">{user.displayName}</p>
              <p className="truncate font-mono text-[10px] text-cyan-400/80" dir="ltr">
                {user.tenantUuid.slice(0, 14)}...
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden rounded-lg border border-slate-700/80 bg-slate-900/70 p-1.5 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-300 cursor-pointer"
            aria-label={lang === 'ar' ? 'إغلاق القائمة' : 'Close menu'}
          >
            <X className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:inline-flex rounded-lg border border-slate-700/80 bg-slate-900/70 p-1.5 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-300 cursor-pointer mx-auto"
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

        <nav className="flex-1 space-y-3 p-2.5 overflow-y-auto" aria-label="Primary Navigation">
          {renderGroup(t.navSectionMikroTik, mikrotikItems, 'cyan')}
          {renderGroup(t.navSectionCisco, ciscoItems, 'emerald')}
          {renderGroup(t.navSectionSystem, systemItems, 'slate')}
        </nav>

        <div
          className={`border-t border-cyan-500/15 p-3.5 text-[11px] text-slate-400 ${
            collapsed ? 'lg:hidden' : ''
          }`}
        >
          <p className="font-semibold text-slate-300">
            {lang === 'ar' ? 'الحد المسموح للراوترات' : 'Router Quota'}
          </p>
          <p className="mt-0.5 font-mono text-cyan-300 tabular-nums">
            {user.maxRouters} {lang === 'ar' ? 'أجهزة' : 'Devices'}
          </p>
        </div>
      </aside>
    </>
  );
};
