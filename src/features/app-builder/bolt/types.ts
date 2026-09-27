/**
 * bolt.diy artifact protocol types, adapted for RealSyncDynamics.
 *
 * Protocol origin: stackblitz-labs/bolt.diy (MIT, © 2024 StackBlitz, Inc.
 * and bolt.diy contributors). See ./VENDOR.md.
 *
 * RealSync additions: tenant/session identity, governance decision,
 * Prüfpfad records, evidence hashes. No WebContainer dependency here —
 * that backend stays behind an explicit flag (needs COOP/COEP headers,
 * which are production infrastructure and therefore out of scope).
 */

export type ActionType = 'file' | 'shell' | 'start' | 'build' | 'supabase';

export type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed' | 'blocked';

export interface FileAction {
  type: 'file';
  filePath: string;
  content: string;
}

export interface ShellAction {
  type: 'shell' | 'start' | 'build';
  content: string;
}

export interface SupabaseAction {
  type: 'supabase';
  operation: 'migration' | 'query';
  filePath?: string;
  content: string;
}

export type BoltAction = FileAction | ShellAction | SupabaseAction;

export interface BoltArtifact {
  id: string;
  title: string;
  type?: string;
}

export interface ParsedAction {
  artifactId: string;
  actionId: string;
  action: BoltAction;
}

export type ParseEvent =
  | { kind: 'artifact-open'; artifact: BoltArtifact }
  | { kind: 'artifact-close'; artifactId: string }
  | { kind: 'action-open'; parsed: ParsedAction }
  | { kind: 'action-stream'; parsed: ParsedAction }
  | { kind: 'action-close'; parsed: ParsedAction }
  | { kind: 'text'; text: string };

export interface FileRecord {
  path: string;
  content: string;
  sha256: string;
  updatedAt: string;
  revision: number;
}

export interface FileSnapshot {
  files: Record<string, FileRecord>;
  merkle: string;
  capturedAt: string;
}

export type RiskClass = 'minimal' | 'limited' | 'high' | 'unacceptable';

export type GateDecision = 'allow' | 'block' | 'require_approval';

export interface GovernanceContext {
  tenantId: string;
  sessionId: string;
  actorId: string;
  /** True only when TenantProvider resolved a real workspace — never from a URL. */
  tenantVerified: boolean;
  /** True only when Supabase auth (or equivalent) has a session. */
  authenticated: boolean;
  entitlementBuilder: boolean;
}

export interface GateResult {
  decision: GateDecision;
  reason: string;
  riskClass: RiskClass;
  control: string;
  actionId: string;
}

export interface AuditRecord {
  id: string;
  at: string;
  tenantId: string;
  sessionId: string;
  actorId: string;
  event: string;
  decision: GateDecision | 'recorded';
  riskClass: RiskClass;
  control: string;
  detail: string;
  evidenceSha256?: string;
}

export interface ActionRunResult {
  actionId: string;
  status: ActionStatus;
  gate: GateResult;
  output: string;
  filePath?: string;
}

export interface EngineRunResult {
  messageId: string;
  events: ParseEvent[];
  runs: ActionRunResult[];
  audit: AuditRecord[];
  snapshot: FileSnapshot;
  blocked: boolean;
}

export const WEBCONTAINER_BACKEND = 'disabled' as const;
