// Skill- und Workflow-Vokabular — Zielarchitektur §8.
//
// Zwei Sorten Test stehen hier nebeneinander:
//
//   1. **Invarianten** — sie halten das Vokabular vollständig, wenn jemand
//      später einen Agenten oder eine Dimension hinzufügt. Das ist der
//      eigentliche Zweck der Datei: §8 Regel 1 („Kein Feature ohne
//      Skill-Zuordnung") ist als Prosa nicht durchsetzbar, als Test schon.
//   2. **Ableitungen** — sie prüfen, dass ein Lauf den richtigen Namen
//      bekommt. Ein falsch beschrifteter Lauf ist schlimmer als ein
//      unbeschrifteter: er behauptet einen Anlass, den es nicht gab.

import { describe, expect, it } from 'vitest';
import { AGENT_KEYS, AGENTS } from '../../packages/siteos-core/src/agents/registry';
import {
  SKILLS,
  SKILL_KEYS,
  agentsWithoutSkill,
  skillForAgent,
  skillForDimension,
  skillForFindingCodes,
  skillRequiresApproval,
} from '../../packages/siteos-core/src/workflows/skills';
import {
  WORKFLOWS,
  WORKFLOW_KEYS,
  executableWorkflows,
  workflowForScanTrigger,
  workflowsForSkill,
} from '../../packages/siteos-core/src/workflows/workflows';
import type { Dimension } from '../../packages/siteos-core/src/types';

/**
 * Die acht Dimensionen aus `types.ts`, hier bewusst noch einmal ausgeschrieben.
 *
 * Eine Ableitung aus dem Typ wäre zur Laufzeit nicht verfügbar, und eine aus
 * `SKILLS` wäre zirkulär — der Test prüft ja genau, ob SKILLS sie abdeckt.
 * Wird `Dimension` erweitert, muss diese Liste mit: das ist die gewollte
 * Reibung, denn eine neue Dimension ohne Skill ist der Fall, den §8 Regel 1
 * ausschliesst.
 */
const ALL_DIMENSIONS: Dimension[] = [
  'gdpr', 'eu-ai-act', 'tdddg', 'accessibility',
  'security', 'performance', 'seo', 'content',
];

describe('§8 Regel 1 — Invarianten des Vokabulars', () => {
  it('deckt jede Dimension mit genau einem Skill ab', () => {
    for (const dimension of ALL_DIMENSIONS) {
      const owners = SKILL_KEYS.filter((key) => SKILLS[key].dimensions.includes(dimension));
      // Nicht `toBeTruthy()`: bei zwei Zuständigen wäre unklar, welcher
      // Skill einen Befund trägt — und die Beschriftung hinge am Zufall der
      // Deklarationsreihenfolge.
      expect(owners, `Dimension "${dimension}" braucht genau einen Skill`).toHaveLength(1);
    }
  });

  it('lässt keinen Agenten ohne Skill', () => {
    expect(agentsWithoutSkill()).toEqual([]);
  });

  it('erreicht jeden der sieben Agenten aus mindestens einem Skill', () => {
    const reachable = new Set(SKILL_KEYS.flatMap((key) => SKILLS[key].agents));
    for (const agent of AGENT_KEYS) {
      expect(reachable.has(agent), `Agent "${agent}" ist von keinem Skill erreichbar`).toBe(true);
    }
  });

  it('nennt nur Agenten, die es wirklich gibt', () => {
    for (const key of SKILL_KEYS) {
      for (const agent of SKILLS[key].agents) {
        expect(AGENTS[agent], `Skill "${key}" nennt unbekannten Agenten "${agent}"`).toBeDefined();
      }
    }
  });

  it('führt genau acht Skills und acht Workflows', () => {
    expect(SKILL_KEYS).toHaveLength(8);
    expect(WORKFLOW_KEYS).toHaveLength(8);
  });

  it('benutzt in jedem Workflow nur bekannte Skills', () => {
    for (const key of WORKFLOW_KEYS) {
      for (const skill of WORKFLOWS[key].skills) {
        expect(SKILLS[skill], `Workflow "${key}" nennt unbekannten Skill "${skill}"`).toBeDefined();
      }
    }
  });

  it('lässt keinen Skill ohne Workflow — sonst wäre er nicht erreichbar', () => {
    for (const skill of SKILL_KEYS) {
      expect(workflowsForSkill(skill).length, `Skill "${skill}" kommt in keinem Workflow vor`)
        .toBeGreaterThan(0);
    }
  });
});

describe('Skill-Zuordnung', () => {
  it('trennt privacy und ai-risk, obwohl derselbe Agent ausführt', () => {
    expect(skillForDimension('gdpr')).toBe('privacy');
    expect(skillForDimension('tdddg')).toBe('privacy');
    expect(skillForDimension('eu-ai-act')).toBe('ai-risk');

    // Beide laufen über den Compliance-Agenten — Produktsprache und
    // Ausführung fallen hier auseinander, und das ist Absicht.
    expect(SKILLS.privacy.agents).toEqual(['compliance']);
    expect(SKILLS['ai-risk'].agents).toEqual(['compliance']);
  });

  it('ordnet den Monitoring-Agenten der Website Intelligence zu', () => {
    // Der Agent hat keine eigene Dimension; ohne diese Zuordnung wäre er der
    // eine Agent ohne Skill.
    expect(skillForAgent('monitoring')).toBe('website');
    expect(AGENTS.monitoring.dimensions).toEqual([]);
  });

  it('lässt Transformation Intelligence ohne Dimension und ohne Agent', () => {
    // Transformation beantwortet Befunde, sie erzeugt keine. Ein erfundener
    // Agent hier wäre eine Fähigkeit, die es nicht gibt.
    expect(SKILLS.transformation.dimensions).toEqual([]);
    expect(SKILLS.transformation.agents).toEqual([]);
  });

  it('meldet Freigabepflicht über den ausführenden Agenten', () => {
    // Compliance- und Content-Agent verlangen eine Freigabe, SEO nicht.
    expect(skillRequiresApproval('privacy')).toBe(true);
    expect(skillRequiresApproval('ai-risk')).toBe(true);
    expect(skillRequiresApproval('content')).toBe(true);
    expect(skillRequiresApproval('seo')).toBe(false);
    expect(skillRequiresApproval('security')).toBe(false);
  });
});

describe('Skill aus Befundcodes — der Weg, den die Handler nehmen', () => {
  it('leitet aus dem Dimensions-Präfix ab', () => {
    expect(skillForFindingCodes(['gdpr.missing-impressum'], 'compliance')).toBe('privacy');
    expect(skillForFindingCodes(['eu-ai-act.no-disclosure'], 'compliance')).toBe('ai-risk');
    expect(skillForFindingCodes(['seo.title-too-long'], 'seo')).toBe('seo');
  });

  it('unterscheidet zwei Skills desselben Agenten korrekt', () => {
    // Genau der Fall, für den die Ableitung über Codes statt über den
    // Agenten existiert: derselbe Agent, zwei verschiedene Skills.
    expect(skillForFindingCodes(['gdpr.a'], 'compliance')).toBe('privacy');
    expect(skillForFindingCodes(['eu-ai-act.a'], 'compliance')).toBe('ai-risk');
  });

  it('nimmt bei gemischten Dimensionen die häufigste', () => {
    const skill = skillForFindingCodes(
      ['gdpr.a', 'gdpr.b', 'eu-ai-act.a'],
      'compliance',
    );
    expect(skill).toBe('privacy');
  });

  it('entscheidet bei Gleichstand reproduzierbar, nicht nach Eingabereihenfolge', () => {
    const a = skillForFindingCodes(['gdpr.a', 'eu-ai-act.a'], 'compliance');
    const b = skillForFindingCodes(['eu-ai-act.a', 'gdpr.a'], 'compliance');
    expect(a).toBe(b);
  });

  it('fällt ohne verwertbare Codes auf den Agenten zurück', () => {
    expect(skillForFindingCodes([], 'monitoring')).toBe('website');
    expect(skillForFindingCodes(['unbekannt.code'], 'security')).toBe('security');
  });
});

describe('Workflow-Anlass aus dem Scan-Auslöser', () => {
  it('ordnet die vier bekannten Auslöser zu', () => {
    expect(workflowForScanTrigger('deploy')).toBe('publishing-governance');
    expect(workflowForScanTrigger('cron')).toBe('change-monitoring');
    expect(workflowForScanTrigger('manual')).toBe('continuous-compliance');
    expect(workflowForScanTrigger('agent')).toBe('continuous-compliance');
  });

  it('wählt bei unbekanntem Auslöser den allgemeinsten Anlass', () => {
    // Nicht publishing-governance: das wäre eine Aussage über eine
    // Veröffentlichung, die nie stattgefunden hat.
    expect(workflowForScanTrigger('etwas-neues')).toBe('continuous-compliance');
    expect(workflowForScanTrigger('')).toBe('continuous-compliance');
  });
});

describe('Reichweite — das eigentliche Delta aus §11', () => {
  it('führt genau die vier assetübergreifenden Workflows als portfolio', () => {
    const portfolio = WORKFLOW_KEYS.filter((key) => WORKFLOWS[key].scope === 'portfolio');
    expect(portfolio.sort()).toEqual([
      'ai-governance',
      'change-monitoring',
      'continuous-compliance',
      'incident-response',
    ]);
  });

  it('meldet nur die asset-gebundenen Workflows als heute ausführbar', () => {
    // `siteos_agent_runs` hängt an genau einem blueprint_id — mehr ist heute
    // nicht ausführbar. Der Test hält diese Aussage aktuell: wer den
    // Dispatcher baut, ändert hier mit.
    expect(executableWorkflows().sort()).toEqual([
      'content-governance',
      'privacy-review',
      'publishing-governance',
      'website-transformation',
    ].sort());
  });

  it('verlangt für jeden Workflow einen benannten Anlass', () => {
    for (const key of WORKFLOW_KEYS) {
      expect(WORKFLOWS[key].trigger.length, `Workflow "${key}" ohne Anlass`).toBeGreaterThan(10);
    }
  });
});
