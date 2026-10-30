/**
 * M3 Decision Engine — reine, abhängigkeitsfreie Logik (Deno + Vite/Vitest).
 *
 * Grundsätze:
 *   - Höchstens 3 Optionen, genau eine als empfohlen markiert, jede begründet.
 *   - Ein Vorschlag ist NIE eine Freigabe: Status ist immer 'proposed'.
 *   - Die nötige Freigabestufe (L0–L4) wird konservativ abgeleitet; im Zweifel höher.
 */

export type ApprovalLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type Reversibility = 'reversible' | 'partially_reversible' | 'irreversible';

export interface ProposalOption {
  label: string;
  rationale: string;
  risks?: string;
  costs?: string;
  recommended?: boolean;
}

export interface DecisionProposal {
  options: ProposalOption[];
  riskLevel?: RiskLevel;
  reversibility?: Reversibility;
}

export const MAX_OPTIONS = 3;

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateProposal(p: DecisionProposal): ValidationResult {
  if (!p || !Array.isArray(p.options)) return { ok: false, error: 'options fehlt' };
  if (p.options.length < 1) return { ok: false, error: 'mindestens 1 Option' };
  if (p.options.length > MAX_OPTIONS) return { ok: false, error: `höchstens ${MAX_OPTIONS} Optionen` };
  for (const [i, o] of p.options.entries()) {
    if (!o?.label?.trim()) return { ok: false, error: `Option ${i + 1}: label fehlt` };
    if (!o.rationale?.trim()) return { ok: false, error: `Option ${i + 1}: Begründung fehlt` };
  }
  const rec = p.options.filter((o) => o.recommended === true).length;
  if (rec !== 1) return { ok: false, error: 'genau eine Option muss empfohlen sein' };
  return { ok: true };
}

const L4 = /\b(merge|mergen|gemergt|deploy|deployment|produktion|production|live|stripe|preis|price|zahlung|payment|lösch|delete|drop|irreversib)/i;
const L3 = /\b(secret|token|passwort|password|kosten|cost|budget|rls|berechtigung|permission|sicherheit|security|migration)/i;
const L2 = /\b(architektur|architecture|produkt|product|strategie|strategy|priorit)/i;

/** Konservative Ableitung der Freigabestufe aus Frage/Kontext/Reversibilität. */
export function requiredApprovalLevel(text: string, reversibility: Reversibility = 'reversible'): ApprovalLevel {
  if (reversibility === 'irreversible' || L4.test(text)) return 'L4';
  if (L3.test(text) || reversibility === 'partially_reversible') return 'L3';
  if (L2.test(text)) return 'L2';
  return 'L1';
}

export const APPROVAL_LABEL: Record<ApprovalLevel, string> = {
  L0: 'L0 · Reine Analyse',
  L1: 'L1 · Reversible Entwicklungsaufgabe',
  L2: 'L2 · Produkt-/Architekturentscheidung',
  L3: 'L3 · Sicherheits-/kostenrelevant: ausdrückliche Freigabe',
  L4: 'L4 · Produktion/Merge/Zahlung/irreversibel: Einzelfreigabe',
};

export interface AgentDecisionInsert {
  tenant_id: string;
  decision_title: string;
  problem: string;
  options: ProposalOption[];
  recommendation: string;
  reason: string;
  risk_level: RiskLevel;
  reversibility: Reversibility;
  status: 'proposed';
  proposed_by: string;
}

export function toAgentDecisionInsert(args: {
  tenantId: string;
  question: string;
  context?: string | null;
  proposedBy: string;
  proposal: DecisionProposal;
}): AgentDecisionInsert {
  const rec = args.proposal.options.find((o) => o.recommended)!;
  return {
    tenant_id: args.tenantId,
    decision_title: args.question.slice(0, 200),
    problem: args.context?.trim() ? `${args.question}\n\n${args.context}` : args.question,
    options: args.proposal.options.map((o) => ({ ...o, recommended: o.recommended === true })),
    recommendation: rec.label,
    reason: rec.rationale,
    risk_level: args.proposal.riskLevel ?? 'medium',
    reversibility: args.proposal.reversibility ?? 'reversible',
    status: 'proposed',
    proposed_by: args.proposedBy,
  };
}
