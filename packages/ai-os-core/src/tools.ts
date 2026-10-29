// Tool-Gateway-Katalog — jede Aktion, die ein Agent des internen AI-OS
// auslösen darf, mit Klasse, Ausführungskanal und Freigabeweg.
//
// Regeln (geprüft in test/ai-os/registry.test.ts):
// - Default-Deny: Was hier nicht steht, ist nicht erlaubt.
// - `critical` hat nie den Kanal `edge-gateway` — Merge, Deploy, Produktions-
//   SQL und Stripe-Schreibzugriffe laufen über die bestehenden Freigabewege
//   (PR-Review, `deploy.yml` nach Merge, Stripe-Dashboard), nie über das AI-OS.
// - Schreibaktionen brauchen Bestätigung im UI und eine AAL2-Sitzung.
// - Secrets: nur Namen und Ablageort, nie Werte.

import type { ToolAction, ToolDefinition } from './types.ts';

export const TOOLS: readonly ToolDefinition[] = [
  {
    id: 'github',
    name: 'GitHub',
    access: ['api', 'mcp'],
    description:
      'Repository, Pull Requests, Checks und Actions. Serverseitig über die REST-API mit einem fein granularen Token; in Claude-Code-Sitzungen über den GitHub-MCP.',
  },
  {
    id: 'supabase',
    name: 'Supabase (EU)',
    access: ['api', 'cli', 'mcp'],
    description:
      'Postgres, RLS und Edge Functions. Das AI-OS liest nur Aggregate über die Service-Role in der Edge Function; Migrationen laufen ausschließlich über PR + deploy.yml.',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Pages / Workers',
    access: ['cli', 'mcp'],
    description:
      'Deploy-Status wird aus den GitHub-Workflow-Läufen gelesen (deploy-cloudflare-pages.yml). Kein Cloudflare-Token im AI-OS.',
  },
  {
    id: 'google-workspace',
    name: 'Google Drive, Docs, Sheets, Gmail, Calendar',
    access: ['mcp'],
    description:
      'Nur in Claude-Sitzungen über die claude.ai-Connectoren des Kontoinhabers. Kein Server-Zugang, keine personenbezogenen Inhalte in Routine-Logs.',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    access: ['mcp', 'api'],
    description:
      'Lesend in Claude-Sitzungen (Stripe-MCP) für Berichte. Schreibzugriffe (Preise, Produkte, Erstattungen) sind kritisch und bleiben im Stripe-Dashboard.',
  },
  {
    id: 'project-api',
    name: 'Projekt-APIs (Edge Functions)',
    access: ['api'],
    description:
      'Bestehende operator-gesperrte RPCs wie `admin_system_health`. Das AI-OS ruft sie mit dem Nutzer-JWT auf, nie mit Service-Role im Browser.',
  },
];

export const TOOL_ACTIONS: readonly ToolAction[] = [
  // ── GitHub ────────────────────────────────────────────────────────────
  {
    id: 'github.pulls.read',
    tool: 'github',
    label: 'Offene Pull Requests und deren Checks lesen',
    class: 'read',
    channel: 'edge-gateway',
    status: 'preview',
    secret: { name: 'AI_OS_GITHUB_TOKEN', store: 'supabase-function-secret' },
    approval: 'none',
  },
  {
    id: 'github.actions.read',
    tool: 'github',
    label: 'Workflow-Läufe, Routinen-Status und Releases lesen',
    class: 'read',
    channel: 'edge-gateway',
    status: 'preview',
    secret: { name: 'AI_OS_GITHUB_TOKEN', store: 'supabase-function-secret' },
    approval: 'none',
  },
  {
    id: 'github.contents.read',
    tool: 'github',
    label: 'Wissensbasis (docs/ai-os) vom Hauptzweig lesen',
    class: 'read',
    channel: 'edge-gateway',
    status: 'preview',
    secret: { name: 'AI_OS_GITHUB_TOKEN', store: 'supabase-function-secret' },
    approval: 'none',
  },
  {
    id: 'github.workflow.dispatch',
    tool: 'github',
    label: 'AI-OS-Routine manuell starten',
    class: 'write',
    channel: 'edge-gateway',
    status: 'preview',
    secret: { name: 'AI_OS_GITHUB_TOKEN', store: 'supabase-function-secret' },
    approval: 'confirm',
    note: 'Nur Workflows aus dem Routinen-Register; die Routinen selbst lesen nur.',
  },
  {
    id: 'github.workflow.toggle',
    tool: 'github',
    label: 'AI-OS-Routine pausieren oder fortsetzen',
    class: 'write',
    channel: 'edge-gateway',
    status: 'preview',
    secret: { name: 'AI_OS_GITHUB_TOKEN', store: 'supabase-function-secret' },
    approval: 'confirm',
    note: 'Nur Workflows aus dem Routinen-Register.',
  },
  {
    id: 'github.knowledge.propose',
    tool: 'github',
    label: 'Änderung an der Wissensbasis als Draft-PR vorschlagen',
    class: 'write',
    channel: 'edge-gateway',
    status: 'preview',
    secret: { name: 'AI_OS_GITHUB_TOKEN', store: 'supabase-function-secret' },
    approval: 'confirm',
    note: 'Nur Pfade unter docs/ai-os/. Wirksam erst nach Review und Merge.',
  },
  {
    id: 'github.routine.report',
    tool: 'github',
    label: 'Routinebericht im Workflow erzeugen (Job-Summary + Artefakt)',
    class: 'read',
    channel: 'github-actions',
    status: 'preview',
    secret: { name: 'GITHUB_TOKEN', store: 'github-actions' },
    approval: 'none',
  },
  {
    id: 'github.pr.prepare',
    tool: 'github',
    label: 'Branch pushen und Draft-PR anlegen (Claude-Code-Sitzung)',
    class: 'write',
    channel: 'claude-session',
    status: 'live',
    approval: 'confirm',
    note: 'Bestehender Arbeitsweg: ein Branch, ein PR, Squash. Kein Push auf main.',
  },
  {
    id: 'github.pr.merge',
    tool: 'github',
    label: 'Pull Request mergen',
    class: 'critical',
    channel: 'manual',
    status: 'live',
    approval: 'separate-release',
    note: 'Nur durch einen Menschen nach Review (PR-Triage-Policy).',
  },
  // ── Supabase ──────────────────────────────────────────────────────────
  {
    id: 'supabase.costs.read',
    tool: 'supabase',
    label: 'KI-Kosten aus tenant_cost_ledger und ai_tool_runs aggregieren',
    class: 'read',
    channel: 'edge-gateway',
    status: 'preview',
    approval: 'none',
    note: 'Nur Summen je Anbieter/Modell/Werkzeug, keine Einzelzeilen, keine Mandanten-IDs.',
  },
  {
    id: 'supabase.audit.read',
    tool: 'supabase',
    label: 'AI-OS-Aktionsprotokoll lesen',
    class: 'read',
    channel: 'edge-gateway',
    status: 'preview',
    approval: 'none',
  },
  {
    id: 'supabase.health.read',
    tool: 'project-api',
    label: 'System-Health und pg_cron-Jobs lesen (admin_system_health)',
    class: 'read',
    channel: 'edge-gateway',
    status: 'preview',
    approval: 'none',
    note: 'Bestehende RPC (prüft is_super_admin selbst), aufgerufen mit dem Nutzer-JWT.',
  },
  {
    id: 'supabase.migration.apply',
    tool: 'supabase',
    label: 'Migration auf Produktion anwenden',
    class: 'critical',
    channel: 'manual',
    status: 'live',
    approval: 'separate-release',
    note: 'Nur über PR-Merge und deploy.yml; nie destruktiv.',
  },
  // ── Cloudflare ────────────────────────────────────────────────────────
  {
    id: 'cloudflare.deploy.read',
    tool: 'cloudflare',
    label: 'Deploy-Status aus deploy-cloudflare-pages.yml lesen',
    class: 'read',
    channel: 'edge-gateway',
    status: 'preview',
    secret: { name: 'AI_OS_GITHUB_TOKEN', store: 'supabase-function-secret' },
    approval: 'none',
  },
  {
    id: 'cloudflare.deploy.production',
    tool: 'cloudflare',
    label: 'Produktionsdeploy auslösen',
    class: 'critical',
    channel: 'manual',
    status: 'live',
    approval: 'separate-release',
    note: 'Deploy folgt dem Merge auf main; kein Agentenpfad.',
  },
  // ── Google Workspace ─────────────────────────────────────────────────
  {
    id: 'google.read',
    tool: 'google-workspace',
    label: 'Drive/Docs/Sheets/Calendar/Gmail lesen (Claude-Sitzung)',
    class: 'read',
    channel: 'claude-session',
    status: 'preview',
    secret: { name: 'claude.ai Google-Connector', store: 'claude-connector' },
    approval: 'none',
    note: 'Inhalte bleiben in der Sitzung; nichts davon wird ins Repository übernommen.',
  },
  {
    id: 'google.send',
    tool: 'google-workspace',
    label: 'E-Mail senden, Termin anlegen, Datei teilen',
    class: 'critical',
    channel: 'claude-session',
    status: 'preview',
    secret: { name: 'claude.ai Google-Connector', store: 'claude-connector' },
    approval: 'separate-release',
    note: 'Außenwirkung — nur nach ausdrücklicher Freigabe in der Sitzung.',
  },
  // ── Stripe ───────────────────────────────────────────────────────────
  {
    id: 'stripe.read',
    tool: 'stripe',
    label: 'Umsätze, Abos und Rechnungen lesen (Claude-Sitzung)',
    class: 'read',
    channel: 'claude-session',
    status: 'preview',
    secret: { name: 'claude.ai Stripe-Connector', store: 'claude-connector' },
    approval: 'none',
  },
  {
    id: 'stripe.write',
    tool: 'stripe',
    label: 'Preise, Produkte, Erstattungen ändern',
    class: 'critical',
    channel: 'manual',
    status: 'live',
    approval: 'separate-release',
    note: 'Stripe-Änderungen brauchen ein separates GO (PLAN.md Leitplanken).',
  },
];

export function getToolAction(id: string): ToolAction | undefined {
  return TOOL_ACTIONS.find((a) => a.id === id);
}
