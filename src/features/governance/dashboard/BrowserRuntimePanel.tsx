import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  FileCheck2,
  Globe2,
  LockKeyhole,
  MousePointer2,
  ScrollText,
  ShieldCheck,
  Type,
} from 'lucide-react';
import { useBrowserSession } from '../../../lib/useBrowserSession';

type AgentMode = 'assist' | 'copilot' | 'autonomous';

const EXECUTOR_CONNECTED = false;

function normalizeUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function openGovernedBrowser(url: string) {
  window.dispatchEvent(new CustomEvent('realsync:browser-open', { detail: { url } }));
}

export function BrowserRuntimePanel({ activeTenantId }: { activeTenantId: string | null }) {
  const sessionId = useBrowserSession();
  const [mode, setMode] = useState<AgentMode>('assist');
  const [task, setTask] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const capabilities = useMemo(
    () => [
      { label: 'Navigate', available: true, icon: Globe2 },
      { label: 'Scan', available: true, icon: ShieldCheck },
      { label: 'Evidence', available: true, icon: FileCheck2 },
      { label: 'Scroll', available: EXECUTOR_CONNECTED, icon: ScrollText },
      { label: 'Click', available: EXECUTOR_CONNECTED, icon: MousePointer2 },
      { label: 'Type', available: EXECUTOR_CONNECTED, icon: Type },
    ],
    [],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const url = normalizeUrl(task);
    if (url) {
      openGovernedBrowser(url);
      return;
    }
    setMessage(
      EXECUTOR_CONNECTED
        ? 'Task an Browser Executor übergeben.'
        : 'Freitext-Agentensteuerung benötigt einen serverseitigen Browser Executor. Derzeit sind sichere Navigation, Scan und Evidence aktiv.',
    );
  }

  return (
    <section
      className="mx-4 mt-5 border border-titanium-800 bg-obsidian-950 lg:mx-6"
      aria-labelledby="browser-runtime-heading"
      data-testid="browser-runtime-panel"
    >
      <div className="flex flex-col gap-4 border-b border-titanium-800 px-5 py-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-400">
            <CircleDot className="h-3 w-3" aria-hidden="true" />
            RealSync Browser Runtime
          </div>
          <h2 id="browser-runtime-heading" className="text-2xl font-semibold tracking-tight text-titanium-50">
            Governed computer use for AI agents
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-titanium-400">
            Request → Identity → Tenant → Policy → Risk → Approval → Browser Action → Verification → Evidence
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-mono">
          <span className="border border-emerald-900 bg-emerald-950/30 px-2.5 py-1 text-emerald-300">NAVIGATION ACTIVE</span>
          <span className="border border-cyan-900 bg-cyan-950/30 px-2.5 py-1 text-cyan-300">EVIDENCE ACTIVE</span>
          <span className="border border-amber-900 bg-amber-950/20 px-2.5 py-1 text-amber-300">
            AGENT EXECUTOR NOT CONNECTED
          </span>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[1.15fr_.85fr]">
        <div className="border-b border-titanium-800 p-5 xl:border-b-0 xl:border-r">
          <form onSubmit={submit}>
            <label htmlFor="browser-runtime-task" className="text-xs font-semibold uppercase tracking-[0.16em] text-titanium-400">
              Was soll RealSync im Browser erledigen?
            </label>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id="browser-runtime-task"
                value={task}
                onChange={(event) => setTask(event.target.value)}
                placeholder="URL öffnen, z. B. example.com — Freitext-Agentensteuerung folgt mit Browser Executor"
                className="min-w-0 flex-1 border border-titanium-700 bg-obsidian-900 px-3 py-3 text-sm text-titanium-100 outline-none placeholder:text-titanium-600 focus:border-cyan-500"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 bg-cyan-500 px-4 py-3 text-sm font-semibold text-obsidian-950 hover:bg-cyan-400"
              >
                Browser öffnen
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>

          {message && (
            <div className="mt-3 border border-amber-900 bg-amber-950/20 px-3 py-2 text-xs leading-5 text-amber-200" role="status">
              {message}
            </div>
          )}

          <div className="mt-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-titanium-400">Agent Mode</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                ['assist', 'Assist', true],
                ['copilot', 'Co-Pilot', EXECUTOR_CONNECTED],
                ['autonomous', 'Autonomous', EXECUTOR_CONNECTED],
              ] as const).map(([id, label, enabled]) => (
                <button
                  key={id}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setMode(id)}
                  className={`border px-3 py-3 text-left text-sm transition ${
                    mode === id
                      ? 'border-cyan-500 bg-cyan-950/30 text-cyan-200'
                      : 'border-titanium-800 bg-obsidian-900 text-titanium-400'
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                  title={enabled ? undefined : 'Serverseitiger Browser Executor erforderlich'}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{label}</span>
                    {!enabled && <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {capabilities.map(({ label, available, icon: Icon }) => (
              <div key={label} className="border border-titanium-800 bg-obsidian-900 px-3 py-3">
                <Icon className={`h-4 w-4 ${available ? 'text-cyan-400' : 'text-titanium-600'}`} aria-hidden="true" />
                <div className="mt-2 text-xs font-medium text-titanium-200">{label}</div>
                <div className={`mt-1 font-mono text-[9px] uppercase tracking-wider ${available ? 'text-emerald-400' : 'text-titanium-600'}`}>
                  {available ? 'available' : 'executor needed'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-titanium-400">
            <Bot className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            Governance Control
          </div>

          <dl className="mt-4 divide-y divide-titanium-800 border border-titanium-800 bg-obsidian-900 text-xs">
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Tenant authority</dt>
              <dd className={activeTenantId ? 'text-emerald-300' : 'text-amber-300'}>
                {activeTenantId ? 'membership-bound' : 'not resolved'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Browser session</dt>
              <dd className="max-w-[180px] truncate font-mono text-titanium-300" title={sessionId || undefined}>
                {sessionId || 'initializing'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Policy authority</dt>
              <dd className="text-cyan-300">server-side</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Approval workflow</dt>
              <dd className="text-emerald-300">available</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Browser action log</dt>
              <dd className="text-emerald-300">available</dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <Link
              to="/app/approvals"
              className="inline-flex items-center justify-between border border-titanium-800 bg-obsidian-900 px-3 py-3 text-xs font-medium text-titanium-200 hover:border-cyan-800"
            >
              Approvals
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/app/evidence"
              className="inline-flex items-center justify-between border border-titanium-800 bg-obsidian-900 px-3 py-3 text-xs font-medium text-titanium-200 hover:border-cyan-800"
            >
              Evidence
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 flex items-start gap-2 border border-titanium-800 bg-obsidian-900 px-3 py-3 text-[11px] leading-5 text-titanium-500">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" aria-hidden="true" />
            Keine Fake-Browser-Automation: Klick-, Scroll- und Schreibaktionen bleiben gesperrt, bis ein tenant-gebundener serverseitiger Executor vorhanden ist.
          </div>
        </aside>
      </div>
    </section>
  );
}
