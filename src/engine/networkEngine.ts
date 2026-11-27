import {
  CiscoConfig,
  GeneratedVoucher,
  PccConfig,
  RouterOSVersion,
  RouterProfile,
  SecurityShieldConfig,
  SpeedProfile,
  StarlinkGamingConfig,
  ZeroTouchConfig,
} from '../types/mikrocore';
import { sanitizeCliToken } from '../utils/security';

export const PRESET_SPEED_PROFILES: SpeedProfile[] = [
  {
    id: 'prof_1m',
    name: '1M-Eco',
    downloadMbps: 1,
    uploadMbps: 1,
    dataQuotaGb: 2,
    durationSeconds: 86400,
    durationLabelAr: '24 ساعة',
    durationLabelEn: '24 Hours',
    sharedUsers: 1,
    price: 1,
    currency: '$',
    serviceType: 'both',
  },
  {
    id: 'prof_2m',
    name: '2M-Basic',
    downloadMbps: 2,
    uploadMbps: 1,
    dataQuotaGb: 5,
    durationSeconds: 86400 * 3,
    durationLabelAr: '3 أيام',
    durationLabelEn: '3 Days',
    sharedUsers: 1,
    price: 2,
    currency: '$',
    serviceType: 'both',
  },
  {
    id: 'prof_4m',
    name: '4M-Standard',
    downloadMbps: 4,
    uploadMbps: 2,
    dataQuotaGb: 15,
    durationSeconds: 86400 * 7,
    durationLabelAr: '7 أيام',
    durationLabelEn: '7 Days',
    sharedUsers: 1,
    price: 4,
    currency: '$',
    serviceType: 'both',
  },
  {
    id: 'prof_8m',
    name: '8M-Plus',
    downloadMbps: 8,
    uploadMbps: 4,
    dataQuotaGb: 40,
    durationSeconds: 86400 * 30,
    durationLabelAr: '30 يوماً',
    durationLabelEn: '30 Days',
    sharedUsers: 2,
    price: 8,
    currency: '$',
    serviceType: 'both',
  },
  {
    id: 'prof_16m',
    name: '16M-Turbo',
    downloadMbps: 16,
    uploadMbps: 8,
    dataQuotaGb: 100,
    durationSeconds: 86400 * 30,
    durationLabelAr: '30 يوماً',
    durationLabelEn: '30 Days',
    sharedUsers: 2,
    price: 14,
    currency: '$',
    serviceType: 'both',
  },
  {
    id: 'prof_25m',
    name: '25M-Pro',
    downloadMbps: 25,
    uploadMbps: 12,
    dataQuotaGb: 200,
    durationSeconds: 86400 * 30,
    durationLabelAr: '30 يوماً',
    durationLabelEn: '30 Days',
    sharedUsers: 3,
    price: 20,
    currency: '$',
    serviceType: 'both',
  },
  {
    id: 'prof_50m',
    name: '50M-Ultra',
    downloadMbps: 50,
    uploadMbps: 25,
    dataQuotaGb: 500,
    durationSeconds: 86400 * 30,
    durationLabelAr: '30 يوماً',
    durationLabelEn: '30 Days',
    sharedUsers: 4,
    price: 35,
    currency: '$',
    serviceType: 'both',
  },
  {
    id: 'prof_100m',
    name: '100M-FiberNOC',
    downloadMbps: 100,
    uploadMbps: 50,
    dataQuotaGb: 0,
    durationSeconds: 86400 * 30,
    durationLabelAr: '30 يوماً (مفتوح)',
    durationLabelEn: '30 Days (Unlimited)',
    sharedUsers: 5,
    price: 55,
    currency: '$',
    serviceType: 'both',
  },
];

export function formatDurationCompact(seconds: number): string {
  const s = Math.max(60, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(rem).padStart(2, '0');
  return d > 0 ? `${d}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

/**
 * Generates a 60-Second Auto-Rollback Safety Guard script before critical changes.
 */
export function generateAutoRollbackGuard(
  osVersion: RouterOSVersion,
  rollbackSeconds = 60
): string {
  const sec = Math.max(30, Math.min(300, rollbackSeconds));
  const backupName = 'MikroCore_SafeSnapshot';
  return [
    `# === Shaban MikroCore | ${sec}-Second Auto-Rollback Safety Guard (${osVersion.toUpperCase()}) ===`,
    `/system backup save name=${backupName} dont-encrypt=yes`,
    `/system scheduler remove [find name="MikroCore_AutoRollback"]`,
    `/system scheduler add name="MikroCore_AutoRollback" interval=${sec}s on-event="/system backup load name=${backupName}.backup password=\\"\\"; /system scheduler remove [find name=\\"MikroCore_AutoRollback\\"]" comment="Auto-rollback if operator does not confirm within ${sec}s"`,
    `# To confirm changes and cancel rollback run:`,
    `# /system scheduler remove [find name="MikroCore_AutoRollback"]`,
  ].join('\n');
}

/**
 * Generates a personalized One-Line Terminal Connector Script for isolated multi-tenant RouterOS access.
 */
export function generateOneLineConnector(params: {
  osVersion: RouterOSVersion;
  tenantUuid: string;
  apiUser: string;
  apiPassword: string;
  enableCloudDdns: boolean;
  port: number;
}): string {
  const safeUser = sanitizeCliToken(params.apiUser, 'mikrocore_api');
  const safePass = params.apiPassword.replace(/["\\$]/g, '') || 'MikroCore@2026!';
  const safeTenant = sanitizeCliToken(params.tenantUuid, 'tenant');
  const port = Math.max(80, Math.min(65535, Number(params.port) || (params.osVersion === 'v7' ? 443 : 8728)));

  const userCmd = `/user group add name=mikrocore-grp policy=read,write,api,rest-api,test,sensitive; /user add name="${safeUser}" password="${safePass}" group=full comment="Tenant:${safeTenant}"`;

  if (params.osVersion === 'v7') {
    const sslCmd = `/certificate add name=mikrocore-ca common-name=mikrocore.local key-usage=key-cert-sign,crl-sign; /certificate sign mikrocore-ca; /certificate add name=mikrocore-srv common-name=mikrocore.local; /certificate sign mikrocore-srv ca=mikrocore-ca; /ip service set www-ssl disabled=no certificate=mikrocore-srv port=${port}; /ip service set api-ssl disabled=no certificate=mikrocore-srv`;
    const cloudCmd = params.enableCloudDdns
      ? `; /ip cloud set ddns-enabled=yes update-time=yes; :put [/ip cloud get dns-name]`
      : '';
    return `${userCmd}; ${sslCmd}${cloudCmd}`;
  }

  // RouterOS v6 strictly separated syntax (no rest-api policy)
  const v6UserCmd = `/user add name="${safeUser}" password="${safePass}" group=full comment="Tenant:${safeTenant}"`;
  const v6SvcCmd = `/ip service set api disabled=no port=${port}; /ip service set www disabled=no`;
  const v6CloudCmd = params.enableCloudDdns
    ? `; /ip cloud set ddns-enabled=yes update-time=yes; :put [/ip cloud get dns-name]`
    : '';
  return `${v6UserCmd}; ${v6SvcCmd}${v6CloudCmd}`;
}

export interface RestApiResult {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
  rollbackScript: string;
}

/**
 * Functional RouterOS v7 REST API client using Fetch + Basic Auth + 60s Auto-Rollback script prep.
 */
export async function executeRouterOsV7Rest(
  router: RouterProfile,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  payload?: Record<string, unknown>
): Promise<RestApiResult> {
  const rollbackScript = generateAutoRollbackGuard(router.osVersion, 60);
  const cleanHost = sanitizeCliToken(router.host, '192.168.88.1');
  const proto = router.useHttps ? 'https' : 'http';
  const portPart = router.port ? `:${router.port}` : '';
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${proto}://${cleanHost}${portPart}/rest${normalizedEndpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const token = btoa(`${router.apiUser}:${router.apiPassword}`);
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
      },
      body: payload && method !== 'GET' ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = await response.text().catch(() => null);
    }

    return {
      ok: response.ok,
      status: response.status,
      data: parsed,
      rollbackScript,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : 'Network unreachable or CORS/Self-Signed SSL blocked by browser',
      rollbackScript,
    };
  }
}

/**
 * Generates the complete Zero-Touch Master Bootstrap Script strictly separated for RouterOS v6 & v7.
 */
export function generateZeroTouchBootstrap(config: ZeroTouchConfig): string {
  const isV7 = config.osVersion === 'v7';
  const identity = sanitizeCliToken(config.routerIdentity, 'Shaban-MikroCore');
  const bridge = sanitizeCliToken(config.lanBridgeName, 'bridge-LAN');
  const wanIf = sanitizeCliToken(config.wanInterface, 'ether1');
  const wan2If = sanitizeCliToken(config.secondaryWanInterface, 'ether2');
  const apiUser = sanitizeCliToken(config.apiUsername, 'mikrocore-api');
  const apiPass = config.apiPassword.replace(/["\\$]/g, '') || 'MikroCore@2026';
  const adminPass = config.adminPassword.replace(/["\\$]/g, '') || 'Admin@2026';
  const tenant = sanitizeCliToken(config.tenantUuid, 'tenant');

  // Parse subnet e.g. 192.168.88.1/24 -> gateway 192.168.88.1, network 192.168.88.0/24
  const [gwIp, prefixStr] = config.lanSubnet.includes('/')
    ? config.lanSubnet.split('/')
    : ['192.168.88.1', '24'];
  const octets = gwIp.split('.');
  const networkBase =
    octets.length === 4 ? `${octets[0]}.${octets[1]}.${octets[2]}.0/${prefixStr}` : '192.168.88.0/24';

  const lines: string[] = [
    `# =========================================================================`,
    `# Shaban MikroCore | Zero-Touch Master Bootstrap (${config.osVersion.toUpperCase()})`,
    `# Tenant Isolation UUID: ${tenant}`,
    `# =========================================================================`,
    `/system identity set name="${identity}"`,
    `/user set admin password="${adminPass}"`,
    `/user add name="${apiUser}" password="${apiPass}" group=full comment="MikroCore Tenant:${tenant}"`,
    ``,
    `# 1. LAN Bridge & Ports`,
    `/interface bridge add name="${bridge}" protocol-mode=rstp comment="LAN Bridge"`,
  ];

  for (const port of config.lanPorts) {
    const cleanPort = sanitizeCliToken(port, 'ether3');
    if (cleanPort !== wanIf && (!config.hasSecondaryWan || cleanPort !== wan2If)) {
      lines.push(`/interface bridge port add bridge="${bridge}" interface="${cleanPort}"`);
    }
  }

  lines.push(
    ``,
    `# 2. LAN IP, Pool & DHCP Server`,
    `/ip address add address=${gwIp}/${prefixStr} interface="${bridge}" comment="LAN Gateway"`,
    `/ip pool add name=pool-LAN ranges=${sanitizeCliToken(config.dhcpRange, '192.168.88.10-192.168.88.254')}`,
    `/ip dhcp-server add name=dhcp-LAN interface="${bridge}" address-pool=pool-LAN lease-time=1h disabled=no`,
    `/ip dhcp-server network add address=${networkBase} gateway=${gwIp} dns-server=${gwIp}`,
    ``,
    `# 3. Primary WAN Configuration (${config.wanType})`
  );

  if (config.wanType === 'starlink_dhcp') {
    lines.push(`/ip dhcp-client add interface="${wanIf}" add-default-route=yes use-peer-dns=no disabled=no comment="Primary WAN - Starlink DHCP"`);
    lines.push(`/ip firewall mangle add chain=forward out-interface="${wanIf}" protocol=tcp tcp-flags=syn action=change-mss new-mss=1440 passthrough=yes comment="Starlink MSS Optimization"`);
  } else if (config.wanType === 'pppoe_client') {
    lines.push(
      `/interface pppoe-client add name="pppoe-WAN1" interface="${wanIf}" user="${sanitizeCliToken(config.wanPppoeUser, 'user')}" password="${config.wanPppoePass.replace(/["\\$]/g, '')}" add-default-route=yes use-peer-dns=no disabled=no comment="Primary WAN PPPoE"`
    );
  } else {
    lines.push(`/ip address add address=${sanitizeCliToken(config.wanStaticIp, '192.168.1.2/24')} interface="${wanIf}" comment="Primary Static WAN"`);
    lines.push(`/ip route add dst-address=0.0.0.0/0 gateway=${sanitizeCliToken(config.wanGateway, '192.168.1.1')} check-gateway=ping comment="Primary Default Route"`);
  }

  if (config.hasSecondaryWan) {
    lines.push(``, `# 3b. Secondary Failover WAN (${config.secondaryWanType})`);
    if (config.secondaryWanType === 'dhcp') {
      lines.push(`/ip dhcp-client add interface="${wan2If}" add-default-route=yes default-route-distance=2 use-peer-dns=no disabled=no comment="Secondary Failover WAN"`);
    } else if (config.secondaryWanType === 'static') {
      lines.push(`/ip address add address=${sanitizeCliToken(config.secondaryWanStaticIp, '192.168.2.2/24')} interface="${wan2If}" comment="Secondary Static WAN"`);
      lines.push(`/ip route add dst-address=0.0.0.0/0 gateway=${sanitizeCliToken(config.secondaryWanGateway, '192.168.2.1')} distance=2 check-gateway=ping comment="Secondary Failover Route"`);
    } else {
      lines.push(`/interface pppoe-client add name="pppoe-WAN2" interface="${wan2If}" add-default-route=yes default-route-distance=2 disabled=no comment="Secondary PPPoE WAN"`);
    }
  }

  lines.push(``, `# 4. DNS & Encrypted DoH`);
  if (isV7) {
    if (config.dnsProvider === 'cloudflare_doh') {
      lines.push(`/ip dns set servers=1.1.1.1,1.0.0.1 use-doh-server=https://cloudflare-dns.com/dns-query verify-doh-cert=no allow-remote-requests=yes cache-size=16384KiB`);
    } else if (config.dnsProvider === 'google_doh') {
      lines.push(`/ip dns set servers=8.8.8.8,8.8.4.4 use-doh-server=https://dns.google/dns-query verify-doh-cert=no allow-remote-requests=yes cache-size=16384KiB`);
    } else {
      lines.push(`/ip dns set servers=9.9.9.9,149.112.112.112 allow-remote-requests=yes cache-size=16384KiB`);
    }
  } else {
    const v6Servers =
      config.dnsProvider === 'cloudflare_doh'
        ? '1.1.1.1,1.0.0.1'
        : config.dnsProvider === 'google_doh'
        ? '8.8.8.8,8.8.4.4'
        : '9.9.9.9,149.112.112.112';
    lines.push(`/ip dns set servers=${v6Servers} allow-remote-requests=yes cache-size=8192KiB`);
  }

  const outNatIf = config.wanType === 'pppoe_client' ? 'pppoe-WAN1' : wanIf;
  lines.push(
    ``,
    `# 5. NAT Masquerade`,
    `/ip firewall nat add chain=srcnat out-interface="${outNatIf}" action=masquerade comment="Primary WAN NAT"`
  );
  if (config.hasSecondaryWan) {
    const outNatIf2 = config.secondaryWanType === 'pppoe' ? 'pppoe-WAN2' : wan2If;
    lines.push(`/ip firewall nat add chain=srcnat out-interface="${outNatIf2}" action=masquerade comment="Secondary WAN NAT"`);
  }

  if (config.serviceMode === 'hotspot' || config.serviceMode === 'dual') {
    const dnsName = sanitizeCliToken(config.hotspotDnsName, 'login.mikrocore.net');
    lines.push(
      ``,
      `# 6a. Hotspot Server Setup`,
      `/ip hotspot profile add name=hsprof-MikroCore hotspot-address=${gwIp} dns-name="${dnsName}" login-by=http-chap,http-pap,cookie`,
      `/ip hotspot add name=hs-LAN interface="${bridge}" address-pool=pool-LAN profile=hsprof-MikroCore disabled=no`
    );
  }

  if (config.serviceMode === 'pppoe' || config.serviceMode === 'dual') {
    lines.push(
      ``,
      `# 6b. PPPoE Server Setup`,
      `/ip pool add name=pool-PPPoE ranges=10.50.0.2-10.50.255.254`,
      `/ppp profile add name=pppoe-MikroCore local-address=10.50.0.1 remote-address=pool-PPPoE dns-server=${gwIp}`,
      `/interface pppoe-server server add service-name="Shaban-MikroCore-PPPoE" interface="${bridge}" default-profile=pppoe-MikroCore authentication=pap,chap,mschap2 one-session-per-host=yes disabled=no`
    );
  }

  lines.push(``, `# 7. Enable Secure API / REST Access`);
  if (isV7) {
    lines.push(
      `/certificate add name=mikrocore-ssl common-name=mikrocore.local`,
      `/certificate sign mikrocore-ssl`,
      `/ip service set www-ssl disabled=no certificate=mikrocore-ssl port=443`,
      `/ip service set api-ssl disabled=no certificate=mikrocore-ssl`,
      `/ip service set telnet,ftp disabled=yes`
    );
  } else {
    lines.push(
      `/ip service set api disabled=no port=8728`,
      `/ip service set www disabled=no port=80`,
      `/ip service set telnet,ftp disabled=yes`
    );
  }

  lines.push(``, `:log info "Shaban MikroCore Zero-Touch Bootstrap completed for Tenant ${tenant}"`);
  return lines.join('\n');
}

/**
 * Generates RouterOS v6 or v7 Hotspot/PPPoE profile with embedded second-accurate Auto-Expiry on-login scheduler.
 */
export function generateSpeedProfileScript(
  profile: SpeedProfile,
  osVersion: RouterOSVersion
): string {
  const safeName = sanitizeCliToken(profile.name, 'Profile1M');
  const rateLimit = `${profile.uploadMbps}M/${profile.downloadMbps}M`;
  const durSec = Math.max(60, Math.floor(profile.durationSeconds));

  // Second-accurate auto-expiry scheduler embedded inside on-login!
  const hotspotOnLogin =
    osVersion === 'v7'
      ? `{:local u $user; :if ([:len [/system scheduler find name=("exp_".$u)]] = 0) do={:local expTime ([/system clock get time] + ${durSec}s); /system scheduler add name=("exp_".$u) start-date=[/system clock get date] start-time=$expTime interval=0 on-event=("/ip hotspot user disable [find name=\\"".$u."\\"]; /ip hotspot active remove [find user=\\"".$u."\\"]; /system scheduler remove [find name=\\"exp_".$u."\\"]") comment="AutoExpiry ${durSec}s"}}`
      : `{:local u $user; :if ([:len [/system scheduler find name=("exp_".$u)]] = 0) do={/system scheduler add name=("exp_".$u) interval=${durSec}s on-event=("/ip hotspot user disable [find name=\\"".$u."\\"]; /ip hotspot active remove [find user=\\"".$u."\\"]; /system scheduler remove [find name=\\"exp_".$u."\\"]") comment="AutoExpiry ${durSec}s"}}`;

  const pppOnUp = `{:local u $user; :if ([:len [/system scheduler find name=("ppp_exp_".$u)]] = 0) do={/system scheduler add name=("ppp_exp_".$u) interval=${durSec}s on-event=("/ppp secret disable [find name=\\"".$u."\\"]; /ppp active remove [find name=\\"".$u."\\"]; /system scheduler remove [find name=\\"ppp_exp_".$u."\\"]") comment="PPP AutoExpiry ${durSec}s"}}`;

  const lines: string[] = [
    `# === Speed Profile: ${safeName} (${rateLimit}) | Second-Accurate Auto-Expiry (${durSec}s) | ${osVersion.toUpperCase()} ===`,
  ];

  if (profile.serviceType === 'hotspot' || profile.serviceType === 'both') {
    lines.push(
      `/ip hotspot user profile add name="${safeName}" rate-limit="${rateLimit}" shared-users=${profile.sharedUsers} status-autorefresh=1m on-login="${hotspotOnLogin.replace(/"/g, '\\"')}"`
    );
  }

  if (profile.serviceType === 'pppoe' || profile.serviceType === 'both') {
    lines.push(
      `/ppp profile add name="${safeName}-PPPoE" rate-limit="${rateLimit}" only-one=yes on-up="${pppOnUp.replace(/"/g, '\\"')}"`
    );
  }

  return lines.join('\n');
}

function randomToken(length: number, charset: string): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += charset[Math.floor(Math.random() * charset.length)];
  }
  return out;
}

/**
 * Generates 1 to 1,000 collision-free Hotspot or PPPoE vouchers deterministically.
 */
export function generateVoucherBatch(options: {
  count: number;
  prefix: string;
  codeLength: number;
  charsetMode: 'numeric' | 'alphanumeric';
  pinMode: 'same_as_code' | 'random_pin';
  serviceType: 'hotspot' | 'pppoe';
  profile: SpeedProfile;
  lang: 'ar' | 'en';
}): GeneratedVoucher[] {
  const safeCount = Math.max(1, Math.min(1000, Math.floor(options.count)));
  const safePrefix = sanitizeCliToken(options.prefix, '');
  const len = Math.max(4, Math.min(14, Math.floor(options.codeLength)));
  const charset =
    options.charsetMode === 'numeric'
      ? '0123456789'
      : '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  const used = new Set<string>();
  const vouchers: GeneratedVoucher[] = [];
  const nowIso = new Date().toISOString();

  let safetyLoop = 0;
  while (vouchers.length < safeCount && safetyLoop < safeCount * 20) {
    safetyLoop++;
    const core = randomToken(len, charset);
    const code = `${safePrefix}${core}`;
    if (used.has(code)) continue;
    used.add(code);

    const password =
      options.pinMode === 'same_as_code' ? code : randomToken(4, '0123456789');

    vouchers.push({
      id: `v_${vouchers.length + 1}_${code}`,
      code,
      password,
      profileId: options.profile.id,
      profileName: options.profile.name,
      serviceType: options.serviceType,
      speedLabel: `${options.profile.downloadMbps}M / ${options.profile.uploadMbps}M`,
      durationLabel:
        options.lang === 'ar'
          ? options.profile.durationLabelAr
          : options.profile.durationLabelEn,
      durationSeconds: options.profile.durationSeconds,
      dataQuotaGb: options.profile.dataQuotaGb,
      price: options.profile.price,
      currency: options.profile.currency,
      createdAt: nowIso,
      status: 'unused',
    });
  }

  return vouchers;
}

/**
 * Exports a batch of vouchers + their profile into a ready-to-paste RouterOS .rsc script.
 */
export function generateVoucherBatchRsc(
  vouchers: GeneratedVoucher[],
  profile: SpeedProfile,
  osVersion: RouterOSVersion
): string {
  const lines: string[] = [
    generateSpeedProfileScript(profile, osVersion),
    ``,
    `# === Generated Vouchers Batch (${vouchers.length} accounts) ===`,
  ];

  const limitBytes =
    profile.dataQuotaGb > 0 ? profile.dataQuotaGb * 1024 * 1024 * 1024 : 0;

  for (const v of vouchers) {
    const safeCode = sanitizeCliToken(v.code, 'user');
    const safePass = sanitizeCliToken(v.password, safeCode);
    const safeProf = sanitizeCliToken(profile.name, 'default');
    if (v.serviceType === 'hotspot') {
      const quotaPart = limitBytes > 0 ? ` limit-bytes-total=${limitBytes}` : '';
      lines.push(
        `/ip hotspot user add name="${safeCode}" password="${safePass}" profile="${safeProf}" limit-uptime=${formatDurationCompact(profile.durationSeconds).replace(' ', '')}${quotaPart} comment="MikroCore Price:${v.price}${v.currency}"`
      );
    } else {
      lines.push(
        `/ppp secret add name="${safeCode}" password="${safePass}" service=pppoe profile="${safeProf}-PPPoE" comment="MikroCore Price:${v.price}${v.currency}"`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Generates strictly separated Multi-WAN PCC Load Balancing & Failover script for RouterOS v6 or v7.
 */
export function generateMultiWanPcc(config: PccConfig): string {
  const isV7 = config.osVersion === 'v7';
  const lanIf = sanitizeCliToken(config.lanInterface, 'bridge-LAN');
  const lanSubnet = sanitizeCliToken(config.lanSubnet, '192.168.88.0/24');
  const pingTarget = sanitizeCliToken(config.pingTarget, '1.1.1.1');

  const lines: string[] = [
    `# =========================================================================`,
    `# Shaban MikroCore | Multi-WAN PCC Load Balancing & Failover (${config.osVersion.toUpperCase()})`,
    `# =========================================================================`,
  ];

  // Expand WANs by weight to build exact PCC total streams
  const streams: Array<{ wanIndex: number; wanName: string; ifName: string; gw: string }> = [];
  config.wans.forEach((wan, idx) => {
    const weight = Math.max(1, Math.min(8, Math.floor(wan.weight)));
    const ifName = sanitizeCliToken(wan.interfaceName, `ether${idx + 1}`);
    const gw = sanitizeCliToken(wan.gateway, `192.168.${idx + 1}.1`);
    const wanName = `to-WAN${idx + 1}`;
    for (let w = 0; w < weight; w++) {
      streams.push({ wanIndex: idx, wanName, ifName, gw });
    }
  });

  if (isV7) {
    lines.push(`# 1. RouterOS v7 Routing Tables (FIB)`);
    config.wans.forEach((_, idx) => {
      lines.push(`/routing table add name=to-WAN${idx + 1} fib`);
    });
  } else {
    lines.push(`# 1. RouterOS v6 uses implicit routing-mark in /ip route`);
  }

  lines.push(
    ``,
    `# 2. Bypass Local LAN Traffic in Mangle`,
    `/ip firewall address-list add list=LOCAL-LAN address=${lanSubnet}`,
    `/ip firewall mangle add chain=prerouting src-address-list=LOCAL-LAN dst-address-list=LOCAL-LAN action=accept comment="Bypass local traffic"`,
    ``,
    `# 3. Incoming WAN Connection Marking`
  );

  config.wans.forEach((wan, idx) => {
    const ifName = sanitizeCliToken(wan.interfaceName, `ether${idx + 1}`);
    lines.push(
      `/ip firewall mangle add chain=prerouting in-interface="${ifName}" connection-mark=no-mark action=mark-connection new-connection-mark="WAN${idx + 1}_conn" passthrough=yes`
    );
  });

  lines.push(``, `# 4. PCC Classifier (both-addresses-and-ports) across ${streams.length} streams`);
  streams.forEach((stream, streamIdx) => {
    lines.push(
      `/ip firewall mangle add chain=prerouting in-interface="${lanIf}" connection-mark=no-mark dst-address-type=!local per-connection-classifier=both-addresses-and-ports:${streams.length}/${streamIdx} action=mark-connection new-connection-mark="WAN${stream.wanIndex + 1}_conn" passthrough=yes`
    );
  });

  lines.push(``, `# 5. Mark Routing for Marked Connections`);
  config.wans.forEach((wan, idx) => {
    const ifName = sanitizeCliToken(wan.interfaceName, `ether${idx + 1}`);
    lines.push(
      `/ip firewall mangle add chain=prerouting in-interface="${lanIf}" connection-mark="WAN${idx + 1}_conn" action=mark-routing new-routing-mark="to-WAN${idx + 1}" passthrough=yes`,
      `/ip firewall mangle add chain=output connection-mark="WAN${idx + 1}_conn" action=mark-routing new-routing-mark="to-WAN${idx + 1}" passthrough=yes`
    );
    lines.push(
      `/ip firewall nat add chain=srcnat out-interface="${ifName}" action=masquerade comment="NAT ${sanitizeCliToken(wan.name, `WAN${idx + 1}`)}"`
    );
  });

  lines.push(``, `# 6. Policy Routes & Failover (${config.osVersion.toUpperCase()})`);
  config.wans.forEach((wan, idx) => {
    const gw = sanitizeCliToken(wan.gateway, `192.168.${idx + 1}.1`);
    const check = config.enableFailover ? ' check-gateway=ping' : '';
    if (isV7) {
      lines.push(
        `/ip route add dst-address=0.0.0.0/0 gateway=${gw} routing-table="to-WAN${idx + 1}"${check} distance=1 comment="PCC Policy Route WAN${idx + 1}"`,
        `/ip route add dst-address=0.0.0.0/0 gateway=${gw}${check} distance=${idx + 1} comment="Main Failover WAN${idx + 1}"`
      );
    } else {
      lines.push(
        `/ip route add dst-address=0.0.0.0/0 gateway=${gw} routing-mark="to-WAN${idx + 1}"${check} distance=1 comment="PCC Policy Route WAN${idx + 1}"`,
        `/ip route add dst-address=0.0.0.0/0 gateway=${gw}${check} distance=${idx + 1} comment="Main Failover WAN${idx + 1}"`
      );
    }
  });

  if (config.enableFailover) {
    lines.push(
      ``,
      `# 7. Netwatch Deep Failover Monitor (${pingTarget})`,
      `/tool netwatch add host=${pingTarget} interval=10s timeout=2s down-script=":log warning \\"WAN Link degradation detected toward ${pingTarget}\\""`
    );
  }

  return lines.join('\n');
}

/**
 * Generates Starlink & Gaming Optimizer script (MSS Clamp, DoH, CAKE/PCQ Queue Tree).
 */
export function generateStarlinkGamingOptimizer(config: StarlinkGamingConfig): string {
  const isV7 = config.osVersion === 'v7';
  const wanIf = sanitizeCliToken(config.wanInterface, 'ether1');
  const lanIf = sanitizeCliToken(config.lanInterface, 'bridge-LAN');
  const mss = Math.max(1280, Math.min(1480, Math.floor(config.mssValue)));

  const lines: string[] = [
    `# =========================================================================`,
    `# Shaban MikroCore | Starlink & Gaming Latency Optimizer (${config.osVersion.toUpperCase()})`,
    `# =========================================================================`,
  ];

  if (config.enableMssClamp) {
    lines.push(
      `# 1. Starlink MTU / TCP MSS Clamping`,
      `/ip firewall mangle add chain=forward out-interface="${wanIf}" protocol=tcp tcp-flags=syn tcp-mss=1441-65535 action=change-mss new-mss=${mss} passthrough=yes comment="Starlink Outbound MSS"`,
      `/ip firewall mangle add chain=forward in-interface="${wanIf}" protocol=tcp tcp-flags=syn tcp-mss=1441-65535 action=change-mss new-mss=${mss} passthrough=yes comment="Starlink Inbound MSS"`
    );
  }

  if (config.enableDoh) {
    lines.push(``, `# 2. Encrypted DNS over HTTPS (DoH)`);
    const servers = config.dohProvider === 'cloudflare' ? '1.1.1.1,1.0.0.1' : '8.8.8.8,8.8.4.4';
    const dohUrl =
      config.dohProvider === 'cloudflare'
        ? 'https://cloudflare-dns.com/dns-query'
        : 'https://dns.google/dns-query';
    if (isV7) {
      lines.push(`/ip dns set servers=${servers} use-doh-server=${dohUrl} verify-doh-cert=no allow-remote-requests=yes`);
    } else {
      lines.push(`/ip dns set servers=${servers} allow-remote-requests=yes`);
    }
  }

  if (config.enableGamingQos) {
    lines.push(``, `# 3. Gaming & VoIP Packet Marking`);
    if (config.prioritizeGames.includes('pubg')) {
      lines.push(
        `/ip firewall mangle add chain=prerouting protocol=udp dst-port=10000-20000,7000-8000 action=mark-packet new-packet-mark=GAME_PRIO passthrough=no comment="PUBG Mobile UDP"`
      );
    }
    if (config.prioritizeGames.includes('freefire')) {
      lines.push(
        `/ip firewall mangle add chain=prerouting protocol=udp dst-port=39698,10001-10020 action=mark-packet new-packet-mark=GAME_PRIO passthrough=no comment="FreeFire UDP"`
      );
    }
    if (config.prioritizeGames.includes('cod')) {
      lines.push(
        `/ip firewall mangle add chain=prerouting protocol=udp dst-port=3074,27014-27050 action=mark-packet new-packet-mark=GAME_PRIO passthrough=no comment="Call of Duty UDP"`
      );
    }
    if (config.prioritizeGames.includes('voip')) {
      lines.push(
        `/ip firewall mangle add chain=prerouting protocol=udp dst-port=5060,3478-3481,50000-50050 action=mark-packet new-packet-mark=GAME_PRIO passthrough=no comment="VoIP & Discord Real-Time"`
      );
    }

    lines.push(``, `# 4. Queue Tree (${isV7 ? 'CAKE Anti-Bufferbloat' : 'PCQ Low-Jitter'})`);
    if (isV7) {
      lines.push(
        `/queue type add name=cake-down kind=cake cake-bandwidth=${config.totalDownMbps}M cake-diffserv=diffserv4 cake-flowmode=triple-isolate`,
        `/queue type add name=cake-up kind=cake cake-bandwidth=${config.totalUpMbps}M cake-diffserv=diffserv4 cake-flowmode=triple-isolate`,
        `/queue tree add name=Starlink-Down parent="${lanIf}" max-limit=${config.totalDownMbps}M queue=cake-down`,
        `/queue tree add name=Gaming-Down-P1 parent=Starlink-Down packet-mark=GAME_PRIO priority=1 max-limit=${config.totalDownMbps}M queue=cake-down`,
        `/queue tree add name=Bulk-Down-P8 parent=Starlink-Down packet-mark=no-mark priority=8 max-limit=${Math.max(1, Math.floor(config.totalDownMbps * 0.9))}M queue=cake-down`,
        `/queue tree add name=Starlink-Up parent="${wanIf}" max-limit=${config.totalUpMbps}M queue=cake-up`,
        `/queue tree add name=Gaming-Up-P1 parent=Starlink-Up packet-mark=GAME_PRIO priority=1 max-limit=${config.totalUpMbps}M queue=cake-up`
      );
    } else {
      lines.push(
        `/queue tree add name=Starlink-Down parent="${lanIf}" max-limit=${config.totalDownMbps}M queue=pcq-download-default`,
        `/queue tree add name=Gaming-Down-P1 parent=Starlink-Down packet-mark=GAME_PRIO priority=1 max-limit=${config.totalDownMbps}M queue=default-small`,
        `/queue tree add name=Bulk-Down-P8 parent=Starlink-Down packet-mark=no-mark priority=8 max-limit=${Math.max(1, Math.floor(config.totalDownMbps * 0.9))}M queue=pcq-download-default`,
        `/queue tree add name=Starlink-Up parent="${wanIf}" max-limit=${config.totalUpMbps}M queue=pcq-upload-default`,
        `/queue tree add name=Gaming-Up-P1 parent=Starlink-Up packet-mark=GAME_PRIO priority=1 max-limit=${config.totalUpMbps}M queue=default-small`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Generates Anti-Netcut, Port Hardening & Anti-Hotspot-Sharing (TTL=1) Security Shield script.
 */
export function generateAntiNetcutSecurityShield(config: SecurityShieldConfig): string {
  const bridge = sanitizeCliToken(config.lanBridge, 'bridge-LAN');
  const dhcp = sanitizeCliToken(config.dhcpServerName, 'dhcp-LAN');
  const wanList = sanitizeCliToken(config.wanInterfaceList, 'WAN');
  const trustedLan = sanitizeCliToken(config.lanTrustedSubnet, '192.168.88.0/24');

  const lines: string[] = [
    `# =========================================================================`,
    `# Shaban MikroCore | Anti-Netcut & Cyber Security Shield (${config.osVersion.toUpperCase()})`,
    `# =========================================================================`,
  ];

  if (config.blockNetcutArp) {
    lines.push(
      `# 1. Anti-Netcut & ARP Spoofing Mitigation`,
      `/interface bridge set "${bridge}" arp=reply-only`,
      `/ip dhcp-server set "${dhcp}" add-arp=yes`,
      `/interface bridge filter add chain=forward in-bridge="${bridge}" mac-protocol=arp action=drop comment="Block Client-to-Client ARP Spoofing (Netcut)"`
    );
  }

  if (config.closeInsecurePorts) {
    lines.push(
      ``,
      `# 2. Close Insecure Management Ports & Harden Input Chain`,
      `/ip service set telnet,ftp,www disabled=yes`,
      `/ip firewall filter add chain=input connection-state=established,related action=accept comment="Accept Established/Related"`,
      `/ip firewall filter add chain=input connection-state=invalid action=drop comment="Drop Invalid"`,
      `/ip firewall filter add chain=input protocol=tcp dst-port=21,22,23,80,8291 in-interface-list="${wanList}" action=drop comment="Drop WAN Management Scans"`
    );
  }

  if (config.protectWinboxLanOnly) {
    lines.push(
      `/ip service set winbox address=${trustedLan}`,
      `/tool mac-server set allowed-interface-list=none`,
      `/tool mac-server mac-winbox set allowed-interface-list=none`
    );
  }

  if (config.antiHotspotSharingTtl) {
    lines.push(
      ``,
      `# 3. Anti-Hotspot Sharing (Set Outbound TTL=1 to LAN)`,
      `/ip firewall mangle add chain=postrouting out-interface="${bridge}" action=change-ttl new-ttl=set:1 passthrough=yes comment="Prevent Hotspot Router/Phone Sharing"`
    );
  }

  return lines.join('\n');
}

/**
 * Generates Cisco IOS CLI configuration commands for Switches & Routers.
 */
export function generateCiscoIosCli(config: CiscoConfig): string {
  const host = sanitizeCliToken(config.hostname, 'Shaban-Core-SW1');
  const domain = sanitizeCliToken(config.domainName, 'mikrocore.local');
  const sshUser = sanitizeCliToken(config.sshUser, 'netadmin');
  const sshPass = config.sshPassword.replace(/[\r\n]/g, '') || 'Cisco@2026!';
  const enableSec = config.enableSecret.replace(/[\r\n]/g, '') || 'Enable@2026!';

  const lines: string[] = [
    `! =========================================================================`,
    `! Shaban MikroCore | Cisco IOS Configuration (${config.deviceType.toUpperCase()})`,
    `! =========================================================================`,
    `configure terminal`,
    `hostname ${host}`,
    `ip domain-name ${domain}`,
    `enable secret ${enableSec}`,
    `service password-encryption`,
    `username ${sshUser} privilege 15 secret ${sshPass}`,
    `crypto key generate rsa modulus 2048`,
    `ip ssh version 2`,
    `line vty 0 15`,
    ` transport input ssh`,
    ` login local`,
    ` exec-timeout 10 0`,
    ` exit`,
    `!`,
  ];

  // VLANs
  if (config.vlans.length > 0) {
    lines.push(`! --- VLAN Database ---`);
    for (const v of config.vlans) {
      const vlanId = Math.max(2, Math.min(4094, Math.floor(v.id)));
      const vlanName = sanitizeCliToken(v.name, `VLAN_${vlanId}`);
      lines.push(`vlan ${vlanId}`, ` name ${vlanName}`, ` exit`);
      if (config.deviceType !== 'switch_l2' && v.subnet) {
        lines.push(
          `interface Vlan${vlanId}`,
          ` description ${vlanName}_Gateway`,
          ` ip address ${sanitizeCliToken(v.subnet, '192.168.10.1 255.255.255.0')}`,
          ` no shutdown`,
          ` exit`
        );
      }
    }
    lines.push(`!`);
  }

  // Access & Trunk Ports (Switches)
  if (config.deviceType !== 'router') {
    if (config.accessPorts.trim()) {
      lines.push(
        `! --- Access Ports ---`,
        `interface range ${sanitizeCliToken(config.accessPorts, 'GigabitEthernet0/1-12')}`,
        ` switchport mode access`,
        ` switchport access vlan ${Math.max(1, Math.min(4094, config.accessVlanId))}`,
        ` spanning-tree portfast`
      );
      if (config.enablePortSecurity) {
        lines.push(
          ` switchport port-security`,
          ` switchport port-security maximum ${Math.max(1, Math.min(10, config.portSecMaxMac))}`,
          ` switchport port-security mac-address sticky`,
          ` switchport port-security violation ${config.portSecViolation}`
        );
      }
      lines.push(` exit`, `!`);
    }

    if (config.trunkPorts.trim()) {
      lines.push(
        `! --- 802.1Q Trunk Uplinks ---`,
        `interface range ${sanitizeCliToken(config.trunkPorts, 'GigabitEthernet0/23-24')}`,
        ...(config.deviceType === 'switch_l3' ? [` switchport trunk encapsulation dot1q`] : []),
        ` switchport mode trunk`,
        ` switchport trunk native vlan ${Math.max(1, Math.min(4094, config.nativeVlanId))}`,
        ` exit`,
        `!`
      );
    }
  }

  // Routing
  if (config.deviceType !== 'switch_l2') {
    if (config.deviceType === 'switch_l3') {
      lines.push(`ip routing`);
    }
    if (config.routingMode === 'static' && config.defaultNextHop.trim()) {
      lines.push(
        `! --- Static Default Route ---`,
        `ip route 0.0.0.0 0.0.0.0 ${sanitizeCliToken(config.defaultNextHop, '192.168.1.1')}`,
        `!`
      );
    } else if (config.routingMode === 'ospf') {
      lines.push(
        `! --- OSPF Dynamic Routing ---`,
        `router ospf ${Math.max(1, Math.min(65535, config.ospfProcessId))}`,
        ` router-id ${sanitizeCliToken(config.ospfRouterId, '1.1.1.1')}`,
        ...config.ospfNetworks
          .split('\n')
          .map((n) => n.trim())
          .filter(Boolean)
          .map((net) => ` network ${net}`),
        ` exit`,
        `!`
      );
    }
  }

  // NAT Overload (PAT)
  if (config.enableNatOverload && config.deviceType === 'router') {
    lines.push(
      `! --- NAT Overload (PAT) & ACL ---`,
      `access-list 10 permit ${sanitizeCliToken(config.natAclSubnet, '192.168.10.0 0.0.0.255')}`,
      `interface ${sanitizeCliToken(config.natInsideIf, 'GigabitEthernet0/1')}`,
      ` ip nat inside`,
      ` exit`,
      `interface ${sanitizeCliToken(config.natOutsideIf, 'GigabitEthernet0/0')}`,
      ` ip nat outside`,
      ` exit`,
      `ip nat inside source list 10 interface ${sanitizeCliToken(config.natOutsideIf, 'GigabitEthernet0/0')} overload`,
      `!`
    );
  }

  // RESTCONF API
  if (config.enableRestconf) {
    lines.push(
      `! --- IOS-XE RESTCONF API Automation ---`,
      `ip http secure-server`,
      `restconf`,
      `!`
    );
  }

  lines.push(`end`, `write memory`);
  return lines.join('\n');
}

export interface SafeFamilyConfig {
  osVersion: RouterOSVersion;
  lanInterface: string;
  dnsPreset: 'combined' | 'cleanbrowsing' | 'cloudflare_family';
  forceDnsRedirect: boolean;
  blockDohAndDot: boolean;
}

/**
 * Generates Safe Family & Anti-Porn Shield script enforcing CleanBrowsing & Cloudflare Family DNS
 * plus dstnat port 53 redirect and DoH/DoT bypass prevention (strictly separated for RouterOS v6 / v7).
 */
export function generateSafeFamilyShieldScript(config: SafeFamilyConfig): string {
  const isV7 = config.osVersion === 'v7';
  const lanIf = sanitizeCliToken(config.lanInterface, 'bridge-LAN');

  const servers =
    config.dnsPreset === 'cleanbrowsing'
      ? '185.228.168.168,185.228.169.168'
      : config.dnsPreset === 'cloudflare_family'
      ? '1.1.1.3,1.0.0.3'
      : '185.228.168.168,185.228.169.168,1.1.1.3,1.0.0.3';

  const dohUrl =
    config.dnsPreset === 'cloudflare_family'
      ? 'https://family.cloudflare-dns.com/dns-query'
      : 'https://doh.cleanbrowsing.org/doh/family-filter/';

  const lines: string[] = [
    `# =========================================================================`,
    `# Shaban MikroCore | Safe Family & Anti-Porn Shield (${config.osVersion.toUpperCase()})`,
    `# CleanBrowsing Family (185.228.168.168/169.168) + Cloudflare Family (1.1.1.3/1.0.0.3)`,
    `# =========================================================================`,
    `# 1. Configure Safe Family DNS Servers`,
  ];

  if (isV7) {
    lines.push(
      `/ip dns set servers=${servers} use-doh-server="${dohUrl}" verify-doh-cert=no allow-remote-requests=yes`
    );
  } else {
    lines.push(`/ip dns set servers=${servers} allow-remote-requests=yes`);
  }
  lines.push(`/ip dns cache flush`);

  if (config.forceDnsRedirect) {
    lines.push(
      ``,
      `# 2. Force All Client DNS Queries (Port 53 TCP/UDP) via Router NAT Redirect`,
      `/ip firewall nat add chain=dstnat in-interface="${lanIf}" protocol=udp dst-port=53 action=redirect to-ports=53 comment="MikroCore-SafeFamily-DNS-UDP"`,
      `/ip firewall nat add chain=dstnat in-interface="${lanIf}" protocol=tcp dst-port=53 action=redirect to-ports=53 comment="MikroCore-SafeFamily-DNS-TCP"`
    );
  }

  if (config.blockDohAndDot) {
    lines.push(
      ``,
      `# 3. Block Private DNS (DoT Port 853) & Public DoH Bypass Servers`,
      `/ip firewall filter add chain=forward in-interface="${lanIf}" protocol=tcp dst-port=853 action=drop comment="MikroCore-SafeFamily-Block-DoT-TCP"`,
      `/ip firewall filter add chain=forward in-interface="${lanIf}" protocol=udp dst-port=853 action=drop comment="MikroCore-SafeFamily-Block-DoT-UDP"`,
      `/ip firewall address-list add list=MikroCore_DoH_Bypass address=8.8.8.8 comment="MikroCore-SafeFamily-DoH"`,
      `/ip firewall address-list add list=MikroCore_DoH_Bypass address=8.8.4.4 comment="MikroCore-SafeFamily-DoH"`,
      `/ip firewall address-list add list=MikroCore_DoH_Bypass address=1.1.1.1 comment="MikroCore-SafeFamily-DoH"`,
      `/ip firewall address-list add list=MikroCore_DoH_Bypass address=1.0.0.1 comment="MikroCore-SafeFamily-DoH"`,
      `/ip firewall address-list add list=MikroCore_DoH_Bypass address=9.9.9.9 comment="MikroCore-SafeFamily-DoH"`,
      `/ip firewall address-list add list=MikroCore_DoH_Bypass address=149.112.112.112 comment="MikroCore-SafeFamily-DoH"`,
      `/ip firewall filter add chain=forward in-interface="${lanIf}" dst-address-list=MikroCore_DoH_Bypass protocol=tcp dst-port=443 action=drop comment="MikroCore-SafeFamily-Block-DoH-TCP"`,
      `/ip firewall filter add chain=forward in-interface="${lanIf}" dst-address-list=MikroCore_DoH_Bypass protocol=udp dst-port=443 action=drop comment="MikroCore-SafeFamily-Block-DoH-UDP"`,
      `/ip firewall filter add chain=forward in-interface="${lanIf}" protocol=tcp dst-port=443 tls-host="*.dns.google" action=drop comment="MikroCore-SafeFamily-Block-DoH-SNI1"`,
      `/ip firewall filter add chain=forward in-interface="${lanIf}" protocol=tcp dst-port=443 tls-host="*cloudflare-dns.com" action=drop comment="MikroCore-SafeFamily-Block-DoH-SNI2"`,
      `/ip firewall filter add chain=forward in-interface="${lanIf}" protocol=tcp dst-port=443 tls-host="dns.quad9.net" action=drop comment="MikroCore-SafeFamily-Block-DoH-SNI3"`
    );
  }

  lines.push(``, `:log info "Shaban MikroCore Safe Family & Anti-Porn Shield applied on ${lanIf}"`);
  return lines.join('\n');
}

/**
 * Generates clean idempotent Rollback / Undo script to remove Safe Family rules and restore standard DNS.
 */
export function generateSafeFamilyRollbackScript(osVersion: RouterOSVersion): string {
  const isV7 = osVersion === 'v7';
  const lines: string[] = [
    `# =========================================================================`,
    `# Shaban MikroCore | Safe Family Rollback / Undo Script (${osVersion.toUpperCase()})`,
    `# =========================================================================`,
    `# 1. Safely remove Safe Family NAT & Firewall rules`,
    `/ip firewall nat remove [find comment~"MikroCore-SafeFamily"]`,
    `/ip firewall filter remove [find comment~"MikroCore-SafeFamily"]`,
    `/ip firewall address-list remove [find list="MikroCore_DoH_Bypass"]`,
    ``,
    `# 2. Restore Standard DNS Settings`,
  ];

  if (isV7) {
    lines.push(`/ip dns set servers=1.1.1.1,8.8.8.8 use-doh-server="" allow-remote-requests=yes`);
  } else {
    lines.push(`/ip dns set servers=1.1.1.1,8.8.8.8 allow-remote-requests=yes`);
  }

  lines.push(
    `/ip dns cache flush`,
    `:log info "Shaban MikroCore Safe Family rules rolled back to standard DNS"`
  );

  return lines.join('\n');
}

