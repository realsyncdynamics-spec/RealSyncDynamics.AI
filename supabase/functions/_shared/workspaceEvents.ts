// Google-Workspace-Ereignisse (RSD-01 … RSD-06) — Validierung und
// Aktionsentscheidung, rein (ohne Deno-/jsr-Importe, aus Vitest testbar).
//
// Drei Klassen von Aktionen:
//   allow             — intern: analysieren, Entwurf, Bericht, Register.
//   require_approval  — wirkt nach außen: erzeugt nur eine Freigabeanfrage.
//   forbidden         — löschen, bezahlen, veröffentlichen, mergen, deployen …
//                       nie autonom, wird mit 403 abgewiesen.
// Unbekannte Aktionen gelten als forbidden (fail closed).

import { sha256Hex } from './hash.ts';

export const WORKSPACE_SOURCE = 'google_workspace';
export const WORKSPACE_MAX_BODY_BYTES = 32_768;
export const WORKSPACE_SCHEMA_VERSION = '1.0';

export const WORKSPACE_AGENTS = ['RSD-01', 'RSD-02', 'RSD-03', 'RSD-04', 'RSD-05', 'RSD-06'] as const;
export type WorkspaceAgentId = (typeof WORKSPACE_AGENTS)[number];

/** Interne Aktionen je Agent — ohne Außenwirkung. */
const INTERNAL_ACTIONS: Record<WorkspaceAgentId, readonly string[]> = {
  'RSD-01': ['classify', 'draft_reply', 'notify_internal', 'log'],
  'RSD-02': ['create_review', 'propose_status', 'notify_internal', 'log'],
  'RSD-03': ['create_report', 'notify_internal', 'log'],
  'RSD-04': ['register_lead', 'draft_offer', 'notify_internal', 'log'],
  'RSD-05': ['create_review', 'propose_filename', 'create_task', 'notify_internal', 'log'],
  'RSD-06': ['draft_content', 'set_review_status', 'notify_internal', 'log'],
};

/** Aktionen mit Außenwirkung — nur über eine gebundene Freigabe. */
const APPROVAL_ACTIONS: Record<WorkspaceAgentId, readonly string[]> = {
  'RSD-01': ['send_email'],
  'RSD-02': [],
  'RSD-03': [],
  'RSD-04': ['send_offer'],
  'RSD-05': ['create_calendar_event'],
  'RSD-06': [],
};

/** Nie autonom, unabhängig vom Agenten (Masterplan, Sicherheitsgrundsatz 5). */
export const FORBIDDEN_ACTIONS = new Set([
  'delete', 'delete_message', 'delete_file', 'pay', 'refund', 'charge',
  'publish', 'publish_kdp', 'upload_kdp', 'change_price', 'post_social',
  'merge', 'deploy', 'migrate', 'change_secret', 'sign_contract', 'send_invoice',
]);

/** Nur Schlüssel, die `google_workspace` ausdrücklich erlauben (leere Liste genügt nicht). */
export function keySourceAllowsWorkspace(allowedSources: readonly string[] | null | undefined): boolean {
  return Array.isArray(allowedSources) && allowedSources.includes(WORKSPACE_SOURCE);
}

export type WorkspaceDecision = 'allow' | 'require_approval' | 'forbidden';

export function decideWorkspaceAction(agent: WorkspaceAgentId, action: string): WorkspaceDecision {
  if (FORBIDDEN_ACTIONS.has(action)) return 'forbidden';
  if (INTERNAL_ACTIONS[agent].includes(action)) return 'allow';
  if (APPROVAL_ACTIONS[agent].includes(action)) return 'require_approval';
  return 'forbidden';
}

export interface WorkspaceEvent {
  schema_version: string;
  event_id: string;
  agent_id: WorkspaceAgentId;
  event_type: string;
  resource_id: string;
  requested_action: string;
  metadata: Record<string, unknown>;
}

export type WorkspaceValidation =
  | { ok: true; event: WorkspaceEvent }
  | { ok: false; status: 400 | 403; code: string; errors: string[] };

const EVENT_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const EVENT_TYPE = /^[a-z][a-z0-9_.]{2,63}$/;
const ACTION = /^[a-z][a-z0-9_]{2,47}$/;
const ALLOWED_KEYS = new Set([
  'schema_version', 'event_id', 'agent_id', 'event_type', 'resource_id',
  'requested_action', 'requires_approval', 'metadata',
]);
/** Nutzdaten bleiben klein; Inhalte (Mails, Dokumente) gehören nicht ins Protokoll. */
const MAX_METADATA_BYTES = 4_096;

export function validateWorkspaceEvent(payload: unknown): WorkspaceValidation {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, status: 400, code: 'VALIDATION', errors: ['payload must be an object'] };
  }
  const p = payload as Record<string, unknown>;
  // Mandant, Rechte, Einwilligung nie aus dem Body (AGENTS.md).
  if ('tenant_id' in p) {
    return {
      ok: false, status: 403, code: 'TENANT_FROM_BODY',
      errors: ['tenant_id is derived from the ingest key and must not be sent'],
    };
  }
  const errors: string[] = [];
  for (const k of Object.keys(p)) if (!ALLOWED_KEYS.has(k)) errors.push(`unknown field ${k}`);
  if (p.schema_version !== WORKSPACE_SCHEMA_VERSION) errors.push(`schema_version must be ${WORKSPACE_SCHEMA_VERSION}`);
  if (typeof p.event_id !== 'string' || !EVENT_ID.test(p.event_id)) errors.push('event_id invalid');
  if (typeof p.agent_id !== 'string' || !(WORKSPACE_AGENTS as readonly string[]).includes(p.agent_id)) {
    errors.push(`agent_id must be one of ${WORKSPACE_AGENTS.join(', ')}`);
  }
  if (typeof p.event_type !== 'string' || !EVENT_TYPE.test(p.event_type)) errors.push('event_type invalid');
  if (typeof p.resource_id !== 'string' || p.resource_id.length < 1 || p.resource_id.length > 256) {
    errors.push('resource_id must be 1-256 chars');
  }
  if (typeof p.requested_action !== 'string' || !ACTION.test(p.requested_action)) errors.push('requested_action invalid');
  if (p.requires_approval !== undefined && typeof p.requires_approval !== 'boolean') {
    errors.push('requires_approval must be boolean');
  }
  const metadata = p.metadata ?? {};
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    errors.push('metadata must be a plain object');
  } else if (new TextEncoder().encode(JSON.stringify(metadata)).byteLength > MAX_METADATA_BYTES) {
    errors.push(`metadata exceeds ${MAX_METADATA_BYTES} bytes`);
  }
  if (errors.length) return { ok: false, status: 400, code: 'VALIDATION', errors };
  return {
    ok: true,
    event: {
      schema_version: p.schema_version as string,
      event_id: p.event_id as string,
      agent_id: p.agent_id as WorkspaceAgentId,
      event_type: p.event_type as string,
      resource_id: p.resource_id as string,
      requested_action: p.requested_action as string,
      metadata: metadata as Record<string, unknown>,
    },
  };
}

/** JSON mit sortierten Schlüsseln — gleiche Nutzdaten ergeben denselben Hash. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

/**
 * Hash der freizugebenden Änderung: Agent, Aktion, Ressource, Metadaten.
 * Der Mandant ist Teil des Hashes, damit eine Freigabe nie mandantenübergreifend passt.
 */
export function workspacePayloadHash(tenantId: string, e: WorkspaceEvent): Promise<string> {
  return sha256Hex(canonicalJson({
    tenant_id: tenantId,
    agent_id: e.agent_id,
    requested_action: e.requested_action,
    resource_id: e.resource_id,
    metadata: e.metadata,
  }));
}

/** Fehlercodes der Datenbankfunktion auf HTTP abbilden (fail closed). */
export function mapIngestRpcError(message: string | undefined): { status: 401 | 429 | 503; code: string } {
  if (message?.includes('workspace_key_invalid')) return { status: 401, code: 'UNAUTHORIZED' };
  if (message?.includes('workspace_rate_limited')) return { status: 429, code: 'RATE_LIMITED' };
  return { status: 503, code: 'INGEST_FAILED' };
}
