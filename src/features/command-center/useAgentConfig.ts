import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import type { ConfigVersionRow } from './agentConfig';

export function useAgentConfig(agentRef: string | null) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{ rows: ConfigVersionRow[]; loading: boolean; sourceError: string | null }>(
    { rows: [], loading: false, sourceError: null });

  useEffect(() => {
    if (!agentRef) return;
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured()) { setState({ rows: [], loading: false, sourceError: 'Supabase nicht konfiguriert' }); return; }
      setState((s) => ({ ...s, loading: true }));
      const { data, error } = await getSupabase().from('agent_config_versions')
        .select('id,agent_ref,section,version,config,status,change_note,created_at,activated_at')
        .eq('agent_ref', agentRef).order('version', { ascending: false }).limit(200);
      if (cancelled) return;
      setState(error
        ? { rows: [], loading: false, sourceError: `Soll-Konfiguration nicht lesbar: ${error.message}` }
        : { rows: (data ?? []) as ConfigVersionRow[], loading: false, sourceError: null });
    })();
    return () => { cancelled = true; };
  }, [agentRef, tick]);

  return { ...state, reload: () => setTick((t) => t + 1) };
}
