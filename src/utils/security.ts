export const SUPER_ADMIN_USERNAME = 'ismaeil';
// SHA-256 digest of Super Admin password
export const SUPER_ADMIN_PASSWORD_HASH =
  '2aa4e664c7b19d8f0b430f06bd40348e1b7f1962da1b14af7718d2432782d66a';

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 60_000;

/**
 * Pure TypeScript fallback SHA-256 implementation for environments without SubtleCrypto.
 */
function sha256Fallback(ascii: string): string {
  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  let msg = ascii + '\x80';
  while ((msg.length % 64) - 56) msg += '\x00';
  for (let i = 0; i < msg.length; i++) {
    const j = msg.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);

      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Computes SHA-256 hex digest using Web Crypto API (with deterministic fallback).
 */
export async function sha256Hex(input: string): Promise<string> {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(unescape(encodeURIComponent(input)));
}

/**
 * Constant-time string comparison to avoid timing leaks.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Sanitizes free-text user inputs against XSS vectors and script injections.
 */
export function sanitizeInput(value: string): string {
  return value
    .replace(/<[^>]*>?/gm, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[<>`]/g, '')
    .trim();
}

/**
 * Sanitizes technical identifiers (RouterOS interface names, usernames, hostnames)
 * to prevent command injection in generated CLI scripts.
 */
export function sanitizeCliToken(value: string, fallback = 'default'): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._:/@-]/g, '').trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Generates a compliant UUID v4 for Tenant isolation.
 */
export function generateUUID(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Builds an isolated localStorage key scoped strictly to a specific Tenant UUID.
 */
export function getTenantStorageKey(tenantUuid: string, resource: string): string {
  const safeTenant = sanitizeCliToken(tenantUuid, 'default');
  const safeRes = sanitizeCliToken(resource, 'data');
  return `mikrocore_tenant_${safeTenant}_${safeRes}`;
}

export interface LockoutState {
  failedAttempts: number;
  lockedUntil: number | null;
}

export function evaluateLoginFailure(
  current: LockoutState,
  nowMs: number = Date.now()
): LockoutState {
  if (current.lockedUntil && nowMs < current.lockedUntil) {
    return current;
  }
  const nextAttempts =
    current.lockedUntil && nowMs >= current.lockedUntil ? 1 : current.failedAttempts + 1;
  if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
    return {
      failedAttempts: nextAttempts,
      lockedUntil: nowMs + LOCKOUT_DURATION_MS,
    };
  }
  return {
    failedAttempts: nextAttempts,
    lockedUntil: null,
  };
}

export function getRemainingLockoutSeconds(
  state: LockoutState,
  nowMs: number = Date.now()
): number {
  if (!state.lockedUntil || nowMs >= state.lockedUntil) return 0;
  return Math.ceil((state.lockedUntil - nowMs) / 1000);
}
