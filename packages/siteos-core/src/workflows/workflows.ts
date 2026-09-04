// Die acht Workflows als Vokabular (Zielarchitektur §8).
//
// ## Was ein Workflow hier ist — und was nicht
//
// Ein Workflow ist die **Benennung eines Anlasses**, unter dem mehrere Skills
// zusammen laufen. Er ist kein Ausführer: die Reihenfolge einzelner Agenten
// bestimmt weiterhin `planAgentTasks` aus den Befunden, und abgearbeitet wird
// über `siteos_agent_runs`.
//
// Der Unterschied ist nicht kosmetisch. Heute entstehen Agentenläufe als Folge
// eines Scans, und niemand kann hinterher sagen, *warum* sie entstanden sind —
// ein Kunde sieht sieben Agenten arbeiten, aber nicht, dass es sich um seine
// „Continuous Compliance" handelt. §8 Regel 1 verlangt genau das: „Ein
// Einstiegspunkt in der Oberfläche ist die Sicht auf einen Skill oder
// Workflow, nicht auf eine Funktion."
//
// ## Die Reichweite ist das eigentliche Delta
//
// §11 nennt als Lücke „Workflows über Assetgrenzen". `scope` schreibt fest,
// welche Workflows das brauchen und welche nicht — bevor jemand für alle acht
// eine Portfolio-Ausführung baut, die sechs davon nie benutzen.
//
// Heute kann die Plattform nur `asset` ausführen: `siteos_agent_runs` hängt an
// genau einem `blueprint_id`. Die vier `portfolio`-Workflows sind damit
// benannt, aber noch nicht ausführbar — und das steht hier, statt es der
// nächsten Sitzung zu überlassen, es erneut herauszufinden.

import type { SkillKey } from './skills.ts';

export type WorkflowKey =
  | 'website-transformation'
  | 'privacy-review'
  | 'ai-governance'
  | 'continuous-compliance'
  | 'change-monitoring'
  | 'incident-response'
  | 'content-governance'
  | 'publishing-governance';

/**
 * Reichweite eines Workflows.
 *
 * `asset`      — läuft gegen genau ein Asset. Heute ausführbar.
 * `portfolio`  — spannt über mehrere Assets eines Mandanten. Benannt, aber
 *                noch ohne Ausführung: dafür fehlt ein Laufobjekt, das mehr
 *                als ein `blueprint_id` trägt.
 */
export type WorkflowScope = 'asset' | 'portfolio';

export interface WorkflowDefinition {
  key: WorkflowKey;
  label: string;
  /** Beteiligte Skills, in fachlicher Reihenfolge. */
  skills: SkillKey[];
  scope: WorkflowScope;
  /** Warum dieser Workflow anläuft — in Produktsprache. */
  trigger: string;
}

export const WORKFLOWS: Readonly<Record<WorkflowKey, WorkflowDefinition>> = Object.freeze({
  'website-transformation': {
    key: 'website-transformation',
    label: 'Website Transformation',
    // Transformation zuerst: sie erzeugt die Version, die die übrigen Skills
    // anschliessend bewerten.
    skills: ['transformation', 'website', 'seo', 'accessibility', 'content'],
    scope: 'asset',
    trigger: 'Eine neue oder überarbeitete Fassung eines Assets entsteht.',
  },
  'privacy-review': {
    key: 'privacy-review',
    label: 'Privacy Review',
    skills: ['privacy', 'security'],
    scope: 'asset',
    trigger: 'Datenschutzrechtliche Prüfung eines Assets, anlassbezogen oder turnusmässig.',
  },
  'ai-governance': {
    key: 'ai-governance',
    label: 'AI Governance',
    skills: ['ai-risk', 'privacy'],
    // KI-Systeme sind eigene Assets neben Websites (§4). Eine Bewertung nach
    // EU AI Act betrifft das Register, nicht eine einzelne Seite.
    scope: 'portfolio',
    trigger: 'Ein KI-System wird eingeführt, geändert oder turnusmässig neu bewertet.',
  },
  'continuous-compliance': {
    key: 'continuous-compliance',
    label: 'Continuous Compliance',
    skills: ['privacy', 'security', 'accessibility', 'ai-risk'],
    // Der Regelbetrieb aus §1: nicht ein Bericht je Asset, sondern der
    // fortlaufende Zustand der gesamten Infrastruktur.
    scope: 'portfolio',
    trigger: 'Regelbetrieb: fortlaufende Prüfung aller Assets eines Mandanten.',
  },
  'change-monitoring': {
    key: 'change-monitoring',
    label: 'Change Monitoring',
    skills: ['website', 'security', 'content'],
    scope: 'portfolio',
    trigger: 'Ein Beobachtungslauf meldet eine Abweichung zum letzten Stand.',
  },
  'incident-response': {
    key: 'incident-response',
    label: 'Incident Response',
    skills: ['security', 'privacy'],
    // Ein Vorfall hält sich nicht an Assetgrenzen: dasselbe Leck kann mehrere
    // Sites betreffen, und die 72-Stunden-Frist nach Art. 33 DSGVO läuft für
    // den Mandanten, nicht je Seite.
    scope: 'portfolio',
    trigger: 'Ein kritischer Befund oder eine externe Meldung löst einen Vorfall aus.',
  },
  'content-governance': {
    key: 'content-governance',
    label: 'Content Governance',
    skills: ['content', 'seo', 'accessibility'],
    scope: 'asset',
    trigger: 'Inhalte eines Assets werden erstellt, geändert oder geprüft.',
  },
  'publishing-governance': {
    key: 'publishing-governance',
    label: 'Publishing Governance',
    skills: ['transformation', 'privacy', 'accessibility'],
    // Der Publish Gate (§7) entscheidet je Artefakt, also je Asset.
    scope: 'asset',
    trigger: 'Eine Fassung soll veröffentlicht werden und durchläuft den Publish Gate.',
  },
});

export const WORKFLOW_KEYS = Object.keys(WORKFLOWS) as WorkflowKey[];

/** Workflows, die diesen Skill benutzen. */
export function workflowsForSkill(skill: SkillKey): WorkflowKey[] {
  return WORKFLOW_KEYS.filter((key) => WORKFLOWS[key].skills.includes(skill));
}

/** Workflows, die heute ausführbar sind — `portfolio` fehlt das Laufobjekt. */
export function executableWorkflows(): WorkflowKey[] {
  return WORKFLOW_KEYS.filter((key) => WORKFLOWS[key].scope === 'asset');
}

/**
 * Anlass eines Laufs aus dem Auslöser des Scans ableiten.
 *
 * `siteos_runtime_scans.trigger` kennt vier Werte, und drei davon benennen
 * einen Workflow eindeutig. Das ist eine Ableitung aus vorhandenen Daten,
 * keine Vermutung — deshalb steht sie hier und nicht als Vorgabe im Handler.
 *
 * `agent` bleibt bewusst bei Continuous Compliance: ein Agent, der einen
 * weiteren Scan anstösst, arbeitet im Regelbetrieb, nicht an einer
 * Veröffentlichung.
 */
export function workflowForScanTrigger(trigger: string): WorkflowKey {
  switch (trigger) {
    case 'deploy':
      return 'publishing-governance';
    case 'cron':
      return 'change-monitoring';
    case 'manual':
    case 'agent':
      return 'continuous-compliance';
    default:
      // Unbekannter Auslöser: der allgemeinste Anlass, nicht der engste.
      // Ein Lauf falsch als „Publishing Governance" zu führen, wäre eine
      // Aussage über eine Veröffentlichung, die es nie gab.
      return 'continuous-compliance';
  }
}
