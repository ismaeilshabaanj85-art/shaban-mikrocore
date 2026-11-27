import { RouterOSVersion } from '../types/mikrocore';
import { sanitizeCliToken } from '../utils/security';

export type ScenarioId =
  | 'block_apps'
  | 'port_forward'
  | 'user_limits'
  | 'starlink_mtu'
  | 'high_cpu'
  | 'netcut_protect'
  | 'scheduled_tasks';

export interface ScenarioQuestion {
  key: string;
  labelAr: string;
  labelEn: string;
  placeholder: string;
  type: 'text' | 'select';
  options?: Array<{ value: string; labelAr: string; labelEn: string }>;
}

export interface DiagnosticScenario {
  id: ScenarioId;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  questions: ScenarioQuestion[];
}

export const DIAGNOSTIC_SCENARIOS: DiagnosticScenario[] = [
  {
    id: 'block_apps',
    titleAr: 'حظر تطبيق أو موقع (TikTok / YouTube / Facebook)',
    titleEn: 'Block App or Website (TikTok / YouTube / Facebook)',
    descAr: 'حظر عبر DNS Static و TLS Host Firewall بدون استهلاك عالي للمعالج.',
    descEn: 'Block via Static DNS sinkhole and TLS Host firewall without heavy CPU load.',
    questions: [
      {
        key: 'osVersion',
        labelAr: 'إصدار النظام (v6 أو v7)',
        labelEn: 'RouterOS Version',
        placeholder: 'v7',
        type: 'select',
        options: [
          { value: 'v7', labelAr: 'RouterOS v7', labelEn: 'RouterOS v7' },
          { value: 'v6', labelAr: 'RouterOS v6', labelEn: 'RouterOS v6' },
        ],
      },
      {
        key: 'targetApp',
        labelAr: 'التطبيق أو النطاق المراد حظره (مثال: tiktok.com)',
        labelEn: 'Target App / Domain (e.g., tiktok.com)',
        placeholder: 'tiktok.com',
        type: 'text',
      },
      {
        key: 'lanSubnet',
        labelAr: 'شبكة المشتركين المستهدفة (CIDR)',
        labelEn: 'Target LAN Subnet (CIDR)',
        placeholder: '192.168.88.0/24',
        type: 'text',
      },
    ],
  },
  {
    id: 'port_forward',
    titleAr: 'توجيه المنافذ (Port Forwarding / DVR / الكاميرات)',
    titleEn: 'Port Forwarding (DST-NAT for DVR / Servers)',
    descAr: 'تحويل منفذ خارجي على خط WAN إلى جهاز داخلي مع Hairpin NAT.',
    descEn: 'Forward external WAN port to internal LAN host with Hairpin NAT support.',
    questions: [
      {
        key: 'wanInterface',
        labelAr: 'اسم منفذ الخروج (WAN Interface)',
        labelEn: 'WAN Interface Name',
        placeholder: 'ether1',
        type: 'text',
      },
      {
        key: 'extPort',
        labelAr: 'رقم المنفذ الخارجي (مثال: 8080)',
        labelEn: 'External Port (e.g., 8080)',
        placeholder: '8080',
        type: 'text',
      },
      {
        key: 'targetIp',
        labelAr: 'عنوان IP الداخلي للجهاز (Target LAN IP)',
        labelEn: 'Target Internal IP',
        placeholder: '192.168.88.50',
        type: 'text',
      },
      {
        key: 'intPort',
        labelAr: 'المنفذ الداخلي (مثال: 80)',
        labelEn: 'Internal Port (e.g., 80)',
        placeholder: '80',
        type: 'text',
      },
    ],
  },
  {
    id: 'user_limits',
    titleAr: 'تحديد سرعة ووقت وحصة مستخدم محدد',
    titleEn: 'User Speed, Burst & Time Limit',
    descAr: 'إنشاء Simple Queue ذكي مع Burst وتحديد ساعات العمل لمشترك معين.',
    descEn: 'Create Simple Queue with burst and active time window for a target IP.',
    questions: [
      {
        key: 'targetIp',
        labelAr: 'عنوان IP المشترك (Target IP)',
        labelEn: 'Subscriber IP',
        placeholder: '192.168.88.120',
        type: 'text',
      },
      {
        key: 'speedLimit',
        labelAr: 'السرعة (رفع/تنزيل مثال: 4M/10M)',
        labelEn: 'Speed (Up/Down e.g. 4M/10M)',
        placeholder: '4M/10M',
        type: 'text',
      },
      {
        key: 'timeWindow',
        labelAr: 'وقت السماح اليومي (مثال: 08:00:00-23:59:59)',
        labelEn: 'Daily Active Time Window',
        placeholder: '08:00:00-23:59:59',
        type: 'text',
      },
    ],
  },
  {
    id: 'starlink_mtu',
    titleAr: 'إصلاح تقطيع ستارلينك وتعديل MTU / MSS',
    titleEn: 'Starlink MTU / MSS & Path Fix',
    descAr: 'ضبط MSS Clamping ومنع تجمّد التصفح والمواقع المشفرة على ستارلينك.',
    descEn: 'Clamp TCP MSS and fix TLS stalls on Starlink connections.',
    questions: [
      {
        key: 'wanInterface',
        labelAr: 'منفذ ستارلينك (WAN Interface)',
        labelEn: 'Starlink WAN Interface',
        placeholder: 'ether1',
        type: 'text',
      },
      {
        key: 'mssValue',
        labelAr: 'قيمة MSS المطلوبة (الموصى به 1440)',
        labelEn: 'Target MSS Value (Recommended 1440)',
        placeholder: '1440',
        type: 'text',
      },
    ],
  },
  {
    id: 'high_cpu',
    titleAr: 'تشخيص ارتفاع استهلاك المعالج (High CPU / Loops)',
    titleEn: 'High CPU & Network Loop Diagnosis',
    descAr: 'فحص العمليات المستهلكة للمعالج وتفعيل RSTP وإلغاء الحزم التالفة.',
    descEn: 'Profile CPU hotspots, enforce RSTP loop guard, and drop invalid floods.',
    questions: [
      {
        key: 'lanBridge',
        labelAr: 'اسم الجسر الرئيسي (Bridge Name)',
        labelEn: 'Main Bridge Name',
        placeholder: 'bridge-LAN',
        type: 'text',
      },
      {
        key: 'wanInterface',
        labelAr: 'منفذ الإنترنت (WAN Interface)',
        labelEn: 'WAN Interface',
        placeholder: 'ether1',
        type: 'text',
      },
    ],
  },
  {
    id: 'netcut_protect',
    titleAr: 'منع برامج قطع النت (Netcut / ARP Spoofing)',
    titleEn: 'Block Netcut & ARP Spoofing',
    descAr: 'عزل عملاء الجسر ومنع التراسل العشوائي لبروتوكول ARP.',
    descEn: 'Enable reply-only ARP with DHCP add-arp and bridge ARP isolation.',
    questions: [
      {
        key: 'lanBridge',
        labelAr: 'اسم جسر الشبكة (LAN Bridge)',
        labelEn: 'LAN Bridge Name',
        placeholder: 'bridge-LAN',
        type: 'text',
      },
      {
        key: 'dhcpName',
        labelAr: 'اسم خادم DHCP',
        labelEn: 'DHCP Server Name',
        placeholder: 'dhcp-LAN',
        type: 'text',
      },
    ],
  },
  {
    id: 'scheduled_tasks',
    titleAr: 'مهام مجدولة (إعادة تشغيل يومية / رفع سرعة ليلي)',
    titleEn: 'Scheduled Tasks (Daily Reboot / Night Boost)',
    descAr: 'إنشاء مهام System Scheduler موثوقة تعمل تلقائياً في الوقت المحدد.',
    descEn: 'Create reliable System Scheduler jobs for automatic maintenance.',
    questions: [
      {
        key: 'taskType',
        labelAr: 'نوع المهمة المجدولة',
        labelEn: 'Scheduled Task Type',
        placeholder: 'reboot',
        type: 'select',
        options: [
          { value: 'reboot', labelAr: 'إعادة تشغيل آمنة فجراً (04:30)', labelEn: 'Safe Daily Reboot (04:30)' },
          { value: 'dns_flush', labelAr: 'تنظيف كاش DNS كل 6 ساعات', labelEn: 'Flush DNS Cache Every 6h' },
        ],
      },
      {
        key: 'startTime',
        labelAr: 'وقت التشغيل (HH:MM:SS)',
        labelEn: 'Start Time (HH:MM:SS)',
        placeholder: '04:30:00',
        type: 'text',
      },
    ],
  },
];

export function getMissingScenarioQuestions(
  scenarioId: ScenarioId,
  answers: Record<string, string>
): ScenarioQuestion[] {
  const scenario = DIAGNOSTIC_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) return [];
  return scenario.questions.filter((q) => !answers[q.key] || !answers[q.key].trim());
}

export function generateScenarioScript(
  scenarioId: ScenarioId,
  answers: Record<string, string>,
  defaultOs: RouterOSVersion
): string {
  const os = (answers.osVersion as RouterOSVersion) || defaultOs;

  switch (scenarioId) {
    case 'block_apps': {
      const domain = sanitizeCliToken(answers.targetApp || 'tiktok.com', 'tiktok.com');
      const subnet = sanitizeCliToken(answers.lanSubnet || '192.168.88.0/24', '192.168.88.0/24');
      return [
        `# === Shaban MikroCore | Block App/Domain (${domain}) [${os.toUpperCase()}] ===`,
        `/ip dns static add name="${domain}" address=127.0.0.1 regexp=".*${domain.replace(/\./g, '\\\\.')}" comment="MikroCore DNS Sinkhole"`,
        `/ip firewall filter add chain=forward src-address=${subnet} protocol=tcp dst-port=443 tls-host="*${domain}*" action=drop comment="Block TLS ${domain}"`,
        `/ip firewall filter add chain=forward src-address=${subnet} protocol=udp dst-port=443 content="${domain.split('.')[0]}" action=drop comment="Block QUIC ${domain}"`,
      ].join('\n');
    }
    case 'port_forward': {
      const wan = sanitizeCliToken(answers.wanInterface || 'ether1', 'ether1');
      const extPort = sanitizeCliToken(answers.extPort || '8080', '8080');
      const targetIp = sanitizeCliToken(answers.targetIp || '192.168.88.50', '192.168.88.50');
      const intPort = sanitizeCliToken(answers.intPort || '80', '80');
      return [
        `# === Shaban MikroCore | Port Forwarding (${extPort} -> ${targetIp}:${intPort}) ===`,
        `/ip firewall nat add chain=dstnat in-interface="${wan}" protocol=tcp dst-port=${extPort} action=dst-nat to-addresses=${targetIp} to-ports=${intPort} comment="MikroCore PortForward ${extPort}"`,
        `/ip firewall nat add chain=srcnat dst-address=${targetIp} protocol=tcp dst-port=${intPort} action=masquerade comment="Hairpin NAT for LAN access"`,
      ].join('\n');
    }
    case 'user_limits': {
      const ip = sanitizeCliToken(answers.targetIp || '192.168.88.120', '192.168.88.120');
      const speed = sanitizeCliToken(answers.speedLimit || '4M/10M', '4M/10M');
      const win = sanitizeCliToken(answers.timeWindow || '08:00:00-23:59:59', '08:00:00-23:59:59');
      return [
        `# === Shaban MikroCore | User Queue & Time Window ===`,
        `/queue simple add name="MikroCore_${ip}" target=${ip}/32 max-limit=${speed} time=${win},sun,mon,tue,wed,thu,fri,sat comment="Timed Bandwidth Policy"`,
      ].join('\n');
    }
    case 'starlink_mtu': {
      const wan = sanitizeCliToken(answers.wanInterface || 'ether1', 'ether1');
      const mss = sanitizeCliToken(answers.mssValue || '1440', '1440');
      return [
        `# === Shaban MikroCore | Starlink MSS & Path Fix ===`,
        `/ip firewall mangle add chain=forward out-interface="${wan}" protocol=tcp tcp-flags=syn tcp-mss=${Number(mss) + 1 || 1441}-65535 action=change-mss new-mss=${mss} passthrough=yes comment="Starlink Out MSS"`,
        `/ip firewall mangle add chain=forward in-interface="${wan}" protocol=tcp tcp-flags=syn tcp-mss=${Number(mss) + 1 || 1441}-65535 action=change-mss new-mss=${mss} passthrough=yes comment="Starlink In MSS"`,
      ].join('\n');
    }
    case 'high_cpu': {
      const br = sanitizeCliToken(answers.lanBridge || 'bridge-LAN', 'bridge-LAN');
      const wan = sanitizeCliToken(answers.wanInterface || 'ether1', 'ether1');
      return [
        `# === Shaban MikroCore | High CPU & Loop Guard ===`,
        `/tool profile duration=10s`,
        `/interface bridge set "${br}" protocol-mode=rstp`,
        `/ip firewall filter add chain=input in-interface="${wan}" protocol=udp dst-port=53 action=drop comment="Stop DNS Amplification Flood"`,
        `/ip firewall filter add chain=forward connection-state=invalid action=drop comment="Drop Invalid Flood Packets"`,
      ].join('\n');
    }
    case 'netcut_protect': {
      const br = sanitizeCliToken(answers.lanBridge || 'bridge-LAN', 'bridge-LAN');
      const dhcp = sanitizeCliToken(answers.dhcpName || 'dhcp-LAN', 'dhcp-LAN');
      return [
        `# === Shaban MikroCore | Netcut & ARP Spoof Prevention ===`,
        `/interface bridge set "${br}" arp=reply-only`,
        `/ip dhcp-server set "${dhcp}" add-arp=yes`,
        `/interface bridge filter add chain=forward in-bridge="${br}" mac-protocol=arp action=drop comment="Block Client ARP Spoofing"`,
      ].join('\n');
    }
    case 'scheduled_tasks': {
      const taskType = answers.taskType || 'reboot';
      const startTime = sanitizeCliToken(answers.startTime || '04:30:00', '04:30:00');
      if (taskType === 'dns_flush') {
        return [
          `# === Shaban MikroCore | Scheduled DNS Cache Flush ===`,
          `/system scheduler add name="MikroCore_DnsFlush" start-time=${startTime} interval=6h on-event="/ip dns cache flush" comment="Periodic DNS Cache Cleanup"`,
        ].join('\n');
      }
      return [
        `# === Shaban MikroCore | Safe Daily Reboot Scheduler ===`,
        `/system scheduler add name="MikroCore_DailyReboot" start-time=${startTime} interval=1d on-event="/system reboot" comment="Scheduled Off-Peak Maintenance Reboot"`,
      ].join('\n');
    }
  }
}
