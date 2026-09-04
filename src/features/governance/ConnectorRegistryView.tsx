import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plug, AlertTriangle, Loader2, Plus, Trash2, ShieldCheck, ShieldOff,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';
import {
  ENFORCEMENT_CLASSES, SYSTEM_CLASSIFICATIONS,
  enforcementReasonOf, systemLabelOf,
  type EnforcementClass,
} from '../../../shared/enforcement-classes';
import {
  createConnector, deleteConnector, enforcementSummary, listConnectors,
  type ConnectorRegistryEntry, type EnforcementSummaryRow,
} from './gatesApi';

/**
 * /app/governance/connectors — Anbindungen und was sie wirklich können (P2-1).
 *
 * Die Seite beantwortet die Frage, die ein Prüfer als erste stellt: „Bei
 * welchen dieser Systeme können Sie eine Aktion tatsächlich verhindern?"
 *
 * Deshalb steht die Durchsetzbarkeits-Klasse nicht als Fußnote, sondern als
 * erstes Merkmal an jeder Zeile — samt Begründung. Ein Kunde soll nicht
 * glauben können, C sei A. Die Klasse kommt aus dem Datenbank-Trigger; die
 * Oberfläche zeigt sie an, sie bestimmt sie nicht.
 */
function _ConnectorRegistryView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const ConnectorRegistryView = withPerformanceMonitoring(
  _ConnectorRegistryView,
  'ConnectorRegistryView',
  { threshold: 500, maxRenders: 10 }
);

/** Farbgebung aus dem vorhandenen Token-Set: blockierfähig = Emerald, sonst Amber. */
function classTone(k: EnforcementClass): string {
  return ENFORCEMENT_CLASSES[k].kannBlockieren
    ? 'border-emerald-700 text-emerald-300'
    : 'border-amber-700 text-amber-300';
}

function ClassBadge({ klasse }: { klasse: EnforcementClass }) {
  const def = ENFORCEMENT_CLASSES[klasse];
  return (
    <span
      title={`${def.titel} — ${def.bedeutung}`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 border ${classTone(klasse)} rounded-none font-mono text-[10px] uppercase tracking-wider shrink-0`}
    >
      {def.kannBlockieren ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
      {klasse}
    </span>
  );
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [rows, setRows] = useState<ConnectorRegistryEntry[] | null>(null);
  const [summary, setSummary] = useState<EnforcementSummaryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ system_type: 'microsoft365', display_name: '', scope: '' });

  const reload = useCallback(async () => {
    if (!activeTenantId) { setRows([]); setSummary([]); return; }
    setError(null); setRows(null);
    const [list, sum] = await Promise.all([
      listConnectors(activeTenantId),
      enforcementSummary(activeTenantId),
    ]);
    setRows(list);
    setSummary(sum);
  }, [activeTenantId]);

  useEffect(() => { void reload(); }, [reload]);

  async function onAdd() {
    if (!activeTenantId || !form.display_name.trim()) return;
    setBusy(true); setError(null);
    const res = await createConnector(activeTenantId, {
      system_type: form.system_type,
      display_name: form.display_name.trim(),
      scope: form.scope.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? 'Anlegen fehlgeschlagen'); return; }
    setForm({ system_type: 'microsoft365', display_name: '', scope: '' });
    setAdding(false);
    void reload();
  }

  async function onDelete(id: string) {
    setBusy(true); setError(null);
    const res = await deleteConnector(id);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? 'Löschen fehlgeschlagen'); return; }
    void reload();
  }

  const blockierbar = summary.filter((s) => s.kann_blockieren).reduce((n, s) => n + Number(s.anzahl), 0);
  const gesamt = summary.reduce((n, s) => n + Number(s.anzahl), 0);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-sm">
              <Plug className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Anbindungen</div>
              <div className="text-[11px] text-titanium-400 font-medium">Was an jedem System wirklich durchsetzbar ist</div>
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Wähle einen Tenant aus.</div>
        ) : (
          <>
            {/* ── Was heißt das überhaupt ── */}
            <section className="border border-titanium-900 bg-obsidian-900/60 p-3 mb-4">
              <div className="text-[12px] font-mono uppercase tracking-wider text-titanium-300 mb-2">
                Durchsetzbarkeit
              </div>
              <p className="text-[11px] text-titanium-400 mb-3 max-w-2xl">
                {gesamt === 0
                  ? 'Noch keine Anbindung erfasst. Die Klasse wird beim Anlegen aus dem Systemtyp abgeleitet — sie lässt sich nicht eintragen.'
                  : <>Von {gesamt} erfassten Anbindungen {blockierbar === 0 ? 'kann derzeit ' : 'können '}
                    <span className={blockierbar === 0 ? 'text-amber-300' : 'text-emerald-300'}>{blockierbar}</span>
                    {' '}eine Aktion tatsächlich verhindern. Bei den übrigen wird sie festgestellt, belegt und
                    eskaliert — nicht aufgehalten.</>}
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {(['A', 'B', 'C', 'D'] as EnforcementClass[]).map((k) => {
                  const def = ENFORCEMENT_CLASSES[k];
                  const row = summary.find((s) => s.enforcement_class === k);
                  return (
                    <div key={k} className="flex items-start gap-2 border border-titanium-900/70 p-2">
                      <ClassBadge klasse={k} />
                      <div className="min-w-0 text-[11px]">
                        <div className="text-titanium-200 font-semibold">{def.titel}</div>
                        <div className="text-titanium-500 mt-0.5">{def.bedeutung}</div>
                        {row && (
                          <div className="text-titanium-600 mt-1 font-mono">
                            {Number(row.anzahl)} erfasst · {Number(row.verbunden)} verbunden
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── Die Anbindungen ── */}
            <section className="border border-titanium-900 bg-obsidian-900/60 p-3">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="text-[12px] font-mono uppercase tracking-wider text-titanium-300">
                  Erfasste Anbindungen
                </div>
                <button
                  onClick={() => setAdding((v) => !v)}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors disabled:opacity-50 shrink-0"
                >
                  <Plus className="h-4 w-4" /> Anbindung erfassen
                </button>
              </div>

              {adding && (
                <div className="border border-titanium-900/70 p-2 mb-3 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">System</span>
                      <select
                        value={form.system_type}
                        onChange={(e) => setForm({ ...form, system_type: e.target.value })}
                        className="w-full mt-1 bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none"
                      >
                        {SYSTEM_CLASSIFICATIONS.map((s) => (
                          <option key={s.systemType} value={s.systemType}>
                            {s.label} — Klasse {s.klasse}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Bezeichnung</span>
                      <input
                        value={form.display_name}
                        onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                        placeholder="z. B. Microsoft 365 — Hauptmandant"
                        className="w-full mt-1 bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none placeholder:text-titanium-700"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Umfang</span>
                    <input
                      value={form.scope}
                      onChange={(e) => setForm({ ...form, scope: e.target.value })}
                      placeholder="in eigenen Worten, z. B. „Postfach und Kalender aller Standorte“"
                      className="w-full mt-1 bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none placeholder:text-titanium-700"
                    />
                  </label>
                  <p className="text-[10px] text-titanium-500">
                    {enforcementReasonOf(form.system_type)}
                  </p>
                  <button
                    onClick={onAdd}
                    disabled={busy || !form.display_name.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-xs font-semibold rounded-none transition-colors disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Anlegen
                  </button>
                </div>
              )}

              {rows === null ? (
                <div className="flex items-center gap-2 text-titanium-500 text-sm py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" /> Lade Anbindungen…
                </div>
              ) : rows.length === 0 ? (
                <p className="text-[11px] text-titanium-500">
                  Noch nichts erfasst. Solange eine Anbindung hier fehlt, taucht sie in keinem
                  Prüfbericht auf — auch wenn sie technisch längst besteht.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {rows.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3 border border-titanium-900/70 p-2">
                      <div className="min-w-0 text-[11px] flex items-start gap-2">
                        <ClassBadge klasse={c.enforcement_class} />
                        <div className="min-w-0">
                          <span className="text-titanium-200 font-semibold">{c.display_name}</span>
                          <span className="text-titanium-600"> · {systemLabelOf(c.system_type)}</span>
                          <span className="text-titanium-600"> · {c.status}</span>
                          <div className="text-titanium-500 mt-0.5">{enforcementReasonOf(c.system_type)}</div>
                          {c.scope && <div className="text-titanium-600 mt-0.5">Umfang: {c.scope}</div>}
                          {c.last_error && <div className="text-red-300 mt-0.5">Letzter Fehler: {c.last_error}</div>}
                        </div>
                      </div>
                      <button
                        onClick={() => onDelete(c.id)}
                        disabled={busy}
                        title="Aus der Registratur entfernen"
                        className="p-1 border border-titanium-900 hover:border-red-500 text-titanium-500 hover:text-red-300 rounded-none transition-colors disabled:opacity-50 shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
