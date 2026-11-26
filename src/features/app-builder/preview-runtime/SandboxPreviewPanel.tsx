/**
 * Laufzeit-Vorschau per Sandbox (Spike 22.11.2026, Feature-Flag, Standard AUS).
 *
 * Wird nur gerendert, wenn `isSandboxPreviewEnabled()` true ist. Die
 * srcDoc-Vorschau im BoltWorkbench bleibt Standard und Rückfall.
 *
 * Sicherheit:
 *   * Die Vorschau-URL liegt auf fremder Origin (Server prüft das).
 *   * Der Rahmen bekommt KEIN `allow-same-origin` → opake Origin, kein Zugriff
 *     auf Cookies/Storage, weder der App noch der Vorschau-Domain.
 *   * Heartbeat alle 30 s; ohne Heartbeat stoppt der Server nach 3 min.
 *   * Schließen/Verlassen → stop mit `keepalive`.
 *
 * Nur gegen einen Fake getestet; kein echter Anbieter angebunden.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { sandboxPreviewClient, type SandboxPreviewClient, type SandboxSessionView } from './client';

/** Muss deutlich unter `PREVIEW_LIMITS.idleStopMs` (3 min, serverseitig) liegen. */
export const SANDBOX_HEARTBEAT_MS = 30_000;

/** Opake Origin: Skripte und Formulare ja, eigene Herkunft nein. */
export const SANDBOX_RUNTIME_FRAME_TOKENS = 'allow-scripts allow-forms';

export interface SandboxPreviewPanelProps {
  tenantId: string;
  /** Server-ID des gespeicherten Projekts; null = noch nicht gespeichert. */
  projectId: string | null;
  client?: SandboxPreviewClient;
}

export function SandboxPreviewPanel({
  tenantId,
  projectId,
  client = sandboxPreviewClient,
}: SandboxPreviewPanelProps): ReactElement {
  const [session, setSession] = useState<SandboxSessionView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = useRef<string | null>(null);

  const stopLive = useCallback(
    (reason: 'user' | 'closed') => {
      const id = live.current;
      live.current = null;
      if (id) void client.stop(tenantId, id, reason);
    },
    [client, tenantId],
  );

  // Builder schließen = Sandbox beenden (Unmount und Tab-Wechsel weg).
  useEffect(() => {
    const onHide = () => stopLive('closed');
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      stopLive('closed');
    };
  }, [stopLive]);

  useEffect(() => {
    if (!session || session.state !== 'running') return;
    const timer = window.setInterval(async () => {
      const res = await client.heartbeat(tenantId, session.sessionId);
      if (res.kind === 'ok') {
        setSession(res.session);
        if (res.session.state !== 'running') live.current = null;
      }
    }, SANDBOX_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [client, tenantId, session]);

  const start = async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    const res = await client.start(tenantId, projectId);
    setBusy(false);
    if (res.kind !== 'ok') {
      setError(`${res.code ?? 'FEHLER'} — ${res.message}`);
      return;
    }
    live.current = res.session.state === 'running' ? res.session.sessionId : null;
    setSession(res.session);
  };

  const stop = () => {
    stopLive('user');
    setSession((s) => (s ? { ...s, state: 'stopped', previewUrl: null, stopReason: 'user' } : s));
  };

  const running = session?.state === 'running' && session.previewUrl;

  return (
    <div data-testid="sandbox-preview-panel" className="grid min-h-[320px] grid-rows-[auto_minmax(0,1fr)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="font-mono text-[10px] tracking-widest text-[#E4C56A] uppercase">Spike · Laufzeit-Vorschau</span>
        {running ? (
          <button type="button" onClick={stop} className="min-h-11 border border-white/15 px-3 text-xs">
            Sandbox beenden
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            disabled={!projectId || busy}
            className="min-h-11 border border-white/15 px-3 text-xs disabled:opacity-40"
          >
            {busy ? 'Startet …' : 'Sandbox starten'}
          </button>
        )}
        {!projectId ? (
          <span className="text-xs text-white/55">Erst speichern — die Sandbox lädt das gespeicherte Projekt.</span>
        ) : null}
        {session && !running ? (
          <span className="font-mono text-[11px] text-white/45">
            {session.state}
            {session.stopReason ? ` · ${session.stopReason}` : ''}
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="border-b border-[#E24A4A]/40 bg-[#E24A4A]/10 px-3 py-2 text-xs text-[#E24A4A]">
          {error}
        </p>
      ) : null}
      {running ? (
        <iframe
          title="Laufzeit-Vorschau (Sandbox)"
          src={session?.previewUrl ?? undefined}
          sandbox={SANDBOX_RUNTIME_FRAME_TOKENS}
          referrerPolicy="no-referrer"
          allow=""
          className="h-full min-h-[360px] w-full bg-[#0A0A0B]"
        />
      ) : (
        <div className="grid place-items-center p-6 text-center text-sm text-white/55">
          Echte Laufzeit (npm install + Vite) in einer isolierten Sandbox. Zeitlimit 15 Minuten.
        </div>
      )}
    </div>
  );
}
