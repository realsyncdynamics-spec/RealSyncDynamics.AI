/**
 * Chief-of-Staff work overview. Deliberately read-only: no auto-approval,
 * task dispatch, external notification or background polling.
 *
 * Access protection: authenticated owner/admin in chiefOfStaffApi plus
 * Postgres RLS; the active tenant determines query scope.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useOptionalTenant } from '../../core/access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  loadPersistedChiefOfStaffInbox,
  type PersistedChiefOfStaffInbox,
} from './chiefOfStaffApi';

interface InboxState {
  tenantId: string | null;
  loading: boolean;
  data: PersistedChiefOfStaffInbox | null;
  error: string | null;
}

function readableError(err: unknown): string {
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
  if (code === 'forbidden') return 'Nur Owner oder Admin dürfen diesen Arbeitsüberblick lesen.';
  if (code === 'unauthorized') return 'Keine gültige Anmeldung. Bitte erneut anmelden.';
  if (code === 'invalid_tenant') return 'Ungültiger Mandant.';
  return 'Datenquelle nicht verfügbar. Es werden keine Nullwerte angenommen.';
}

const KIND_LABEL = {
  critical_observation: 'Sicherheits-/Betriebsbeobachtung',
  pending_decision: 'Menschliche Entscheidung erforderlich',
  blocked_task: 'Blockierte Aufgabe',
  failed_task: 'Fehlgeschlagene Aufgabe',
} as const;

const PRIORITY_CLASS = {
  critical: 'text-rose-300 border-rose-700/50',
  high: 'text-amber-300 border-amber-700/50',
  normal: 'text-zinc-300 border-zinc-700',
} as const;

export function ChiefOfStaffPanel() {
  const tenantContext = useOptionalTenant();
  const activeTenantId = tenantContext?.activeTenantId ?? null;
  const tenantOptions = tenantContext?.tenants ?? [];
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<InboxState>({
    tenantId: null, loading: false, data: null, error: null,
  });

  useEffect(() => {
    if (!activeTenantId) {
      setState({ tenantId: null, loading: false, data: null, error: 'Kein Mandant ausgewählt.' });
      return;
    }
    if (!isSupabaseConfigured()) {
      setState({ tenantId: activeTenantId, loading: false, data: null, error: 'Supabase nicht konfiguriert.' });
      return;
    }
    let cancelled = false;
    setState({ tenantId: activeTenantId, loading: true, data: null, error: null });
    void loadPersistedChiefOfStaffInbox(getSupabase(), activeTenantId, { max_items: 20 })
      .then((data) => {
        if (!cancelled) setState({ tenantId: activeTenantId, loading: false, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ tenantId: activeTenantId, loading: false, data: null, error: readableError(err) });
      });
    return () => { cancelled = true; };
  }, [activeTenantId, reloadKey]);

  // Synchronous tenant-change gate: never render a previous tenant's data
  // during React's first render before the effect has cleaned it up.
  const visible = state.tenantId === activeTenantId ? state : {
    tenantId: activeTenantId, loading: true, data: null, error: null,
  };

  return (
    <section data-testid="chief-of-staff-panel" aria-label="Arbeitsüberblick" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Arbeitsüberblick</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Nur Lesemodus · offene Freigaben, Blocker und kritische Meldungen aus dem Agent OS.
            Keine eigenständigen Agentenaktionen oder Freigaben.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {tenantOptions.length > 1 && tenantContext?.setActiveTenant && (
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Mandant wählen
              <select aria-label="Mandant wählen" value={activeTenantId ?? ''}
                onChange={(event) => {
                  const id = event.target.value;
                  if (tenantOptions.some((tenant) => tenant.tenantId === id)) {
                    tenantContext.setActiveTenant(id);
                  }
                }}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100">
                {tenantOptions.map((tenant) => (
                  <option key={tenant.tenantId} value={tenant.tenantId}>{tenant.name}</option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={() => setReloadKey(x => x + 1)}
            disabled={!activeTenantId || visible.loading}
            className="inline-flex items-center gap-2 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Aktualisieren
          </button>
        </div>
      </div>

      {visible.loading && <p role="status" className="text-sm text-zinc-400">Arbeitsüberblick wird geladen …</p>}
      {!visible.loading && visible.error && (
        <p role="alert" className="rounded-md border border-amber-700/50 bg-amber-900/20 p-3 text-sm text-amber-200">
          {visible.error}
        </p>
      )}
      {!visible.loading && visible.data && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {([
              ['Offene Aufgaben', visible.data.counts.open_tasks],
              ['In Bearbeitung', visible.data.counts.in_progress_tasks],
              ['Blockiert', visible.data.counts.blocked_tasks],
              ['Fehlgeschlagen', visible.data.counts.failed_tasks],
              ['Freigaben offen', visible.data.counts.pending_decisions],
              ['Hohe/kritische Meldungen', visible.data.counts.unacknowledged_high_alerts],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <dt className="text-xs text-zinc-400">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-zinc-100">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-zinc-100">Benötigt Aufmerksamkeit ({visible.data.counts.attention_total})</h2>
            {visible.data.truncated && <span className="text-xs text-amber-300">Liste gekürzt</span>}
          </div>
          {visible.data.items.length === 0 ? (
            <p className="text-sm text-zinc-400">Keine priorisierten Einträge in den abgefragten Tabellen.</p>
          ) : (
            <ol className="space-y-2">
              {visible.data.items.map(item => (
                <li key={item.kind + ':' + item.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded border px-2 py-0.5 font-medium ${PRIORITY_CLASS[item.priority]}`}>{item.priority.toUpperCase()}</span>
                    <span className="text-zinc-400">{KIND_LABEL[item.kind]}</span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-100">{item.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {item.agent} · {new Date(item.created_at).toLocaleString('de-DE')}
                  </p>
                </li>
              ))}
            </ol>
          )}

          <p className="text-xs text-zinc-500">
            Quelle: agent_tasks · agent_decisions · agent_observations · zuletzt abgefragt:
            {' '}{new Date(visible.data.fetched_at).toLocaleString('de-DE')}.
            Kein vollständiger Überblick über weitere Agenten-Subsysteme.
          </p>
        </>
      )}
      {!visible.loading && !visible.error && !visible.data && (
        <p className="flex items-center gap-2 text-sm text-zinc-400"><AlertTriangle className="h-4 w-4" aria-hidden />Keine verifizierten Daten verfügbar.</p>
      )}
    </section>
  );
}
