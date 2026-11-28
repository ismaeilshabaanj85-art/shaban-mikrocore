import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFetchPublicIpCommand,
  buildL2tpVpnDisableCommand,
  buildL2tpVpnEnableCommand,
  buildLoopProtectDisableCommand,
  buildLoopProtectEnableCommand,
  buildMaintenanceDisableCommand,
  buildMaintenanceEnableCommand,
  buildMigrateInjectedAccountsCommand,
  buildQuotaGuardDisableCommand,
  buildQuotaGuardEnableCommand,
  buildRebootDishCommand,
  buildStarlinkPeakSaverDisableCommand,
  buildStarlinkPeakSaverEnableCommand,
  classifyPublicIpStatus,
  generateCiscoAutoQosCli,
  generateCiscoRoutingEnterpriseCli,
} from './enterpriseToolsEngine';

test('classifyPublicIpStatus differentiates Direct Public, CGNAT/Starlink, and Private LAN', () => {
  const starlink = classifyPublicIpStatus('100.84.192.45');
  assert.equal(starlink.classification, 'cgnat_starlink');
  assert.equal(starlink.isDirectPublic, false);

  const priv = classifyPublicIpStatus('192.168.88.10');
  assert.equal(priv.classification, 'private_lan');
  assert.equal(priv.isDirectPublic, false);

  const pub = classifyPublicIpStatus('185.44.120.77');
  assert.equal(pub.classification, 'direct_public');
  assert.equal(pub.isDirectPublic, true);
});

test('buildFetchPublicIpCommand generates universal cloud DDNS & RTDB public_info push', () => {
  const cmd = buildFetchPublicIpCommand('tenant-123', 'router-1');
  assert.match(cmd, /\/ip cloud set ddns-enabled=yes/);
  assert.match(cmd, /\/ip cloud force-update/);
  assert.match(cmd, /routers\/tenant-123\/router-1\/public_info\.json/);
  assert.match(cmd, /http-method=put/);
});

test('L2TP VPN enable and disable commands use MikroCore_VPN tag and universal v6/v7 syntax', () => {
  for (const osVersion of ['v6', 'v7'] as const) {
    const enable = buildL2tpVpnEnableCommand({
      osVersion,
      username: 'admin-vpn',
      password: 'Shaban@2026',
      ipsecSecret: '12345678',
      dishesSubnet: '192.168.1.0/24',
    });
    assert.match(enable, /\/interface l2tp-server server set enabled=yes use-ipsec=yes ipsec-secret="12345678"/);
    assert.match(enable, /comment="MikroCore_VPN"/);
    assert.match(enable, /dst-address=192\.168\.1\.0\/24 action=masquerade/);
  }
  const disable = buildL2tpVpnDisableCommand();
  assert.match(disable, /\/interface l2tp-server server set enabled=no/);
  assert.match(disable, /remove \[find comment="MikroCore_VPN"\]/);
});

test('Starlink Peak Quota Saver enables scheduled bulk cap + gaming fast-path and undoes cleanly', () => {
  const enable = buildStarlinkPeakSaverEnableCommand({
    osVersion: 'v6',
    lanInterface: 'bridge-LAN',
    lanSubnet: '192.168.88.0/24',
    peakStartTime: '19:00:00',
    peakEndTime: '00:00:00',
    bulkCapLimit: '2M/2M',
  });
  assert.match(enable, /comment="MikroCore_StarlinkSaver"/);
  assert.match(enable, /max-limit=2M\/2M/);
  assert.match(enable, /start-time=19:00:00/);

  const disable = buildStarlinkPeakSaverDisableCommand();
  assert.match(disable, /\/system scheduler remove \[find comment="MikroCore_StarlinkSaver"\]/);
  assert.match(disable, /\/queue simple remove \[find comment="MikroCore_StarlinkSaver"\]/);
  assert.match(disable, /\/ip firewall mangle remove \[find comment="MikroCore_StarlinkSaver"\]/);
});

test('Smart Quota Guard throttles exceeded users cleanly and schedules reset without disconnection', () => {
  const enable = buildQuotaGuardEnableCommand({
    osVersion: 'v7',
    serviceType: 'hotspot',
    targetProfile: 'Home-8M',
    quotaGb: 10,
    throttleRate: '512k/512k',
    resetCycle: 'daily',
  });
  assert.match(enable, /MikroCore_Quota_Throttle/);
  assert.match(enable, /rate-limit="512k\/512k"/);
  assert.match(enable, /comment="MikroCore_QuotaGuard"/);
  assert.match(enable, /start-time=00:00:00/);

  const disable = buildQuotaGuardDisableCommand();
  assert.match(disable, /remove \[find comment="MikroCore_QuotaGuard"\]/);
});

test('Loop Protect, Maintenance Mode, Dish Reboot, and Account Migrator generate valid tagged commands', () => {
  const loopOn = buildLoopProtectEnableCommand('bridge-LAN');
  assert.match(loopOn, /loop-protect=on/);
  assert.match(loopOn, /comment="MikroCore_LoopProtect"/);
  assert.match(buildLoopProtectDisableCommand(), /loop-protect=default/);

  const maintOn = buildMaintenanceEnableCommand({ osVersion: 'v7', exemptAdminIp: '192.168.88.2', proxyPort: 8080 });
  assert.match(maintOn, /src-address=!192\.168\.88\.2/);
  assert.match(maintOn, /comment="MikroCore_Maintenance"/);
  assert.match(buildMaintenanceDisableCommand(), /remove \[find comment="MikroCore_Maintenance"\]/);

  const rebootDish = buildRebootDishCommand('ether3-Towers', 'Sector-North');
  assert.match(rebootDish, /poe power-cycle/);
  assert.match(rebootDish, /ether3-Towers/);

  const migrate = buildMigrateInjectedAccountsCommand(
    [
      { name: 'MC-1001', type: 'hotspot', profile: '8M', disabled: false },
      { name: 'home_ali', type: 'pppoe', profile: '16M', disabled: true },
    ],
    'v6'
  );
  assert.match(migrate, /\/ip hotspot user add name="MC-1001"/);
  assert.match(migrate, /\/ppp secret add name="home_ali".*disabled=yes/);
});

test('Cisco Routing (OSPF MD5 & BGP Prefix-Lists) and Auto-QoS generators output valid IOS CLI', () => {
  const ospfCli = generateCiscoRoutingEnterpriseCli({
    deviceType: 'switch_l3',
    hostname: 'Core-SW',
    domainName: 'local',
    enableSecret: 'sec',
    sshUser: 'netadmin',
    sshPassword: 'pass',
    vlans: [],
    accessPorts: '',
    accessVlanId: 10,
    trunkPorts: '',
    nativeVlanId: 10,
    enablePortSecurity: false,
    portSecMaxMac: 2,
    portSecViolation: 'restrict',
    routingMode: 'ospf',
    defaultNextHop: '',
    ospfProcessId: 10,
    ospfRouterId: '10.10.10.1',
    ospfNetworks: '10.10.10.0 0.0.0.255 area 0',
    ospfEnableMd5Auth: true,
    ospfMd5KeyId: 5,
    ospfMd5Secret: 'MD5Secret!',
    ospfInterfaceName: 'GigabitEthernet0/1',
    enableNatOverload: false,
    natInsideIf: '',
    natOutsideIf: '',
    natAclSubnet: '',
    enableRestconf: false,
  });
  assert.match(ospfCli, /ip ospf authentication message-digest/);
  assert.match(ospfCli, /ip ospf message-digest-key 5 md5 MD5Secret!/);
  assert.match(ospfCli, /area 0 authentication message-digest/);

  const qosCli = generateCiscoAutoQosCli({
    hostname: 'Shaban-Core-SW1',
    uplinkInterface: 'GigabitEthernet0/24',
    accessInterfaces: 'GigabitEthernet0/1-12',
    voipPriorityPercent: 20,
    gamingBandwidthPercent: 35,
    bulkPolicingMbps: 25,
    enableAutoQosVoip: true,
  });
  assert.match(qosCli, /mls qos/);
  assert.match(qosCli, /class-map match-any CM_GAMING_LOW_LATENCY/);
  assert.match(qosCli, /policy-map PM_SHABAN_ENTERPRISE_QOS/);
  assert.match(qosCli, /priority percent 20/);
  assert.match(qosCli, /bandwidth percent 35/);
});
