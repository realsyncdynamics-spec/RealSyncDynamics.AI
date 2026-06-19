// Pure, side-effect-free logic for governance-vendors — vitest-importable.
// No Deno / jsr imports. The index.ts handler owns auth, DB writes,
// audit + evidence emission.

export const DPA_STATUS: readonly string[] = ['none', 'requested', 'signed', 'expired', 'not_required'];
export const TRANSFER: readonly string[] = ['adequacy', 'scc', 'bcr', 'derogation', 'none', 'unknown'];
export const RISK: readonly string[] = ['low', 'medium', 'high', 'critical'];
export const WRITER_ROLES: readonly string[] = ['owner', 'admin', 'member'];

const STRING_FIELDS = ['name', 'legal_name', 'country', 'website', 'privacy_policy_url', 'notes'];
const TS_FIELDS = ['dpa_signed_at', 'dpa_expires_at'];
const ARRAY_FIELDS = ['data_types_processed', 'processing_purposes', 'sub_processors'];
const ENUM_FIELDS = ['dpa_status', 'transfer_mechanism', 'risk_level'];

export function isWriterRole(role: string | null | undefined): boolean {
  return !!role && WRITER_ROLES.includes(role);
}

export function sanitizeStrArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((v) => typeof v === 'string').map((v) => (v as string).slice(0, 200)).slice(0, 100);
}

// Builds a whitelisted patch. `name` is handled by the caller (required on
// create, non-empty on update) so it is intentionally excluded here.
export function buildPatch(body: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const k of STRING_FIELDS) {
    if (k in body && k !== 'name') patch[k] = (body[k] as string ?? null)?.toString().slice(0, 2000) ?? null;
  }
  for (const k of TS_FIELDS) {
    if (k in body) patch[k] = body[k] ?? null;
  }
  for (const k of ARRAY_FIELDS) {
    if (k in body) patch[k] = sanitizeStrArray(body[k]);
  }
  for (const k of ENUM_FIELDS) {
    if (k in body) patch[k] = body[k];
  }
  return patch;
}

export function validateEnums(patch: Record<string, unknown>): string | null {
  if ('dpa_status' in patch && !DPA_STATUS.includes(patch.dpa_status as string)) return `dpa_status must be one of ${DPA_STATUS.join('|')}`;
  if ('transfer_mechanism' in patch && !TRANSFER.includes(patch.transfer_mechanism as string)) return `transfer_mechanism must be one of ${TRANSFER.join('|')}`;
  if ('risk_level' in patch && !RISK.includes(patch.risk_level as string)) return `risk_level must be one of ${RISK.join('|')}`;
  return null;
}
