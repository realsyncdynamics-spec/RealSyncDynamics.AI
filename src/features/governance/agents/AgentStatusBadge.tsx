import type { AgentRiskLevel, AgentStatus } from './types';

const STATUS_LABEL: Record<AgentStatus, string> = {
  active:          'Aktiv',
  paused:          'Pausiert',
  review_required: 'Review erforderlich',
  disabled:        'Deaktiviert',
};
const STATUS_CLS: Record<AgentStatus, string> = {
  active:          'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  paused:          'bg-sky-500/15 text-sky-200 border-sky-500/40',
  review_required: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  disabled:        'bg-titanium-800/30 text-titanium-300 border-titanium-700',
};

const RISK_LABEL: Record<AgentRiskLevel, string> = {
  low:      'Risiko · niedrig',
  medium:   'Risiko · mittel',
  high:     'Risiko · hoch',
  critical: 'Risiko · kritisch',
};
const RISK_CLS: Record<AgentRiskLevel, string> = {
  low:      'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  medium:   'bg-sky-500/15 text-sky-200 border-sky-500/40',
  high:     'bg-amber-500/15 text-amber-200 border-amber-500/40',
  critical: 'bg-rose-500/15 text-rose-200 border-rose-500/40',
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${STATUS_CLS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function AgentRiskBadge({ level }: { level: AgentRiskLevel }) {
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${RISK_CLS[level]}`}>
      {RISK_LABEL[level]}
    </span>
  );
}
