import type { VvtAiActRelevance, VvtReviewStatus, VvtRiskLevel } from './types';

const REVIEW_LABEL: Record<VvtReviewStatus, string> = {
  draft:           'Entwurf',
  review_required: 'Review erforderlich',
  approved:        'Freigegeben',
  rejected:        'Abgelehnt',
};
const REVIEW_CLS: Record<VvtReviewStatus, string> = {
  draft:           'bg-titanium-800/30 text-titanium-300 border-titanium-700',
  review_required: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  approved:        'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  rejected:        'bg-rose-500/15 text-rose-200 border-rose-500/40',
};

const RISK_LABEL: Record<VvtRiskLevel, string> = {
  low:      'Risiko · niedrig',
  medium:   'Risiko · mittel',
  high:     'Risiko · hoch',
  critical: 'Risiko · kritisch',
};
const RISK_CLS: Record<VvtRiskLevel, string> = {
  low:      'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  medium:   'bg-sky-500/15 text-sky-200 border-sky-500/40',
  high:     'bg-amber-500/15 text-amber-200 border-amber-500/40',
  critical: 'bg-rose-500/15 text-rose-200 border-rose-500/40',
};

const AI_LABEL: Record<VvtAiActRelevance, string> = {
  none:                         'KI · keine',
  possible:                     'KI · moeglich',
  likely:                       'KI · wahrscheinlich',
  high_risk_review_required:    'KI · High-Risk Review',
};
const AI_CLS: Record<VvtAiActRelevance, string> = {
  none:                         'bg-titanium-800/30 text-titanium-300 border-titanium-700',
  possible:                     'bg-sky-500/15 text-sky-200 border-sky-500/40',
  likely:                       'bg-amber-500/15 text-amber-200 border-amber-500/40',
  high_risk_review_required:    'bg-rose-500/15 text-rose-200 border-rose-500/40',
};

export function RuntimeVvtReviewBadge({ status }: { status: VvtReviewStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${REVIEW_CLS[status]}`}>
      {REVIEW_LABEL[status]}
    </span>
  );
}

export function RuntimeVvtRiskBadge({ level }: { level: VvtRiskLevel }) {
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${RISK_CLS[level]}`}>
      {RISK_LABEL[level]}
    </span>
  );
}

export function RuntimeVvtAiBadge({ relevance }: { relevance: VvtAiActRelevance }) {
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${AI_CLS[relevance]}`}>
      {AI_LABEL[relevance]}
    </span>
  );
}
