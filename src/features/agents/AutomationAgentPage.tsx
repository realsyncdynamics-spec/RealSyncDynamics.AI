import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bot, Loader2, AlertTriangle } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import { WorkflowTemplateCard } from './components/WorkflowTemplateCard';
import { AutomationSuggestionCard } from './components/AutomationSuggestionCard';
import { AgentActionLogTable } from './components/AgentActionLogTable';

// ─── Typen aus der DB-Schema-Migration ───────────────────────────────────────

interface WorkflowTemplate {
  id: string;
  title: string;
  category: string | null;
  trigger_type: string | null;
  required_integrations: string[];
  implementation_notes: string | null;
}

interface AutomationSuggestion {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  status: 'new' | 'accepted' | 'rejected';
}

interface CustomerWorkflow {
  id: string;
  name: string;
  status: string;
  last_run_at: string | null;
}

interface AgentActionLog {
  id: string;
  created_at: string;
  action_type: string;
  status: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  agent_id: string | null;
}

// ─── Tab-Konfiguration ────────────────────────────────────────────────────────

type TabId = 'suggestions' | 'templates' | 'workflows' | 'log';

const TABS: { id: TabId; label: string }[] = [
  { id: 'suggestions', label: 'Vorschläge' },
  { id: 'templates', label: 'Workflow-Vorlagen' },
  { id: 'workflows', label: 'Aktive Workflows' },
  { id: 'log', label: 'Aktions-Log' },
];

// ─── Hilfsfunktion: Datum formatieren ────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Lade-Indikator ───────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-titanium-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Lade Daten…</span>
    </div>
  );
}

// ─── Fehlermeldung ────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-rose-300 bg-rose-950/40 border border-rose-900 p-3">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

// ─── Leerer-Zustand ───────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-sm text-titanium-500 py-8 text-center">{label}</p>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function AutomationAgentPage() {
  const { activeTenantId } = useTenant();
  const [activeTab, setActiveTab] = useState<TabId>('suggestions');

  // Zustandsspeicher je Tab
  const [suggestions, setSuggestions] = useState<AutomationSuggestion[] | null>(null);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<WorkflowTemplate[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [workflows, setWorkflows] = useState<CustomerWorkflow[] | null>(null);
  const [workflowsError, setWorkflowsError] = useState<string | null>(null);

  const [actionLog, setActionLog] = useState<AgentActionLog[] | null>(null);
  const [actionLogError, setActionLogError] = useState<string | null>(null);

  // Vorschläge laden (tenant-isoliert)
  useEffect(() => {
    if (activeTab !== 'suggestions' || !activeTenantId) return;
    let cancelled = false;
    setSuggestions(null);
    setSuggestionsError(null);
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from('automation_suggestions')
          .select('id, title, description, priority, status')
          .eq('tenant_id', activeTenantId)
          .order('created_at', { ascending: false });
        if (!cancelled) {
          if (error) setSuggestionsError(error.message);
          else setSuggestions(data ?? []);
        }
      } catch (e) {
        if (!cancelled) setSuggestionsError((e as Error)?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeTenantId]);

  // Workflow-Vorlagen laden (global, kein Tenant-Filter)
  useEffect(() => {
    if (activeTab !== 'templates') return;
    if (templates !== null) return; // bereits geladen
    let cancelled = false;
    setTemplatesError(null);
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from('workflow_templates')
          .select('id, title, category, trigger_type, required_integrations, implementation_notes')
          .order('category', { ascending: true });
        if (!cancelled) {
          if (error) setTemplatesError(error.message);
          else setTemplates(data ?? []);
        }
      } catch (e) {
        if (!cancelled) setTemplatesError((e as Error)?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, templates]);

  // Aktive Workflows laden (tenant-isoliert)
  useEffect(() => {
    if (activeTab !== 'workflows' || !activeTenantId) return;
    let cancelled = false;
    setWorkflows(null);
    setWorkflowsError(null);
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from('customer_workflows')
          .select('id, name, status, last_run_at')
          .eq('tenant_id', activeTenantId)
          .order('created_at', { ascending: false });
        if (!cancelled) {
          if (error) setWorkflowsError(error.message);
          else setWorkflows(data ?? []);
        }
      } catch (e) {
        if (!cancelled) setWorkflowsError((e as Error)?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeTenantId]);

  // Aktions-Log laden (tenant-isoliert, limit 50)
  useEffect(() => {
    if (activeTab !== 'log' || !activeTenantId) return;
    let cancelled = false;
    setActionLog(null);
    setActionLogError(null);
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from('agent_actions_log')
          .select('id, created_at, action_type, status, input, output, agent_id')
          .eq('tenant_id', activeTenantId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (!cancelled) {
          if (error) setActionLogError(error.message);
          else setActionLog(data ?? []);
        }
      } catch (e) {
        if (!cancelled) setActionLogError((e as Error)?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeTenantId]);

  return (
    <div className="space-y-6">
      {/* Navigation zurück */}
      <Link
        to="/app/agents"
        className="inline-flex items-center gap-1.5 text-xs text-titanium-400 hover:text-titanium-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Zurück zu Agents
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-9 w-9 border border-titanium-800 bg-obsidian-950 text-cyan-400">
          <Bot className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-titanium-50">Automation Governance Agent</h1>
          <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border border-amber-700 text-amber-400">
            Beta
          </span>
        </div>
      </div>

      {/* Tab-Leiste */}
      <div className="flex border-b border-titanium-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors ' +
              (activeTab === tab.id
                ? 'border-[#0052FF] text-titanium-50'
                : 'border-transparent text-titanium-400 hover:text-titanium-200 hover:border-titanium-600')
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab-Inhalte */}

      {/* Vorschläge */}
      {activeTab === 'suggestions' && (
        <div className="space-y-3">
          {!activeTenantId && <EmptyState label="Kein aktiver Tenant ausgewählt." />}
          {activeTenantId && suggestions === null && !suggestionsError && <LoadingState />}
          {suggestionsError && <ErrorState message={suggestionsError} />}
          {suggestions !== null && suggestions.length === 0 && (
            <EmptyState label="Keine Automatisierungs-Vorschläge vorhanden." />
          )}
          {suggestions !== null && suggestions.map((s) => (
            <AutomationSuggestionCard key={s.id} suggestion={s} />
          ))}
        </div>
      )}

      {/* Workflow-Vorlagen */}
      {activeTab === 'templates' && (
        <div>
          {templates === null && !templatesError && <LoadingState />}
          {templatesError && <ErrorState message={templatesError} />}
          {templates !== null && templates.length === 0 && (
            <EmptyState label="Keine Workflow-Vorlagen gefunden." />
          )}
          {templates !== null && templates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((t) => (
                <WorkflowTemplateCard key={t.id} template={t} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aktive Workflows */}
      {activeTab === 'workflows' && (
        <div>
          {!activeTenantId && <EmptyState label="Kein aktiver Tenant ausgewählt." />}
          {activeTenantId && workflows === null && !workflowsError && <LoadingState />}
          {workflowsError && <ErrorState message={workflowsError} />}
          {workflows !== null && workflows.length === 0 && (
            <EmptyState label="Keine aktiven Workflows für diesen Tenant." />
          )}
          {workflows !== null && workflows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-titanium-800">
                    <th className="text-left py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-titanium-500">Name</th>
                    <th className="text-left py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-titanium-500">Status</th>
                    <th className="text-left py-2 font-mono text-[10px] uppercase tracking-widest text-titanium-500">Letzter Lauf</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-titanium-900">
                  {workflows.map((wf) => (
                    <tr key={wf.id} className="hover:bg-obsidian-900 transition-colors">
                      <td className="py-2 pr-4 text-titanium-200">{wf.name}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={
                            'font-mono text-[10px] uppercase px-1.5 py-0.5 border ' +
                            (wf.status === 'active'
                              ? 'border-green-800 text-green-400'
                              : 'border-titanium-800 text-titanium-400')
                          }
                        >
                          {wf.status}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-[11px] text-titanium-400">
                        {formatDate(wf.last_run_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Aktions-Log */}
      {activeTab === 'log' && (
        <div>
          {!activeTenantId && <EmptyState label="Kein aktiver Tenant ausgewählt." />}
          {activeTenantId && actionLog === null && !actionLogError && <LoadingState />}
          {actionLogError && <ErrorState message={actionLogError} />}
          {actionLog !== null && (
            <AgentActionLogTable rows={actionLog} />
          )}
        </div>
      )}
    </div>
  );
}
