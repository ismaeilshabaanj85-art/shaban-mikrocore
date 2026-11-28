export type Language = 'ar' | 'en';
export type AppMode = 'sandbox' | 'live';
export type RouterOSVersion = 'v7' | 'v6';

export type ModuleId =
  | 'noc'
  | 'connection'
  | 'wizard'
  | 'radius'
  | 'pcc_security'
  | 'public_ip'
  | 'vpn_l2tp'
  | 'starlink_quota'
  | 'quota_guard'
  | 'loop_protect'
  | 'maintenance_mode'
  | 'daily_report'
  | 'cisco'
  | 'cisco_vlans'
  | 'cisco_l2'
  | 'cisco_lacp'
  | 'cisco_routing'
  | 'cisco_qos'
  | 'troubleshooter'
  | 'portal'
  | 'finance'
  | 'vault'
  | 'towers'
  | 'guide'
  | 'sandbox'
  | 'admin';

export interface SubscriptionSettings {
  monthlyPriceUsd: number;
  whatsappNumber: string;
}

export interface CustomerAccount {
  id: string;
  tenantUuid: string;
  username: string;
  passwordHash: string;
  customerName: string;
  maxRouters: number;
  expiryDate: string; // YYYY-MM-DD
  status: 'active' | 'suspended';
  createdAt: string;
  lastLoginAt?: string;
}

export interface SessionUser {
  role: 'superadmin' | 'customer';
  username: string;
  displayName: string;
  tenantUuid: string;
  maxRouters: number;
  expiryDate?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  tenantUuid: string;
  action: string;
  severity: 'info' | 'warning' | 'critical';
  details: string;
}

export type ConnectionMethod = 'local_ip' | 'static_ip' | 'cloud_ddns';

export interface RouterProfile {
  id: string;
  name: string;
  model: string;
  osVersion: RouterOSVersion;
  connectionMethod: ConnectionMethod;
  host: string;
  port: number;
  apiUser: string;
  apiPassword: string;
  useHttps: boolean;
  lastConnectedAt?: string;
  status: 'connected' | 'disconnected' | 'sandbox';
}

export interface NocTelemetry {
  cpuLoad: number;
  ramUsedPercent: number;
  ramTotalMb: number;
  ramUsedMb: number;
  temperatureC: number | null;
  voltageV: number | null;
  uptime: string;
  activeHotspot: number;
  activePppoe: number;
  rxMbps: number;
  txMbps: number;
  pingMs?: number | null;
  interfaces?: Array<{ name: string; running: boolean }>;
  history: Array<{ time: string; rx: number; tx: number }>;
}

export interface SystemBroadcast {
  id: string;
  title: string;
  message: string;
  timestamp: number;
}

export interface NocAlertItem {
  id: string;
  severity: 'warning' | 'critical';
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  timestamp: number;
}

export interface ZeroTouchConfig {
  osVersion: RouterOSVersion;
  routerIdentity: string;
  wanType: 'starlink_dhcp' | 'pppoe_client' | 'static_ip';
  wanInterface: string;
  wanPppoeUser: string;
  wanPppoePass: string;
  wanStaticIp: string;
  wanGateway: string;
  hasSecondaryWan: boolean;
  secondaryWanInterface: string;
  secondaryWanType: 'dhcp' | 'pppoe' | 'static';
  secondaryWanStaticIp: string;
  secondaryWanGateway: string;
  lanBridgeName: string;
  lanPorts: string[];
  lanSubnet: string;
  dhcpRange: string;
  serviceMode: 'hotspot' | 'pppoe' | 'dual' | 'nat_only';
  hotspotDnsName: string;
  dnsProvider: 'cloudflare_doh' | 'google_doh' | 'quad9';
  adminPassword: string;
  apiUsername: string;
  apiPassword: string;
  tenantUuid: string;
}

export interface SpeedProfile {
  id: string;
  name: string;
  downloadMbps: number;
  uploadMbps: number;
  dataQuotaGb: number;
  durationSeconds: number;
  durationLabelAr: string;
  durationLabelEn: string;
  sharedUsers: number;
  price: number;
  currency: string;
  serviceType: 'hotspot' | 'pppoe' | 'both';
}

export interface GeneratedVoucher {
  id: string;
  code: string;
  password: string;
  profileId: string;
  profileName: string;
  serviceType: 'hotspot' | 'pppoe';
  speedLabel: string;
  durationLabel: string;
  durationSeconds: number;
  dataQuotaGb: number;
  price: number;
  currency: string;
  createdAt: string;
  status: 'unused' | 'active' | 'expired';
}

export type VoucherTemplateType = 'classic' | 'royal_gold' | 'cyber_modern' | 'thermal_58mm';

export interface PccWanLink {
  id: string;
  name: string;
  interfaceName: string;
  gateway: string;
  weight: number;
}

export interface PccConfig {
  osVersion: RouterOSVersion;
  lanInterface: string;
  lanSubnet: string;
  wans: PccWanLink[];
  enableFailover: boolean;
  pingTarget: string;
}

export interface StarlinkGamingConfig {
  osVersion: RouterOSVersion;
  wanInterface: string;
  lanInterface: string;
  enableDoh: boolean;
  dohProvider: 'cloudflare' | 'google';
  enableMssClamp: boolean;
  mssValue: number;
  enableGamingQos: boolean;
  totalDownMbps: number;
  totalUpMbps: number;
  prioritizeGames: ('pubg' | 'freefire' | 'cod' | 'voip')[];
}

export interface SecurityShieldConfig {
  osVersion: RouterOSVersion;
  lanBridge: string;
  dhcpServerName: string;
  wanInterfaceList: string;
  blockNetcutArp: boolean;
  closeInsecurePorts: boolean;
  antiHotspotSharingTtl: boolean;
  protectWinboxLanOnly: boolean;
  lanTrustedSubnet: string;
}

export interface CiscoConfig {
  deviceType: 'switch_l2' | 'switch_l3' | 'router';
  hostname: string;
  domainName: string;
  enableSecret: string;
  sshUser: string;
  sshPassword: string;
  vlans: Array<{ id: number; name: string; subnet?: string }>;
  accessPorts: string;
  accessVlanId: number;
  trunkPorts: string;
  nativeVlanId: number;
  enablePortSecurity: boolean;
  portSecMaxMac: number;
  portSecViolation: 'restrict' | 'shutdown' | 'protect';
  routingMode: 'none' | 'static' | 'ospf' | 'bgp';
  defaultNextHop: string;
  ospfProcessId: number;
  ospfRouterId: string;
  ospfNetworks: string;
  bgpAsn?: number;
  bgpRouterId?: string;
  bgpNeighborIp?: string;
  bgpRemoteAsn?: number;
  bgpNetworks?: string;
  enableDhcpSnooping?: boolean;
  enableDai?: boolean;
  enableBpduGuard?: boolean;
  enableNatOverload: boolean;
  natInsideIf: string;
  natOutsideIf: string;
  natAclSubnet: string;
  enableRestconf: boolean;
}

export interface BackupVaultItem {
  id: string;
  name: string;
  type: 'rsc' | 'backup' | 'json';
  createdAt: string;
  routerHost: string;
  sizeLabel: string;
  content: string;
}

// === Part 2 Types (Modules 7 - 14) ===

export interface PortalPlan {
  id: string;
  name: string;
  speed: string;
  price: string;
  duration: string;
}

export interface CaptivePortalConfig {
  networkTitle: string;
  subtitle: string;
  primaryColor: string;
  bgColor: string;
  promoBanner: string;
  supportPhone1: string;
  supportPhone2: string;
  showSpeedTestBtn: boolean;
  loginMode?: 'user_pass' | 'pin_only';
  plans: PortalPlan[];
}

export type CurrencyCode = 'USD' | 'SYP' | 'TRY';

export interface ExchangeRates {
  SYP: number; // per 1 USD
  TRY: number; // per 1 USD
}

export interface ResellerAccount {
  id: string;
  name: string;
  phone: string;
  commissionPercent: number;
  maxDebtUsd: number;
  currentDebtUsd: number;
  cardsSoldCount: number;
  totalRevenueUsd: number;
  createdAt: string;
}

export interface FinanceTransaction {
  id: string;
  date: string;
  type: 'income' | 'expense' | 'payment';
  category: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  amountUsd: number;
  resellerId?: string;
}

export interface TowerNode {
  id: string;
  name: string;
  ip: string;
  type: 'sector' | 'ptp_bridge' | 'core_ap';
  signalDbm: number;
  ccqPercent: number;
  pingMs: number;
  status: 'online' | 'degraded' | 'offline';
}

export interface CpeDevice {
  id: string;
  model: string;
  macAddress: string;
  serial: string;
  status: 'in_stock' | 'loaned' | 'sold';
  assignedTo: string;
  notes: string;
}

export interface PppoeSubscriber {
  id: string;
  clientName: string;
  pppoeUsername: string;
  phone: string;
  monthlyFeeUsd: number;
  expiryDate: string; // YYYY-MM-DD
  speedLabel: string;
  notes?: string;
  createdAt: string;
}

export interface TelegramBotConfig {
  enabled: boolean;
  botToken: string;
  adminChatId: string;
  notifyTowerDown: boolean;
  notifyDailyBackup: boolean;
  enableResellerVending: boolean;
  enableBatteryGuard?: boolean;
  lowVoltageThreshold?: number;
  secondaryPortsToShutdown?: string;
}

export interface SandboxInterface {
  name: string;
  type: 'ether' | 'wlan' | 'bridge' | 'cisco_ge';
  status: 'up' | 'down';
  mac: string;
  ip?: string;
  rxMbps: number;
  txMbps: number;
}

export interface SandboxState {
  mikrotikVersion: RouterOSVersion;
  mikrotikIdentity: string;
  mikrotikInterfaces: SandboxInterface[];
  mikrotikRoutes: Array<{ dst: string; gateway: string; table: string }>;
  mikrotikFirewallRules: string[];
  mikrotikActiveUsers: Array<{ user: string; ip: string; service: 'hotspot' | 'pppoe'; uptime: string }>;
  ciscoHostname: string;
  ciscoVlans: Array<{ id: number; name: string; ports: string }>;
  ciscoInterfaces: SandboxInterface[];
}

export interface RouterPublicInfo {
  publicIp: string;
  directIp?: string;
  directInterface?: string;
  cloudExitIp?: string;
  cloudDns: string;
  updatedAt?: number;
}

export interface DailyTrafficSample {
  dateYmd: string; // YYYY-MM-DD
  downloadBytes: number;
  uploadBytes: number;
  peakRxMbps: number;
  peakTxMbps: number;
  samplesCount: number;
  hourlyBytes: Record<string, { down: number; up: number }>;
  lastSampleMs: number;
}

