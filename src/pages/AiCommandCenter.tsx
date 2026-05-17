import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Cpu,
  Eye,
  GitBranch,
  History,
  Keyboard,
  Layers,
  LayoutGrid,
  Loader2,
  Menu,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  Search,
  Settings,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  Workflow,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

interface AgentRunRow {
  id: string;
  tenant_id: string | null;
  agent_id: string;
  actor: string;
  status: string;
  summary: string;
  created_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

function useRecentAgentRuns(limit = 10) {
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!SUPABASE_URL) return;
    let cancelled = false;
    fetch(`${SUPABASE_URL}/functions/v1/enterprise-ai-os-agent-runs-list?limit=${limit}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        if (Array.isArray(body?.runs)) {
          setRuns(body.runs as AgentRunRow[]);
          setLive(true);
        }
      })
      .catch(() => {
        /* swallow — fallback to mocks */
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);
  return { runs, live };
}

type RunStatus = 'idle' | 'running' | 'blocked' | 'review' | 'done';

interface Model {
  id: string;
  label: string;
  provider: string;
  contextK: number;
  tag?: string;
}

interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  status: RunStatus;
  lastRun: string;
  steps: number;
  tag: string;
}

interface RunStep {
  id: string;
  name: string;
  agent: string;
  status: RunStatus;
  durationMs?: number;
  tokens?: number;
  output?: string;
}

interface LogLine {
  ts: string;
  level: 'info' | 'warn' | 'error' | 'agent';
  source: string;
  message: string;
}

interface AgentProfile {
  id: string;
  label: string;
  systemPrompt: string;
  tools: string[];
  recentRuns: Array<{ at: string; status: RunStatus; summary: string }>;
}

const AGENT_PROFILES: Record<string, AgentProfile> = {
  researcher: {
    id: 'researcher',
    label: 'Researcher',
    systemPrompt:
      'Du bist ein Recherche-Agent. Sammle Primärquellen, gewichte nach Reputabilität, und liefere strukturierte Briefs mit Zitaten.',
    tools: ['web.search', 'web.fetch', 'memory.read'],
    recentRuns: [
      { at: 'heute · 14:32', status: 'done', summary: '14 Quellen verifiziert' },
      { at: 'heute · 11:08', status: 'done', summary: 'Wettbewerbs-Scan EU/DE' },
      { at: 'gestern · 18:44', status: 'blocked', summary: 'Rate-Limit auf arxiv' },
    ],
  },
  writer: {
    id: 'writer',
    label: 'Writer',
    systemPrompt:
      'Du bist ein Lang-Form-Writer. Schreibe in der Stimme der Marke, halte dich an die Outline, und markiere Faktenbehauptungen für Cross-Check.',
    tools: ['markdown.render', 'memory.read', 'style.guide'],
    recentRuns: [
      { at: 'heute · 14:33', status: 'running', summary: 'Draft v1 (2.1k tok)' },
      { at: 'gestern · 09:12', status: 'done', summary: 'Newsletter #41' },
    ],
  },
  critic: {
    id: 'critic',
    label: 'Critic',
    systemPrompt:
      'Du bist ein Fact-Checker. Verifiziere jede markierte Behauptung gegen die Quellen-Liste, flagge Halluzinationen, und schreibe Diffs.',
    tools: ['web.fetch', 'diff.compute'],
    recentRuns: [{ at: 'heute · 13:50', status: 'done', summary: '3 Korrekturen vorgeschlagen' }],
  },
  seo: {
    id: 'seo',
    label: 'SEO',
    systemPrompt: 'Optimiere für E-E-A-T, semantic clusters und entity-coverage. Kein keyword stuffing.',
    tools: ['serp.fetch', 'keyword.expand'],
    recentRuns: [{ at: 'heute · 12:20', status: 'done', summary: 'Title + Meta + H2-Pass' }],
  },
  publisher: {
    id: 'publisher',
    label: 'Publisher',
    systemPrompt:
      'Verteile Content an die freigegebenen Kanäle (CMS, Newsletter, Social). Setze UTM, halte Schedule.',
    tools: ['cms.publish', 'mail.send', 'social.schedule'],
    recentRuns: [{ at: 'gestern · 20:00', status: 'done', summary: 'Newsletter #41 versendet' }],
  },
  human: {
    id: 'human',
    label: 'Human Reviewer',
    systemPrompt: 'Manuelle Approval erforderlich. Outputs landen in der Review-Queue.',
    tools: ['queue.notify'],
    recentRuns: [{ at: 'heute · 14:18', status: 'review', summary: '1 Item in Queue' }],
  },
  ops: {
    id: 'ops',
    label: 'Ops',
    systemPrompt: 'Sammle Logs, deliver Artefakte, eskaliere bei Fehlern.',
    tools: ['logs.fetch', 'webhook.send'],
    recentRuns: [{ at: 'heute · 09:00', status: 'done', summary: 'Daily compliance bundle' }],
  },
  classifier: {
    id: 'classifier',
    label: 'AI-Act Classifier',
    systemPrompt: 'Klassifiziere Use-Cases nach AI-Act-Risikoklassen (minimal/limited/high/prohibited).',
    tools: ['policy.match', 'memory.read'],
    recentRuns: [{ at: 'heute · 09:05', status: 'done', summary: '12 Systeme klassifiziert' }],
  },
  monitor: {
    id: 'monitor',
    label: 'Drift-Monitor',
    systemPrompt: 'Vergleiche Output-Verteilungen gegen Baseline, warne bei Drift > 2σ.',
    tools: ['metrics.read', 'alert.send'],
    recentRuns: [{ at: 'heute · 09:10', status: 'done', summary: 'Kein Drift erkannt' }],
  },
  fetcher: {
    id: 'fetcher',
    label: 'Source Fetcher',
    systemPrompt: 'Lade Quellen, normalisiere zu Markdown, speichere in Memory.',
    tools: ['web.fetch', 'memory.write'],
    recentRuns: [{ at: 'heute · 08:30', status: 'done', summary: '42 URLs fetched' }],
  },
  curator: {
    id: 'curator',
    label: 'Curator',
    systemPrompt: 'Picke Top-Stories aus Memory + RSS, ranke nach Relevanz für ICP.',
    tools: ['rss.read', 'memory.read'],
    recentRuns: [{ at: 'gestern · 19:00', status: 'done', summary: 'Top 7 Stories' }],
  },
};

const MODELS: Model[] = [
  { id: 'opus-4-7', label: 'Claude Opus 4.7', provider: 'Anthropic', contextK: 1000, tag: 'reasoning' },
  { id: 'sonnet-4-6', label: 'Claude Sonnet 4.6', provider: 'Anthropic', contextK: 200, tag: 'balanced' },
  { id: 'haiku-4-5', label: 'Claude Haiku 4.5', provider: 'Anthropic', contextK: 200, tag: 'fast' },
  { id: 'gpt-5', label: 'GPT-5', provider: 'OpenAI', contextK: 256, tag: 'reasoning' },
  { id: 'gemini-2-5-pro', label: 'Gemini 2.5 Pro', provider: 'Google', contextK: 2000, tag: 'long-context' },
];

const WORKFLOWS: WorkflowItem[] = [
  {
    id: 'wf-content-pipeline',
    name: 'Content Pipeline',
    description: 'Idee → Draft → Review → Publish über alle Kanäle',
    status: 'running',
    lastRun: 'vor 2 min',
    steps: 6,
    tag: 'Creator',
  },
  {
    id: 'wf-leadgen',
    name: 'Lead-Gen Sweep',
    description: 'ICP-Scoring + Outreach-Sequenz via LinkedIn & Mail',
    status: 'review',
    lastRun: 'vor 18 min',
    steps: 4,
    tag: 'Business',
  },
  {
    id: 'wf-compliance',
    name: 'Compliance Daily',
    description: 'Audit-Logs, AI-Act-Checks, Drift-Alerts',
    status: 'done',
    lastRun: 'vor 1 h',
    steps: 5,
    tag: 'Ops',
  },
  {
    id: 'wf-research',
    name: 'Deep Research',
    description: 'Multi-Agent-Brief + Quellen-Cross-Check',
    status: 'blocked',
    lastRun: 'vor 4 h',
    steps: 7,
    tag: 'Knowledge',
  },
  {
    id: 'wf-newsletter',
    name: 'Weekly Newsletter',
    description: 'Top-Picks → Entwurf → Schedule',
    status: 'idle',
    lastRun: 'gestern',
    steps: 3,
    tag: 'Creator',
  },
];

const STEPS: Record<string, RunStep[]> = {
  'wf-content-pipeline': [
    { id: 's1', name: 'Recherche-Brief', agent: 'researcher', status: 'done', durationMs: 4200, tokens: 12400 },
    { id: 's2', name: 'Outline', agent: 'writer', status: 'done', durationMs: 1800, tokens: 3100 },
    { id: 's3', name: 'Draft v1', agent: 'writer', status: 'running', tokens: 2100 },
    { id: 's4', name: 'Fact-Check', agent: 'critic', status: 'idle' },
    { id: 's5', name: 'SEO-Pass', agent: 'seo', status: 'idle' },
    { id: 's6', name: 'Publish', agent: 'publisher', status: 'idle' },
  ],
  'wf-leadgen': [
    { id: 's1', name: 'ICP-Filter', agent: 'researcher', status: 'done', durationMs: 2800, tokens: 800 },
    { id: 's2', name: 'Personalize', agent: 'writer', status: 'done', durationMs: 5600, tokens: 4200 },
    { id: 's3', name: 'Human Review', agent: 'human', status: 'review' },
    { id: 's4', name: 'Send Sequence', agent: 'publisher', status: 'idle' },
  ],
  'wf-compliance': [
    { id: 's1', name: 'Collect Logs', agent: 'ops', status: 'done' },
    { id: 's2', name: 'AI-Act Classify', agent: 'classifier', status: 'done' },
    { id: 's3', name: 'Drift-Scan', agent: 'monitor', status: 'done' },
    { id: 's4', name: 'Report', agent: 'writer', status: 'done' },
    { id: 's5', name: 'Notify', agent: 'publisher', status: 'done' },
  ],
  'wf-research': [
    { id: 's1', name: 'Query Expansion', agent: 'researcher', status: 'done' },
    { id: 's2', name: 'Source Fetch', agent: 'fetcher', status: 'done' },
    { id: 's3', name: 'Summarize', agent: 'writer', status: 'done' },
    { id: 's4', name: 'Cross-Check', agent: 'critic', status: 'blocked' },
    { id: 's5', name: 'Synthesize', agent: 'writer', status: 'idle' },
    { id: 's6', name: 'Brief PDF', agent: 'publisher', status: 'idle' },
    { id: 's7', name: 'Deliver', agent: 'ops', status: 'idle' },
  ],
  'wf-newsletter': [
    { id: 's1', name: 'Pick Stories', agent: 'curator', status: 'idle' },
    { id: 's2', name: 'Draft', agent: 'writer', status: 'idle' },
    { id: 's3', name: 'Schedule', agent: 'publisher', status: 'idle' },
  ],
};

const LOGS: LogLine[] = [
  { ts: '14:32:08', level: 'agent', source: 'researcher', message: 'Brief fertig — 14 Quellen, 12.4k Tokens.' },
  { ts: '14:32:12', level: 'info', source: 'orchestrator', message: 'Step 2 (Outline) gestartet.' },
  { ts: '14:32:19', level: 'agent', source: 'writer', message: 'Outline mit 6 Sektionen erzeugt.' },
  { ts: '14:32:21', level: 'info', source: 'orchestrator', message: 'Step 3 (Draft v1) gestartet.' },
  { ts: '14:32:34', level: 'agent', source: 'writer', message: 'Streaming … (2.1k Tokens)' },
  { ts: '14:32:35', level: 'warn', source: 'guardrails', message: 'PII-Heuristik: Platzhalter [EMAIL] in Output.' },
];

function StatusDot({ value }: { value: RunStatus }) {
  const map: Record<RunStatus, string> = {
    idle: 'bg-titanium-600',
    running: 'bg-ai-cyan-400 animate-pulse',
    blocked: 'bg-amber-400',
    review: 'bg-brass-400',
    done: 'bg-emerald-500',
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${map[value]}`} aria-hidden />;
}

function StatusChip({ value }: { value: RunStatus }) {
  const map: Record<RunStatus, { label: string; cls: string; Icon: typeof Activity }> = {
    idle: {
      label: 'idle',
      cls: 'border-titanium-800 bg-titanium-900/60 text-titanium-400',
      Icon: CircleDot,
    },
    running: {
      label: 'running',
      cls: 'border-ai-cyan-700/60 bg-ai-cyan-900/40 text-ai-cyan-300',
      Icon: Loader2,
    },
    blocked: {
      label: 'blocked',
      cls: 'border-amber-700/60 bg-amber-950/40 text-amber-300',
      Icon: AlertTriangle,
    },
    review: {
      label: 'review',
      cls: 'border-brass-700/60 bg-brass-900/40 text-brass-200',
      Icon: Eye,
    },
    done: {
      label: 'done',
      cls: 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300',
      Icon: CheckCircle2,
    },
  };
  const { label, cls, Icon } = map[value];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider ${cls}`}
    >
      <Icon className={`h-3 w-3 ${value === 'running' ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
}

type NavKey = 'workflows' | 'agents' | 'runs' | 'library' | 'connectors' | 'settings';

const NAV: Array<{ key: NavKey; label: string; Icon: typeof Activity; count?: number }> = [
  { key: 'workflows', label: 'Workflows', Icon: Workflow, count: WORKFLOWS.length },
  { key: 'agents', label: 'Agents', Icon: Bot, count: 8 },
  { key: 'runs', label: 'Runs', Icon: Activity, count: 124 },
  { key: 'library', label: 'Library', Icon: Layers },
  { key: 'connectors', label: 'Connectors', Icon: GitBranch, count: 12 },
  { key: 'settings', label: 'Settings', Icon: Settings },
];

type TabKey = 'canvas' | 'logs' | 'output' | 'config';

function ModelSelector({ value, onChange }: { value: Model; onChange: (m: Model) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-titanium-800 bg-obsidian-700/80 px-3 py-1.5 text-sm text-titanium-100 hover:border-titanium-700 hover:bg-obsidian-600"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Cpu className="h-4 w-4 text-ai-cyan-400" />
        <span className="font-medium">{value.label}</span>
        <span className="text-titanium-500 text-xs">{value.contextK}k</span>
        <ChevronDown className={`h-3.5 w-3.5 text-titanium-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute right-0 z-30 mt-1.5 w-72 overflow-hidden rounded-md border border-titanium-800 bg-obsidian-800 shadow-2xl shadow-black/60"
          role="listbox"
        >
          {MODELS.map((m) => {
            const active = m.id === value.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition ${
                  active ? 'bg-security-900/40 text-titanium-50' : 'text-titanium-200 hover:bg-obsidian-700'
                }`}
                role="option"
                aria-selected={active}
              >
                <Cpu className={`mt-0.5 h-4 w-4 ${active ? 'text-ai-cyan-400' : 'text-titanium-500'}`} />
                <span className="flex-1">
                  <span className="block font-medium">{m.label}</span>
                  <span className="block text-[11px] text-titanium-500">
                    {m.provider} · {m.contextK}k ctx
                    {m.tag ? ` · ${m.tag}` : ''}
                  </span>
                </span>
                {active && <CheckCircle2 className="h-4 w-4 text-ai-cyan-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sidebar({
  active,
  onSelect,
  query,
  setQuery,
  mobileOpen,
  onCloseMobile,
  activeRuns,
  liveData,
}: {
  active: NavKey;
  onSelect: (k: NavKey) => void;
  query: string;
  setQuery: (q: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  activeRuns: number;
  liveData: boolean;
}) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-titanium-900 bg-obsidian-900 transition-transform md:static md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-security-500 to-ai-cyan-500 shadow-inner shadow-black/40">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold text-titanium-50">Command Center</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-titanium-500">AI · Operating Layer</div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="ml-auto rounded border border-titanium-800 bg-obsidian-700 p-1 text-titanium-300 md:hidden"
          aria-label="Sidebar schließen"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-titanium-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen … (⌘K)"
            className="w-full rounded-md border border-titanium-900 bg-obsidian-800 py-1.5 pl-8 pr-2 text-xs text-titanium-100 placeholder-titanium-600 outline-none focus:border-security-700"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-titanium-600">
          Operate
        </div>
        {NAV.map(({ key, label, Icon, count }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition ${
                isActive
                  ? 'bg-security-900/40 text-titanium-50'
                  : 'text-titanium-300 hover:bg-obsidian-800 hover:text-titanium-100'
              }`}
            >
              <Icon
                className={`h-4 w-4 ${
                  isActive ? 'text-ai-cyan-400' : 'text-titanium-500 group-hover:text-titanium-300'
                }`}
              />
              <span className="flex-1 text-left">{label}</span>
              {typeof count === 'number' && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    isActive ? 'bg-security-800 text-titanium-100' : 'bg-obsidian-700 text-titanium-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-titanium-900 p-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-titanium-600">
          <span>Runtime</span>
          {liveData ? (
            <span className="inline-flex items-center gap-1.5 rounded border border-ai-cyan-700/60 bg-ai-cyan-900/30 px-1.5 py-0.5 text-ai-cyan-300">
              <Radio className="h-2.5 w-2.5 animate-pulse" />
              live data
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-titanium-500">
              <StatusDot value="idle" />
              mock
            </span>
          )}
        </div>
        <div className="mt-2 text-xs text-titanium-300">
          <div className="flex justify-between">
            <span className="text-titanium-500">Active Runs</span>
            <span className="font-mono">{activeRuns}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-titanium-500">Today Tokens</span>
            <span className="font-mono">412k</span>
          </div>
        </div>
      </div>
      </aside>
    </>
  );
}

function Topbar({
  workflow,
  model,
  setModel,
  status,
  editing,
  onToggleEdit,
  onRun,
  onPause,
  onStop,
  onOpenMobileNav,
}: {
  workflow: WorkflowItem;
  model: Model;
  setModel: (m: Model) => void;
  status: RunStatus;
  editing: boolean;
  onToggleEdit: () => void;
  onRun: () => void;
  onPause: () => void;
  onStop: () => void;
  onOpenMobileNav: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-titanium-900 bg-obsidian-900/80 px-3 backdrop-blur sm:px-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="rounded-md border border-titanium-800 bg-obsidian-700 p-1.5 text-titanium-200 hover:bg-obsidian-600 md:hidden"
          aria-label="Navigation öffnen"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="hidden h-8 w-8 shrink-0 place-items-center rounded-md border border-titanium-800 bg-obsidian-700 sm:grid">
          <Workflow className="h-4 w-4 text-ai-cyan-400" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-titanium-50">{workflow.name}</div>
          <div className="hidden truncate text-[11px] text-titanium-500 sm:block">
            {workflow.tag} · {workflow.steps} Schritte · {workflow.lastRun}
          </div>
        </div>
        <div className="hidden sm:block">
          <StatusChip value={status} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="hidden lg:block">
          <ModelSelector value={model} onChange={setModel} />
        </div>

        <div className="mx-1 hidden h-6 w-px bg-titanium-900 lg:block" />

        <button
          type="button"
          onClick={onToggleEdit}
          aria-pressed={editing}
          className={`hidden items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm transition sm:inline-flex ${
            editing
              ? 'border-ai-cyan-700 bg-ai-cyan-900/30 text-ai-cyan-200'
              : 'border-titanium-800 bg-obsidian-700 text-titanium-200 hover:border-titanium-700 hover:bg-obsidian-600'
          }`}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span>{editing ? 'Bearbeiten an' : 'Bearbeiten'}</span>
        </button>

        <button
          type="button"
          onClick={onRun}
          className="inline-flex items-center gap-1.5 rounded-md bg-security-600 px-2.5 py-1.5 text-sm font-medium text-white shadow-sm shadow-security-900/50 hover:bg-security-500 sm:px-3"
        >
          <Play className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Run</span>
        </button>
        <button
          type="button"
          onClick={onPause}
          className="inline-flex items-center gap-1.5 rounded-md border border-titanium-800 bg-obsidian-700 px-2 py-1.5 text-sm text-titanium-200 hover:border-titanium-700 hover:bg-obsidian-600"
          aria-label="Pause"
        >
          <Pause className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onStop}
          className="inline-flex items-center gap-1.5 rounded-md border border-titanium-800 bg-obsidian-700 px-2 py-1.5 text-sm text-titanium-200 hover:border-rose-800 hover:bg-rose-950/30 hover:text-rose-200"
          aria-label="Stop"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}

function WorkflowList({
  workflows,
  selectedId,
  onSelect,
  query,
}: {
  workflows: WorkflowItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  query: string;
}) {
  const filtered = workflows.filter((w) =>
    query ? (w.name + ' ' + w.description + ' ' + w.tag).toLowerCase().includes(query.toLowerCase()) : true,
  );
  return (
    <div className="hidden h-full w-80 shrink-0 flex-col border-r border-titanium-900 bg-obsidian-900/40 lg:flex">
      <div className="flex items-center justify-between border-b border-titanium-900 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-titanium-500">Workflows</div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-titanium-800 bg-obsidian-700 px-1.5 py-1 text-[11px] text-titanium-200 hover:bg-obsidian-600"
        >
          <Plus className="h-3 w-3" /> Neu
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {filtered.map((w) => {
          const active = w.id === selectedId;
          return (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => onSelect(w.id)}
                className={`mb-1 block w-full rounded-md border p-3 text-left transition ${
                  active
                    ? 'border-security-700/60 bg-security-900/30'
                    : 'border-transparent hover:border-titanium-800 hover:bg-obsidian-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-titanium-50">{w.name}</span>
                  <StatusDot value={w.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] text-titanium-400">{w.description}</p>
                <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-titanium-600">
                  <span>{w.tag}</span>
                  <span>{w.lastRun}</span>
                </div>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-titanium-500">Keine Treffer.</li>
        )}
      </ul>
    </div>
  );
}

function Tabs({ value, onChange }: { value: TabKey; onChange: (k: TabKey) => void }) {
  const tabs: Array<{ key: TabKey; label: string; Icon: typeof Activity }> = [
    { key: 'canvas', label: 'Canvas', Icon: LayoutGrid },
    { key: 'logs', label: 'Logs', Icon: Terminal },
    { key: 'output', label: 'Output', Icon: Sparkles },
    { key: 'config', label: 'Config', Icon: Settings },
  ];
  return (
    <div className="flex items-center gap-1 border-b border-titanium-900 bg-obsidian-900/40 px-3 pt-2">
      {tabs.map(({ key, label, Icon }) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`relative inline-flex items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-xs font-medium transition ${
              active
                ? 'border-titanium-900 bg-obsidian-800 text-titanium-50'
                : 'border-transparent text-titanium-400 hover:text-titanium-100'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-security-500 to-ai-cyan-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function CanvasView({
  steps,
  editing,
  onSelectStep,
  onRenameStep,
  onChangeAgent,
  onMoveStep,
  onRemoveStep,
  onAddStep,
}: {
  steps: RunStep[];
  editing: boolean;
  onSelectStep: (id: string) => void;
  onRenameStep: (id: string, name: string) => void;
  onChangeAgent: (id: string, agent: string) => void;
  onMoveStep: (id: string, dir: -1 | 1) => void;
  onRemoveStep: (id: string) => void;
  onAddStep: () => void;
}) {
  if (steps.length === 0 && !editing) {
    return (
      <EmptyState
        Icon={LayoutGrid}
        title="Noch keine Schritte"
        hint="Füge den ersten Schritt zu diesem Workflow hinzu, um den Canvas zu sehen."
      />
    );
  }
  return (
    <div className="grid gap-3 p-3 sm:p-4 sm:grid-cols-2 xl:grid-cols-3">
      {steps.map((s, i) => (
        <article
          key={s.id}
          className="group relative rounded-lg border border-titanium-900 bg-obsidian-800/60 p-3 transition hover:border-titanium-800"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-titanium-800 bg-obsidian-700 font-mono text-[10px] text-titanium-300">
                {String(i + 1).padStart(2, '0')}
              </span>
              {editing ? (
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => onRenameStep(s.id, e.target.value)}
                  className="min-w-0 flex-1 rounded border border-titanium-800 bg-obsidian-900 px-1.5 py-0.5 text-sm text-titanium-50 focus:border-ai-cyan-700 focus:outline-none"
                  aria-label="Step-Name"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectStep(s.id)}
                  className="min-w-0 truncate text-left text-sm font-medium text-titanium-50 hover:text-ai-cyan-300 focus:outline-none focus-visible:text-ai-cyan-300"
                >
                  {s.name}
                </button>
              )}
            </div>
            {editing ? (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMoveStep(s.id, -1)}
                  disabled={i === 0}
                  className="rounded border border-titanium-800 bg-obsidian-700 p-1 text-titanium-300 enabled:hover:border-titanium-700 enabled:hover:bg-obsidian-600 disabled:opacity-40"
                  aria-label="nach oben"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveStep(s.id, 1)}
                  disabled={i === steps.length - 1}
                  className="rounded border border-titanium-800 bg-obsidian-700 p-1 text-titanium-300 enabled:hover:border-titanium-700 enabled:hover:bg-obsidian-600 disabled:opacity-40"
                  aria-label="nach unten"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveStep(s.id)}
                  className="rounded border border-titanium-800 bg-obsidian-700 p-1 text-titanium-300 hover:border-rose-800 hover:bg-rose-950/30 hover:text-rose-200"
                  aria-label="Schritt entfernen"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <StatusChip value={s.status} />
            )}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-titanium-500">
            <Bot className="h-3 w-3" />
            {editing ? (
              <select
                value={s.agent}
                onChange={(e) => onChangeAgent(s.id, e.target.value)}
                className="rounded border border-titanium-800 bg-obsidian-900 px-1.5 py-0.5 font-mono text-[11px] text-titanium-200 focus:border-ai-cyan-700 focus:outline-none"
                aria-label="Agent"
              >
                {KNOWN_AGENTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                onClick={() => onSelectStep(s.id)}
                className="font-mono hover:text-ai-cyan-300 focus:outline-none focus-visible:text-ai-cyan-300"
              >
                {s.agent}
              </button>
            )}
            {!editing && typeof s.tokens === 'number' && (
              <>
                <span className="text-titanium-700">·</span>
                <span>{s.tokens.toLocaleString('de-DE')} tok</span>
              </>
            )}
            {!editing && typeof s.durationMs === 'number' && (
              <>
                <span className="text-titanium-700">·</span>
                <span>{(s.durationMs / 1000).toFixed(1)}s</span>
              </>
            )}
          </div>
          {!editing && s.status === 'running' && (
            <div className="mt-3 h-1 overflow-hidden rounded bg-obsidian-700">
              <div className="h-full w-2/3 animate-pulse bg-gradient-to-r from-security-500 to-ai-cyan-400" />
            </div>
          )}
          {!editing && s.status === 'review' && (
            <div className="mt-3 rounded border border-brass-800/50 bg-brass-900/20 p-2 text-[11px] text-brass-200">
              Wartet auf Human-Approval.
            </div>
          )}
          {!editing && s.status === 'blocked' && (
            <div className="mt-3 rounded border border-amber-800/50 bg-amber-950/30 p-2 text-[11px] text-amber-200">
              Quelle nicht erreichbar — Retry erforderlich.
            </div>
          )}
        </article>
      ))}
      {editing && (
        <button
          type="button"
          onClick={onAddStep}
          className="flex min-h-[6rem] items-center justify-center gap-2 rounded-lg border border-dashed border-titanium-800 bg-obsidian-900/40 p-3 text-sm text-titanium-400 transition hover:border-ai-cyan-700 hover:bg-ai-cyan-900/10 hover:text-ai-cyan-300"
        >
          <Plus className="h-4 w-4" />
          Schritt hinzufügen
        </button>
      )}
    </div>
  );
}

function LogsView({ logs }: { logs: LogLine[] }) {
  const color: Record<LogLine['level'], string> = {
    info: 'text-titanium-300',
    warn: 'text-amber-300',
    error: 'text-rose-300',
    agent: 'text-ai-cyan-300',
  };
  if (logs.length === 0) {
    return (
      <EmptyState
        Icon={Terminal}
        title="Noch keine Logs"
        hint="Sobald ein Run startet, erscheinen hier Streaming-Events von Orchestrator und Agents."
      />
    );
  }
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="rounded-md border border-titanium-900 bg-obsidian-950 p-3 font-mono text-[12px] leading-relaxed">
        {logs.map((l, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-titanium-600">{l.ts}</span>
            <span className={`w-12 shrink-0 uppercase ${color[l.level]}`}>{l.level}</span>
            <span className="w-28 shrink-0 truncate text-titanium-500">{l.source}</span>
            <span className="text-titanium-200">{l.message}</span>
          </div>
        ))}
        <div className="mt-2 flex gap-2 text-titanium-600">
          <span className="text-ai-cyan-400">▍</span>
          <span>stream live …</span>
        </div>
      </div>
    </div>
  );
}

function OutputView({ workflow }: { workflow: WorkflowItem }) {
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-3">
      <div className="rounded-lg border border-titanium-900 bg-obsidian-800/60 p-4 lg:col-span-2">
        <div className="text-xs uppercase tracking-[0.18em] text-titanium-500">Letzter Output</div>
        <h3 className="mt-1 text-lg font-semibold text-titanium-50">{workflow.name} — Draft v1</h3>
        <article className="prose prose-invert prose-sm mt-3 max-w-none text-titanium-200">
          <p>
            Dies ist ein automatisch generierter Entwurf basierend auf dem letzten Recherche-Brief.
            Der Output kann via <em>Tab „Canvas"</em> Schritt für Schritt nachverfolgt werden.
          </p>
          <ul>
            <li>3 Kernthesen extrahiert</li>
            <li>14 Primärquellen verifiziert</li>
            <li>1 Human-Review-Gate aktiv</li>
          </ul>
        </article>
      </div>
      <aside className="space-y-3">
        <div className="rounded-lg border border-titanium-900 bg-obsidian-800/60 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-titanium-500">Kosten</div>
          <div className="mt-1 font-display text-2xl text-titanium-50">€ 0,42</div>
          <div className="text-[11px] text-titanium-500">412.000 Tokens · 6 Schritte</div>
        </div>
        <div className="rounded-lg border border-titanium-900 bg-obsidian-800/60 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-titanium-500">Artefakte</div>
          <ul className="mt-2 space-y-1.5 text-sm text-titanium-200">
            <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-ai-cyan-400" /> brief.md</li>
            <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-ai-cyan-400" /> outline.json</li>
            <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-ai-cyan-400" /> draft-v1.md</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function ConfigView({ workflow, model }: { workflow: WorkflowItem; model: Model }) {
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <section className="rounded-lg border border-titanium-900 bg-obsidian-800/60 p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-titanium-500">Workflow</div>
        <dl className="mt-2 space-y-2 text-sm">
          <Row k="ID" v={workflow.id} mono />
          <Row k="Name" v={workflow.name} />
          <Row k="Schritte" v={String(workflow.steps)} />
          <Row k="Tag" v={workflow.tag} />
        </dl>
      </section>
      <section className="rounded-lg border border-titanium-900 bg-obsidian-800/60 p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-titanium-500">Runtime</div>
        <dl className="mt-2 space-y-2 text-sm">
          <Row k="Model" v={`${model.label} (${model.provider})`} />
          <Row k="Context" v={`${model.contextK}k`} />
          <Row k="Mode" v={model.tag ?? '—'} />
          <Row k="Guardrails" v="PII · Toxicity · License" />
        </dl>
      </section>
    </div>
  );
}

function EmptyState({
  Icon,
  title,
  hint,
  action,
}: {
  Icon: typeof Activity;
  title: string;
  hint: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full border border-titanium-900 bg-obsidian-800/60">
        <Icon className="h-6 w-6 text-titanium-600" />
      </div>
      <div className="text-sm font-semibold text-titanium-200">{title}</div>
      <div className="max-w-xs text-[12px] leading-relaxed text-titanium-500">{hint}</div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-titanium-800 bg-obsidian-700 px-3 py-1.5 text-xs text-titanium-200 hover:border-ai-cyan-700 hover:bg-ai-cyan-900/30 hover:text-ai-cyan-300"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['R'], label: 'Run starten' },
  { keys: ['P'], label: 'Pausieren' },
  { keys: ['S'], label: 'Stoppen' },
  { keys: ['1'], label: 'Tab: Canvas' },
  { keys: ['2'], label: 'Tab: Logs' },
  { keys: ['3'], label: 'Tab: Output' },
  { keys: ['4'], label: 'Tab: Config' },
  { keys: ['?'], label: 'Diese Hilfe zeigen' },
  { keys: ['Esc'], label: 'Overlay schließen' },
];

function KeyboardHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Keyboard-Shortcuts"
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-lg border border-titanium-800 bg-obsidian-900 shadow-2xl shadow-black/70"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-titanium-900 px-4 py-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-ai-cyan-400" />
            <h3 className="text-sm font-semibold text-titanium-50">Shortcuts</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-titanium-800 bg-obsidian-700 p-1 text-titanium-300 hover:bg-obsidian-600"
            aria-label="Schließen"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>
        <ul className="divide-y divide-titanium-900/60">
          {SHORTCUTS.map((s, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="text-titanium-300">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-titanium-800 bg-obsidian-800 px-1.5 py-0.5 font-mono text-[11px] text-titanium-200"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <footer className="border-t border-titanium-900 px-4 py-2 text-[11px] text-titanium-500">
          Shortcuts greifen nicht in Inputs/Textareas.
        </footer>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-titanium-900/60 py-1.5 last:border-0">
      <dt className="text-titanium-500">{k}</dt>
      <dd className={`text-titanium-100 ${mono ? 'font-mono text-xs' : ''}`}>{v}</dd>
    </div>
  );
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

function AgentsView({ query }: { query: string }) {
  const filtered = AGENTS_OVERVIEW.filter((a) =>
    query
      ? (a.label + ' ' + a.description + ' ' + a.tools.join(' ') + ' ' + a.id)
          .toLowerCase()
          .includes(query.toLowerCase())
      : true,
  );
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-titanium-900 bg-obsidian-900/40 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-titanium-50">Agents</h2>
          <p className="text-[11px] text-titanium-500">
            {filtered.length} aktiv · System-Prompts + Tool-Mappings
          </p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <article
              key={a.id}
              className="rounded-lg border border-titanium-900 bg-obsidian-800/60 p-3 transition hover:border-titanium-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-titanium-800 bg-obsidian-700">
                    <Bot className="h-4 w-4 text-ai-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-titanium-50">{a.label}</div>
                    <div className="truncate font-mono text-[10px] text-titanium-500">{a.id}</div>
                  </div>
                </div>
                <StatusChip value={a.status} />
              </div>
              <p className="mt-2 line-clamp-2 text-[12px] text-titanium-400">{a.description}</p>
              <div className="mt-2.5 flex items-center gap-1 text-[10px] text-titanium-500">
                <Wrench className="h-3 w-3" />
                {a.tools.slice(0, 3).map((t, i) => (
                  <span key={i} className="rounded border border-titanium-800 bg-obsidian-900 px-1.5 py-0.5 font-mono">
                    {t}
                  </span>
                ))}
                {a.tools.length > 3 && (
                  <span className="text-titanium-600">+{a.tools.length - 3}</span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-titanium-900/60 pt-2 text-[10px] uppercase tracking-wider text-titanium-600">
                <span>{a.totalRuns} Runs</span>
                <span>{a.lastRun}</span>
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-md border border-dashed border-titanium-800 p-8 text-center text-xs text-titanium-500">
              Keine Agents für „{query}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentDrawer({
  step,
  model,
  onClose,
}: {
  step: RunStep | null;
  model: Model;
  onClose: () => void;
}) {
  if (!step) return null;
  const profile =
    AGENT_PROFILES[step.agent] ?? {
      id: step.agent,
      label: step.agent,
      systemPrompt: 'Kein Profil hinterlegt.',
      tools: [],
      recentRuns: [],
    };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label={`Agent ${profile.label}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-titanium-900 bg-obsidian-900 shadow-2xl shadow-black/70"
      >
        <header className="flex items-center justify-between gap-3 border-b border-titanium-900 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-md border border-titanium-800 bg-obsidian-700">
              <Bot className="h-4 w-4 text-ai-cyan-400" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-titanium-50">{profile.label}</div>
              <div className="truncate text-[11px] text-titanium-500">
                Step <span className="font-mono">{step.name}</span> · {model.label}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-titanium-800 bg-obsidian-700 p-1 text-titanium-300 hover:bg-obsidian-600"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between">
            <StatusChip value={step.status} />
            <div className="text-[11px] text-titanium-500">
              {typeof step.tokens === 'number' && <>{step.tokens.toLocaleString('de-DE')} tok</>}
              {typeof step.durationMs === 'number' && (
                <> · {(step.durationMs / 1000).toFixed(1)}s</>
              )}
            </div>
          </div>

          <section className="mt-4">
            <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-titanium-500">
              <Sparkles className="h-3 w-3" /> System-Prompt
            </h4>
            <p className="mt-1.5 rounded-md border border-titanium-900 bg-obsidian-800/60 p-3 text-[12px] leading-relaxed text-titanium-200">
              {profile.systemPrompt}
            </p>
          </section>

          <section className="mt-4">
            <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-titanium-500">
              <Wrench className="h-3 w-3" /> Tools
            </h4>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {profile.tools.length === 0 ? (
                <li className="text-[12px] text-titanium-500">Keine Tools.</li>
              ) : (
                profile.tools.map((t) => (
                  <li
                    key={t}
                    className="rounded-full border border-titanium-800 bg-obsidian-800 px-2 py-0.5 font-mono text-[11px] text-titanium-200"
                  >
                    {t}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="mt-4">
            <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-titanium-500">
              <History className="h-3 w-3" /> Letzte Runs
            </h4>
            <ul className="mt-1.5 space-y-1.5">
              {profile.recentRuns.length === 0 ? (
                <li className="text-[12px] text-titanium-500">Noch keine Historie.</li>
              ) : (
                profile.recentRuns.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-md border border-titanium-900 bg-obsidian-800/60 px-2.5 py-1.5 text-[12px]"
                  >
                    <span className="text-titanium-300">{r.summary}</span>
                    <span className="flex items-center gap-2 text-titanium-500">
                      <StatusDot value={r.status} />
                      <span className="text-[10px] uppercase tracking-wider">{r.at}</span>
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          {step.output && (
            <section className="mt-4">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-titanium-500">
                Aktueller Output
              </h4>
              <pre className="mt-1.5 max-h-48 overflow-auto rounded-md border border-titanium-900 bg-obsidian-950 p-3 font-mono text-[11px] text-titanium-200">
                {step.output}
              </pre>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

const STREAM_TICK_MS = 1400;
const STREAM_TOKENS_PER_TICK = 850;
const STREAM_COMPLETE_AT = 6000;

const KNOWN_AGENTS = Object.keys(AGENT_PROFILES);

interface AgentOverviewEntry {
  id: string;
  label: string;
  description: string;
  tools: string[];
  totalRuns: number;
  lastRun: string;
  status: RunStatus;
}

const AGENTS_OVERVIEW: AgentOverviewEntry[] = [
  { id: 'researcher', label: 'Researcher', description: 'Sammelt Primärquellen, gewichtet nach Reputabilität.', tools: AGENT_PROFILES.researcher.tools, totalRuns: 312, lastRun: 'vor 2 min', status: 'done' },
  { id: 'writer', label: 'Writer', description: 'Lang-Form-Drafts in Markenstimme, mit Fact-Markup.', tools: AGENT_PROFILES.writer.tools, totalRuns: 487, lastRun: 'vor 1 min', status: 'running' },
  { id: 'critic', label: 'Critic', description: 'Verifiziert Behauptungen gegen Quellen, schreibt Diffs.', tools: AGENT_PROFILES.critic.tools, totalRuns: 198, lastRun: 'vor 12 min', status: 'idle' },
  { id: 'seo', label: 'SEO', description: 'E-E-A-T-Pass, Entity-Coverage, kein Keyword-Stuffing.', tools: AGENT_PROFILES.seo.tools, totalRuns: 144, lastRun: 'vor 1 h', status: 'idle' },
  { id: 'publisher', label: 'Publisher', description: 'Verteilt Content an freigegebene Kanäle, setzt UTM.', tools: AGENT_PROFILES.publisher.tools, totalRuns: 221, lastRun: 'vor 18 min', status: 'idle' },
  { id: 'classifier', label: 'AI-Act Classifier', description: 'Klassifiziert Use-Cases nach AI-Act-Risikoklassen.', tools: AGENT_PROFILES.classifier.tools, totalRuns: 76, lastRun: 'vor 1 h', status: 'done' },
  { id: 'monitor', label: 'Drift-Monitor', description: 'Vergleicht Output-Verteilungen gegen Baseline.', tools: AGENT_PROFILES.monitor.tools, totalRuns: 1248, lastRun: 'vor 4 min', status: 'done' },
  { id: 'ops', label: 'Ops', description: 'Sammelt Logs, deliver Artefakte, eskaliert bei Fehlern.', tools: AGENT_PROFILES.ops.tools, totalRuns: 542, lastRun: 'vor 7 min', status: 'idle' },
];

export function AiCommandCenter() {
  const [nav, setNav] = useState<NavKey>('workflows');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(WORKFLOWS[0].id);
  const [tab, setTab] = useState<TabKey>('canvas');
  const [model, setModel] = useState<Model>(MODELS[0]);
  const [runStatus, setRunStatus] = useState<RunStatus>('running');
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [openStepId, setOpenStepId] = useState<string | null>(null);
  const [stepsByWf, setStepsByWf] = useState<Record<string, RunStep[]>>(() =>
    JSON.parse(JSON.stringify(STEPS)),
  );
  const [logs, setLogs] = useState<LogLine[]>(LOGS);
  const stepCounter = useRef(100);

  const { runs: liveRuns, live: liveData } = useRecentAgentRuns(20);

  const workflow = useMemo(
    () => WORKFLOWS.find((w) => w.id === selectedId) ?? WORKFLOWS[0],
    [selectedId],
  );
  const steps = stepsByWf[workflow.id] ?? [];
  const openStep = useMemo(
    () => (openStepId ? steps.find((s) => s.id === openStepId) ?? null : null),
    [openStepId, steps],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (helpOpen) {
          e.preventDefault();
          setHelpOpen(false);
        }
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (k === 'r') {
        e.preventDefault();
        setRunStatus('running');
      } else if (k === 'p') {
        e.preventDefault();
        setRunStatus('idle');
      } else if (k === 's') {
        e.preventDefault();
        setRunStatus('idle');
      } else if (k === '1') {
        e.preventDefault();
        setTab('canvas');
      } else if (k === '2') {
        e.preventDefault();
        setTab('logs');
      } else if (k === '3') {
        e.preventDefault();
        setTab('output');
      } else if (k === '4') {
        e.preventDefault();
        setTab('config');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [helpOpen]);

  // Live-Streaming-Simulation: tickt jeden running-Step weiter, schaltet bei
  // STREAM_COMPLETE_AT auf done und startet den nächsten idle-Step. Stoppt,
  // sobald keine Schritte mehr offen sind.
  useEffect(() => {
    if (runStatus !== 'running') return;
    const id = window.setInterval(() => {
      setStepsByWf((prev) => {
        const next = { ...prev };
        const list = [...(next[workflow.id] ?? [])];
        if (list.length === 0) return prev;

        const runningIdx = list.findIndex((s) => s.status === 'running');
        if (runningIdx >= 0) {
          const s = { ...list[runningIdx] };
          s.tokens = (s.tokens ?? 0) + STREAM_TOKENS_PER_TICK;
          if ((s.tokens ?? 0) >= STREAM_COMPLETE_AT) {
            s.status = 'done';
            s.durationMs = (s.durationMs ?? 0) + STREAM_TICK_MS * 3;
            setLogs((l) => [
              ...l,
              { ts: nowTime(), level: 'agent', source: s.agent, message: `${s.name}: fertig (${s.tokens?.toLocaleString('de-DE')} tok).` },
            ]);
          } else if (Math.random() < 0.4) {
            setLogs((l) => [
              ...l,
              { ts: nowTime(), level: 'agent', source: s.agent, message: `Streaming … (${s.tokens?.toLocaleString('de-DE')} tok)` },
            ]);
          }
          list[runningIdx] = s;
        }

        const stillRunning = list.some((s) => s.status === 'running');
        if (!stillRunning) {
          const nextIdleIdx = list.findIndex((s) => s.status === 'idle');
          if (nextIdleIdx >= 0) {
            const s = { ...list[nextIdleIdx], status: 'running' as RunStatus, tokens: 0 };
            list[nextIdleIdx] = s;
            setLogs((l) => [
              ...l,
              { ts: nowTime(), level: 'info', source: 'orchestrator', message: `Step ${nextIdleIdx + 1} (${s.name}) gestartet.` },
            ]);
          } else if (list.every((s) => s.status === 'done')) {
            setRunStatus('done');
            setLogs((l) => [
              ...l,
              { ts: nowTime(), level: 'info', source: 'orchestrator', message: `Workflow „${workflow.name}" abgeschlossen.` },
            ]);
          }
        }

        next[workflow.id] = list;
        return next;
      });
    }, STREAM_TICK_MS);
    return () => window.clearInterval(id);
  }, [runStatus, workflow.id, workflow.name]);

  const updateSteps = (mut: (list: RunStep[]) => RunStep[]) => {
    setStepsByWf((prev) => ({ ...prev, [workflow.id]: mut(prev[workflow.id] ?? []) }));
  };

  const handleRun = () => {
    updateSteps((list) =>
      list.map((s, i) => ({
        ...s,
        status: i === 0 ? ('running' as RunStatus) : ('idle' as RunStatus),
        tokens: i === 0 ? 0 : undefined,
        durationMs: undefined,
      })),
    );
    setLogs((l) => [
      ...l,
      { ts: nowTime(), level: 'info', source: 'orchestrator', message: `Run gestartet — Model: ${model.label}.` },
    ]);
    setRunStatus('running');
  };

  const handleAddStep = () => {
    const id = `s-new-${stepCounter.current++}`;
    updateSteps((list) => [
      ...list,
      { id, name: 'Neuer Schritt', agent: KNOWN_AGENTS[0], status: 'idle' },
    ]);
  };

  const handleRenameStep = (id: string, name: string) => {
    updateSteps((list) => list.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const handleChangeAgent = (id: string, agent: string) => {
    updateSteps((list) => list.map((s) => (s.id === id ? { ...s, agent } : s)));
  };

  const handleRemoveStep = (id: string) => {
    updateSteps((list) => list.filter((s) => s.id !== id));
  };

  const handleMoveStep = (id: string, dir: -1 | 1) => {
    updateSteps((list) => {
      const idx = list.findIndex((s) => s.id === id);
      if (idx < 0) return list;
      const next = idx + dir;
      if (next < 0 || next >= list.length) return list;
      const copy = list.slice();
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  const activeRuns = useMemo(() => {
    if (liveData) {
      return liveRuns.filter((r) => r.status === 'running' || r.status === 'pending').length;
    }
    return WORKFLOWS.filter((w) => w.status === 'running').length;
  }, [liveData, liveRuns]);

  return (
    <div className="dark flex h-screen w-screen overflow-hidden bg-obsidian-950 text-titanium-100">
      <Sidebar
        active={nav}
        onSelect={(k) => {
          setNav(k);
          setMobileNavOpen(false);
        }}
        query={query}
        setQuery={setQuery}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        activeRuns={activeRuns}
        liveData={liveData}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          workflow={workflow}
          model={model}
          setModel={setModel}
          status={runStatus}
          editing={editing}
          onToggleEdit={() => setEditing((v) => !v)}
          onRun={handleRun}
          onPause={() => setRunStatus('idle')}
          onStop={() => setRunStatus('idle')}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />

        <div className="flex min-h-0 flex-1">
          {nav === 'workflows' && (
            <WorkflowList
              workflows={WORKFLOWS}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setRunStatus(WORKFLOWS.find((w) => w.id === id)?.status ?? 'idle');
              }}
              query={query}
            />
          )}

          <main className="flex min-w-0 flex-1 flex-col">
            {nav === 'workflows' && (
              <>
                <Tabs value={tab} onChange={setTab} />
                <div className="min-h-0 flex-1 overflow-y-auto bg-obsidian-950">
                  {tab === 'canvas' && (
                    <CanvasView
                      steps={steps}
                      editing={editing}
                      onSelectStep={setOpenStepId}
                      onRenameStep={handleRenameStep}
                      onChangeAgent={handleChangeAgent}
                      onMoveStep={handleMoveStep}
                      onRemoveStep={handleRemoveStep}
                      onAddStep={handleAddStep}
                    />
                  )}
                  {tab === 'logs' && <LogsView logs={logs} />}
                  {tab === 'output' && <OutputView workflow={workflow} />}
                  {tab === 'config' && <ConfigView workflow={workflow} model={model} />}
                </div>
              </>
            )}
            {nav === 'agents' && <AgentsView query={query} />}
            {nav !== 'workflows' && nav !== 'agents' && (
              <div className="grid flex-1 place-items-center bg-obsidian-950 p-8 text-center text-xs text-titanium-500">
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-titanium-600">{nav}</div>
                  Diese Sektion ist noch nicht implementiert.
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        title="Shortcuts (?)"
        aria-label="Keyboard-Shortcuts anzeigen"
        className="fixed bottom-3 right-3 z-30 inline-flex items-center gap-1.5 rounded-full border border-titanium-800 bg-obsidian-800/90 px-2.5 py-1.5 text-[11px] text-titanium-300 shadow-lg shadow-black/40 hover:border-titanium-700 hover:text-titanium-100"
      >
        <Keyboard className="h-3.5 w-3.5" />
        <kbd className="font-mono">?</kbd>
      </button>
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AgentDrawer step={openStep} model={model} onClose={() => setOpenStepId(null)} />
    </div>
  );
}

export default AiCommandCenter;
