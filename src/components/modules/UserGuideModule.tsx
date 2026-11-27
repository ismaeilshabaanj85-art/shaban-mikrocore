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
    titleAr: '1. الربط والاتصال بالراوتر',
    titleEn: '1. Server & Router Connection',
    summaryAr: 'ربط راوترات MikroTik محلياً أو عبر IP عام أو Cloud DDNS مع حارس 60 ثانية.',
    summaryEn: 'Connect MikroTik routers via Local LAN IP, Public Static IP, or Cloud DDNS with 60s rollback safety.',
    stepsAr: [
      'فعّل خدمة www-ssl أو api-ssl على الراوتر (المنفذ 443 لـ RouterOS v7).',
      'أضف ملف الراوتر واختر وضع Live Router للاتصال الفعلي أو Sandbox للتجربة.',
      'تأكد من اختبار الاتصال قبل اعتماد الإعدادات في الإنتاج.',
    ],
    stepsEn: [
      'Enable www-ssl on RouterOS v7 (port 443) or use New Terminal for v6.',
      'Add router profile and switch between Sandbox Simulator or Live Router mode.',
      'Verify handshake before applying changes to production routers.',
    ],
  },
  {
    moduleId: 'wizard',
    titleAr: '2. معالج التأسيس من الصفر Zero-Touch',
    titleEn: '2. Zero-Touch Network Setup Wizard',
    summaryAr: 'تجهيز راوتر جديد بالكامل (WAN/LAN/Hotspot/PPPoE/DoH/API) بضغطة واحدة.',
    summaryEn: 'Bootstrap a fresh MikroTik router from scratch with WAN, Bridge LAN, Hotspot/PPPoE, and DoH DNS.',
    stepsAr: [
      'اختر إصدار RouterOS (v6 أو v7) واسم الشبكة ونوع خط الإنترنت.',
      'حدد منافذ الجسر المحلي LAN ونطاق DHCP ومزود DNS المشفر.',
      'انسخ السكربت المولد أو أرسله عبر REST API واحفظ نسخة في الخزنة.',
    ],
    stepsEn: [
      'Select RouterOS v6 or v7, identity, and primary/secondary WAN interfaces.',
      'Choose LAN bridge ports, DHCP pool, and encrypted DoH DNS provider.',
      'Copy script or push via REST API and archive snapshot in Backup Vault.',
    ],
  },
  {
    moduleId: 'radius',
    titleAr: '3. إدارة البطاقات والسرعات (1M–100M)',
    titleEn: '3. RADIUS, Profiles & Voucher Print Studio',
    summaryAr: 'توليد بطاقات باقات 1M إلى 100M مع فصل تلقائي بالثانية وطباعة QR احترافية.',
    summaryEn: 'Generate 1M–100M Hotspot/PPPoE vouchers with second-accurate auto-expiry and QR print templates.',
    stepsAr: [
      'اختر الباقة أو أنشئ باقة مخصصة وعدد البطاقات المطلوبة.',
      'أضف سكربت الفصل بالثانية على الراوتر لضمان انتهاء الصلاحية بدقة.',
      'اطبع البطاقات بـ 4 قوالب فاخرة أو صدّرها CSV.',
    ],
    stepsEn: [
      'Pick a preset or custom speed profile and choose batch quantity.',
      'Deploy the on-login auto-expiry scheduler to MikroTik.',
      'Print cards with 4 luxury templates + offline QR codes or export CSV.',
    ],
  },
  {
    moduleId: 'pcc_security',
    titleAr: '4. دمج الخطوط PCC + ستارلينك + الحماية',
    titleEn: '4. PCC Load Balancing, Starlink Gaming & Shield',
    summaryAr: 'دمج 2 إلى 4 خطوط، تقليل بنغ PUBG/FreeFire عبر CAKE، ومنع Netcut ومشاركة الهوتسبوت.',
    summaryEn: 'Combine 2–4 WANs via PCC, prioritize Starlink gaming with CAKE/PCQ, and stop Netcut/TTL sharing.',
    stepsAr: [
      'أضف خطوط WAN وحدد أوزان الدمج وفحص Failover.',
      'فعّل Clamp MSS و CAKE QoS لتثبيت بنغ الألعاب والمكالمات.',
      'فعّل درع ARP ومنع Netcut وإغلاق المنافذ غير الآمنة.',
    ],
    stepsEn: [
      'Add WAN links, weights, and Netwatch/Check-Gateway failover.',
      'Enable MSS Clamp and CAKE QoS for Starlink gaming latency stability.',
      'Apply Anti-Netcut ARP protection and TTL anti-sharing firewall.',
    ],
  },
  {
    moduleId: 'troubleshooter',
    titleAr: '5. التعديلات والنيو تيرمينال الذكي + المحاكي',
    titleEn: '5. Troubleshooter, New Terminal & Pro Sandbox',
    summaryAr: 'تشخيص تفاعلي بالأسئلة الإلزامية قبل توليد الكود مع اختبار مباشر في محاكي RB4011 و Cisco.',
    summaryEn: 'Interactive Q&A troubleshooting before code generation plus live testing in RB4011 & Cisco Catalyst Sandbox.',
    stepsAr: [
      'اختر السيناريو المطلوب (حظر تطبيقات، Port Forward، تقليل CPU، إصلاح ستارلينك).',
      'أجب عن الأسئلة التفاعلية ليتم توليد أوامر نظيفة ومطابقة لإصدارك.',
      'اضغط "اختبار في المحاكي" للتحقق من الصياغة قبل التطبيق على الراوتر الحقيقي.',
    ],
    stepsEn: [
      'Select a scenario (app blocking, Port Forwarding, CPU audit, Starlink MTU).',
      'Answer mandatory clarifying questions for syntax-accurate output.',
      'Click "Test in Sandbox" to validate commands before promoting to live router.',
    ],
  },
  {
    moduleId: 'finance',
    titleAr: '6. النظام المالي والموزعين ومتعدد العملات',
    titleEn: '6. Multi-Currency Finance & Reseller POS',
    summaryAr: 'إدارة الموزعين مع إيقاف آلي عند تجاوز حد الدين، وتحويل لحظي بين USD و SYP و TRY.',
    summaryEn: 'Manage resellers with automatic credit-limit blocking and instant USD / SYP / TRY conversion.',
    stepsAr: [
      'أضف الموزع وحدد سقف الدين الأقصى بالدولار ونسبة العمولة.',
      'راقب سجل المبيعات والمصاريف وصافي الأرباح بالعملات الثلاث.',
      'اطبع كشف حساب PDF أو صدّر السجلات إلى Excel CSV بضغطة واحدة.',
    ],
    stepsEn: [
      'Create resellers with commission % and hard max debt thresholds.',
      'Track voucher income and tower/Starlink expenses across USD, SYP, and TRY.',
      'Print reseller statements or export accounting ledgers as CSV.',
    ],
  },
];

const FAQS = [
  {
    qAr: 'هل يعمل النظام بدون إنترنت أو بدون أي مفتاح API خارجي؟',
    qEn: 'Does Shaban MikroCore work 100% offline without external AI API keys?',
    aAr: 'نعم، جميع المحركات الهندسية (MikroTik v6/v7، Cisco IOS، المساعد ismaeil AI، المحاكي، ومولد QR) مدمجة محلياً وتعمل دون اتصال.',
    aEn: 'Yes. All engineering engines (MikroTik v6/v7, Cisco IOS, ismaeil AI, Sandbox, and QR generator) run 100% locally offline.',
  },
  {
    qAr: 'ما الفرق بين وضع Sandbox ووضع Live Router؟',
    qEn: 'What is the difference between Sandbox Mode and Live Router Mode?',
    aAr: 'وضع Sandbox يختبر الأوامر بأمان على راوتر وسويتش افتراضيين، بينما وضع Live Router يرسل الأوامر عبر REST API لراوتر MikroTik v7 مع حارس استعادة تلقائية 60 ثانية.',
    aEn: 'Sandbox executes safely on virtual RB4011/Catalyst devices; Live Router pushes commands over HTTPS REST API to RouterOS v7 with a 60-second Auto-Rollback safety timer.',
  },
  {
    qAr: 'كيف يتم عزل بيانات كل مشترك عن المشتركين الآخرين؟',
    qEn: 'How is Multi-Tenant data isolation enforced?',
    aAr: 'كل حساب يمتلك Tenant UUID فريد يعزل الراوترات، البطاقات، الموزعين، والفواتير داخل نطاق تخزين مستقل تماماً مع تشفير كلمات المرور بـ SHA-256.',
    aEn: 'Every customer receives a unique Tenant UUID isolating routers, vouchers, resellers, and backups in separate namespaces with SHA-256 hashed credentials.',
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
