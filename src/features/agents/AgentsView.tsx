import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';

interface Agent {
  id: string;
  name: string;
  type: 'governance' | 'remediation' | 'monitoring' | 'compliance-scorer' | 'risk-assessor' | 'custom';
  description: string;
  enabled: boolean;
  schedule: string;
  last_executed_at: string | null;
  created_at: string;
  tenant_id?: string;
}

interface AgentRun {
  id: string;
  agent_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  triggered_by: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  output: Record<string, unknown>;
  error_message: string | null;
}

export function AgentsView() {
  const supabase = getSupabase();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);
    // Resolve current tenant (first membership)
    const { data: memberships } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .limit(1);
    const tid = memberships?.[0]?.tenant_id ?? null;
    setTenantId(tid);

    if (tid) {
      // Ensure default agents exist for this tenant
      await supabase.rpc('get_or_create_default_autonomous_agents', {
        p_tenant_id: tid,
      });
    }

    await fetchAgents();
    setLoading(false);
  }

  async function fetchAgents() {
    const { data, error } = await supabase
      .from('autonomous_agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) {
      setAgents(data || []);
      if (data && data.length > 0) {
        setSelectedAgent((prev) => prev ?? data[0]);
        if (data[0]) fetchRuns(data[0].id);
      }
    }
  }

  async function fetchRuns(agentId: string) {
    const { data, error } = await supabase
      .from('autonomous_agent_runs')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(15);

    if (!error) {
      setRuns(data || []);
    }
  }

  async function toggleAgent(agent: Agent) {
    const { error } = await supabase
      .from('autonomous_agents')
      .update({ enabled: !agent.enabled })
      .eq('id', agent.id);

    if (!error) {
      fetchAgents();
    }
  }

  async function triggerAgent(agentId: string) {
    if (!tenantId) return;
    setTriggering(true);
    try {
      // 1. Create pending run
      const { data: inserted, error } = await supabase
        .from('autonomous_agent_runs')
        .insert({
          agent_id: agentId,
          tenant_id: tenantId,
          triggered_by: 'manual',
          status: 'pending',
        })
        .select('id')
        .single();

      if (error || !inserted?.id) {
        console.error('Failed to create run', error);
        return;
      }

      // 2. Invoke runner to execute immediately
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (token) {
        const base = import.meta.env.VITE_SUPABASE_URL || '';
        await fetch(`${base}/functions/v1/autonomous-agent-runner`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ run_id: inserted.id, tenantId }),
        }).catch((e) => console.warn('Runner invoke failed (run stays pending for cron)', e));
      }

      setSelectedAgent(agents.find((a) => a.id === agentId) || null);
      // Short delay so runner can finish
      await new Promise((r) => setTimeout(r, 800));
      await fetchRuns(agentId);
      await fetchAgents();
    } finally {
      setTriggering(false);
    }
  }

  if (loading) return <div className="p-4">Lädt...</div>;

  return (
    <div className="min-h-screen bg-obsidian-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-titanium-950 mb-2">Autonome Agenten</h1>
        <p className="text-obsidian-600 mb-8">
          Governance-, Remediation- und Monitoring-Agenten mit Evidence und Freigabe-Gates.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-obsidian-200">
                <h2 className="font-semibold text-obsidian-900">Agenten ({agents.length})</h2>
              </div>
              <div className="divide-y divide-obsidian-100">
                {agents.length === 0 ? (
                  <div className="p-4 text-sm text-obsidian-600">
                    Keine Agenten. Defaults werden beim nächsten Laden angelegt.
                  </div>
                ) : (
                  agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgent(agent);
                        fetchRuns(agent.id);
                      }}
                      className={`w-full p-4 text-left hover:bg-obsidian-50 transition ${
                        selectedAgent?.id === agent.id
                          ? 'bg-obsidian-100 border-l-4 border-cyan-500'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-obsidian-900">{agent.name}</h3>
                          <p className="text-sm text-obsidian-600 mt-1">{agent.type}</p>
                          {agent.last_executed_at && (
                            <p className="text-xs text-obsidian-500 mt-2">
                              Zuletzt:{' '}
                              {new Date(agent.last_executed_at).toLocaleDateString('de-DE')}
                            </p>
                          )}
                        </div>
                        <div
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            agent.enabled
                              ? 'bg-green-100 text-green-800'
                              : 'bg-obsidian-100 text-obsidian-600'
                          }`}
                        >
                          {agent.enabled ? 'Aktiv' : 'Inaktiv'}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Agent Details & Runs */}
          <div className="lg:col-span-2 space-y-6">
            {selectedAgent && (
              <>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-obsidian-900">
                        {selectedAgent.name}
                      </h2>
                      <p className="text-obsidian-600 mt-1">{selectedAgent.description}</p>
                    </div>
                    <button
                      onClick={() => toggleAgent(selectedAgent)}
                      className={`px-4 py-2 rounded font-medium transition ${
                        selectedAgent.enabled
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {selectedAgent.enabled ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div>
                      <p className="text-sm text-obsidian-600">Typ</p>
                      <p className="font-medium text-obsidian-900">{selectedAgent.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-obsidian-600">Zeitplan</p>
                      <p className="font-medium text-obsidian-900">
                        {selectedAgent.schedule || 'Manuell'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => triggerAgent(selectedAgent.id)}
                      disabled={triggering || !selectedAgent.enabled}
                      className="px-4 py-2 bg-cyan-600 text-white rounded font-medium hover:bg-cyan-700 transition disabled:opacity-50"
                    >
                      {triggering ? 'Wird ausgeführt…' : 'Jetzt Ausführen'}
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="p-4 border-b border-obsidian-200">
                    <h3 className="font-semibold text-obsidian-900">Ausführungsverlauf</h3>
                  </div>
                  <div className="divide-y divide-obsidian-100">
                    {runs.length === 0 ? (
                      <div className="p-4 text-obsidian-600 text-sm">
                        Keine Ausführungen vorhanden
                      </div>
                    ) : (
                      runs.map((run) => {
                        const out = run.output || {};
                        const enterpriseStatus = out.enterprise_status as string | undefined;
                        const summary = out.summary as string | undefined;
                        return (
                          <div key={run.id} className="p-4 hover:bg-obsidian-50 transition">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-3 h-3 rounded-full ${
                                    run.status === 'completed'
                                      ? 'bg-green-500'
                                      : run.status === 'failed'
                                        ? 'bg-red-500'
                                        : run.status === 'running'
                                          ? 'bg-yellow-500'
                                          : 'bg-obsidian-300'
                                  }`}
                                />
                                <span className="font-medium text-obsidian-900">{run.status}</span>
                                {enterpriseStatus && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-obsidian-100 text-obsidian-700">
                                    {enterpriseStatus}
                                  </span>
                                )}
                              </div>
                              <span className="text-sm text-obsidian-600">
                                {new Date(run.started_at || run.created_at || Date.now()).toLocaleString(
                                  'de-DE',
                                  { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' },
                                )}
                              </span>
                            </div>
                            {summary && (
                              <p className="text-sm text-obsidian-700 mb-1">{summary}</p>
                            )}
                            {run.duration_ms != null && (
                              <p className="text-sm text-obsidian-600">
                                Dauer: {(run.duration_ms / 1000).toFixed(1)}s
                              </p>
                            )}
                            {run.error_message && (
                              <p className="text-sm text-red-600 mt-2">Error: {run.error_message}</p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
