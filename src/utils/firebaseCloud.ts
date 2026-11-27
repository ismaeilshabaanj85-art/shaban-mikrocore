import { CustomerAccount } from '../types/mikrocore';
import { constantTimeEqual, generateUUID, sanitizeInput } from './security';

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
