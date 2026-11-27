import {
  AuditLogEntry,
  BackupVaultItem,
  CaptivePortalConfig,
  CpeDevice,
  CustomerAccount,
  ExchangeRates,
  FinanceTransaction,
  GeneratedVoucher,
  ResellerAccount,
  RouterProfile,
  SessionUser,
  SpeedProfile,
  SubscriptionSettings,
  TelegramBotConfig,
  TowerNode,
} from '../types/mikrocore';
import {
  SUPER_ADMIN_PASSWORD_HASH,
  SUPER_ADMIN_USERNAME,
  LockoutState,
  constantTimeEqual,
  generateUUID,
  getTenantStorageKey,
  sanitizeInput,
  sha256Hex,
} from './security';
import { cloudFetchTenant, validateTenantLoginState } from './firebaseCloud';

const CUSTOMERS_KEY = 'mikrocore_sys_customers_v1';
const AUDIT_KEY = 'mikrocore_sys_audit_v1';
const LOCKOUT_KEY = 'mikrocore_sys_lockout_v1';
const SESSION_KEY = 'mikrocore_sys_session_v1';
const SUBSCRIPTION_SETTINGS_KEY = 'mikrocore_sys_subscription_settings_v1';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadSubscriptionSettings(): SubscriptionSettings {
  const saved = safeParse<Partial<SubscriptionSettings>>(
    localStorage.getItem(SUBSCRIPTION_SETTINGS_KEY),
    {}
  );
  return {
    monthlyPriceUsd:
      typeof saved.monthlyPriceUsd === 'number' && saved.monthlyPriceUsd > 0
        ? saved.monthlyPriceUsd
        : 30,
    whatsappNumber:
      typeof saved.whatsappNumber === 'string' && saved.whatsappNumber.trim().length > 0
        ? saved.whatsappNumber.replace(/[^\d]/g, '') || '963945597617'
        : '963945597617',
  };
}

export function saveSubscriptionSettings(settings: SubscriptionSettings): SubscriptionSettings {
  const clean: SubscriptionSettings = {
    monthlyPriceUsd: Math.max(1, Number(settings.monthlyPriceUsd) || 30),
    whatsappNumber: settings.whatsappNumber.replace(/[^\d]/g, '') || '963945597617',
  };
  localStorage.setItem(SUBSCRIPTION_SETTINGS_KEY, JSON.stringify(clean));
  return clean;
}

export function loadCustomers(): CustomerAccount[] {
  return safeParse<CustomerAccount[]>(localStorage.getItem(CUSTOMERS_KEY), []);
}

export function saveCustomers(customers: CustomerAccount[]): void {
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
}

export function loadAuditLogs(): AuditLogEntry[] {
  return safeParse<AuditLogEntry[]>(localStorage.getItem(AUDIT_KEY), []);
}

export function appendAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry[] {
  const logs = loadAuditLogs();
  const next: AuditLogEntry = {
    id: generateUUID(),
    timestamp: new Date().toISOString(),
    actor: sanitizeInput(entry.actor),
    tenantUuid: sanitizeInput(entry.tenantUuid),
    action: sanitizeInput(entry.action),
    severity: entry.severity,
    details: sanitizeInput(entry.details),
  };
  const updated = [next, ...logs].slice(0, 250);
  localStorage.setItem(AUDIT_KEY, JSON.stringify(updated));
  return updated;
}

export function loadLockoutState(): LockoutState {
  return safeParse<LockoutState>(localStorage.getItem(LOCKOUT_KEY), {
    failedAttempts: 0,
    lockedUntil: null,
  });
}

export function saveLockoutState(state: LockoutState): void {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(state));
}

export function clearLockoutState(): void {
  localStorage.removeItem(LOCKOUT_KEY);
}

export function loadSession(): SessionUser | null {
  const session = safeParse<SessionUser | null>(localStorage.getItem(SESSION_KEY), null);
  if (!session) return null;
  if (session.role === 'superadmin') return session;
  const customers = loadCustomers();
  const found = customers.find(
    (c) =>
      c.username.toLowerCase() === session.username.toLowerCase() &&
      c.tenantUuid === session.tenantUuid
  );
  if (!found || found.status !== 'active') {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (found.expiryDate && found.expiryDate < today) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  return session;
}

export function saveSession(user: SessionUser | null): void {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
  } else {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
}

export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: 'invalid' | 'suspended' | 'expired' };

export async function authenticateUser(
  usernameRaw: string,
  passwordRaw: string,
  isSuperAdminMode: boolean
): Promise<AuthResult> {
  const username = sanitizeInput(usernameRaw).toLowerCase();
  const passwordHash = await sha256Hex(passwordRaw);

  if (isSuperAdminMode || username === SUPER_ADMIN_USERNAME) {
    if (
      username === SUPER_ADMIN_USERNAME &&
      constantTimeEqual(passwordHash, SUPER_ADMIN_PASSWORD_HASH)
    ) {
      const adminUser: SessionUser = {
        role: 'superadmin',
        username: SUPER_ADMIN_USERNAME,
        displayName: 'Ismaeil Shaban',
        tenantUuid: '00000000-0000-4000-8000-000000000001',
        maxRouters: 999,
      };
      appendAuditLog({
        actor: SUPER_ADMIN_USERNAME,
        tenantUuid: adminUser.tenantUuid,
        action: 'SUPER_ADMIN_LOGIN',
        severity: 'info',
        details: 'Super Admin authenticated successfully',
      });
      return { ok: true, user: adminUser };
    }
    appendAuditLog({
      actor: username || 'unknown',
      tenantUuid: 'system',
      action: 'FAILED_ADMIN_LOGIN',
      severity: 'critical',
      details: 'Invalid Super Admin login attempt',
    });
    return { ok: false, reason: 'invalid' };
  }

  const localCustomers = loadCustomers();
  const cloudRes = await cloudFetchTenant(username);

  let account: CustomerAccount | null = null;
  if (cloudRes.ok) {
    if (!cloudRes.tenant) {
      const pruned = localCustomers.filter((c) => c.username.toLowerCase() !== username);
      if (pruned.length !== localCustomers.length) {
        saveCustomers(pruned);
      }
      appendAuditLog({
        actor: username || 'unknown',
        tenantUuid: 'system',
        action: 'FAILED_LOGIN',
        severity: 'warning',
        details: 'Unknown username attempted cloud login',
      });
      return { ok: false, reason: 'invalid' };
    }
    account = cloudRes.tenant;
  } else {
    account = localCustomers.find((c) => c.username.toLowerCase() === username) || null;
    if (!account) {
      appendAuditLog({
        actor: username || 'unknown',
        tenantUuid: 'system',
        action: 'FAILED_LOGIN',
        severity: 'warning',
        details: 'Unknown username attempted login',
      });
      return { ok: false, reason: 'invalid' };
    }
  }

  const upsertLocalCustomer = (entry: CustomerAccount) => {
    const idx = localCustomers.findIndex(
      (c) => c.username.toLowerCase() === entry.username.toLowerCase()
    );
    const nextList = [...localCustomers];
    if (idx === -1) {
      nextList.unshift(entry);
    } else {
      nextList[idx] = entry;
    }
    saveCustomers(nextList);
  };

  const validation = validateTenantLoginState(account, passwordHash);
  if (!validation.ok) {
    if (validation.reason === 'invalid') {
      appendAuditLog({
        actor: account.username,
        tenantUuid: account.tenantUuid,
        action: 'FAILED_LOGIN_BAD_PASS',
        severity: 'warning',
        details: 'Incorrect password entered',
      });
      return { ok: false, reason: 'invalid' };
    }
    if (cloudRes.ok) {
      upsertLocalCustomer(account);
    }
    if (validation.reason === 'suspended') {
      appendAuditLog({
        actor: account.username,
        tenantUuid: account.tenantUuid,
        action: 'LOGIN_BLOCKED_SUSPENDED',
        severity: 'warning',
        details: 'Suspended account attempted access',
      });
      return { ok: false, reason: 'suspended' };
    }
    appendAuditLog({
      actor: account.username,
      tenantUuid: account.tenantUuid,
      action: 'LOGIN_BLOCKED_EXPIRED',
      severity: 'warning',
      details: `Subscription expired on ${account.expiryDate}`,
    });
    return { ok: false, reason: 'expired' };
  }

  const syncedAccount: CustomerAccount = {
    ...account,
    lastLoginAt: new Date().toISOString(),
  };
  upsertLocalCustomer(syncedAccount);

  appendAuditLog({
    actor: syncedAccount.username,
    tenantUuid: syncedAccount.tenantUuid,
    action: 'TENANT_LOGIN',
    severity: 'info',
    details: `Tenant ${syncedAccount.customerName} signed in (${cloudRes.ok ? 'cloud' : 'offline cache'})`,
  });

  return {
    ok: true,
    user: {
      role: 'customer',
      username: syncedAccount.username,
      displayName: syncedAccount.customerName,
      tenantUuid: syncedAccount.tenantUuid,
      maxRouters: syncedAccount.maxRouters,
      expiryDate: syncedAccount.expiryDate,
    },
  };
}

// === Multi-Tenant Isolated Data Helpers ===

export function getDefaultSandboxRouter(): RouterProfile {
  return {
    id: 'router_sandbox_1',
    name: 'Shaban-Core-CCR2004',
    model: 'CCR2004-1G-12S+2XS',
    osVersion: 'v7',
    connectionMethod: 'local_ip',
    host: '192.168.88.1',
    port: 443,
    apiUser: 'mikrocore-api',
    apiPassword: '',
    useHttps: true,
    status: 'sandbox',
  };
}

export function loadTenantRouters(tenantUuid: string): RouterProfile[] {
  const key = getTenantStorageKey(tenantUuid, 'routers');
  const list = safeParse<RouterProfile[]>(localStorage.getItem(key), []);
  if (list.length === 0) {
    const initial = [getDefaultSandboxRouter()];
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  return list;
}

export function saveTenantRouters(tenantUuid: string, routers: RouterProfile[]): void {
  localStorage.setItem(getTenantStorageKey(tenantUuid, 'routers'), JSON.stringify(routers));
}

export function loadTenantVault(tenantUuid: string): BackupVaultItem[] {
  return safeParse<BackupVaultItem[]>(
    localStorage.getItem(getTenantStorageKey(tenantUuid, 'vault')),
    []
  );
}

export function saveTenantVault(tenantUuid: string, items: BackupVaultItem[]): void {
  localStorage.setItem(getTenantStorageKey(tenantUuid, 'vault'), JSON.stringify(items.slice(0, 50)));
}

export function loadTenantCustomProfiles(tenantUuid: string): SpeedProfile[] {
  return safeParse<SpeedProfile[]>(
    localStorage.getItem(getTenantStorageKey(tenantUuid, 'profiles')),
    []
  );
}

export function saveTenantCustomProfiles(tenantUuid: string, profiles: SpeedProfile[]): void {
  localStorage.setItem(getTenantStorageKey(tenantUuid, 'profiles'), JSON.stringify(profiles));
}

export function loadTenantVouchers(tenantUuid: string): GeneratedVoucher[] {
  return safeParse<GeneratedVoucher[]>(
    localStorage.getItem(getTenantStorageKey(tenantUuid, 'vouchers')),
    []
  );
}

export function saveTenantVouchers(tenantUuid: string, vouchers: GeneratedVoucher[]): void {
  localStorage.setItem(
    getTenantStorageKey(tenantUuid, 'vouchers'),
    JSON.stringify(vouchers.slice(0, 1000))
  );
}

// === Part 2 Tenant Persistence ===

export function getDefaultPortalConfig(): CaptivePortalConfig {
  return {
    networkTitle: 'Shaban Starlink & Fiber',
    subtitle: 'اتصال فائق السرعة واستقرار تام للألعاب والبث',
    primaryColor: '#00E5FF',
    bgColor: '#050A18',
    promoBanner: 'عرض خاص: باقة الألعاب 25M بسعر مخفّض طوال الشهر!',
    supportPhone1: '+963 945 597 617',
    supportPhone2: '+963 900 000 000',
    showSpeedTestBtn: true,
    loginMode: 'user_pass',
    plans: [
      { id: 'p1', name: 'ساعة تيربو', speed: '8M / 4M', price: '1$', duration: '24 ساعة' },
      { id: 'p2', name: 'أسبوع برو', speed: '16M / 8M', price: '4$', duration: '7 أيام' },
      { id: 'p3', name: 'شهري VIP', speed: '25M / 12M', price: '15$', duration: '30 يوماً' },
    ],
  };
}

export function loadTenantPortal(tenantUuid: string): CaptivePortalConfig {
  const defaults = getDefaultPortalConfig();
  const loaded = safeParse<Partial<CaptivePortalConfig>>(
    localStorage.getItem(getTenantStorageKey(tenantUuid, 'portal')),
    defaults
  );
  return {
    ...defaults,
    ...loaded,
    loginMode: loaded.loginMode || 'user_pass',
    plans: Array.isArray(loaded.plans) ? loaded.plans : defaults.plans,
  };
}

export function saveTenantPortal(tenantUuid: string, portal: CaptivePortalConfig): void {
  localStorage.setItem(getTenantStorageKey(tenantUuid, 'portal'), JSON.stringify(portal));
}

export function loadTenantResellers(tenantUuid: string): ResellerAccount[] {
  const key = getTenantStorageKey(tenantUuid, 'resellers');
  const existing = safeParse<ResellerAccount[]>(localStorage.getItem(key), []);
  if (existing.length > 0) return existing;
  const seed: ResellerAccount[] = [
    {
      id: 'res_1',
      name: 'سوبرماركت النور',
      phone: '0945112233',
      commissionPercent: 10,
      maxDebtUsd: 150,
      currentDebtUsd: 45,
      cardsSoldCount: 120,
      totalRevenueUsd: 240,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'res_2',
      name: 'مركز الرواد للاتصالات',
      phone: '0933445566',
      commissionPercent: 12,
      maxDebtUsd: 200,
      currentDebtUsd: 185,
      cardsSoldCount: 310,
      totalRevenueUsd: 620,
      createdAt: new Date().toISOString(),
    },
  ];
  localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}

export function saveTenantResellers(tenantUuid: string, list: ResellerAccount[]): void {
  localStorage.setItem(getTenantStorageKey(tenantUuid, 'resellers'), JSON.stringify(list));
}

export function loadTenantTransactions(tenantUuid: string): FinanceTransaction[] {
  const key = getTenantStorageKey(tenantUuid, 'transactions');
  const existing = safeParse<FinanceTransaction[]>(localStorage.getItem(key), []);
  if (existing.length > 0) return existing;
  const today = new Date().toISOString().slice(0, 10);
  const seed: FinanceTransaction[] = [
    {
      id: 'tx_1',
      date: today,
      type: 'income',
      category: 'Vouchers',
      description: 'مبيعات بطاقات هوتسبوت — دفعة الصباح',
      amount: 180,
      currency: 'USD',
      amountUsd: 180,
    },
    {
      id: 'tx_2',
      date: today,
      type: 'expense',
      category: 'Starlink',
      description: 'اشتراك ستارلينك شهري (Tower 1)',
      amount: 75,
      currency: 'USD',
      amountUsd: 75,
    },
  ];
  localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}

export function saveTenantTransactions(tenantUuid: string, list: FinanceTransaction[]): void {
  localStorage.setItem(getTenantStorageKey(tenantUuid, 'transactions'), JSON.stringify(list));
}

export function loadTenantRates(tenantUuid: string): ExchangeRates {
  return safeParse<ExchangeRates>(
    localStorage.getItem(getTenantStorageKey(tenantUuid, 'rates')),
    { SYP: 14500, TRY: 34.5 }
  );
}

export function saveTenantRates(tenantUuid: string, rates: ExchangeRates): void {
  localStorage.setItem(getTenantStorageKey(tenantUuid, 'rates'), JSON.stringify(rates));
}

export function loadTenantTowers(tenantUuid: string): TowerNode[] {
  const key = getTenantStorageKey(tenantUuid, 'towers');
  const existing = safeParse<TowerNode[]>(localStorage.getItem(key), []);
  if (existing.length > 0) return existing;
  const seed: TowerNode[] = [
    {
      id: 'tw_1',
      name: 'البرج المركزي — قطاع 1 (Sector AC)',
      ip: '10.20.1.10',
      type: 'sector',
      signalDbm: -54,
      ccqPercent: 98,
      pingMs: 3,
      status: 'online',
    },
    {
      id: 'tw_2',
      name: 'وصلة ربط PtP — التل الشمالي',
      ip: '10.20.1.25',
      type: 'ptp_bridge',
      signalDbm: -61,
      ccqPercent: 94,
      pingMs: 6,
      status: 'online',
    },
  ];
  localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}

export function saveTenantTowers(tenantUuid: string, list: TowerNode[]): void {
  localStorage.setItem(getTenantStorageKey(tenantUuid, 'towers'), JSON.stringify(list));
}

export function loadTenantCpes(tenantUuid: string): CpeDevice[] {
  const key = getTenantStorageKey(tenantUuid, 'cpes');
  const existing = safeParse<CpeDevice[]>(localStorage.getItem(key), []);
  if (existing.length > 0) return existing;
  const seed: CpeDevice[] = [
    {
      id: 'cpe_1',
      model: 'Ubiquiti LiteBeam 5AC Gen2',
      macAddress: '74:83:C2:AA:11:02',
      serial: 'LBE-5AC-9921',
      status: 'loaned',
      assignedTo: 'مشترك: أبو محمد',
      notes: 'إعارة مع باقة 25M',
    },
    {
      id: 'cpe_2',
      model: 'Ubiquiti NanoStation M5',
      macAddress: 'DC:9F:DB:41:88:19',
      serial: 'NSM5-4410',
      status: 'in_stock',
      assignedTo: 'المستودع الرئيسي',
      notes: 'جاهز للتركيب',
    },
  ];
  localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}

export function saveTenantCpes(tenantUuid: string, list: CpeDevice[]): void {
  localStorage.setItem(getTenantStorageKey(tenantUuid, 'cpes'), JSON.stringify(list));
}

export function loadTenantTelegram(tenantUuid: string): TelegramBotConfig {
  return safeParse<TelegramBotConfig>(
    localStorage.getItem(getTenantStorageKey(tenantUuid, 'telegram')),
    {
      enabled: true,
      botToken: '',
      adminChatId: '',
      notifyTowerDown: true,
      notifyDailyBackup: true,
      enableResellerVending: true,
    }
  );
}

export function saveTenantTelegram(tenantUuid: string, cfg: TelegramBotConfig): void {
  localStorage.setItem(getTenantStorageKey(tenantUuid, 'telegram'), JSON.stringify(cfg));
}

export function exportTenantDatabaseJson(tenantUuid: string): string {
  return JSON.stringify(
    {
      app: 'Shaban MikroCore Tenant Export',
      tenantUuid,
      exportedAt: new Date().toISOString(),
      routers: loadTenantRouters(tenantUuid),
      vault: loadTenantVault(tenantUuid),
      customProfiles: loadTenantCustomProfiles(tenantUuid),
      vouchers: loadTenantVouchers(tenantUuid),
      portal: loadTenantPortal(tenantUuid),
      resellers: loadTenantResellers(tenantUuid),
      transactions: loadTenantTransactions(tenantUuid),
      rates: loadTenantRates(tenantUuid),
      towers: loadTenantTowers(tenantUuid),
      cpes: loadTenantCpes(tenantUuid),
      telegram: loadTenantTelegram(tenantUuid),
    },
    null,
    2
  );
}

export function importTenantDatabaseJson(
  tenantUuid: string,
  jsonStr: string
): { ok: boolean; message: string } {
  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, message: 'Invalid JSON payload' };
    }
    if (Array.isArray(parsed.routers)) saveTenantRouters(tenantUuid, parsed.routers as RouterProfile[]);
    if (Array.isArray(parsed.vault)) saveTenantVault(tenantUuid, parsed.vault as BackupVaultItem[]);
    if (Array.isArray(parsed.customProfiles))
      saveTenantCustomProfiles(tenantUuid, parsed.customProfiles as SpeedProfile[]);
    if (Array.isArray(parsed.vouchers))
      saveTenantVouchers(tenantUuid, parsed.vouchers as GeneratedVoucher[]);
    if (parsed.portal && typeof parsed.portal === 'object')
      saveTenantPortal(tenantUuid, parsed.portal as CaptivePortalConfig);
    if (Array.isArray(parsed.resellers))
      saveTenantResellers(tenantUuid, parsed.resellers as ResellerAccount[]);
    if (Array.isArray(parsed.transactions))
      saveTenantTransactions(tenantUuid, parsed.transactions as FinanceTransaction[]);
    if (parsed.rates && typeof parsed.rates === 'object')
      saveTenantRates(tenantUuid, parsed.rates as ExchangeRates);
    if (Array.isArray(parsed.towers)) saveTenantTowers(tenantUuid, parsed.towers as TowerNode[]);
    if (Array.isArray(parsed.cpes)) saveTenantCpes(tenantUuid, parsed.cpes as CpeDevice[]);
    if (parsed.telegram && typeof parsed.telegram === 'object')
      saveTenantTelegram(tenantUuid, parsed.telegram as TelegramBotConfig);
    return { ok: true, message: 'Tenant database restored cleanly' };
  } catch {
    return { ok: false, message: 'Failed to parse JSON backup' };
  }
}

export function exportFullSystemBackup(): string {
  const payload = {
    app: 'Shaban MikroCore',
    exportedAt: new Date().toISOString(),
    subscriptionSettings: loadSubscriptionSettings(),
    customers: loadCustomers(),
    auditLogs: loadAuditLogs(),
  };
  return JSON.stringify(payload, null, 2);
}

export function importFullSystemBackup(jsonStr: string): { ok: boolean; count: number } {
  try {
    const parsed = JSON.parse(jsonStr) as {
      customers?: CustomerAccount[];
      auditLogs?: AuditLogEntry[];
      subscriptionSettings?: SubscriptionSettings;
    };
    if (!Array.isArray(parsed.customers)) {
      return { ok: false, count: 0 };
    }
    saveCustomers(parsed.customers);
    if (parsed.subscriptionSettings) {
      saveSubscriptionSettings(parsed.subscriptionSettings);
    }
    if (Array.isArray(parsed.auditLogs)) {
      localStorage.setItem(AUDIT_KEY, JSON.stringify(parsed.auditLogs.slice(0, 250)));
    }
    return { ok: true, count: parsed.customers.length };
  } catch {
    return { ok: false, count: 0 };
  }
}
