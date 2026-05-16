// Skill-Bindings — Brueckenschicht zwischen den UI-/Routing-Skills aus
// `src/lib/skills/` und der Runtime aus `src/core/runtime/`.
//
// Verantwortlichkeiten dieser Schicht (und NUR dieser Schicht):
//   1. SkillDef (lib) → SkillManifest (runtime) ableiten (Risiko, Caps, PII)
//   2. Pure-Function-Aufrufe der lib/skills in Runtime-Handler verpacken
//   3. Action-Dispatch innerhalb eines Skills (z.B. CR / CTR / ROAS)
//   4. Sicherstellen, dass `reviewRequired` und Risiko `high` ein
//      Approval-Gate erzwingen (auto_approve = false)
//
// Was diese Schicht NICHT macht:
//   - keine eigene Executor-Logik (geht durch core/runtime/Executor)
//   - keine eigene Permission-/Approval-Mechanik (geht durch core/runtime)
//   - keine externen Calls

import type { Capability, PiiClass, RiskLevel, SkillManifest } from '../types';
import type { SkillDef, SkillKey } from '../../../lib/skills/registry';

/**
 * Runtime-Skill-IDs sind dot-namespaced. Wir spiegeln den kebab-case
 * lib/skills-Key in `skills.<snake_case>` — die Runtime-Regex erlaubt
 * keine Bindestriche.
 */
export function runtimeSkillId(key: SkillKey): string {
  return `skills.${key.replace(/-/g, '_')}`;
}

/** Mapping pro Skill-Domain — wird vom Manifest-Builder gelesen. */
interface DomainHint {
  capabilities: readonly Capability[];
  pii_class: PiiClass;
  /** Manifest-spezifischer Risiko-Override (selten benoetigt). */
  riskOverride?: RiskLevel;
}

const DOMAIN_HINTS: Record<SkillKey, DomainHint> = {
  'data-exploration': {
    capabilities: ['read:dataset', 'pii:process'],
    pii_class: 'identifier',
  },
  'finance-audit-support': {
    capabilities: ['read:finance_records', 'pii:process'],
    pii_class: 'identifier',
  },
  'legal-compliance': {
    capabilities: ['read:legal_resources', 'network:external'],
    pii_class: 'none',
  },
  'legal-contract-review': {
    capabilities: ['read:contracts'],
    pii_class: 'contact',
  },
  'marketing-performance-analytics': {
    capabilities: ['read:marketing_events'],
    pii_class: 'identifier',
  },
  'sales-call-prep': {
    capabilities: ['read:crm', 'network:external'],
    pii_class: 'contact',
  },
  'sales-draft-outreach': {
    // Outreach-Skill schreibt einen Draft (nicht versendet).
    capabilities: ['read:crm', 'network:external', 'write:outreach_drafts'],
    pii_class: 'contact',
    // Outreach ist mittlere Konsequenz, soll aber wegen Auto-Send-Risiko
    // explizit als high gegated werden.
    riskOverride: 'high',
  },
};

/**
 * Mappt das lib-Risiko (low/medium/high) auf das Runtime-Risiko
 * (low/medium/high/critical). Wir nutzen `critical` aktuell nicht.
 */
function toRuntimeRisk(level: SkillDef['riskLevel']): RiskLevel {
  switch (level) {
    case 'low':    return 'low';
    case 'medium': return 'medium';
    case 'high':   return 'high';
  }
}

/**
 * Auto-approve nur, wenn ALLES davon zutrifft:
 *   - Risiko-Klasse `low`
 *   - kein reviewRequired
 *   - kein write:-Capability
 *   - kein pii:-Capability
 *
 * Das spiegelt den Validator in `core/runtime/registry.ts`. Wir muessen
 * hier zusaetzlich `reviewRequired` ehren — ein reviewRequired-Skill ist
 * niemals auto-approved, selbst wenn er low-risk waere.
 */
function canAutoApprove(skill: SkillDef, caps: readonly Capability[], runtimeRisk: RiskLevel): boolean {
  if (skill.reviewRequired) return false;
  if (runtimeRisk !== 'low') return false;
  for (const c of caps) {
    if (c.startsWith('write:')) return false;
    if (c.startsWith('pii:')) return false;
    if (c === 'consent:write') return false;
  }
  return true;
}

/**
 * Erzeugt aus einem lib-SkillDef das runtime-seitige SkillManifest.
 */
export function buildSkillManifest(skill: SkillDef): SkillManifest {
  const hint = DOMAIN_HINTS[skill.key];
  if (!hint) {
    throw new Error(`No runtime domain hint registered for skill: ${skill.key}`);
  }
  const runtimeRisk = hint.riskOverride ?? toRuntimeRisk(skill.riskLevel);
  const capabilities = hint.capabilities;
  return {
    id: runtimeSkillId(skill.key),
    version: 1,
    title: skill.label,
    description: skill.description,
    capabilities,
    risk_level: runtimeRisk,
    auto_approve: canAutoApprove(skill, capabilities, runtimeRisk),
    pii_class: hint.pii_class,
    idempotent: true,
  };
}
