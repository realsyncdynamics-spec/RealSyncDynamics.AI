import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUp, Bot, Check, ChevronDown, Clock3, ExternalLink, FileText,
  Globe2, History, Menu, Plus, Search, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import { AiGatewayEdgeClient } from '../../../core/ai-gateway/edgeClient';
import { getSupabaseAnonKey, getSupabaseUrl } from '../../../lib/supabaseUrl';
import { useTenant } from '../../../core/access/TenantProvider';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const STARTERS = [
  'Prüfe meine Website auf SEO- und DSGVO-Probleme.',
  'Welche EU AI Act Pflichten betreffen mein KI-System?',
  'Optimiere meine Landingpage für SEO und Conversion.',
  'Führe einen vollständigen Website-Audit durch.',
];

const NAV = [
  { label: 'Übersicht', href: '/app', icon: Sparkles },
  { label: 'Websites', href: '/app/websites', icon: Globe2 },
  { label: 'Risiken', href: '/app/risks', icon: ShieldCheck },
  { label: 'Monitoring', href: '/app/monitoring', icon: Clock3 },
  { label: 'Agenten', href: '/app/agents', icon: Bot },
  { label: 'Dokumente', href: '/app/documents', icon: FileText },
];

export function GovernanceAiWorkspace() {
  const { activeTenantId, tenants } = useTenant();
  const tenantName = tenants.find((t) => t.tenantId === activeTenantId)?.name ?? 'Workspace';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [context, setContext] = useState('Keine Domain ausgewählt');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  const send = async (preset?: string) => {
    const message = (preset ?? input).trim();
    if (!message || sending) return;

    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', content: message }]);

    try {
      const client = new AiGatewayEdgeClient({
        supabaseUrl: getSupabaseUrl(),
        apiKey: getSupabaseAnonKey(),
      });
      const history = [...messages, { role: 'user' as const, content: message }]
        .slice(-12)
        .map((m) => `${m.role === 'user' ? 'Nutzer' : 'Governance AI'}: ${m.content}`)
        .join('\n\n');

      const response = await client.generate({
        feature: 'governance_ai_workspace',
        task_type: 'chat',
        model_profile: 'fast-local',
        input: history,
        system_prompt: `Du bist Governance AI von RealSyncDynamics.AI. Du bist ein agentischer Arbeitsassistent für SEO, Website-Optimierung, DSGVO und EU AI Act. Antworte auf Deutsch. Unterscheide klar zwischen Analyse, Empfehlung und tatsächlicher Ausführung. Wenn eine Aktion technisch innerhalb der Plattform ausführbar ist, beschreibe den nächsten ausführbaren Schritt. Behaupte niemals, etwas ausgeführt zu haben, wenn kein Tool-Aufruf erfolgt ist. Bei Rechtsfragen: informativ bleiben, keine individuelle Rechtsberatung. Bei SEO: konkret mit technischen, Onpage-, Content-, Schema-, Performance- und Conversion-Maßnahmen arbeiten.`,
        max_tokens: 1200,
        temperature: 0.25,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: response.output.trim() || 'Keine Antwort generiert.' }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Die Anfrage konnte gerade nicht verarbeitet werden. ${error instanceof Error ? error.message : 'Bitte versuche es erneut.'}`,
        },
      ]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div className="min-h-[calc(100vh-1px)] bg-[#f7f8fa] text-slate-900 flex overflow-hidden">
      <aside className={`fixed inset-y-0 left-0 z-40 w-[258px] border-r border-slate-200 bg-white/95 backdrop-blur-xl transition-transform lg:static lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
            <Link to="/app" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-sm"><Sparkles className="h-4 w-4" /></div>
              <div><div className="font-semibold tracking-tight text-sm">RealSyncDynamics<span className="text-amber-700">AI</span></div><div className="text-[10px] text-slate-400">Governance Dashboard</div></div>
            </Link>
            <button onClick={() => setMobileNav(false)} className="lg:hidden p-2 text-slate-500" aria-label="Menü schließen"><X className="h-4 w-4" /></button>
          </div>

          <div className="p-3">
            <button onClick={() => { setMessages([]); setContext('Keine Domain ausgewählt'); }} className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"><Plus className="h-4 w-4" /> Neuer Chat</button>
          </div>

          <nav className="px-2 space-y-0.5">
            {NAV.map(({ label, href, icon: Icon }) => (
              <Link key={href} to={href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${href === '/app' ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><Icon className="h-4 w-4" />{label}</Link>
            ))}
          </nav>

          <div className="mt-5 px-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400"><History className="h-3.5 w-3.5" /> Letzte Chats</div>
            <div className="mt-2 space-y-1">{messages.length > 0 ? <button onClick={() => textareaRef.current?.focus()} className="w-full text-left truncate rounded-lg px-2 py-2 text-xs text-slate-600 hover:bg-slate-50">Aktuelle Governance-Prüfung</button> : <div className="px-2 py-2 text-xs text-slate-400">Noch keine Unterhaltungen</div>}</div>
          </div>

          <div className="mt-auto p-3 border-t border-slate-100">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><div className="text-xs font-medium text-slate-800 truncate">{tenantName}</div><div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Workspace aktiv</div></div>
          </div>
        </div>
      </aside>

      {mobileNav && <button className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Menü schließen" />}

      <main className="min-w-0 flex-1 flex flex-col h-screen">
        <header className="h-14 shrink-0 border-b border-slate-200/80 bg-white/75 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 min-w-0"><button onClick={() => setMobileNav(true)} className="lg:hidden p-2 -ml-2 text-slate-600" aria-label="Menü öffnen"><Menu className="h-5 w-5" /></button><span className="text-sm font-medium text-slate-800 truncate">Governance Dashboard</span><span className="text-slate-300">/</span><span className="text-sm text-slate-500 truncate">{tenantName}</span></div>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> EU · DSGVO · AI Act</div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-8 py-10 sm:py-14">
            {messages.length === 0 ? (
              <div className="min-h-[calc(100vh-260px)] flex flex-col items-center justify-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-6"><Sparkles className="h-6 w-6 text-amber-700" /></div>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-950">Was möchtest du heute erledigen?</h1>
                <p className="mt-3 max-w-xl text-sm sm:text-base text-slate-500">Governance Dashboard by RealSyncDynamics.AI — Übersicht und Funktion. Der Assistent führt den nächsten Schritt.</p>
                <div className="mt-8 grid w-full max-w-2xl grid-cols-1 sm:grid-cols-2 gap-2 text-left">{STARTERS.map((starter) => <button key={starter} onClick={() => void send(starter)} className="group rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 hover:border-amber-300 hover:shadow-sm transition-all"><span>{starter}</span><ArrowUp className="mt-3 h-4 w-4 rotate-45 text-slate-300 group-hover:text-amber-700" /></button>)}</div>
              </div>
            ) : (
              <div className="space-y-8 pb-10">
                {messages.map((message, index) => <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'flex justify-end' : 'flex gap-3'}>{message.role === 'assistant' && <div className="mt-1 h-7 w-7 shrink-0 rounded-lg bg-slate-950 text-white flex items-center justify-center"><Sparkles className="h-3.5 w-3.5" /></div>}<div className={message.role === 'user' ? 'max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-4 py-3 text-sm leading-6 text-white' : 'max-w-[85%] text-sm leading-7 text-slate-800 whitespace-pre-wrap'}>{message.content}</div></div>)}
                {sending && <div className="flex gap-3"><div className="mt-1 h-7 w-7 rounded-lg bg-slate-950 text-white flex items-center justify-center"><Sparkles className="h-3.5 w-3.5" /></div><div className="flex items-center gap-1 py-2"><span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" /><span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:120ms]" /><span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:240ms]" /></div></div>}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-3 sm:px-6 pb-4 sm:pb-6 bg-gradient-to-t from-[#f7f8fa] via-[#f7f8fa]/95 to-transparent pt-2">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-2xl border border-slate-300 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.08)] focus-within:border-slate-400 focus-within:shadow-[0_12px_40px_rgba(15,23,42,0.12)] transition-all">
              <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} rows={1} placeholder="Frag Governance AI etwas über SEO, deine Website, DSGVO oder den EU AI Act …" className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 max-h-32" />
              <div className="flex items-center justify-between px-3 pb-3"><div className="flex items-center gap-2 text-[10px] text-slate-400"><button className="rounded-lg p-1.5 hover:bg-slate-100" title="Datei hinzufügen"><Plus className="h-4 w-4" /></button><span className="hidden sm:inline">Enter senden · Shift+Enter neue Zeile</span></div><button onClick={() => void send()} disabled={!canSend} className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${canSend ? 'bg-slate-950 text-white hover:bg-slate-800' : 'bg-slate-100 text-slate-300'}`} aria-label="Senden"><ArrowUp className="h-4 w-4" /></button></div>
            </div>
            <div className="mt-2 text-center text-[10px] text-slate-400">Governance AI kann Fehler machen. Prüfe kritische rechtliche Entscheidungen und veröffentlichte Änderungen.</div>
          </div>
        </div>
      </main>

      <aside className="hidden xl:flex w-[290px] shrink-0 border-l border-slate-200 bg-white/65 backdrop-blur-xl flex-col">
        <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between"><span className="text-xs font-semibold text-slate-800">Arbeitskontext</span><Search className="h-4 w-4 text-slate-400" /></div>
        <div className="p-4 space-y-4">
          <button onClick={() => setContext(context === 'Keine Domain ausgewählt' ? 'Website-Scan als nächster Kontext laden' : 'Keine Domain ausgewählt')} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-slate-300 transition-colors"><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-slate-400">Website</span><ChevronDown className="h-3.5 w-3.5 text-slate-400" /></div><div className="mt-1 text-sm font-medium text-slate-800 truncate">{context}</div></button>
          <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[10px] uppercase tracking-wider text-slate-400">Was AI ausführen kann</div><ul className="mt-2 space-y-2 text-xs text-slate-600">{['Website analysieren', 'SEO-Fixes vorbereiten', 'DSGVO-/AI-Act-Findings erklären', 'Workflows starten'].map((item) => <li key={item} className="flex gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />{item}</li>)}</ul></div>
          <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-3"><div className="flex items-center gap-2 text-xs font-medium text-cyan-900"><ShieldCheck className="h-4 w-4" /> Nachvollziehbar</div><p className="mt-1.5 text-[11px] leading-5 text-cyan-800/80">Analyse, Empfehlung und Ausführung werden im Workspace getrennt dargestellt. Spätere Tool-Aktionen können hier als Evidence erscheinen.</p></div>
          <Link to="/app/websites" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><span>Website-Bereich öffnen</span><ExternalLink className="h-3.5 w-3.5" /></Link>
        </div>
      </aside>
    </div>
  );
}
