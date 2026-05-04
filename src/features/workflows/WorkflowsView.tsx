import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, GitMerge, Plus, Play, Pause, ExternalLink,
  CheckCircle2, AlertTriangle, Loader2, History, Activity,
  Lock, Trash2,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';

interface Workflow {
  id: string;
  tenant_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  trigger_config: Record<string, unknown>;
  actions_config: unknown[];
  n8n_workflow_id: string | null;
  is_active: boolean;
  last_run_at: string | null;
  run_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'timeout' | 'cancelled';
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  cost_usd: number;
  duration_ms: number | null;
  n8n_execution_id: string | null;
  started_at: string;
  finished_at: string | null;
}

const N8N_BASE = 'https://n8n.realsyncdynamicsai.de';

type Tab = 'list' | 'history';

export function WorkflowsView() {
  return (
    <AuthGate>
      {() => <Inner />}
    </AuthGate>
  );
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant, loading, hasFeature } = useTenant();
  const [tab, setTab] = useState<Tab>('list');

  const featureEnabled = hasFeature('ai.tool.workflows');

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <GitMerge className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Workflows</div>
              <div className="text-[11px] text-titanium-400 font-medium">n8n-Automation</div>
            </div>
          </div>
        </div>

        {tenants.length > 1 && (
          <select
            value={activeTenantId ?? ''}
            onChange={(e) => setActiveTenant(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
          >
            {tenants.map((t) => (
              <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
            ))}
          </select>
        )}
      </header>

      <div className="border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="max-w-5xl mx-auto flex gap-2">
          <TabButton active={tab === 'list'}    onClick={() => setTab('list')}>
            <GitMerge className="h-3.5 w-3.5" /> Workflows
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
            <History className="h-3.5 w-3.5" /> Verlauf
          </TabButton>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <Loading />
        ) : !activeTenantId ? (
          <EmptyTenants />
        ) : !featureEnabled ? (
          <PlanLocked />
        ) : tab === 'list' ? (
          <WorkflowList tenantId={activeTenantId} />
        ) : (
          <RunHistory tenantId={activeTenantId} />
        )}
      </main>
    </div>
  );
}

// ─── Workflow List ──────────────────────────────────────────────────────────

function WorkflowList({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<Workflow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  async function load() {
    setError(null);
    setItems(null);
    const { data, error: e } = await getSupabase()
      .from('workflows').select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (e) { setError(e.message); return; }
    setItems((data as Workflow[]) ?? []);
  }

  useEffect(() => { void load(); }, [tenantId]);

  async function createWorkflow() {
    if (!newTitle.trim()) return;
    const sb = getSupabase();
    const { data: userResp } = await sb.auth.getUser();
    if (!userResp.user) return;
    const { error: e } = await sb.from('workflows').insert({
      tenant_id: tenantId,
      owner_id: userResp.user.id,
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      trigger_config: {},
      actions_config: [],
      is_active: false,
    });
    if (e) { setError(e.message); return; }
    setCreating(false); setNewTitle(''); setNewDesc('');
    await load();
  }

  async function toggleActive(wf: Workflow) {
    setError(null);
    const { error: e } = await getSupabase()
      .from('workflows').update({ is_active: !wf.is_active })
      .eq('id', wf.id);
    if (e) { setError(e.message); return; }
    await load();
  }

  async function bindN8n(wf: Workflow) {
    const id = prompt(
      `n8n-Workflow-ID eintragen.\n\n` +
      `Anlegen in n8n: ${N8N_BASE}\n` +
      `Im n8n-Editor → URL enthält die ID nach /workflow/...`,
      wf.n8n_workflow_id ?? '',
    );
    if (!id) return;
    const { error: e } = await getSupabase()
      .from('workflows').update({ n8n_workflow_id: id.trim() })
      .eq('id', wf.id);
    if (e) { setError(e.message); return; }
    await load();
  }

  async function runNow(wf: Workflow) {
    if (!wf.n8n_workflow_id) {
      alert('Erst an einen n8n-Workflow binden ("n8n"-Button).');
      return;
    }
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workflow-trigger`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          workflow_id: wf.id,
          input: {},
        }),
      },
    );
    const body = await resp.json();
    if (!resp.ok) {
      alert(`Fehler: ${body.error?.message ?? resp.statusText}`);
    } else {
      alert(`Run gestartet: ${body.run_id}`);
      await load();
    }
  }

  async function deleteWorkflow(wf: Workflow) {
    if (!confirm(`"${wf.title}" wirklich löschen?\nAlle Run-Einträge werden mitgelöscht.`)) return;
    const { error: e } = await getSupabase().from('workflows').delete().eq('id', wf.id);
    if (e) { setError(e.message); return; }
    await load();
  }

  if (error) return <ErrorBox msg={error} />;
  if (items === null) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-titanium-400">
          {items.length} Workflow{items.length !== 1 && 's'} in diesem Workspace
        </div>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-security-500 text-white text-xs font-semibold rounded-none hover:bg-security-600"
        >
          <Plus className="h-3.5 w-3.5" /> Neuer Workflow
        </button>
      </div>

      {creating && (
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4 space-y-3">
          <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">Titel</label>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="z. B. Asset C2PA-Sign-Pipeline"
            className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-security-500"
          />
          <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">Beschreibung (optional)</label>
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            rows={2}
            className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-security-500"
          />
          <div className="flex gap-2">
            <button onClick={createWorkflow} className="px-3 py-1.5 bg-security-500 text-white text-xs font-semibold rounded-none">Anlegen</button>
            <button onClick={() => setCreating(false)} className="px-3 py-1.5 text-titanium-400 hover:text-titanium-200 text-xs">Abbrechen</button>
          </div>
        </div>
      )}

      {items.length === 0 && !creating && <EmptyWorkflows />}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((wf) => (
            <WorkflowRow
              key={wf.id} wf={wf}
              onToggle={() => toggleActive(wf)}
              onBind={() => bindN8n(wf)}
              onRun={() => runNow(wf)}
              onDelete={() => deleteWorkflow(wf)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowRow({
  wf, onToggle, onBind, onRun, onDelete,
}: {
  wf: Workflow;
  onToggle: () => void; onBind: () => void; onRun: () => void; onDelete: () => void;
}) {
  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="font-display font-bold text-titanium-50 truncate">{wf.title}</div>
            {wf.is_active
              ? <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5">aktiv</span>
              : <span className="text-[10px] font-bold uppercase text-titanium-500 bg-obsidian-950 px-1.5 py-0.5">pausiert</span>}
          </div>
          {wf.description && <div className="text-xs text-titanium-400 mb-2 leading-relaxed">{wf.description}</div>}
          <div className="flex items-center gap-4 text-[11px] text-titanium-500 font-mono">
            <span>v{wf.version}</span>
            <span>{wf.run_count} Runs</span>
            {wf.last_run_at
              ? <span>letzter: {new Date(wf.last_run_at).toLocaleString('de-DE')}</span>
              : <span>noch nie</span>}
            {wf.n8n_workflow_id
              ? <a href={`${N8N_BASE}/workflow/${wf.n8n_workflow_id}`} target="_blank" rel="noreferrer"
                   className="text-security-400 hover:underline flex items-center gap-1">
                  n8n <ExternalLink className="h-3 w-3" />
                </a>
              : <span className="text-amber-400">⚠ nicht verknüpft</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {wf.n8n_workflow_id && (
            <button onClick={onRun} title="Run now"
              className="p-2 bg-security-500 hover:bg-security-600 text-white rounded-none">
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onToggle} title={wf.is_active ? 'Pausieren' : 'Aktivieren'}
            className="p-2 bg-obsidian-950 border border-titanium-900 hover:bg-obsidian-800 rounded-none">
            {wf.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onBind} title="n8n-ID setzen"
            className="p-2 bg-obsidian-950 border border-titanium-900 hover:bg-obsidian-800 rounded-none text-xs font-bold">
            n8n
          </button>
          <button onClick={onDelete} title="Löschen"
            className="p-2 bg-obsidian-950 border border-red-900/50 hover:bg-red-950/30 text-red-400 rounded-none">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Run History ────────────────────────────────────────────────────────────

function RunHistory({ tenantId }: { tenantId: string }) {
  const [runs, setRuns] = useState<(WorkflowRun & { workflow: { title: string } | null })[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null); setRuns(null);
    getSupabase()
      .from('workflow_runs')
      .select('*, workflow:workflows(title)')
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(100)
      .then(({ data, error: e }) => {
        if (cancelled) return;
        if (e) { setError(e.message); return; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setRuns((data as any[]) ?? []);
      });
    return () => { cancelled = true; };
  }, [tenantId]);

  if (error) return <ErrorBox msg={error} />;
  if (runs === null) return <Loading />;
  if (runs.length === 0) return (
    <div className="text-center py-16">
      <History className="h-10 w-10 text-titanium-600 mx-auto mb-3" />
      <h2 className="font-display text-lg font-bold text-titanium-50 mb-1">Noch keine Runs</h2>
      <p className="text-sm text-titanium-400">Sobald ein Workflow ausgeführt wird, erscheinen die Runs hier.</p>
    </div>
  );

  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-obsidian-950 text-[11px] font-bold text-titanium-400 uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-2">Workflow</th>
            <th className="text-left px-3 py-2 hidden sm:table-cell">Wann</th>
            <th className="text-right px-3 py-2 hidden md:table-cell">Dauer</th>
            <th className="text-right px-3 py-2">Cost</th>
            <th className="text-center px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-titanium-900">
          {runs.map((r) => (
            <tr key={r.id} className="hover:bg-obsidian-950">
              <td className="px-3 py-2 text-titanium-200 truncate max-w-[200px]">
                {r.workflow?.title ?? '(gelöscht)'}
              </td>
              <td className="px-3 py-2 text-titanium-400 text-xs hidden sm:table-cell">
                {new Date(r.started_at).toLocaleString('de-DE')}
              </td>
              <td className="px-3 py-2 text-right text-titanium-400 hidden md:table-cell tabular-nums">
                {r.duration_ms ? `${r.duration_ms} ms` : '–'}
              </td>
              <td className="px-3 py-2 text-right text-titanium-200 tabular-nums">
                ${Number(r.cost_usd).toFixed(4)}
              </td>
              <td className="px-3 py-2 text-center">
                <StatusBadge status={r.status} title={r.error_message ?? r.error_code ?? r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status, title }: { status: WorkflowRun['status']; title?: string }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" />;
    case 'running':
    case 'pending':
      return <Loader2 className="h-4 w-4 text-blue-400 inline animate-spin" />;
    case 'error':
    case 'timeout':
      return <span title={title}><AlertTriangle className="h-4 w-4 text-red-400 inline" /></span>;
    case 'cancelled':
      return <span className="text-titanium-500 text-xs">cancel</span>;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
        active ? 'border-security-500 text-security-300'
               : 'border-transparent text-titanium-400 hover:text-titanium-200'}`}>
      {children}
    </button>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
      <Loader2 className="h-4 w-4 animate-spin" /> Lade…
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{msg}</span>
    </div>
  );
}

function EmptyTenants() {
  return (
    <div className="text-center py-16">
      <Activity className="h-10 w-10 text-titanium-600 mx-auto mb-3" />
      <h2 className="font-display text-lg font-bold text-titanium-50 mb-1">Kein Workspace</h2>
      <p className="text-sm text-titanium-400">Erst Mitglied eines Tenants werden, dann gibt's Workflows.</p>
    </div>
  );
}

function EmptyWorkflows() {
  return (
    <div className="text-center py-12 border border-dashed border-titanium-900 rounded-none">
      <GitMerge className="h-10 w-10 text-titanium-600 mx-auto mb-3" />
      <h3 className="font-display text-base font-bold text-titanium-50 mb-1">Noch keine Workflows</h3>
      <p className="text-sm text-titanium-400">Klick „Neuer Workflow" um anzulegen, dann mit n8n-ID verknüpfen.</p>
    </div>
  );
}

function PlanLocked() {
  return (
    <div className="text-center py-16">
      <Lock className="h-10 w-10 text-amber-500 mx-auto mb-3" />
      <h2 className="font-display text-lg font-bold text-titanium-50 mb-2">Workflows ab Silver</h2>
      <p className="text-sm text-titanium-400 max-w-md mx-auto leading-relaxed mb-4">
        n8n-Workflow-Engine ist Teil der Silver- und Gold-Pakete.
        Im aktuellen Plan ist <code className="text-amber-300">ai.tool.workflows</code> nicht freigeschaltet.
      </p>
      <Link to="/pricing" className="inline-block px-4 py-2 bg-security-500 text-white text-sm font-semibold rounded-none hover:bg-security-600">
        Plan upgraden
      </Link>
    </div>
  );
}
