// Agenten-Register des internen AI-OS.
//
// Ein Agent ist hier eine Rolle mit Positivliste: welche Skills er nutzt,
// welche Tool-Aktionen er höchstens auslösen darf und über welche Kanäle er
// ausgeführt wird. Ausführende sind heute
//   1. Claude Code (interaktiv oder als Cloud-Sitzung) mit den SKILL.md-Dateien,
//   2. deterministische Routinen in GitHub Actions.
// Weitere Ausführende (Codex, Claude Code Action in CI, eigene Worker) docken
// über denselben Vertrag an: Agent-ID + Aktion → Gateway-Entscheidung → Protokoll.
//
// Abgrenzung: `src/core/realsync-os/agentMesh.ts` und das WP5-Register
// (`src/features/governance/agents/`) beschreiben Agenten der KUNDENplattform.
// Dieses Register beschreibt den BETRIEB von RealSyncDynamics.AI.

import type { AgentDefinition } from './types.ts';

export const AGENTS: readonly AgentDefinition[] = [
  {
    id: 'development',
    name: 'Development Agent',
    purpose: 'Code analysieren, Fehler finden, Tests ausführen, Pull Requests vorbereiten.',
    responsibilities: [
      'Pull Requests prüfen und Befunde begründen',
      'Fehlgeschlagene CI-Läufe einordnen',
      'Merge-Konflikte erkennen (merge-hygiene)',
      'Änderungen als Branch + Draft-PR vorbereiten',
    ],
    skills: ['aios-pr-review', 'aios-ci-failure-analysis', 'aios-code-quality-audit', 'aios-dashboard-review'],
    allowedActions: [
      'github.pulls.read',
      'github.actions.read',
      'github.contents.read',
      'github.workflow.dispatch',
      'github.workflow.toggle',
      'github.routine.report',
      'github.pr.prepare',
    ],
    executors: ['claude-session', 'github-actions', 'edge-gateway'],
    status: 'preview',
  },
  {
    id: 'compliance',
    name: 'Compliance Agent',
    purpose: 'Produktversprechen gegen tatsächliche Implementierung prüfen und Belege dokumentieren.',
    responsibilities: [
      'DSGVO- und AI-Act-Anforderungen strukturieren',
      'Marketingaussagen mit implementation-status.ts und Belegdateien vergleichen',
      'Nachweise (Dateien, Tests, Routen) benennen',
    ],
    skills: ['aios-compliance-verification'],
    allowedActions: [
      'github.contents.read',
      'github.workflow.dispatch',
      'github.workflow.toggle',
      'github.routine.report',
    ],
    executors: ['claude-session', 'github-actions', 'edge-gateway'],
    status: 'preview',
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure Agent',
    purpose: 'Infrastruktur, Sicherheits-Guards und Deploy-Bereitschaft überwachen.',
    responsibilities: [
      'Letzte Läufe von CodeQL, Drift-Guards und Cron-Health auswerten',
      'Deploy-Status (Cloudflare Pages, Supabase) aus Workflow-Läufen lesen',
      'Release-Bereitschaft feststellen — Deploy bleibt menschlich',
    ],
    skills: ['aios-security-audit', 'aios-release-readiness'],
    allowedActions: [
      'github.actions.read',
      'github.pulls.read',
      'github.contents.read',
      'cloudflare.deploy.read',
      'supabase.health.read',
      'github.workflow.dispatch',
      'github.workflow.toggle',
      'github.routine.report',
    ],
    executors: ['claude-session', 'github-actions', 'edge-gateway'],
    status: 'preview',
  },
  {
    id: 'business-ops',
    name: 'Business Operations Agent',
    purpose: 'Geschäftsberichte und Kostenanalysen aus belegten Quellen vorbereiten.',
    responsibilities: [
      'KI-Betriebskosten aus dem Kosten-Ledger auswerten',
      'Umsatz- und Abo-Zahlen aus Stripe (lesend) zusammenfassen',
      'Wiederkehrende Verwaltungsaufgaben als Entwurf vorbereiten — Versand nur nach Freigabe',
    ],
    skills: ['aios-business-report'],
    allowedActions: ['supabase.costs.read', 'stripe.read', 'google.read'],
    executors: ['claude-session', 'edge-gateway'],
    status: 'preview',
    blockers: [
      'Softwarekosten (Abos, Rechnungen) haben noch keine strukturierte Quelle — nur manuell aus Rechnungen.',
      'Keine serverseitige Routine: Stripe/Google nur in Claude-Sitzungen über die Connectoren des Kontoinhabers.',
    ],
  },
  {
    id: 'knowledge',
    name: 'Knowledge Agent',
    purpose: 'Projektwissen erfassen, strukturieren, verknüpfen und anderen Agenten bereitstellen.',
    responsibilities: [
      'Wissensbasis docs/ai-os pflegen (Frontmatter, Prüfdatum, Links)',
      'Entscheidungen (ADRs, PLAN.md) mit Notizen verknüpfen',
      'Dokumentation nach Codeänderungen nachziehen — im Kontextbudget',
    ],
    skills: ['aios-knowledge-update', 'aios-documentation-update'],
    allowedActions: [
      'github.contents.read',
      'github.knowledge.propose',
      'github.workflow.dispatch',
      'github.workflow.toggle',
      'github.routine.report',
      'github.pr.prepare',
    ],
    executors: ['claude-session', 'github-actions', 'edge-gateway'],
    status: 'preview',
  },
];

export function getAgent(id: string): AgentDefinition | undefined {
  return AGENTS.find((a) => a.id === id);
}
