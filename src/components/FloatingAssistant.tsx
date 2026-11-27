import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bot, Send, Sparkles, X } from 'lucide-react';
import { Language, ModuleId } from '../types/mikrocore';
import { queryIsmaeilAi } from '../engine/assistantEngine';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  suggestedModule?: ModuleId;
  suggestedLabel?: string;
}

interface FloatingAssistantProps {
  lang: Language;
  onNavigateModule: (id: ModuleId) => void;
}

export const FloatingAssistant: React.FC<FloatingAssistantProps> = ({
  lang,
  onNavigateModule,
}) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'ai',
      text:
        lang === 'ar'
          ? 'مرحباً! أنا مساعد ismaeil AI الهندسي. اختر سؤالاً سريعاً بالأسفل أو اكتب سؤالك حول مايكروتك، ستارلينك، حظر الإباحية، سيسكو، أو النظام المالي.'
          : 'Hello! I am ismaeil AI. Pick a quick starter question below or ask anything about MikroTik, Starlink, Safe Family filtering, Cisco IOS, or WISP finance.',
    },
  ]);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const quickPrompts =
    lang === 'ar'
      ? [
          'كيف أربط مايكروتك وستارلينك؟',
          'برمجة الراوتر من الصفر',
          'حظر المواقع الإباحية',
          'حل بطء الألعاب والبينغ',
          'دمج خطوط PCC',
          'بطاقات Hotspot و PPPoE',
          'أوامر سيسكو VLAN و OSPF',
          'ديون الموزعين والعملات',
        ]
      : [
          'How to link MikroTik & Starlink?',
          'Zero-Touch router setup',
          'Safe Family anti-porn shield',
          'Fix gaming lag & Starlink ping',
          'Multi-WAN PCC load balancing',
          'Hotspot & PPPoE vouchers',
          'Cisco VLAN, OSPF & NAT',
          'Reseller debt & USD/SYP/TRY',
        ];

  const sendQuestion = (textRaw: string) => {
    const text = textRaw.trim();
    if (!text) return;
    const reply = queryIsmaeilAi(text, lang);
    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, sender: 'user', text },
      {
        id: `a_${Date.now() + 1}`,
        sender: 'ai',
        text: reply.text,
        suggestedModule: reply.suggestedModule,
        suggestedLabel: reply.suggestedLabel,
      },
    ]);
    setInput('');
  };

  return (
    <>
      {/* Illuminated Floating Button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="ismaeil AI"
        className="no-print fixed bottom-20 md:bottom-6 end-4 sm:end-6 z-40 flex items-center gap-2 rounded-2xl border border-cyan-300/60 bg-gradient-to-r from-[#0B1936] via-[#0E2247] to-[#081F2C] px-4 py-3 text-xs font-extrabold text-cyan-100 shadow-[0_0_28px_rgba(0,229,255,0.38)] transition hover:scale-105 cursor-pointer"
      >
        <Sparkles className="h-4 w-4 text-cyan-300" />
        <span dir="ltr">ismaeil AI</span>
      </button>

      {/* Interactive Chat Panel */}
      {open && (
        <div className="no-print fixed bottom-36 md:bottom-22 end-4 sm:end-6 z-50 flex h-[510px] w-[calc(100vw-2rem)] max-w-md flex-col rounded-3xl noc-glass shadow-[0_16px_64px_rgba(0,0,0,0.8)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-cyan-500/25 bg-[#071127]/95 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/15">
                <Bot className="h-4 w-4 text-cyan-300" />
              </span>
              <div>
                <p className="text-xs font-extrabold text-white" dir="ltr">
                  ismaeil AI
                </p>
                <p className="text-[10px] text-emerald-300">
                  {lang === 'ar'
                    ? 'المحرك الهندسي الذكي (Offline)'
                    : 'Offline Engineering Intelligence'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              aria-label="Close ismaeil AI"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3.5 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 leading-relaxed whitespace-pre-line ${
                    m.sender === 'user'
                      ? 'bg-cyan-400 text-slate-950 font-semibold'
                      : 'border border-cyan-500/20 bg-[#050A18]/90 text-slate-200'
                  }`}
                >
                  <p>{m.text}</p>
                  {m.suggestedModule && m.suggestedLabel && (
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateModule(m.suggestedModule!);
                        setOpen(false);
                      }}
                      className="mt-2.5 inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer"
                    >
                      <span>{m.suggestedLabel}</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Quick Starter Prompts */}
          <div className="border-t border-slate-800/80 bg-[#060D20]/90 px-3 py-2 space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400">
              {lang === 'ar' ? 'أسئلة سريعة مقترحة:' : 'Quick Starter Prompts:'}
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {quickPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => sendQuestion(p)}
                  className="rounded-lg border border-cyan-500/25 bg-[#050A18]/90 px-2.5 py-1 text-[10px] font-semibold text-cyan-200 hover:border-cyan-400 hover:bg-cyan-500/15 cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="flex items-center gap-2 border-t border-cyan-500/20 bg-[#050A18]/95 p-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                lang === 'ar' ? 'اكتب سؤالك الهندسي بالتفصيل...' : 'Ask any engineering question...'
              }
              className="flex-1 rounded-xl border border-slate-700 bg-[#0B142B] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              aria-label="Send"
              className="rounded-xl bg-cyan-400 p-2 text-slate-950 hover:bg-cyan-300 cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
