import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIREBASE_RTDB_URL,
  cloudFetchRouterTelemetry,
  cloudSendAndAwaitRouterCommand,
  fromCloudTenantRecord,
  getRouterCloudBase,
  isTelemetryFresh,
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

test('getRouterCloudBase and isTelemetryFresh validate Cloud Agent telemetry paths and 60s window', () => {
  const base = getRouterCloudBase('tenant-uuid-1', 'router_1');
  assert.equal(
    base,
    'https://shaban-mikrocore-default-rtdb.firebaseio.com/routers/tenant-uuid-1/router_1'
  );

  const now = 1_700_000_000_000;
  assert.equal(isTelemetryFresh({ board: 'RB1100AHx4', timestamp: now - 15_000 }, now), true);
  assert.equal(isTelemetryFresh({ board: 'RB1100AHx4', timestamp: now - 65_000 }, now), false);
  assert.equal(isTelemetryFresh({ board: '', timestamp: now }, now), false);
  assert.equal(isTelemetryFresh(null, now), false);
});

test('cloudFetchRouterTelemetry and cloudSendAndAwaitRouterCommand interact with RTDB endpoints cleanly', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  let commandPollCount = 0;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';
    calls.push({ url, method, body: typeof init?.body === 'string' ? init.body : undefined });

    if (url.endsWith('/telemetry.json') && method === 'GET') {
      return new Response(
        JSON.stringify({
          board: 'RB1100AHx4',
          version: '7.16',
          cpu: 28,
          freeMem: 3000000000,
          totalMem: 4000000000,
          uptime: '5d 04:10:00',
          hotspot: 85,
          ppp: 32,
          timestamp: Date.now() - 4000,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.endsWith('/command.json') && method === 'PUT') {
      return new Response(JSON.stringify('/system note set note="ok"'), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.endsWith('/command.json') && method === 'GET') {
      commandPollCount += 1;
      return new Response(JSON.stringify(null), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('null', { status: 404 });
  }) as typeof fetch;

  try {
    const telRes = await cloudFetchRouterTelemetry('tenant-abc', 'r1');
    assert.equal(telRes.ok, true);
    assert.equal(telRes.isFresh, true);
    assert.equal(telRes.telemetry?.board, 'RB1100AHx4');
    assert.equal(telRes.telemetry?.hotspot, 85);

    let queuedCallbackFired = false;
    const cmdRes = await cloudSendAndAwaitRouterCommand(
      'tenant-abc',
      'r1',
      '/ip hotspot user add name="MC-100"',
      () => {
        queuedCallbackFired = true;
      }
    );

    assert.equal(queuedCallbackFired, true);
    assert.equal(cmdRes.ok, true);
    assert.equal(cmdRes.executed, true);
    assert.equal(commandPollCount, 1);
    assert.equal(calls.some((c) => c.method === 'PUT' && c.url.endsWith('/command.json')), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
