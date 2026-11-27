import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPER_ADMIN_PASSWORD_HASH,
  evaluateLoginFailure,
  getRemainingLockoutSeconds,
  getTenantStorageKey,
  sanitizeCliToken,
  sanitizeInput,
  sha256Hex,
} from './security';

test('sha256Hex produces deterministic digest matching Super Admin password hash', async () => {
  const hash = await sha256Hex('ismiso885122025');
  assert.equal(hash, SUPER_ADMIN_PASSWORD_HASH);
});

test('sanitizeInput strips HTML tags, script tags, and javascript URLs', () => {
  const dirty = '<script>alert(1)</script>Hello <img onerror=alert(1)> javascript:void(0)';
  const clean = sanitizeInput(dirty);
  assert.equal(clean.includes('<script>'), false);
  assert.equal(clean.includes('javascript:'), false);
  assert.equal(clean.includes('onerror='), false);
  assert.equal(clean.includes('Hello'), true);
});

test('sanitizeCliToken strips shell/RouterOS injection characters', () => {
  assert.equal(sanitizeCliToken('ether1; /system reboot'), 'ether1/systemreboot');
  assert.equal(sanitizeCliToken('   ', 'fallback'), 'fallback');
});

test('brute-force protection locks login for 60s after 5 failed attempts', () => {
  let state = { failedAttempts: 0, lockedUntil: null as number | null };
  const t0 = 1_000_000;
  for (let i = 0; i < 4; i++) {
    state = evaluateLoginFailure(state, t0);
    assert.equal(state.lockedUntil, null);
  }
  state = evaluateLoginFailure(state, t0);
  assert.equal(state.failedAttempts, 5);
  assert.equal(state.lockedUntil, t0 + 60_000);
  assert.equal(getRemainingLockoutSeconds(state, t0 + 15_000), 45);
  assert.equal(getRemainingLockoutSeconds(state, t0 + 61_000), 0);
});

test('getTenantStorageKey enforces strict multi-tenant namespace isolation', () => {
  const keyA = getTenantStorageKey('uuid-tenant-a', 'routers');
  const keyB = getTenantStorageKey('uuid-tenant-b', 'routers');
  assert.notEqual(keyA, keyB);
  assert.equal(keyA, 'mikrocore_tenant_uuid-tenant-a_routers');
});
