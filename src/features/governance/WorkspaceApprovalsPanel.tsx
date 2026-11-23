/**
 * Workspace-Freigaben (`workspace_approvals`) unter `/app/approvals?quelle=workspace`.
 *
 * Zeigt Anfragen der Google-Workspace-Flows (RSD-01 … RSD-06), die die
 * Governance mit `require_approval` gestoppt hat. Owner/Admin können offene
 * Anfragen genehmigen oder ablehnen; die Rolle prüft die Datenbank, nicht diese
 * Ansicht. Eine Genehmigung führt nichts aus, sie macht die Anfrage nur
 * einlösbar.
 *
 * Zustände: Laden · nicht eingerichtet · Fehler mit „Erneut laden“ · leer · Liste.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock, Gavel, Loader2, RotateCcw, X } from 'lucide-react';
import {
  decideWorkspaceApproval,
  isWorkspaceApprovalExpired,
  listWorkspaceApprovals,
  type WorkspaceApproval,
  type WorkspaceApprovalStatus,
} from './workspaceApprovalsApi';

const FILTERS: Array<{ key: WorkspaceApprovalStatus; label: string }> = [
  { key: 'PENDING', label: 'Offen' },
  { key: 'APPROVED', label: 'Genehmigt' },
  { key: 'EXECUTED', label: 'Ausgeführt' },
  { key: 'REJECTED', label: 'Abgelehnt' },
  { key: 'EXPIRED', label: 'Abgelaufen' },
];

const STATUS_LABEL: Record<WorkspaceApprovalStatus, string> = {
  PENDING: 'Offen',
  APPROVED: 'Genehmigt',
  EXECUTED: 'Ausgeführt',
  REJECTED: 'Abgelehnt',
  EXPIRED: 'Abgelaufen',
  CANCELLED: 'Abgebrochen',
  FAILED: 'Fehlgeschlagen',
};

type ListState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string }
  | { kind: 'value'; approvals: WorkspaceApproval[] };

function formatDate(iso: string | null): string {
  if (!iso) return '–';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('de-DE');
}

export function WorkspaceApprovalsPanel({ activeTenantId }: { activeTenantId: string | null }) {
  const [filter, setFilter] = useState<WorkspaceApprovalStatus>('PENDING');
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) {
      setState({ kind: 'value', approvals: [] });
      return;
    }
    setState({ kind: 'loading' });
    listWorkspaceApprovals(activeTenantId, filter).then((r) => {
      if (cancelled) return;
      if (r.ok) setState({ kind: 'value', approvals: r.approvals });
      else if (r.error.kind === 'unavailable') setState({ kind: 'unavailable' });
      else setState({ kind: 'error', message: r.error.message });
    });
    return () => { cancelled = true; };
  }, [activeTenantId, filter, reloadKey]);

  const decide = async (approval: WorkspaceApproval, approve: boolean) => {
    setBusyId(approval.id);
    setActionError(null);
    const r = await decideWorkspaceApproval(approval.id, approve);
    setBusyId(null);
    if (!r.ok) {
      setActionError(r.error.kind === 'unavailable' ? 'Workspace-Freigaben sind noch nicht eingerichtet.' : r.error.message);
      return;
    }
    reload();
  };

  return (
    <section aria-labelledby="workspace-approvals-heading" data-testid="workspace-approvals" data-state={state.kind}>
      <h2 id="workspace-approvals-heading" className="sr-only">Workspace-Freigaben</h2>
      <div role="group" aria-label="Status filtern" className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider border rounded-none ${
              filter === f.key
                ? 'border-amber-500 bg-amber-500/10 text-amber-200'
                : 'border-titanium-900 text-titanium-400 hover:border-titanium-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="mb-4 text-[12px] text-titanium-400">
        Genehmigen führt nichts aus. Der Flow darf die Aktion danach einmal einlösen, solange die Frist läuft.
        Entscheiden dürfen nur Owner und Admins.
      </p>

      {actionError && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
          <span>{actionError}</span>
        </div>
      )}

      <div aria-live="polite" aria-busy={state.kind === 'loading'}>
        {!activeTenantId ? (
          <p className="text-titanium-500 text-sm">Wähle einen Mandanten aus.</p>
        ) : state.kind === 'loading' ? (
          <p className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Lade …
          </p>
        ) : state.kind === 'unavailable' ? (
          <p className="text-sm text-titanium-400 py-8" data-testid="workspace-approvals-unavailable">
            Workspace-Freigaben sind für dieses Projekt noch nicht eingerichtet. Sobald Flows über
            {' '}<span className="font-mono">workspace-events</span>{' '}Freigaben anfordern, erscheinen sie hier.
          </p>
        ) : state.kind === 'error' ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-amber-300 py-4">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <span>{state.message}</span>
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center gap-1 border border-titanium-700 px-2 py-1 font-mono text-[11px] text-titanium-200 hover:bg-obsidian-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00B8D4]"
            >
              <RotateCcw className="h-3 w-3" aria-hidden /> Erneut laden
            </button>
          </div>
        ) : state.approvals.length === 0 ? (
          <div className="text-center py-16" data-testid="workspace-approvals-empty">
            <Gavel className="h-8 w-8 mx-auto text-titanium-600 mb-3" aria-hidden />
            <p className="text-sm text-titanium-400">
              {filter === 'PENDING' ? 'Keine offenen Workspace-Freigaben.' : `Keine Einträge im Status „${STATUS_LABEL[filter]}“.`}
            </p>
          </div>
        ) : (
          <ul className="space-y-3" data-testid="workspace-approvals-list">
            {state.approvals.map((a) => (
              <WorkspaceApprovalRow
                key={a.id}
                approval={a}
                busy={busyId === a.id}
                showActions={filter === 'PENDING' && a.status === 'PENDING' && !isWorkspaceApprovalExpired(a)}
                onDecide={(approve) => void decide(a, approve)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function WorkspaceApprovalRow({
  approval, busy, showActions, onDecide,
}: {
  approval: WorkspaceApproval;
  busy: boolean;
  showActions: boolean;
  onDecide: (approve: boolean) => void;
}) {
  return (
    <li className="border border-titanium-900 bg-obsidian-900/60 p-4" data-testid="workspace-approval-row">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-titanium-50 font-semibold text-base break-words">
            <span className="font-mono">{approval.action_type}</span>
          </div>
          <p className="text-[13px] text-titanium-300 mt-1 break-all">
            Ziel: <span className="font-mono">{approval.target_resource}</span>
          </p>
          <div className="mt-2 text-[11px] font-mono uppercase tracking-wider text-titanium-400 flex flex-wrap gap-x-3 gap-y-1">
            <span>Agent · {approval.agent_id}</span>
            <span>Angefragt · {formatDate(approval.requested_at)}</span>
            <span>Frist · {formatDate(approval.expires_at)}</span>
          </div>
          <p
            className="mt-1 font-mono text-[10px] text-titanium-600 break-all"
            title={`Herkunftsnachweis (SHA-256): ${approval.payload_hash}`}
          >
            Herkunftsnachweis {approval.payload_hash.slice(0, 12)}…
          </p>
        </div>
        <span className="shrink-0 border border-titanium-700 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-titanium-300">
          {approval.status === 'PENDING' && isWorkspaceApprovalExpired(approval) ? 'Abgelaufen' : STATUS_LABEL[approval.status]}
        </span>
      </div>

      {approval.decided_at && (
        <div className="mt-3 border-t border-titanium-900 pt-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-titanium-400">
          <Clock className="h-3 w-3" aria-hidden />
          Entschieden · {formatDate(approval.decided_at)}
          {approval.executed_at && <span>· Ausgeführt {formatDate(approval.executed_at)}</span>}
        </div>
      )}

      {showActions && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onDecide(false)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-900 text-red-300 hover:bg-red-950/40 text-sm font-semibold rounded-none disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Ablehnen
          </button>
          <button
            type="button"
            onClick={() => onDecide(true)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" aria-hidden /> {busy ? '…' : 'Genehmigen'}
          </button>
        </div>
      )}
    </li>
  );
}
