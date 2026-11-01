import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import type { AgentTaskRow } from './taskBoard';

export function useAgentTasks() {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{ rows: AgentTaskRow[]; loading: boolean; sourceError: string | null }>(
    { rows: [], loading: true, sourceError: null });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured()) { setState({ rows: [], loading: false, sourceError: 'Supabase nicht konfiguriert' }); return; }
      const { data, error } = await getSupabase().from('agent_tasks')
        .select('id,agent,task,priority,status,board_status,project,correlation_id,parent_task_id,depends_on,evidence,claimed_by,claim_expires_at,blocker_reason,created_at')
        .order('created_at', { ascending: false }).limit(500);
      if (cancelled) return;
      setState(error
        ? { rows: [], loading: false, sourceError: `Aufgaben nicht lesbar: ${error.message}` }
        : { rows: (data ?? []) as AgentTaskRow[], loading: false, sourceError: null });
    })();
    return () => { cancelled = true; };
  }, [tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
