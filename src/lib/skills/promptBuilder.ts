// Skill Prompt Builder — erzeugt eine vorzeigbare Prompt-Vorschau fuer einen
// Skill. KEIN LLM-Call. Wird in der UI fuer den Test-Modus + im Smoke-Script
// gegen die Akzeptanz-Kriterien verwendet.

import { getSkill, type SkillKey } from './registry';

export interface PromptPreview {
  system: string;
  guardrails: string[];
  reviewRequired: boolean;
  userPrompt: string;
}

export function buildPrompt(key: SkillKey, userInput: string): PromptPreview {
  const skill = getSkill(key);
  const lines = [
    `# Skill: ${skill.label}`,
    `# Risk: ${skill.riskLevel}`,
    `# UserData: ${skill.requiresUserData ? 'ja' : 'nein'}`,
    `# WebResearch: ${skill.requiresWebResearch ? 'ja' : 'nein'}`,
    '',
    skill.description,
    '',
    'Halte dich strikt an die folgenden Guardrails:',
    ...skill.guardrails.map((g) => `- ${g}`),
  ];
  if (skill.reviewRequired) {
    lines.push('- Ausgabe ist ein Entwurf. Vor Versand/Verwendung Mensch-Review einholen.');
  }
  return {
    system: lines.join('\n'),
    guardrails: skill.guardrails,
    reviewRequired: skill.reviewRequired,
    userPrompt: userInput,
  };
}
