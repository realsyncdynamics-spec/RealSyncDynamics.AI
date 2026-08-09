// Agenten-Registry.
//
// Die sieben SiteOS-Agenten arbeiten asynchron: sie werden aus Befunden
// abgeleitet, in `siteos_agent_runs` eingereiht und von der bestehenden
// Governance-Runtime abgearbeitet. Diese Datei definiert nur, WER wofür
// zuständig ist und WELCHE Rechte er hat — die Ausführung liegt in den
// Edge Functions.
//
// Grundsatz: kein Agent verändert eine Live-Site ohne Nachweis. Agenten mit
// `canMutateBlueprint` erzeugen eine neue Blueprint-Version (mit eigenem
// Hash und Snapshot); Agenten mit `requiresApproval` warten zusätzlich auf
// eine Freigabe in `governance_approvals`.

import type { AgentDefinition, AgentKey, Dimension, RuntimeFinding, Severity } from '../types.ts';

export const AGENTS: Readonly<Record<AgentKey, AgentDefinition>> = Object.freeze({
  compliance: {
    key: 'compliance',
    label: 'Compliance-Agent',
    dimensions: ['gdpr', 'tdddg', 'eu-ai-act'],
    // Rechtstexte und Einwilligungsschranken werden strukturell gesetzt,
    // nicht formuliert — deshalb darf der Agent den Blueprint ändern,
    // aber nie ohne Freigabe.
    canMutateBlueprint: true,
    requiresApproval: true,
    cadenceMinutes: 60,
  },
  seo: {
    key: 'seo',
    label: 'SEO-Agent',
    dimensions: ['seo'],
    canMutateBlueprint: true,
    requiresApproval: false,
    cadenceMinutes: 1440,
  },
  accessibility: {
    key: 'accessibility',
    label: 'Barrierefreiheits-Agent',
    dimensions: ['accessibility'],
    canMutateBlueprint: true,
    requiresApproval: false,
    cadenceMinutes: 1440,
  },
  security: {
    key: 'security',
    label: 'Sicherheits-Agent',
    dimensions: ['security'],
    // Header und Transport gehören zur Auslieferung, nicht zum Blueprint.
    canMutateBlueprint: false,
    requiresApproval: false,
    cadenceMinutes: 60,
  },
  performance: {
    key: 'performance',
    label: 'Performance-Agent',
    dimensions: ['performance'],
    canMutateBlueprint: false,
    requiresApproval: false,
    cadenceMinutes: 360,
  },
  content: {
    key: 'content',
    label: 'Content-Agent',
    dimensions: ['content'],
    canMutateBlueprint: true,
    requiresApproval: true,
    cadenceMinutes: null,
  },
  monitoring: {
    key: 'monitoring',
    label: 'Monitoring-Agent',
    // Der Monitoring-Agent besitzt keine eigene Dimension: er stößt die
    // Scans an, aus denen alle anderen ihre Arbeit ableiten.
    dimensions: [],
    canMutateBlueprint: false,
    requiresApproval: false,
    cadenceMinutes: 15,
  },
});

export const AGENT_KEYS = Object.keys(AGENTS) as AgentKey[];

/** Zuständiger Agent für eine Dimension; `null` wenn keiner definiert ist. */
export function agentForDimension(dimension: Dimension): AgentKey | null {
  for (const key of AGENT_KEYS) {
    if (AGENTS[key].dimensions.includes(dimension)) return key;
  }
  return null;
}

export interface AgentTask {
  agent: AgentKey;
  /** Befund-Codes, die diesen Lauf begründen. */
  findingCodes: string[];
  /** Höchste Schwere im Arbeitspaket — bestimmt die Abarbeitungsreihenfolge. */
  severityMax: Severity;
  /** Muss vor Ausführung eine Freigabe eingeholt werden? */
  requiresApproval: boolean;
}

const SEVERITY_RANK: Readonly<Record<Severity, number>> = Object.freeze({
  critical: 4, high: 3, medium: 2, low: 1, info: 0,
});

/**
 * Bündelt Befunde zu Arbeitspaketen — ein Paket je zuständigem Agenten.
 * Die Rückgabe ist absteigend nach Schwere sortiert, bei Gleichstand
 * alphabetisch nach Agent, damit die Reihenfolge reproduzierbar ist.
 */
export function planAgentTasks(findings: RuntimeFinding[]): AgentTask[] {
  const byAgent = new Map<AgentKey, { codes: Set<string>; severityMax: Severity }>();

  for (const finding of findings) {
    const agent = agentForDimension(finding.dimension);
    if (agent === null) continue;

    const existing = byAgent.get(agent);
    if (existing === undefined) {
      byAgent.set(agent, { codes: new Set([finding.code]), severityMax: finding.severity });
      continue;
    }
    existing.codes.add(finding.code);
    if (SEVERITY_RANK[finding.severity] > SEVERITY_RANK[existing.severityMax]) {
      existing.severityMax = finding.severity;
    }
  }

  const tasks: AgentTask[] = [];
  for (const [agent, bucket] of byAgent) {
    tasks.push({
      agent,
      findingCodes: [...bucket.codes].sort(),
      severityMax: bucket.severityMax,
      requiresApproval: AGENTS[agent].requiresApproval,
    });
  }

  return tasks.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[b.severityMax] - SEVERITY_RANK[a.severityMax];
    return bySeverity !== 0 ? bySeverity : a.agent.localeCompare(b.agent);
  });
}
