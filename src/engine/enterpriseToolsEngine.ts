import { CiscoConfig, RouterOSVersion } from '../types/mikrocore';
import { RouterInjectedAccount } from '../utils/firebaseCloud';
import { sanitizeCliToken } from '../utils/security';
import { getRouterCloudBase } from '../utils/firebaseCloud';

export type PublicIpClassification = 'direct_public' | 'cgnat_starlink' | 'private_lan' | 'unknown';

export interface PublicIpAnalysis {
  classification: PublicIpClassification;
  isDirectPublic: boolean;
  labelAr: string;
  labelEn: string;
  detailAr: string;
  detailEn: string;
}

/**
 * Classifies an IPv4 address to detect Direct Public IP vs CGNAT (100.64.0.0/10 / Starlink) vs RFC1918 Private LAN.
 */
export function classifyPublicIpStatus(ip: string): PublicIpAnalysis {
  const clean = (ip || '').trim();
  const match = clean.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) {
    return {
      classification: 'unknown',
      isDirectPublic: false,
      labelAr: 'غير معروف / بانتظار الفحص',
      labelEn: 'Unknown / Pending Check',
      detailAr: 'لم يتم استلام عنوان IPv4 صالح من الراوتر بعد.',
      detailEn: 'No valid IPv4 address received from router yet.',
    };
  }

  const [o1, o2, o3, o4] = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
  if ([o1, o2, o3, o4].some((n) => n < 0 || n > 255)) {
    return {
      classification: 'unknown',
      isDirectPublic: false,
      labelAr: 'عنوان IP غير صالح',
      labelEn: 'Invalid IPv4',
      detailAr: 'تحقق من القيمة المسترجعة من MikroTik Cloud.',
      detailEn: 'Verify value returned by MikroTik Cloud.',
    };
  }

  // RFC 6598 Shared CGNAT (100.64.0.0/10 => 100.64.x.x - 100.127.x.x) used by Starlink & ISPs
  if (o1 === 100 && o2 >= 64 && o2 <= 127) {
    return {
      classification: 'cgnat_starlink',
      isDirectPublic: false,
      labelAr: 'خلف CGNAT / ستارلينك (غير مباشر)',
      labelEn: 'Behind CGNAT / Starlink',
      detailAr:
        'الراوتر متصل خلف NAT مزود الخدمة (100.64.0.0/10). يعمل الوكيل السحابي بسلاسة، بينما يتطلب الوصول المباشر IP عام حقيقي أو نفق سحابي.',
      detailEn:
        'Router sits behind ISP CGNAT (100.64.0.0/10). Cloud Agent works natively; direct inbound L2TP requires a true Public IP.',
    };
  }

  // RFC 1918 Private Ranges
  if (o1 === 10 || (o1 === 172 && o2 >= 16 && o2 <= 31) || (o1 === 192 && o2 === 168)) {
    return {
      classification: 'private_lan',
      isDirectPublic: false,
      labelAr: 'عنوان خاص / خلف راوتر أو CGNAT',
      labelEn: 'Private / Behind Upstream NAT',
      detailAr:
        'الراوتر يحصل على IP داخلي خاص خلف مودم أو موزع رئيسي. استمر عبر الربط السحابي أو فعّل DMZ/Bridge على المودم الأمامي.',
      detailEn:
        'Router receives a private RFC1918 IP behind an upstream router/CGNAT.',
    };
  }

  return {
    classification: 'direct_public',
    isDirectPublic: true,
    labelAr: 'آيبي عالمي مباشر (Real Public IP ✅)',
    labelEn: 'Direct Public IP ✅',
    detailAr:
      'الراوتر يمتلك عنوان IP عام مباشر! يمكنك استخدام Cloud DDNS أو الـ Public IP للوصول المباشر وربط L2TP/IPSec VPN فوراً.',
    detailEn:
      'Router holds a direct routable Public IP! Cloud DDNS and L2TP/IPSec VPN work directly from anywhere.',
  };
}

/**
 * Generates universal RouterOS v6 & v7 command to update MikroTik Cloud DDNS and push public_info.json to Firebase RTDB.
 */
export function buildFetchPublicIpCommand(tenantUuid: string, routerId: string): string {
  const endpoint = `${getRouterCloudBase(tenantUuid, routerId)}/public_info.json`;
  return `/ip cloud set ddns-enabled=yes; /ip cloud force-update; :delay 2s; :local ip [/ip cloud get public-address]; :local dns [/ip cloud get dns-name]; /tool fetch mode=https url="${endpoint}" http-method=put http-header-field="Content-Type: application/json" http-data=("{\\"publicIp\\":\\"" . $ip . "\\",\\"cloudDns\\":\\"" . $dns . "\\",\\"updatedAt\\":{\\".sv\\":\\"timestamp\\"}}") output=none`;
}

// === 2. MikroTik L2TP/IPSec VPN (Universal v6 & v7 + Safe Undo) ===

export interface L2tpVpnConfig {
  osVersion: RouterOSVersion;
  username: string;
  password: string;
  ipsecSecret: string;
  dishesSubnet: string;
}

export function buildL2tpVpnEnableCommand(cfg: L2tpVpnConfig): string {
  const user = sanitizeCliToken(cfg.username, 'admin-vpn');
  const pass = cfg.password.replace(/["\r\n\\]/g, '') || 'Shaban@2026';
  const secret = cfg.ipsecSecret.replace(/["\r\n\\]/g, '') || '12345678';
  const subnet = sanitizeCliToken(cfg.dishesSubnet, '192.168.1.0/24');

  return [
    `# Shaban MikroCore | L2TP/IPSec VPN Server Enable (${cfg.osVersion.toUpperCase()})`,
    `:do { /ip pool add name="MikroCore_VPN_Pool" ranges=10.99.99.10-10.99.99.50 } on-error={}`,
    `:do { /ppp profile add name="MikroCore_VPN_Prof" local-address=10.99.99.1 remote-address="MikroCore_VPN_Pool" dns-server=1.1.1.1 use-encryption=yes comment="MikroCore_VPN" } on-error={ /ppp profile set [find name="MikroCore_VPN_Prof"] local-address=10.99.99.1 remote-address="MikroCore_VPN_Pool" use-encryption=yes }`,
    `:do { /ppp secret add name="${user}" password="${pass}" service=l2tp profile="MikroCore_VPN_Prof" comment="MikroCore_VPN" } on-error={ /ppp secret set [find name="${user}"] password="${pass}" service=l2tp profile="MikroCore_VPN_Prof" disabled=no comment="MikroCore_VPN" }`,
    `/interface l2tp-server server set enabled=yes use-ipsec=yes ipsec-secret="${secret}" default-profile="MikroCore_VPN_Prof" allow-fast-path=no`,
    `/ip firewall filter remove [find comment="MikroCore_VPN"]`,
    `/ip firewall filter add chain=input protocol=udp dst-port=500,1701,4500 action=accept place-before=0 comment="MikroCore_VPN"`,
    `/ip firewall filter add chain=input protocol=ipsec-esp action=accept place-before=0 comment="MikroCore_VPN"`,
    `/ip firewall nat remove [find comment="MikroCore_VPN"]`,
    `:do { /ip firewall nat add chain=srcnat src-address=10.99.99.0/24 dst-address=${subnet} action=masquerade comment="MikroCore_VPN" } on-error={}`,
    `:log info "MikroCore_VPN L2TP/IPSec enabled for ${user}"`,
  ].join('\n');
}

export function buildL2tpVpnDisableCommand(): string {
  return [
    `# Shaban MikroCore | Disable & Remove L2TP/IPSec VPN (MikroCore_VPN Only)`,
    `/interface l2tp-server server set enabled=no`,
    `:do { /ppp active remove [find service=l2tp] } on-error={}`,
    `/ip firewall filter remove [find comment="MikroCore_VPN"]`,
    `/ip firewall nat remove [find comment="MikroCore_VPN"]`,
    `/ppp secret remove [find comment="MikroCore_VPN"]`,
    `:do { /ppp profile remove [find name="MikroCore_VPN_Prof"] } on-error={}`,
    `:do { /ip pool remove [find name="MikroCore_VPN_Pool"] } on-error={}`,
    `:log info "MikroCore_VPN stopped and cleaned safely"`,
  ].join('\n');
}

// === 3. Starlink Quota Peak Saver (Universal v6 & v7 + Safe Undo) ===

export interface StarlinkQuotaConfig {
  osVersion: RouterOSVersion;
  lanInterface: string;
  lanSubnet: string;
  peakStartTime: string; // e.g. 19:00:00
  peakEndTime: string;   // e.g. 00:00:00
  bulkCapLimit: string;  // e.g. 2M/2M
}

export function buildStarlinkPeakSaverEnableCommand(cfg: StarlinkQuotaConfig): string {
  const lanSub = sanitizeCliToken(cfg.lanSubnet, '192.168.88.0/24');
  const bulkLimit = sanitizeCliToken(cfg.bulkCapLimit, '2M/2M');
  const startTime = sanitizeCliToken(cfg.peakStartTime, '19:00:00');
  const endTime = sanitizeCliToken(cfg.peakEndTime, '00:00:00');

  return [
    `# Shaban MikroCore | Starlink Peak Quota Saver (${cfg.osVersion.toUpperCase()})`,
    `/ip firewall mangle remove [find comment="MikroCore_StarlinkSaver"]`,
    `/queue simple remove [find comment="MikroCore_StarlinkSaver"]`,
    `/system scheduler remove [find comment="MikroCore_StarlinkSaver"]`,
    `/ip firewall mangle add chain=forward protocol=udp dst-port=3000-35000 action=mark-packet new-packet-mark=MikroCore_Starlink_Fast passthrough=no comment="MikroCore_StarlinkSaver"`,
    `/ip firewall mangle add chain=forward protocol=tcp dst-port=443,5222,5228 connection-bytes=0-2000000 action=mark-packet new-packet-mark=MikroCore_Starlink_Fast passthrough=no comment="MikroCore_StarlinkSaver"`,
    `/ip firewall mangle add chain=forward connection-bytes=15000000-0 action=mark-packet new-packet-mark=MikroCore_Starlink_Bulk passthrough=no comment="MikroCore_StarlinkSaver"`,
    `/queue simple add name="MikroCore_Starlink_Priority" target=${lanSub} packet-marks=MikroCore_Starlink_Fast max-limit=200M/200M priority=1/1 comment="MikroCore_StarlinkSaver"`,
    `/queue simple add name="MikroCore_Starlink_BulkCap" target=${lanSub} packet-marks=MikroCore_Starlink_Bulk max-limit=${bulkLimit} priority=8/8 comment="MikroCore_StarlinkSaver"`,
    `/system scheduler add name="MikroCore_StarlinkSaver_On" start-time=${startTime} interval=1d on-event="/queue simple enable [find name=\\"MikroCore_Starlink_BulkCap\\"]" comment="MikroCore_StarlinkSaver"`,
    `/system scheduler add name="MikroCore_StarlinkSaver_Off" start-time=${endTime} interval=1d on-event="/queue simple disable [find name=\\"MikroCore_Starlink_BulkCap\\"]" comment="MikroCore_StarlinkSaver"`,
    `:log info "MikroCore_StarlinkSaver active (${startTime} -> ${endTime}, bulk cap ${bulkLimit})"`,
  ].join('\n');
}

export function buildStarlinkPeakSaverDisableCommand(): string {
  return [
    `# Shaban MikroCore | Disable Starlink Peak Quota Saver`,
    `/system scheduler remove [find comment="MikroCore_StarlinkSaver"]`,
    `/queue simple remove [find comment="MikroCore_StarlinkSaver"]`,
    `/ip firewall mangle remove [find comment="MikroCore_StarlinkSaver"]`,
    `:log info "MikroCore_StarlinkSaver rules removed cleanly"`,
  ].join('\n');
}

// === 4. Smart Quota Guard & Auto Reset (Universal v6 & v7 + Safe Undo) ===

export interface QuotaGuardConfig {
  osVersion: RouterOSVersion;
  serviceType: 'hotspot' | 'pppoe';
  targetProfile: string;
  quotaGb: number;
  throttleRate: string; // e.g. 512k/512k
  resetCycle: 'daily' | 'monthly';
}

export function buildQuotaGuardEnableCommand(cfg: QuotaGuardConfig): string {
  const profile = sanitizeCliToken(cfg.targetProfile, 'default');
  const rate = sanitizeCliToken(cfg.throttleRate, '512k/512k');
  const quotaGb = Math.max(1, Math.min(5000, Math.round(cfg.quotaGb || 5)));
  const quotaBytes = quotaGb * 1073741824;

  const checkBody =
    cfg.serviceType === 'hotspot'
      ? `:foreach u in=[/ip hotspot user find profile="${profile}"] do={ :local b ([/ip hotspot user get $u bytes-in] + [/ip hotspot user get $u bytes-out]); :if ($b >= ${quotaBytes}) do={ :local un [/ip hotspot user get $u name]; :do { /ip hotspot user set $u profile="MikroCore_Quota_Throttle" comment="MikroCore_QuotaGuard_Limited" } on-error={}; :do { /ip hotspot active remove [find user=$un] } on-error={} } }`
      : `:foreach u in=[/ppp secret find profile="${profile}"] do={ :local un [/ppp secret get $u name]; :local qn ("<pppoe-" . $un . ">"); :do { :local qb [/queue simple get [find name=$qn] bytes]; :if ([:len $qb] > 0) do={ :do { /ppp secret set $u profile="MikroCore_Quota_Throttle" comment="MikroCore_QuotaGuard_Limited" } on-error={} } } on-error={} }`;

  const resetBody =
    cfg.serviceType === 'hotspot'
      ? `:do { /ip hotspot user reset-counters [find] } on-error={}; :foreach u in=[/ip hotspot user find comment="MikroCore_QuotaGuard_Limited"] do={ /ip hotspot user set $u profile="${profile}" comment="" }`
      : `:foreach u in=[/ppp secret find comment="MikroCore_QuotaGuard_Limited"] do={ /ppp secret set $u profile="${profile}" comment="" }`;

  const escapedCheck = checkBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const escapedReset = resetBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const resetInterval = cfg.resetCycle === 'monthly' ? '30d' : '1d';

  const profileLine =
    cfg.serviceType === 'hotspot'
      ? `:do { /ip hotspot user profile add name="MikroCore_Quota_Throttle" rate-limit="${rate}" } on-error={ /ip hotspot user profile set [find name="MikroCore_Quota_Throttle"] rate-limit="${rate}" }`
      : `:do { /ppp profile add name="MikroCore_Quota_Throttle" rate-limit="${rate}" comment="MikroCore_QuotaGuard" } on-error={ /ppp profile set [find name="MikroCore_Quota_Throttle"] rate-limit="${rate}" }`;

  return [
    `# Shaban MikroCore | Smart Quota Guard & Auto Reset (${cfg.osVersion.toUpperCase()})`,
    `/system scheduler remove [find comment="MikroCore_QuotaGuard"]`,
    `/system script remove [find comment="MikroCore_QuotaGuard"]`,
    profileLine,
    `/system script add name="MikroCore_QuotaGuard_Check" policy=read,write,test source="${escapedCheck}" comment="MikroCore_QuotaGuard"`,
    `/system script add name="MikroCore_QuotaGuard_Reset" policy=read,write,test source="${escapedReset}" comment="MikroCore_QuotaGuard"`,
    `/system scheduler add name="MikroCore_QuotaGuard_Watch" interval=5m start-time=startup on-event="/system script run MikroCore_QuotaGuard_Check" comment="MikroCore_QuotaGuard"`,
    `/system scheduler add name="MikroCore_QuotaGuard_Reset" interval=${resetInterval} start-time=00:00:00 on-event="/system script run MikroCore_QuotaGuard_Reset" comment="MikroCore_QuotaGuard"`,
    `:log info "MikroCore_QuotaGuard armed (${quotaGb}GB limit -> ${rate}, reset ${cfg.resetCycle})"`,
  ].join('\n');
}

export function buildQuotaGuardDisableCommand(): string {
  return [
    `# Shaban MikroCore | Disable Smart Quota Guard & Auto Reset`,
    `/system scheduler remove [find comment="MikroCore_QuotaGuard"]`,
    `/system script remove [find comment="MikroCore_QuotaGuard"]`,
    `:do { /ip hotspot user profile remove [find name="MikroCore_Quota_Throttle"] } on-error={}`,
    `:do { /ppp profile remove [find name="MikroCore_Quota_Throttle"] } on-error={}`,
    `:log info "MikroCore_QuotaGuard disabled safely"`,
  ].join('\n');
}

// === 5. Loop & Broadcast Storm Protection (Universal v6 & v7 + Safe Undo) ===

export function buildLoopProtectEnableCommand(bridgeName: string = 'bridge-LAN'): string {
  const bridge = sanitizeCliToken(bridgeName, 'bridge-LAN');
  return [
    `# Shaban MikroCore | Loop Protect & Broadcast Storm Guard`,
    `/interface ethernet set [find] loop-protect=on loop-protect-disable-time=5m loop-protect-send-interval=5s`,
    `/interface bridge filter remove [find comment="MikroCore_LoopProtect"]`,
    `:do { /interface bridge filter add chain=forward in-bridge="${bridge}" mac-protocol=arp limit=35/1s,5:packet action=accept comment="MikroCore_LoopProtect" } on-error={}`,
    `:do { /interface bridge filter add chain=forward in-bridge="${bridge}" packet-type=broadcast limit=60/1s,10:packet action=accept comment="MikroCore_LoopProtect" } on-error={}`,
    `:do { /interface bridge filter add chain=forward in-bridge="${bridge}" packet-type=broadcast action=drop comment="MikroCore_LoopProtect" } on-error={}`,
    `:log info "MikroCore_LoopProtect active across Ethernet ports & ${bridge}"`,
  ].join('\n');
}

export function buildLoopProtectDisableCommand(): string {
  return [
    `# Shaban MikroCore | Disable Loop Protect & Storm Filter`,
    `/interface ethernet set [find] loop-protect=default`,
    `/interface bridge filter remove [find comment="MikroCore_LoopProtect"]`,
    `:log info "MikroCore_LoopProtect disabled cleanly"`,
  ].join('\n');
}

// === 6. Emergency Maintenance Mode (Universal v6 & v7 + Safe Undo) ===

export interface MaintenanceConfig {
  osVersion: RouterOSVersion;
  exemptAdminIp?: string;
  proxyPort?: number;
}

export function buildMaintenanceEnableCommand(cfg: MaintenanceConfig): string {
  const port = Math.max(1024, Math.min(65535, Math.floor(cfg.proxyPort || 8080)));
  const exempt = cfg.exemptAdminIp ? sanitizeCliToken(cfg.exemptAdminIp, '') : '';
  const srcCond = exempt ? `src-address=!${exempt} ` : '';

  return [
    `# Shaban MikroCore | Emergency Maintenance Mode (${cfg.osVersion.toUpperCase()})`,
    `/ip firewall nat remove [find comment="MikroCore_Maintenance"]`,
    `/ip proxy set enabled=yes port=${port} cache-administrator="MikroCore_Maintenance"`,
    `/ip firewall nat add chain=dstnat ${srcCond}protocol=tcp dst-port=80 action=redirect to-ports=${port} place-before=0 comment="MikroCore_Maintenance"`,
    `:log warning "MikroCore_Maintenance mode ACTIVATED"`,
  ].join('\n');
}

export function buildMaintenanceDisableCommand(): string {
  return [
    `# Shaban MikroCore | End Maintenance Mode & Restore Service`,
    `/ip firewall nat remove [find comment="MikroCore_Maintenance"]`,
    `:do { /ip proxy set enabled=no } on-error={}`,
    `:log info "MikroCore_Maintenance mode ENDED - service restored"`,
  ].join('\n');
}

// === 7. Live NOC Additions: Dish Reboot & Bulk Account Migrator ===

export function buildRebootDishCommand(interfaceName: string, identity: string): string {
  const safeIf = sanitizeCliToken(interfaceName, 'ether1');
  const safeId = sanitizeCliToken(identity, 'Dish');
  return [
    `# Shaban MikroCore | Remote Dish Reboot / PoE Cycle (${safeId})`,
    `:do { /interface ethernet poe power-cycle [find name="${safeIf}"] duration=5s } on-error={ :do { /interface set [find name="${safeIf}"] disabled=yes; :delay 3s; /interface set [find name="${safeIf}"] disabled=no } on-error={} }`,
    `:log warning "MikroCore_DishReboot triggered on ${safeIf} (${safeId})"`,
  ].join('\n');
}

export function buildMigrateInjectedAccountsCommand(
  accounts: RouterInjectedAccount[],
  osVersion: RouterOSVersion
): string {
  const cleanAccounts = accounts.filter((a) => Boolean(a.name?.trim())).slice(0, 120);
  if (cleanAccounts.length === 0) {
    return `# No accounts available to migrate`;
  }
  const lines: string[] = [
    `# Shaban MikroCore | Bulk Account Migrator (${osVersion.toUpperCase()}) - ${cleanAccounts.length} accounts`,
  ];
  for (const acc of cleanAccounts) {
    const safeName = sanitizeCliToken(acc.name, 'user');
    const safeProf = sanitizeCliToken(acc.profile || 'default', 'default');
    const disabledStr = acc.disabled ? 'yes' : 'no';
    if (acc.type === 'pppoe') {
      lines.push(
        `:do { /ppp secret add name="${safeName}" password="${safeName}" profile="${safeProf}" service=pppoe disabled=${disabledStr} comment="MikroCore_Migrated" } on-error={}`
      );
    } else {
      lines.push(
        `:do { /ip hotspot user add name="${safeName}" password="${safeName}" profile="${safeProf}" disabled=${disabledStr} comment="MikroCore_Migrated" } on-error={}`
      );
    }
  }
  lines.push(`:log info "MikroCore_Migrated ${cleanAccounts.length} accounts to active router"`);
  return lines.join('\n');
}

// === 8. Cisco Enterprise Section B Extended CLI Generators ===

export interface CiscoRoutingExtendedConfig extends CiscoConfig {
  ospfEnableMd5Auth?: boolean;
  ospfMd5KeyId?: number;
  ospfMd5Secret?: string;
  ospfInterfaceName?: string;
  bgpPrefixListName?: string;
  bgpAllowedPrefix?: string;
}

export function generateCiscoRoutingEnterpriseCli(cfg: CiscoRoutingExtendedConfig): string {
  const lines: string[] = [
    `! =========================================================================`,
    `! Shaban MikroCore | Cisco IOS Dynamic Routing (OSPF Multi-Area & BGP)`,
    `! =========================================================================`,
    `configure terminal`,
    `ip routing`,
  ];

  if (cfg.routingMode === 'ospf' || cfg.routingMode === 'none') {
    const pid = Math.max(1, Math.min(65535, Number(cfg.ospfProcessId) || 1));
    const rid = sanitizeCliToken(cfg.ospfRouterId || '10.10.10.1', '10.10.10.1');
    const ospfIf = sanitizeCliToken(cfg.ospfInterfaceName || 'GigabitEthernet0/1', 'GigabitEthernet0/1');
    const md5KeyId = Math.max(1, Math.min(255, Number(cfg.ospfMd5KeyId) || 1));
    const md5Pass = (cfg.ospfMd5Secret || 'ShabanOSPF2026').replace(/[\r\n]/g, '');

    if (cfg.ospfEnableMd5Auth) {
      lines.push(
        `! --- OSPF Interface MD5 Authentication ---`,
        `interface ${ospfIf}`,
        ` ip ospf authentication message-digest`,
        ` ip ospf message-digest-key ${md5KeyId} md5 ${md5Pass}`,
        ` exit`
      );
    }

    lines.push(
      `! --- OSPF Multi-Area Process ${pid} ---`,
      `router ospf ${pid}`,
      ` router-id ${rid}`,
      ` auto-cost reference-bandwidth 10000`,
      ...(cfg.ospfEnableMd5Auth ? [` area 0 authentication message-digest`] : []),
      ...(cfg.ospfNetworks || '10.10.10.0 0.0.0.255 area 0')
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => ` network ${n}`),
      ` passive-interface default`,
      ` no passive-interface ${ospfIf}`,
      ` exit`,
      `!`
    );
  }

  if (cfg.routingMode === 'bgp') {
    const asn = Math.max(1, Math.min(4294967295, Number(cfg.bgpAsn) || 65010));
    const remoteAsn = Math.max(1, Math.min(4294967295, Number(cfg.bgpRemoteAsn) || 65001));
    const rid = sanitizeCliToken(cfg.bgpRouterId || '10.10.10.1', '10.10.10.1');
    const peerIp = sanitizeCliToken(cfg.bgpNeighborIp || '172.16.0.1', '172.16.0.1');
    const plName = sanitizeCliToken(cfg.bgpPrefixListName || 'PL_MIKROCORE_OUT', 'PL_MIKROCORE_OUT');
    const allowedPrefix = sanitizeCliToken(cfg.bgpAllowedPrefix || '10.10.0.0/16 le 24', '10.10.0.0/16');
    const nets = (cfg.bgpNetworks || '10.10.10.0 mask 255.255.255.0')
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);

    lines.push(
      `! --- BGP Prefix-List Filtering ---`,
      `ip prefix-list ${plName} seq 10 permit ${allowedPrefix}`,
      `ip prefix-list ${plName} seq 99 deny 0.0.0.0/0 le 32`,
      `! --- BGP Border Peering ---`,
      `router bgp ${asn}`,
      ` bgp router-id ${rid}`,
      ` bgp log-neighbor-changes`,
      ` neighbor ${peerIp} remote-as ${remoteAsn}`,
      ` neighbor ${peerIp} description Upstream_BGP_Peer`,
      ` address-family ipv4 unicast`,
      ...nets.map((net) => `  network ${net}`),
      `  neighbor ${peerIp} activate`,
      `  neighbor ${peerIp} prefix-list ${plName} out`,
      `  maximum-paths 4`,
      ` exit-address-family`,
      ` exit`,
      `!`
    );
  }

  if (cfg.routingMode === 'static' && cfg.defaultNextHop.trim()) {
    lines.push(
      `! --- Static Default Route ---`,
      `ip route 0.0.0.0 0.0.0.0 ${sanitizeCliToken(cfg.defaultNextHop, '192.168.1.1')}`,
      `!`
    );
  }

  lines.push(`end`, `write memory`);
  return lines.join('\n');
}

export interface CiscoAutoQosConfig {
  hostname: string;
  uplinkInterface: string;
  accessInterfaces: string;
  voipPriorityPercent: number;
  gamingBandwidthPercent: number;
  bulkPolicingMbps: number;
  enableAutoQosVoip: boolean;
}

export function generateCiscoAutoQosCli(cfg: CiscoAutoQosConfig): string {
  const host = sanitizeCliToken(cfg.hostname, 'Shaban-Core-SW1');
  const uplink = sanitizeCliToken(cfg.uplinkInterface, 'GigabitEthernet0/24');
  const accessIf = sanitizeCliToken(cfg.accessInterfaces, 'GigabitEthernet0/1-12');
  const voipPct = Math.max(5, Math.min(40, Math.round(cfg.voipPriorityPercent || 20)));
  const gamePct = Math.max(10, Math.min(60, Math.round(cfg.gamingBandwidthPercent || 35)));
  const bulkRateBps = Math.max(1, Math.min(1000, Math.round(cfg.bulkPolicingMbps || 20))) * 1_000_000;

  return [
    `! =========================================================================`,
    `! Shaban MikroCore | Cisco IOS Auto-QoS & UDP Gaming/VoIP Priority (${host})`,
    `! =========================================================================`,
    `configure terminal`,
    `mls qos`,
    `! --- Traffic Classification ACLs ---`,
    `ip access-list extended ACL_SHABAN_GAMING_UDP`,
    ` permit udp any any range 3000 35000`,
    ` permit udp any any eq 17500`,
    ` exit`,
    `ip access-list extended ACL_SHABAN_VOIP_RTP`,
    ` permit udp any any range 16384 32767`,
    ` permit tcp any any eq 5060`,
    ` exit`,
    `! --- Class Maps ---`,
    `class-map match-any CM_VOIP_REALTIME`,
    ` match dscp ef`,
    ` match access-group name ACL_SHABAN_VOIP_RTP`,
    ` exit`,
    `class-map match-any CM_GAMING_LOW_LATENCY`,
    ` match dscp cs4 af41`,
    ` match access-group name ACL_SHABAN_GAMING_UDP`,
    ` exit`,
    `! --- Policy Map (Low Latency Queue + Gaming Priority) ---`,
    `policy-map PM_SHABAN_ENTERPRISE_QOS`,
    ` class CM_VOIP_REALTIME`,
    `  priority percent ${voipPct}`,
    `  set dscp ef`,
    ` class CM_GAMING_LOW_LATENCY`,
    `  bandwidth percent ${gamePct}`,
    `  set dscp cs4`,
    ` class class-default`,
    `  fair-queue`,
    `  police ${bulkRateBps} 256000 exceed-action drop`,
    ` exit`,
    `! --- Apply Service Policy on Interfaces ---`,
    `interface ${uplink}`,
    ` description Uplink_QoS_Policy`,
    ...(cfg.enableAutoQosVoip ? [` auto qos voip trust`] : [` mls qos trust dscp`]),
    ` service-policy output PM_SHABAN_ENTERPRISE_QOS`,
    ` exit`,
    `interface range ${accessIf}`,
    ...(cfg.enableAutoQosVoip ? [` auto qos voip cisco-phone`] : [` mls qos trust cos`]),
    ` exit`,
    `end`,
    `write memory`,
  ].join('\n');
}
