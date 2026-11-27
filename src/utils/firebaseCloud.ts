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

// === Router-to-Firebase Cloud Agent Telemetry & Command Queue ===

export interface RouterCloudTelemetry {
  board: string;
  version: string;
  cpu: number;
  freeMem: number;
  totalMem: number;
  uptime: string;
  hotspot: number;
  ppp: number;
  timestamp: number;
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
    const raw = (await res.json()) as Partial<RouterCloudTelemetry> | null;
    if (!raw || typeof raw !== 'object' || !raw.board) {
      return { ok: true, telemetry: null, isFresh: false };
    }
    const telemetry: RouterCloudTelemetry = {
      board: String(raw.board),
      version: String(raw.version || ''),
      cpu: Number(raw.cpu) || 0,
      freeMem: Number(raw.freeMem) || 0,
      totalMem: Number(raw.totalMem) || 0,
      uptime: String(raw.uptime || '0s'),
      hotspot: Number(raw.hotspot) || 0,
      ppp: Number(raw.ppp) || 0,
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
  timeoutMs: number = 22_000,
  pollIntervalMs: number = 2_000
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

