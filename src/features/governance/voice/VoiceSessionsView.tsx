/**
 * Voice session list — read-only surface for `/app/voice`.
 * Honest empty/error states. No mock rows, no fake KPIs.
 */
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, Mic, ChevronRight } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { useVoiceSessions } from './useVoiceSessions';
import type { VoiceSessionRow } from './voiceApi';

function formatTs(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'ended'
      ? 'border-emerald-700 text-emerald-300'
      : status === 'failed' || status === 'killed'
        ? 'border-rose-700 text-rose-300'
        : status === 'rate_limited'
          ? 'border-amber-700 text-amber-300'
          : 'border-titanium-700 text-titanium-300';
  return (
    <span className={`font-mono text-[10px] uppercase tracking-wide border px-1.5 py-0.5 ${tone}`}>
      {status}
    </span>
  );
}

function SessionRow({ session }: { session: VoiceSessionRow }) {
  return (
    <li>
      <Link
        to={`/app/voice/${session.id}`}
        className="flex items-center gap-3 border border-titanium-900 bg-obsidian-900 px-4 py-3 hover:border-titanium-700 transition-colors"
        data-testid={`voice-session-row-${session.id}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <StatusBadge status={session.status} />
            {session.kill_switch && (
              <span className="font-mono text-[10px] uppercase border border-rose-800 text-rose-300 px-1.5 py-0.5">
                kill_switch
              </span>
            )}
          </div>
          <div className="font-mono text-xs text-titanium-200 truncate">
            {session.provider} · {session.model}
          </div>
          <div className="font-mono text-[11px] text-titanium-500 mt-0.5">
            bot {session.bot_id.slice(0, 8)}… · start {formatTs(session.started_at)}
            {session.ended_at ? ` · ende ${formatTs(session.ended_at)}` : ''}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-titanium-600 shrink-0" aria-hidden />
      </Link>
    </li>
  );
}

function VoiceSessionsList({ tenantId }: { tenantId: string }) {
  const { sessions, loading, error, hasMore, loadMore, reload } = useVoiceSessions(tenantId);

  if (error) {
    return (
      <div
        className="border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200"
        data-testid="voice-sessions-error"
        role="alert"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="font-medium">Voice-Sessions konnten nicht geladen werden.</p>
            <p className="font-mono text-xs text-rose-300/80 mt-1">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 text-xs border border-rose-800 px-2 py-1 hover:bg-rose-900/40"
              data-testid="voice-sessions-retry"
            >
              Erneut laden
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && sessions.length === 0) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-16 text-sm text-titanium-500"
        data-testid="voice-sessions-loading"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Lade Voice-Sessions…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div
        className="border border-titanium-900 bg-obsidian-900 px-6 py-16 text-center"
        data-testid="voice-sessions-empty"
      >
        <Mic className="h-8 w-8 mx-auto text-titanium-600 mb-3" aria-hidden />
        <p className="text-sm text-titanium-200">Noch keine Voice-Sessions.</p>
        <p className="mt-2 text-xs text-titanium-500 max-w-md mx-auto leading-relaxed">
          Der Voice-Runtime-Dienst ist noch nicht live geschaltet
          (<span className="font-mono">apps/agent-runtime</span> hat keinen Deploy-Pfad;
          Telefonie ist nicht angebunden). Sobald Sessions geschrieben werden, erscheinen sie hier.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="voice-sessions-list">
      <ul className="space-y-2">
        {sessions.map((s) => (
          <SessionRow key={s.id} session={s} />
        ))}
      </ul>
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="border border-titanium-800 px-3 py-1.5 text-xs text-titanium-300 hover:border-titanium-600 disabled:opacity-50"
            data-testid="voice-sessions-load-more"
          >
            {loading ? 'Lädt…' : 'Weitere laden'}
          </button>
        </div>
      )}
    </div>
  );
}

export function VoiceSessionsView() {
  const { activeTenantId, loading: tenantLoading } = useTenant();

  return (
    <div className="min-h-full bg-obsidian-950 text-titanium-100" data-testid="voice-dashboard">
      <header className="border-b border-titanium-900 px-4 sm:px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 flex items-center justify-center bg-security-600">
            <Mic className="h-4 w-4 text-white" aria-hidden />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-titanium-50">Voice</h1>
            <p className="text-[11px] text-titanium-500">
              Governed Voice Sessions · read-only · Prüfpfad
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {tenantLoading ? (
          <div className="flex items-center gap-2 py-12 justify-center text-sm text-titanium-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Workspace wird geladen…
          </div>
        ) : !activeTenantId ? (
          <div
            className="border border-titanium-900 bg-obsidian-900 px-6 py-12 text-center text-sm text-titanium-400"
            data-testid="voice-no-tenant"
          >
            Kein aktiver Mandant. Voice-Daten werden erst geladen, wenn ein Workspace aus dem
            Membership-Kontext gewählt ist.
          </div>
        ) : (
          <VoiceSessionsList tenantId={activeTenantId} />
        )}
      </main>
    </div>
  );
}
