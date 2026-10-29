// Routinen-Register — zeitgesteuerte und ereignisbasierte Aufgaben.
//
// Ausführung: GitHub Actions (serverseitig, isolierter Runner, kein lokaler PC,
// keine offene Claude-Sitzung). Jede Routine ist eine eigene Workflow-Datei,
// damit sie einzeln pausiert werden kann (GitHub „Disable workflow" — aus dem
// Command Center über `github.workflow.toggle`). Alle Routinen sind
// deterministisch: kein Modellaufruf, daher `maxLlmCostEur: 0`.
//
// test/ai-os/registry.test.ts prüft gegen die Workflow-Dateien: Datei existiert,
// `permissions` stimmen exakt, `timeout-minutes` und `concurrency` gesetzt,
// `workflow_dispatch` vorhanden.

import type { ExistingRoutine, RoutineDefinition, RoutineLimits } from './types.ts';

const READ_LIMITS: RoutineLimits = {
  timeoutMinutes: 10,
  maxApiCalls: 60,
  maxAttempts: 3,
  maxLlmCostEur: 0,
  artifactRetentionDays: 14,
};

const LOCAL_LIMITS: RoutineLimits = {
  timeoutMinutes: 10,
  maxApiCalls: 0,
  maxAttempts: 1,
  maxLlmCostEur: 0,
  artifactRetentionDays: 14,
};

export const ROUTINES: readonly RoutineDefinition[] = [
  {
    id: 'daily-github-status',
    name: 'Tägliche GitHub-Statusprüfung',
    agent: 'development',
    workflowFile: 'ai-os-github-status.yml',
    command: 'github-status',
    triggers: [
      { kind: 'schedule', cron: '50 5 * * *', description: 'täglich 05:50 UTC' },
      { kind: 'manual', description: 'Start aus dem Command Center' },
    ],
    inputs: ['offene PRs', 'Check-Status je PR-Head', 'Workflow-Läufe auf main (24 h)'],
    permissions: { contents: 'read', 'pull-requests': 'read', actions: 'read', checks: 'read' },
    limits: READ_LIMITS,
    outputs: ['Job-Summary', 'Artefakt ai-os-report.json'],
    status: 'preview',
  },
  {
    id: 'ci-failure-analysis',
    name: 'Analyse fehlgeschlagener CI-Checks',
    agent: 'development',
    workflowFile: 'ai-os-ci-failures.yml',
    command: 'ci-failures',
    triggers: [
      { kind: 'event', event: 'workflow_run: CI completed on main', description: 'nach jedem CI-Lauf auf main' },
      { kind: 'manual', description: 'Start aus dem Command Center' },
    ],
    inputs: ['fehlgeschlagene Workflow-Läufe auf main (72 h)', 'Jobs und Schritte je Lauf'],
    permissions: { contents: 'read', actions: 'read', checks: 'read' },
    limits: READ_LIMITS,
    outputs: ['Job-Summary', 'Artefakt ai-os-report.json'],
    status: 'preview',
  },
  {
    id: 'weekly-dev-report',
    name: 'Wöchentlicher Entwicklungsbericht',
    agent: 'development',
    workflowFile: 'ai-os-weekly-report.yml',
    command: 'weekly-report',
    triggers: [
      { kind: 'schedule', cron: '10 6 * * 1', description: 'montags 06:10 UTC' },
      { kind: 'manual', description: 'Start aus dem Command Center' },
    ],
    inputs: ['gemergte und neue PRs (7 Tage)', 'CI-Erfolgsquote auf main (7 Tage)'],
    permissions: { contents: 'read', 'pull-requests': 'read', actions: 'read' },
    limits: READ_LIMITS,
    outputs: ['Job-Summary', 'Artefakt ai-os-report.json'],
    status: 'preview',
  },
  {
    id: 'security-infra-check',
    name: 'Sicherheits- und Infrastrukturprüfung',
    agent: 'infrastructure',
    workflowFile: 'ai-os-security-infra.yml',
    command: 'security-infra',
    triggers: [
      { kind: 'schedule', cron: '10 7 * * *', description: 'täglich 07:10 UTC, nach den Drift-Guards' },
      { kind: 'manual', description: 'Start aus dem Command Center' },
    ],
    inputs: ['letzter Lauf von CodeQL, Drift-Guards, Cron-Health, Deploy', 'offene Sicherheits-PRs'],
    permissions: { contents: 'read', 'pull-requests': 'read', actions: 'read' },
    limits: READ_LIMITS,
    outputs: ['Job-Summary', 'Artefakt ai-os-report.json'],
    status: 'preview',
  },
  {
    id: 'claims-evidence-check',
    name: 'Prüfung offener Implementierungsrisiken',
    agent: 'compliance',
    workflowFile: 'ai-os-claims-evidence.yml',
    command: 'claims-evidence',
    triggers: [
      { kind: 'schedule', cron: '20 6 * * 3', description: 'mittwochs 06:20 UTC' },
      { kind: 'manual', description: 'Start aus dem Command Center' },
    ],
    inputs: ['src/product/implementation-status.ts (live-Einträge und Belegdateien)'],
    permissions: { contents: 'read' },
    limits: LOCAL_LIMITS,
    outputs: ['Job-Summary', 'Artefakt ai-os-report.json'],
    status: 'preview',
  },
  {
    id: 'docs-control',
    name: 'Regelmäßige Dokumentationskontrolle',
    agent: 'knowledge',
    workflowFile: 'ai-os-docs-control.yml',
    command: 'docs-control',
    triggers: [
      { kind: 'schedule', cron: '30 6 * * 3', description: 'mittwochs 06:30 UTC' },
      { kind: 'manual', description: 'Start aus dem Command Center' },
    ],
    inputs: ['docs/ai-os (Frontmatter, Prüfdatum)', 'AI-OS-Register (Skill-Dateien)', 'Kontextbudget'],
    permissions: { contents: 'read' },
    limits: LOCAL_LIMITS,
    outputs: ['Job-Summary', 'Artefakt ai-os-report.json'],
    status: 'preview',
  },
];

/**
 * Bestehende Automationen — registriert, nicht ersetzt. Quelle: Workflow-
 * Dateien und pg_cron-Migrationen (Stand 2026-10-15). Der Live-Zustand der
 * pg_cron-Jobs kommt zur Laufzeit aus `admin_system_health().cron_jobs`.
 */
export const EXISTING_ROUTINES: readonly ExistingRoutine[] = [
  { id: 'gh-ci', name: 'CI (Gates, Unit, Build, DB)', agent: 'development', runtime: 'github-actions', source: '.github/workflows/ci.yml', schedule: 'PR, merge_group, push main' },
  { id: 'gh-e2e', name: 'E2E (Playwright)', agent: 'development', runtime: 'github-actions', source: '.github/workflows/e2e.yml', schedule: 'PR, push main' },
  { id: 'gh-merge-hygiene', name: 'Merge-Hygiene', agent: 'development', runtime: 'github-actions', source: '.github/workflows/merge-hygiene.yml', schedule: '*/30 * * * *' },
  { id: 'gh-codeql', name: 'CodeQL', agent: 'infrastructure', runtime: 'github-actions', source: '.github/workflows/codeql.yml', schedule: '23 4 * * 1 + PR' },
  { id: 'gh-migration-drift', name: 'Migration-Drift-Guard', agent: 'infrastructure', runtime: 'github-actions', source: '.github/workflows/migration-drift.yml', schedule: '0 6 * * *' },
  { id: 'gh-edge-drift', name: 'Edge-Function-Drift-Guard', agent: 'infrastructure', runtime: 'github-actions', source: '.github/workflows/edge-function-drift.yml', schedule: '0 6 * * *' },
  { id: 'gh-acl-drift', name: 'Function-ACL-Drift-Guard', agent: 'infrastructure', runtime: 'github-actions', source: '.github/workflows/function-acl-drift.yml', schedule: '30 6 * * *' },
  { id: 'gh-entitlement-drift', name: 'Entitlement-Drift-Guard', agent: 'compliance', runtime: 'github-actions', source: '.github/workflows/entitlement-drift.yml', schedule: '45 6 * * *' },
  { id: 'gh-cron-health', name: 'Cron-Health-Guard', agent: 'infrastructure', runtime: 'github-actions', source: '.github/workflows/cron-health.yml', schedule: '45 6 * * *' },
  { id: 'pg-agent-os-runner', name: 'Agent-OS-Runner (Kundenplattform)', agent: 'infrastructure', runtime: 'pg_cron', source: 'agent-os-runner-hourly / -daily', schedule: '0 * * * * / 0 6 * * *' },
  { id: 'pg-governance-monitoring', name: 'Governance-Monitoring', agent: 'compliance', runtime: 'pg_cron', source: 'governance-monitoring-hourly / -daily', schedule: '15 * * * * / 0 2 * * *' },
  { id: 'pg-dsr-erasure', name: 'DSR-Löschlauf', agent: 'compliance', runtime: 'pg_cron', source: 'dsr-erasure-sweep', schedule: '0 3 * * *' },
  { id: 'pg-stripe-meter', name: 'Stripe-Meter-Sync', agent: 'business-ops', runtime: 'pg_cron', source: 'stripe-meter-sync-hourly', schedule: '5 * * * *' },
  { id: 'pg-business-metrics', name: 'Business-Metrics', agent: 'business-ops', runtime: 'pg_cron', source: 'business-metrics-cron-15min', schedule: '*/15 * * * *' },
  { id: 'cf-govard-seal', name: 'Govard: Tagessiegel und Freigabe-Ablauf', agent: 'infrastructure', runtime: 'cloudflare-cron', source: 'workers/govard-gateway/wrangler.jsonc', schedule: '30 3 * * *' },
];

export function getRoutine(id: string): RoutineDefinition | undefined {
  return ROUTINES.find((r) => r.id === id);
}

export function getRoutineByWorkflow(file: string): RoutineDefinition | undefined {
  return ROUTINES.find((r) => r.workflowFile === file);
}
