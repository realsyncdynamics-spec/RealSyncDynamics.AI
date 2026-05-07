/**
 * Rule Engine Evaluator — Deno-Variante für Supabase Edge Functions.
 *
 * Mirror von src/rules/evaluator.ts (Frontend), aber mit JSON-Imports
 * via fetch(import.meta.url) für Deno-Kompatibilität. Identische
 * Semantik. Bei Phase-9-Migration verschmilzt beides zu einem Package.
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

export interface RuleCondition {
  fact: string;
  operator: Operator;
  value: unknown;
}

export interface ComplianceRule {
  id: string;
  title: string;
  description: string;
  category: RuleCategory;
  severity: Severity;
  norms: string[];
  conditions: RuleCondition[];
  remediation: { summary: string; steps: string[] };
  version: string;
  updated_at: string;
}

export interface Finding {
  rule_id: string;
  title: string;
  description: string;
  severity: Severity;
  category: RuleCategory;
  norms: string[];
  matched_facts: Record<string, unknown>;
  remediation: ComplianceRule['remediation'];
}

export const RULE_ENGINE_VERSION = '2026.05.0';

import gdpr from './gdpr.json' with { type: 'json' };
import aiAct from './ai-act.json' with { type: 'json' };

export function getAllRules(): ComplianceRule[] {
  const all = [
    ...(gdpr as { rules: ComplianceRule[] }).rules,
    ...(aiAct as { rules: ComplianceRule[] }).rules,
  ];
  const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return all.sort((a, b) => order[a.severity] - order[b.severity]);
}

function getFact(facts: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = facts;
  for (const p of parts) {
    if (current && typeof current === 'object' && p in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return current;
}

function compare(actual: unknown, op: Operator, expected: unknown): boolean {
  switch (op) {
    case 'equals':
      return actual === expected;
    case 'not_equals':
      return actual !== expected;
    case 'contains':
      if (typeof actual === 'string' && typeof expected === 'string') return actual.includes(expected);
      if (Array.isArray(actual)) return (actual as unknown[]).includes(expected);
      return false;
    case 'not_contains':
      return !compare(actual, 'contains', expected);
    case 'gt':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'gte':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case 'lt':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'lte':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    case 'in':
      return Array.isArray(expected) && (expected as unknown[]).includes(actual);
    case 'not_in':
      return !compare(actual, 'in', expected);
    default:
      return false;
  }
}

export function evaluateAll(facts: Record<string, unknown>): Finding[] {
  const findings: Finding[] = [];
  for (const rule of getAllRules()) {
    const all = rule.conditions.every((c) => compare(getFact(facts, c.fact), c.operator, c.value));
    if (all) {
      const matched: Record<string, unknown> = {};
      for (const c of rule.conditions) matched[c.fact] = getFact(facts, c.fact);
      findings.push({
        rule_id: rule.id,
        title: rule.title,
        description: rule.description,
        severity: rule.severity,
        category: rule.category,
        norms: rule.norms,
        matched_facts: matched,
        remediation: rule.remediation,
      });
    }
  }
  return findings;
}
