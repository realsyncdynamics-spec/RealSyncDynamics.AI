import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUp, Bot, LockKeyhole, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';
import {
  askGovernedAssistant,
  type AssistantDataClass, type AssistantPurpose, type AssistantSelection,
} from '../../features/ai-routing/governedAssistantApi';

interface Message { role: 'user' | 'assistant'; text: string; error?: boolean }
interface Props { open: boolean; onClose: () => void; prefill?: { id: number; text: string } | null; activeEmbedUrl?: string | null }

// Session-only cache, keyed by authenticated user AND tenant. No localStorage,
// sessionStorage or server-side transcript persistence is introduced in this PR.
const conversations = new Map<string, Message[]>();
function purposeForPath(path: string): AssistantPurpose {
  if (path.startsWith('/app/websites') || path.startsWith('/build')) return 'web';
  if (path.startsWith('/app/ai-systems') || path.startsWith('/app/risks')) return 'governance';
  if (path.startsWith('/app/evidence') || path.startsWith('/app/policy')) return 'compliance';
  if (path.startsWith('/app/workflow') || path.startsWith('/app/automation')) return 'automation';
  return 'general';
}
const PURPOSES: ReadonlyArray<[AssistantPurpose, string]> = [
  ['general', 'Allgemeiner Assistent'], ['web', 'Websites & Design'],
  ['governance', 'KI-Governance'], ['compliance', 'DSGVO & EU AI Act'],
  ['automation', 'Automationen planen'],
];
const DATA_CLASSES: ReadonlyArray<[AssistantDataClass, string]> = [
  ['unknown', 'Datenklasse ungeklärt'],
  ['public', 'Öffentlich'], ['internal', 'Intern / vertraulich'],
  ['personal', 'Personenbezogen'], ['special_category', 'Besonders sensibel'],
];
const ROUTES: ReadonlyArray<[AssistantSelection, string]> = [
  ['auto', 'Automatisch · Richtlinienentscheidung'],
  ['eu_precise', 'EU-lokal · Präzise'],
];

export function GovernedAssistantSidebar({ open, onClose, prefill = null, activeEmbedUrl = null }: Props) {
  const location = useLocation();
  const { activeTenantId } = useTenant();
  const { user } = useSupabaseAuth();
  const key = activeTenantId && user?.id ? `${user.id}:${activeTenantId}` : null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [renderedKey, setRenderedKey] = useState<string | null>(null);
  const currentKey = useRef<string | null>(key);
  currentKey.current = key;
  const visibleMessages = renderedKey === key ? messages : [];
  const [purpose, setPurpose] = useState<AssistantPurpose>(() => purposeForPath(location.pathname));
  const [dataClass, setDataClass] = useState<AssistantDataClass>('unknown');
  const classBlocked = dataClass === 'unknown' || dataClass === 'personal' || dataClass === 'special_category';
  const [selection, setSelection] = useState<AssistantSelection>('auto');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [modelInfo, setModelInfo] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inFlightId = useRef<string | null>(null);

  useEffect(() => {
    setMessages(key ? conversations.get(key) ?? [] : []);
    setRenderedKey(key);
    setInput('');
    setSending(false);
    inFlightId.current = null;
    setModelInfo(null);
    setTraceId(null);
  }, [key]);
  useEffect(() => setPurpose(activeEmbedUrl ? 'web' : purposeForPath(location.pathname)), [location.pathname, activeEmbedUrl]);
  useEffect(() => { if (prefill) setInput(prefill.text); }, [prefill]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  const send = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const message = input.trim();
    if (!key || !activeTenantId || !message || classBlocked || sending || inFlightId.current) return;
    const requestId = crypto.randomUUID();
    inFlightId.current = requestId;
    setSending(true);
    setModelInfo(null);
    setTraceId(null);
    setInput('');
    const userMessage: Message = { role: 'user', text: message };
    // Optimistic local UI; no outbound action happens before the server PEP.
    setMessages((prev) => [...prev, userMessage]);
    try {
      const reply = await askGovernedAssistant({ tenantId: activeTenantId, message, purpose, dataClass, selection });
      if (currentKey.current !== key) return; // switch-user/tenant guard
      const next: Message = { role: 'assistant', text: reply.output };
      setMessages((prev) => {
        const updated = [...prev, next];
        conversations.set(key, updated);
        return updated;
      });
      setModelInfo(`${reply.provider} · ${reply.profile} · EU-Ausführungspfad`);
      setTraceId(reply.trace_id);
    } catch (err) {
      if (currentKey.current !== key) return;
      setMessages((prev) => [...prev, {
        role: 'assistant',
        text: err instanceof Error ? err.message : 'Anfrage wurde aus Sicherheitsgründen abgebrochen.',
        error: true,
      }]);
    } finally {
      if (inFlightId.current === requestId) {
        inFlightId.current = null;
        if (currentKey.current === key) setSending(false);
      }
    }
  }, [activeTenantId, classBlocked, dataClass, input, key, purpose, selection, sending]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  if (!open) return (
    <div className="hidden w-8 shrink-0 items-center justify-center border-l border-titanium-800 bg-obsidian-900 lg:flex">
      <button type="button" onClick={onClose} aria-label="Assistent öffnen" className="flex flex-col items-center gap-2 py-4 text-titanium-400 hover:text-titanium-100">
        <Sparkles className="h-4 w-4" /><span className="text-[10px] [writing-mode:vertical-rl]">AI</span>
      </button>
    </div>
  );

  return (
    <>
      <button type="button" onClick={onClose} aria-label="Assistent schließen" className="fixed inset-0 z-40 bg-black/70 lg:hidden" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(100vw,400px)] flex-col overflow-hidden border-l border-titanium-800 bg-obsidian-900 lg:static lg:z-auto lg:h-full lg:w-[min(36vw,400px)] lg:shrink-0" aria-label="RealSync Browser-Assistent" data-testid="governed-assistant">
        <header className="flex shrink-0 items-center justify-between border-b border-titanium-800 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-titanium-100">
            <Sparkles className="h-4 w-4 text-[var(--color-rs-primary)]" /> RealSync Assistent
          </span>
          <button type="button" onClick={onClose} aria-label="Assistent schließen" className="rounded-lg p-2 text-titanium-400 hover:bg-obsidian-800"><X className="h-4 w-4" /></button>
        </header>
        <section className="shrink-0 space-y-3 border-b border-titanium-800 px-4 py-4" aria-label="KI-Richtlinien und Auswahl">
          <div className="flex items-start gap-2 rounded-lg border border-titanium-700 bg-obsidian-800 p-3 text-xs leading-5 text-titanium-300">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-rs-primary)]" />
            <div><strong>Governed AI</strong> — der Server prüft Mandant, Zweck und Ausführungsort. Nur ein ausdrücklich verifizierter EU-lokaler Pfad ist zulässig. Andernfalls wird blockiert. Keine automatischen Tool-Aktionen.</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-titanium-300">Fachassistent
              <select aria-label="Fachassistent" value={purpose} onChange={(e) => setPurpose(e.target.value as AssistantPurpose)} className="mt-1 w-full rounded-md border border-titanium-700 bg-obsidian-950 px-2 py-2 text-xs text-titanium-100">
                {PURPOSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-xs text-titanium-300">Datenklasse
              <select aria-label="Datenklasse" value={dataClass} onChange={(e) => setDataClass(e.target.value as AssistantDataClass)} className="mt-1 w-full rounded-md border border-titanium-700 bg-obsidian-950 px-2 py-2 text-xs text-titanium-100">
                {DATA_CLASSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-xs text-titanium-300">KI-Auswahl
            <select aria-label="KI-Auswahl" value={selection} onChange={(e) => setSelection(e.target.value as AssistantSelection)} className="mt-1 w-full rounded-md border border-titanium-700 bg-obsidian-950 px-2 py-2 text-xs text-titanium-100">
              {ROUTES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <p className="truncate text-[11px] text-titanium-500" title={activeEmbedUrl ?? location.pathname}>Kontext: {activeEmbedUrl ? 'Eingebettete Website' : location.pathname}</p>
          <p className="text-[11px] leading-4 text-titanium-500">Die angegebene Datenklasse ist ein Hinweis, keine Freigabe. Eine automatisierte vollständige Datenklassifizierung ist noch nicht aktiviert. Cloud-Modelle sind hier gesperrt.</p>
        </section>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-label="Konversation">
          {visibleMessages.length === 0 && <div className="py-10 text-center">
            <Bot className="mx-auto h-9 w-9 text-titanium-500" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-titanium-200">Was kann ich für dich erledigen?</p>
            <p className="mt-2 text-xs text-titanium-500">Fragen und Entwürfe – keine ungeprüften Datenübertragungen oder Aktionen.</p>
          </div>}
          {visibleMessages.map((item, i) => (
            <div key={i} className={`rounded-xl px-3 py-2 text-sm leading-6 whitespace-pre-wrap break-words ${item.role === 'user' ? 'ml-6 bg-obsidian-800 text-titanium-100' : item.error ? 'mr-6 border border-rose-700/50 bg-rose-950/20 text-rose-200' : 'mr-6 text-titanium-200'}`} role={item.error ? 'alert' : undefined}>
              {item.text}
            </div>
          ))}
          {sending && <p className="text-xs text-titanium-400" role="status">Richtlinienprüfung und KI-Verarbeitung laufen …</p>}
          <div ref={endRef} />
        </div>
        <footer className="shrink-0 border-t border-titanium-800 bg-obsidian-950 p-4">
          {modelInfo && <p className="mb-2 text-[11px] text-titanium-400"><ShieldCheck className="mr-1 inline h-3 w-3" />{modelInfo}</p>}
          {traceId && <p className="mb-2 truncate font-mono text-[10px] text-titanium-500" title={traceId}>Prüfreferenz: {traceId}</p>}
          <form onSubmit={(event) => void send(event)} className="rounded-xl border border-titanium-700 bg-obsidian-900 p-2 focus-within:border-[var(--color-rs-primary)]">
            <label htmlFor="governed-assistant-input" className="sr-only">Anfrage</label>
            <textarea id="governed-assistant-input" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
              rows={2} maxLength={8000} placeholder="Frage, Aufgabe oder Entwurf …"
              className="min-h-12 w-full resize-y bg-transparent p-2 text-sm text-titanium-100 outline-none placeholder:text-titanium-500" />
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-[10px] text-titanium-500">Zuerst prüfen, dann senden</span>
              <button type="submit" disabled={!key || classBlocked || !input.trim() || sending} aria-label="Sicher anfragen"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-rs-primary)] text-[var(--rs-on-primary)] disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button>
            </div>
          </form>
          {classBlocked && <p role="status" className="mt-2 text-xs text-amber-200">
            {dataClass === 'unknown' ? 'Vor dem Versand die Datenklasse festlegen.' : 'Für personenbezogene Daten fehlt noch die geprüfte Rechtsgrundlage und Freigabe. Keine KI-Verarbeitung.'}
          </p>}
          {!key && <p role="status" className="mt-2 text-xs text-amber-200">Bitte zuerst einen gültigen Workspace auswählen.</p>}
        </footer>
      </aside>
    </>
  );
}
