import type { PipelineStep } from './browserExecutorClient';

const LABEL: Record<PipelineStep['step'], string> = {
  requested: 'Angefordert',
  policy: 'Policy',
  approval: 'Freigabe',
  execution: 'Ausführung',
  verification: 'Verifikation',
  evidence: 'Evidence',
};

const ORDER: PipelineStep['step'][] = ['requested', 'policy', 'approval', 'execution', 'verification', 'evidence'];

const STATE_CLASS: Record<PipelineStep['state'], string> = {
  done: 'border-emerald-800 text-emerald-300',
  skipped: 'border-titanium-800 text-titanium-500',
  pending: 'border-amber-800 text-amber-300',
  blocked: 'border-red-900 text-red-300',
  failed: 'border-red-900 text-red-300',
};

const STATE_TEXT: Record<PipelineStep['state'], string> = {
  done: 'ok',
  skipped: 'entfällt',
  pending: 'wartet',
  blocked: 'blockiert',
  failed: 'Fehler',
};

/** Requested → Policy → Approval → Execution → Verification → Evidence — nur Zustände vom Server. */
export function PipelineSteps({ steps }: { steps: PipelineStep[] }) {
  const byStep = new Map(steps.map((s) => [s.step, s]));
  return (
    <ol className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6" data-testid="governed-action-pipeline" aria-label="Ablauf der Aktion">
      {ORDER.map((step) => {
        const s = byStep.get(step);
        return (
          <li
            key={step}
            className={`border px-2 py-1.5 text-[10px] ${s ? STATE_CLASS[s.state] : 'border-titanium-900 text-titanium-600'}`}
            data-step={step}
            data-state={s?.state ?? 'none'}
            title={s?.detail}
          >
            <div className="font-semibold uppercase tracking-wider">{LABEL[step]}</div>
            <div className="mt-0.5 font-mono">{s ? STATE_TEXT[s.state] : '—'}</div>
          </li>
        );
      })}
    </ol>
  );
}
