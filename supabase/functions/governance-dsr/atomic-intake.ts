// Pure request contract for the optional, strictly disabled-by-default
// transaktionale DSR-Intake. No secrets, DB client, or environment access.
// Keep the field names aligned with public.dsr_intake in P0 #2360.
import type { CreateResult } from './logic.ts';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseAtomicOperationId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  return UUID_V4.test(candidate) ? candidate.toLowerCase() : null;
}

type ValidCreate = NonNullable<CreateResult['row']>;

export function atomicCreateParams(
  row: ValidCreate,
  actorUserId: string,
  operationId: string,
): Record<string, unknown> {
  return {
    p_tenant: row.tenant_id,
    p_actor: actorUserId, // MUST come from Supabase auth.getUser(), never the body
    p_operation: operationId,
    p_type: row.request_type,
    p_email: row.requester_email,
    p_name: row.requester_name,
    p_description: row.subject_description,
    p_assignee: row.assigned_to,
    p_assets: row.affected_assets,
  };
}
