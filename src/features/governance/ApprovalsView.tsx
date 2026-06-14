import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Gavel, AlertTriangle, Loader2, Check, X,
  ShieldCheck, Bot, Clock,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  listApprovals, approveApproval, rejectApproval,
  type Approval, type ApprovalStatus,
} from './approvalsApi';
import type { GovernanceRiskLevel } from './types';

/**
 * /governance/approvals — pending-approval queue for events that
 * the policy engine stamped as require_approval. Each row links
 * back to the event detail; resolution adds an evidence row.
 */
export function ApprovalsView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

const FILTERS: Array<{ key: ApprovalStatus; label: string }> = [
  { key: 'pending',  label: 'Offen' },
  { key: 'approved', label: 'Genehmigt' },
  { key: 'rejected', label: 'Abgelehnt' },
  { key: 'expired',  label: 'Abgelaufen' },
];

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [filter, setFilter] = useState<ApprovalStatus>('pending');
  const [items, setItems] = useState<Approval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<Approval | null>(null);

  const reload = async () => {
    if (!activeTenantId) { setItems([]); return; }
    setError(null); setItems(null);
    const r = await listApprovals(activeTenantId, filter);
    if (!r.ok) setError(r.error?.message ?? 'Laden fehlgeschlagen');
    else       setItems(r.approvals ?? []);
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [activeTenantId, filter]);

  const approve = async (a: Approval) => {
    setBusy(a.id);
    const r = await approveApproval(a.id);
    setBusy(null);
    if (!r.ok) { setError(r.error?.message ?? 'Genehmigen fehlgeschlagen'); return; }
    void reload();
  };

  const reject = async (a: Approval, reason: string) => {
    setBusy(a.id);
    const r = await rejectApproval(a.id, reason);
    setBusy(null);
    if (!r.ok) { setError(r.error?.message ?? 'Ablehnen fehlgeschlagen'); return; }
    setReasonModal(null);
    void reload();
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/websites" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <Gavel className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Approvals</div>
              <div className="text-[11px] text-titanium-400 font-medium">Events mit require_approval</div>
            </div>
          </div>
        </div>
        {tenants.length > 1 && (
          <select
            value={activeTenantId ?? ''}
            onChange={(e) => setActiveTenant(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
          >
            {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
          </select>
        )}
      </header>

      <div className="border-b border-titanium-900 bg-obsidian-900/50 px-4 py-2 flex items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Wähle einen Tenant aus.</div>
        ) : items === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade…
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Gavel className="h-8 w-8 mx-auto text-titanium-600 mb-3" />
            <p className="text-sm text-titanium-400">
              {filter === 'pending'
                ? 'Keine offenen Approvals. Schick es.'
                : `Keine Einträge im Status "${filter}".`}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((a) => (
              <Row
                key={a.id}
                approval={a}
                busy={busy === a.id}
                showActions={filter === 'pending'}
                onApprove={() => approve(a)}
                onReject={() => setReasonModal(a)}
              />
            ))}
          </ul>
        )}
      </main>

      {reasonModal && (
        <RejectModal
          approval={reasonModal}
          onClose={() => setReasonModal(null)}
          onSubmit={(reason) => reject(reasonModal, reason)}
          busy={busy === reasonModal.id}
        />
      )}
    </div>
  );
}

function Row({
  approval, busy, showActions, onApprove, onReject,
}: {
  approval: Approval;
  busy: boolean;
  showActions: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const ev = approval.event;
  const policy = approval.policy;
  const asset = approval.asset;
  const ageHours = Math.round((Date.now() - new Date(approval.created_at).getTime()) / 3_600_000);

  return (
    <li className="border border-titanium-900 bg-obsidian-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/governance/events/${approval.event_id}`} className="block">
            <div className="text-titanium-50 font-semibold text-base hover:text-amber-200 transition-colors">
              {ev?.title ?? '(event title unavailable)'}
            </div>
          </Link>
          {ev?.summary && (
            <p className="text-[13px] text-titanium-300 mt-1 leading-relaxed">{ev.summary}</p>
          )}
          <div className="mt-2 text-[11px] font-mono uppercase tracking-wider text-titanium-400 flex flex-wrap gap-x-3 gap-y-1">
            <span>type · {ev?.event_type}</span>
            <span>source · {ev?.event_source}</span>
            {ev?.vendor      && <span>vendor · {ev.vendor}</span>}
            {ev?.model_name  && <span>model · {ev.model_name}</span>}
            <span className="text-titanium-500">vor {ageHours} Std.</span>
          </div>
        </div>
        {ev && <RiskBadge level={ev.risk_level} />}
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {policy && (
          <RefBox icon={<ShieldCheck className="h-3.5 w-3.5" />} title="Policy" body={policy.name} meta={`${policy.policy_type} · ${policy.severity}`} />
        )}
        {asset && (
          <RefBox icon={<Bot className="h-3.5 w-3.5" />} title="Asset" body={asset.name} meta={`${asset.asset_type} · ${asset.ai_act_class}`} link={`/governance/assets/${asset.id}`} />
        )}
      </div>

      {approval.status !== 'pending' && (
        <div className="mt-3 border-t border-titanium-900 pt-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-titanium-400">
          <Clock className="h-3 w-3" />
          {approval.status} · {approval.resolved_at && new Date(approval.resolved_at).toLocaleString('de-DE')}
          {approval.resolution_reason && (
            <span className="normal-case font-sans text-titanium-300 ml-2">„{approval.resolution_reason}"</span>
          )}
        </div>
      )}

      {showActions && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={onReject}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-900 text-red-300 hover:bg-red-950/40 text-sm font-semibold rounded-none disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Ablehnen
          </button>
          <button
            onClick={onApprove}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" /> {busy ? '…' : 'Genehmigen'}
          </button>
        </div>
      )}
    </li>
  );
}

function RefBox({
  icon, title, body, meta, link,
}: {
  icon: React.ReactNode; title: string; body: string; meta: string; link?: string;
}) {
  const inner = (
    <div className="border border-titanium-900 bg-obsidian-950/60 p-2.5">
      <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 flex items-center gap-1">
        {icon}{title}
      </div>
      <div className="text-titanium-100 text-sm font-semibold mt-0.5 truncate">{body}</div>
      <div className="text-[11px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5 truncate">{meta}</div>
    </div>
  );
  return link ? <Link to={link} className="block hover:opacity-80 transition-opacity">{inner}</Link> : inner;
}

function RejectModal({
  approval, onClose, onSubmit, busy,
}: {
  approval: Approval; onClose: () => void; onSubmit: (reason: string) => void; busy: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-titanium-900">
          <h2 className="font-display font-bold text-titanium-50">Approval ablehnen</h2>
          <button onClick={onClose} className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-[13px] text-titanium-300">
            Event: <strong className="text-titanium-100">{approval.event?.title ?? approval.event_id}</strong>
          </p>
          <label className="block">
            <span className="block text-[10px] font-mono uppercase tracking-wider text-titanium-400 mb-1">
              Begründung (Pflicht, landet in der Evidence)
            </span>
            <textarea
              rows={4}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              autoFocus
              className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none focus:border-amber-500"
              placeholder="z. B. „DPIA fehlt, ohne RTBF-Klausel nicht freigeben."
            />
          </label>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm font-semibold text-titanium-300 hover:bg-obsidian-800 rounded-none">
              Abbrechen
            </button>
            <button
              onClick={() => onSubmit(reason.trim())}
              disabled={busy || !reason.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-red-900 text-red-300 hover:bg-red-950/40 text-sm font-semibold rounded-none disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> {busy ? '…' : 'Ablehnen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: GovernanceRiskLevel }) {
  const cls =
    level === 'critical' ? 'text-red-300 border-red-500/60 bg-red-500/10' :
    level === 'high'     ? 'text-amber-300 border-amber-500/60 bg-amber-500/10' :
    level === 'medium'   ? 'text-yellow-200 border-yellow-500/50 bg-yellow-500/10' :
    level === 'low'      ? 'text-sky-300 border-sky-500/50 bg-sky-500/10' :
                           'text-titanium-300 border-titanium-700 bg-titanium-800/30';
  return (
    <span className={`shrink-0 border px-2 py-1 text-[10px] font-mono uppercase tracking-wider ${cls}`}>
      {level}
    </span>
  );
}
