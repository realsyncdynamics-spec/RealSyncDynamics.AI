// Deterministische Triage-Heuristik für Beta-Feedback.
//
// Eingabe = strukturierter Feedback-Report. Ausgabe = Priorität (p0-p3),
// Triage-Score (0-100) und Tags für Routing. Pure Funktion ohne Side-Effects,
// damit sie sowohl im Browser (FeedbackWidget-Preview) als auch in der
// Edge-Function läuft.
//
// Mapping:
//   severity=critical   → score 100, p0
//   severity=high       → score 75,  p1
//   severity=medium     → score 50,  p2
//   severity=low        → score 25,  p3
// Aufschläge:
//   +15 wenn type=security_issue
//   +10 wenn type=bug UND steps_to_reproduce vorhanden
//    +5 wenn screenshot_url vorhanden
//   +10 wenn Modul-/Location-Treffer auf compliance-kritische Bereiche
//        (ai-act, dsgvo, governance, evidence)
// Score wird auf [0, 100] geklemmt; daraus folgt erneut die Priorität.

export type FeedbackType =
  | 'bug'
  | 'improvement'
  | 'feature_request'
  | 'security_issue'
  | 'ux_feedback';

export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';

export type FeedbackPriority = 'p0' | 'p1' | 'p2' | 'p3';

export interface TriageInput {
  type: FeedbackType;
  severity: FeedbackSeverity;
  module?: string | null;
  location?: string | null;
  steps_to_reproduce?: string | null;
  screenshot_url?: string | null;
  page_url?: string | null;
}

export interface TriageResult {
  priority: FeedbackPriority;
  triage_score: number;
  tags: string[];
}

const SEVERITY_BASE: Record<FeedbackSeverity, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};

const COMPLIANCE_KEYWORDS = ['ai act', 'aiact', 'dsgvo', 'gdpr', 'governance', 'evidence'];

function priorityFromScore(score: number): FeedbackPriority {
  if (score >= 90) return 'p0';
  if (score >= 65) return 'p1';
  if (score >= 40) return 'p2';
  return 'p3';
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function matchesCompliance(...parts: Array<string | null | undefined>): boolean {
  const haystack = parts
    .filter(hasText)
    .map((part) => (part as string).toLowerCase().replace(/[-_/]+/g, ' '))
    .join(' ');
  return COMPLIANCE_KEYWORDS.some((kw) => haystack.includes(kw));
}

export function computeTriage(input: TriageInput): TriageResult {
  let score = SEVERITY_BASE[input.severity] ?? 50;
  const tags: string[] = [];

  if (input.type === 'security_issue') {
    score += 15;
    tags.push('security');
  }

  if (input.type === 'bug' && hasText(input.steps_to_reproduce)) {
    score += 10;
    tags.push('reproducible');
  }

  if (input.type === 'bug' && !hasText(input.screenshot_url)) {
    tags.push('needs-screenshot');
  }

  if (hasText(input.screenshot_url)) {
    score += 5;
  }

  if (matchesCompliance(input.module, input.location, input.page_url)) {
    score += 10;
    tags.push('compliance');
  }

  if (input.type === 'feature_request') {
    tags.push('product-input');
  }

  if (input.type === 'ux_feedback') {
    tags.push('ux');
  }

  const clamped = Math.max(0, Math.min(100, score));
  return {
    priority: priorityFromScore(clamped),
    triage_score: clamped,
    tags,
  };
}
