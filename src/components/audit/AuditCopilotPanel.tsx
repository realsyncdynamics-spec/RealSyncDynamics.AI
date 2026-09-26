import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Loader2, X, RotateCcw, Send, AlertTriangle, ShieldCheck, Code2 } from 'lucide-react';
import type { SimpleMsg } from '../../features/governance/AgentWidget/agentApi';
import {
  sendAuditAnon,
  type AuditAnonChatResult,
  type AuditCmsTarget,
} from '../../features/audit/auditCopilotApi';
import { AuditTurnstileWidget } from './AuditTurnstileWidget';

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
  auditId?: string;
  open: boolean;
  onClose: () => void;
}

type Phase = 'idle' | 'loading' | 'ready' | 'error' | 'rate_limited';

const CMS_OPTIONS: Array<{ value: AuditCmsTarget; label: string }> = [
  { value: 'wordpress',   label: 'WordPress' },
  { value: 'shopify',     label: 'Shopify' },
  { value: 'webflow',     label: 'Webflow' },
  { value: 'custom-html', label: 'Eigenes HTML' },
  { value: 'nginx',       label: 'nginx Config' },
];

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
  const ref = issue.paragraph_ref ? `\nRechtsgrundlage: ${issue.paragraph_ref.slice(0, 80)}` : '';
  return [
    `Erklär diesen DSGVO-Audit-Befund von ${domain.slice(0, 90)}:`,
    `Severity: ${SEV_LABEL[issue.severity]}`,
    `Titel: ${issue.title.slice(0, 120)}`,
    `Detail: ${issue.detail.slice(0, 220)}${ref}`,
    'Nenne kurz das technische Signal, relevante DSGVO/TDDDG/AI-Act-Pflichten und konkrete Abhilfe (gern als Code-Snippet).',
    'Direkt, ohne Marketing-, Bußgeld- oder Abmahn-Wording; keine Rechtsberatung.',
  ].join('\n');
}

export function AuditCopilotPanel({ issue, domain, auditId, open, onClose }: AuditCopilotPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [history, setHistory] = useState<SimpleMsg[]>([]);
  const [input, setInput] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [snippetCms, setSnippetCms] = useState<AuditCmsTarget>('wordpress');
  const [snippetLoading, setSnippetLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendInProgress = useRef(false);

  const send = useCallback(
    async (text: string, isAuto = false) => {
      if (sendInProgress.current || !turnstileToken) return;
      const message = text.trim();
      if (!message) return;
      sendInProgress.current = true;
      const token = turnstileToken;
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);

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

      let result: AuditAnonChatResult;
      try {
        result = await sendAuditAnon({
          auditId,
          message,
          history,
          turnstileToken: token,
        });
      } catch (err) {
        setBubbles((prev) => prev.filter((b) => b.id !== 'loading').concat({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Anfrage fehlgeschlagen.',
          isError: true,
        }));
        setPhase('error');
        sendInProgress.current = false;
        return;
      } finally {
        sendInProgress.current = false;
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
    [auditId, history, issue.title, turnstileToken],
  );

  // Start the explanation only after the first Turnstile token is ready.
  useEffect(() => {
    if (!open || !turnstileToken || phase !== 'idle' || bubbles.length > 0) return;
    send(buildInitialPrompt(issue, domain), true);
  }, [open, phase, issue, domain, send, turnstileToken, bubbles.length]);

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
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
    }
  }, [open]);

  function onUserSend() {
    const trimmed = input.trim();
    if (!trimmed || phase === 'loading' || !turnstileToken) return;
    setInput('');
    send(trimmed, false);
  }

  async function onGenerateSnippet() {
    if (snippetLoading || sendInProgress.current || !turnstileToken) return;
    sendInProgress.current = true;
    setSnippetLoading(true);
    setPhase('loading');
    const token = turnstileToken;
    setTurnstileToken(null);
    setTurnstileResetKey((value) => value + 1);
    const loadingId = crypto.randomUUID();
    setBubbles((prev) => [
      ...prev,
      { id: loadingId, role: 'assistant', content: '', isLoading: true },
    ]);
    try {
      const request = [
        `Erstelle einen knappen, kopierfähigen Code- oder Konfigurationsschnipsel für ${snippetCms} als technische Maßnahme zu einem Audit-Befund.`,
        `Domain: ${domain.slice(0, 100)}.`,
        `Severity: ${SEV_LABEL[issue.severity]}. Befund: ${issue.title.slice(0, 150)}. ${issue.detail.slice(0, 350)}`,
        issue.paragraph_ref ? `Rechtsgrundlage: ${issue.paragraph_ref.slice(0, 100)}.` : '',
        'Gib einen passenden Codeblock und danach höchstens zwei kurze Umsetzungshinweise aus; keine Rechtsberatung.',
      ].filter(Boolean).join('\n');
      const result = await sendAuditAnon({
        auditId,
        message: request,
        history,
        turnstileToken: token,
      });
      if (result.kind === 'rate_limited') {
        setPhase('rate_limited');
        setBubbles((prev) => prev.filter((b) => b.id !== loadingId));
        return;
      }
      if (result.kind !== 'ok') {
        const errorMessage = result.kind === 'llm_not_configured'
          ? 'Der Assistent ist gerade nicht konfiguriert. Bitte später erneut versuchen.'
          : result.error.message;
        setPhase('error');
        setBubbles((prev) => prev.filter((b) => b.id !== loadingId).concat({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Snippet konnte nicht erzeugt werden: ${errorMessage}`,
          isError: true,
        }));
        return;
      }
      setHistory(result.data.history);
      setBubbles((prev) =>
        prev.filter((b) => b.id !== loadingId).concat({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.data.response || '(Kein Snippet generiert.)',
        }),
      );
      setPhase('ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Snippet konnte nicht erzeugt werden.';
      setBubbles((prev) =>
        prev.filter((b) => b.id !== loadingId).concat({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Snippet konnte nicht erzeugt werden: ${msg}`,
          isError: true,
        }),
      );
      setPhase('error');
    } finally {
      setSnippetLoading(false);
      sendInProgress.current = false;
    }
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
              <div className="text-sm font-semibold text-titanium-50 truncate">🤖 KI-Befund-Erklärung</div>
              <div className="text-[10px] text-cyan-400 mt-0.5 truncate">
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

        <div className="border-b border-cyan-500/20 bg-cyan-500/5 px-4 py-2 text-[11px] text-cyan-300 leading-relaxed">
          <span className="font-semibold">KI-System (Art. 52 EU AI Act):</span> Die Erklärungen werden von einer KI generiert. Keine Rechtsberatung – Prüfung durch Spezialist empfohlen.
        </div>

        {phase === 'rate_limited' && (
          <div className="border-b border-orange-400/30 bg-orange-400/10 px-4 py-2 text-[12px] text-orange-200">
            Anfrage-Limit erreicht (5/min). Bitte in einer Minute erneut.
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {bubbles.length === 0 && phase === 'idle' && (
            <div className="flex items-center justify-center h-full text-xs text-titanium-500">
              <ShieldCheck className="h-4 w-4 mr-2" /> Bitte Bot-Schutz abschließen …
            </div>
          )}
          {bubbles.map((b) => (
            <BubbleView key={b.id} bubble={b} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-titanium-900 p-3 space-y-2">
          <AuditTurnstileWidget
            siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
            resetKey={turnstileResetKey}
            onToken={setTurnstileToken}
          />
          <div className="flex items-center gap-2">
            <select
              value={snippetCms}
              onChange={(e) => setSnippetCms(e.target.value as AuditCmsTarget)}
              disabled={snippetLoading}
              aria-label="Plattform für Code-Snippet"
              className="bg-obsidian-900 border border-titanium-900 text-titanium-200 px-2 py-1 text-[11px] rounded-none disabled:opacity-50"
            >
              {CMS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onGenerateSnippet}
              disabled={snippetLoading || phase === 'loading'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium border border-titanium-800 text-titanium-200 hover:border-titanium-600 hover:text-titanium-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-none"
            >
              {snippetLoading
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Code2 className="h-3 w-3" />}
              Code-Snippet
            </button>
          </div>
          <div className="flex items-end gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onUserSend(); }}
              placeholder={phase === 'loading' ? 'Antwort wird generiert …' : 'Folgefrage stellen …'}
              disabled={phase === 'loading'}
              className="flex-1 bg-obsidian-900 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-titanium-100 disabled:opacity-50 placeholder:text-titanium-600"
            />
            <button
              type="button"
              onClick={onUserSend}
              disabled={phase === 'loading' || !input.trim() || !turnstileToken}
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
