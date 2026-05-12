import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';

export interface PilotReadiness {
  assets: number;
  events: number;
  policies: number;
  evidence: number;
  incidents: number;
  dpias: number;
  vendors: number;
  agent_runs: number;
}

const EMPTY: PilotReadiness = {
  assets: 0,
  events: 0,
  policies: 0,
  evidence: 0,
  incidents: 0,
  dpias: 0,
  vendors: 0,
  agent_runs: 0,
};

const TABLES: Array<{ key: keyof PilotReadiness; table: string }> = [
  { key: 'assets',     table: 'governance_assets' },
  { key: 'events',     table: 'governance_events' },
  { key: 'policies',   table: 'governance_policies' },
  { key: 'evidence',   table: 'governance_evidence' },
  { key: 'incidents',  table: 'incidents' },
  { key: 'dpias',      table: 'dpias' },
  { key: 'vendors',    table: 'vendors' },
  { key: 'agent_runs', table: 'agent_runs' },
];

export function usePilotReadiness(tenantId: string | null) {
  const [data, setData] = useState<PilotReadiness>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!tenantId) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = getSupabase();
    Promise.all(
      TABLES.map(({ key, table }) =>
        supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .then((r) => ({ key, count: r.count ?? 0, error: r.error?.message ?? null })),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const next = { ...EMPTY };
        const errors: string[] = [];
        for (const r of results) {
          if (r.error) errors.push(`${r.key}: ${r.error}`);
          next[r.key] = r.count;
        }
        setData(next);
        if (errors.length > 0) setError(errors.join(' · '));
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return { data, loading, error };
}
