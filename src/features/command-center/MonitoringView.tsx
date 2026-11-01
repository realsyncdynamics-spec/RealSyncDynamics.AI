import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  CATEGORY_LABEL, formatCount, formatUsd, monthLabel, SEVERITY_LABEL, SOURCE_LABEL, sortEvents,
  type AuditRow, type CostRow, type CriticalEvent, type PlatformHealthRow,
} from './monitoring';

type Src<T> = { rows: T[]; error: string | null; loading: boolean };
const init = <T,>(): Src<T> => ({ rows: [], error: null, loading: true });
const SEV_CLASS = { high: 'text-red-300', medium: 'text-amber-300', low: 'text-zinc-300' } as const;

/** M8: Kosten & Monitoring — nur belegte Daten; fehlende Quellen = UNBEKANNT. */
export function MonitoringView() {
  const [events, setEvents] = useState<Src<CriticalEvent>>(init);
  const [audit, setAudit] = useState<Src<AuditRow>>(init);
  const [costs, setCosts] = useState<Src<CostRow>>(init);
  const [health, setHealth] = useState<Src<PlatformHealthRow>>(init);

  useEffect(() => {
    let cancelled = false;
    if (!isSupabaseConfigured()) {
      const e = { rows: [], error: 'Supabase nicht konfiguriert', loading: false };
      setEvents(e); setAudit(e); setCosts(e); setHealth(e);
      return;
    }
    const sb = getSupabase();
    const load = async <T,>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, set: (s: Src<T>) => void) => {
      const { data, error } = await p;
      if (!cancelled) set({ rows: (data ?? []) as T[], error: error ? error.message : null, loading: false });
    };
    void load(sb.from('cc_critical_events_v').select('at,kind,severity,category,subject_id,message').order('at', { ascending: false }).limit(200), setEvents);
    void load(sb.from('cc_audit_feed_v').select('at,source,event,subject_type,subject_id,actor').order('at', { ascending: false }).limit(100), setAudit);
    void load(sb.from('cc_cost_by_source_v').select('source,month,metric,basis,cost_usd,tokens,entries,last_at').order('month', { ascending: false }).limit(200), setCosts);
    void load(sb.rpc('cc_platform_health'), setHealth);
    return () => { cancelled = true; };
  }, []);

  const sourceNote = (s: Src<unknown>, what: string) =>
    s.error ? <p role="status" className="mt-2 text-xs text-amber-200">{what}: UNBEKANNT ({s.error})</p>
      : s.loading ? <p className="mt-2 text-xs text-zinc-400">Lade …</p> : null;

  const sorted = sortEvents(events.rows);
  return (
    <section aria-label="Kosten & Monitoring" data-testid="monitoring-view">
      <h1 className="text-xl font-semibold">Kosten &amp; Monitoring</h1>
      <p className="mt-1 text-sm text-zinc-400">Nur belegte Daten. Fehlende oder nicht lesbare Quellen werden als UNBEKANNT angezeigt.</p>

      <section aria-label="Kritische Ereignisse" className="mt-5">
        <h2 className="text-sm font-semibold text-zinc-200">Kritische Ereignisse (7 Tage / offen)</h2>
        {sourceNote(events, 'Ereignisquelle')}
        {!events.loading && !events.error && sorted.length === 0 && <p data-testid="events-empty" className="mt-2 text-xs text-zinc-400">Keine kritischen Ereignisse erfasst.</p>}
        <ul className="mt-2 space-y-1">
          {sorted.map((e, i) => (
            <li key={`${e.kind}:${e.subject_id}:${i}`} data-testid="critical-event" className="rounded border border-zinc-800 p-2 text-xs">
              <span className={`font-semibold ${SEV_CLASS[e.severity]}`}>{SEVERITY_LABEL[e.severity]}</span>
              <span className="text-zinc-500"> · {CATEGORY_LABEL[e.category]} · {new Date(e.at).toLocaleString('de-DE')}</span>
              <p className="text-zinc-200">{e.message}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Kosten" className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-200">Kosten nach Quelle</h2>
        <p className="mt-1 text-xs text-zinc-500">Quellen können sich überschneiden und werden daher nicht addiert. „Basis“ zeigt, ob gemessen oder geschätzt.</p>
        {sourceNote(costs, 'Kostenquelle')}
        {!costs.loading && !costs.error && costs.rows.length === 0 && <p data-testid="costs-empty" className="mt-2 text-xs text-zinc-400">Keine Kostendaten erfasst.</p>}
        {costs.rows.length > 0 && (
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-zinc-400"><tr><th className="py-1">Monat</th><th>Quelle</th><th>Art</th><th>Basis</th><th>Kosten</th><th>Tokens</th><th>Einträge</th></tr></thead>
            <tbody>
              {costs.rows.map((c, i) => (
                <tr key={i} data-testid="cost-row" className="border-t border-zinc-800 text-zinc-200">
                  <td className="py-1">{monthLabel(c.month)}</td><td>{SOURCE_LABEL[c.source] ?? c.source}</td><td>{c.metric}</td>
                  <td>{c.basis}</td><td>{formatUsd(c.cost_usd)}</td><td>{formatCount(c.tokens)}</td><td>{formatCount(c.entries)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="Plattform-Health" className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-200">Plattform-Health (Cron-Funktionen)</h2>
        {health.error ? <p role="status" className="mt-2 text-xs text-zinc-400">UNBEKANNT – nur für Plattform-Operatoren sichtbar.</p> : sourceNote(health, 'Health')}
        {health.rows.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs">
            {health.rows.map((h) => (
              <li key={h.function_name} data-testid="health-row" className="text-zinc-200">
                {h.function_name}: {h.last_status ?? 'UNBEKANNT'} · zuletzt {h.last_executed_at ? new Date(h.last_executed_at).toLocaleString('de-DE') : 'UNBEKANNT'} · 24 h: {formatCount(h.runs_24h)} Läufe, {formatCount(h.failures_24h)} Fehler
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Audit" className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-200">Audit (letzte 100)</h2>
        {sourceNote(audit, 'Audit-Quelle')}
        {!audit.loading && !audit.error && audit.rows.length === 0 && <p data-testid="audit-empty" className="mt-2 text-xs text-zinc-400">Keine Audit-Einträge.</p>}
        <ul className="mt-2 space-y-0.5 text-xs">
          {audit.rows.map((a, i) => (
            <li key={i} data-testid="audit-row" className="text-zinc-300">
              <span className="text-zinc-500">{new Date(a.at).toLocaleString('de-DE')}</span> · {a.source} · {a.event} · {a.subject_type} {a.subject_id.slice(0, 8)} · {a.actor ?? 'Akteur UNBEKANNT'}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
