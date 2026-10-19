import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import {
  CONVERSION_LABELS,
  FUNNEL_FILTERS,
  PILOT_STATUS_LABELS,
  SCAN_STATUS_LABELS,
  SOURCE_LABELS,
  eraseLeadData,
  formatRate,
  loadFunnelKpis,
  loadFunnelLeads,
  type FunnelFilterId,
  type FunnelKpis,
  type FunnelLeadRow,
} from './funnelLeads';

/**
 * Lead-Trichter: Domain + E-Mail aus dem Governance-Scan, Scan-, Pilot- und
 * Conversion-Status. Daten nur über die geprüften Admin-RPCs.
 */
export function FunnelLeadsPanel() {
  const [filter, setFilter] = useState<FunnelFilterId>('all');
  const [rows, setRows] = useState<FunnelLeadRow[]>([]);
  const [kpis, setKpis] = useState<FunnelKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Löschen braucht einen zweiten Klick in der Zeile (der Viewer zeigt kein confirm()).
  const [pendingErase, setPendingErase] = useState<string | null>(null);
  const [eraseNote, setEraseNote] = useState<string | null>(null);

  async function erase(row: FunnelLeadRow) {
    setEraseNote(null);
    try {
      const r = await eraseLeadData(row.email);
      setEraseNote(
        `Gelöscht: ${r.sales_leads_deleted} Lead(s), ${r.gdpr_audits_anonymized} Scan(s) anonymisiert, ` +
        `${r.drip_rows_deleted} Mail-Serie(n) beendet. Vorgangsnummer für die Person: ${r.receipt_id}`,
      );
      setPendingErase(null);
      setReloadKey((n) => n + 1);
    } catch (e) {
      setEraseNote(`Löschen fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([loadFunnelLeads(filter), loadFunnelKpis(90)])
      .then(([r, k]) => {
        if (cancelled) return;
        setRows(r);
        setKpis(k);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter, reloadKey]);

  return (
    <section aria-labelledby="funnel-leads-title">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 id="funnel-leads-title" className="font-display font-bold text-titanium-50 text-base">
          Lead-Trichter <span className="text-xs text-titanium-500 font-mono">(Scan → Pilot → Kunde)</span>
        </h2>
        <button
          type="button"
          onClick={() => setReloadKey((n) => n + 1)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 rounded-none"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Neu laden
        </button>
      </div>

      {kpis && (
        <dl className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5" data-testid="funnel-kpis">
          <FunnelKpi label={`Leads (${kpis.window_days} T.)`} value={kpis.leads_total.toLocaleString('de-DE')} />
          <FunnelKpi label="Scan-Abschlussrate" value={formatRate(kpis.scan_completion_rate)} sub={`${kpis.scans_completed} / ${kpis.scans_started}`} />
          <FunnelKpi label="Lead → Pilot" value={formatRate(kpis.lead_to_pilot_rate)} sub={`${kpis.pilots} Piloten`} />
          <FunnelKpi label="Pilot → Kunde" value={formatRate(kpis.pilot_to_customer_rate)} sub={`${kpis.customers} Kunden`} />
          <FunnelKpi
            label="Leads je Quelle"
            value={Object.keys(kpis.leads_by_source).length.toString()}
            sub={Object.entries(kpis.leads_by_source)
              .sort((a, b) => b[1] - a[1])
              .map(([s, n]) => `${SOURCE_LABELS[s] ?? s}: ${n}`)
              .join(' · ') || '—'}
          />
        </dl>
      )}

      <div role="group" aria-label="Trichter-Filter" className="flex flex-wrap gap-2 mb-4">
        {FUNNEL_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-xs border rounded-none ${
              filter === f.id
                ? 'border-security-500 text-titanium-50 font-bold bg-obsidian-900'
                : 'border-titanium-800 text-titanium-400 hover:text-titanium-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 mb-4">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" /><span>{error}</span>
        </div>
      )}

      {eraseNote && (
        <p role="status" className="text-sm text-titanium-200 border border-titanium-800 bg-obsidian-900 p-3 mb-4">{eraseNote}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-titanium-400 text-sm py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Lade…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-titanium-500 border border-titanium-900 bg-obsidian-900 p-8 text-center">
          Keine Leads in diesem Filter.
        </p>
      ) : (
        <div className="overflow-x-auto border border-titanium-900">
          <table className="w-full text-sm" data-testid="funnel-leads-table">
            <thead className="bg-obsidian-900 text-[11px] uppercase tracking-wider text-titanium-400">
              <tr>
                <th scope="col" className="text-left px-3 py-2 font-bold">Erfasst</th>
                <th scope="col" className="text-left px-3 py-2 font-bold">Domain</th>
                <th scope="col" className="text-left px-3 py-2 font-bold">E-Mail</th>
                <th scope="col" className="text-left px-3 py-2 font-bold">Quelle</th>
                <th scope="col" className="text-left px-3 py-2 font-bold">Scan</th>
                <th scope="col" className="text-left px-3 py-2 font-bold">Pilot</th>
                <th scope="col" className="text-left px-3 py-2 font-bold">Conversion</th>
                <th scope="col" className="text-left px-3 py-2 font-bold"><span className="sr-only">Aktionen</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-titanium-900 hover:bg-obsidian-900">
                  <td className="px-3 py-2 align-top">
                    <div className="text-xs text-titanium-400 font-mono">
                      {new Date(r.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </div>
                    {r.submission_count > 1 && (
                      <div className="text-[10px] text-titanium-500 font-mono">{r.submission_count}× erfasst</div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="text-xs font-mono text-titanium-200">{r.domain ?? '—'}</span>
                    {r.company && <div className="text-[11px] text-titanium-400">{r.company}</div>}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="text-xs font-mono text-titanium-200 break-all">{r.email}</span>
                    {r.marketing_consent && (
                      <div className={`text-[10px] ${r.followup_confirmed ? 'text-emerald-400' : 'text-amber-300'}`}>
                        {r.followup_confirmed ? 'Follow-up bestätigt (DOI)' : 'Einwilligung, DOI offen'}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-fuchsia-300 font-mono">{SOURCE_LABELS[r.source ?? ''] ?? r.source ?? '—'}</td>
                  <td className="px-3 py-2 align-top text-xs text-titanium-300">{SCAN_STATUS_LABELS[r.scan_status] ?? r.scan_status}</td>
                  <td className="px-3 py-2 align-top text-xs text-titanium-300">
                    {PILOT_STATUS_LABELS[r.pilot_status] ?? r.pilot_status}
                    {r.registered && <div className="text-[10px] text-titanium-500">Konto verknüpft</div>}
                  </td>
                  <td className="px-3 py-2 align-top text-xs font-bold text-titanium-100">{CONVERSION_LABELS[r.conversion_stage] ?? r.conversion_stage}</td>
                  <td className="px-3 py-2 align-top text-xs whitespace-nowrap">
                    {pendingErase === r.id ? (
                      <span className="inline-flex gap-2">
                        <button type="button" onClick={() => void erase(r)} className="px-2 py-1 border border-red-700 text-red-300 hover:bg-red-950/40 rounded-none">
                          Endgültig löschen
                        </button>
                        <button type="button" onClick={() => setPendingErase(null)} className="px-2 py-1 border border-titanium-800 text-titanium-300 rounded-none">
                          Abbrechen
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingErase(r.id)}
                        className="px-2 py-1 border border-titanium-800 text-titanium-400 hover:text-titanium-100 rounded-none"
                        aria-label={`Daten von ${r.email} löschen (Art. 17)`}
                      >
                        Löschen (Art. 17)
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FunnelKpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-4 rounded-none border border-titanium-900 bg-obsidian-900">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-titanium-500">{label}</dt>
      <dd className="font-display font-bold text-2xl text-titanium-50 tabular-nums mt-1">{value}</dd>
      {sub && <dd className="text-[11px] text-titanium-500 mt-0.5">{sub}</dd>}
    </div>
  );
}
