// AgentActivityPanel — macht die Ausgabe der autonomen Runtime sichtbar.
//
// Listet die jüngsten agent_observations (z. B. Deadline-Sentinel via cron),
// inkl. der mittleren Funde, die NICHT als governance_alert erscheinen.
// Eigenständig + resilient: ohne Session/Env bleibt das Panel ruhig leer.
import { useEffect, useState } from 'react';
import { Activity, Loader2, ShieldCheck } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { fetchRecentObservations, type AgentObservationRow } from './agentObservationsApi';
import { summarizeObservations, relativeTimeDe, type ObservationSeverity } from './agentActivity';

const SEVERITY_STYLE: Record<ObservationSeverity, string> = {
  critical: 'text-risk-critical border-risk-critical/40 bg-risk-critical-soft',
  high: 'text-risk-high border-risk-high/40 bg-risk-high-soft',
  medium: 'text-risk-medium border-risk-medium/40 bg-risk-medium-soft',
  low: 'text-risk-low border-risk-low/40 bg-risk-low-soft',
  info: 'text-titanium-400 border-titanium-700 bg-obsidian-800',
};

function sev(s: string): ObservationSeverity {
  const v = s.toLowerCase();
  return (['critical', 'high', 'medium', 'low', 'info'] as string[]).includes(v) ? (v as ObservationSeverity) : 'info';
}

export function AgentActivityPanel() {
  const { activeTenantId } = useTenant();
  const [rows, setRows] = useState<AgentObservationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) { setRows([]); return; }
    setLoading(true); setError(null);
    fetchRecentObservations(activeTenantId, 20)
      .then((r) => { if (!cancelled) setRows(r); })
      .catch((e) => { if (!cancelled) setError((e as Error)?.message ?? String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const summary = summarizeObservations(rows);

  return (
    <section className="bg-obsidian-900 border border-titanium-900">
      <div className="flex items-center justify-between gap-3 border-b border-titanium-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-400" />
          <h2 className="text-sm font-semibold text-titanium-100">Autonome Runtime · Beobachtungen</h2>
        </div>
        <span className="font-mono text-[10px] text-titanium-600 uppercase tracking-wider">
          {summary.total} · cron-gesteuert
        </span>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-6 text-xs text-titanium-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Lädt …
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-xs text-titanium-500">Beobachtungen nicht verfügbar.</div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-titanium-500">
          <ShieldCheck className="h-6 w-6 mx-auto mb-2 text-risk-passed" />
          Keine offenen Beobachtungen der autonomen Runtime.
        </div>
      ) : (
        <ul className="divide-y divide-titanium-900">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${SEVERITY_STYLE[sev(r.severity)]}`}>
                {sev(r.severity)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-titanium-100 truncate">{r.title}</p>
                <p className="text-[11px] text-titanium-500 truncate">
                  <span className="font-mono">{r.agent}</span>{r.detail ? ` · ${r.detail}` : ''}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-titanium-600">{relativeTimeDe(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
