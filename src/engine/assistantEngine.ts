import { Language, ModuleId, RouterOSVersion } from '../types/mikrocore';
import { sanitizeCliToken } from '../utils/security';

export interface LiveRouterAiContext {
  routerName: string;
  routerId: string;
  osVersion: RouterOSVersion;
  board?: string;
  version?: string;
  cpu?: number;
  temp?: number | null;
  volt?: number | null;
  pingMs?: number | null;
  activeHotspot?: number;
  activePppoe?: number;
  interfaces?: Array<{ name: string; running: boolean }>;
}

export interface AssistantReply {
  text: string;
  suggestedModule?: ModuleId;
  suggestedLabel?: string;
  executableScript?: string;
}

interface KnowledgeTopic {
  keywords: string[];
  arText: string;
  enText: string;
  suggestedModule: ModuleId;
  arLabel: string;
  enLabel: string;
  buildScript?: (ctx: LiveRouterAiContext) => string;
}

function pickWanLanFromContext(ctx?: LiveRouterAiContext): { wan: string; lan: string } {
  const ifaces = ctx?.interfaces || [];
  const wan =
    ifaces.find((i) => /^(ether1|wan|starlink|pppoe|lte|sfp)/i.test(i.name))?.name || 'ether1';
  const lan =
    ifaces.find((i) => /^(bridge|lan|ether2)/i.test(i.name))?.name || 'bridge-LAN';
  return {
    wan: sanitizeCliToken(wan, 'ether1'),
    lan: sanitizeCliToken(lan, 'bridge-LAN'),
  };
}

const KNOWLEDGE_BASE: KnowledgeTopic[] = [
  {
    keywords: [
      'اباح',
      'إباح',
      'عائل',
      'porn',
      'adult',
      'safe family',
      'cleanbrowsing',
      '185.228',
      '1.1.1.3',
      'تراجع',
      'حظر المواقع',
      'فلتر',
    ],
    arText:
      'لحظر المواقع الإباحية نهائياً على كامل الشبكة ومنع تجاوزه من إعدادات الهاتف:\n1. افتح "دمج الخطوط والحماية" واختر التبويب الأخضر "درع حظر المواقع الإباحية (Safe Family)".\n2. حدد جسر المشتركين (مثل bridge-LAN) واختر CleanBrowsing Family (185.228.168.168) + Cloudflare Family (1.1.1.3).\n3. تأكد من تفعيل خيار dstnat لتحويل كل طلبات بورت 53 TCP/UDP وحظر DoT 853 و DoH 443.',
    enText:
      'To enforce network-wide Safe Family & Anti-Porn filtering:\n1. Open PCC & Security -> "Safe Family & Anti-Porn Shield".\n2. Select your LAN bridge and CleanBrowsing (185.228.168.168) + Cloudflare Family (1.1.1.3).\n3. Keep Port 53 dstnat redirect and DoT 853 blocking enabled.',
    suggestedModule: 'pcc_security',
    arLabel: 'فتح درع حظر الإباحية',
    enLabel: 'Open Safe Family Shield',
    buildScript: (ctx) => {
      const { lan } = pickWanLanFromContext(ctx);
      return [
        ctx.osVersion === 'v7'
          ? `/ip dns set servers=185.228.168.168,1.1.1.3 use-doh-server="https://doh.cleanbrowsing.org/doh/family-filter/" allow-remote-requests=yes`
          : `/ip dns set servers=185.228.168.168,1.1.1.3 allow-remote-requests=yes`,
        `/ip firewall nat add chain=dstnat in-interface="${lan}" protocol=udp dst-port=53 action=redirect to-ports=53 comment="MikroCore-SafeFamily-DNS"`,
        `/ip firewall filter add chain=forward in-interface="${lan}" protocol=tcp dst-port=853 action=drop comment="MikroCore-SafeFamily-Block-DoT"`,
      ].join('\n');
    },
  },
  {
    keywords: [
      'starlink',
      'ستارلينك',
      'بينغ',
      'ping',
      'لعب',
      'ألعاب',
      'العاب',
      'بطء',
      'lag',
      'pubg',
      'ببجي',
      'freefire',
      'cake',
      'mtu',
      'mss',
      'bufferbloat',
    ],
    arText:
      'لحل مشكلة بطء الألعاب وارتفاع البينغ وتقطيع ستارلينك:\n1. فعّل TCP MSS Clamping بقيمة 1440 لمنع تجزئة الحزم.\n2. فعّل DNS over HTTPS (Cloudflare 1.1.1.1) على RouterOS v7.\n3. فعّل CAKE Anti-Bufferbloat (على v7) أو PCQ Low-Jitter (على v6) مع أولوية Priority 1 للألعاب.',
    enText:
      'To eliminate gaming lag and Starlink ping spikes:\n1. Enable TCP MSS Clamping at 1440.\n2. Enable Cloudflare DoH (1.1.1.1) on RouterOS v7.\n3. Enable CAKE Anti-Bufferbloat (v7) or PCQ Priority Queue (v6).',
    suggestedModule: 'pcc_security',
    arLabel: 'فتح محسّن ستارلينك والألعاب',
    enLabel: 'Open Starlink & Gaming QoS',
    buildScript: (ctx) => {
      const { wan, lan } = pickWanLanFromContext(ctx);
      return ctx.osVersion === 'v7'
        ? [
            `/ip firewall mangle add chain=forward out-interface="${wan}" protocol=tcp tcp-flags=syn action=change-mss new-mss=1440 passthrough=yes comment="Starlink MSS"`,
            `/ip dns set servers=1.1.1.1,1.0.0.1 use-doh-server="https://cloudflare-dns.com/dns-query" verify-doh-cert=no allow-remote-requests=yes`,
            `/queue type add name=mc-cake-down kind=cake cake-bandwidth=200M cake-diffserv=diffserv4`,
            `/queue tree add name=MC-CAKE-Down parent="${lan}" max-limit=200M queue=mc-cake-down`,
          ].join('\n')
        : [
            `/ip firewall mangle add chain=forward out-interface="${wan}" protocol=tcp tcp-flags=syn action=change-mss new-mss=1440 passthrough=yes comment="Starlink MSS"`,
            `/ip dns set servers=1.1.1.1,1.0.0.1 allow-remote-requests=yes`,
          ].join('\n');
    },
  },
  {
    keywords: [
      'من الصفر',
      'تأسيس',
      'zero-touch',
      'zero touch',
      'راوتر جديد',
      'تهيئة',
      'برمجة راوتر',
      'bootstrap',
      'dhcp',
      'bridge',
    ],
    arText:
      'لبرمجة راوتر مايكروتك من الصفر في دقيقة واحدة، استخدم معالج "برمجة من الصفر (Zero-Touch)" لتوليد خط WAN وBridge LAN وDHCP وHotspot/PPPoE مع حماية DoH.',
    enText:
      'Use the Zero-Touch Network Wizard to bootstrap WAN, LAN Bridge, DHCP Pool, Hotspot/PPPoE, and DoH DNS in one verified script.',
    suggestedModule: 'wizard',
    arLabel: 'فتح معالج البرمجة من الصفر',
    enLabel: 'Open Zero-Touch Wizard',
  },
  {
    keywords: ['ربط', 'توصيل', 'اتصال', 'connect', 'rest', 'ddns', 'api', 'winbox'],
    arText:
      'لربط راوترك بالمنصة خلف أي شبكة أو CGNAT: افتح "ربط السيرفر"، انسخ سطر MikroCore_CloudAgent (8 ثوانٍ) والصقه في Winbox New Terminal.',
    enText:
      'Open "Server Connection" and paste the 8-second MikroCore_CloudAgent one-liner into Winbox New Terminal to connect behind any NAT/CGNAT.',
    suggestedModule: 'connection',
    arLabel: 'فتح قسم ربط السيرفر',
    enLabel: 'Open Server Connection',
  },
  {
    keywords: ['pcc', 'دمج', 'failover', 'خطين', 'خطوط', 'توزيع حمل', 'load balanc'],
    arText:
      'لدمج 2 إلى 4 خطوط إنترنت بتقنية PCC مع التحويل الآلي Failover، افتح قسم "دمج الخطوط والحماية" واختر إصدار RouterOS (v7 ينشئ /routing table fib).',
    enText:
      'Open PCC & Security -> Multi-WAN PCC to combine 2–4 WAN uplinks with exact RouterOS v6/v7 syntax and failover.',
    suggestedModule: 'pcc_security',
    arLabel: 'فتح معالج دمج PCC',
    enLabel: 'Open Multi-WAN PCC',
  },
  {
    keywords: ['بطاق', 'كروت', 'كارت', 'voucher', 'radius', 'راديوس', 'طباع', 'pppoe', 'qr'],
    arText:
      'يمكنك توليد بطاقات 1M–100M ودفعها مباشرة إلى `/ip hotspot user` بضغطة "إرسال للسيرفر مباشرة 🚀" وطباعة صفحات A4 احترافية (24/32 بطاقة مع QR) من استوديو الطباعة.',
    enText:
      'Generate 1M–100M vouchers, push directly to `/ip hotspot user`, and print 24/32-card A4 PDF grids with instant-login QR codes.',
    suggestedModule: 'radius',
    arLabel: 'فتح مركز البطاقات',
    enLabel: 'Open RADIUS & Vouchers',
  },
  {
    keywords: ['cisco', 'سيسكو', 'vlan', 'ospf', 'bgp', 'lacp', 'trunk', 'nat', 'dai', 'snooping'],
    arText:
      'افتح "قسم سيسكو الشامل" لتوليد إعدادات VLAN/SVI، تشديد L2 (DHCP Snooping / DAI / BPDU Guard)، توجيه OSPF/BGP، أو مزامنة Cisco <-> MikroTik LACP و VLANs جنباً إلى جنب.',
    enText:
      'Open Cisco IOS Pro for VLAN/SVI, L2 Hardening (DHCP Snooping/DAI/BPDU Guard), OSPF/BGP routing, and side-by-side Cisco <-> MikroTik LACP sync.',
    suggestedModule: 'cisco',
    arLabel: 'فتح قسم سيسكو الشامل',
    enLabel: 'Open Cisco IOS Pro',
  },
  {
    keywords: [
      'مال',
      'موزع',
      'دين',
      'عملة',
      'عملات',
      'واتساب',
      'منزلي',
      'finance',
      'pos',
      'reseller',
      'debt',
      'syp',
      'try',
      'usd',
      'currency',
      'whatsapp',
    ],
    arText:
      'افتح "النظام المالي والموزعون" لإدارة ديون الموزعين بالعملات الثلاث (USD/SYP/TRY) بالإضافة إلى تبويب "فوترة المنزلي PPPoE وتنبيهات واتساب" لتذكير المشتركين بضغطة زر.',
    enText:
      'Open Finance & POS for multi-currency reseller ledgers and 1-click PPPoE WhatsApp billing reminders.',
    suggestedModule: 'finance',
    arLabel: 'فتح النظام المالي',
    enLabel: 'Open Finance & POS',
  },
  {
    keywords: ['حرار', 'معالج', 'cpu', 'بطء', 'تشخيص', 'netcut', 'فحص', 'راوتر', 'حالة'],
    arText:
      'بناءً على فحص الراوتر الحالي، يمكنك تنظيف الاتصالات العالقة وحماية الواجهة وتفعيل منع مشاركة الهوتسبوت وتقييد المنافذ مباشرة عبر السكربت المولد أدناه.',
    enText:
      'Based on your active router diagnostics, you can clean stale connections and apply anti-Netcut/TTL protection directly with the generated script below.',
    suggestedModule: 'noc',
    arLabel: 'فتح لوحة القيادة الحية',
    enLabel: 'Open Live NOC',
    buildScript: (ctx) => {
      const { lan } = pickWanLanFromContext(ctx);
      return [
        `/ip firewall connection remove [find timeout>1h]`,
        `/ip firewall mangle add chain=postrouting out-interface="${lan}" action=change-ttl new-ttl=set:1 passthrough=yes comment="Anti-Sharing-TTL1"`,
        `/ip dns cache flush`,
      ].join('\n');
    },
  },
];

export function queryIsmaeilAi(
  question: string,
  lang: Language,
  routerContext?: LiveRouterAiContext
): AssistantReply {
  const q = question.toLowerCase().trim();

  let bestTopic: KnowledgeTopic | null = null;
  let bestScore = 0;

  for (const topic of KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (q.includes(kw)) {
        score += kw.length > 4 ? 2 : 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  const contextSummaryAr = routerContext
    ? `\n\n📡 سياق الراوتر النشط (${routerContext.routerName} · ${routerContext.board || 'MikroTik'} · ${routerContext.version || routerContext.osVersion.toUpperCase()}):\n• المعالج: ${routerContext.cpu ?? '--'}% | البنق: ${routerContext.pingMs ?? '--'} ms | Hotspot: ${routerContext.activeHotspot ?? 0} · PPPoE: ${routerContext.activePppoe ?? 0}`
    : '';
  const contextSummaryEn = routerContext
    ? `\n\n📡 Active Router Context (${routerContext.routerName} · ${routerContext.board || 'MikroTik'} · ${routerContext.version || routerContext.osVersion.toUpperCase()}):\n• CPU: ${routerContext.cpu ?? '--'}% | Ping: ${routerContext.pingMs ?? '--'} ms | Hotspot: ${routerContext.activeHotspot ?? 0} · PPPoE: ${routerContext.activePppoe ?? 0}`
    : '';

  if (bestTopic && bestScore > 0) {
    const baseText = lang === 'ar' ? bestTopic.arText : bestTopic.enText;
    return {
      text: `${baseText}${lang === 'ar' ? contextSummaryAr : contextSummaryEn}`,
      suggestedModule: bestTopic.suggestedModule,
      suggestedLabel: lang === 'ar' ? bestTopic.arLabel : bestTopic.enLabel,
      executableScript:
        routerContext && bestTopic.buildScript ? bestTopic.buildScript(routerContext) : undefined,
    };
  }

  return {
    text:
      (lang === 'ar'
        ? 'أهلاً بك في مساعد ismaeil AI الهندسي! يمكنك سؤالي بالتفصيل عن:\n• ربط راوتر مايكروتك وستارلينك وبرمجته من الصفر\n• دمج خطوط PCC وتقليل بينغ الألعاب (PUBG/FreeFire)\n• تفعيل درع حظر المواقع الإباحية (Safe Family)\n• توليد وطباعة بطاقات A4 وفوترة PPPoE واتساب\n• برمجة سيسكو VLAN/OSPF/BGP ومزامنة LACP'
        : 'Welcome to ismaeil AI! Ask me about:\n• MikroTik & Starlink + Zero-Touch setup\n• Multi-WAN PCC & Starlink gaming ping fixes\n• Safe Family & Anti-Porn Shield\n• A4 Vouchers & PPPoE WhatsApp billing\n• Cisco VLAN/OSPF/BGP & LACP sync') +
      (lang === 'ar' ? contextSummaryAr : contextSummaryEn),
    suggestedModule: 'guide',
    suggestedLabel: lang === 'ar' ? 'تصفح الدليل الشامل' : 'Open Academy Guide',
  };
}

