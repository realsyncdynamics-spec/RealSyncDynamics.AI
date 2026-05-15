import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Command as CommandIcon,
  CornerDownLeft,
  Cpu,
  Eye,
  Filter,
  GitBranch,
  History,
  Layers,
  LayoutGrid,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Square,
  Terminal,
  Workflow,
  Wrench,
  Zap,
} from 'lucide-react';

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

interface AgentEntry {
  id: string;
  label: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  totalRuns: number;
  lastRun: string;
  status: RunStatus;
}

const AGENTS: AgentEntry[] = [
  {
    id: 'researcher',
    label: 'Researcher',
    description: 'Sammelt Primärquellen, gewichtet nach Reputabilität.',
    systemPrompt: 'Du bist ein Recherche-Agent. Strukturiere Briefs mit Zitaten.',
    tools: ['web.search', 'web.fetch', 'memory.read'],
    totalRuns: 312,
    lastRun: 'vor 2 min',
    status: 'done',
  },
  {
    id: 'writer',
    label: 'Writer',
    description: 'Lang-Form-Drafts in Markenstimme, mit Fact-Markup.',
    systemPrompt: 'Halte Outline ein, markiere Faktenbehauptungen für Cross-Check.',
    tools: ['markdown.render', 'memory.read', 'style.guide'],
    totalRuns: 487,
    lastRun: 'vor 1 min',
    status: 'running',
  },
  {
    id: 'critic',
    label: 'Critic',
    description: 'Verifiziert Behauptungen gegen Quellen, schreibt Diffs.',
    systemPrompt: 'Flagge Halluzinationen, prüfe jede Behauptung gegen Quellen.',
    tools: ['web.fetch', 'diff.compute'],
    totalRuns: 198,
    lastRun: 'vor 12 min',
    status: 'idle',
  },
  {
    id: 'seo',
    label: 'SEO',
    description: 'E-E-A-T-Pass, Entity-Coverage, kein Keyword-Stuffing.',
    systemPrompt: 'Optimiere für semantic clusters und entity-coverage.',
    tools: ['serp.fetch', 'keyword.expand'],
    totalRuns: 144,
    lastRun: 'vor 1 h',
    status: 'idle',
  },
  {
    id: 'publisher',
    label: 'Publisher',
    description: 'Verteilt Content an freigegebene Kanäle, setzt UTM.',
    systemPrompt: 'Halte Schedule, setze UTM, fail-fast bei API-Fehlern.',
    tools: ['cms.publish', 'mail.send', 'social.schedule'],
    totalRuns: 221,
    lastRun: 'vor 18 min',
    status: 'idle',
  },
  {
    id: 'classifier',
    label: 'AI-Act Classifier',
    description: 'Klassifiziert Use-Cases nach AI-Act-Risikoklassen.',
    systemPrompt: 'Mappe Use-Case auf minimal/limited/high/prohibited.',
    tools: ['policy.match', 'memory.read'],
    totalRuns: 76,
    lastRun: 'vor 1 h',
    status: 'done',
  },
  {
    id: 'monitor',
    label: 'Drift-Monitor',
    description: 'Vergleicht Output-Verteilungen gegen Baseline.',
    systemPrompt: 'Warne bei Drift > 2σ. Sende Alert.',
    tools: ['metrics.read', 'alert.send'],
    totalRuns: 1248,
    lastRun: 'vor 4 min',
    status: 'done',
  },
  {
    id: 'ops',
    label: 'Ops',
    description: 'Sammelt Logs, deliver Artefakte, eskaliert bei Fehlern.',
    systemPrompt: 'Robust, idempotent, eskalations-bewusst.',
    tools: ['logs.fetch', 'webhook.send'],
    totalRuns: 542,
    lastRun: 'vor 7 min',
    status: 'idle',
  },
];

interface RunHistoryEntry {
  id: string;
  workflowId: string;
  workflowName: string;
  modelId: string;
  modelLabel: string;
  status: RunStatus;
  startedAt: string;
  durationMs: number;
  tokens: number;
  costEur: number;
  trigger: 'manual' | 'schedule' | 'webhook';
}

const RUNS_HISTORY: RunHistoryEntry[] = [
  { id: 'run-3142', workflowId: 'wf-content-pipeline', workflowName: 'Content Pipeline', modelId: 'opus-4-7', modelLabel: 'Opus 4.7', status: 'running', startedAt: 'heute · 14:32', durationMs: 412_000, tokens: 41200, costEur: 0.42, trigger: 'manual' },
  { id: 'run-3141', workflowId: 'wf-leadgen', workflowName: 'Lead-Gen Sweep', modelId: 'sonnet-4-6', modelLabel: 'Sonnet 4.6', status: 'review', startedAt: 'heute · 14:14', durationMs: 188_000, tokens: 18900, costEur: 0.09, trigger: 'schedule' },
  { id: 'run-3140', workflowId: 'wf-compliance', workflowName: 'Compliance Daily', modelId: 'haiku-4-5', modelLabel: 'Haiku 4.5', status: 'done', startedAt: 'heute · 13:00', durationMs: 92_000, tokens: 7400, costEur: 0.01, trigger: 'schedule' },
  { id: 'run-3139', workflowId: 'wf-research', workflowName: 'Deep Research', modelId: 'opus-4-7', modelLabel: 'Opus 4.7', status: 'blocked', startedAt: 'heute · 10:21', durationMs: 612_000, tokens: 84000, costEur: 0.84, trigger: 'manual' },
  { id: 'run-3138', workflowId: 'wf-newsletter', workflowName: 'Weekly Newsletter', modelId: 'sonnet-4-6', modelLabel: 'Sonnet 4.6', status: 'done', startedAt: 'gestern · 19:00', durationMs: 124_000, tokens: 12100, costEur: 0.06, trigger: 'schedule' },
  { id: 'run-3137', workflowId: 'wf-content-pipeline', workflowName: 'Content Pipeline', modelId: 'opus-4-7', modelLabel: 'Opus 4.7', status: 'done', startedAt: 'gestern · 16:42', durationMs: 388_000, tokens: 39800, costEur: 0.40, trigger: 'manual' },
  { id: 'run-3136', workflowId: 'wf-leadgen', workflowName: 'Lead-Gen Sweep', modelId: 'sonnet-4-6', modelLabel: 'Sonnet 4.6', status: 'done', startedAt: 'gestern · 12:00', durationMs: 162_000, tokens: 16400, costEur: 0.08, trigger: 'webhook' },
  { id: 'run-3135', workflowId: 'wf-compliance', workflowName: 'Compliance Daily', modelId: 'haiku-4-5', modelLabel: 'Haiku 4.5', status: 'done', startedAt: 'gestern · 09:00', durationMs: 88_000, tokens: 7100, costEur: 0.01, trigger: 'schedule' },
];

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
  { key: 'agents', label: 'Agents', Icon: Bot, count: AGENTS.length },
  { key: 'runs', label: 'Runs', Icon: Activity, count: RUNS_HISTORY.length },
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
  onOpenPalette,
}: {
  active: NavKey;
  onSelect: (k: NavKey) => void;
  query: string;
  setQuery: (q: string) => void;
  onOpenPalette: () => void;
}) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-titanium-900 bg-obsidian-900">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-security-500 to-ai-cyan-500 shadow-inner shadow-black/40">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold text-titanium-50">Command Center</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-titanium-500">AI · Operating Layer</div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onOpenPalette}
          className="group flex w-full items-center gap-2 rounded-md border border-titanium-900 bg-obsidian-800 py-1.5 pl-2 pr-2 text-left text-xs text-titanium-500 transition hover:border-titanium-800 hover:bg-obsidian-700/80 hover:text-titanium-300"
          aria-label="Command Palette öffnen"
        >
          <Search className="h-3.5 w-3.5 text-titanium-500 group-hover:text-titanium-300" />
          <span className="flex-1 truncate">Befehl ausführen …</span>
          <kbd className="rounded border border-titanium-800 bg-obsidian-900 px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>
        <div className="relative mt-2">
          <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-titanium-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter …"
            className="w-full rounded-md border border-titanium-900 bg-obsidian-800 py-1.5 pl-7 pr-2 text-xs text-titanium-100 placeholder-titanium-600 outline-none focus:border-security-700"
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
          <span className="inline-flex items-center gap-1.5">
            <StatusDot value="running" />
            <span className="text-ai-cyan-300">live</span>
          </span>
        </div>
        <div className="mt-2 text-xs text-titanium-300">
          <div className="flex justify-between">
            <span className="text-titanium-500">Active Runs</span>
            <span className="font-mono">3</span>
          </div>
          <div className="flex justify-between">
            <span className="text-titanium-500">Today Tokens</span>
            <span className="font-mono">412k</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({
  workflow,
  model,
  setModel,
  status,
  onRun,
  onPause,
  onStop,
}: {
  workflow: WorkflowItem;
  model: Model;
  setModel: (m: Model) => void;
  status: RunStatus;
  onRun: () => void;
  onPause: () => void;
  onStop: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-titanium-900 bg-obsidian-900/80 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-md border border-titanium-800 bg-obsidian-700">
          <Workflow className="h-4 w-4 text-ai-cyan-400" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-titanium-50">{workflow.name}</div>
          <div className="truncate text-[11px] text-titanium-500">
            {workflow.tag} · {workflow.steps} Schritte · {workflow.lastRun}
          </div>
        </div>
        <StatusChip value={status} />
      </div>

      <div className="flex items-center gap-2">
        <ModelSelector value={model} onChange={setModel} />

        <div className="mx-1 h-6 w-px bg-titanium-900" />

        <button
          type="button"
          onClick={onRun}
          className="inline-flex items-center gap-1.5 rounded-md bg-security-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm shadow-security-900/50 hover:bg-security-500"
        >
          <Play className="h-3.5 w-3.5" />
          Run
        </button>
        <button
          type="button"
          onClick={onPause}
          className="inline-flex items-center gap-1.5 rounded-md border border-titanium-800 bg-obsidian-700 px-2.5 py-1.5 text-sm text-titanium-200 hover:border-titanium-700 hover:bg-obsidian-600"
          aria-label="Pause"
        >
          <Pause className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onStop}
          className="inline-flex items-center gap-1.5 rounded-md border border-titanium-800 bg-obsidian-700 px-2.5 py-1.5 text-sm text-titanium-200 hover:border-rose-800 hover:bg-rose-950/30 hover:text-rose-200"
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
    <div className="flex h-full w-80 shrink-0 flex-col border-r border-titanium-900 bg-obsidian-900/40">
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

function CanvasView({ steps }: { steps: RunStep[] }) {
  return (
    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
      {steps.map((s, i) => (
        <article
          key={s.id}
          className="group relative rounded-lg border border-titanium-900 bg-obsidian-800/60 p-3 transition hover:border-titanium-800"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md border border-titanium-800 bg-obsidian-700 font-mono text-[10px] text-titanium-300">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-sm font-medium text-titanium-50">{s.name}</span>
            </div>
            <StatusChip value={s.status} />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-titanium-500">
            <Bot className="h-3 w-3" />
            <span className="font-mono">{s.agent}</span>
            {typeof s.tokens === 'number' && (
              <>
                <span className="text-titanium-700">·</span>
                <span>{s.tokens.toLocaleString('de-DE')} tok</span>
              </>
            )}
            {typeof s.durationMs === 'number' && (
              <>
                <span className="text-titanium-700">·</span>
                <span>{(s.durationMs / 1000).toFixed(1)}s</span>
              </>
            )}
          </div>
          {s.status === 'running' && (
            <div className="mt-3 h-1 overflow-hidden rounded bg-obsidian-700">
              <div className="h-full w-2/3 animate-pulse bg-gradient-to-r from-security-500 to-ai-cyan-400" />
            </div>
          )}
          {s.status === 'review' && (
            <div className="mt-3 rounded border border-brass-800/50 bg-brass-900/20 p-2 text-[11px] text-brass-200">
              Wartet auf Human-Approval.
            </div>
          )}
          {s.status === 'blocked' && (
            <div className="mt-3 rounded border border-amber-800/50 bg-amber-950/30 p-2 text-[11px] text-amber-200">
              Quelle nicht erreichbar — Retry erforderlich.
            </div>
          )}
        </article>
      ))}
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

function AgentsView({ query }: { query: string }) {
  const filtered = AGENTS.filter((a) =>
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
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-titanium-800 bg-obsidian-700 px-2 py-1 text-[11px] text-titanium-200 hover:bg-obsidian-600"
        >
          <Plus className="h-3 w-3" /> Neuer Agent
        </button>
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

function RunsView({ query }: { query: string }) {
  const [statusFilter, setStatusFilter] = useState<RunStatus | 'all'>('all');
  const filtered = RUNS_HISTORY.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!query) return true;
    return (
      r.workflowName.toLowerCase().includes(query.toLowerCase()) ||
      r.id.toLowerCase().includes(query.toLowerCase()) ||
      r.modelLabel.toLowerCase().includes(query.toLowerCase())
    );
  });
  const statuses: Array<RunStatus | 'all'> = ['all', 'running', 'review', 'blocked', 'done', 'idle'];
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-titanium-900 bg-obsidian-900/40 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-titanium-50">Runs</h2>
          <p className="text-[11px] text-titanium-500">{filtered.length} von {RUNS_HISTORY.length}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-titanium-500" />
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider transition ${
                statusFilter === s
                  ? 'border-ai-cyan-700/60 bg-ai-cyan-900/40 text-ai-cyan-300'
                  : 'border-titanium-800 bg-obsidian-800 text-titanium-400 hover:bg-obsidian-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-obsidian-900/90 backdrop-blur">
            <tr className="border-b border-titanium-900 text-left text-[10px] uppercase tracking-[0.18em] text-titanium-500">
              <th className="px-4 py-2 font-medium">Run</th>
              <th className="px-2 py-2 font-medium">Workflow</th>
              <th className="px-2 py-2 font-medium">Model</th>
              <th className="px-2 py-2 font-medium">Trigger</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">Tokens</th>
              <th className="px-2 py-2 text-right font-medium">Kosten</th>
              <th className="px-2 py-2 text-right font-medium">Dauer</th>
              <th className="px-2 py-2 font-medium">Start</th>
              <th className="px-4 py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-b border-titanium-900/60 transition hover:bg-obsidian-800/60"
              >
                <td className="px-4 py-2 font-mono text-[11px] text-titanium-300">{r.id}</td>
                <td className="px-2 py-2 text-titanium-100">{r.workflowName}</td>
                <td className="px-2 py-2 text-titanium-300">{r.modelLabel}</td>
                <td className="px-2 py-2 text-[11px] text-titanium-500">{r.trigger}</td>
                <td className="px-2 py-2"><StatusChip value={r.status} /></td>
                <td className="px-2 py-2 text-right font-mono text-[11px] text-titanium-200">
                  {r.tokens.toLocaleString('de-DE')}
                </td>
                <td className="px-2 py-2 text-right font-mono text-[11px] text-titanium-200">
                  € {r.costEur.toFixed(2)}
                </td>
                <td className="px-2 py-2 text-right font-mono text-[11px] text-titanium-400">
                  {(r.durationMs / 1000).toFixed(0)}s
                </td>
                <td className="px-2 py-2 text-[11px] text-titanium-500">{r.startedAt}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-titanium-800 bg-obsidian-700 px-2 py-0.5 text-[10px] text-titanium-200 hover:border-ai-cyan-700 hover:bg-ai-cyan-900/30 hover:text-ai-cyan-300"
                  >
                    <RotateCcw className="h-3 w-3" /> Re-Run
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-xs text-titanium-500">
                  Keine Runs für diesen Filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface PaletteAction {
  id: string;
  group: 'Run' | 'Navigate' | 'Model' | 'Workflow';
  label: string;
  hint?: string;
  Icon: typeof Activity;
  run: () => void;
}

function CommandPalette({
  open,
  onClose,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
}) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      window.setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!q) return actions;
    const needle = q.toLowerCase();
    return actions.filter(
      (a) => a.label.toLowerCase().includes(needle) || a.group.toLowerCase().includes(needle),
    );
  }, [q, actions]);

  useEffect(() => {
    if (idx >= filtered.length) setIdx(0);
  }, [filtered.length, idx]);

  const groups = useMemo(() => {
    const map = new Map<PaletteAction['group'], PaletteAction[]>();
    filtered.forEach((a) => {
      if (!map.has(a.group)) map.set(a.group, []);
      map.get(a.group)!.push(a);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const flat = filtered;

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setIdx((i) => Math.min(i + 1, flat.length - 1));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setIdx((i) => Math.max(i - 1, 0));
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const a = flat[idx];
          if (a) {
            a.run();
            onClose();
          }
        }
      }}
    >
      <div
        className="mt-[12vh] w-full max-w-xl overflow-hidden rounded-lg border border-titanium-800 bg-obsidian-900 shadow-2xl shadow-black/70"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command Palette"
      >
        <div className="flex items-center gap-2 border-b border-titanium-900 px-3 py-2">
          <CommandIcon className="h-4 w-4 text-ai-cyan-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            placeholder="Befehl, Workflow oder Model …"
            className="flex-1 bg-transparent text-sm text-titanium-50 placeholder-titanium-600 outline-none"
          />
          <kbd className="rounded border border-titanium-800 bg-obsidian-800 px-1.5 py-0.5 text-[10px] text-titanium-400">
            esc
          </kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto py-1">
          {flat.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-titanium-500">Nichts gefunden.</div>
          )}
          {groups.map(([group, list]) => (
            <div key={group}>
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-titanium-600">
                {group}
              </div>
              {list.map((a) => {
                const flatIdx = flat.indexOf(a);
                const active = flatIdx === idx;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onMouseEnter={() => setIdx(flatIdx)}
                    onClick={() => {
                      a.run();
                      onClose();
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
                      active ? 'bg-security-900/40 text-titanium-50' : 'text-titanium-200'
                    }`}
                  >
                    <a.Icon
                      className={`h-3.5 w-3.5 ${active ? 'text-ai-cyan-400' : 'text-titanium-500'}`}
                    />
                    <span className="flex-1 truncate">{a.label}</span>
                    {a.hint && (
                      <span className="font-mono text-[10px] text-titanium-500">{a.hint}</span>
                    )}
                    {active && <ArrowRight className="h-3 w-3 text-ai-cyan-400" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <footer className="flex items-center justify-between border-t border-titanium-900 px-3 py-1.5 text-[10px] text-titanium-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-titanium-800 bg-obsidian-800 px-1 py-0 text-[10px]">↑↓</kbd>
              navigieren
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-titanium-800 bg-obsidian-800 px-1 py-0 text-[10px]">
                <CornerDownLeft className="inline h-2.5 w-2.5" />
              </kbd>
              ausführen
            </span>
          </div>
          <span className="inline-flex items-center gap-1">
            <CommandIcon className="h-3 w-3" />
            <span>K</span>
          </span>
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

function PlaceholderView({ title, hint, Icon }: { title: string; hint: string; Icon: typeof Activity }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <Icon className="h-8 w-8 text-titanium-700" />
      <div className="text-sm font-semibold text-titanium-200">{title}</div>
      <div className="max-w-sm text-[12px] text-titanium-500">{hint}</div>
    </div>
  );
}

export function AiCommandCenter() {
  const [nav, setNav] = useState<NavKey>('workflows');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(WORKFLOWS[0].id);
  const [tab, setTab] = useState<TabKey>('canvas');
  const [model, setModel] = useState<Model>(MODELS[0]);
  const [runStatus, setRunStatus] = useState<RunStatus>('running');
  const [paletteOpen, setPaletteOpen] = useState(false);

  const workflow = useMemo(
    () => WORKFLOWS.find((w) => w.id === selectedId) ?? WORKFLOWS[0],
    [selectedId],
  );
  const steps = STEPS[workflow.id] ?? [];

  // Global ⌘K / Ctrl+K to open palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const paletteActions: PaletteAction[] = useMemo(() => {
    const acts: PaletteAction[] = [
      { id: 'run', group: 'Run', label: 'Aktuellen Workflow starten', hint: 'Run', Icon: Play, run: () => setRunStatus('running') },
      { id: 'pause', group: 'Run', label: 'Workflow pausieren', hint: 'Pause', Icon: Pause, run: () => setRunStatus('idle') },
      { id: 'stop', group: 'Run', label: 'Workflow stoppen', hint: 'Stop', Icon: Square, run: () => setRunStatus('idle') },
    ];
    (['workflows', 'agents', 'runs', 'library', 'connectors', 'settings'] as NavKey[]).forEach((k) => {
      const item = NAV.find((n) => n.key === k);
      if (!item) return;
      acts.push({
        id: `nav-${k}`,
        group: 'Navigate',
        label: `Wechsle zu ${item.label}`,
        Icon: item.Icon,
        run: () => setNav(k),
      });
    });
    MODELS.forEach((m) => {
      acts.push({
        id: `model-${m.id}`,
        group: 'Model',
        label: `Wechsle Model auf ${m.label}`,
        hint: `${m.contextK}k`,
        Icon: Cpu,
        run: () => setModel(m),
      });
    });
    WORKFLOWS.forEach((w) => {
      acts.push({
        id: `wf-${w.id}`,
        group: 'Workflow',
        label: `Öffne „${w.name}"`,
        hint: w.tag,
        Icon: Workflow,
        run: () => {
          setNav('workflows');
          setSelectedId(w.id);
          setRunStatus(w.status);
        },
      });
    });
    return acts;
  }, []);

  const showWorkflowsView = nav === 'workflows';

  return (
    <div className="dark flex h-screen w-screen overflow-hidden bg-obsidian-950 text-titanium-100">
      <Sidebar
        active={nav}
        onSelect={setNav}
        query={query}
        setQuery={setQuery}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {showWorkflowsView && (
          <Topbar
            workflow={workflow}
            model={model}
            setModel={setModel}
            status={runStatus}
            onRun={() => setRunStatus('running')}
            onPause={() => setRunStatus('idle')}
            onStop={() => setRunStatus('idle')}
          />
        )}

        <div className="flex min-h-0 flex-1">
          {showWorkflowsView && (
            <>
              <WorkflowList
                workflows={WORKFLOWS}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setRunStatus(WORKFLOWS.find((w) => w.id === id)?.status ?? 'idle');
                }}
                query={query}
              />

              <main className="flex min-w-0 flex-1 flex-col">
                <Tabs value={tab} onChange={setTab} />
                <div className="min-h-0 flex-1 overflow-y-auto bg-obsidian-950">
                  {tab === 'canvas' && <CanvasView steps={steps} />}
                  {tab === 'logs' && <LogsView logs={LOGS} />}
                  {tab === 'output' && <OutputView workflow={workflow} />}
                  {tab === 'config' && <ConfigView workflow={workflow} model={model} />}
                </div>
              </main>
            </>
          )}

          {nav === 'agents' && (
            <main className="flex min-w-0 flex-1 flex-col">
              <AgentsView query={query} />
            </main>
          )}
          {nav === 'runs' && (
            <main className="flex min-w-0 flex-1 flex-col">
              <RunsView query={query} />
            </main>
          )}
          {nav === 'library' && (
            <main className="flex min-w-0 flex-1 flex-col">
              <PlaceholderView
                title="Library"
                hint="Wiederverwendbare Prompts, Skills und Snippets — kommt als nächstes."
                Icon={Layers}
              />
            </main>
          )}
          {nav === 'connectors' && (
            <main className="flex min-w-0 flex-1 flex-col">
              <PlaceholderView
                title="Connectors"
                hint="Slack · Notion · GitHub · Google · Stripe — Integrations-Layer."
                Icon={GitBranch}
              />
            </main>
          )}
          {nav === 'settings' && (
            <main className="flex min-w-0 flex-1 flex-col">
              <PlaceholderView
                title="Settings"
                hint="Org · Members · API Keys · Billing · Audit-Log."
                Icon={Settings}
              />
            </main>
          )}
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={paletteActions}
      />
    </div>
  );
}

export default AiCommandCenter;
