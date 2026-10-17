import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, LockKeyhole, X } from 'lucide-react';
import type { PendingApproval } from './useBrowserRuntime';
import { describeRedacted } from './runtimeText';

// Freigabe-Status (governance_approvals) plus 'consumed': eingelöst laut
// browser_executions (#1728) — z. B. in einem anderen Tab. Ausgeführt/
// fehlgeschlagen ist kein Freigabe-Status mehr.
const STATUS_TEXT: Record<string, string> = {
  pending: 'wartet auf Freigabe',
  approved: 'freigegeben — noch nicht ausgeführt',
  rejected: 'abgelehnt',
  expired: 'abgelaufen',
  cancelled: 'zurückgezogen',
  consumed: 'bereits eingelöst — nicht erneut ausführbar',
};

function remaining(expiresAt: string, now: number): string {
  const ms = Date.parse(expiresAt) - now;
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return 'abgelaufen';
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}:${String(s).padStart(2, '0')} min`;
}

function redactedView(action: PendingApproval['action']): Record<string, unknown> {
  if (action.type === 'type') return { ...action, text: `[redacted:${action.text.length} chars]` };
  return { ...action };
}

/**
 * Offene Freigabe einer Browser-Aktion. Entscheiden können nur owner/admin
 * (serverseitig in governance-approvals geprüft); ausführen kann nach der
 * Freigabe nur, wer die Session steuert — der Server verbraucht die Freigabe
 * genau einmal und prüft Session, Seite und Aktion erneut.
 */
export function ApprovalCard({
  approval,
  canDecide,
  busy,
  onApprove,
  onReject,
  onExecute,
  onCancel,
}: {
  approval: PendingApproval;
  canDecide: boolean;
  busy: boolean;
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onExecute: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const pending = approval.status === 'pending';
  const approved = approval.status === 'approved';

  return (
    <div className="mt-3 border border-amber-900 bg-amber-950/10 p-3" data-testid="browser-approval-card" data-approval-status={approval.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-200">
          <LockKeyhole className="h-3.5 w-3.5" /> Freigabe · {STATUS_TEXT[approval.status] ?? approval.status}
        </div>
        {(pending || approved) && approval.expiresAt && (
          <div className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-300">
            <Clock className="h-3 w-3" /> {remaining(approval.expiresAt, now)}
          </div>
        )}
      </div>
      <p className="mt-2 break-words text-xs text-titanium-200">{describeRedacted(redactedView(approval.action))}</p>
      <p className="mt-1 text-[10px] text-titanium-500">
        Einmalig gültig, gebunden an diese Session und die aktuell geöffnete Seite.
        {(pending || approved) && ' Die Aktion wurde noch nicht ausgeführt.'}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pending && canDecide && !rejecting && (
          <>
            <button type="button" disabled={busy} onClick={() => void onApprove()} className="inline-flex items-center gap-1 bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-obsidian-950 disabled:opacity-45">
              <Check className="h-3.5 w-3.5" /> Freigeben
            </button>
            <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="inline-flex items-center gap-1 border border-red-900 px-3 py-1.5 text-xs text-red-300 disabled:opacity-45">
              <X className="h-3.5 w-3.5" /> Ablehnen
            </button>
          </>
        )}
        {pending && !canDecide && (
          <span className="text-[11px] text-titanium-400">Freigeben können Owner und Admins dieses Workspaces.</span>
        )}
        {approved && (
          <button type="button" disabled={busy} onClick={() => void onExecute()} className="inline-flex items-center gap-1 bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-obsidian-950 disabled:opacity-45" data-testid="execute-approved-action">
            Freigegebene Aktion ausführen
          </button>
        )}
        {(pending || approved) && (
          // Zurückziehen bis zur Einlösung — auch eine erteilte, unbenutzte Freigabe.
          <button type="button" disabled={busy} onClick={() => void onCancel()} className="border border-titanium-800 px-3 py-1.5 text-xs text-titanium-300 disabled:opacity-45" data-testid="withdraw-approval">
            Zurückziehen
          </button>
        )}
        <Link to="/app/approvals" className="border border-amber-800 px-3 py-1.5 text-xs text-amber-200">Approval-Queue</Link>
      </div>

      {rejecting && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => { e.preventDefault(); if (reason.trim()) void onReject(reason.trim()).then(() => setRejecting(false)); }}
        >
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
            placeholder="Begründung (Pflicht, landet in der Evidence)"
            className="min-w-0 flex-1 border border-titanium-700 bg-obsidian-950 px-2 py-1.5 text-xs text-titanium-100"
            aria-label="Begründung der Ablehnung"
          />
          <button type="submit" disabled={busy || !reason.trim()} className="border border-red-900 px-3 py-1.5 text-xs text-red-300 disabled:opacity-45">Ablehnen</button>
          <button type="button" onClick={() => setRejecting(false)} className="px-3 py-1.5 text-xs text-titanium-400">Abbrechen</button>
        </form>
      )}
    </div>
  );
}
