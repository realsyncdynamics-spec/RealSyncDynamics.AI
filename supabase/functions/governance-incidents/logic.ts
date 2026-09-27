// Pure, side-effect-free logic for governance-incidents — vitest-importable.
// No Deno / jsr imports. index.ts owns auth, DB writes and the audit log.
//
// Contract with the SPA (src/features/governance/incidentsApi.ts):
//   request  { op: 'create' | 'transition', ... }
//   response { ok: true, incident } | { ok: false, error: { code, message } }

export const SEVERITIES: readonly string[] = ['low', 'medium', 'high', 'critical'];
export const STATUSES: readonly string[] = [
  'open', 'investigating', 'contained', 'resolved', 'reported_to_authority',
];
export const WRITER_ROLES: readonly string[] = ['owner', 'admin', 'member'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export function isWriterRole(role: string | null | undefined): boolean {
  return !!role && WRITER_ROLES.includes(role);
}

export function sanitizeStrArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((v) => typeof v === 'string')
    .map((v) => (v as string).slice(0, 200))
    .slice(0, 50);
}

export interface TimelineEntry {
  timestamp: string;
  actor: string;
  action: string;
  note?: string | null;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * Validates a create request and returns the insert row.
 * `tenant_id` is only syntax-checked here — membership is checked in index.ts.
 */
export function buildCreateRow(
  body: Record<string, unknown>,
  actor: string,
  now: string,
): Validation<Record<string, unknown>> {
  if (!isUuid(body.tenant_id)) return { ok: false, message: 'tenant_id must be a UUID' };
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return { ok: false, message: 'title required' };

  const severity = body.severity ?? 'high';
  if (!SEVERITIES.includes(severity as string)) {
    return { ok: false, message: `severity must be one of ${SEVERITIES.join('|')}` };
  }
  if (body.asset_id != null && !isUuid(body.asset_id)) {
    return { ok: false, message: 'asset_id must be a UUID' };
  }
  const subjects = body.estimated_affected_subjects;
  if (subjects != null && (typeof subjects !== 'number' || !Number.isInteger(subjects) || subjects < 0)) {
    return { ok: false, message: 'estimated_affected_subjects must be a non-negative integer' };
  }

  const description = typeof body.description === 'string' ? body.description.slice(0, 5000) : null;
  const assigned = typeof body.assigned_to === 'string' && body.assigned_to.trim()
    ? body.assigned_to.trim().slice(0, 254)
    : null;

  return {
    ok: true,
    value: {
      tenant_id: body.tenant_id,
      asset_id: (body.asset_id as string | undefined) ?? null,
      title: title.slice(0, 200),
      description,
      severity,
      status: 'open',
      breach_confirmed: body.breach_confirmed === true,
      personal_data_affected: body.personal_data_affected === true,
      affected_data_types: sanitizeStrArray(body.affected_data_types),
      estimated_affected_subjects: (subjects as number | undefined) ?? null,
      assigned_to: assigned,
      timeline: [{ timestamp: now, actor, action: 'created', note: null }] satisfies TimelineEntry[],
    },
  };
}

/**
 * Validates a status transition and returns the update patch.
 * Every change to a different, known status is allowed (incidents may be
 * reopened); a no-op transition is rejected so the timeline stays meaningful.
 */
export function buildTransitionPatch(
  current: { status: string; timeline: unknown },
  body: Record<string, unknown>,
  actor: string,
  now: string,
): Validation<Record<string, unknown>> {
  const next = body.status;
  if (typeof next !== 'string' || !STATUSES.includes(next)) {
    return { ok: false, message: `status must be one of ${STATUSES.join('|')}` };
  }
  if (next === current.status) return { ok: false, message: `incident is already ${next}` };

  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 2000) : null;
  const previous = Array.isArray(current.timeline) ? (current.timeline as TimelineEntry[]) : [];
  const patch: Record<string, unknown> = {
    status: next,
    timeline: [...previous, { timestamp: now, actor, action: `status:${current.status}->${next}`, note }],
  };

  if (next === 'contained') patch.contained_at = now;
  if (next === 'resolved') patch.resolved_at = now;
  if (next === 'reported_to_authority') {
    patch.reported_to_authority_at = now;
    if (typeof body.authority_reference === 'string' && body.authority_reference.trim()) {
      patch.authority_reference = body.authority_reference.trim().slice(0, 200);
    }
  }
  return { ok: true, value: patch };
}
