import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Cpu,
  Eye,
  Loader2,
} from 'lucide-react';

type RunStatus = 'idle' | 'running' | 'blocked' | 'review' | 'done';

const STATUSES: RunStatus[] = ['idle', 'running', 'blocked', 'review', 'done'];

interface Model {
  id: string;
  label: string;
  provider: string;
  contextK: number;
}

const MODELS: Model[] = [
  { id: 'opus-4-7', label: 'Claude Opus 4.7', provider: 'Anthropic', contextK: 1000 },
  { id: 'sonnet-4-6', label: 'Claude Sonnet 4.6', provider: 'Anthropic', contextK: 200 },
  { id: 'haiku-4-5', label: 'Claude Haiku 4.5', provider: 'Anthropic', contextK: 200 },
  { id: 'gpt-5', label: 'GPT-5', provider: 'OpenAI', contextK: 256 },
  { id: 'gemini-2-5-pro', label: 'Gemini 2.5 Pro', provider: 'Google', contextK: 2000 },
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
    idle: { label: 'idle', cls: 'border-titanium-800 bg-titanium-900/60 text-titanium-400', Icon: CircleDot },
    running: { label: 'running', cls: 'border-ai-cyan-700/60 bg-ai-cyan-900/40 text-ai-cyan-300', Icon: Loader2 },
    blocked: { label: 'blocked', cls: 'border-amber-700/60 bg-amber-950/40 text-amber-300', Icon: AlertTriangle },
    review: { label: 'review', cls: 'border-brass-700/60 bg-brass-900/40 text-brass-200', Icon: Eye },
    done: { label: 'done', cls: 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300', Icon: CheckCircle2 },
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-titanium-900 bg-obsidian-800/40 p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-titanium-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function AiCommandCenterShowcase() {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Model>(MODELS[0]);

  return (
    <div className="dark min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="border-b border-titanium-900 bg-obsidian-900/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-semibold text-titanium-50">
              Command Center · Showcase
            </h1>
            <p className="text-[11px] text-titanium-500">
              Visueller Katalog aller UI-Bausteine — Status-Chips, Selectoren, Karten, Empty-States.
            </p>
          </div>
          <Link
            to="/command-center"
            className="inline-flex items-center gap-1.5 rounded-md border border-titanium-800 bg-obsidian-700 px-3 py-1.5 text-sm text-titanium-200 hover:bg-obsidian-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zur App
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <Section title="Status-Dots">
          <div className="flex flex-wrap items-center gap-6">
            {STATUSES.map((s) => (
              <div key={s} className="flex items-center gap-2 text-sm text-titanium-300">
                <StatusDot value={s} />
                <span className="font-mono text-[11px]">{s}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Status-Chips">
          <div className="flex flex-wrap gap-3">
            {STATUSES.map((s) => (
              <StatusChip key={s} value={s} />
            ))}
          </div>
        </Section>

        <Section title="Model-Selector (interaktiv)">
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md border border-titanium-800 bg-obsidian-700/80 px-3 py-1.5 text-sm text-titanium-100 hover:border-titanium-700 hover:bg-obsidian-600"
            >
              <Cpu className="h-4 w-4 text-ai-cyan-400" />
              <span className="font-medium">{chosen.label}</span>
              <span className="text-xs text-titanium-500">{chosen.contextK}k</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-titanium-500 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
            {open && (
              <div className="absolute left-0 z-10 mt-1.5 w-72 overflow-hidden rounded-md border border-titanium-800 bg-obsidian-800 shadow-2xl shadow-black/60">
                {MODELS.map((m) => {
                  const active = m.id === chosen.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setChosen(m);
                        setOpen(false);
                      }}
                      className={`flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm ${
                        active ? 'bg-security-900/40 text-titanium-50' : 'text-titanium-200 hover:bg-obsidian-700'
                      }`}
                    >
                      <Cpu className={`mt-0.5 h-4 w-4 ${active ? 'text-ai-cyan-400' : 'text-titanium-500'}`} />
                      <span className="flex-1">
                        <span className="block font-medium">{m.label}</span>
                        <span className="block text-[11px] text-titanium-500">
                          {m.provider} · {m.contextK}k ctx
                        </span>
                      </span>
                      {active && <CheckCircle2 className="h-4 w-4 text-ai-cyan-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Section>

        <Section title="Step-Karten (alle Status)">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STATUSES.map((s, i) => (
              <article
                key={s}
                className="rounded-lg border border-titanium-900 bg-obsidian-800/60 p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-md border border-titanium-800 bg-obsidian-700 font-mono text-[10px] text-titanium-300">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-medium text-titanium-50">Beispiel-Schritt</span>
                  </div>
                  <StatusChip value={s} />
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-titanium-500">
                  <Bot className="h-3 w-3" />
                  <span className="font-mono">researcher</span>
                  <span className="text-titanium-700">·</span>
                  <span>{(i + 1) * 1200} tok</span>
                </div>
                {s === 'running' && (
                  <div className="mt-3 h-1 overflow-hidden rounded bg-obsidian-700">
                    <div className="h-full w-2/3 animate-pulse bg-gradient-to-r from-security-500 to-ai-cyan-400" />
                  </div>
                )}
                {s === 'review' && (
                  <div className="mt-3 rounded border border-brass-800/50 bg-brass-900/20 p-2 text-[11px] text-brass-200">
                    Wartet auf Human-Approval.
                  </div>
                )}
                {s === 'blocked' && (
                  <div className="mt-3 rounded border border-amber-800/50 bg-amber-950/30 p-2 text-[11px] text-amber-200">
                    Quelle nicht erreichbar — Retry erforderlich.
                  </div>
                )}
              </article>
            ))}
          </div>
        </Section>

        <Section title="Empty-State">
          <div className="rounded-lg border border-titanium-900 bg-obsidian-900/40">
            <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full border border-titanium-900 bg-obsidian-800/60">
                <Activity className="h-6 w-6 text-titanium-600" />
              </div>
              <div className="text-sm font-semibold text-titanium-200">Noch keine Runs</div>
              <div className="max-w-xs text-[12px] leading-relaxed text-titanium-500">
                Starte deinen ersten Workflow, um hier eine Timeline der Runs zu sehen.
              </div>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-titanium-800 bg-obsidian-700 px-3 py-1.5 text-xs text-titanium-200 hover:border-ai-cyan-700 hover:bg-ai-cyan-900/30 hover:text-ai-cyan-300"
              >
                Workflow starten
              </button>
            </div>
          </div>
        </Section>

        <Section title="Token-Badges (Sidebar-Variante)">
          <div className="flex flex-wrap gap-3">
            {[{ label: 'Active Runs', value: '3' }, { label: 'Today Tokens', value: '412k' }, { label: 'Cost', value: '€ 0,42' }].map((b) => (
              <div
                key={b.label}
                className="rounded-md border border-titanium-900 bg-obsidian-800/60 px-3 py-2"
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-titanium-500">{b.label}</div>
                <div className="font-mono text-sm text-titanium-100">{b.value}</div>
              </div>
            ))}
          </div>
        </Section>

        <footer className="border-t border-titanium-900 pt-4 text-center text-[11px] text-titanium-600">
          Showcase ist Frontend-only — keine Backend-Calls. Nutze diese Seite als visuelles Review-Werkzeug.
        </footer>
      </main>
    </div>
  );
}

export default AiCommandCenterShowcase;
