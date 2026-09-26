import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendChat, resetSession, sendChatAnon, type SimpleMsg } from './agentApi';

export type Role = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  ts: number;
  actions?: string[];
  isLoading?: boolean;
  isError?: boolean;
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hallo. Ich bin ein KI-System – ein automatisierter Compliance-Assistent für eure Governance-Runtime. Ich kann eure Assets, Risk-Scores, DPIAs, Incidents und Vendoren abfragen sowie technische Zusammenfassungen zu DSGVO, TDDDG und EU AI Act geben (keine Rechtsberatung, keine garantierte Genauigkeit). Womit fange ich an?',
  ts: Date.now(),
};

/**
 * Ehrliche Meldung bei Server-/Netzwerkfehlern. Kein Rohtext aus dem Fehler,
 * keine Beispiel-Antwort als Ersatz — der Nutzer sieht, dass nichts kam, und
 * kann es erneut versuchen (`retry`).
 */
export const ASSISTANT_UNAVAILABLE =
  'Der Assistent ist gerade nicht erreichbar. Bitte später erneut versuchen.';

/** Letzte fehlgeschlagene Nachricht — Grundlage für „Erneut versuchen". */
interface FailedSend {
  text: string;
  userMsgId: string;
  errorMsgId: string;
}

function unavailableMessage(): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: ASSISTANT_UNAVAILABLE,
    ts: Date.now(),
    isError: true,
  };
}

const STORAGE_KEY = (tenantId: string) => `rsd_agent_session_${tenantId}`;

export function useAgentChat(tenantId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [usRoutingRequired, setUsRoutingRequired] = useState(false);
  const [usRoutingAck, setUsRoutingAck] = useState(false);
  const [llmNotConfigured, setLlmNotConfigured] = useState<string | null>(null);
  const [failed, setFailed] = useState<FailedSend | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    const stored = sessionStorage.getItem(STORAGE_KEY(tenantId));
    setSessionId(stored);
    setMessages([WELCOME]);
    setUsRoutingAck(false);
    setLlmNotConfigured(null);
    setFailed(null);
  }, [tenantId]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
  }, []);

  const sendWith = useCallback(
    async (text: string, ackUsRouting: boolean) => {
      const message = text.trim();
      if (!message || !tenantId || isLoading) return;
      setFailed(null);

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        ts: Date.now(),
      };
      const loadingMsg: ChatMessage = {
        id: 'loading',
        role: 'assistant',
        content: '',
        ts: Date.now(),
        isLoading: true,
      };
      setMessages((prev) => [...prev.filter((m) => m.id !== 'loading'), userMsg, loadingMsg]);
      setIsLoading(true);
      scrollToBottom();

      // Ein Wurf (z. B. Supabase nicht konfiguriert, Netzwerk weg) darf den
      // Chat nicht im Ladezustand hängen lassen — er ist ein Fehler wie jeder
      // andere.
      let result: Awaited<ReturnType<typeof sendChat>>;
      try {
        result = await sendChat({
          tenant_id: tenantId,
          message,
          session_id: sessionId ?? undefined,
          acknowledge_us_routing: ackUsRouting || undefined,
        });
      } catch (err) {
        result = {
          kind: 'error',
          error: { code: 'NETWORK', message: err instanceof Error ? err.message : String(err) },
        };
      }

      const fail = (extra?: () => void) => {
        const errorMsg = unavailableMessage();
        extra?.();
        setMessages((prev) => prev.filter((m) => m.id !== 'loading').concat(errorMsg));
        setFailed({ text: message, userMsgId: userMsg.id, errorMsgId: errorMsg.id });
        setIsLoading(false);
        scrollToBottom();
      };

      if (result.kind === 'us_routing_required') {
        // Nicht still verwerfen: Banner zeigen und die Nachricht für den
        // Versand nach der Bestätigung merken.
        setUsRoutingRequired(true);
        setMessages((prev) => prev.filter((m) => m.id !== 'loading' && m.id !== userMsg.id));
        setFailed({ text: message, userMsgId: userMsg.id, errorMsgId: '' });
        setIsLoading(false);
        return;
      }
      if (result.kind === 'llm_not_configured') {
        const detail = result.message;
        fail(() => setLlmNotConfigured(detail));
        return;
      }
      if (result.kind === 'forbidden') {
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== 'loading')
            .concat({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: 'Kein Zugriff auf diesen Tenant.',
              ts: Date.now(),
              isError: true,
            }),
        );
        setIsLoading(false);
        return;
      }
      if (result.kind === 'error') {
        fail();
        return;
      }

      // ok — aber ohne Antworttext und ohne Erfolg: ehrlich als Ausfall melden.
      if (result.data.outcome !== 'success' && !result.data.response) {
        fail();
        return;
      }
      const newSession = result.data.session_id;
      sessionStorage.setItem(STORAGE_KEY(tenantId), newSession);
      setSessionId(newSession);
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== 'loading')
          .concat({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: result.data.response || '(Keine Antwort generiert.)',
            ts: Date.now(),
            actions: result.data.actions_taken,
            isError: result.data.outcome !== 'success',
          }),
      );
      setIsLoading(false);
      scrollToBottom();
    },
    [isLoading, scrollToBottom, sessionId, tenantId],
  );

  const send = useCallback((text: string) => sendWith(text, usRoutingAck), [sendWith, usRoutingAck]);

  /** Letzte fehlgeschlagene Nachricht erneut senden (Fehlermeldung entfällt). */
  const retry = useCallback(async () => {
    if (!failed) return;
    const { text, userMsgId, errorMsgId } = failed;
    setMessages((prev) => prev.filter((m) => m.id !== userMsgId && m.id !== errorMsgId));
    await sendWith(text, usRoutingAck);
  }, [failed, sendWith, usRoutingAck]);

  /**
   * US-Routing bestätigen. Eine Nachricht, die an der fehlenden Bestätigung
   * hing, wird danach gesendet — statt sie still zu verwerfen.
   */
  const acknowledgeUsRouting = useCallback(async () => {
    setUsRoutingAck(true);
    setUsRoutingRequired(false);
    if (failed && !failed.errorMsgId) {
      const { text } = failed;
      await sendWith(text, true);
    }
  }, [failed, sendWith]);

  const reset = useCallback(async () => {
    if (tenantId && sessionId) {
      try { await resetSession(tenantId, sessionId); } catch { /* lokal trotzdem zurücksetzen */ }
    }
    if (tenantId) sessionStorage.removeItem(STORAGE_KEY(tenantId));
    setSessionId(null);
    setFailed(null);
    setMessages([WELCOME]);
  }, [sessionId, tenantId]);

  const showQuickActions = useMemo(() => messages.length <= 1 && !isLoading, [messages.length, isLoading]);

  return {
    messages,
    isLoading,
    send,
    retry,
    canRetry: failed !== null && failed.errorMsgId !== '' && !isLoading,
    reset,
    bottomRef,
    showQuickActions,
    usRoutingRequired,
    acknowledgeUsRouting,
    llmNotConfigured,
  };
}

// ── Anon (public) chat ────────────────────────────────────────────────────────

const ANON_SESSION_KEY = 'rsd_anon_chat_session';
const ANON_HISTORY_KEY = 'rsd_anon_chat_history';

const ANON_WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hallo! Ich bin der öffentliche Compliance-Assistent von RealSyncDynamics.AI. Fragen zu DSGVO, TDDDG und EU AI Act – keine Rechtsberatung. Womit kann ich helfen?',
  ts: Date.now(),
};

function loadAnonSession(): { sessionId: string; history: SimpleMsg[] } {
  try {
    const sessionId = localStorage.getItem(ANON_SESSION_KEY) || crypto.randomUUID();
    const history: SimpleMsg[] = JSON.parse(localStorage.getItem(ANON_HISTORY_KEY) || '[]');
    return { sessionId, history };
  } catch {
    return { sessionId: crypto.randomUUID(), history: [] };
  }
}

export function useAnonChat() {
  const [{ sessionId, history }, setSession] = useState(loadAnonSession);
  const [messages, setMessages] = useState<ChatMessage[]>([ANON_WELCOME]);
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [usRoutingRequired, setUsRoutingRequired] = useState(false);
  const [usRoutingAck, setUsRoutingAck] = useState(false);
  const [failed, setFailed] = useState<FailedSend | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
  }, []);

  const sendWith = useCallback(
    async (text: string, ackUsRouting: boolean) => {
      const message = text.trim();
      if (!message || isLoading) return;
      setFailed(null);

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: message, ts: Date.now() };
      const loadingMsg: ChatMessage = { id: 'loading', role: 'assistant', content: '', ts: Date.now(), isLoading: true };
      setMessages((prev) => [...prev.filter((m) => m.id !== 'loading'), userMsg, loadingMsg]);
      setIsLoading(true);
      scrollToBottom();

      let result: Awaited<ReturnType<typeof sendChatAnon>>;
      try {
        result = await sendChatAnon({
          session_id: sessionId,
          message,
          history,
          acknowledge_us_routing: ackUsRouting || undefined,
        });
      } catch (err) {
        result = {
          kind: 'error',
          error: { code: 'NETWORK', message: err instanceof Error ? err.message : String(err) },
        };
      }

      if (result.kind === 'rate_limited') {
        setRateLimited(true);
        setMessages((prev) => prev.filter((m) => m.id !== 'loading' && m.id !== userMsg.id));
        setIsLoading(false);
        return;
      }

      if (result.kind === 'us_routing_required') {
        setUsRoutingRequired(true);
        setMessages((prev) => prev.filter((m) => m.id !== 'loading' && m.id !== userMsg.id));
        setFailed({ text: message, userMsgId: userMsg.id, errorMsgId: '' });
        setIsLoading(false);
        return;
      }

      if (result.kind === 'ok') {
        const newHistory = result.data.history;
        try {
          localStorage.setItem(ANON_SESSION_KEY, sessionId);
          localStorage.setItem(ANON_HISTORY_KEY, JSON.stringify(newHistory));
        } catch { /* storage quota — non-fatal */ }
        setSession({ sessionId, history: newHistory });
        setMessages((prev) =>
          prev.filter((m) => m.id !== 'loading').concat({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: result.data.response || '(Keine Antwort generiert.)',
            ts: Date.now(),
          }),
        );
      } else {
        // Server- oder Netzwerkfehler (auch „nicht konfiguriert"): ehrliche
        // Meldung statt Rohtext, „Erneut versuchen" über `retry`.
        const errorMsg = unavailableMessage();
        setMessages((prev) => prev.filter((m) => m.id !== 'loading').concat(errorMsg));
        setFailed({ text: message, userMsgId: userMsg.id, errorMsgId: errorMsg.id });
      }

      setIsLoading(false);
      scrollToBottom();
    },
    [history, isLoading, scrollToBottom, sessionId],
  );

  const send = useCallback((text: string) => sendWith(text, usRoutingAck), [sendWith, usRoutingAck]);

  const retry = useCallback(async () => {
    if (!failed) return;
    const { text, userMsgId, errorMsgId } = failed;
    setMessages((prev) => prev.filter((m) => m.id !== userMsgId && m.id !== errorMsgId));
    await sendWith(text, usRoutingAck);
  }, [failed, sendWith, usRoutingAck]);

  const acknowledgeUsRouting = useCallback(async () => {
    setUsRoutingAck(true);
    setUsRoutingRequired(false);
    if (failed && !failed.errorMsgId) {
      const { text } = failed;
      await sendWith(text, true);
    }
  }, [failed, sendWith]);

  const reset = useCallback(() => {
    const newSession = crypto.randomUUID();
    try {
      localStorage.setItem(ANON_SESSION_KEY, newSession);
      localStorage.removeItem(ANON_HISTORY_KEY);
    } catch { /* non-fatal */ }
    setSession({ sessionId: newSession, history: [] });
    setMessages([ANON_WELCOME]);
    setRateLimited(false);
    setFailed(null);
  }, []);

  const showQuickActions = useMemo(() => messages.length <= 1 && !isLoading, [messages.length, isLoading]);
  const canRetry = failed !== null && failed.errorMsgId !== '' && !isLoading;

  return { messages, isLoading, send, retry, canRetry, reset, bottomRef, showQuickActions, rateLimited, usRoutingRequired, acknowledgeUsRouting };
}
