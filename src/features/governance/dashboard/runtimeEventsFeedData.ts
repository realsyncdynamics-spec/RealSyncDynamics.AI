/**
 * Datenquelle für den Runtime-Events-Feed auf `/app/dashboard`.
 *
 * Liest die letzten Einträge aus `workspace_events` (Eingang der
 * Edge Function `workspace-events`, Agenten RSD-01 … RSD-06). Lesen nur über
 * RLS (`is_tenant_member`) mit dem Nutzer-Token — kein Service-Role-Call.
 * `tenant_id` kommt aus dem aktiven Mandanten, nie aus einer Eingabe.
 *
 * Drei Zustände bleiben getrennt:
 *   - `unavailable`: Tabelle existiert im Projekt (noch) nicht. Die Migration
 *     `20261116020000_workspace_events.sql` ist laut
 *     docs/integrations/google-workspace-events.md nicht angewendet.
 *   - `error`: Quelle existiert, ist aber nicht lesbar (RLS, Netz).
 *   - `value` mit leerer Liste: Quelle lesbar, noch keine Events.
 * Keine Beispiel- oder Demo-Events — fehlt die Quelle, steht das da.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const RUNTIME_EVENTS_LIMIT = 10;

export type RuntimeEventDecision = 'allow' | 'require_approval';

export interface RuntimeEventRow {
  id: string;
  agentId: string;
  eventType: string;
  requestedAction: string;
  resourceId: string;
  decision: RuntimeEventDecision;
  payloadHash: string;
  receivedAt: string;
}

export type RuntimeEventsState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string }
  | { kind: 'value'; events: RuntimeEventRow[] };

/** PostgREST/Postgres-Codes für „Relation fehlt“. */
const MISSING_RELATION_CODES = new Set(['PGRST205', '42P01']);

interface RawRow {
  id: string;
  agent_id: string;
  event_type: string;
  requested_action: string;
  resource_id: string;
  decision: string;
  payload_hash: string;
  received_at: string;
}

function toRow(raw: RawRow): RuntimeEventRow | null {
  if (raw.decision !== 'allow' && raw.decision !== 'require_approval') return null;
  return {
    id: raw.id,
    agentId: raw.agent_id,
    eventType: raw.event_type,
    requestedAction: raw.requested_action,
    resourceId: raw.resource_id,
    decision: raw.decision,
    payloadHash: raw.payload_hash,
    receivedAt: raw.received_at,
  };
}

export async function loadRuntimeEvents(
  supabase: SupabaseClient,
  tenantId: string,
  limit: number = RUNTIME_EVENTS_LIMIT,
): Promise<Exclude<RuntimeEventsState, { kind: 'loading' }>> {
  try {
    const { data, error } = await supabase
      .from('workspace_events')
      .select('id, agent_id, event_type, requested_action, resource_id, decision, payload_hash, received_at')
      .eq('tenant_id', tenantId)
      .order('received_at', { ascending: false })
      .limit(limit);
    if (error) {
      if (error.code && MISSING_RELATION_CODES.has(error.code)) return { kind: 'unavailable' };
      return { kind: 'error', message: error.message || 'Quelle nicht lesbar' };
    }
    const events = ((data ?? []) as RawRow[])
      .map(toRow)
      .filter((row): row is RuntimeEventRow => row !== null);
    return { kind: 'value', events };
  } catch (err) {
    return { kind: 'error', message: (err as Error)?.message ?? 'Quelle nicht lesbar' };
  }
}

export const DECISION_LABEL: Record<RuntimeEventDecision, string> = {
  allow: 'Erlaubt',
  require_approval: 'Freigabe nötig',
};

/** Kurzform des Herkunftsnachweises (SHA-256 des Payloads). */
export function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
}
