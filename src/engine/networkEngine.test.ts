import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIKROCORE_BRIDGE_URL,
  PRESET_SPEED_PROFILES,
  executeRouterOsV7Rest,
  generateAntiNetcutSecurityShield,
  generateAutoRollbackGuard,
  generateCiscoIosCli,
  generateMultiWanPcc,
  generateOneLineConnector,
  generateSafeFamilyRollbackScript,
  generateSafeFamilyShieldScript,
  generateSpeedProfileScript,
  generateStarlinkGamingOptimizer,
  generateVoucherBatch,
  generateZeroTouchBootstrap,
} from './networkEngine';

test('RouterOS v6 vs v7 syntax is strictly separated in PCC Load Balancing', () => {
  const baseConfig = {
    lanInterface: 'bridge-LAN',
    lanSubnet: '192.168.88.0/24',
    wans: [
      { id: 'w1', name: 'Starlink', interfaceName: 'ether1', gateway: '192.168.1.1', weight: 2 },
      { id: 'w2', name: 'Fiber', interfaceName: 'ether2', gateway: '192.168.2.1', weight: 1 },
    ],
    enableFailover: true,
    pingTarget: '1.1.1.1',
  };

  const v7 = generateMultiWanPcc({ ...baseConfig, osVersion: 'v7' });
  const v6 = generateMultiWanPcc({ ...baseConfig, osVersion: 'v6' });

  assert.equal(v7.includes('/routing table add name=to-WAN1 fib'), true);
  assert.equal(v7.includes('routing-table="to-WAN1"'), true);
  assert.equal(v7.includes('per-connection-classifier=both-addresses-and-ports:3/0'), true);
  assert.equal(v7.includes('per-connection-classifier=both-addresses-and-ports:3/2'), true);

  assert.equal(v6.includes('/routing table add'), false);
  assert.equal(v6.includes('routing-mark="to-WAN1"'), true);
  assert.equal(v6.includes('check-gateway=ping'), true);
});

test('Auto-Rollback Safety Guard creates 60s scheduler and backup', () => {
  const guard = generateAutoRollbackGuard('v7', 60);
  assert.equal(guard.includes('/system backup save name=MikroCore_SafeSnapshot'), true);
  assert.equal(guard.includes('interval=60s'), true);
  assert.equal(guard.includes('MikroCore_AutoRollback'), true);
});

test('One-Line Connector emits universal v6 & v7 MikroCore_CloudAgent script with telemetry & command polling', () => {
  const v7Conn = generateOneLineConnector({
    osVersion: 'v7',
    tenantUuid: 'tenant-123',
    routerId: 'router_alpha',
    apiUser: 'apiuser',
    apiPassword: 'secret',
    enableCloudDdns: true,
    port: 80,
  });
  const v6Conn = generateOneLineConnector({
    osVersion: 'v6',
    tenantUuid: 'tenant-123',
    routerId: 'router_alpha',
    apiUser: 'apiuser',
    apiPassword: 'secret',
    enableCloudDdns: false,
    port: 8728,
  });

  assert.equal(
    v7Conn.startsWith(':do { /system scheduler remove [find name="MikroCore_CloudAgent"] } on-error={};'),
    true
  );
  assert.equal(v7Conn, v6Conn);
  assert.equal(v7Conn.includes('interval=15s'), true);
  assert.equal(v7Conn.includes('/routers/tenant-123/router_alpha/telemetry.json'), true);
  assert.equal(v7Conn.includes('/routers/tenant-123/router_alpha/command.json'), true);
  assert.equal(v7Conn.includes('[:parse \\$clean]'), true);
  assert.equal(v7Conn.includes('http-method=delete'), true);
  assert.equal(v7Conn.includes('/ip hotspot active print count-only'), true);
  assert.equal(v7Conn.includes('/ppp active print count-only'), true);
});

test('executeRouterOsV7Rest routes requests through Cloudflare Worker Bridge with http:// on port 80 and https:// on port 443', async () => {
  const originalFetch = globalThis.fetch;
  const captured: Array<{ url: string; method: string; headers: Record<string, string> }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({
      url: String(input),
      method: init?.method || 'GET',
      headers: (init?.headers as Record<string, string>) || {},
    });
    return new Response(JSON.stringify({ 'cpu-load': 12 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const res80 = await executeRouterOsV7Rest(
      {
        id: 'r1',
        name: 'Core',
        model: 'RB5009',
        osVersion: 'v7',
        connectionMethod: 'cloud_ddns',
        host: 'abc123.sn.mynetname.net',
        port: 80,
        apiUser: 'mikro',
        apiPassword: 'pass',
        useHttps: true,
        status: 'disconnected',
      },
      '/system/resource',
      'GET'
    );

    const res443 = await executeRouterOsV7Rest(
      {
        id: 'r1',
        name: 'Core',
        model: 'RB5009',
        osVersion: 'v7',
        connectionMethod: 'cloud_ddns',
        host: 'abc123.sn.mynetname.net',
        port: 443,
        apiUser: 'mikro',
        apiPassword: 'pass',
        useHttps: true,
        status: 'disconnected',
      },
      '/system/resource',
      'GET'
    );

    assert.equal(res80.ok, true);
    assert.equal(res443.ok, true);
    assert.equal(captured[0].url, MIKROCORE_BRIDGE_URL);
    assert.equal(captured[0].method, 'GET');
    assert.equal(captured[0].headers['X-Target-Url'], 'http://abc123.sn.mynetname.net:80/rest/system/resource');
    assert.equal(captured[0].headers.Authorization, `Basic ${btoa('mikro:pass')}`);
    assert.equal(captured[0].headers['Content-Type'], 'application/json');
    assert.equal(captured[1].headers['X-Target-Url'], 'https://abc123.sn.mynetname.net:443/rest/system/resource');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Zero-Touch Bootstrap includes WAN, Bridge, DHCP, NAT, and Hotspot/PPPoE', () => {
  const script = generateZeroTouchBootstrap({
    osVersion: 'v7',
    routerIdentity: 'Shaban-Tower1',
    wanType: 'starlink_dhcp',
    wanInterface: 'ether1',
    wanPppoeUser: '',
    wanPppoePass: '',
    wanStaticIp: '',
    wanGateway: '',
    hasSecondaryWan: true,
    secondaryWanInterface: 'ether2',
    secondaryWanType: 'static',
    secondaryWanStaticIp: '10.10.0.2/24',
    secondaryWanGateway: '10.10.0.1',
    lanBridgeName: 'bridge-LAN',
    lanPorts: ['ether3', 'ether4'],
    lanSubnet: '192.168.88.1/24',
    dhcpRange: '192.168.88.10-192.168.88.254',
    serviceMode: 'dual',
    hotspotDnsName: 'wifi.shaban.net',
    dnsProvider: 'cloudflare_doh',
    adminPassword: 'StrongPass123',
    apiUsername: 'mikrocore-api',
    apiPassword: 'ApiPass123',
    tenantUuid: 'abc-999',
  });
  assert.equal(script.includes('Starlink MSS Optimization'), true);
  assert.equal(script.includes('/ip hotspot add'), true);
  assert.equal(script.includes('/interface pppoe-server server add'), true);
  assert.equal(script.includes('use-doh-server=https://cloudflare-dns.com/dns-query'), true);
});

test('Voucher Batch generates up to 1000 unique vouchers & second-accurate expiry profile', () => {
  const profile = PRESET_SPEED_PROFILES[3]; // 8M
  const batch = generateVoucherBatch({
    count: 250,
    prefix: 'MC-',
    codeLength: 6,
    charsetMode: 'alphanumeric',
    pinMode: 'same_as_code',
    serviceType: 'hotspot',
    profile,
    lang: 'ar',
  });
  assert.equal(batch.length, 250);
  const uniqueCodes = new Set(batch.map((v) => v.code));
  assert.equal(uniqueCodes.size, 250);
  assert.equal(batch[0].code.startsWith('MC-'), true);

  const profScript = generateSpeedProfileScript(profile, 'v7');
  assert.equal(profScript.includes('/system scheduler add'), true);
  assert.equal(profScript.includes('/ip hotspot active remove'), true);
});

test('Starlink Gaming Optimizer & Anti-Netcut Shield generate v7 CAKE and TTL=1', () => {
  const starlink = generateStarlinkGamingOptimizer({
    osVersion: 'v7',
    wanInterface: 'ether1',
    lanInterface: 'bridge-LAN',
    enableDoh: true,
    dohProvider: 'cloudflare',
    enableMssClamp: true,
    mssValue: 1440,
    enableGamingQos: true,
    totalDownMbps: 200,
    totalUpMbps: 30,
    prioritizeGames: ['pubg', 'freefire', 'voip'],
  });
  assert.equal(starlink.includes('kind=cake'), true);
  assert.equal(starlink.includes('new-mss=1440'), true);
  assert.equal(starlink.includes('PUBG Mobile UDP'), true);

  const shield = generateAntiNetcutSecurityShield({
    osVersion: 'v7',
    lanBridge: 'bridge-LAN',
    dhcpServerName: 'dhcp-LAN',
    wanInterfaceList: 'WAN',
    blockNetcutArp: true,
    closeInsecurePorts: true,
    antiHotspotSharingTtl: true,
    protectWinboxLanOnly: true,
    lanTrustedSubnet: '192.168.88.0/24',
  });
  assert.equal(shield.includes('arp=reply-only'), true);
  assert.equal(shield.includes('change-ttl new-ttl=set:1'), true);
});

test('Cisco IOS CLI generator builds VLANs, Trunk, Port Security, OSPF, and RESTCONF', () => {
  const cli = generateCiscoIosCli({
    deviceType: 'switch_l3',
    hostname: 'Core-SW',
    domainName: 'shaban.local',
    enableSecret: 'Sec123',
    sshUser: 'admin',
    sshPassword: 'Pass123',
    vlans: [{ id: 10, name: 'USERS', subnet: '192.168.10.1 255.255.255.0' }],
    accessPorts: 'Gi0/1-12',
    accessVlanId: 10,
    trunkPorts: 'Gi0/23-24',
    nativeVlanId: 99,
    enablePortSecurity: true,
    portSecMaxMac: 2,
    portSecViolation: 'restrict',
    routingMode: 'ospf',
    defaultNextHop: '',
    ospfProcessId: 1,
    ospfRouterId: '10.0.0.1',
    ospfNetworks: '192.168.10.0 0.0.0.255 area 0',
    enableNatOverload: false,
    natInsideIf: 'Gi0/1',
    natOutsideIf: 'Gi0/0',
    natAclSubnet: '192.168.10.0 0.0.0.255',
    enableRestconf: true,
  });
  assert.equal(cli.includes('switchport trunk encapsulation dot1q'), true);
  assert.equal(cli.includes('switchport port-security maximum 2'), true);
  assert.equal(cli.includes('router ospf 1'), true);
  assert.equal(cli.includes('restconf'), true);
});

test('Safe Family & Anti-Porn Shield + Rollback generate valid v6/v7 RouterOS scripts', () => {
  const v7Safe = generateSafeFamilyShieldScript({
    osVersion: 'v7',
    lanInterface: 'bridge-LAN',
    dnsPreset: 'combined',
    forceDnsRedirect: true,
    blockDohAndDot: true,
  });
  const v6Safe = generateSafeFamilyShieldScript({
    osVersion: 'v6',
    lanInterface: 'bridge-LAN',
    dnsPreset: 'combined',
    forceDnsRedirect: true,
    blockDohAndDot: true,
  });

  assert.equal(v7Safe.includes('185.228.168.168,185.228.169.168,1.1.1.3,1.0.0.3'), true);
  assert.equal(v7Safe.includes('use-doh-server='), true);
  assert.equal(v7Safe.includes('chain=dstnat in-interface="bridge-LAN" protocol=udp dst-port=53 action=redirect'), true);
  assert.equal(v7Safe.includes('dst-port=853 action=drop'), true);
  assert.equal(v7Safe.includes('dst-address-list=MikroCore_DoH_Bypass'), true);

  assert.equal(v6Safe.includes('use-doh-server='), false);
  assert.equal(v6Safe.includes('185.228.168.168,185.228.169.168,1.1.1.3,1.0.0.3'), true);

  const v7Rollback = generateSafeFamilyRollbackScript('v7');
  const v6Rollback = generateSafeFamilyRollbackScript('v6');
  assert.equal(v7Rollback.includes('/ip firewall nat remove [find comment~"MikroCore-SafeFamily"]'), true);
  assert.equal(v7Rollback.includes('use-doh-server=""'), true);
  assert.equal(v6Rollback.includes('use-doh-server=""'), false);
});
