import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppMode,
  BackupVaultItem,
  CaptivePortalConfig,
  CpeDevice,
  DailyTrafficSample,
  ExchangeRates,
  FinanceTransaction,
  GeneratedVoucher,
  Language,
  ModuleId,
  NocAlertItem,
  PppoeSubscriber,
  ResellerAccount,
  RouterProfile,
  RouterPublicInfo,
  SandboxState,
  SessionUser,
  SpeedProfile,
  SystemBroadcast,
  TelegramBotConfig,
  TowerNode,
} from './types/mikrocore';
import { generateUUID } from './utils/security';
import {
  RouterCloudInventory,
  RouterCloudTelemetry,
  cloudFetchRouterInventory,
  cloudFetchRouterPublicInfo,
  cloudFetchRouterTelemetry,
  cloudFetchSystemBroadcast,
  evaluateRouterAlerts,
} from './utils/firebaseCloud';
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
  loadTenantSubscribers,
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
  saveTenantSubscribers,
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
import {
  EnterpriseMikroTikModuleId,
  MikroTikEnterpriseModules,
} from './components/modules/MikroTikEnterpriseModules';

function createEmptyDailyTraffic(dateYmd: string = new Date().toISOString().slice(0, 10)): DailyTrafficSample {
  return {
    dateYmd,
    downloadBytes: 0,
    uploadBytes: 0,
    peakRxMbps: 0,
    peakTxMbps: 0,
    samplesCount: 0,
    hourlyBytes: {},
    lastSampleMs: Date.now(),
  };
}

function loadDailyTraffic(tenantUuid: string, routerId: string): DailyTrafficSample {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(`mikrocore_daily_traffic_${tenantUuid}_${routerId}`);
    if (!raw) return createEmptyDailyTraffic(today);
    const parsed = JSON.parse(raw) as DailyTrafficSample;
    if (!parsed || parsed.dateYmd !== today) return createEmptyDailyTraffic(today);
    return parsed;
  } catch {
    return createEmptyDailyTraffic(today);
  }
}

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
  const [liveTelemetry, setLiveTelemetry] = useState<RouterCloudTelemetry | null>(null);
  const [liveInventory, setLiveInventory] = useState<RouterCloudInventory | null>(null);
  const [publicInfo, setPublicInfo] = useState<RouterPublicInfo | null>(null);
  const [dailyTraffic, setDailyTraffic] = useState<DailyTrafficSample>(() =>
    createEmptyDailyTraffic()
  );
  const [nocAlerts, setNocAlerts] = useState<NocAlertItem[]>([]);
  const [systemBroadcast, setSystemBroadcast] = useState<SystemBroadcast | null>(null);
  const [dismissedBroadcastId, setDismissedBroadcastId] = useState<string>(() => {
    try {
      return localStorage.getItem('mikrocore_dismissed_broadcast_id') || '';
    } catch {
      return '';
    }
  });
  const userForcedSandboxRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const lastAlertKeysRef = useRef<string>('');

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
  const [subscribers, setSubscribers] = useState<PppoeSubscriber[]>(() =>
    user ? loadTenantSubscribers(user.tenantUuid) : []
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
          enableBatteryGuard: true,
          lowVoltageThreshold: 22.5,
          secondaryPortsToShutdown: 'ether4,ether5',
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
    setSubscribers(loadTenantSubscribers(tenantUuid));
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

  const handleChangeMode = (nextMode: AppMode) => {
    userForcedSandboxRef.current = nextMode === 'sandbox';
    setMode(nextMode);
  };

  const activeRouter = routers.find((r) => r.id === activeRouterId) || routers[0];

  const handleSaveRouters = useCallback(
    (nextRouters: RouterProfile[]) => {
      setRouters(nextRouters);
      if (user) saveTenantRouters(user.tenantUuid, nextRouters);
    },
    [user]
  );

  // Poll Firebase Cloud Agent telemetry (and evaluate Smart NOC alerts)
  useEffect(() => {
    if (!user || !activeRouter) return;
    if (activeModule !== 'noc' && activeModule !== 'connection' && mode !== 'live') return;

    let cancelled = false;

    const triggerChime = () => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(740, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.26);
      } catch {
        // ignore autoplay restrictions
      }
    };

    const pollTelemetry = async () => {
      const res = await cloudFetchRouterTelemetry(user.tenantUuid, activeRouter.id);
      if (cancelled || !res.ok) return;

      if (res.telemetry && res.isFresh) {
        const tel = res.telemetry;
        setLiveTelemetry(tel);

        // Accumulate daily GB totals from live RX/TX telemetry pulses
        setDailyTraffic((prev) => {
          const now = Date.now();
          const today = new Date().toISOString().slice(0, 10);
          const base = prev.dateYmd === today ? prev : createEmptyDailyTraffic(today);
          const elapsedSec = Math.max(1, Math.min(20, (now - (base.lastSampleMs || now)) / 1000));
          const downDelta = ((tel.rxBps || 0) / 8) * elapsedSec;
          const upDelta = ((tel.txBps || 0) / 8) * elapsedSec;
          const hourKey = String(new Date().getHours()).padStart(2, '0');
          const prevHour = base.hourlyBytes[hourKey] || { down: 0, up: 0 };
          const nextSample: DailyTrafficSample = {
            dateYmd: today,
            downloadBytes: base.downloadBytes + downDelta,
            uploadBytes: base.uploadBytes + upDelta,
            peakRxMbps: Math.max(base.peakRxMbps, (tel.rxBps || 0) / 1_000_000),
            peakTxMbps: Math.max(base.peakTxMbps, (tel.txBps || 0) / 1_000_000),
            samplesCount: base.samplesCount + 1,
            hourlyBytes: {
              ...base.hourlyBytes,
              [hourKey]: { down: prevHour.down + downDelta, up: prevHour.up + upDelta },
            },
            lastSampleMs: now,
          };
          try {
            localStorage.setItem(
              `mikrocore_daily_traffic_${user.tenantUuid}_${activeRouter.id}`,
              JSON.stringify(nextSample)
            );
          } catch {
            // ignore storage errors
          }
          return nextSample;
        });

        const nextAlerts = evaluateRouterAlerts({
          telemetry: tel,
          routerName: activeRouter.name,
          isConnected: true,
          wasConnected: wasConnectedRef.current,
          lowVoltageThreshold:
            telegram.enableBatteryGuard !== false ? telegram.lowVoltageThreshold ?? 22.5 : undefined,
        });
        wasConnectedRef.current = true;
        setNocAlerts(nextAlerts);

        const alertSig = nextAlerts.map((a) => a.id).join('|');
        if (alertSig && alertSig !== lastAlertKeysRef.current) {
          lastAlertKeysRef.current = alertSig;
          triggerChime();
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              const first = nextAlerts[0];
              new Notification(lang === 'ar' ? first.titleAr : first.titleEn, {
                body: lang === 'ar' ? first.detailAr : first.detailEn,
              });
            } catch {
              // ignore notification error
            }
          }
        } else if (!alertSig) {
          lastAlertKeysRef.current = '';
        }

        setRouters((prev) => {
          const target = prev.find((r) => r.id === activeRouter.id);
          if (!target) return prev;
          const nextModel = tel.board || target.model;
          if (target.status === 'connected' && target.model === nextModel) {
            return prev;
          }
          const updated = prev.map((r) =>
            r.id === activeRouter.id
              ? {
                  ...r,
                  model: nextModel,
                  status: 'connected' as const,
                  lastConnectedAt: new Date(tel.timestamp).toISOString(),
                }
              : r
          );
          saveTenantRouters(user.tenantUuid, updated);
          return updated;
        });

        if (!userForcedSandboxRef.current && mode !== 'live') {
          setMode('live');
        }
      } else if (!res.isFresh) {
        setLiveTelemetry(null);
        const offlineAlerts = evaluateRouterAlerts({
          telemetry: null,
          routerName: activeRouter.name,
          isConnected: false,
          wasConnected: wasConnectedRef.current,
        });
        if (wasConnectedRef.current) {
          wasConnectedRef.current = false;
          setNocAlerts(offlineAlerts);
          if (offlineAlerts.length > 0) triggerChime();
        }
        if (mode === 'live') {
          setRouters((prev) => {
            const target = prev.find((r) => r.id === activeRouter.id);
            if (!target || target.status !== 'connected') return prev;
            const updated = prev.map((r) =>
              r.id === activeRouter.id ? { ...r, status: 'disconnected' as const } : r
            );
            saveTenantRouters(user.tenantUuid, updated);
            return updated;
          });
        }
      }
    };

    void pollTelemetry();
    const timer = setInterval(pollTelemetry, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    user,
    activeRouter?.id,
    activeRouter?.name,
    activeModule,
    mode,
    lang,
    telegram.enableBatteryGuard,
    telegram.lowVoltageThreshold,
  ]);

  // Fetch cached Heavy Inventory when viewing NOC in Live mode
  useEffect(() => {
    if (!user || !activeRouter || activeModule !== 'noc' || mode !== 'live') return;
    let cancelled = false;
    (async () => {
      const invRes = await cloudFetchRouterInventory(user.tenantUuid, activeRouter.id);
      if (!cancelled && invRes.ok && invRes.inventory) {
        setLiveInventory(invRes.inventory);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, activeRouter?.id, activeModule, mode]);

  // Sync per-router daily traffic counter & cached public IP/DDNS info
  useEffect(() => {
    if (!user || !activeRouter) return;
    setDailyTraffic(loadDailyTraffic(user.tenantUuid, activeRouter.id));
    try {
      const cachedPub = localStorage.getItem(
        `mikrocore_public_info_${user.tenantUuid}_${activeRouter.id}`
      );
      setPublicInfo(cachedPub ? (JSON.parse(cachedPub) as RouterPublicInfo) : null);
    } catch {
      setPublicInfo(null);
    }
    if (mode !== 'live') return;
    let cancelled = false;
    (async () => {
      const infoRes = await cloudFetchRouterPublicInfo(user.tenantUuid, activeRouter.id);
      if (!cancelled && infoRes.ok && infoRes.info) {
        setPublicInfo(infoRes.info);
        try {
          localStorage.setItem(
            `mikrocore_public_info_${user.tenantUuid}_${activeRouter.id}`,
            JSON.stringify(infoRes.info)
          );
        } catch {
          // ignore
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, activeRouter?.id, mode]);

  // Poll Global Owner Update Broadcast for all authenticated devices
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const checkBroadcast = async () => {
      const res = await cloudFetchSystemBroadcast();
      if (!cancelled && res.ok && res.broadcast) {
        setSystemBroadcast(res.broadcast);
      }
    };
    void checkBroadcast();
    const timer = setInterval(checkBroadcast, 45_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);

  const handleDismissBroadcast = (id: string) => {
    setDismissedBroadcastId(id);
    try {
      localStorage.setItem('mikrocore_dismissed_broadcast_id', id);
    } catch {
      // ignore storage errors
    }
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

  const handleSaveSubscribers = (next: PppoeSubscriber[]) => {
    setSubscribers(next);
    if (user) saveTenantSubscribers(user.tenantUuid, next);
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
        onChangeMode={handleChangeMode}
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
            {systemBroadcast && systemBroadcast.id !== dismissedBroadcastId && (
              <div
                role="status"
                className="noc-glass flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-cyan-400/45 bg-gradient-to-r from-cyan-500/15 via-[#0B142B]/95 to-emerald-500/15 px-4 py-3 shadow-[0_0_24px_rgba(0,229,255,0.16)]"
              >
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-extrabold text-cyan-300">
                    {lang === 'ar'
                      ? 'تم إصدار تحديث جديد من المالك إسماعيل شعبان'
                      : 'New Update Released by Owner Ismaeil Shaban'}
                  </p>
                  <p className="text-sm font-bold text-white">{systemBroadcast.title}</p>
                  <p className="text-xs text-slate-200 leading-relaxed">{systemBroadcast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDismissBroadcast(systemBroadcast.id)}
                  className="self-start sm:self-center shrink-0 rounded-xl border border-cyan-400/40 bg-[#050A18]/80 px-3.5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20 cursor-pointer whitespace-nowrap"
                >
                  {lang === 'ar' ? 'إغلاق الإشعار' : 'Dismiss'}
                </button>
              </div>
            )}

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
                tenantUuid={user.tenantUuid}
                liveTelemetry={liveTelemetry}
                liveInventory={liveInventory}
                nocAlerts={mode === 'live' ? nocAlerts : []}
                onInventoryUpdated={(inv) => setLiveInventory(inv)}
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
                onSwitchToLiveMode={() => {
                  userForcedSandboxRef.current = false;
                  setMode('live');
                }}
                onTelemetryDetected={(tel) => setLiveTelemetry(tel)}
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
                tenantUuid={user.tenantUuid}
                portalNetworkName={portal.networkTitle}
                portalSupportPhone={portal.supportPhone1}
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
                tenantUuid={user.tenantUuid}
                onSaveToVault={handleSaveToVault}
              />
            )}

            {(activeModule === 'public_ip' ||
              activeModule === 'vpn_l2tp' ||
              activeModule === 'starlink_quota' ||
              activeModule === 'quota_guard' ||
              activeModule === 'loop_protect' ||
              activeModule === 'maintenance_mode' ||
              activeModule === 'daily_report') && (
              <MikroTikEnterpriseModules
                activeModule={activeModule as EnterpriseMikroTikModuleId}
                lang={lang}
                mode={mode}
                activeRouter={activeRouter}
                tenantUuid={user.tenantUuid}
                publicInfo={publicInfo}
                onPublicInfoUpdated={(info) => {
                  setPublicInfo(info);
                  try {
                    if (info) {
                      localStorage.setItem(
                        `mikrocore_public_info_${user.tenantUuid}_${activeRouter.id}`,
                        JSON.stringify(info)
                      );
                    }
                  } catch {
                    // ignore
                  }
                }}
                liveTelemetry={liveTelemetry}
                dailyTraffic={dailyTraffic}
                onResetDailyTraffic={() => {
                  const empty = createEmptyDailyTraffic();
                  setDailyTraffic(empty);
                  try {
                    localStorage.setItem(
                      `mikrocore_daily_traffic_${user.tenantUuid}_${activeRouter.id}`,
                      JSON.stringify(empty)
                    );
                  } catch {
                    // ignore
                  }
                }}
                onSaveToVault={handleSaveToVault}
              />
            )}

            {(activeModule === 'cisco' ||
              activeModule === 'cisco_vlans' ||
              activeModule === 'cisco_l2' ||
              activeModule === 'cisco_lacp' ||
              activeModule === 'cisco_routing' ||
              activeModule === 'cisco_qos') && (
              <CiscoProModule
                lang={lang}
                mode={mode}
                activeRouter={activeRouter}
                tenantUuid={user.tenantUuid}
                focusedTab={
                  activeModule === 'cisco_l2'
                    ? 'l2'
                    : activeModule === 'cisco_lacp'
                    ? 'lacp'
                    : activeModule === 'cisco_routing'
                    ? 'routing'
                    : activeModule === 'cisco_qos'
                    ? 'qos'
                    : 'vlans'
                }
                onSaveToVault={handleSaveToVault}
              />
            )}

            {activeModule === 'troubleshooter' && (
              <TroubleshooterTerminalModule
                lang={lang}
                mode={mode}
                activeRouter={activeRouter}
                tenantUuid={user.tenantUuid}
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
                subscribers={subscribers}
                onSaveSubscribers={handleSaveSubscribers}
                activeRouter={activeRouter}
                tenantUuid={user.tenantUuid}
                mode={mode}
                networkTitle={portal.networkTitle}
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
                tenantUuid={user.tenantUuid}
                liveTelemetry={liveTelemetry}
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

      <FloatingAssistant
        lang={lang}
        mode={mode}
        activeRouter={activeRouter}
        tenantUuid={user.tenantUuid}
        liveTelemetry={liveTelemetry}
        onNavigateModule={setActiveModule}
      />
      <OfflineIndicator lang={lang} />
    </div>
  );
}
