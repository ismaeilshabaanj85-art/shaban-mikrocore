import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIKROCORE_BRIDGE_URL,
  PRESET_SPEED_PROFILES,
  buildBanMacCommand,
  buildCleanExpiredAccountsCommand,
  buildDeleteAccountCommand,
  buildGamingLatencyMatrixCommand,
  buildKickSessionCommand,
  buildPingDishCommand,
  buildPppoeExpiryRedirectCommand,
  buildSpeedLimitCommand,
  buildToggleAccountCommand,
  buildWhatsAppBillingUrl,
  executeRouterOsV7Rest,
  generateAntiNetcutSecurityShield,
  generateAutoRollbackGuard,
  generateBatteryGuardScript,
  generateCarrierCakeFqCodelScript,
  generateCiscoIosCli,
  generateCiscoMikrotikLacpSync,
  generateMultiWanPcc,
  generateOneLineConnector,
  generateSafeFamilyRollbackScript,
  generateSafeFamilyShieldScript,
  generateSpeedProfileScript,
  generateStarlinkGamingOptimizer,
  generateVoucherBatch,
  generateVrrpFailoverScript,
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

  const lines = v7Conn.split('\n');
  assert.equal(lines.length > 20, true);
  assert.equal(
    lines[0],
    ':do { /system scheduler remove [find name="MikroCore_CloudAgent"] } on-error={}'
  );
  for (const line of lines) {
    assert.equal(line.length < 1000, true, `Line exceeded 1000 chars: ${line.length}`);
  }
  assert.equal(v7Conn, v6Conn);
  assert.equal(v7Conn.includes('interval=8s'), true);
  assert.equal(v7Conn.includes('/routers/tenant-123/router_alpha/telemetry.json'), true);
  assert.equal(v7Conn.includes('/routers/tenant-123/router_alpha/inventory.json'), true);
  assert.equal(v7Conn.includes('/routers/tenant-123/router_alpha/command.json'), true);
  assert.equal(v7Conn.includes('rxBps'), true);
  assert.equal(v7Conn.includes('txBps'), true);
  assert.equal(v7Conn.includes('pingMs'), true);
  assert.equal(v7Conn.includes('active_sessions'), true);
  assert.equal(v7Conn.includes('SYNC_INVENTORY'), true);
  assert.equal(v7Conn.includes('[:parse \\$clean]'), true);
  assert.equal(v7Conn.includes('http-method=delete'), true);
  assert.equal(v7Conn.includes('/ip hotspot active print count-only'), true);
  assert.equal(v7Conn.includes('/ppp active print count-only'), true);
});

test('NOC 1-click command builders emit safe sanitized RouterOS commands', () => {
  assert.equal(
    buildKickSessionCommand('hotspot', 'ali; /system reset'),
    '/ip hotspot active remove [find user="ali/systemreset"]'
  );
  assert.equal(
    buildKickSessionCommand('pppoe', 'user_ppp1'),
    '/ppp active remove [find name="user_ppp1"]'
  );

  const banCmd = buildBanMacCommand('aa:bb:cc:dd:ee:ff', 'Intruder 1');
  assert.equal(banCmd.includes('mac-address="AA:BB:CC:DD:EE:FF"'), true);
  assert.equal(banCmd.includes('src-mac-address="AA:BB:CC:DD:EE:FF"'), true);

  const queueLimit = buildSpeedLimitCommand('hotspot', 'ahmed', '4M/2M', '192.168.88.50');
  assert.equal(queueLimit.includes('/queue simple add name="MC-Limit-ahmed" target="192.168.88.50/32" max-limit=4M/2M'), true);

  const pppSecretLimit = buildSpeedLimitCommand('pppoe', 'sara', '8M/4M');
  assert.equal(pppSecretLimit, '/ppp secret set [find name="sara"] rate-limit="8M/4M"');

  assert.equal(
    buildToggleAccountCommand('hotspot', 'card10', true),
    '/ip hotspot user set [find name="card10"] disabled=yes'
  );
  assert.equal(
    buildToggleAccountCommand('pppoe', 'home1', false),
    '/ppp secret set [find name="home1"] disabled=no'
  );

  assert.equal(
    buildDeleteAccountCommand('hotspot', 'card10').includes('/ip hotspot user remove [find name="card10"]'),
    true
  );
  assert.equal(
    buildDeleteAccountCommand('pppoe', 'home1').includes('/ppp secret remove [find name="home1"]'),
    true
  );

  const cleanExpired = buildCleanExpiredAccountsCommand();
  assert.equal(cleanExpired.includes('/ip hotspot user remove [find comment~"EXPIRED" || disabled=yes]'), true);
  assert.equal(cleanExpired.includes('/ppp secret remove [find comment~"EXPIRED" || disabled=yes]'), true);

  assert.equal(buildPingDishCommand('10.20.30.2'), '/tool ping address=10.20.30.2 count=4');
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

test('Phase 2 PPPoE Billing WhatsApp URL, Expiry Redirect, Battery Guard & Gaming Ping Matrix generate clean output', () => {
  const waUrl = buildWhatsAppBillingUrl(
    {
      id: 'sub1',
      clientName: 'أحمد السعيد',
      pppoeUsername: 'ppp_ahmad',
      phone: '+963 944-112-233',
      monthlyFeeUsd: 15,
      expiryDate: '2026-12-01',
      speedLabel: '10M/4M',
      createdAt: '2026-11-01T00:00:00.000Z',
    },
    'شبكة النجم السريع'
  );
  assert.equal(waUrl.startsWith('https://wa.me/963944112233?text='), true);
  assert.equal(decodeURIComponent(waUrl).includes('ppp_ahmad'), true);
  assert.equal(decodeURIComponent(waUrl).includes('$15'), true);

  const expiryCmd = buildPppoeExpiryRedirectCommand('ppp_ahmad', '192.168.88.1', 'v7');
  assert.equal(expiryCmd.includes('/ppp profile add name="EXPIRED_BILLING"'), true);
  assert.equal(expiryCmd.includes('/ppp secret set [find name="ppp_ahmad"] profile="EXPIRED_BILLING"'), true);
  assert.equal(expiryCmd.includes('to-addresses=192.168.88.1'), true);

  const batteryScript = generateBatteryGuardScript({
    osVersion: 'v7',
    thresholdV: 22.5,
    secondaryPorts: 'ether4,ether5',
    botToken: '123:ABC',
    chatId: '-100555',
    routerName: 'Tower-North',
  });
  assert.equal(batteryScript.includes('MikroCore_BatteryGuard'), true);
  assert.equal(batteryScript.includes('\\$tenths > 0 && \\$tenths < 225'), true);
  assert.equal(batteryScript.includes('/interface set [find name=\\"ether4\\"] disabled=yes'), true);
  assert.equal(batteryScript.includes('/interface set [find name=\\"ether5\\"] disabled=yes'), true);
  assert.equal(batteryScript.includes('api.telegram.org/bot123:ABC'), true);

  const pingMatrix = buildGamingLatencyMatrixCommand();
  assert.equal(pingMatrix.includes('/tool ping 1.1.1.1 count=3'), true);
  assert.equal(pingMatrix.includes('/tool ping 8.8.8.8 count=3'), true);
});

test('Phase 2 Cisco BGP, L2 Hardening, Cisco<->MikroTik LACP Sync, Carrier CAKE/FQ-Codel & VRRP generate valid CLI', () => {
  const ciscoAdv = generateCiscoIosCli({
    deviceType: 'switch_l3',
    hostname: 'Core-BGP',
    domainName: 'shaban.local',
    enableSecret: 'Sec123',
    sshUser: 'admin',
    sshPassword: 'Pass123',
    vlans: [{ id: 10, name: 'MGMT', subnet: '10.10.10.1 255.255.255.0' }],
    accessPorts: 'Gi0/1-12',
    accessVlanId: 10,
    trunkPorts: 'Gi0/23-24',
    nativeVlanId: 10,
    enablePortSecurity: true,
    portSecMaxMac: 2,
    portSecViolation: 'restrict',
    enableDhcpSnooping: true,
    enableDai: true,
    enableBpduGuard: true,
    routingMode: 'bgp',
    defaultNextHop: '',
    ospfProcessId: 1,
    ospfRouterId: '10.10.10.1',
    ospfNetworks: '',
    bgpAsn: 65010,
    bgpRouterId: '10.10.10.1',
    bgpNeighborIp: '172.16.0.1',
    bgpRemoteAsn: 65001,
    bgpNetworks: '10.10.10.0 255.255.255.0',
    enableNatOverload: false,
    natInsideIf: 'Gi0/1',
    natOutsideIf: 'Gi0/0',
    natAclSubnet: '10.10.0.0 0.0.255.255',
    enableRestconf: false,
  });
  assert.equal(ciscoAdv.includes('ip dhcp snooping'), true);
  assert.equal(ciscoAdv.includes('ip arp inspection vlan'), true);
  assert.equal(ciscoAdv.includes('spanning-tree portfast bpduguard default'), true);
  assert.equal(ciscoAdv.includes('router bgp 65010'), true);
  assert.equal(ciscoAdv.includes('neighbor 172.16.0.1 remote-as 65001'), true);

  const lacp = generateCiscoMikrotikLacpSync({
    osVersion: 'v7',
    ciscoPortChannelId: 2,
    ciscoPorts: 'Gi0/23-24',
    ciscoTrunkNativeVlan: 10,
    mikrotikBondName: 'bond-Cisco',
    mikrotikSlaves: 'ether9,ether10',
    mikrotikBridge: 'bridge-LAN',
    vlans: [
      { id: 10, name: 'MGMT' },
      { id: 20, name: 'USERS' },
    ],
  });
  assert.equal(lacp.ciscoCli.includes('channel-group 2 mode active'), true);
  assert.equal(lacp.mikrotikCli.includes('mode=802.3ad'), true);
  assert.equal(lacp.mikrotikCli.includes('vlan-id=20'), true);

  const fqCodel = generateCarrierCakeFqCodelScript({
    osVersion: 'v7',
    wanInterface: 'ether1',
    lanInterface: 'bridge-LAN',
    downMbps: 300,
    upMbps: 50,
    queueKind: 'fq_codel',
  });
  assert.equal(fqCodel.includes('kind=fq-codel'), true);

  const vrrp = generateVrrpFailoverScript({
    osVersion: 'v7',
    role: 'master',
    interfaceName: 'bridge-LAN',
    vrid: 55,
    virtualIp: '192.168.88.1/32',
    interfaceIp: '192.168.88.2/24',
    priority: 200,
    preemptMode: true,
  });
  assert.equal(vrrp.includes('/interface vrrp add name="vrrp-HA-55"'), true);
  assert.equal(vrrp.includes('vrid=55 priority=200'), true);
});

