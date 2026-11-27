import { Language, ModuleId } from '../types/mikrocore';

export interface AssistantReply {
  text: string;
  suggestedModule?: ModuleId;
  suggestedLabel?: string;
}

interface KnowledgeTopic {
  keywords: string[];
  arText: string;
  enText: string;
  suggestedModule: ModuleId;
  arLabel: string;
  enLabel: string;
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
      'لحظر المواقع الإباحية نهائياً على كامل الشبكة ومنع تجاوزه من إعدادات الهاتف:\n1. افتح "دمج الخطوط والحماية" واختر التبويب الأخضر "درع حظر المواقع الإباحية (Safe Family)".\n2. حدد جسر المشتركين (مثل bridge-LAN) واختر CleanBrowsing Family (185.228.168.168) + Cloudflare Family (1.1.1.3).\n3. تأكد من تفعيل خيار dstnat لتحويل كل طلبات بورت 53 TCP/UDP وحظر DoT 853 و DoH 443.\n4. إذا احتجت لإلغاء الحظر لاحقاً، استخدم صندوق "كود التراجع وإلغاء الحظر (Rollback)" الأحمر المجاور مباشرة لإزالة القواعد دون أي أخطاء.',
    enText:
      'To enforce network-wide Safe Family & Anti-Porn filtering:\n1. Open PCC & Security -> "Safe Family & Anti-Porn Shield".\n2. Select your LAN bridge (e.g. bridge-LAN) and CleanBrowsing (185.228.168.168) + Cloudflare Family (1.1.1.3).\n3. Keep Port 53 dstnat redirect and DoT 853 / DoH 443 blocking enabled so phones cannot bypass via Private DNS.\n4. Use the adjacent Red Rollback / Undo Script box anytime to cleanly revert rules.',
    suggestedModule: 'pcc_security',
    arLabel: 'فتح درع حظر الإباحية',
    enLabel: 'Open Safe Family Shield',
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
      'لحل مشكلة بطء الألعاب وارتفاع البينغ وتقطيع ستارلينك:\n1. انتقل إلى "دمج الخطوط والحماية" -> تبويب "محسّن ستارلينك والألعاب".\n2. فعّل TCP MSS Clamping بقيمة 1440 لمنع تجزئة الحزم على ستارلينك.\n3. فعّل DNS over HTTPS (Cloudflare 1.1.1.1) على RouterOS v7 لتسريع استجابة الأسماء.\n4. فعّل CAKE Anti-Bufferbloat (على v7) أو PCQ Low-Jitter (على v6) وحدد سرعة التحميل/الرفع الحقيقية مع إعطاء أولوية Priority 1 لحزم PUBG وFreeFire وVoIP.',
    enText:
      'To eliminate gaming lag, jitter, and Starlink ping spikes:\n1. Open PCC & Security -> "Starlink & Gaming QoS".\n2. Enable TCP MSS Clamping at 1440 to prevent packet fragmentation.\n3. Enable Cloudflare DoH (1.1.1.1) on RouterOS v7.\n4. Enable CAKE Anti-Bufferbloat (v7) or PCQ Priority Queue (v6) with accurate bandwidth ceilings and Priority 1 marking for PUBG, FreeFire, and VoIP.',
    suggestedModule: 'pcc_security',
    arLabel: 'فتح محسّن ستارلينك والألعاب',
    enLabel: 'Open Starlink & Gaming QoS',
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
      'لبرمجة راوتر مايكروتك من الصفر في دقيقة واحدة:\n1. افتح قسم "برمجة من الصفر (Zero-Touch)".\n2. اختر إصدار النظام (RouterOS v7 أو v6) وأدخل اسم الراوتر ونوع خط الإنترنت (Starlink DHCP أو PPPoE Client أو Static IP).\n3. حدد منافذ الجسر المحلي LAN ونطاق الـ DHCP ونوع الخدمة (Hotspot أو PPPoE أو كلاهما).\n4. انسخ السكربت الناتج والصقه في New Terminal أو نفذه عبر REST API مع حفظ لقطة في الخزنة.',
    enText:
      'To configure a fresh MikroTik router from scratch:\n1. Open "Zero-Touch Network Wizard".\n2. Choose RouterOS v6 or v7, set Router Identity, and configure WAN (Starlink DHCP, PPPoE, or Static IP).\n3. Select LAN Bridge ports, DHCP Pool, encrypted DoH DNS, and Hotspot/PPPoE service mode.\n4. Copy the verified script into Winbox New Terminal or deploy via v7 REST API.',
    suggestedModule: 'wizard',
    arLabel: 'فتح معالج البرمجة من الصفر',
    enLabel: 'Open Zero-Touch Wizard',
  },
  {
    keywords: [
      'ربط',
      'توصيل',
      'اتصال',
      'connect',
      'rest',
      'ddns',
      'api',
      'winbox',
      'ربط ستارلينك',
      'ربط مايكروتك',
    ],
    arText:
      'لربط راوتر مايكروتك (وستارلينك) بالمنصة بشكل آمن:\n1. أوصل منفذ ether1 بجهاز ستارلينك (مع تفعيل Bypass Mode إن أمكن أو DHCP Client).\n2. افتح قسم "ربط السيرفر"، انسخ "سكربت الربط أحادي السطر" والصقه في Winbox New Terminal لتفعيل www-ssl (بورت 443 لـ v7) أو API (8728 لـ v6) وإنشاء مستخدم API معزول.\n3. أضف ملف الراوتر بالـ IP المحلي أو Public IP أو Cloud DDNS وبدّل الوضع بالأعلى إلى "اتصال حي بالسيرفر" مع حارس التراجع التلقائي خلال 60 ثانية.',
    enText:
      'To securely link your MikroTik & Starlink router:\n1. Connect Starlink to ether1 (DHCP Client or Bypass Mode).\n2. Open "Server Connection", copy the One-Line Connector script into Winbox New Terminal to enable www-ssl (port 443 on v7) or API (8728 on v6) and create an isolated API user.\n3. Save your router profile (Local IP, Static IP, or Cloud DDNS) and switch top bar mode to Live Router (protected by 60s Auto-Rollback).',
    suggestedModule: 'connection',
    arLabel: 'فتح قسم ربط السيرفر',
    enLabel: 'Open Server Connection',
  },
  {
    keywords: ['pcc', 'دمج', 'failover', 'خطين', 'خطوط', 'توزيع حمل', 'load balanc'],
    arText:
      'لدمج خطين إلى 4 خطوط إنترنت (مثل ستارلينك + فايبر) بتقنية PCC:\n1. افتح "دمج الخطوط والحماية" -> تبويب "دمج الخطوط (PCC)".\n2. اختر إصدار RouterOS بدقة (v7 ينشئ /routing table fib، بينما v6 يستخدم routing-mark).\n3. أضف واجهة كل خط وبوابته (Gateway) وحدد الوزن النسبي حسب سرعة كل خط (مثلاً ستارلينك وزن 2 وفايبر وزن 1).\n4. فعّل Netwatch Failover ليتم تحويل المشتركين تلقائياً فور انقطاع أي خط.',
    enText:
      'For 2–4 WAN PCC Load Balancing & Failover:\n1. Open PCC & Security -> "Multi-WAN PCC".\n2. Choose exact RouterOS v7 (/routing table fib) or v6 (routing-mark).\n3. Enter each WAN interface, gateway, and proportional weight.\n4. Enable check-gateway=ping and Netwatch failover monitoring.',
    suggestedModule: 'pcc_security',
    arLabel: 'فتح معالج دمج PCC',
    enLabel: 'Open Multi-WAN PCC',
  },
  {
    keywords: [
      'بطاق',
      'كروت',
      'كارت',
      'voucher',
      'radius',
      'راديوس',
      'طباع',
      'pppoe',
      'سرعة',
      'فصل',
      'qr',
    ],
    arText:
      'لتوليد وطباعة بطاقات Hotspot و PPPoE مع فصل تلقائي بالثانية:\n1. افتح "الراديوس والبطاقات" واختر باقة جاهزة (من 1M إلى 100M) أو أنشئ باقة مخصصة.\n2. انسخ سكربت البروفايل (المزود بمؤقت on-login دقيق بالثانية) والصقه في الراوتر.\n3. ولّد دفعة من 1 إلى 1,000 بطاقة ثم افتح "استوديو الطباعة" لطباعة البطاقات مع رموز QR بـ 4 قوالب فاخرة أو تصديرها CSV.',
    enText:
      'To generate & print Hotspot/PPPoE vouchers with second-accurate auto-expiry:\n1. Open RADIUS & Vouchers, choose a 1M–100M preset or custom profile.\n2. Deploy the on-login scheduler script to RouterOS for exact expiration.\n3. Generate up to 1,000 collision-free vouchers and print via Print Studio (4 templates + offline QR codes) or export CSV.',
    suggestedModule: 'radius',
    arLabel: 'فتح مركز البطاقات',
    enLabel: 'Open RADIUS & Vouchers',
  },
  {
    keywords: [
      'cisco',
      'سيسكو',
      'vlan',
      'ospf',
      'trunk',
      'nat',
      'catalyst',
      'port security',
      'restconf',
      'سويتش',
    ],
    arText:
      'لبرمجة سويتشات وراوترات سيسكو (Cisco IOS / Catalyst):\n1. افتح "قسم سيسكو الشامل" واختر نوع الجهاز (L2 Switch، L3 Core Switch، أو Router).\n2. أنشئ شبكات VLAN مع بواباتها وحدد منافذ Access ومنافذ 802.1Q Trunk.\n3. فعّل Port Security (Sticky MAC) للحماية من العبث بالمنافذ، وأضف التوجيه الديناميكي OSPF أو NAT Overload وRESTCONF لتوليد أوامر CLI كاملة جاهزة للصق.',
    enText:
      'For Cisco IOS & Catalyst Switch/Router configuration:\n1. Open "Cisco IOS Pro" and pick L2 Switch, L3 Core Switch, or Router.\n2. Define VLANs/SVIs, Access port ranges, 802.1Q Trunks, and sticky Port Security.\n3. Enable Static/OSPF routing, PAT NAT Overload, or IOS-XE RESTCONF to generate ready-to-paste CLI configs.',
    suggestedModule: 'cisco',
    arLabel: 'فتح قسم سيسكو الشامل',
    enLabel: 'Open Cisco IOS Pro',
  },
  {
    keywords: [
      'مال',
      'موزع',
      'دين',
      'ديون',
      'سقف',
      'عملة',
      'عملات',
      'سوري',
      'تركي',
      'دولار',
      'finance',
      'pos',
      'syp',
      'try',
      'usd',
    ],
    arText:
      'لإدارة ديون الموزعين والمحاسبة متعددة العملات:\n1. افتح "النظام المالي والموزعون (POS)".\n2. من تبويب "نقاط البيع والموزعون"، أضف كل موزع مع نسبة العمولة وسقف الدين الأقصى بالدولار؛ سيمنع النظام صرف أي دفعة بطاقات جديدة تلقائياً إذا تجاوز الموزع سقف دينه.\n3. من تبويب "المحاسبة والعملات"، حدّث سعر صرف الليرة السورية (SYP) والليرة التركية (TRY) مقابل الدولار لتسجيل الإيرادات والمصاريف واستخراج كشوفات PDF وExcel CSV.',
    enText:
      'For Reseller Debt Control & Multi-Currency Accounting:\n1. Open "Finance & POS".\n2. In POS & Resellers, configure commission % and hard max credit limit ($); voucher batch issuance is automatically blocked if debt exceeds the limit.\n3. In Accounting & Currencies, set custom USD -> SYP / TRY rates, log voucher sales and operating expenses, and export PDF or CSV statements.',
    suggestedModule: 'finance',
    arLabel: 'فتح النظام المالي والموزعون',
    enLabel: 'Open Finance & POS',
  },
  {
    keywords: ['portal', 'صفحة', 'هوت سبوت', 'login.html', 'تسجيل الدخول', 'حقلين'],
    arText:
      'لتخصيص صفحة دخول الهوتسبوت (حقلين أو رمز فقط):\n1. افتح "مصمم صفحة الهوت سبوت".\n2. اختر من "نوع تسجيل الدخول في الصفحة" بين: حقلين (اسم المستخدم + كلمة المرور) أو حقل واحد (رمز البطاقة فقط).\n3. عدّل الألوان والأسعار وأرقام الدعم وشاهد المعاينة الحية على الجوال، ثم اضغط تصدير للحصول على login.html وstatus.html الجاهزين لمجلد Files في MikroTik.',
    enText:
      'Open Captive Portal Designer to switch between Two Fields (Username & Password) or Single Field (Voucher PIN Only), customize branding/pricing/support numbers with live mobile preview, and export login.html + status.html for MikroTik Files.',
    suggestedModule: 'portal',
    arLabel: 'فتح مصمم الهوتسبوت',
    enLabel: 'Open Portal Designer',
  },
  {
    keywords: ['تيرمينال', 'حظر تطبيق', 'تيك توك', 'port forward', 'netcut', 'cpu', 'troubleshoot'],
    arText:
      'للتشخيص وحل المشكلات عبر النيو تيرمينال الذكي:\n1. افتح "تعديلات ومساعدات + التيرمينال الذكي".\n2. اختر الحالة (حظر تطبيقات مثل تيك توك، توجيه منافذ Port Forward، منع Netcut، تشخيص CPU، أو مهام مجدولة).\n3. أجب عن الأسئلة التفاعلية الإلزامية لتوليد كود دقيق يمكنك نسخه أو اختباره في المحاكي أو تطبيقه مباشرة مع مؤقت أمان 60 ثانية.',
    enText:
      'Open "Troubleshooter & Smart Terminal", pick a diagnostic scenario (App Blocking, Port Forwarding, Netcut ARP, High CPU, or Scheduler), answer the mandatory clarifying inputs, and test in Sandbox or apply with the 60s Auto-Rollback timer.',
    suggestedModule: 'troubleshooter',
    arLabel: 'فتح النيو تيرمينال الذكي',
    enLabel: 'Open Smart Terminal',
  },
  {
    keywords: ['sandbox', 'محاكي', 'تدريب', 'تجرب', 'rb4011'],
    arText:
      'محاكي التدريب العالمي يضم راوتر MikroTik RB4011 (v6/v7) وسويتش Cisco Catalyst 3650 افتراضيين لتجربة أي أمر واكتشاف أخطاء الصياغة باللون الأحمر قبل الترقية والتنفيذ على الراوتر الحقيقي.',
    enText:
      'Pro Sandbox Lab provides virtual MikroTik RB4011 (v6/v7) and Cisco Catalyst 3650 devices with red syntax error highlighting before promoting validated configs to your live router.',
    suggestedModule: 'sandbox',
    arLabel: 'فتح محاكي التدريب',
    enLabel: 'Open Pro Sandbox',
  },
  {
    keywords: ['برج', 'أبراج', 'telegram', 'تيليجرام', 'cpe', 'mikhmon', 'نسخ', 'خزنة', 'backup'],
    arText:
      'لمراقبة الأبراج والنسخ الاحتياطي التلقائي:\n• استخدم "الأبراج والمستودع والأتمتة" لمتابعة إشارة PtP وCCQ، وجرد أجهزة NanoStation/LiteBeam، وتفعيل تنبيهات بوت تيليغرام، واستيراد ملفات Mikhmon CSV.\n• واستخدم "الخزنة والنسخ الاحتياطي" لحفظ لقطات .rsc/.backup ومشاركتها عبر واتساب وتيليغرام وتصدير/استيراد قاعدة البيانات JSON.',
    enText:
      'Use "Towers & Automation" for PtP signal/CCQ monitoring, CPE hardware tracking, Telegram Netwatch alerts, and Mikhmon CSV import — and "Backup Vault" for .rsc/.backup snapshots, WhatsApp/Telegram sharing, and full JSON portability.',
    suggestedModule: 'towers',
    arLabel: 'فتح الأبراج والأتمتة',
    enLabel: 'Open Towers & Automation',
  },
];

export function queryIsmaeilAi(question: string, lang: Language): AssistantReply {
  const q = question.toLowerCase().trim();

  // Score topics by number of keyword matches so specific multi-word prompts route accurately
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

  if (bestTopic && bestScore > 0) {
    return {
      text: lang === 'ar' ? bestTopic.arText : bestTopic.enText,
      suggestedModule: bestTopic.suggestedModule,
      suggestedLabel: lang === 'ar' ? bestTopic.arLabel : bestTopic.enLabel,
    };
  }

  return {
    text:
      lang === 'ar'
        ? 'أهلاً بك في مساعد ismaeil AI الهندسي! يمكنك سؤالي بالتفصيل عن:\n• ربط راوتر مايكروتك وستارلينك وبرمجته من الصفر\n• دمج خطوط PCC وتقليل بينغ الألعاب (PUBG/FreeFire)\n• تفعيل درع حظر المواقع الإباحية (Safe Family) وكود التراجع\n• توليد وطباعة بطاقات Hotspot و PPPoE\n• برمجة سويتشات وراوترات سيسكو VLAN/OSPF/NAT\n• إدارة ديون الموزعين والعملات (USD/SYP/TRY)'
        : 'Welcome to ismaeil AI! Ask me detailed questions about:\n• Linking MikroTik & Starlink + Zero-Touch setup\n• Multi-WAN PCC & Starlink gaming ping fixes\n• Safe Family & Anti-Porn Shield + Rollback script\n• Hotspot & PPPoE voucher generation & printing\n• Cisco IOS VLAN, Trunk, OSPF, NAT & RESTCONF\n• Reseller debt limits & USD/SYP/TRY accounting',
    suggestedModule: 'guide',
    suggestedLabel: lang === 'ar' ? 'تصفح الدليل الشامل' : 'Open Academy Guide',
  };
}
