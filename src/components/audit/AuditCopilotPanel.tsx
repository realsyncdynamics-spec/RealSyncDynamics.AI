import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Loader2, X, RotateCcw, Send, AlertTriangle, ShieldCheck } from 'lucide-react';
import { sendChatAnon, type SimpleMsg } from '../../features/governance/AgentWidget/agentApi';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface Issue {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  paragraph_ref?: string;
}

interface AuditCopilotPanelProps {
  issue: Issue;
  domain: string;
  open: boolean;
  onClose: () => void;
}

type Phase = 'idle' | 'loading' | 'ready' | 'error' | 'rate_limited' | 'us_routing';

interface Bubble {
  id: string;
  role: 'user' | 'assistant' | 'system-context';
  content: string;
  isLoading?: boolean;
  isError?: boolean;
}

const SEV_LABEL: Record<Severity, string> = {
  critical: 'KRITISCH',
  high: 'HOCH',
  medium: 'MITTEL',
  low: 'NIEDRIG',
  info: 'INFO',
};

function buildInitialPrompt(issue: Issue, domain: string): string {
  const ref = issue.paragraph_ref ? `\nRechtsgrundlage: ${issue.paragraph_ref}` : '';
  return [
    `Erklär mir bitte diesen Befund aus dem DSGVO-Audit von ${domain}:`,
    '',
    `Severity: ${SEV_LABEL[issue.severity]}`,
    `Titel: ${issue.title}`,
    `Detail: ${issue.detail}${ref}`,
    '',
    'Ich brauche:',
    '1. Was das technisch bedeutet',
    '2. Welches konkrete Risiko (Bußgeld, Abmahnung, etc.) daraus folgt',
    '3. Wie man das praktisch behebt (Code-Snippet wenn möglich, sonst Schritte für gängige CMS wie WordPress/Shopify/Webflow)',
    '',
    'Bitte direkt und ohne Marketing-Sprech.',
  ].join('\n');
}

export function AuditCopilotPanel({ issue, domain, open, onClose }: AuditCopilotPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [history, setHistory] = useState<SimpleMsg[]>([]);
  const [input, setInput] = useState('');
  const [usRoutingAck, setUsRoutingAck] = useState(false);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendInProgress = useRef(false);

  const send = useCallback(
    async (text: string, isAuto = false) => {
      if (sendInProgress.current) return;
      const message = text.trim();
      if (!message) return;
      sendInProgress.current = true;

      setPhase('loading');
      setBubbles((prev) => {
        // Auto-prompt: hide as a user bubble (it's a long structured prompt);
        // show a friendly framing bubble instead.
        if (isAuto) {
          return [
            ...prev,
            {
              id: 'auto-frame',
              role: 'system-context',
              content: `Befund „${issue.title}" wird analysiert …`,
            },
            { id: 'loading', role: 'assistant', content: '', isLoading: true },
          ];
        }
        return [
          ...prev,
          { id: crypto.randomUUID(), role: 'user', content: message },
          { id: 'loading', role: 'assistant', content: '', isLoading: true },
        ];
      });

      const result = await sendChatAnon({
        session_id: sessionIdRef.current,
        message,
        history,
        acknowledge_us_routing: usRoutingAck || undefined,
      });

      sendInProgress.current = false;

      if (result.kind === 'us_routing_required') {
        setPhase('us_routing');
        setBubbles((prev) => prev.filter((b) => b.id !== 'loading' && b.id !== 'auto-frame'));
        return;
      }
      if (result.kind === 'rate_limited') {
        setPhase('rate_limited');
        setBubbles((prev) => prev.filter((b) => b.id !== 'loading'));
        return;
      }
      if (result.kind === 'ok') {
        setHistory(result.data.history);
        setBubbles((prev) =>
          prev.filter((b) => b.id !== 'loading').concat({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: result.data.response || '(Keine Antwort generiert.)',
          }),
        );
        setPhase('ready');
        return;
      }

      // error / llm_not_configured
      const errMsg =
        result.kind === 'llm_not_configured'
          ? 'Der Assistent ist gerade nicht konfiguriert. Bitte später erneut versuchen.'
          : `Fehler: ${result.error.message}`;
      setBubbles((prev) =>
        prev.filter((b) => b.id !== 'loading').concat({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: errMsg,
          isError: true,
        }),
      );
      setPhase('error');
    },
    [history, issue.title, usRoutingAck],
  );

  // Kick off the auto-explanation when the panel first opens.
  useEffect(() => {
    if (!open) return;
    if (phase !== 'idle') return;
    send(buildInitialPrompt(issue, domain), true);
  }, [open, phase, issue, domain, send]);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Auto-scroll to bottom on new bubbles.
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
  }, [bubbles]);

  // Reset when the issue changes (parent reuses one panel for many findings).
  useEffect(() => {
    if (!open) {
      setPhase('idle');
      setBubbles([]);
      setHistory([]);
      setInput('');
      sessionIdRef.current = crypto.randomUUID();
    }
  }, [open]);

  function onUserSend() {
    const trimmed = input.trim();
    if (!trimmed || phase === 'loading') return;
    setInput('');
    send(trimmed, false);
  }

  function ackUsRouting() {
    setUsRoutingAck(true);
    setPhase('idle');
    setBubbles([]);
    setHistory([]);
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-obsidian-950/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-label={`Befund erklären: ${issue.title}`}
        className="fixed z-50 inset-x-2 bottom-2 top-16 sm:inset-auto sm:right-4 sm:bottom-4 sm:top-auto sm:w-[440px] sm:h-[640px] flex flex-col bg-obsidian-950 border border-titanium-800 shadow-2xl rounded-none overflow-hidden"
      >
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-titanium-900 bg-obsidian-900">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="inline-flex w-7 h-7 mt-0.5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-obsidian-950">
              <AudioLines className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-semibold text-titanium-50 truncate">Befund-Erklärung</div>
              <div className="text-[10px] text-titanium-400 mt-0.5 truncate">
                {SEV_LABEL[issue.severity]} · {issue.title}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="text-titanium-400 hover:text-titanium-100 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {phase === 'us_routing' && (
          <div className="border-b border-amber-400/30 bg-amber-400/10 p-3 text-[12px] text-amber-200">
            <p className="font-semibold">Hinweis zur LLM-Routing-Geografie</p>
            <p className="mt-1 text-amber-100/80">
              Anthropic-direkt routet aktuell durch die USA. Bestätige einmalig, um die Erklärung zu starten.
            </p>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={ackUsRouting}
                className="rounded-none bg-amber-400 px-3 py-1 text-[12px] font-medium text-black transition-colors hover:bg-amber-300"
              >
                Verstanden, fortfahren
              </button>
            </div>
          </div>
        )}

        {phase === 'rate_limited' && (
          <div className="border-b border-orange-400/30 bg-orange-400/10 px-4 py-2 text-[12px] text-orange-200">
            Anfrage-Limit erreicht (5/min). Bitte in einer Minute erneut.
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {bubbles.length === 0 && phase === 'idle' && (
            <div className="flex items-center justify-center h-full text-xs text-titanium-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Wird vorbereitet …
            </div>
          )}
          {bubbles.map((b) => (
            <BubbleView key={b.id} bubble={b} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-titanium-900 p-3 space-y-2">
          <div className="flex items-end gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onUserSend(); }}
              placeholder={phase === 'loading' ? 'Antwort wird generiert …' : 'Folgefrage stellen …'}
              disabled={phase === 'loading' || phase === 'us_routing'}
              className="flex-1 bg-obsidian-900 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-titanium-100 disabled:opacity-50 placeholder:text-titanium-600"
            />
            <button
              type="button"
              onClick={onUserSend}
              disabled={phase === 'loading' || !input.trim()}
              aria-label="Senden"
              className="flex h-9 w-9 items-center justify-center bg-titanium-50 text-obsidian-950 hover:bg-titanium-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {phase === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[10px] text-titanium-500 leading-relaxed">
            KI-Assistent · keine Rechtsberatung · EU-gehostet · auditierbar
          </p>
        </div>
      </div>
    </>
  );
}

function BubbleView({ bubble }: { bubble: Bubble }) {
  if (bubble.role === 'system-context') {
    return (
      <div className="text-[11px] text-titanium-500 italic text-center py-1">
        {bubble.content}
      </div>
    );
  }
  const isUser = bubble.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[88%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'bg-titanium-50 text-obsidian-950 font-medium rounded-none'
            : bubble.isError
              ? 'bg-red-950/40 border border-red-900 text-red-200'
              : 'bg-obsidian-900 border border-titanium-900 text-titanium-100',
        ].join(' ')}
      >
        {bubble.isLoading ? (
          <span className="inline-flex items-center gap-2 text-titanium-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> denkt nach …
          </span>
        ) : (
          bubble.content
        )}
      </div>
    </div>
  );
}
