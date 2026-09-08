import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type { CommandSession, StepExecutionState } from '../../core/realsync-os';
import { walkTree } from '../../core/realsync-os';

const PHASE_LABEL: Record<CommandSession['phase'], string> = {
  received: 'Empfangen',
  planned: 'Plan bereit',
  awaiting_approval: 'Freigabe erforderlich',
  approved: 'Freigegeben',
  rejected: 'Abgelehnt',
  running: 'Läuft',
  blocked: 'Blockiert',
  completed: 'Abgeschlossen',
  failed: 'Fehlgeschlagen',
};

function stepIcon(state: StepExecutionState) {
  if (state.status === 'succeeded') return <CheckCircle2 size={16} className="text-emerald-600" />;
  if (state.status === 'failed') return <XCircle size={16} className="text-red-600" />;
  if (state.status === 'blocked') return <ShieldAlert size={16} className="text-amber-600" />;
  if (state.status === 'running') return <Loader2 size={16} className="animate-spin text-sky-600" />;
  if (state.status === 'awaiting_approval') return <AlertTriangle size={16} className="text-amber-600" />;
  return <CircleDashed size={16} className="text-slate-300" />;
}

export function CommandSessionPanel({
  session,
  busy,
  error,
  onApprove,
  onReject,
  onReset,
}: {
  session: CommandSession;
  busy: boolean;
  error: string | null;
  onApprove: () => void;
  onReject: () => void;
  onReset: () => void;
}) {
  const awaiting = session.phase === 'awaiting_approval' || session.phase === 'planned';
  const blockedUnimplemented = session.steps.some((step) => step.notImplemented);
  const project = session.artifacts.designProject;
  const doc = project?.documents[0];
  const tree = doc ? walkTree(doc) : [];

  return (
    <section className="mt-5 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Intent detected</div>
          <h3 className="mt-1 text-base font-semibold text-slate-900">Goal: {session.intent.text}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Phase: {PHASE_LABEL[session.phase]} · Risiko {session.plan.risk} · Policy {session.policyVersion}
          </p>
        </div>
        <button type="button" onClick={onReset} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
          Neue Anweisung
        </button>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Detected capabilities</div>
        <div className="flex flex-wrap gap-2">
          {session.plan.capabilities.length > 0
            ? session.plan.capabilities.map((cap) => (
                <span key={cap} className="rounded-full border border-sky-100 bg-white px-3 py-1 text-xs font-medium text-sky-700">
                  {cap}
                </span>
              ))
            : <span className="text-xs text-slate-400">Keine spezialisierten Capabilities — Orchestrator-Plan.</span>}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Plan</div>
        <ol className="space-y-2">
          {session.plan.steps.map((step, index) => {
            const state = session.steps.find((item) => item.stepId === step.id);
            return (
              <li key={step.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{state ? stepIcon(state) : <CircleDashed size={16} className="text-slate-300" />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400">{index + 1}.</span>
                      <span className="text-sm font-medium text-slate-800">{step.title}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {step.agent}
                      </span>
                      {step.requiresApproval && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          Approval
                        </span>
                      )}
                    </div>
                    {state?.notImplemented && (
                      <p className="mt-1 text-xs font-semibold text-amber-700">NOT IMPLEMENTED{state.policyReason ? ` — ${state.policyReason}` : ''}</p>
                    )}
                    {!state?.notImplemented && state?.policyReason && (
                      <p className="mt-1 text-xs text-slate-500">{state.policyReason}</p>
                    )}
                    {state?.observation && (
                      <p className="mt-1 font-mono text-[11px] text-slate-400">
                        {state.tool ? `${state.tool} · ` : ''}{summarizeObservation(state.observation)}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {project && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Design kernel state</div>
          <p className="mt-1 text-xs text-slate-500">
            mode {project.inputMode} · v{project.version} · {project.brand.vertical ?? 'generic'} · not DOM
          </p>
          {tree.length > 0 && (
            <ol className="mt-3 space-y-1 font-mono text-[11px] text-slate-600">
              {tree.map(({ node, depth }) => (
                <li key={node.id} style={{ paddingLeft: depth * 12 }}>
                  {node.type}
                  {node.props.text ? ` — ${node.props.text}` : ''}
                </li>
              ))}
            </ol>
          )}
          {session.artifacts.siteosBlueprint && (
            <p className="mt-3 text-xs text-slate-500">
              SiteOS blueprint mapped ({session.artifacts.siteosBlueprint.pages[0]?.sections.length ?? 0} sections). Renderer not bound. Not published.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {blockedUnimplemented && (
        <p className="text-xs text-amber-700">
          Der Loop ist an einem echten Substrate-Gap gestoppt. Es wurde kein Agent-Run und kein Deploy simuliert.
        </p>
      )}

      {awaiting && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
          >
            {busy ? 'Führt aus…' : 'APPROVE PLAN'}
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Ablehnen
          </button>
        </div>
      )}

      {session.events.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Evidence events</div>
          <ul className="max-h-48 space-y-1 overflow-auto font-mono text-[11px] text-slate-500">
            {session.events.map((event) => (
              <li key={event.id}>
                {event.occurredAt} · {event.stage}/{event.action} · {event.result}
                {event.tool ? ` · ${event.tool}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function summarizeObservation(observation: Record<string, unknown>): string {
  if (typeof observation.reason === 'string') return observation.reason;
  if (typeof observation.note === 'string') return observation.note;
  if (typeof observation.heading === 'string') return observation.heading;
  if (typeof observation.mode === 'string') return `mode ${observation.mode}`;
  if (typeof observation.count === 'number') return `${observation.count} site(s)`;
  if (typeof observation.slug === 'string') return `slug ${observation.slug}`;
  if (observation.ran === false) return 'no queued SiteOS run';
  if (observation.publishable === false) return 'publish gate blocked';
  if (observation.publishable === true) return 'publish gate passed — deploy not executed';
  if (typeof observation.kind === 'string') return observation.kind;
  try {
    return JSON.stringify(observation);
  } catch {
    return 'observed';
  }
}
