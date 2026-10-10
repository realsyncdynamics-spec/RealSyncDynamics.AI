/**
 * Governed Browser Runtime — Zustand im Dashboard, ausschließlich aus
 * Server-Antworten abgeleitet (Capabilities, Session, Frames, Freigaben).
 *
 * Aktualisierung ohne Reload per Polling (bestehende Infrastruktur, keine
 * neue Realtime-Publikation nötig):
 *   Capabilities/Executor  alle 20 s
 *   Frame der Session      alle 4 s, solange die Session offen ist
 *   offene Freigabe        alle 5 s
 * Nur bei sichtbarem Tab; nie parallel zu einer laufenden Aktion.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BrowserExecutorError,
  cancelApproval as cancelApprovalRequest,
  closeBrowserSession,
  createBrowserSession,
  getApprovalStatus,
  getBrowserRuntimeCapabilities,
  getBrowserSessionFrame,
  killAllBrowserSessions,
  listBrowserSessions,
  runGovernedAction,
  type ActResponse,
  type AgentMode,
  type BrowserExecutorAction,
  type CapabilitiesView,
  type FrameView,
  type PipelineStep,
  type SessionView,
} from './browserExecutorClient';

export const CAPABILITIES_POLL_MS = 20_000;
export const FRAME_POLL_MS = 4_000;
export const APPROVAL_POLL_MS = 5_000;

const OPEN: ReadonlySet<string> = new Set(['creating', 'ready', 'executing', 'awaiting_approval', 'paused']);

export interface PendingApproval {
  id: string;
  expiresAt: string;
  /** Unredigierte Aktion nur im Speicher dieses Tabs — nötig zum Einlösen. */
  action: BrowserExecutorAction;
  status: string;
  planStepIndex: number | null;
}

export interface RuntimeClient {
  getBrowserRuntimeCapabilities: typeof getBrowserRuntimeCapabilities;
  listBrowserSessions: typeof listBrowserSessions;
  createBrowserSession: typeof createBrowserSession;
  closeBrowserSession: typeof closeBrowserSession;
  getBrowserSessionFrame: typeof getBrowserSessionFrame;
  runGovernedAction: typeof runGovernedAction;
  getApprovalStatus: typeof getApprovalStatus;
  cancelApproval: typeof cancelApprovalRequest;
  killAllBrowserSessions: typeof killAllBrowserSessions;
}

const defaultClient: RuntimeClient = {
  getBrowserRuntimeCapabilities,
  listBrowserSessions,
  createBrowserSession,
  closeBrowserSession,
  getBrowserSessionFrame,
  runGovernedAction,
  getApprovalStatus,
  cancelApproval: cancelApprovalRequest,
  killAllBrowserSessions,
};

function visible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

export function useBrowserRuntime(tenantId: string | null, userId: string | null, client: RuntimeClient = defaultClient) {
  const [capabilities, setCapabilities] = useState<CapabilitiesView | null>(null);
  const [capabilitiesError, setCapabilitiesError] = useState<unknown>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const [session, setSession] = useState<SessionView | null>(null);
  const [frame, setFrame] = useState<FrameView | null>(null);
  const [page, setPage] = useState<{ url: string; title: string; loading: boolean } | null>(null);
  const [frameError, setFrameError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [lastResponse, setLastResponse] = useState<ActResponse | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStep[] | null>(null);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const busyRef = useRef(false);

  const loadCapabilities = useCallback(async () => {
    if (!tenantId) {
      setCapabilities(null);
      return;
    }
    setCapabilitiesLoading(true);
    try {
      const caps = await client.getBrowserRuntimeCapabilities({ tenantId });
      setCapabilities(caps);
      setCapabilitiesError(null);
    } catch (error) {
      setCapabilitiesError(error);
    } finally {
      setCapabilitiesLoading(false);
    }
  }, [tenantId, client]);

  // Capabilities + Executor-Status: sofort, dann periodisch.
  useEffect(() => {
    setCapabilities(null);
    setSession(null);
    setFrame(null);
    setPendingApproval(null);
    if (!tenantId) return;
    void loadCapabilities();
    const timer = setInterval(() => { if (visible()) void loadCapabilities(); }, CAPABILITIES_POLL_MS);
    return () => clearInterval(timer);
  }, [tenantId, loadCapabilities]);

  // Offene eigene Session wieder aufnehmen (Reload, zweites Gerät).
  useEffect(() => {
    if (!tenantId || !userId) return;
    let cancelled = false;
    client.listBrowserSessions({ tenantId })
      .then(({ sessions }) => {
        if (cancelled) return;
        const mine = sessions.find((s) => s.user_id === userId && OPEN.has(s.status));
        if (mine) setSession(mine);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [tenantId, userId, client]);

  const refreshFrame = useCallback(async () => {
    if (!tenantId || !session || !OPEN.has(session.status) || busyRef.current) return;
    try {
      const out = await client.getBrowserSessionFrame({ tenantId, sessionId: session.id });
      setFrame(out.frame);
      setPage(out.page);
      setFrameError(null);
      if (out.session_status !== session.status) setSession((s) => (s ? { ...s, status: out.session_status } : s));
    } catch (error) {
      setFrameError(error);
      if (error instanceof BrowserExecutorError && (error.code === 'SESSION_NOT_FOUND' || error.code === 'SESSION_EXPIRED')) {
        setSession((s) => (s ? { ...s, status: 'closed' } : s));
      }
      if (error instanceof BrowserExecutorError && error.code === 'URL_BLOCKED') {
        // Seite stand auf einer gesperrten Adresse: kein Bild, Session zu,
        // offene Freigaben dieser Session serverseitig zurückgezogen.
        setSession((s) => (s ? { ...s, status: 'failed' } : s));
        setFrame(null);
        setPendingApproval(null);
      }
    }
  }, [tenantId, session, client]);

  useEffect(() => {
    if (!session || !OPEN.has(session.status)) return;
    const timer = setInterval(() => { if (visible()) void refreshFrame(); }, FRAME_POLL_MS);
    return () => clearInterval(timer);
  }, [session, refreshFrame]);

  // Offene Freigabe beobachten. Eingelöst (browser_executions) heißt: in
  // einem anderen Tab ausgeführt oder verbraucht — hier nicht mehr ausführbar.
  useEffect(() => {
    if (!tenantId || !pendingApproval || pendingApproval.status !== 'pending') return;
    const timer = setInterval(async () => {
      if (!visible()) return;
      try {
        const { approval } = await client.getApprovalStatus({ tenantId, approvalId: pendingApproval.id });
        const status = approval.execution ? 'consumed' : approval.status;
        setPendingApproval((p) => (p && p.id === approval.id ? { ...p, status } : p));
      } catch { /* nächster Versuch */ }
    }, APPROVAL_POLL_MS);
    return () => clearInterval(timer);
  }, [tenantId, pendingApproval, client]);

  const applyResponse = useCallback((res: ActResponse) => {
    setLastResponse(res);
    setPipeline(res.pipeline);
    if (res.session) setSession(res.session);
    if (res.frame) setFrame(res.frame);
    if (res.result.url) setPage({ url: res.result.url, title: res.result.title ?? '', loading: false });
  }, []);

  const act = useCallback(async (
    action: BrowserExecutorAction,
    opts: { approvalId?: string | null; initiatedBy?: 'human' | 'planner'; planStepIndex?: number | null } = {},
  ): Promise<ActResponse> => {
    if (!tenantId || !session) throw new BrowserExecutorError('Keine offene Browser-Session', 'SESSION_NOT_FOUND', 404);
    busyRef.current = true;
    setBusy(true);
    setPipeline([{ step: 'requested', state: 'done' }, { step: 'policy', state: 'pending' }]);
    try {
      const res = await client.runGovernedAction({
        tenantId,
        sessionId: session.id,
        action,
        approvalId: opts.approvalId ?? null,
        initiatedBy: opts.initiatedBy ?? 'human',
      });
      applyResponse(res);
      if (opts.approvalId) setPendingApproval(null);
      return res;
    } catch (error) {
      if (error instanceof BrowserExecutorError) {
        const details = (error.details ?? {}) as { pipeline?: PipelineStep[]; approval_id?: string; expires_at?: string };
        setPipeline(details.pipeline ?? null);
        if (error.code === 'APPROVAL_REQUIRED' && details.approval_id) {
          setPendingApproval({
            id: details.approval_id,
            expiresAt: details.expires_at ?? '',
            action,
            status: 'pending',
            planStepIndex: opts.planStepIndex ?? null,
          });
          setSession((s) => (s ? { ...s, status: 'awaiting_approval' } : s));
        }
        const consumed = (error.details as { approval_consumed?: unknown } | undefined)?.approval_consumed === true;
        if (consumed || ['APPROVAL_DENIED', 'APPROVAL_EXPIRED', 'APPROVAL_ALREADY_USED', 'APPROVAL_MISMATCH', 'APPROVAL_NOT_FOUND'].includes(error.code)) {
          // Verbraucht (reserviert vor dem Executor, #1728) oder ungültig:
          // nie als „ausführbar“ stehen lassen.
          setPendingApproval(null);
        }
        if (error.code === 'SESSION_NOT_FOUND' || error.code === 'SESSION_EXPIRED') {
          setSession((s) => (s ? { ...s, status: 'closed' } : s));
        }
        if (error.code === 'URL_BLOCKED' && (error.details as { reason?: unknown } | undefined)?.reason === 'LANDED_ON_NON_PUBLIC_URL') {
          // Server hat die Session aus Sicherheitsgründen geschlossen.
          setSession((s) => (s ? { ...s, status: 'failed' } : s));
          setFrame(null);
          setPendingApproval(null);
        }
      }
      throw error;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [tenantId, session, client, applyResponse]);

  const openSession = useCallback(async (mode: AgentMode, initialUrl?: string | null) => {
    if (!tenantId) throw new BrowserExecutorError('Kein Mandant ausgewählt', 'TENANT_REQUIRED', 400);
    busyRef.current = true;
    setBusy(true);
    try {
      const out = await client.createBrowserSession({ tenantId, mode, initialUrl });
      setSession(out.session);
      if (out.frame) setFrame(out.frame);
      setPendingApproval(null);
      const nav = out.initial_navigation;
      if (nav && nav.ok === true) {
        applyResponse(nav as ActResponse);
      } else if (nav && nav.ok === false) {
        const e = nav.error;
        throw new BrowserExecutorError(e.message, e.code, 0, e.details);
      }
      return out.session;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [tenantId, client, applyResponse]);

  const closeSession = useCallback(async () => {
    if (!tenantId || !session) return;
    await client.closeBrowserSession({ tenantId, sessionId: session.id });
    setSession(null);
    setFrame(null);
    setPage(null);
    setPendingApproval(null);
    setPipeline(null);
  }, [tenantId, session, client]);

  const cancelPendingApproval = useCallback(async () => {
    if (!tenantId || !pendingApproval) return;
    const out = await client.cancelApproval({ tenantId, approvalId: pendingApproval.id });
    if (out.outcome === 'already_resolved') {
      // Zwischenzeitlich entschieden oder schon eingelöst — Stand vom Server holen.
      const { approval } = await client.getApprovalStatus({ tenantId, approvalId: pendingApproval.id });
      setPendingApproval((p) => (p && p.id === approval.id ? { ...p, status: approval.execution ? 'consumed' : approval.status } : p));
      return;
    }
    setPendingApproval(null);
    setSession((s) => (s && s.status === 'awaiting_approval' ? { ...s, status: 'ready' } : s));
  }, [tenantId, pendingApproval, client]);

  const markApproval = useCallback((status: string) => {
    setPendingApproval((p) => (p ? { ...p, status } : p));
  }, []);

  const killAll = useCallback(async () => {
    if (!tenantId) return null;
    const out = await client.killAllBrowserSessions({ tenantId });
    setSession(null);
    setFrame(null);
    setPendingApproval(null);
    await loadCapabilities();
    return out;
  }, [tenantId, client, loadCapabilities]);

  return {
    capabilities,
    capabilitiesError,
    capabilitiesLoading,
    reloadCapabilities: loadCapabilities,
    session,
    sessionOpen: Boolean(session && OPEN.has(session.status)),
    frame,
    page,
    frameError,
    refreshFrame,
    busy,
    lastResponse,
    pipeline,
    pendingApproval,
    act,
    openSession,
    closeSession,
    cancelPendingApproval,
    markApproval,
    killAll,
  };
}
