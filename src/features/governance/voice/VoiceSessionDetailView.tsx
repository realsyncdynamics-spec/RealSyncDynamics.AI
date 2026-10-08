/**
 * Voice session detail — tool requests, policy verdicts, executions, evidence.
 * Read-only. No kill-switch button. No client-side hash-chain verify
 * (evidence-hash.ts is not on main; do not invent an algorithm).
 */
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2, Mic } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { useVoiceSessionDetail } from './useVoiceSessionDetail';
import {
  shortenHash,
  type VoiceEvidenceRow,
  type VoiceExecutionRow,
  type VoiceToolRequestRow,
} from './voiceApi';

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
    second: '2-digit',
  });
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-titanium-900 bg-obsidian-900 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wide text-titanium-500">{label}</div>
      <div className="font-mono text-xs text-titanium-200 mt-0.5 break-all">{value}</div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) {
    return <span className="font-mono text-[10px] text-titanium-500">offen</span>;
  }
  const tone =
    verdict === 'ALLOW'
      ? 'border-emerald-700 text-emerald-300'
      : verdict === 'DENY'
        ? 'border-rose-700 text-rose-300'
        : 'border-amber-700 text-amber-300';
  return (
    <span className={`font-mono text-[10px] uppercase border px-1.5 py-0.5 ${tone}`}>{verdict}</span>
  );
}

function ToolRequestBlock({
  req,
  execution,
}: {
  req: VoiceToolRequestRow;
  execution: VoiceExecutionRow | undefined;
}) {
  return (
    <li
      className="border border-titanium-900 bg-obsidian-900 p-3"
      data-testid={`voice-tool-request-${req.id}`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="font-mono text-xs text-titanium-100">{req.tool}</span>
        <VerdictBadge verdict={req.verdict} />
        {req.risk && (
          <span className="font-mono text-[10px] text-titanium-400">risk={req.risk}</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-titanium-500">
        <div>decided_at {formatTs(req.decided_at)}</div>
        <div>confirmed_at {formatTs(req.confirmed_at)}</div>
      </div>
      {execution ? (
        <div
          className="mt-2 border-t border-titanium-900 pt-2 font-mono text-[11px] text-titanium-400"
          data-testid={`voice-execution-${execution.id}`}
        >
          execution · status={execution.status} · verification={execution.verification_status}
        </div>
      ) : (
        <div className="mt-2 border-t border-titanium-900 pt-2 font-mono text-[11px] text-titanium-600">
          keine execution-Zeile
        </div>
      )}
    </li>
  );
}

function EvidenceList({ rows }: { rows: VoiceEvidenceRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-titanium-500" data-testid="voice-evidence-empty">
        Keine Evidenz-Einträge für diese Session.
      </p>
    );
  }
  return (
    <ol className="space-y-1.5" data-testid="voice-evidence-list">
      {rows.map((e) => (
        <li
          key={e.id}
          className="border border-titanium-900 bg-obsidian-900 px-3 py-2 font-mono text-[11px]"
          data-testid={`voice-evidence-${e.seq}`}
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-titanium-200">
            <span>seq={e.seq}</span>
            <span>{e.kind}</span>
            <span className="text-titanium-500">{formatTs(e.created_at)}</span>
          </div>
          <div className="mt-1 text-titanium-500">
            prev={shortenHash(e.prev_hash)} · hash={shortenHash(e.hash)}
          </div>
        </li>
      ))}
    </ol>
  );
}

function DetailBody({ tenantId, sessionId }: { tenantId: string; sessionId: string }) {
  const { detail, loading, error, notFound, reload } = useVoiceSessionDetail(tenantId, sessionId);

  if (error) {
    return (
      <div
        className="border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200"
        data-testid="voice-detail-error"
        role="alert"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="font-medium">Session-Detail konnte nicht geladen werden.</p>
            <p className="font-mono text-xs text-rose-300/80 mt-1">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 text-xs border border-rose-800 px-2 py-1 hover:bg-rose-900/40"
              data-testid="voice-detail-retry"
            >
              Erneut laden
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !detail) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-16 text-sm text-titanium-500"
        data-testid="voice-detail-loading"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Lade Session…
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div
        className="border border-titanium-900 bg-obsidian-900 px-6 py-12 text-center text-sm text-titanium-400"
        data-testid="voice-detail-not-found"
      >
        Session nicht gefunden oder für diesen Mandanten nicht sichtbar.
      </div>
    );
  }

  const { session, toolRequests, executionsByRequestId, evidence } = detail;

  return (
    <div className="space-y-8" data-testid="voice-detail">
      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-titanium-500 mb-3">
          Session
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Meta label="id" value={session.id} />
          <Meta label="bot_id" value={session.bot_id} />
          <Meta label="provider" value={session.provider} />
          <Meta label="model" value={session.model} />
          <Meta label="status" value={session.status} />
          <Meta label="kill_switch" value={session.kill_switch ? 'true' : 'false'} />
          <Meta label="disclosure_played_at" value={formatTs(session.disclosure_played_at)} />
          <Meta label="started_at" value={formatTs(session.started_at)} />
          <Meta label="ended_at" value={formatTs(session.ended_at)} />
        </div>
      </section>

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-titanium-500 mb-3">
          Tool-Requests · Policy
        </h2>
        {toolRequests.length === 0 ? (
          <p className="text-xs text-titanium-500" data-testid="voice-tools-empty">
            Keine Tool-Requests für diese Session.
          </p>
        ) : (
          <ul className="space-y-2">
            {toolRequests.map((req) => (
              <ToolRequestBlock
                key={req.id}
                req={req}
                execution={executionsByRequestId[req.id]}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-wide text-titanium-500 mb-3">
          Evidenz-Kette
        </h2>
        <EvidenceList rows={evidence} />
      </section>
    </div>
  );
}

export function VoiceSessionDetailView({ sessionId }: { sessionId: string }) {
  const { activeTenantId, loading: tenantLoading } = useTenant();

  return (
    <div className="min-h-full bg-obsidian-950 text-titanium-100" data-testid="voice-session-detail">
      <header className="border-b border-titanium-900 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            to="/app/voice"
            className="p-1.5 border border-titanium-900 text-titanium-400 hover:text-titanium-200 hover:border-titanium-700"
            aria-label="Zurück zur Session-Liste"
            data-testid="voice-detail-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="h-8 w-8 flex items-center justify-center bg-security-600">
            <Mic className="h-4 w-4 text-white" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight text-titanium-50">Voice-Session</h1>
            <p className="font-mono text-[11px] text-titanium-500 truncate">{sessionId}</p>
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
            data-testid="voice-detail-no-tenant"
          >
            Kein aktiver Mandant. Detail wird nicht geladen.
          </div>
        ) : (
          <DetailBody tenantId={activeTenantId} sessionId={sessionId} />
        )}
      </main>
    </div>
  );
}
