import { ArrowLeft, ArrowRight, Loader2, RefreshCw, RotateCw, X } from 'lucide-react';
import type { ExecutorHealthView, FrameView, SessionView } from './browserExecutorClient';
import { EXECUTOR_STATUS_LABEL, SESSION_STATUS_LABEL, describeRedacted, runtimeErrorText } from './runtimeText';

/**
 * Vorschau DERSELBEN Chromium-Session, in der die Aktionen laufen: Einzelbilder
 * (JPEG) vom Executor, per Polling aktualisiert — kein Video-Stream, keine
 * Animation, keine zweite Seite.
 */
export function BrowserPreview({
  session,
  frame,
  page,
  frameError,
  executor,
  busy,
  onRefresh,
  onNavigate,
  onClose,
}: {
  session: SessionView;
  frame: FrameView | null;
  page: { url: string; title: string; loading: boolean } | null;
  frameError: unknown;
  executor: ExecutorHealthView | null;
  busy: boolean;
  onRefresh: () => void;
  onNavigate: (type: 'back' | 'forward' | 'reload') => void;
  onClose: () => void;
}) {
  const url = page?.url ?? session.current_url ?? 'about:blank';
  const title = page?.title ?? session.page_title ?? '';
  const loading = busy || page?.loading === true || session.status === 'executing';
  const nav = session.status === 'ready';

  return (
    <div className="mt-4 border border-titanium-800 bg-obsidian-900" data-testid="browser-session-preview">
      <div className="flex flex-wrap items-center gap-2 border-b border-titanium-800 px-3 py-2">
        <button type="button" onClick={() => onNavigate('back')} disabled={!nav || busy} className="p-1 text-titanium-400 hover:text-titanium-100 disabled:opacity-40" aria-label="Zurück (governed)">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => onNavigate('forward')} disabled={!nav || busy} className="p-1 text-titanium-400 hover:text-titanium-100 disabled:opacity-40" aria-label="Vorwärts (governed)">
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => onNavigate('reload')} disabled={!nav || busy} className="p-1 text-titanium-400 hover:text-titanium-100 disabled:opacity-40" aria-label="Neu laden (governed)">
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1 truncate border border-titanium-800 bg-obsidian-950 px-2 py-1 font-mono text-[11px] text-titanium-300" title={url} data-testid="browser-session-url">
          {url}
        </div>
        <button type="button" onClick={onRefresh} disabled={busy} className="inline-flex items-center gap-1 border border-titanium-800 px-2 py-1 text-[11px] text-titanium-300 disabled:opacity-40">
          <RefreshCw className="h-3 w-3" /> Bild
        </button>
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 border border-titanium-800 px-2 py-1 text-[11px] text-titanium-300 hover:border-red-900 hover:text-red-300">
          <X className="h-3 w-3" /> Schließen
        </button>
      </div>

      <div className="relative bg-obsidian-950">
        {frame ? (
          <img
            src={`data:${frame.mime};base64,${frame.base64}`}
            alt={title ? `Aktueller Stand der Browser-Session: ${title}` : 'Aktueller Stand der Browser-Session'}
            className="block w-full"
            data-testid="browser-session-frame"
            data-frame-sha256={frame.sha256}
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-xs text-titanium-500">Noch kein Bild der Session.</div>
        )}
        {loading && (
          <div className="absolute right-2 top-2 inline-flex items-center gap-1 border border-cyan-900 bg-obsidian-950/90 px-2 py-1 text-[10px] text-cyan-300">
            <Loader2 className="h-3 w-3 animate-spin" /> lädt
          </div>
        )}
      </div>

      <dl className="grid gap-x-4 gap-y-1 px-3 py-2 text-[11px] sm:grid-cols-2">
        <div className="flex gap-2"><dt className="text-titanium-500">Titel</dt><dd className="truncate text-titanium-200">{title || '—'}</dd></div>
        <div className="flex gap-2"><dt className="text-titanium-500">Session</dt><dd className="text-titanium-200" data-testid="browser-session-status">{SESSION_STATUS_LABEL[session.status]}</dd></div>
        <div className="flex gap-2"><dt className="text-titanium-500">Executor</dt><dd className="text-titanium-200">{executor ? EXECUTOR_STATUS_LABEL[executor.status] : 'unbekannt'}</dd></div>
        <div className="flex gap-2"><dt className="text-titanium-500">Bild</dt><dd className="font-mono text-titanium-400">{frame ? `${new Date(frame.captured_at).toLocaleTimeString('de-DE')} · ${frame.sha256.slice(0, 12)}…` : '—'}</dd></div>
        <div className="flex gap-2 sm:col-span-2"><dt className="text-titanium-500">Letzte Aktion</dt><dd className="text-titanium-200">
          {session.last_action ? `${session.last_action.type} · ${session.last_action.outcome}${session.last_action.verification ? ` · Verifikation ${session.last_action.verification}` : ''}` : '—'}
        </dd></div>
        <div className="flex gap-2 sm:col-span-2"><dt className="text-titanium-500">Nächste Aktion</dt><dd className="text-titanium-200">
          {session.next_action?.action ? describeRedacted(session.next_action.action) : '—'}
        </dd></div>
        {(frameError || session.last_error_code) && (
          <div className="sm:col-span-2 text-red-300" role="alert">
            {frameError ? runtimeErrorText(frameError) : `Letzter Fehler: ${session.last_error_code}`}
          </div>
        )}
      </dl>
    </div>
  );
}
