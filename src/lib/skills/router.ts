// Skill Router — entscheidet anhand eines Free-Text-Inputs, welcher Skill
// am besten passt. Reine Keyword/Trigger-Heuristik; KEIN LLM-Call, KEIN
// externer Roundtrip.

import { ALL_SKILLS, SKILL_REGISTRY, type SkillDef, type SkillKey } from './registry';

export interface RouteCandidate {
  key: SkillKey;
  score: number;
  matchedTriggers: string[];
}

export interface RouteResult {
  selectedSkill: SkillKey | null;
  confidence: number;        // 0..1
  reason: string;
  candidates: RouteCandidate[];
  requiresWebResearch: boolean;
  riskLevel: SkillDef['riskLevel'] | null;
  guardrails: string[];
}

function normalize(input: string): string {
  return input.toLowerCase();
}

function scoreSkill(input: string, skill: SkillDef): RouteCandidate {
  const matched: string[] = [];
  for (const trigger of skill.triggers) {
    if (input.includes(trigger)) matched.push(trigger);
  }
  const score = matched.length === 0
    ? 0
    : matched.length + matched.reduce((acc, t) => acc + t.length, 0) / 100;
  return { key: skill.key, score, matchedTriggers: matched };
}

export function routeSkill(rawInput: string): RouteResult {
  const input = normalize(rawInput ?? '');
  if (!input.trim()) {
    return {
      selectedSkill: null,
      confidence: 0,
      reason: 'leerer Input',
      candidates: [],
      requiresWebResearch: false,
      riskLevel: null,
      guardrails: [],
    };
  }

  const scored = ALL_SKILLS
    .map((s) => scoreSkill(input, s))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      selectedSkill: null,
      confidence: 0,
      reason: 'kein Trigger getroffen',
      candidates: [],
      requiresWebResearch: false,
      riskLevel: null,
      guardrails: [],
    };
  }

  const top = scored[0]!;
  const second = scored[1]?.score ?? 0;
  const gap = top.score - second;
  // Confidence: top.score alleine, plus Abstand zum zweitbesten. Cappt auf 1.
  const confidence = Math.min(1, top.score / 4 + gap / 4);

  const selected = SKILL_REGISTRY[top.key];
  return {
    selectedSkill: top.key,
    confidence: Math.round(confidence * 100) / 100,
    reason: `Trigger getroffen: ${top.matchedTriggers.join(', ')}`,
    candidates: scored.slice(0, 5),
    requiresWebResearch: selected.requiresWebResearch,
    riskLevel: selected.riskLevel,
    guardrails: selected.guardrails,
  };
}
