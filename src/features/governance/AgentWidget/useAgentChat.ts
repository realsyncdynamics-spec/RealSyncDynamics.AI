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
    'Hallo. Ich bin der Compliance-Assistent für eure Governance-Runtime. Ich kann eure Assets, Risk-Scores, DPIAs, Incidents und Vendoren abfragen sowie technische Zusammenfassungen zu DSGVO, TTDSG und EU AI Act geben (keine Rechtsberatung). Womit fange ich an?',
  ts: Date.now(),
};

const STORAGE_KEY = (tenantId: string) => `rsd_agent_session_${tenantId}`;

export function useAgentChat(tenantId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [usRoutingRequired, setUsRoutingRequired] = useState(false);
  const [usRoutingAck, setUsRoutingAck] = useState(false);
  const [llmNotConfigured, setLlmNotConfigured] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    const stored = sessionStorage.getItem(STORAGE_KEY(tenantId));
    setSessionId(stored);
    setMessages([WELCOME]);
    setUsRoutingAck(false);
    setLlmNotConfigured(null);
  }, [tenantId]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || !tenantId || isLoading) return;

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

      const result = await sendChat({
        tenant_id: tenantId,
        message,
        session_id: sessionId ?? undefined,
        acknowledge_us_routing: usRoutingAck || undefined,
      });

      if (result.kind === 'us_routing_required') {
        setUsRoutingRequired(true);
        setMessages((prev) => prev.filter((m) => m.id !== 'loading' && m.id !== userMsg.id));
        setIsLoading(false);
        return;
      }
      if (result.kind === 'llm_not_configured') {
        setLlmNotConfigured(result.message);
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== 'loading')
            .concat({
              id: crypto.randomUUID(),
              role: 'assistant',
              content:
                'Der Agent ist noch nicht aktiv: der LLM-API-Key fehlt in Vault. Bitte `anthropic_api_key` provisionieren.',
              ts: Date.now(),
              isError: true,
            }),
        );
        setIsLoading(false);
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
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== 'loading')
            .concat({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `Verbindungsfehler: ${result.error.message}`,
              ts: Date.now(),
              isError: true,
            }),
        );
        setIsLoading(false);
        return;
      }

      // ok
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
    [isLoading, scrollToBottom, sessionId, tenantId, usRoutingAck],
  );

  const acknowledgeUsRouting = useCallback(() => {
    setUsRoutingAck(true);
    setUsRoutingRequired(false);
  }, []);

  const reset = useCallback(async () => {
    if (tenantId && sessionId) await resetSession(tenantId, sessionId);
    if (tenantId) sessionStorage.removeItem(STORAGE_KEY(tenantId));
    setSessionId(null);
    setMessages([WELCOME]);
  }, [sessionId, tenantId]);

  const showQuickActions = useMemo(() => messages.length <= 1 && !isLoading, [messages.length, isLoading]);

  return {
    messages,
    isLoading,
    send,
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
    'Hallo! Ich bin der öffentliche Compliance-Assistent von RealSyncDynamics.AI. Ich beantworte allgemeine Fragen zu DSGVO, TTDSG und EU AI Act — keine Rechtsberatung. Womit kann ich helfen?',
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
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || isLoading) return;

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: message, ts: Date.now() };
      const loadingMsg: ChatMessage = { id: 'loading', role: 'assistant', content: '', ts: Date.now(), isLoading: true };
      setMessages((prev) => [...prev.filter((m) => m.id !== 'loading'), userMsg, loadingMsg]);
      setIsLoading(true);
      scrollToBottom();

      const result = await sendChatAnon({
        session_id: sessionId,
        message,
        history,
        acknowledge_us_routing: usRoutingAck || undefined,
      });

      if (result.kind === 'rate_limited') {
        setRateLimited(true);
        setMessages((prev) => prev.filter((m) => m.id !== 'loading' && m.id !== userMsg.id));
        setIsLoading(false);
        return;
      }

      if (result.kind === 'us_routing_required') {
        setUsRoutingRequired(true);
        setMessages((prev) => prev.filter((m) => m.id !== 'loading' && m.id !== userMsg.id));
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
        const errText =
          result.kind === 'llm_not_configured'
            ? 'Der Assistent ist noch nicht konfiguriert. Bitte versuche es später erneut.'
            : result.kind === 'error'
            ? `Fehler: ${result.error.message}`
            : 'Unbekannter Fehler.';
        setMessages((prev) =>
          prev.filter((m) => m.id !== 'loading').concat({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: errText,
            ts: Date.now(),
            isError: true,
          }),
        );
      }

      setIsLoading(false);
      scrollToBottom();
    },
    [history, isLoading, scrollToBottom, sessionId, usRoutingAck],
  );

  const acknowledgeUsRouting = useCallback(() => {
    setUsRoutingAck(true);
    setUsRoutingRequired(false);
  }, []);

  const reset = useCallback(() => {
    const newSession = crypto.randomUUID();
    try {
      localStorage.setItem(ANON_SESSION_KEY, newSession);
      localStorage.removeItem(ANON_HISTORY_KEY);
    } catch { /* non-fatal */ }
    setSession({ sessionId: newSession, history: [] });
    setMessages([ANON_WELCOME]);
    setRateLimited(false);
  }, []);

  const showQuickActions = useMemo(() => messages.length <= 1 && !isLoading, [messages.length, isLoading]);

  return { messages, isLoading, send, reset, bottomRef, showQuickActions, rateLimited, usRoutingRequired, acknowledgeUsRouting };
}
