import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIREBASE_RTDB_URL,
  fromCloudTenantRecord,
  toCloudTenantRecord,
  validateTenantLoginState,
} from './firebaseCloud';
import { sha256Hex } from './security';
import { CustomerAccount } from '../types/mikrocore';

test('toCloudTenantRecord and fromCloudTenantRecord round-trip RTDB tenant schema cleanly', async () => {
  const passwordHash = await sha256Hex('ClientPass#123');
  const account: CustomerAccount = {
    id: 'acc-1',
    tenantUuid: 'uuid-tenant-1',
    username: 'StarNet_SY',
    passwordHash,
    customerName: 'شبكة النجم السريع',
    maxRouters: 10,
    expiryDate: '2027-06-01',
    status: 'active',
    createdAt: '2026-11-27T00:00:00.000Z',
  };

  assert.equal(FIREBASE_RTDB_URL, 'https://shaban-mikrocore-default-rtdb.firebaseio.com');

  const cloud = toCloudTenantRecord(account);
  assert.equal(cloud.username, 'starnet_sy');
  assert.equal(cloud.networkName, 'شبكة النجم السريع');
  assert.equal(cloud.expiresAt, '2027-06-01');
  assert.equal(cloud.isActive, true);
  assert.equal(cloud.passwordHash, passwordHash);

  const restored = fromCloudTenantRecord(cloud, 'starnet_sy');
  assert.ok(restored);
  assert.equal(restored.username, 'starnet_sy');
  assert.equal(restored.customerName, 'شبكة النجم السريع');
  assert.equal(restored.expiryDate, '2027-06-01');
  assert.equal(restored.status, 'active');
  assert.equal(restored.tenantUuid, 'uuid-tenant-1');
});

test('validateTenantLoginState enforces password, active status, and subscription expiry', async () => {
  const goodHash = await sha256Hex('Secret123');
  const badHash = await sha256Hex('WrongPass');

  const base: CustomerAccount = {
    id: 'acc-2',
    tenantUuid: 'uuid-2',
    username: 'syria_wisp',
    passwordHash: goodHash,
    customerName: 'Syria WISP',
    maxRouters: 5,
    expiryDate: '2026-12-31',
    status: 'active',
    createdAt: '2026-11-01T00:00:00.000Z',
  };

  assert.deepEqual(validateTenantLoginState(base, goodHash, '2026-11-27'), { ok: true });
  assert.deepEqual(validateTenantLoginState(base, badHash, '2026-11-27'), {
    ok: false,
    reason: 'invalid',
  });
  assert.deepEqual(
    validateTenantLoginState({ ...base, status: 'suspended' }, goodHash, '2026-11-27'),
    { ok: false, reason: 'suspended' }
  );
  assert.deepEqual(
    validateTenantLoginState({ ...base, expiryDate: '2026-11-26' }, goodHash, '2026-11-27'),
    { ok: false, reason: 'expired' }
  );
});
