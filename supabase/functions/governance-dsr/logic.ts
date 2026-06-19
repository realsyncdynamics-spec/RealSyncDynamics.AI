// Pure, side-effect-free logic for governance-dsr — vitest-importable.
// No Deno / jsr imports so it can be unit-tested under the SPA toolchain.
// The index.ts handler owns auth, DB writes, audit + evidence emission.

export const REQUEST_TYPES = ['access', 'erasure', 'portability', 'rectification', 'restriction', 'objection'] as const;
export const STATUSES = ['received', 'in_progress', 'pending_verification', 'completed', 'rejected', 'overdue'] as const;
export const TERMINAL: readonly string[] = ['completed', 'rejected'];
// Roles allowed to write. 'viewer' keeps read-only access via RLS.
export const WRITER_ROLES: readonly string[] = ['owner', 'admin', 'member'];

export function isWriterRole(role: string | null | undefined): boolean {
  return !!role && WRITER_ROLES.includes(role);
}

export function sanitizeAssets(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((v) => typeof v === 'string').map((v) => (v as string).slice(0, 200)).slice(0, 100);
}

function clampStr(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  return v.toString().slice(0, max);
}

export interface CreateResult {
  error?: string;
  row?: {
    tenant_id: string;
    request_type: string;
    status: 'received';
    requester_email: string;
    requester_name: string | null;
    subject_description: string | null;
    affected_assets: string[];
    assigned_to: string | null;
  };
}

// Validates + normalizes a create payload. subject_ref is merged into
// metadata by the handler (it depends on an async DB call).
export function buildCreate(body: Record<string, unknown>): CreateResult {
  const tenant_id = body.tenant_id as string;
  const request_type = ((body.request_type as string) ?? '').trim();
  const requester_email = ((body.requester_email as string) ?? '').trim();
  if (!tenant_id) return { error: 'tenant_id required' };
  if (!REQUEST_TYPES.includes(request_type as typeof REQUEST_TYPES[number])) {
    return { error: `request_type must be one of ${REQUEST_TYPES.join('|')}` };
  }
  if (!requester_email) return { error: 'requester_email required' };
  return {
    row: {
      tenant_id,
      request_type,
      status: 'received',
      requester_email: requester_email.slice(0, 254),
      requester_name: clampStr(body.requester_name, 200),
      subject_description: clampStr(body.subject_description, 5000),
      affected_assets: sanitizeAssets(body.affected_assets),
      assigned_to: clampStr(body.assigned_to, 254),
    },
  };
}

export interface PatchResult {
  error?: string;
  patch?: Record<string, unknown>;
}

// Builds a whitelisted update patch and applies completed_at transition
// rules. `currentCompletedAt` is the existing row's completed_at.
export function buildUpdatePatch(body: Record<string, unknown>, currentCompletedAt: string | null, nowIso: string): PatchResult {
  const patch: Record<string, unknown> = {};
  if ('status' in body) {
    const status = body.status as string;
    if (!STATUSES.includes(status as typeof STATUSES[number])) {
      return { error: `status must be one of ${STATUSES.join('|')}` };
    }
    patch.status = status;
    if (TERMINAL.includes(status) && !currentCompletedAt) patch.completed_at = nowIso;
    if (!TERMINAL.includes(status) && currentCompletedAt) patch.completed_at = null;
  }
  if ('response_notes' in body) patch.response_notes = clampStr(body.response_notes, 5000);
  if ('assigned_to' in body) patch.assigned_to = clampStr(body.assigned_to, 254);
  if ('subject_description' in body) patch.subject_description = clampStr(body.subject_description, 5000);
  if ('requester_name' in body) patch.requester_name = clampStr(body.requester_name, 200);
  if ('affected_assets' in body) patch.affected_assets = sanitizeAssets(body.affected_assets);
  if (Object.keys(patch).length === 0) return { error: 'no updatable fields supplied' };
  return { patch };
}

export interface CloseResult {
  error?: string;
  patch?: Record<string, unknown>;
}

export function buildClosePatch(body: Record<string, unknown>, currentCompletedAt: string | null, nowIso: string): CloseResult {
  const status = (body.status as string) ?? 'completed';
  if (!TERMINAL.includes(status)) return { error: `close status must be one of ${TERMINAL.join('|')}` };
  const patch: Record<string, unknown> = { status, completed_at: currentCompletedAt ?? nowIso };
  if ('response_notes' in body) patch.response_notes = clampStr(body.response_notes, 5000);
  return { patch };
}
