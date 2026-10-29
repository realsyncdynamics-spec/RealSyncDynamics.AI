import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { applySoll, fromRow, GROK_SOLL_AGENTS, runtimeStaticAgents, type AgentRegistryRow, type RegistryAgent } from './agentRegistry';

export interface AgentRegistryState {
  agents: RegistryAgent[];
  loading: boolean;
  /** Ehrliche Fehlermeldung, wenn die DB-Quelle nicht erreichbar ist (z. B. View noch nicht migriert). */
  sourceError: string | null;
}

function baseAgents(): RegistryAgent[] {
  return [...GROK_SOLL_AGENTS, ...runtimeStaticAgents()].map(applySoll);
}

export function useAgentRegistry(): AgentRegistryState {
  const [state, setState] = useState<AgentRegistryState>({ agents: baseAgents(), loading: true, sourceError: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSupabaseConfigured()) {
        setState({ agents: baseAgents(), loading: false, sourceError: 'Supabase nicht konfiguriert' });
        return;
      }
      const { data, error } = await getSupabase()
        .from('agent_registry_v')
        .select('registry_id,source,name,agent_type,description,status,status_source,last_activity_at,current_run_id,current_run_status,last_error')
        .order('name');
      if (cancelled) return;
      if (error) {
        setState({ agents: baseAgents(), loading: false, sourceError: `Agentenregister nicht lesbar: ${error.message}` });
        return;
      }
      const dbAgents = ((data ?? []) as AgentRegistryRow[]).map(fromRow);
      setState({ agents: [...baseAgents(), ...dbAgents.map(applySoll)], loading: false, sourceError: null });
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return state;
}
