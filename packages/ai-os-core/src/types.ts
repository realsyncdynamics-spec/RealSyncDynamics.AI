// Internes AI-OS — Typen.
//
// Geltungsbereich: Betrieb von RealSyncDynamics.AI durch Plattform-Operatoren
// (`public.platform_operators`, `is_platform_operator()`, ADR 0011 D5).
// Nicht Teil der Kundenplattform: keine Mandantendaten, keine Tenant-Agenten.
//
// Nur löschbare TypeScript-Syntax (keine enums, keine Parameter-Properties),
// damit dieselben Dateien im Browser (Vite), in Edge Functions (Deno) und in
// Routine-Skripten (Node ≥ 22, Type-Stripping) laufen.

/** Dieselbe Skala wie `src/product/implementation-status.ts`. */
export type OsStatus = 'live' | 'preview' | 'coming-soon';

/**
 * Aktionsklasse im Tool-Gateway.
 * - read:     liest, verändert nichts
 * - write:    verändert etwas Umkehrbares (Branch, Draft-PR, Routine an/aus)
 * - critical: Produktion, Geld, Daten, Merge, Deploy — nie über das Gateway
 *             ausführbar, nur als dokumentierter Freigabeweg
 */
export type ActionClass = 'read' | 'write' | 'critical';

/** Wo eine Aktion technisch ausgeführt wird. */
export type ToolChannel =
  | 'edge-gateway'    // supabase/functions/ai-os-control (serverseitig, Operator-JWT)
  | 'github-actions'  // Routine-Workflow mit GITHUB_TOKEN
  | 'claude-session'  // Claude-Code-Sitzung (lokal oder Cloud) über MCP/CLI
  | 'manual';         // Mensch im jeweiligen Dashboard, kein Agentenpfad

export type ToolId =
  | 'github'
  | 'supabase'
  | 'cloudflare'
  | 'google-workspace'
  | 'stripe'
  | 'project-api';

export type AgentId =
  | 'development'
  | 'compliance'
  | 'infrastructure'
  | 'business-ops'
  | 'knowledge';

export interface ToolAction {
  /** Stabile Kennung, z. B. `github.workflow.dispatch`. */
  id: string;
  tool: ToolId;
  label: string;
  class: ActionClass;
  channel: ToolChannel;
  status: OsStatus;
  /** Name des Secrets (nie der Wert) und wo es liegt. */
  secret?: { name: string; store: 'supabase-function-secret' | 'github-actions' | 'claude-connector' };
  /** Was ein Mensch vor der Ausführung bestätigen muss. */
  approval: 'none' | 'confirm' | 'separate-release';
  note?: string;
}

export interface ToolDefinition {
  id: ToolId;
  name: string;
  /** Bevorzugter Zugang laut Eignungsprüfung. */
  access: readonly ('mcp' | 'cli' | 'api')[];
  description: string;
}

export interface SkillIO {
  name: string;
  description: string;
  required: boolean;
}

export interface SkillDefinition {
  id: string;
  name: string;
  /** `.claude/skills/<id>/SKILL.md` */
  skillFile: string;
  summary: string;
  agent: AgentId;
  inputs: readonly SkillIO[];
  outputs: readonly SkillIO[];
  quality: readonly string[];
  /** Tool-Aktionen, die der Skill höchstens braucht (geringste Rechte). */
  actions: readonly string[];
  /** Deterministische Routine, die den Skill serverseitig ausführt — falls vorhanden. */
  routineId?: string;
  status: OsStatus;
}

export interface AgentDefinition {
  id: AgentId;
  name: string;
  purpose: string;
  responsibilities: readonly string[];
  skills: readonly string[];
  /** Positivliste der Tool-Aktionen (Default-Deny). */
  allowedActions: readonly string[];
  executors: readonly ToolChannel[];
  status: OsStatus;
  /** Ehrlicher Hinweis auf offene Voraussetzungen. */
  blockers?: readonly string[];
}

export type RoutineTrigger =
  | { kind: 'schedule'; cron: string; description: string }
  | { kind: 'event'; event: string; description: string }
  | { kind: 'manual'; description: string };

export interface RoutineLimits {
  timeoutMinutes: number;
  maxApiCalls: number;
  maxAttempts: number;
  /** LLM-Token-Kosten pro Lauf; 0 = deterministisch, kein Modellaufruf. */
  maxLlmCostEur: number;
  artifactRetentionDays: number;
}

export interface RoutineDefinition {
  id: string;
  name: string;
  agent: AgentId;
  /** Workflow-Datei unter `.github/workflows/` (Ausführung serverseitig). */
  workflowFile: string;
  /** Unterbefehl von `scripts/ai-os/routine.mjs`. */
  command: string;
  triggers: readonly RoutineTrigger[];
  inputs: readonly string[];
  /** GITHUB_TOKEN-Rechte der Workflow-Datei (wird im Test gegengeprüft). */
  permissions: Readonly<Record<string, 'read' | 'write'>>;
  limits: RoutineLimits;
  outputs: readonly string[];
  status: OsStatus;
}

/** Bestehende Automationen, die das AI-OS nur registriert, nicht ersetzt. */
export interface ExistingRoutine {
  id: string;
  name: string;
  agent: AgentId;
  runtime: 'github-actions' | 'pg_cron' | 'cloudflare-cron';
  source: string;
  schedule: string;
}

/** Auftraggeber einer Gateway-Anfrage, serverseitig ermittelt. */
export interface GatewayPrincipal {
  /** Ergebnis von `is_platform_operator()` mit dem Nutzer-JWT. */
  isOperator: boolean;
  /** `aal`-Claim des JWT. */
  aal: 'aal1' | 'aal2' | null;
}

export interface GatewayRequest {
  actionId: string;
  /** Agent, in dessen Namen gehandelt wird (optional: Operator direkt). */
  agentId?: AgentId;
  /** Ausdrückliche Bestätigung im UI für Schreibaktionen. */
  confirmed: boolean;
}

export type GatewayDecision =
  | { allow: true; action: ToolAction; mustAudit: boolean }
  | { allow: false; reason: GatewayDenyReason; message: string };

export type GatewayDenyReason =
  | 'unknown_action'
  | 'not_operator'
  | 'not_executable_here'
  | 'not_live'
  | 'agent_not_allowed'
  | 'critical_requires_release'
  | 'mfa_required'
  | 'confirmation_required';
