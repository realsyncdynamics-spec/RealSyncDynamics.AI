import type {
  VvtAiActRelevance,
  VvtReviewStatus,
  VvtRiskLevel,
} from './types';

const REVIEW_LABEL: Record<VvtReviewStatus, string> = {
  draft:           'Entwurf',
  review_required: 'Review erforderlich',
  approved:        'Freigegeben',
  rejected:        'Abgelehnt',
};

const REVIEW_TONE: Record<VvtReviewStatus, string> = {
  draft:           'text-titanium-300 border-titanium-700 bg-obsidian-950',
  review_required: 'text-amber-200 border-amber-500/40 bg-amber-500/10',
  approved:        'text-emerald-200 border-emerald-500/40 bg-emerald-500/10',
  rejected:        'text-rose-200 border-rose-500/40 bg-rose-500/10',
};

const RISK_LABEL: Record<VvtRiskLevel, string> = {
  low:      'Risiko: niedrig',
  medium:   'Risiko: mittel',
  high:     'Risiko: hoch',
  critical: 'Risiko: kritisch',
};

const RISK_TONE: Record<VvtRiskLevel, string> = {
  low:      'text-emerald-200 border-emerald-500/40 bg-emerald-500/10',
  medium:   'text-amber-200 border-amber-500/40 bg-amber-500/10',
  high:     'text-orange-200 border-orange-500/40 bg-orange-500/10',
  critical: 'text-rose-200 border-rose-500/40 bg-rose-500/10',
};

const AI_LABEL: Record<VvtAiActRelevance, string> = {
  none:                       'KI-Relevanz: keine',
  possible:                   'KI-Relevanz: möglich',
  likely:                     'KI-Relevanz: wahrscheinlich',
  high_risk_review_required:  'KI-Hochrisiko: Review nötig',
};

const AI_TONE: Record<VvtAiActRelevance, string> = {
  none:                       'text-titanium-300 border-titanium-700 bg-obsidian-950',
  possible:                   'text-security-200 border-security-500/40 bg-security-500/10',
  likely:                     'text-amber-200 border-amber-500/40 bg-amber-500/10',
  high_risk_review_required:  'text-rose-200 border-rose-500/40 bg-rose-500/10',
};

function Badge({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  );
}

export function ReviewStatusBadge({ status }: { status: VvtReviewStatus }) {
  return <Badge label={REVIEW_LABEL[status]} tone={REVIEW_TONE[status]} />;
}

export function RiskLevelBadge({ level }: { level: VvtRiskLevel }) {
  return <Badge label={RISK_LABEL[level]} tone={RISK_TONE[level]} />;
}

export function AiActRelevanceBadge({ relevance }: { relevance: VvtAiActRelevance }) {
  if (relevance === 'none') return null;
  return <Badge label={AI_LABEL[relevance]} tone={AI_TONE[relevance]} />;
}
