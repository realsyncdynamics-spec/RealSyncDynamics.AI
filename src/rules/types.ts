/**
 * Shared types for the compliance Rule Engine.
 *
 * Format ist bewusst portable — bei Phase-9-Migration wird dieses File
 * nach `packages/compliance-rules/src/types.ts` verschoben, ohne Änderungen.
 */

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type RuleCategory =
  | 'tracking'
  | 'consent'
  | 'transparency'
  | 'data-transfer'
  | 'rights'
  | 'documentation'
  | 'ai-act'
  | 'security';

export type Operator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in';

/**
 * Eine Bedingung wird gegen `facts: Record<string, unknown>` evaluiert.
 * `fact` ist ein dot-path (z. B. `tracker.google_analytics.detected`).
 */
export interface RuleCondition {
  fact: string;
  operator: Operator;
  value: unknown;
}

/**
 * Conditions sind UND-verknüpft. Für ODER: mehrere Rules anlegen.
 * Bei Bedarf später: `any: RuleCondition[]` für ODER-Gruppen.
 */
export interface ComplianceRule {
  id: string;
  title: string;
  description: string;
  category: RuleCategory;
  severity: Severity;
  norms: string[];
  conditions: RuleCondition[];
  remediation: {
    summary: string;
    steps: string[];
  };
  /** Methodology-Version, in der diese Regel zuletzt aktualisiert wurde */
  version: string;
  /** ISO date string der letzten Änderung */
  updated_at: string;
}

/**
 * Output einer Rule-Engine-Auswertung.
 */
export interface Finding {
  rule_id: string;
  title: string;
  description: string;
  severity: Severity;
  category: RuleCategory;
  norms: string[];
  matched_facts: Record<string, unknown>;
  remediation: ComplianceRule['remediation'];
  /** Optionale Evidence-Referenz (Phase 7.3 schema) */
  evidence_id?: string;
}

/**
 * Methodology-Version, die das Rule-Set tagged.
 * Bei jedem Rule-Add/Update müssen wir diese Version bumpen.
 */
export const RULE_ENGINE_VERSION = '2026.05.0';
