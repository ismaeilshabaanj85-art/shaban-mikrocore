import { useCallback, useEffect, useState } from 'react';
import {
  AppMode,
  BackupVaultItem,
  CaptivePortalConfig,
  CpeDevice,
  ExchangeRates,
  FinanceTransaction,
  GeneratedVoucher,
  Language,
  ModuleId,
  ResellerAccount,
  RouterProfile,
  SandboxState,
  SessionUser,
  SpeedProfile,
  TelegramBotConfig,
  TowerNode,
} from './types/mikrocore';
import { generateUUID } from './utils/security';
import {
  getDefaultPortalConfig,
  getDefaultSandboxRouter,
  loadSession,
  loadTenantCpes,
  loadTenantCustomProfiles,
  loadTenantPortal,
  loadTenantRates,
  loadTenantResellers,
  loadTenantRouters,
  loadTenantTelegram,
  loadTenantTowers,
  loadTenantTransactions,
  loadTenantVault,
  loadTenantVouchers,
  saveSession,
  saveTenantCpes,
  saveTenantCustomProfiles,
  saveTenantPortal,
  saveTenantRates,
  saveTenantResellers,
  saveTenantRouters,
  saveTenantTelegram,
  saveTenantTowers,
  saveTenantTransactions,
  saveTenantVault,
  saveTenantVouchers,
} from './utils/storage';
import { createInitialSandboxState } from './engine/sandboxEngine';
import { LoginGate } from './components/LoginGate';
import { TopBar } from './components/TopBar';
import { SidebarNav } from './components/SidebarNav';
import { BackupVaultModal } from './components/BackupVaultModal';
import { OfflineIndicator } from './components/PWAStatus';
import { SuperAdminPanel } from './components/SuperAdminPanel';
import { FloatingAssistant } from './components/FloatingAssistant';
import { ServerConnectionModule } from './components/modules/ServerConnectionModule';
import { LiveNocDashboard } from './components/modules/LiveNocDashboard';
import { ZeroTouchWizardModule } from './components/modules/ZeroTouchWizardModule';
import { RadiusVouchersModule } from './components/modules/RadiusVouchersModule';
import { PccStarlinkSecurityModule } from './components/modules/PccStarlinkSecurityModule';
import { CiscoProModule } from './components/modules/CiscoProModule';
import { TroubleshooterTerminalModule } from './components/modules/TroubleshooterTerminalModule';
import { CaptivePortalModule } from './components/modules/CaptivePortalModule';
import { FinancePosModule } from './components/modules/FinancePosModule';
import { BackupVaultModule } from './components/modules/BackupVaultModule';
import { TowersAutomationModule } from './components/modules/TowersAutomationModule';
import { UserGuideModule } from './components/modules/UserGuideModule';
import { SandboxSimulatorModule } from './components/modules/SandboxSimulatorModule';

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [mode, setMode] = useState<AppMode>('sandbox');
  const [user, setUser] = useState<SessionUser | null>(() => loadSession());
  const [activeModule, setActiveModule] = useState<ModuleId>(() => {
    const existing = loadSession();
    return existing?.role === 'superadmin' ? 'admin' : 'noc';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [pendingSandboxScript, setPendingSandboxScript] = useState('');
  const [promoteNotice, setPromoteNotice] = useState('');

  // Tenant-isolated state (Part 1)
  const [routers, setRouters] = useState<RouterProfile[]>(() =>
    user ? loadTenantRouters(user.tenantUuid) : [getDefaultSandboxRouter()]
  );
  const [activeRouterId, setActiveRouterId] = useState<string>(() =>
    routers[0]?.id || 'router_sandbox_1'
  );
  const [vaultItems, setVaultItems] = useState<BackupVaultItem[]>(() =>
    user ? loadTenantVault(user.tenantUuid) : []
  );
  const [customProfiles, setCustomProfiles] = useState<SpeedProfile[]>(() =>
    user ? loadTenantCustomProfiles(user.tenantUuid) : []
  );
  const [vouchers, setVouchers] = useState<GeneratedVoucher[]>(() =>
    user ? loadTenantVouchers(user.tenantUuid) : []
  );

  // Tenant-isolated state (Part 2)
  const [portal, setPortal] = useState<CaptivePortalConfig>(() =>
    user ? loadTenantPortal(user.tenantUuid) : getDefaultPortalConfig()
  );
  const [resellers, setResellers] = useState<ResellerAccount[]>(() =>
    user ? loadTenantResellers(user.tenantUuid) : []
  );
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(() =>
    user ? loadTenantTransactions(user.tenantUuid) : []
  );
  const [rates, setRates] = useState<ExchangeRates>(() =>
    user ? loadTenantRates(user.tenantUuid) : { SYP: 14500, TRY: 34.5 }
  );
  const [towers, setTowers] = useState<TowerNode[]>(() =>
    user ? loadTenantTowers(user.tenantUuid) : []
  );
  const [cpes, setCpes] = useState<CpeDevice[]>(() =>
    user ? loadTenantCpes(user.tenantUuid) : []
  );
  const [telegram, setTelegram] = useState<TelegramBotConfig>(() =>
    user
      ? loadTenantTelegram(user.tenantUuid)
      : {
          enabled: true,
          botToken: '',
          adminChatId: '',
          notifyTowerDown: true,
          notifyDailyBackup: true,
          enableResellerVending: true,
        }
  );
  const [sandboxState, setSandboxState] = useState<SandboxState>(() =>
    createInitialSandboxState('v7')
  );

  // Sync HTML dir and lang attributes dynamically
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const reloadTenantData = useCallback((tenantUuid: string) => {
    const tenantRouters = loadTenantRouters(tenantUuid);
    setRouters(tenantRouters);
    setActiveRouterId(tenantRouters[0]?.id || 'router_sandbox_1');
    setVaultItems(loadTenantVault(tenantUuid));
    setCustomProfiles(loadTenantCustomProfiles(tenantUuid));
    setVouchers(loadTenantVouchers(tenantUuid));
    setPortal(loadTenantPortal(tenantUuid));
    setResellers(loadTenantResellers(tenantUuid));
    setTransactions(loadTenantTransactions(tenantUuid));
    setRates(loadTenantRates(tenantUuid));
    setTowers(loadTenantTowers(tenantUuid));
    setCpes(loadTenantCpes(tenantUuid));
    setTelegram(loadTenantTelegram(tenantUuid));
  }, []);

  // Reload tenant-scoped namespaces whenever active user changes
  useEffect(() => {
    if (!user) return;
    reloadTenantData(user.tenantUuid);
  }, [user, reloadTenantData]);

  const handleAuthenticated = (nextUser: SessionUser) => {
    saveSession(nextUser);
    setUser(nextUser);
    setActiveModule(nextUser.role === 'superadmin' ? 'admin' : 'noc');
  };

  const handleLogout = () => {
    saveSession(null);
    setUser(null);
  };

  const toggleLang = () => {
    setLang((prev) => (prev === 'ar' ? 'en' : 'ar'));
  };

  const activeRouter = routers.find((r) => r.id === activeRouterId) || routers[0];

  const handleSaveRouters = (nextRouters: RouterProfile[]) => {
    setRouters(nextRouters);
    if (user) saveTenantRouters(user.tenantUuid, nextRouters);
  };

  const handleSaveCustomProfiles = (nextProfiles: SpeedProfile[]) => {
    setCustomProfiles(nextProfiles);
    if (user) saveTenantCustomProfiles(user.tenantUuid, nextProfiles);
  };

  const handleSaveVouchers = (nextVouchers: GeneratedVoucher[]) => {
    setVouchers(nextVouchers);
    if (user) saveTenantVouchers(user.tenantUuid, nextVouchers);
  };

  const handleSavePortal = (nextPortal: CaptivePortalConfig) => {
    setPortal(nextPortal);
    if (user) saveTenantPortal(user.tenantUuid, nextPortal);
  };

  const handleSaveResellers = (next: ResellerAccount[]) => {
    setResellers(next);
    if (user) saveTenantResellers(user.tenantUuid, next);
  };

  const handleSaveTransactions = (next: FinanceTransaction[]) => {
    setTransactions(next);
    if (user) saveTenantTransactions(user.tenantUuid, next);
  };

  const handleSaveRates = (next: ExchangeRates) => {
    setRates(next);
    if (user) saveTenantRates(user.tenantUuid, next);
  };

  const handleSaveTowers = (next: TowerNode[]) => {
    setTowers(next);
    if (user) saveTenantTowers(user.tenantUuid, next);
  };

  const handleSaveCpes = (next: CpeDevice[]) => {
    setCpes(next);
    if (user) saveTenantCpes(user.tenantUuid, next);
  };

  const handleSaveTelegram = (next: TelegramBotConfig) => {
    setTelegram(next);
    if (user) saveTenantTelegram(user.tenantUuid, next);
  };

  const handleSaveToVault = (
    name: string,
    content: string,
    type: 'rsc' | 'backup' = 'rsc'
  ) => {
    const newItem: BackupVaultItem = {
      id: generateUUID(),
      name,
      type,
      createdAt: new Date().toISOString(),
      routerHost: activeRouter.host,
      sizeLabel: `${Math.max(0.5, content.length / 1024).toFixed(1)} KB`,
      content,
    };
    const next = [newItem, ...vaultItems];
    setVaultItems(next);
    if (user) saveTenantVault(user.tenantUuid, next);
  };

  const handleAddVaultItem = (item: BackupVaultItem) => {
    const next = [item, ...vaultItems];
    setVaultItems(next);
    if (user) saveTenantVault(user.tenantUuid, next);
  };

  const handleDeleteVaultItem = (id: string) => {
    const next = vaultItems.filter((i) => i.id !== id);
    setVaultItems(next);
    if (user) saveTenantVault(user.tenantUuid, next);
  };

  const handleQuickBackup = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const content = [
      `# Shaban MikroCore Quick Backup Snapshot`,
      `# Router: ${activeRouter.name} (${activeRouter.host})`,
      `# OS: RouterOS ${activeRouter.osVersion.toUpperCase()}`,
      `/system identity set name="${activeRouter.name}"`,
      `/export terse`,
    ].join('\n');
    handleSaveToVault(`${activeRouter.name}_${stamp}.rsc`, content, 'rsc');
  };

  const handleTestInSandbox = (script: string) => {
    setPendingSandboxScript(script);
    setMode('sandbox');
    setActiveModule('sandbox');
  };

  const handlePromoteToLive = (script: string) => {
    setMode('live');
    if (script.trim()) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      handleSaveToVault(`Promoted_Live_${stamp}.rsc`, script, 'rsc');
    }
    setPromoteNotice(
      lang === 'ar'
        ? `تم التبديل إلى وضع Live Router وحفظ السكربت في الخزنة تمهيداً للتطبيق على ${activeRouter.name}.`
        : `Switched to Live Router Mode and archived validated script for ${activeRouter.name}.`
    );
    setActiveModule('connection');
    setTimeout(() => setPromoteNotice(''), 6000);
  };

  if (!user) {
    return (
      <>
        <LoginGate
          lang={lang}
          onToggleLang={toggleLang}
          onAuthenticated={handleAuthenticated}
        />
        <OfflineIndicator lang={lang} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#050A18] text-slate-100">
      <TopBar
        lang={lang}
        onToggleLang={toggleLang}
        mode={mode}
        onChangeMode={setMode}
        activeRouter={activeRouter}
        user={user}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((o) => !o)}
        onOpenVault={() => setVaultOpen(true)}
        onOpenAdmin={() => {
          setActiveModule('admin');
          setMobileMenuOpen(false);
        }}
        onLogout={handleLogout}
      />

      <div className="flex flex-1 min-h-0">
        <SidebarNav
          lang={lang}
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          user={user}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 pb-8 overflow-x-hidden">
          <div className="mx-auto max-w-6xl space-y-4">
            {promoteNotice && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-200">
                {promoteNotice}
              </div>
            )}

            {activeModule === 'noc' && (
              <LiveNocDashboard
                lang={lang}
                mode={mode}
                activeRouter={activeRouter}
                onQuickBackup={handleQuickBackup}
              />
            )}

            {activeModule === 'connection' && (
              <ServerConnectionModule
                lang={lang}
                mode={mode}
                user={user}
                routers={routers}
                activeRouterId={activeRouter.id}
                onSelectRouter={setActiveRouterId}
                onSaveRouters={handleSaveRouters}
                onSaveToVault={handleSaveToVault}
              />
            )}

            {activeModule === 'wizard' && (
              <ZeroTouchWizardModule
                lang={lang}
                mode={mode}
                activeRouter={activeRouter}
                tenantUuid={user.tenantUuid}
                onSaveToVault={handleSaveToVault}
              />
            )}

            {activeModule === 'radius' && (
              <RadiusVouchersModule
                lang={lang}
                mode={mode}
                activeRouter={activeRouter}
                customProfiles={customProfiles}
                onSaveCustomProfiles={handleSaveCustomProfiles}
                vouchers={vouchers}
                onSaveVouchers={handleSaveVouchers}
                onSaveToVault={handleSaveToVault}
              />
            )}

            {activeModule === 'pcc_security' && (
              <PccStarlinkSecurityModule
                lang={lang}
                mode={mode}
                activeRouter={activeRouter}
                onSaveToVault={handleSaveToVault}
              />
            )}

            {activeModule === 'cisco' && (
              <CiscoProModule
                lang={lang}
                mode={mode}
                activeRouter={activeRouter}
                onSaveToVault={handleSaveToVault}
              />
            )}

            {activeModule === 'troubleshooter' && (
              <TroubleshooterTerminalModule
                lang={lang}
                mode={mode}
                activeRouter={activeRouter}
                onTestInSandbox={handleTestInSandbox}
              />
            )}

            {activeModule === 'portal' && (
              <CaptivePortalModule
                lang={lang}
                portal={portal}
                onSavePortal={handleSavePortal}
              />
            )}

            {activeModule === 'finance' && (
              <FinancePosModule
                lang={lang}
                resellers={resellers}
                onSaveResellers={handleSaveResellers}
                transactions={transactions}
                onSaveTransactions={handleSaveTransactions}
                rates={rates}
                onSaveRates={handleSaveRates}
              />
            )}

            {activeModule === 'vault' && (
              <BackupVaultModule
                lang={lang}
                mode={mode}
                user={user}
                activeRouter={activeRouter}
                items={vaultItems}
                onAddItem={handleAddVaultItem}
                onDeleteItem={handleDeleteVaultItem}
                onRestoreToSandbox={handleTestInSandbox}
                onReloadTenantData={() => reloadTenantData(user.tenantUuid)}
              />
            )}

            {activeModule === 'towers' && (
              <TowersAutomationModule
                lang={lang}
                mode={mode}
                user={user}
                activeRouter={activeRouter}
                towers={towers}
                onSaveTowers={handleSaveTowers}
                cpes={cpes}
                onSaveCpes={handleSaveCpes}
                telegram={telegram}
                onSaveTelegram={handleSaveTelegram}
                vouchers={vouchers}
                onSaveVouchers={handleSaveVouchers}
                resellers={resellers}
                onSaveResellers={handleSaveResellers}
                onSaveToVault={handleSaveToVault}
              />
            )}

            {activeModule === 'guide' && (
              <UserGuideModule lang={lang} onNavigateModule={setActiveModule} />
            )}

            {activeModule === 'sandbox' && (
              <SandboxSimulatorModule
                lang={lang}
                sandboxState={sandboxState}
                onUpdateSandboxState={setSandboxState}
                pendingScript={pendingSandboxScript}
                onClearPendingScript={() => setPendingSandboxScript('')}
                onPromoteToLive={handlePromoteToLive}
              />
            )}

            {activeModule === 'admin' && user.role === 'superadmin' && (
              <SuperAdminPanel lang={lang} />
            )}
          </div>
        </main>
      </div>

      <BackupVaultModal
        open={vaultOpen}
        onClose={() => setVaultOpen(false)}
        lang={lang}
        mode={mode}
        activeRouter={activeRouter}
        items={vaultItems}
        onAddItem={handleAddVaultItem}
        onDeleteItem={handleDeleteVaultItem}
      />

      <FloatingAssistant lang={lang} onNavigateModule={setActiveModule} />
      <OfflineIndicator lang={lang} />
    </div>
  );
}
