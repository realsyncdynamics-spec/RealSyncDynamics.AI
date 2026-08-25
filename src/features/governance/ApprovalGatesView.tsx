import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Gavel, AlertTriangle, Loader2, Check, X,
  Building2, Users, ShieldCheck, Clock,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';
import {
  approveGate, listGates, loadAccessModel, rejectGate,
  type AccessModel, type ApprovalGate, type GateStatus,
} from './gatesApi';

/**
 * /app/governance/gates — Freigaben des Policy Decision Point.
 *
 * Der PDP hält Aktionen an, wenn eine Policy `require_approval` entscheidet.
 * Freigeben darf owner/admin oder wer die im Gate hinterlegte Rolle hält —
 * der CEO muss nicht jede Aktion freigeben.
 *
 * Darunter das Zugriffsmodell (Organisationseinheiten, Principals, Rollen),
 * damit sichtbar ist, WER überhaupt freigeben kann.
 */
function _ApprovalGatesView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const ApprovalGatesView = withPerformanceMonitoring(
  _ApprovalGatesView,
  'ApprovalGatesView',
  { threshold: 500, maxRenders: 10 }
);

const STATUS_LABEL: Record<GateStatus, string> = {
  pending: 'Offen',
  approved: 'Freigegeben',
  rejected: 'Abgelehnt',
  expired: 'Abgelaufen',
};

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [status, setStatus] = useState<GateStatus>('pending');
  const [gates, setGates] = useState<ApprovalGate[] | null>(null);
  const [access, setAccess] = useState<AccessModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!activeTenantId) { setGates([]); setAccess(null); return; }
    setError(null); setGates(null);
    const [res, model] = await Promise.all([
      listGates(activeTenantId, status),
      loadAccessModel(activeTenantId),
    ]);
    if (!res.ok) { setError(res.error?.message ?? 'Freigaben konnten nicht geladen werden'); setGates([]); }
    else setGates(res.gates ?? []);
    setAccess(model);
  }, [activeTenantId, status]);

  useEffect(() => { void reload(); }, [reload]);

  async function resolve(gate: ApprovalGate, target: 'approve' | 'reject') {
    let reason: string | null = null;
    if (target === 'reject') {
      reason = window.prompt('Begründung für die Ablehnung (verpflichtend):');
      if (!reason?.trim()) return;
    } else {
      reason = window.prompt('Notiz zur Freigabe (optional):');
    }
    setBusyId(gate.id); setError(null);
    const res = target === 'approve'
      ? await approveGate(gate.id, reason ?? undefined)
      : await rejectGate(gate.id, reason!);
    setBusyId(null);
    if (!res.ok) { setError(res.error?.message ?? 'Aktion fehlgeschlagen'); return; }
    void reload();
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-sm">
              <Gavel className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Freigaben (Policy Decision Point)</div>
              <div className="text-[11px] text-titanium-400 font-medium">Angehaltene Aktionen freigeben oder ablehnen</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as GateStatus)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800"
          >
            {(Object.keys(STATUS_LABEL) as GateStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          {tenants.length > 1 && (
            <select
              value={activeTenantId ?? ''}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
            >
              {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
            </select>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Wähle einen Tenant aus.</div>
        ) : gates === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Freigaben…
          </div>
        ) : gates.length === 0 ? (
          <div className="text-center py-16">
            <ShieldCheck className="h-8 w-8 mx-auto text-titanium-600 mb-3" />
            <p className="text-sm text-titanium-400">
              {status === 'pending'
                ? 'Keine offenen Freigaben — der Policy Decision Point hält aktuell nichts an.'
                : `Keine Einträge mit Status „${STATUS_LABEL[status]}".`}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {gates.map((g) => (
              <GateRow
                key={g.id}
                gate={g}
                busy={busyId === g.id}
                onResolve={status === 'pending' ? resolve : undefined}
              />
            ))}
          </ul>
        )}

        {activeTenantId && <AccessModelPanel model={access} />}
      </main>
    </div>
  );
}

function GateRow({ gate, busy, onResolve }: {
  gate: ApprovalGate;
  busy: boolean;
  onResolve?: (g: ApprovalGate, t: 'approve' | 'reject') => void;
}) {
  const s = gate.request_summary ?? {};
  const expired = new Date(gate.expires_at).getTime() <= Date.now();
  return (
    <li className="border border-titanium-900 bg-obsidian-900/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-wider text-titanium-300">
            <span className="font-bold text-titanium-50">{s.verb ?? 'aktion'}</span>
            <span className="text-titanium-500">·</span>
            <span>{s.channel ?? 'unbekannter Kanal'}</span>
          </div>
          <div className="text-[11px] text-titanium-400 mt-1 flex flex-wrap items-center gap-1.5">
            {s.vendor && <><span className="font-mono">{s.vendor}{s.model ? ` / ${s.model}` : ''}</span><span className="text-titanium-600">·</span></>}
            {s.classification && <><span className="font-mono">{s.classification}</span><span className="text-titanium-600">·</span></>}
            <span>Freigabe durch Rolle <span className="font-mono text-titanium-200">{gate.approver_role}</span></span>
          </div>
          <div className="text-[11px] text-titanium-500 mt-0.5 flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>angefragt {new Date(gate.created_at).toLocaleString('de-DE')}</span>
            <span className="text-titanium-600">·</span>
            <span className={expired ? 'text-amber-300' : ''}>
              {expired ? 'abgelaufen' : `gültig bis ${new Date(gate.expires_at).toLocaleString('de-DE')}`}
            </span>
          </div>
          {gate.resolution_reason && (
            <div className="text-[11px] text-titanium-400 mt-1">Begründung: {gate.resolution_reason}</div>
          )}
        </div>
        {onResolve && !expired && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onResolve(gate, 'approve')}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Freigeben
            </button>
            <button
              onClick={() => onResolve(gate, 'reject')}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-red-500 text-titanium-200 hover:text-red-200 text-sm font-semibold rounded-none transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" /> Ablehnen
            </button>
          </div>
        )}
      </div>
      <div className="text-[11px] font-mono text-titanium-600 mt-2">fingerprint: {gate.fingerprint}</div>
    </li>
  );
}

/**
 * Zugriffsmodell aus P1-1. Lesend: Struktur und Rollen ändern owner/admin
 * heute per Migration bzw. direkt über die Tabellen — eine Pflege-Oberfläche
 * dafür ist bewusst noch nicht Teil dieser Stufe.
 */
function AccessModelPanel({ model }: { model: AccessModel | null }) {
  if (!model) return null;
  const roleOf = (principalId: string) =>
    model.bindings.filter((b) => b.principal_id === principalId).map((b) => b.role);

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-sm font-display font-bold tracking-tight text-titanium-50 mb-3">
        <ShieldCheck className="h-4 w-4" /> Zugriffsmodell
      </h2>
      {model.error && (
        <div className="mb-3 text-[11px] text-amber-300">{model.error}</div>
      )}
      {model.units.length === 0 && model.principals.length === 0 ? (
        <p className="text-[12px] text-titanium-500">
          Noch keine Organisationseinheiten oder Principals angelegt. Bis dahin greifen
          Policies tenantweit; Freigaben dürfen owner und admin erteilen.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border border-titanium-900 bg-obsidian-900/60 p-3">
            <div className="flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-wider text-titanium-300 mb-2">
              <Building2 className="h-3.5 w-3.5" /> Einheiten ({model.units.length})
            </div>
            <ul className="space-y-1">
              {model.units.map((u) => (
                <li key={u.id} className="text-[11px] text-titanium-400 font-mono">
                  <span style={{ paddingLeft: `${Math.max(0, u.org_path.split('/').filter(Boolean).length - 1) * 12}px` }}>
                    {u.name} <span className="text-titanium-600">· {u.kind}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-titanium-900 bg-obsidian-900/60 p-3">
            <div className="flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-wider text-titanium-300 mb-2">
              <Users className="h-3.5 w-3.5" /> Principals ({model.principals.length})
            </div>
            <ul className="space-y-1">
              {model.principals.map((p) => {
                const roles = roleOf(p.id);
                return (
                  <li key={p.id} className="text-[11px] text-titanium-400">
                    <span className="font-mono text-titanium-200">{p.display_name}</span>
                    <span className="text-titanium-600"> · {p.type}</span>
                    {p.status === 'disabled' && <span className="text-amber-300"> · deaktiviert</span>}
                    {roles.length > 0 && (
                      <span className="text-titanium-500 font-mono"> · {roles.join(', ')}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
