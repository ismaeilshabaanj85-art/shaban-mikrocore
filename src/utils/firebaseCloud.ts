import { CustomerAccount } from '../types/mikrocore';
import { constantTimeEqual, generateUUID, sanitizeCliToken, sanitizeInput } from './security';

export const FIREBASE_RTDB_URL = 'https://shaban-mikrocore-default-rtdb.firebaseio.com';

export interface CloudTenantRecord {
  id: string;
  tenantUuid?: string;
  username: string;
  passwordHash: string;
  networkName: string;
  maxRouters: number;
  expiresAt: string; // YYYY-MM-DD
  isActive: boolean;
  createdAt: string;
}

export function toCloudTenantRecord(account: CustomerAccount): CloudTenantRecord {
  return {
    id: account.id,
    tenantUuid: account.tenantUuid,
    username: sanitizeInput(account.username).toLowerCase(),
    passwordHash: account.passwordHash,
    networkName: sanitizeInput(account.customerName),
    maxRouters: Math.max(1, Math.min(500, Number(account.maxRouters) || 1)),
    expiresAt: account.expiryDate,
    isActive: account.status === 'active',
    createdAt: account.createdAt,
  };
}

export function fromCloudTenantRecord(
  rec: Partial<CloudTenantRecord>,
  fallbackKey?: string
): CustomerAccount | null {
  const uname = sanitizeInput(String(rec.username || fallbackKey || '')).toLowerCase();
  if (!uname || !rec.passwordHash) return null;
  const id = String(rec.id || generateUUID());
  return {
    id,
    tenantUuid: String(rec.tenantUuid || id),
    username: uname,
    passwordHash: String(rec.passwordHash),
    customerName: sanitizeInput(String(rec.networkName || uname)),
    maxRouters: Math.max(1, Math.min(500, Number(rec.maxRouters) || 1)),
    expiryDate: String(rec.expiresAt || ''),
    status: rec.isActive === false ? 'suspended' : 'active',
    createdAt: String(rec.createdAt || new Date().toISOString()),
  };
}

export type TenantValidationResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'suspended' | 'expired' };

export function validateTenantLoginState(
  account: CustomerAccount | null,
  passwordHash: string,
  todayYmd: string = new Date().toISOString().slice(0, 10)
): TenantValidationResult {
  if (!account) return { ok: false, reason: 'invalid' };
  if (!constantTimeEqual(passwordHash, account.passwordHash)) {
    return { ok: false, reason: 'invalid' };
  }
  if (account.status !== 'active') {
    return { ok: false, reason: 'suspended' };
  }
  if (account.expiryDate && account.expiryDate < todayYmd) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true };
}

function getTenantEndpoint(usernameLower: string): string {
  const clean = sanitizeInput(usernameLower).toLowerCase();
  return `${FIREBASE_RTDB_URL}/tenants/${encodeURIComponent(clean)}.json`;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 7000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function cloudFetchAllTenants(): Promise<{
  ok: boolean;
  tenants: CustomerAccount[];
  error?: string;
}> {
  try {
    const res = await fetchWithTimeout(`${FIREBASE_RTDB_URL}/tenants.json`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ok: false, tenants: [], error: `HTTP ${res.status}` };
    }
    const raw = (await res.json()) as Record<string, Partial<CloudTenantRecord>> | null;
    if (!raw || typeof raw !== 'object') {
      return { ok: true, tenants: [] };
    }
    const list: CustomerAccount[] = [];
    for (const [key, val] of Object.entries(raw)) {
      if (!val || typeof val !== 'object') continue;
      const mapped = fromCloudTenantRecord(val, key);
      if (mapped) list.push(mapped);
    }
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return { ok: true, tenants: list };
  } catch (err) {
    return {
      ok: false,
      tenants: [],
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function cloudFetchTenant(usernameLower: string): Promise<{
  ok: boolean;
  tenant: CustomerAccount | null;
  error?: string;
}> {
  const clean = sanitizeInput(usernameLower).toLowerCase();
  if (!clean) return { ok: true, tenant: null };

  try {
    const res = await fetchWithTimeout(getTenantEndpoint(clean), {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ok: false, tenant: null, error: `HTTP ${res.status}` };
    }
    const raw = (await res.json()) as Partial<CloudTenantRecord> | null;
    if (!raw || typeof raw !== 'object') {
      return { ok: true, tenant: null };
    }
    return { ok: true, tenant: fromCloudTenantRecord(raw, clean) };
  } catch (err) {
    return {
      ok: false,
      tenant: null,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function cloudPutTenant(
  account: CustomerAccount
): Promise<{ ok: boolean; error?: string }> {
  const payload = toCloudTenantRecord(account);
  try {
    const res = await fetchWithTimeout(getTenantEndpoint(payload.username), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function cloudPatchTenant(
  usernameLower: string,
  patch: Partial<CloudTenantRecord>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetchWithTimeout(getTenantEndpoint(usernameLower), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function cloudDeleteTenant(
  usernameLower: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetchWithTimeout(getTenantEndpoint(usernameLower), {
      method: 'DELETE',
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

// === Router-to-Firebase Cloud Agent Telemetry, Inventory & Command Queue ===

export interface RouterActiveSession {
  user: string;
  type: 'hotspot' | 'pppoe';
  address: string;
  mac: string;
  uptime: string;
}

export interface RouterInterfaceStatus {
  name: string;
  running: boolean;
}

export interface RouterCloudTelemetry {
  board: string;
  version: string;
  cpu: number;
  freeMem: number;
  totalMem: number;
  uptime: string;
  temp: number | null;
  volt: number | null;
  rxBps: number;
  txBps: number;
  pingMs: number | null;
  interfaces: RouterInterfaceStatus[];
  hotspot: number;
  ppp: number;
  active_sessions: RouterActiveSession[];
  timestamp: number;
}

export interface RouterInjectedAccount {
  name: string;
  type: 'hotspot' | 'pppoe';
  profile: string;
  disabled: boolean;
}

export interface RouterDishNeighbor {
  identity: string;
  address: string;
  mac: string;
  interface: string;
  platform: string;
}

export interface RouterIpEntry {
  address: string;
  mac: string;
  hostName: string;
  status: string;
  source?: string;
}

export interface RouterLogEntry {
  time: string;
  topics: string;
  message: string;
}

export interface RouterCloudInventory {
  injected_accounts: RouterInjectedAccount[];
  dishes: RouterDishNeighbor[];
  ip_table: RouterIpEntry[];
  logs: RouterLogEntry[];
  timestamp: number;
}

export function parseTelemetryNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const str = String(val).trim();
  if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'none') return null;
  const match = str.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

export function parseRouterOsPingMs(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) && val >= 0 ? Math.round(val) : null;
  const str = String(val).trim();
  if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'timeout') return null;
  // Format like 00:00:00.024 or 00:00:01.250
  const colonMatch = str.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (colonMatch) {
    const hrs = Number(colonMatch[1]);
    const mins = Number(colonMatch[2]);
    const secs = Number(colonMatch[3]);
    const totalMs = (hrs * 3600 + mins * 60 + secs) * 1000;
    return Number.isFinite(totalMs) ? Math.max(1, Math.round(totalMs)) : null;
  }
  // Format like "24ms" or "24ms150us"
  const msMatch = str.match(/(\d+(?:\.\d+)?)\s*ms/i);
  if (msMatch) {
    return Math.max(1, Math.round(Number(msMatch[1])));
  }
  // Format like "450us"
  const usMatch = str.match(/(\d+(?:\.\d+)?)\s*us/i);
  if (usMatch) {
    return Math.max(1, Math.round(Number(usMatch[1]) / 1000));
  }
  const plain = Number(str);
  return Number.isFinite(plain) && plain >= 0 ? Math.round(plain) : null;
}

export function detectIpConflicts(ipTable: RouterIpEntry[]): string[] {
  const ipToMacs = new Map<string, Set<string>>();
  for (const row of ipTable) {
    const ip = (row.address || '').trim();
    const mac = (row.mac || '').trim().toUpperCase();
    if (!ip || !mac) continue;
    if (!ipToMacs.has(ip)) ipToMacs.set(ip, new Set());
    ipToMacs.get(ip)!.add(mac);
  }
  const conflicts: string[] = [];
  for (const [ip, macs] of ipToMacs.entries()) {
    if (macs.size > 1) conflicts.push(ip);
  }
  return conflicts;
}

export function evaluateRouterAlerts(params: {
  telemetry: RouterCloudTelemetry | null;
  routerName: string;
  isConnected: boolean;
  wasConnected: boolean;
  lowVoltageThreshold?: number;
  nowMs?: number;
}): import('../types/mikrocore').NocAlertItem[] {
  const {
    telemetry,
    routerName,
    isConnected,
    wasConnected,
    lowVoltageThreshold = 22.5,
    nowMs = Date.now(),
  } = params;
  const alerts: import('../types/mikrocore').NocAlertItem[] = [];

  if (wasConnected && !isConnected) {
    alerts.push({
      id: 'router_offline',
      severity: 'critical',
      titleAr: 'انقطع الاتصال بالراوتر',
      titleEn: 'Router Went Offline',
      detailAr: `توقفت نبضات الوكيل السحابي من الراوتر ${routerName} لأكثر من 60 ثانية.`,
      detailEn: `Cloud Agent heartbeat from ${routerName} stopped for over 60s.`,
      timestamp: nowMs,
    });
  }

  if (!telemetry || !isConnected) return alerts;

  if (telemetry.pingMs === null) {
    alerts.push({
      id: 'wan_packet_loss',
      severity: 'critical',
      titleAr: 'فقدان حزم أو انقطاع الإنترنت (Ping Timeout)',
      titleEn: 'Internet Packet Loss / Ping Timeout',
      detailAr: `تعذر وصول الراوتر ${routerName} إلى 1.1.1.1 — تحقق من خط الإنترنت أو الـ WAN.`,
      detailEn: `${routerName} failed to ping 1.1.1.1 — check WAN uplink.`,
      timestamp: nowMs,
    });
  } else if (telemetry.pingMs > 150) {
    alerts.push({
      id: 'high_latency',
      severity: 'warning',
      titleAr: `ارتفاع زمن الاستجابة (${telemetry.pingMs} ms)`,
      titleEn: `High Internet Latency (${telemetry.pingMs} ms)`,
      detailAr: `تجاوز البنق الحد الموصى به (>150ms) على ${routerName}.`,
      detailEn: `Latency exceeded 150ms threshold on ${routerName}.`,
      timestamp: nowMs,
    });
  }

  const downWan = telemetry.interfaces.filter(
    (iface) =>
      !iface.running &&
      /^(ether1|wan|starlink|pppoe|lte|sfp)/i.test(iface.name)
  );
  if (downWan.length > 0) {
    const names = downWan.map((i) => i.name).join(', ');
    alerts.push({
      id: `wan_down_${names}`,
      severity: 'critical',
      titleAr: `انقطاع منفذ الخط (${names})`,
      titleEn: `WAN Line Down (${names})`,
      detailAr: `الحالة غير متصلة (Not Running) للمنفذ: ${names}.`,
      detailEn: `Interface link dropped on: ${names}.`,
      timestamp: nowMs,
    });
  }

  if (telemetry.cpu > 85) {
    alerts.push({
      id: 'high_cpu',
      severity: 'critical',
      titleAr: `ضغط معالج مرتفع (${telemetry.cpu}%)`,
      titleEn: `High CPU Load (${telemetry.cpu}%)`,
      detailAr: `تجاوز استهلاك المعالج 85% على ${routerName}.`,
      detailEn: `CPU load exceeded 85% on ${routerName}.`,
      timestamp: nowMs,
    });
  }

  if (telemetry.temp !== null && telemetry.temp > 65) {
    alerts.push({
      id: 'high_temp',
      severity: 'critical',
      titleAr: `ارتفاع حرارة الراوتر (${telemetry.temp}°C)`,
      titleEn: `High Router Temperature (${telemetry.temp}°C)`,
      detailAr: `تجاوزت حرارة المعالج/اللوحة 65°C على ${routerName}.`,
      detailEn: `Hardware temperature exceeded 65°C on ${routerName}.`,
      timestamp: nowMs,
    });
  }

  if (telemetry.volt !== null && telemetry.volt > 0 && telemetry.volt < lowVoltageThreshold) {
    alerts.push({
      id: 'low_battery_voltage',
      severity: 'critical',
      titleAr: `انخفاض جهد البطارية (${telemetry.volt}V)`,
      titleEn: `Low Battery Voltage (${telemetry.volt}V)`,
      detailAr: `هبط الجهد على ${routerName} دون الحد الآمن (${lowVoltageThreshold}V) — يُنصح بتشغيل حارس البطارية.`,
      detailEn: `Voltage on ${routerName} dropped below ${lowVoltageThreshold}V threshold.`,
      timestamp: nowMs,
    });
  }

  return alerts;
}

export function getRouterCloudBase(tenantUuid: string, routerId: string): string {
  const safeTenant = sanitizeCliToken(tenantUuid, 'tenant');
  const safeRouterId = sanitizeCliToken(routerId, 'router_sandbox_1');
  return `${FIREBASE_RTDB_URL}/routers/${encodeURIComponent(safeTenant)}/${encodeURIComponent(safeRouterId)}`;
}

export function isTelemetryFresh(
  telemetry: Partial<RouterCloudTelemetry> | null | undefined,
  nowMs: number = Date.now(),
  maxAgeMs: number = 60_000
): boolean {
  if (!telemetry || typeof telemetry !== 'object') return false;
  if (!telemetry.board || typeof telemetry.board !== 'string') return false;
  if (typeof telemetry.timestamp !== 'number' || !Number.isFinite(telemetry.timestamp)) {
    return false;
  }
  return Math.abs(nowMs - telemetry.timestamp) <= maxAgeMs;
}

export async function cloudFetchRouterTelemetry(
  tenantUuid: string,
  routerId: string
): Promise<{
  ok: boolean;
  telemetry: RouterCloudTelemetry | null;
  isFresh: boolean;
  error?: string;
}> {
  try {
    const res = await fetchWithTimeout(
      `${getRouterCloudBase(tenantUuid, routerId)}/telemetry.json`,
      { method: 'GET', cache: 'no-store' }
    );
    if (!res.ok) {
      return { ok: false, telemetry: null, isFresh: false, error: `HTTP ${res.status}` };
    }
    const raw = (await res.json()) as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object' || !raw.board) {
      return { ok: true, telemetry: null, isFresh: false };
    }

    const rawSessions = Array.isArray(raw.active_sessions) ? raw.active_sessions : [];
    const active_sessions: RouterActiveSession[] = rawSessions
      .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
      .map((s) => ({
        user: String(s.user || ''),
        type: s.type === 'pppoe' ? 'pppoe' : 'hotspot',
        address: String(s.address || ''),
        mac: String(s.mac || ''),
        uptime: String(s.uptime || ''),
      }));

    const rawIfaces = Array.isArray(raw.interfaces) ? raw.interfaces : [];
    const interfaces: RouterInterfaceStatus[] = rawIfaces
      .filter((i): i is Record<string, unknown> => Boolean(i && typeof i === 'object'))
      .map((i) => ({
        name: String(i.name || ''),
        running: Boolean(i.running),
      }));

    const telemetry: RouterCloudTelemetry = {
      board: String(raw.board),
      version: String(raw.version || ''),
      cpu: Number(raw.cpu) || 0,
      freeMem: Number(raw.freeMem) || 0,
      totalMem: Number(raw.totalMem) || 0,
      uptime: String(raw.uptime || '0s'),
      temp: parseTelemetryNumber(raw.temp),
      volt: parseTelemetryNumber(raw.volt),
      rxBps: Math.max(0, parseTelemetryNumber(raw.rxBps) ?? 0),
      txBps: Math.max(0, parseTelemetryNumber(raw.txBps) ?? 0),
      pingMs: parseRouterOsPingMs(raw.pingMs),
      interfaces,
      hotspot: Number(raw.hotspot) || 0,
      ppp: Number(raw.ppp) || 0,
      active_sessions,
      timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : 0,
    };
    return {
      ok: true,
      telemetry,
      isFresh: isTelemetryFresh(telemetry),
    };
  } catch (err) {
    return {
      ok: false,
      telemetry: null,
      isFresh: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function cloudFetchRouterInventory(
  tenantUuid: string,
  routerId: string
): Promise<{ ok: boolean; inventory: RouterCloudInventory | null; error?: string }> {
  try {
    const res = await fetchWithTimeout(
      `${getRouterCloudBase(tenantUuid, routerId)}/inventory.json`,
      { method: 'GET', cache: 'no-store' }
    );
    if (!res.ok) {
      return { ok: false, inventory: null, error: `HTTP ${res.status}` };
    }
    const raw = (await res.json()) as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') {
      return { ok: true, inventory: null };
    }

    const injected_accounts: RouterInjectedAccount[] = (
      Array.isArray(raw.injected_accounts) ? raw.injected_accounts : []
    )
      .filter((a): a is Record<string, unknown> => Boolean(a && typeof a === 'object'))
      .map((a) => ({
        name: String(a.name || ''),
        type: a.type === 'pppoe' ? 'pppoe' : 'hotspot',
        profile: String(a.profile || 'default'),
        disabled: Boolean(a.disabled),
      }));

    const dishes: RouterDishNeighbor[] = (Array.isArray(raw.dishes) ? raw.dishes : [])
      .filter((d): d is Record<string, unknown> => Boolean(d && typeof d === 'object'))
      .map((d) => ({
        identity: String(d.identity || ''),
        address: String(d.address || ''),
        mac: String(d.mac || ''),
        interface: String(d.interface || ''),
        platform: String(d.platform || ''),
      }));

    const ip_table: RouterIpEntry[] = (Array.isArray(raw.ip_table) ? raw.ip_table : [])
      .filter((ip): ip is Record<string, unknown> => Boolean(ip && typeof ip === 'object'))
      .map((ip) => ({
        address: String(ip.address || ''),
        mac: String(ip.mac || ''),
        hostName: String(ip.hostName || ''),
        status: String(ip.status || ''),
        source: ip.source ? String(ip.source) : undefined,
      }));

    const logs: RouterLogEntry[] = (Array.isArray(raw.logs) ? raw.logs : [])
      .filter((l): l is Record<string, unknown> => Boolean(l && typeof l === 'object'))
      .map((l) => ({
        time: String(l.time || ''),
        topics: String(l.topics || ''),
        message: String(l.message || ''),
      }));

    return {
      ok: true,
      inventory: {
        injected_accounts,
        dishes,
        ip_table,
        logs,
        timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
      },
    };
  } catch (err) {
    return {
      ok: false,
      inventory: null,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function cloudSendRouterCommand(
  tenantUuid: string,
  routerId: string,
  commandScript: string
): Promise<{ ok: boolean; error?: string }> {
  const cleanScript = commandScript.trim();
  if (!cleanScript) {
    return { ok: false, error: 'Empty command script' };
  }
  try {
    const res = await fetchWithTimeout(
      `${getRouterCloudBase(tenantUuid, routerId)}/command.json`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanScript),
      }
    );
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function cloudWaitForCommandExecution(
  tenantUuid: string,
  routerId: string,
  timeoutMs: number = 16_000,
  pollIntervalMs: number = 1_500
): Promise<{ executed: boolean; timedOut: boolean; error?: string }> {
  const startedAt = Date.now();
  const endpoint = `${getRouterCloudBase(tenantUuid, routerId)}/command.json`;

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    try {
      const res = await fetchWithTimeout(endpoint, { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        const val = await res.json();
        if (val === null || val === '') {
          return { executed: true, timedOut: false };
        }
      }
    } catch {
      // keep polling until timeout
    }
  }
  return { executed: false, timedOut: true };
}

export async function cloudSendAndAwaitRouterCommand(
  tenantUuid: string,
  routerId: string,
  commandScript: string,
  onQueued?: () => void
): Promise<{ ok: boolean; executed: boolean; timedOut: boolean; error?: string }> {
  const sendRes = await cloudSendRouterCommand(tenantUuid, routerId, commandScript);
  if (!sendRes.ok) {
    return { ok: false, executed: false, timedOut: false, error: sendRes.error };
  }
  onQueued?.();
  const waitRes = await cloudWaitForCommandExecution(tenantUuid, routerId);
  return {
    ok: true,
    executed: waitRes.executed,
    timedOut: waitRes.timedOut,
    error: waitRes.error,
  };
}

export async function cloudRequestInventorySync(
  tenantUuid: string,
  routerId: string,
  onQueued?: () => void
): Promise<{
  ok: boolean;
  executed: boolean;
  inventory: RouterCloudInventory | null;
  error?: string;
}> {
  const cmdRes = await cloudSendAndAwaitRouterCommand(
    tenantUuid,
    routerId,
    'SYNC_INVENTORY',
    onQueued
  );
  if (!cmdRes.ok) {
    return { ok: false, executed: false, inventory: null, error: cmdRes.error };
  }
  const invRes = await cloudFetchRouterInventory(tenantUuid, routerId);
  return {
    ok: invRes.ok,
    executed: cmdRes.executed,
    inventory: invRes.inventory,
    error: invRes.error,
  };
}

// === Global Owner Update Broadcast ===

export async function cloudFetchSystemBroadcast(): Promise<{
  ok: boolean;
  broadcast: import('../types/mikrocore').SystemBroadcast | null;
  error?: string;
}> {
  try {
    const res = await fetchWithTimeout(`${FIREBASE_RTDB_URL}/system_broadcast.json`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ok: false, broadcast: null, error: `HTTP ${res.status}` };
    }
    const raw = (await res.json()) as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object' || !raw.id || !raw.message) {
      return { ok: true, broadcast: null };
    }
    return {
      ok: true,
      broadcast: {
        id: String(raw.id),
        title: String(raw.title || ''),
        message: String(raw.message || ''),
        timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
      },
    };
  } catch (err) {
    return {
      ok: false,
      broadcast: null,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function cloudPublishSystemBroadcast(
  title: string,
  message: string
): Promise<{
  ok: boolean;
  broadcast?: import('../types/mikrocore').SystemBroadcast;
  error?: string;
}> {
  const cleanTitle = sanitizeInput(title);
  const cleanMessage = sanitizeInput(message);
  if (!cleanTitle || !cleanMessage) {
    return { ok: false, error: 'Title and message are required' };
  }
  const broadcast: import('../types/mikrocore').SystemBroadcast = {
    id: generateUUID(),
    title: cleanTitle,
    message: cleanMessage,
    timestamp: Date.now(),
  };
  try {
    const res = await fetchWithTimeout(`${FIREBASE_RTDB_URL}/system_broadcast.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(broadcast),
    });
    return res.ok ? { ok: true, broadcast } : { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function cloudFetchRouterPublicInfo(
  tenantUuid: string,
  routerId: string
): Promise<{
  ok: boolean;
  info: import('../types/mikrocore').RouterPublicInfo | null;
  error?: string;
}> {
  try {
    const res = await fetchWithTimeout(
      `${getRouterCloudBase(tenantUuid, routerId)}/public_info.json`,
      { method: 'GET', cache: 'no-store' }
    );
    if (!res.ok) {
      return { ok: false, info: null, error: `HTTP ${res.status}` };
    }
    const raw = (await res.json()) as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') {
      return { ok: true, info: null };
    }
    const directIp = String(raw.directIp || '').trim();
    const directInterface = String(raw.directInterface || '').trim();
    const cloudExitIp = String(raw.cloudExitIp || '').trim();
    const rawPublicIp = String(raw.publicIp || '').trim();
    const cloudDns = String(raw.cloudDns || '').trim();
    const publicIp = directIp || rawPublicIp || cloudExitIp;
    if (!publicIp && !cloudDns) {
      return { ok: true, info: null };
    }
    return {
      ok: true,
      info: {
        publicIp,
        ...(directIp ? { directIp } : {}),
        ...(directInterface ? { directInterface } : {}),
        ...(cloudExitIp ? { cloudExitIp } : {}),
        cloudDns,
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
      },
    };
  } catch (err) {
    return {
      ok: false,
      info: null,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}


