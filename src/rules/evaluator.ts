/**
 * Rule Engine Evaluator.
 *
 * Liest fact-Dictionary (z. B. von Audit-Crawler oder UI-Wizard) und
 * gibt strukturierte Findings zurück. Portable: Code kann 1:1 in
 * `packages/compliance-rules/` (Phase 9) verschoben werden.
 */
import gdpr from './gdpr.json';
import aiAct from './ai-act.json';
import type { ComplianceRule, RuleCondition, Finding, Operator } from './types';

/**
 * Hole alle Rules sortiert nach Severity (critical → low).
 */
export function getAllRules(): ComplianceRule[] {
  const all = [...(gdpr.rules as ComplianceRule[]), ...(aiAct.rules as ComplianceRule[])];
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return all.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * Hole eine einzelne Rule.
 */
export function getRule(ruleId: string): ComplianceRule | undefined {
  return getAllRules().find((r) => r.id === ruleId);
}

/**
 * Liest einen dot-path aus dem facts-Objekt.
 * `tracker.google_analytics.detected` → facts.tracker.google_analytics.detected
 */
function getFact(facts: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = facts;
  for (const p of parts) {
    if (current && typeof current === 'object' && p in current) {
      current = (current as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Evaluiert eine einzelne Bedingung.
 */
function evaluateCondition(facts: Record<string, unknown>, cond: RuleCondition): boolean {
  const actual = getFact(facts, cond.fact);
  return compare(actual, cond.operator, cond.value);
}

function compare(actual: unknown, op: Operator, expected: unknown): boolean {
  switch (op) {
    case 'equals':
      return actual === expected;
    case 'not_equals':
      return actual !== expected;
    case 'contains':
      if (typeof actual === 'string' && typeof expected === 'string') return actual.includes(expected);
      if (Array.isArray(actual)) return actual.includes(expected);
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

/**
 * Evaluiert eine Rule gegen facts.
 * Conditions sind UND-verknüpft. Alle müssen wahr sein.
 */
export function evaluateRule(rule: ComplianceRule, facts: Record<string, unknown>): boolean {
  return rule.conditions.every((c) => evaluateCondition(facts, c));
}

/**
 * Hauptfunktion: evaluiert alle Rules gegen facts und gibt Findings zurück.
 * Gibt nur die Rules zurück, deren conditions alle wahr sind.
 */
export function evaluateAll(facts: Record<string, unknown>): Finding[] {
  const findings: Finding[] = [];
  for (const rule of getAllRules()) {
    if (evaluateRule(rule, facts)) {
      // Sammle die fact-Werte, die zur Match geführt haben — für Audit-Trail
      const matched: Record<string, unknown> = {};
      for (const c of rule.conditions) {
        matched[c.fact] = getFact(facts, c.fact);
      }
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

/**
 * Filter-Helper: nur Findings über einer Severity-Schwelle.
 */
export function filterBySeverity(
  findings: Finding[],
  min: 'low' | 'medium' | 'high' | 'critical',
): Finding[] {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  const threshold = order[min];
  return findings.filter((f) => order[f.severity] <= threshold);
}

/**
 * Aggregiert einen Score (0-100) aus Findings.
 * Penalties: critical -25, high -12, medium -5, low -2.
 */
export function calculateScore(findings: Finding[]): number {
  const penalty = { critical: 25, high: 12, medium: 5, low: 2 };
  const total = findings.reduce((sum, f) => sum + penalty[f.severity], 0);
  return Math.max(0, Math.min(100, 100 - total));
}
