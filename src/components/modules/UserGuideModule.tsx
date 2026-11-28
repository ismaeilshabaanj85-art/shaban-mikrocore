import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Search,
} from 'lucide-react';
import { Language, ModuleId } from '../../types/mikrocore';

interface UserGuideModuleProps {
  lang: Language;
  onNavigateModule: (id: ModuleId) => void;
}

interface GuideCard {
  moduleId: ModuleId;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  stepsAr: string[];
  stepsEn: string[];
}

const GUIDE_CARDS: GuideCard[] = [
  {
    moduleId: 'connection',
    titleAr: '1. الربط السحابي الشامل (RouterOS v6 & v7 خلف CGNAT/ستارلينك)',
    titleEn: '1. Universal Cloud Agent Connection (v6 & v7 behind CGNAT/Starlink)',
    summaryAr: 'ربط أي راوتر مايكروتك خلال ثوانٍ خلف CGNAT أو ستارلينك بدون IP عام أو فتح بورتات عبر سطر MikroCore_CloudAgent.',
    summaryEn: 'Connect any RouterOS v6/v7 router behind CGNAT/Starlink with zero port-forwarding using MikroCore_CloudAgent.',
    stepsAr: [
      'أضف ملف الراوتر واختر الإصدار (RouterOS v7 أو v6) ثم انسخ سطر الربط السحابي.',
      'الصق السطر في Winbox -> New Terminal ليبدأ البث كل 8 ثوانٍ وسحب الأوامر كل 15 ثانية.',
      'تظهر القراءات الحقيقية فوراً (المعالج، الحرارة/الفولتية إن وُجدت، الترافيك rx/tx، والبينغ) مع حماية تلقائية عند انقطاع الحساسات.',
    ],
    stepsEn: [
      'Create a router profile, pick v6 or v7, and copy the one-line MikroCore_CloudAgent script.',
      'Paste into Winbox -> New Terminal; telemetry pushes every 8s and command polling runs every 15s.',
      'Live CPU, optional health sensors, interface rx/tx bps, and ping telemetry appear automatically.',
    ],
  },
  {
    moduleId: 'noc',
    titleAr: '2. لوحة القيادة الحية (5 تبويبات + جرد عند الطلب + اكتشاف الأطباق)',
    titleEn: '2. 5-Tab Live NOC & On-Demand Heavy Inventory / Dish Discovery',
    summaryAr: 'مراقبة المتصلين، رسم السرعة، التنبيهات الذكية، وسحب قوائم DHCP و PPPoE و Hotspot والأطباق المحيطة بالطلب.',
    summaryEn: 'Live gauges, traffic charts, smart alerts, plus on-demand DHCP/PPPoE/Hotspot & Neighbor Dish inventory.',
    stepsAr: [
      'تنقل بين تبويبات النظرة العامة، الواجهات والراديوس، مستكشف الشبكة والأطباق، السجلات والرسائل، والموقع الجغرافي.',
      'اضغط "تحديث القائمة من الراوتر 🔄" في التبويب الثالث لإرسال أمر SYNC_INVENTORY وقراءة المشتركين وأجهزة Ubiquiti/MikroTik.',
      'راقب تنبيهات هبوط الفولتية أو ارتفاع المعالج أو تراجع البينغ مع إشعار المتصفح الفوري.',
    ],
    stepsEn: [
      'Switch across Overview, Interfaces & RADIUS, Neighbor/Dish Discovery, Logs, and Geo Map tabs.',
      'Click "Refresh Inventory from Router 🔄" to trigger SYNC_INVENTORY for DHCP, Hotspot, PPPoE, and Neighbor dishes.',
      'Monitor automated alerts for high CPU, high latency, or low battery voltage.',
    ],
  },
  {
    moduleId: 'radius',
    titleAr: '3. مصنع البطاقات واستوديو طباعة A4 الاحترافي (24 / 32 بطاقة + QR)',
    titleEn: '3. Pro Voucher Factory & A4 Print Studio (24/32 Cards + QR)',
    summaryAr: 'دفع البطاقات مباشرة إلى /ip hotspot user وطباعة صفحات A4 احترافية مقسمة للقص مع رمز QR واسم الشبكة ورقم الدعم.',
    summaryEn: 'Push generated vouchers straight to /ip hotspot user and print cut-ready 24 or 32-card A4 PDF sheets with QR.',
    stepsAr: [
      'ولّد دفعة بطاقات (1M–100M) واضغط "إرسال للسيرفر مباشرة 🚀" لحقنها في الراوتر عبر السحابة.',
      'افتح "طباعة صفحة A4 احترافية (PDF) 🖨️" واختر كثافة 24 (4×6) أو 32 (4×8) بطاقة في الصفحة.',
      'تعرض كل بطاقة اسم الشبكة ورقم الدعم والسعر والمدة والسرعة وبيانات الدخول ورمز QR الفوري.',
    ],
    stepsEn: [
      'Generate 1M–100M vouchers and click "Push Directly to Server 🚀" to deploy them to /ip hotspot user.',
      'Open "Pro A4 Print Studio (PDF) 🖨️" and choose 24 (4×6) or 32 (4×8) cut-ready cards per page.',
      'Every card shows Network Name, Support Phone, Price, Validity/Speed, credentials, and instant-login QR.',
    ],
  },
  {
    moduleId: 'pcc_security',
    titleAr: '4. الهندسة، CAKE / FQ-Codel، VRRP HA، ودرع Safe Family',
    titleEn: '4. Multi-WAN PCC, CAKE / FQ-Codel QoS, VRRP HA & Safe Family',
    summaryAr: 'دمج الخطوط، طوابير CAKE/FQ-Codel لمنع Bufferbloat، تكرار VRRP، ودرع حظر المواقع الإباحية مع التراجع الفوري.',
    summaryEn: 'PCC Multi-WAN, Carrier CAKE/FQ-Codel QoS, VRRP failover, Anti-Netcut, and Safe Family with Rollback.',
    stepsAr: [
      'استخدم تبويب "دمج الخطوط PCC" أو "محسّن ستارلينك والألعاب" مع توافق كامل بين RouterOS v6 و v7.',
      'من تبويب "جودة CAKE / FQ-Codel و VRRP" اضبط سرعة الخط لمنع Bufferbloat وأنشئ راوتر Master/Backup بتكرار VRRP.',
      'فعّل "درع حظر المواقع الإباحية" مع إمكانية التراجع الكامل عبر صندوق Rollback.',
    ],
    stepsEn: [
      'Configure 2–4 WAN PCC balancing or Starlink MSS/DoH optimization separated cleanly for v6 and v7.',
      'Use "Carrier QoS & VRRP HA" for CAKE/FQ-Codel bufferbloat control and Master/Backup VRRP redundancy.',
      'Deploy Safe Family DNS/Firewall filtering with an instant one-click Rollback script.',
    ],
  },
  {
    moduleId: 'cisco',
    titleAr: '5. سيسكو Enterprise (L2/OSPF/BGP) ومزامنة LACP مع مايكروتك',
    titleEn: '5. Cisco Enterprise (L2/OSPF/BGP) & Cisco <-> MikroTik LACP Sync',
    summaryAr: 'توليد أوامر VLAN/SVI، تشديد L2 (DHCP Snooping/DAI/BPDU Guard)، BGP/OSPF، ومزامنة Port-Channel LACP مع MikroTik.',
    summaryEn: 'Generate Cisco VLANs, DHCP Snooping/DAI/BPDU Guard, OSPF/BGP, and paired Cisco <-> MikroTik 802.3ad LACP trunks.',
    stepsAr: [
      'اختر L2/L3 Switch أو IOS Router وحدد خيارات تشديد الطبقة الثانية وتوجيه OSPF أو BGP.',
      'انتقل إلى تبويب "مزامنة Cisco <-> MikroTik (LACP)" لتوليد أوامر الطرفين معاً بضغطة واحدة.',
      'ارسل جزء مايكروتك (Bonding + Bridge VLAN Filtering) مباشرة إلى الراوتر عبر السحابة.',
    ],
    stepsEn: [
      'Configure VLANs, L2 security hardening (DHCP Snooping, DAI, BPDU Guard), and OSPF/BGP routing.',
      'Switch to "Cisco <-> MikroTik LACP Sync" for side-by-side EtherChannel & 802.3ad Bonding CLI.',
      'Push the MikroTik Bonding/VLAN configuration directly to your router via Cloud Agent.',
    ],
  },
  {
    moduleId: 'finance',
    titleAr: '6. الموزعون POS، فوترة PPPoE وتنبيهات واتساب والعملات',
    titleEn: '6. Reseller POS, PPPoE Home Billing & 1-Click WhatsApp Reminder',
    summaryAr: 'إدارة الموزعين بسقف الدين، فوترة مشتركي المنازل PPPoE مع تذكير واتساب وتحويل الانتهاء، ومحاسبة USD/SYP/TRY.',
    summaryEn: 'Manage reseller credit limits, home PPPoE subscribers with WhatsApp reminders/expiry redirects, and USD/SYP/TRY ledgers.',
    stepsAr: [
      'من تبويب "فوترة المنزلي PPPoE وتنبيهات واتساب" أضف المشتركين المنزليين وتاريخ الانتهاء والاشتراك الشهري.',
      'اضغط "تذكير واتساب 💬" لفتح رسالة تجديد عربية جاهزة باسم المشترك والمبلغ والباقة.',
      'اضغط "+30d" للتجديد وتسجيل الإيراد تلقائياً، أو "تحويل الانتهاء 🚀" لرفع قاعدة التحويل للراوتر.',
    ],
    stepsEn: [
      'Open "PPPoE Home Billing & WhatsApp" to track monthly subscribers, fees, and expiry dates.',
      'Click "WhatsApp 💬" to open a pre-filled Arabic renewal notice with client details.',
      'Click "+30d" to renew and record ledger revenue, or "Expiry Redirect 🚀" to push router redirect rules.',
    ],
  },
  {
    moduleId: 'towers',
    titleAr: '7. حارس البطارية الذكي، بوت تيليغرام، ومصفوفة بنق الألعاب و DNS',
    titleEn: '7. Smart Battery Guard, Telegram NOC Bot & Gaming Ping Matrix',
    summaryAr: 'حماية البطاريات بفصل المنافذ الثانوية وتنبيه تيليغرام عند هبوط الفولتية، وفحص بنغ PUBG و Discord و DNS.',
    summaryEn: 'Auto-disable secondary ports & send Telegram alerts on low voltage, plus benchmark PUBG/Discord/DNS latency.',
    stepsAr: [
      'من تبويب "الأبراج و PtP" اضغط "فحص مصفوفة الألعاب و DNS 🎮" لقياس زمن الاستجابة والتذبذب لـ 1.1.1.1 و 8.8.8.8 و PUBG EU.',
      'من تبويب "بوت تيليغرام والأتمتة" أدخل Bot Token و Chat ID وحدد حد الفولتية (مثل 22.5V) والمنافذ الثانوية.',
      'اضغط "إرسال حارس البطارية للراوتر 🚀" لتفعيل المراقبة الدورية والحماية التلقائية.',
    ],
    stepsEn: [
      'Click "Run Gaming & DNS Matrix 🎮" under Towers to check latency & jitter to 1.1.1.1, 8.8.8.8, PUBG EU, and Discord.',
      'In Telegram Bot tab, configure Bot Token, Chat ID, voltage threshold (e.g. 22.5V), and secondary ports.',
      'Click "Push Battery Guard to Router 🚀" to deploy scheduled voltage protection.',
    ],
  },
  {
    moduleId: 'troubleshooter',
    titleAr: '8. التعديلات، النيو تيرمينال، المحاكي، ومساعد ismaeil AI الحي',
    titleEn: '8. Smart Troubleshooter, Sandbox & Live-Aware ismaeil AI',
    summaryAr: 'تشخيص تفاعلي واختبار آمن في المحاكي، بالإضافة لمساعد ismaeil AI المرتبط بحالة راوترك الحية لتنفيذ الحلول فوراً.',
    summaryEn: 'Interactive Q&A troubleshooter, RB4011/Cisco Sandbox, plus live-aware ismaeil AI with 1-click router execution.',
    stepsAr: [
      'استخدم قسم التعديلات لإعداد قواعد Port Forward أو حظر التطبيقات واختبارها في Sandbox.',
      'افتح زر "ismaeil AI" العائم في أي وقت ليرى حالة راوترك النشط ويولّد كوداً مخصصاً لمنافذك.',
      'اضغط "تنفيذ مباشر على الراوتر 🚀" داخل محادثة المساعد لتطبيق الإصلاح فوراً.',
    ],
    stepsEn: [
      'Use Troubleshooter & Sandbox to validate RouterOS scripts safely before production rollout.',
      'Open "ismaeil AI" anytime—it reads your active router model, CPU, ping, and interface names.',
      'Click "Execute on Router 🚀" inside the AI chat bubble to apply generated fixes immediately.',
    ],
  },
];

const FAQS = [
  {
    qAr: 'هل يعمل النظام بدون إنترنت أو بدون أي مفتاح API خارجي؟',
    qEn: 'Does Shaban MikroCore work 100% offline without external AI API keys?',
    aAr: 'نعم، جميع المحركات الهندسية (MikroTik v6/v7، Cisco IOS، المساعد ismaeil AI، المحاكي، ومولد QR للطباعة) مدمجة محلياً وتعمل دون اتصال، بينما يتيح الربط السحابي التحكم الحي خلف CGNAT عبر Firebase RTDB.',
    aEn: 'Yes. All engineering engines (MikroTik v6/v7, Cisco IOS, ismaeil AI, Sandbox, and A4 QR generator) run 100% locally offline, while Firebase Cloud Agent adds optional live telemetry and push control behind CGNAT.',
  },
  {
    qAr: 'كيف تعمل طباعة صفحات A4 الاحترافية للبطاقات؟',
    qEn: 'How does the Pro A4 PDF Voucher Print Studio work?',
    aAr: 'بعد توليد البطاقات افتح استوديو الطباعة واختر 24 أو 32 بطاقة في الصفحة واضغط "طباعة صفحة A4 احترافية (PDF) 🖨️" لتنسيق صفحة قص قياسية بـ 4 أعمدة مع QR ورقم الدعم واسم الشبكة.',
    aEn: 'Open Print Studio after generating a voucher batch, pick 24 or 32 cards per A4 sheet, and click "Print Pro A4 Page (PDF) 🖨️" for a 4-column cut-ready grid with QR codes, support phone, and network title.',
  },
  {
    qAr: 'كيف يتم عزل بيانات كل مشترك عن المشتركين الآخرين؟',
    qEn: 'How is Multi-Tenant data isolation enforced?',
    aAr: 'كل حساب يمتلك Tenant UUID فريد يعزل الراوترات، البطاقات، الموزعين، المشتركين المنزليين، والفواتير داخل نطاق تخزين مستقل تماماً مع تشفير كلمات المرور بـ SHA-256.',
    aEn: 'Every customer receives a unique Tenant UUID isolating routers, vouchers, resellers, PPPoE subscribers, and backups in separate namespaces with SHA-256 hashed credentials.',
  },
];

export const UserGuideModule: React.FC<UserGuideModuleProps> = ({ lang, onNavigateModule }) => {
  const [query, setQuery] = useState('');

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GUIDE_CARDS;
    return GUIDE_CARDS.filter(
      (c) =>
        c.titleAr.toLowerCase().includes(q) ||
        c.titleEn.toLowerCase().includes(q) ||
        c.summaryAr.toLowerCase().includes(q) ||
        c.summaryEn.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-cyan-400" />
            <span>
              {lang === 'ar'
                ? 'الدليل التعليمي التفاعلي الشامل'
                : 'Interactive Engineering User Guide'}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'ar'
              ? 'أكاديمية متكاملة لشرح كل وحدات المنصة، طرق الربط، RADIUS، Cisco IOS، والإدارة المالية.'
              : 'Bilingual interactive academy covering all 14 platform modules, linking methods, RADIUS, Cisco CLI, and WISP finance.'}
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === 'ar' ? 'ابحث في الدليل...' : 'Search user guide...'}
            className="w-full rounded-xl border border-slate-700 bg-[#050A18] ps-9 pe-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCards.map((card) => (
          <div key={card.moduleId} className="noc-glass rounded-2xl p-5 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-extrabold text-cyan-300">
                  {lang === 'ar' ? card.titleAr : card.titleEn}
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateModule(card.moduleId)}
                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/20 shrink-0 cursor-pointer"
                >
                  <span>{lang === 'ar' ? 'فتح القسم' : 'Open'}</span>
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {lang === 'ar' ? card.summaryAr : card.summaryEn}
              </p>
              <ul className="space-y-1.5 text-xs text-slate-400">
                {(lang === 'ar' ? card.stepsAr : card.stepsEn).map((st) => (
                  <li key={st} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{st}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <div className="noc-glass rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-cyan-400" />
          <span>{lang === 'ar' ? 'الأسئلة الشائعة (FAQ)' : 'Frequently Asked Questions'}</span>
        </h3>
        <div className="space-y-3">
          {FAQS.map((item) => (
            <div
              key={item.qEn}
              className="rounded-xl border border-slate-800 bg-[#050A18]/75 p-4 space-y-1.5"
            >
              <p className="text-xs font-bold text-cyan-200">
                {lang === 'ar' ? item.qAr : item.qEn}
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                {lang === 'ar' ? item.aAr : item.aEn}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
