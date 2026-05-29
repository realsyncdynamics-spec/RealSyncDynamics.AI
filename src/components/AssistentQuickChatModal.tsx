import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, X, Send, AlertTriangle } from 'lucide-react';
import {
  sendQuickChat,
  QUICK_CHAT_LIMITS,
  type QuickChatMessage,
} from '../features/assistant/assistantQuickChatApi';

// Lightweight quick-chat modal opened by AssistentChip on public pages.
// Goes through ai-gateway (PR #233 + #240) — NOT the governance-agent
// path. Stays alive for the duration of the chip session; closes on
// route change (chip unmounts), on Escape, or on the X button.

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Bubble {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isError?: boolean;
  isLoading?: boolean;
}

const WELCOME_BUBBLE: Bubble = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hi. Ich bin der Assistent. Frag mich kurz, was du wissen willst — z. B. ' +
    '„Was deckt der DSGVO-Audit ab?" oder „Was ist EU-lokale KI?". ' +
    'Für einen vollständigen Website-Scan klick unten auf „Audit starten".',
};

export function AssistentQuickChatModal({ open, onClose }: Props) {
  const [bubbles, setBubbles] = useState<Bubble[]>([WELCOME_BUBBLE]);
  const [history, setHistory] = useState<QuickChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  // Bumped every time the modal closes so any awaited fetch
  // continuation can detect "I'm stale, drop my reply".
  const sessionToken = useRef(0);

  const reset = useCallback(() => {
    setBubbles([WELCOME_BUBBLE]);
    setHistory([]);
    setInput('');
  }, []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Auto-scroll.
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 20);
  }, [bubbles]);

  // Soft-reset when re-opened to keep the chat short-lived per intent.
  // Bumping the session token here ensures any in-flight send() resolves
  // into a no-op instead of appending a stale reply after reopen.
  useEffect(() => {
    if (!open) {
      sessionToken.current += 1;
      reset();
    }
  }, [open, reset]);

  async function onSend() {
    const message = input.trim();
    if (!message || loading || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);

    const myToken = sessionToken.current;
    const loadingId = crypto.randomUUID();
    setBubbles((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: message },
      { id: loadingId, role: 'assistant', content: '', isLoading: true },
    ]);
    setInput('');

    const result = await sendQuickChat({ message, history });
    inFlight.current = false;
    // If the modal was closed during the request, drop the reply — the
    // chat has already been reset and the new open() promised a fresh
    // thread, not the leftover answer.
    if (myToken !== sessionToken.current) return;
    setLoading(false);

    setBubbles((prev) => prev.filter((b) => b.id !== loadingId));

    switch (result.kind) {
      case 'ok':
        setHistory(result.history);
        setBubbles((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: result.reply },
        ]);
        return;
      case 'rate_limited': {
        const seconds = Math.ceil(result.retryAfterMs / 1000);
        setBubbles((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'system',
            content:
              `Bitte ${seconds} s warten — Anfrage-Limit erreicht ` +
              `(max ${QUICK_CHAT_LIMITS.rateLimitPerMinute}/Minute).`,
          },
        ]);
        return;
      }
      case 'too_long':
        setBubbles((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'system',
            content: `Nachricht zu lang (max ${QUICK_CHAT_LIMITS.maxMessageLength} Zeichen).`,
          },
        ]);
        return;
      case 'turn_cap':
        setBubbles((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'system',
            content:
              `Gespräch abgeschlossen (max ${QUICK_CHAT_LIMITS.maxTurns} Fragen). ` +
              'Für tiefere Beratung bitte den Audit-Flow oder Kontakt nutzen.',
          },
        ]);
        return;
      case 'pii_blocked':
        setBubbles((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'system',
            content:
              'Deine Nachricht enthält personenbezogene Daten ' +
              `(${result.pattern}). Bitte ohne diese Angaben erneut senden — ` +
              'der Assistent speichert keine personenbezogenen Daten.',
            isError: true,
          },
        ]);
        return;
      case 'error':
        setBubbles((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              result.code === 'UPSTREAM_UNAVAILABLE'
                ? 'Der Assistent ist gerade nicht erreichbar. Direkt-Kanal: support@realsyncdynamicsai.de — oder Audit jetzt starten unter /audit.'
                : `Fehler beim Senden: ${result.message}. Direkt-Kanal: support@realsyncdynamicsai.de.`,
            isError: true,
          },
        ]);
        return;
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
        aria-label="Assistent — Quick-Chat"
        className="fixed z-50 inset-x-2 bottom-2 top-16 sm:inset-auto sm:right-4 sm:bottom-4 sm:top-auto sm:w-[420px] sm:h-[580px] flex flex-col bg-obsidian-950 border border-amber-500/30 shadow-2xl rounded-none overflow-hidden"
      >
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-titanium-900 bg-obsidian-900">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="inline-flex w-7 h-7 mt-0.5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-obsidian-950">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-titanium-50">Assistent</div>
              <div className="text-[10px] text-titanium-400 mt-0.5">EU-lokal · ohne Login · keine Rechtsberatung</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="-mr-2 -mt-1 p-2 text-titanium-400 hover:text-titanium-100 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {bubbles.map((b) => <BubbleView key={b.id} bubble={b} />)}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-titanium-900 p-3 space-y-2">
          <div className="flex items-end gap-2">
            <input
              type="text"
              value={input}
              maxLength={QUICK_CHAT_LIMITS.maxMessageLength}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
              placeholder={loading ? 'Antwort wird generiert …' : 'Kurze Frage …'}
              disabled={loading}
              className="flex-1 bg-obsidian-900 border border-titanium-900 px-3 py-2 text-base sm:text-sm rounded-none outline-none focus:border-amber-400 disabled:opacity-50 placeholder:text-titanium-600"
            />
            <button
              type="button"
              onClick={onSend}
              disabled={loading || !input.trim()}
              aria-label="Senden"
              className="flex h-9 w-9 items-center justify-center bg-amber-400 text-obsidian-950 hover:bg-amber-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[10px] text-titanium-500 leading-relaxed">
            Quick-Chat · keine personenbezogenen Daten · max {QUICK_CHAT_LIMITS.maxTurns} Fragen
          </p>
        </div>
      </div>
    </>
  );
}

function BubbleView({ bubble }: { bubble: Bubble }) {
  if (bubble.role === 'system') {
    return (
      <div className={`flex items-start gap-2 text-[11px] px-2 py-1.5 border rounded-none ${
        bubble.isError
          ? 'border-amber-700/40 bg-amber-950/20 text-amber-200'
          : 'border-titanium-800 bg-obsidian-900 text-titanium-300 italic'
      }`}>
        {bubble.isError && <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-300" />}
        <span>{bubble.content}</span>
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
            ? 'bg-amber-400 text-obsidian-950 font-medium rounded-none'
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
