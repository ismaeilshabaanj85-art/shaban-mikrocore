import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIREBASE_RTDB_URL,
  cloudFetchRouterInventory,
  cloudFetchRouterTelemetry,
  cloudFetchSystemBroadcast,
  cloudPublishSystemBroadcast,
  cloudRequestInventorySync,
  cloudSendAndAwaitRouterCommand,
  detectIpConflicts,
  evaluateRouterAlerts,
  fromCloudTenantRecord,
  getRouterCloudBase,
  isTelemetryFresh,
  parseRouterOsPingMs,
  parseTelemetryNumber,
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

test('parseTelemetryNumber, parseRouterOsPingMs, detectIpConflicts, and evaluateRouterAlerts handle edge cases accurately', () => {
  assert.equal(parseTelemetryNumber(null), null);
  assert.equal(parseTelemetryNumber('null'), null);
  assert.equal(parseTelemetryNumber('none'), null);
  assert.equal(parseTelemetryNumber(42), 42);
  assert.equal(parseTelemetryNumber('42C'), 42);
  assert.equal(parseTelemetryNumber('24.2V'), 24.2);

  assert.equal(parseRouterOsPingMs(null), null);
  assert.equal(parseRouterOsPingMs('timeout'), null);
  assert.equal(parseRouterOsPingMs(24), 24);
  assert.equal(parseRouterOsPingMs('24ms'), 24);
  assert.equal(parseRouterOsPingMs('00:00:00.024'), 24);
  assert.equal(parseRouterOsPingMs('450us'), 1);

  const conflicts = detectIpConflicts([
    { address: '192.168.88.10', mac: 'AA:BB:CC:00:00:01', hostName: 'PC1', status: 'bound' },
    { address: '192.168.88.10', mac: 'AA:BB:CC:00:00:02', hostName: 'Intruder', status: 'arp' },
    { address: '192.168.88.11', mac: 'AA:BB:CC:00:00:03', hostName: 'Phone', status: 'bound' },
    { address: '192.168.88.11', mac: 'aa:bb:cc:00:00:03', hostName: 'Phone', status: 'arp' },
  ]);
  assert.deepEqual(conflicts, ['192.168.88.10']);

  const offlineAlerts = evaluateRouterAlerts({
    telemetry: null,
    routerName: 'Tower-A',
    isConnected: false,
    wasConnected: true,
    nowMs: 1000,
  });
  assert.equal(offlineAlerts.some((a) => a.id === 'router_offline'), true);

  const criticalAlerts = evaluateRouterAlerts({
    telemetry: {
      board: 'RB5009',
      version: '7.16',
      cpu: 91,
      freeMem: 512000,
      totalMem: 1024000,
      uptime: '1d',
      temp: 71,
      volt: 24,
      rxBps: 50_000_000,
      txBps: 10_000_000,
      pingMs: 185,
      interfaces: [{ name: 'ether1-WAN', running: false }],
      hotspot: 10,
      ppp: 5,
      active_sessions: [],
      timestamp: 1000,
    },
    routerName: 'Tower-A',
    isConnected: true,
    wasConnected: true,
    nowMs: 1000,
  });
  assert.equal(criticalAlerts.some((a) => a.id === 'high_latency'), true);
  assert.equal(criticalAlerts.some((a) => a.id === 'wan_down_ether1-WAN'), true);
  assert.equal(criticalAlerts.some((a) => a.id === 'high_cpu'), true);
  assert.equal(criticalAlerts.some((a) => a.id === 'high_temp'), true);

  const timeoutAlerts = evaluateRouterAlerts({
    telemetry: {
      board: 'hEX',
      version: '6.49',
      cpu: 15,
      freeMem: 100,
      totalMem: 256,
      uptime: '2h',
      temp: null,
      volt: 21.8,
      rxBps: 1000,
      txBps: 500,
      pingMs: null,
      interfaces: [{ name: 'ether1-WAN', running: true }],
      hotspot: 0,
      ppp: 0,
      active_sessions: [],
      timestamp: 1000,
    },
    routerName: 'Tower-B',
    isConnected: true,
    wasConnected: true,
    lowVoltageThreshold: 22.5,
    nowMs: 1000,
  });
  assert.equal(timeoutAlerts.some((a) => a.id === 'wan_packet_loss'), true);
  assert.equal(timeoutAlerts.some((a) => a.id === 'low_battery_voltage'), true);
});

test('cloudFetchRouterInventory, cloudRequestInventorySync, and system broadcast endpoints work via mocked fetch', async () => {
  const originalFetch = globalThis.fetch;
  let storedBroadcast: Record<string, unknown> | null = null;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';

    if (url.endsWith('/command.json') && method === 'PUT') {
      return new Response(init?.body || '""', { status: 200 });
    }
    if (url.endsWith('/command.json') && method === 'GET') {
      return new Response('null', { status: 200 });
    }
    if (url.endsWith('/inventory.json') && method === 'GET') {
      return new Response(
        JSON.stringify({
          injected_accounts: [{ name: 'MC-101', type: 'hotspot', profile: '8M-Plus', disabled: false }],
          dishes: [{ identity: 'Dish-North', address: '10.10.1.5', mac: 'AA:11:22:33:44:55', interface: 'ether2', platform: 'MikroTik' }],
          ip_table: [{ address: '192.168.88.20', mac: '11:22:33:44:55:66', hostName: 'Client', status: 'bound' }],
          logs: [{ time: '10:00:00', topics: 'hotspot,info', message: 'MC-101 logged in' }],
          timestamp: 1_700_000_000_000,
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/system_broadcast.json') && method === 'PUT') {
      storedBroadcast = JSON.parse(String(init?.body || '{}'));
      return new Response(JSON.stringify(storedBroadcast), { status: 200 });
    }
    if (url.endsWith('/system_broadcast.json') && method === 'GET') {
      return new Response(JSON.stringify(storedBroadcast), { status: 200 });
    }
    return new Response('null', { status: 404 });
  }) as typeof fetch;

  try {
    const invOnly = await cloudFetchRouterInventory('tenant-x', 'r1');
    assert.equal(invOnly.ok, true);
    assert.equal(invOnly.inventory?.injected_accounts.length, 1);
    assert.equal(invOnly.inventory?.dishes[0].identity, 'Dish-North');

    let queued = false;
    const syncRes = await cloudRequestInventorySync('tenant-x', 'r1', () => {
      queued = true;
    });
    assert.equal(queued, true);
    assert.equal(syncRes.ok, true);
    assert.equal(syncRes.executed, true);
    assert.equal(syncRes.inventory?.logs[0].message, 'MC-101 logged in');

    const pubRes = await cloudPublishSystemBroadcast('تحديث v2.5', 'تمت إضافة مراقبة الصحون');
    assert.equal(pubRes.ok, true);
    assert.ok(pubRes.broadcast?.id);

    const fetched = await cloudFetchSystemBroadcast();
    assert.equal(fetched.ok, true);
    assert.equal(fetched.broadcast?.title, 'تحديث v2.5');
    assert.equal(fetched.broadcast?.message, 'تمت إضافة مراقبة الصحون');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
