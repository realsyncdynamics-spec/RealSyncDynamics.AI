#!/usr/bin/env -S node --experimental-strip-types
// Skill-Registry Smoke-Script.
//
// Pruefungen:
//   1. Genau 7 Skills sind registriert (kein cx-ticket-triage dupliziert).
//   2. Jeder Skill hat Trigger, useCases, guardrails.
//   3. Router erkennt fuer jeden Skill mindestens einen seiner Trigger.
//   4. PromptBuilder enthaelt alle Guardrails des Skills + Skill-Label.
//   5. High-Risk-Skills haben reviewRequired = true.
//   6. Pure Functions laufen mit Beispiel-Input ohne Throw.
//
// Usage:
//   npm run qa:skills

import { ALL_SKILLS, SKILL_REGISTRY, type SkillKey } from '../src/lib/skills/registry';
import { routeSkill } from '../src/lib/skills/router';
import { buildPrompt } from '../src/lib/skills/promptBuilder';
import { classifyColumn, buildDataProfilingPlan } from '../src/lib/skills/dataExploration';
import { classifyDeficiency, recommendSampleSize } from '../src/lib/skills/financeAuditSupport';
import { buildDsarChecklist, buildDpaReviewChecklist } from '../src/lib/skills/legalCompliance';
import { classifyClauseDeviation, buildRedlineReviewPlan } from '../src/lib/skills/legalContractReview';
import {
  calculateConversionRate, calculateCtr, calculateRoas, prioritizeOptimization,
} from '../src/lib/skills/marketingPerformanceAnalytics';
import { buildCallPrepOutline } from '../src/lib/skills/salesCallPrep';
import { buildOutreachResearchPlan } from '../src/lib/skills/salesDraftOutreach';

const expectedKeys: SkillKey[] = [
  'data-exploration',
  'finance-audit-support',
  'gdpr-audit',
  'legal-compliance',
  'legal-contract-review',
  'marketing-performance-analytics',
  'sales-call-prep',
  'sales-draft-outreach',
];

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail });
}

// 1. Registry-Vollstaendigkeit
check('registry has exactly 8 skills', ALL_SKILLS.length === 8, `got ${ALL_SKILLS.length}`);
for (const key of expectedKeys) {
  check(`registry contains ${key}`, !!SKILL_REGISTRY[key]);
}
check(
  'no cx-ticket-triage duplicate',
  !ALL_SKILLS.some((s) => (s.key as string) === 'cx-ticket-triage'),
);

// 2. Strukturelle Pflichtfelder + Router-Coverage + Prompt-Guardrails
for (const skill of ALL_SKILLS) {
  check(`${skill.key}: has triggers`, skill.triggers.length > 0);
  check(`${skill.key}: has useCases`, skill.useCases.length > 0);
  check(`${skill.key}: has guardrails`, skill.guardrails.length > 0);

  const probe = skill.triggers[0]!;
  const routed = routeSkill(`Ich brauche etwas zu ${probe}`);
  check(
    `${skill.key}: router resolves trigger "${probe}"`,
    routed.selectedSkill === skill.key,
    `got ${routed.selectedSkill}`,
  );

  const preview = buildPrompt(skill.key, 'sample input');
  for (const g of skill.guardrails) {
    check(`${skill.key}: prompt includes guardrail`, preview.system.includes(g));
  }
  check(`${skill.key}: prompt has Skill label`, preview.system.includes(skill.label));
  if (skill.riskLevel === 'high') {
    check(`${skill.key}: high-risk requires review`, skill.reviewRequired === true);
  }
}

// 6. Pure Functions Smoke
try {
  classifyColumn('user_id', ['u1', 'u2']);
  buildDataProfilingPlan([{ name: 'amount', type: 'numeric', reason: 'ok' }]);
  classifyDeficiency({ likelihood: 'medium', magnitude: 'high' });
  recommendSampleSize('monthly', 'high');
  buildDsarChecklist('gdpr');
  buildDpaReviewChecklist();
  classifyClauseDeviation('material');
  buildRedlineReviewPlan('msa', 'customer');
  calculateConversionRate(15, 200);
  calculateCtr(50, 5000);
  calculateRoas(1000, 250);
  prioritizeOptimization([
    { id: 'a', hypothesis: 'a', impactScore: 0.8, effortScore: 0.3, confidence: 0.7 },
    { id: 'b', hypothesis: 'b', impactScore: 0.6, effortScore: 0.6, confidence: 0.5 },
  ]);
  buildCallPrepOutline('Acme GmbH', 'discovery');
  buildOutreachResearchPlan({ company: 'Acme', contactRole: 'VP Eng' });
  check('all pure-function skeletons execute', true);
} catch (e) {
  check('all pure-function skeletons execute', false, (e as Error).message);
}

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  const tag = r.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`${tag}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
