// AgentOsAdminPage — read-only admin surface that visualises the
// AgentOS substrate for the active tenant.
//
// 5 cards in a grid:
//   - Overview counts (top strip)
//   - Event stream (recent agent_events, tail)
//   - Open tasks (status open/in_progress/blocked)
//   - Proposed decisions (status='proposed' — awaiting human)
//   - Active observations (severity ≥ medium, not acknowledged)
//   - Recent memory (top importance, last 15 active)
//
// This is intentionally READ-ONLY. Approval / acknowledgement /
// task-status flips happen in dedicated detail pages (follow-up).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight,
  Bot, Brain, Clock, ListChecks, MessageSquareWarning,
  RefreshCw, Sparkles, XCircle,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import {
  listRecentEvents, listOpenTasks, listProposedDecisions,
  listActiveObservations, listRecentMemory, getOverviewCounts,
  type AgentEventRow, type AgentTaskRow, type AgentDecisionRow,
  type AgentObservationRow, type AgentMemoryRow, type AgentOverviewCounts,
} from './agentsAdminApi';

interface LoadState {
  loading: boolean;
  error:   string | null;
  events:        AgentEventRow[];
  tasks:         AgentTaskRow[];
  decisions:     AgentDecisionRow[];
  observations:  AgentObservationRow[];
  memory:        AgentMemoryRow[];
  counts:        AgentOverviewCounts;
}

const EMPTY_STATE: LoadState = {
  loading: true,
  error:   null,
  events:        [],
  tasks:         [],
  decisions:     [],
  observations:  [],
  memory:        [],
  counts: { open_tasks: 0, pending_decisions: 0, unack_observations: 0, active_memories: 0 },
};

export function AgentOsAdminPage() {
  const { activeTenantId } = useTenant();
  const [state, setState] = useState<LoadState>(EMPTY_STATE);

  async function load(tenant_id: string) {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [counts, events, tasks, decisions, observations, memory] = await Promise.all([
        getOverviewCounts(tenant_id),
        listRecentEvents(tenant_id, 50),
        listOpenTasks(tenant_id, 30),
        listProposedDecisions(tenant_id, 20),
        listActiveObservations(tenant_id, 20),
        listRecentMemory(tenant_id, 15),
      ]);
      setState({ loading: false, error: null, counts, events, tasks, decisions, observations, memory });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: (e as Error).message ?? 'load failed' }));
    }
  }

  useEffect(() => {
    if (!activeTenantId) return;
    void load(activeTenantId);
  }, [activeTenantId]);

  if (!activeTenantId) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <Bot className="h-10 w-10 text-titanium-500 mx-auto mb-4" />
          <h1 className="font-display text-2xl text-titanium-50 mb-2">Kein Tenant ausgewählt</h1>
          <p className="text-titanium-400 text-sm">
            Bitte wähle in der Tenant-Auswahl einen Tenant, um die Agent-OS-Übersicht zu sehen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/dashboard" className="p-1.5 hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3" aria-label="Zum Dashboard">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
            <Bot className="h-4 w-4 text-titanium-50" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Agent OS · Live</div>
        </div>
        <button
          type="button"
          onClick={() => activeTenantId && load(activeTenantId)}
          disabled={state.loading}
          aria-label="Aktualisieren"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-titanium-400 hover:text-titanium-100 border border-titanium-800 hover:border-titanium-600 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${state.loading ? 'animate-spin' : ''}`} />
          refresh
        </button>
      </header>

      <main className="px-4 sm:px-6 py-8 max-w-7xl mx-auto space-y-6">
        {state.error && (
          <div className="bg-red-950/40 border border-red-900 p-4 text-red-300 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{state.error}</span>
          </div>
        )}

        <OverviewStrip counts={state.counts} loading={state.loading} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DecisionsCard rows={state.decisions} loading={state.loading} />
          <ObservationsCard rows={state.observations} loading={state.loading} />
          <TasksCard rows={state.tasks} loading={state.loading} />
          <MemoryCard rows={state.memory} loading={state.loading} />
        </div>

        <EventStreamCard rows={state.events} loading={state.loading} />
      </main>
    </div>
  );
}

// ── Overview strip ────────────────────────────────────────────────

function OverviewStrip({ counts, loading }: { counts: AgentOverviewCounts; loading: boolean }) {
  const tiles = [
    { label: 'open tasks',         value: counts.open_tasks,         icon: <ListChecks className="h-3.5 w-3.5 text-cyan-300" />,     tone: 'text-cyan-300'    },
    { label: 'pending decisions',  value: counts.pending_decisions,  icon: <Sparkles  className="h-3.5 w-3.5 text-amber-300" />,    tone: 'text-amber-300'   },
    { label: 'unack obs · ≥high',  value: counts.unack_observations, icon: <MessageSquareWarning className="h-3.5 w-3.5 text-red-300" />, tone: 'text-red-300' },
    { label: 'active memory',      value: counts.active_memories,    icon: <Brain     className="h-3.5 w-3.5 text-violet-300" />,   tone: 'text-violet-300'  },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-titanium-900">
      {tiles.map((t) => (
        <div key={t.label} className="bg-obsidian-950 p-4">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">
            {t.icon}
            {t.label}
          </div>
          <div className={`font-display font-semibold text-2xl tabular-nums ${t.tone}`}>
            {loading ? '—' : t.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Card primitives ───────────────────────────────────────────────

function CardShell({ title, icon, accent, children, empty, loading }: {
  title:   string;
  icon:    React.ReactNode;
  accent:  string;
  children: React.ReactNode;
  empty:    string;
  loading:  boolean;
}) {
  return (
    <section className="bg-obsidian-900 border border-titanium-900 flex flex-col min-h-[280px]">
      <header className={`flex items-center gap-2 px-4 py-3 border-b border-titanium-900 ${accent}`}>
        <span className="inline-flex w-6 h-6 items-center justify-center bg-obsidian-950 border border-titanium-800">
          {icon}
        </span>
        <h2 className="font-display font-semibold text-sm text-titanium-50">{title}</h2>
      </header>
      <div className="flex-1 overflow-auto p-3">
        {loading
          ? <SkeletonRows />
          : (typeof children === 'object' && children !== null && (children as { props?: { children?: unknown[] } }).props?.children
                && Array.isArray((children as { props?: { children?: unknown[] } }).props!.children)
                && (children as { props?: { children?: unknown[] } }).props!.children!.length === 0)
            ? <div className="text-[11px] font-mono text-titanium-500 text-center py-6">{empty}</div>
            : children
        }
      </div>
    </section>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-10 bg-obsidian-950 animate-pulse" />
      ))}
    </div>
  );
}

// ── Concrete cards ────────────────────────────────────────────────

function DecisionsCard({ rows, loading }: { rows: AgentDecisionRow[]; loading: boolean }) {
  return (
    <CardShell
      title="Pending decisions"
      icon={<Sparkles className="h-3.5 w-3.5 text-amber-300" />}
      accent=""
      loading={loading}
      empty="Keine offenen Entscheidungen."
    >
      <ul className="space-y-2">
        {rows.map((d) => (
          <li key={d.id} className="bg-obsidian-950 border border-titanium-900 p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
                {d.proposed_by}
              </div>
              <RiskPill risk={d.risk_level} reversibility={d.reversibility} />
            </div>
            <div className="text-sm text-titanium-50 font-semibold mb-1 leading-snug">{d.decision_title}</div>
            <div className="text-xs text-titanium-400 leading-relaxed line-clamp-2">{d.problem}</div>
            <div className="mt-2 text-[10px] font-mono text-titanium-500">
              recommends: <span className="text-titanium-200">{d.recommendation}</span>
            </div>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

function ObservationsCard({ rows, loading }: { rows: AgentObservationRow[]; loading: boolean }) {
  return (
    <CardShell
      title="Active observations"
      icon={<MessageSquareWarning className="h-3.5 w-3.5 text-red-300" />}
      accent=""
      loading={loading}
      empty="Keine offenen Beobachtungen."
    >
      <ul className="space-y-2">
        {rows.map((o) => (
          <li key={o.id} className="bg-obsidian-950 border border-titanium-900 p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                {o.agent} · {o.category}
              </div>
              <SeverityPill severity={o.severity} />
            </div>
            <div className="text-sm text-titanium-50 font-semibold mb-1 leading-snug">{o.title}</div>
            {o.detail && <div className="text-xs text-titanium-400 leading-relaxed line-clamp-2">{o.detail}</div>}
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

function TasksCard({ rows, loading }: { rows: AgentTaskRow[]; loading: boolean }) {
  return (
    <CardShell
      title="Open tasks"
      icon={<ListChecks className="h-3.5 w-3.5 text-cyan-300" />}
      accent=""
      loading={loading}
      empty="Keine offenen Tasks."
    >
      <ul className="space-y-2">
        {rows.map((t) => (
          <li key={t.id} className="bg-obsidian-950 border border-titanium-900 p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="font-mono text-[10px] uppercase tracking-wider text-cyan-300">{t.agent}</div>
              <TaskStatusPill status={t.status} priority={t.priority} />
            </div>
            <div className="text-sm text-titanium-50 leading-snug line-clamp-2">{t.task}</div>
            {t.blocker_reason && (
              <div className="mt-2 text-[10px] font-mono text-amber-300 leading-relaxed line-clamp-2">
                blocker: {t.blocker_reason}
              </div>
            )}
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

function MemoryCard({ rows, loading }: { rows: AgentMemoryRow[]; loading: boolean }) {
  return (
    <CardShell
      title="Recent memory"
      icon={<Brain className="h-3.5 w-3.5 text-violet-300" />}
      accent=""
      loading={loading}
      empty="Keine aktiven Memory-Einträge."
    >
      <ul className="space-y-2">
        {rows.map((m) => (
          <li key={m.id} className="bg-obsidian-950 border border-titanium-900 p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="font-mono text-[10px] uppercase tracking-wider text-violet-300">{m.topic}</div>
              <span className="font-mono text-[10px] text-titanium-500">imp {m.importance}</span>
            </div>
            <div className="text-sm text-titanium-200 leading-snug line-clamp-2">{m.content}</div>
            {m.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {m.tags.slice(0, 4).map((t) => (
                  <span key={t} className="font-mono text-[9px] px-1.5 py-0.5 bg-obsidian-900 border border-titanium-900 text-titanium-500">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

function EventStreamCard({ rows, loading }: { rows: AgentEventRow[]; loading: boolean }) {
  return (
    <CardShell
      title="Event stream · runtime.log"
      icon={<Activity className="h-3.5 w-3.5 text-emerald-300" />}
      accent=""
      loading={loading}
      empty="Keine Events."
    >
      <ul className="font-mono text-[11px] space-y-1">
        {rows.map((e) => (
          <li key={e.id} className="flex gap-3 items-start text-titanium-400">
            <span className="text-titanium-600 shrink-0 tabular-nums">#{e.id}</span>
            <span className="text-titanium-500 shrink-0">{new Date(e.created_at).toISOString().slice(11, 19)}</span>
            <span className={`shrink-0 ${eventTone(e.event_type)}`}>{e.event_type}</span>
            <span className="text-titanium-600 shrink-0">→</span>
            <span className="text-titanium-300 truncate">{e.agent ?? 'system'} · {e.subject_type}/{e.subject_id.slice(0, 12)}…</span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

// ── Tiny pill components ──────────────────────────────────────────

function SeverityPill({ severity }: { severity: AgentObservationRow['severity'] }) {
  const tone = severity === 'critical' ? 'text-red-300 border-red-700'
             : severity === 'high'     ? 'text-amber-300 border-amber-700'
             : severity === 'medium'   ? 'text-cyan-300 border-cyan-700'
             : 'text-titanium-400 border-titanium-700';
  return (
    <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border ${tone}`}>
      {severity}
    </span>
  );
}

function RiskPill({ risk, reversibility }: { risk: AgentDecisionRow['risk_level']; reversibility: AgentDecisionRow['reversibility'] }) {
  const tone = risk === 'critical' ? 'text-red-300 border-red-700'
             : risk === 'high'     ? 'text-amber-300 border-amber-700'
             : risk === 'medium'   ? 'text-cyan-300 border-cyan-700'
             : 'text-titanium-400 border-titanium-700';
  const irrev = reversibility === 'irreversible';
  return (
    <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border ${tone}`}>
      {risk}{irrev ? ' · irrev' : ''}
    </span>
  );
}

function TaskStatusPill({ status, priority }: { status: string; priority: string }) {
  const icon = status === 'in_progress' ? <Clock className="h-3 w-3 text-cyan-300" />
             : status === 'blocked'     ? <XCircle className="h-3 w-3 text-amber-300" />
             : <ArrowRight className="h-3 w-3 text-titanium-500" />;
  const tone = priority === 'critical' ? 'text-red-300' : priority === 'high' ? 'text-amber-300' : 'text-titanium-400';
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider ${tone}`}>
      {icon}
      {status} · {priority}
    </span>
  );
}

function eventTone(type: string): string {
  if (type.includes('failed') || type.includes('rejected')) return 'text-red-300';
  if (type.includes('approved') || type.includes('completed')) return 'text-emerald-300';
  if (type.includes('proposed') || type.includes('recorded')) return 'text-amber-300';
  if (type.startsWith('task'))     return 'text-cyan-300';
  if (type.startsWith('memory'))   return 'text-violet-300';
  if (type.startsWith('decision')) return 'text-amber-300';
  return 'text-titanium-400';
}
