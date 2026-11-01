import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { HEALTH_LABEL, routineHealth, type RoutineHealth, type RoutineStatusRow } from './memory';

const HEALTH_CLASS: Record<RoutineHealth, string> = {
  ok: 'text-emerald-300', failing: 'text-red-300', overdue: 'text-amber-300', never: 'text-zinc-400', disabled: 'text-zinc-500', unknown: 'text-zinc-400',
};

/** M7: Nachweis wiederkehrender Prüfungen (agent_routine_status_v, lesend). */
export function RoutinesView() {
  const [rows, setRows] = useState<RoutineStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured()) { setErr('Supabase nicht konfiguriert'); setLoading(false); return; }
      const { data, error } = await getSupabase().from('agent_routine_status_v')
        .select('source,id,key,label,agent_ref,schedule,enabled,expected_interval_minutes,last_run_at,last_status,last_error,last_summary,failures_7d,next_run_at')
        .order('label').limit(500);
      if (cancelled) return;
      if (error) setErr(`Routinen nicht lesbar: ${error.message}`); else setRows((data ?? []) as RoutineStatusRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section aria-label="Routinen" data-testid="routines-view">
      <h1 className="text-xl font-semibold">Routinen</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Status nur aus protokollierten Läufen. Läufe schreibt ausschließlich der Scheduler; Ergebnisse ohne Protokoll stehen als UNBEKANNT.
      </p>
      {err && <p role="status" className="mt-3 text-sm text-amber-200">{err}</p>}
      {loading && <p className="mt-3 text-sm text-zinc-400">Lade …</p>}
      {!loading && !err && rows.length === 0 && <p data-testid="routines-empty" className="mt-3 text-sm text-zinc-400">Keine Routinen registriert.</p>}
      {rows.length > 0 && (
        <table className="mt-3 w-full text-left text-xs">
          <thead className="text-zinc-400"><tr><th className="py-1">Routine</th><th>Quelle</th><th>Zeitplan</th><th>Letzter Lauf</th><th>Zustand</th><th>Fehler 7 T.</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const h = routineHealth(r);
              return (
                <tr key={`${r.source}:${r.id}`} data-testid="routine-row" className="border-t border-zinc-800 text-zinc-200">
                  <td className="py-1">{r.label}<span className="block font-mono text-zinc-500">{r.key}</span></td>
                  <td>{r.source === 'routine' ? 'Registry' : 'Scan-Zeitplan'}</td>
                  <td>{r.schedule ?? 'nicht gesetzt'}</td>
                  <td>{r.last_run_at ? new Date(r.last_run_at).toLocaleString('de-DE') : '—'}</td>
                  <td className={HEALTH_CLASS[h]}>{HEALTH_LABEL[h]}{h === 'failing' && r.last_error ? `: ${r.last_error}` : ''}</td>
                  <td>{r.source === 'routine' ? String(r.failures_7d ?? 0) : 'UNBEKANNT'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
