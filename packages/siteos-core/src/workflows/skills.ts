// Die acht Skills als Vokabular (Zielarchitektur §8).
//
// ## Warum ein Vokabular und keine neuen Agenten
//
// §8 verlangt: „Die KI-Fähigkeiten sitzen hier — nicht als 50 einzelne
// Buttons, sondern als Skills." Der Satz beschreibt keine fehlende Fähigkeit,
// sondern eine fehlende **Benennung**. Die Arbeit tun die sieben Agenten aus
// `../agents/registry.ts` bereits; was fehlte, war der Name, unter dem ein
// Kunde sie adressiert.
//
// Deshalb legt diese Datei nichts Ausführendes an. Sie ordnet zu:
//
//     Dimension  →  Skill  →  Agent(en)
//
// Ein Skill ist die Produktsprache, ein Agent die Ausführung. Wer hier einen
// neunten Agenten sucht, sucht am falschen Ort.
//
// ## Regel 1 aus §8, prüfbar gemacht
//
// „Kein Feature ohne Skill-Zuordnung." Als Prosa ist das nicht durchsetzbar.
// Als Zuordnungstabelle mit zwei Invarianten schon:
//
//   1. Jede `Dimension` wird von **genau einem** Skill abgedeckt.
//   2. Jeder `AgentKey` ist von **mindestens einem** Skill erreichbar.
//
// Beide prüft `test/siteos/workflow-vocabulary.test.ts`. Ein neuer Agent oder
// eine neue Dimension ohne Zuordnung bricht den Test — und nicht erst die
// Oberfläche, in der die Fähigkeit dann namenlos auftaucht.

import { AGENT_KEYS, AGENTS } from '../agents/registry.ts';
import type { AgentKey, Dimension } from '../types.ts';

export type SkillKey =
  | 'website'
  | 'privacy'
  | 'security'
  | 'content'
  | 'seo'
  | 'ai-risk'
  | 'accessibility'
  | 'transformation';

export interface SkillDefinition {
  key: SkillKey;
  /** Produktsprache. Erscheint in der Oberfläche, nicht der Agentenname. */
  label: string;
  /**
   * Analyse-Dimensionen, die dieser Skill verantwortet. Zusammen decken alle
   * Skills jede Dimension genau einmal ab — sonst wäre ein Befund entweder
   * heimatlos oder doppelt zuständig.
   */
  dimensions: Dimension[];
  /**
   * Ausführende Agenten. Leer bedeutet: der Skill hat heute keinen
   * asynchronen Agenten — nicht, dass er nicht existiert.
   */
  agents: AgentKey[];
}

export const SKILLS: Readonly<Record<SkillKey, SkillDefinition>> = Object.freeze({
  website: {
    key: 'website',
    label: 'Website Intelligence',
    dimensions: ['performance'],
    // Der Monitoring-Agent hat keine eigene Dimension: er stösst die Scans an,
    // aus denen alle anderen ihre Arbeit ableiten. Er gehört trotzdem hierher
    // und nicht in ein Niemandsland — sonst wäre er der eine Agent ohne
    // Skill-Zuordnung, den Regel 1 ausschliesst.
    agents: ['performance', 'monitoring'],
  },
  privacy: {
    key: 'privacy',
    label: 'Privacy Intelligence',
    dimensions: ['gdpr', 'tdddg'],
    agents: ['compliance'],
  },
  security: {
    key: 'security',
    label: 'Security Intelligence',
    dimensions: ['security'],
    agents: ['security'],
  },
  content: {
    key: 'content',
    label: 'Content Intelligence',
    dimensions: ['content'],
    agents: ['content'],
  },
  seo: {
    key: 'seo',
    label: 'SEO Intelligence',
    dimensions: ['seo'],
    agents: ['seo'],
  },
  'ai-risk': {
    key: 'ai-risk',
    label: 'AI Risk Intelligence',
    dimensions: ['eu-ai-act'],
    // Derselbe Agent wie bei `privacy`: der Compliance-Agent bedient beide
    // Rechtsrahmen. Zwei Skills, ein Ausführender — das ist kein Fehler in
    // der Zuordnung, sondern der Unterschied zwischen Produktsprache und
    // Ausführung.
    agents: ['compliance'],
  },
  accessibility: {
    key: 'accessibility',
    label: 'Accessibility Intelligence',
    dimensions: ['accessibility'],
    agents: ['accessibility'],
  },
  transformation: {
    key: 'transformation',
    label: 'Transformation Intelligence',
    // Transformation erzeugt Befunde nicht, sie beantwortet sie: Blueprint
    // bauen, Artefakt rendern, durch den Publish Gate führen. Deshalb keine
    // eigene Dimension — und heute kein asynchroner Agent, sondern der
    // synchrone Pfad `siteos/builder` → `siteos/publish-gate`.
    dimensions: [],
    agents: [],
  },
});

export const SKILL_KEYS = Object.keys(SKILLS) as SkillKey[];

/**
 * Zuständiger Skill für eine Dimension.
 *
 * Gibt `null` zurück statt zu werfen: eine neu eingeführte Dimension ohne
 * Zuordnung soll den Aufrufer nicht abstürzen lassen, sondern im Test
 * auffallen (Invariante 1).
 */
export function skillForDimension(dimension: Dimension): SkillKey | null {
  for (const key of SKILL_KEYS) {
    if (SKILLS[key].dimensions.includes(dimension)) return key;
  }
  return null;
}

/**
 * Skill, unter dem ein Agent läuft.
 *
 * Ein Agent kann mehreren Skills dienen (der Compliance-Agent bedient
 * `privacy` und `ai-risk`). Für die Beschriftung eines konkreten Laufs zählt
 * aber die **Dimension der Befunde**, nicht der Agent — deshalb ist diese
 * Funktion nur der Rückfallweg für Läufe ohne Befundbezug, und sie liefert
 * bewusst den ersten Treffer in Deklarationsreihenfolge.
 */
export function skillForAgent(agent: AgentKey): SkillKey | null {
  for (const key of SKILL_KEYS) {
    if (SKILLS[key].agents.includes(agent)) return key;
  }
  return null;
}

/**
 * Skill für ein konkretes Arbeitspaket, abgeleitet aus seinen Befundcodes.
 *
 * Der Befundcode trägt seine Dimension im Präfix (`gdpr.missing-impressum`),
 * und die Dimension bestimmt den Skill. Das ist genauer als der Umweg über
 * den Agenten: Der Compliance-Agent bearbeitet DSGVO- und AI-Act-Befunde,
 * aber ein Lauf über `eu-ai-act.*`-Codes gehört zu `ai-risk`, nicht zu
 * `privacy`.
 *
 * Bei gemischten Dimensionen gewinnt die häufigste; bei Gleichstand die
 * Deklarationsreihenfolge in `SKILLS`, damit das Ergebnis reproduzierbar ist.
 */
export function skillForFindingCodes(codes: string[], fallbackAgent: AgentKey): SkillKey | null {
  const tally = new Map<SkillKey, number>();

  for (const code of codes) {
    const prefix = code.split('.')[0];
    const skill = skillForDimension(prefix as Dimension);
    if (skill === null) continue;
    tally.set(skill, (tally.get(skill) ?? 0) + 1);
  }

  if (tally.size === 0) return skillForAgent(fallbackAgent);

  let best: SkillKey | null = null;
  let bestCount = 0;
  // Über SKILL_KEYS iterieren statt über die Map: die Map-Reihenfolge hängt
  // an der Reihenfolge der Befunde, die Deklarationsreihenfolge nicht.
  for (const key of SKILL_KEYS) {
    const count = tally.get(key) ?? 0;
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

/** Verlangt dieser Skill für mindestens einen seiner Agenten eine Freigabe? */
export function skillRequiresApproval(skill: SkillKey): boolean {
  return SKILLS[skill].agents.some((agent) => AGENTS[agent].requiresApproval);
}

/**
 * Agenten, die keinem Skill zugeordnet sind.
 *
 * Existiert für die Prüfung von Regel 1 — im Normalfall leer. Als Funktion
 * statt als Konstante, damit der Test gegen die aktuelle Registry misst und
 * nicht gegen einen Stand, der beim Import eingefroren wurde.
 */
export function agentsWithoutSkill(): AgentKey[] {
  return AGENT_KEYS.filter((agent) => skillForAgent(agent) === null);
}
