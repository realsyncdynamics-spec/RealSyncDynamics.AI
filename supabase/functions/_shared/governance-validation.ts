// Reine Validierungs-/Mapping-Logik fuer governance-dsr und governance-vendors.
//
// Bewusst frei von Deno-/Supabase-Globals, damit dieselbe Logik sowohl von den
// Edge Functions (Deno) als auch von vitest (Node) importiert und getestet
// werden kann — analog zu _shared/audit-mapping.ts.

export const DSR_REQUEST_TYPES = ['access', 'erasure', 'portability', 'rectification', 'restriction', 'objection'] as const;
export const DSR_STATUS = ['received', 'in_progress', 'pending_verification', 'completed', 'rejected', 'overdue'] as const;
export const VENDOR_DPA_STATUS = ['none', 'requested', 'signed', 'expired', 'not_required'] as const;
export const VENDOR_TRANSFER = ['adequacy', 'scc', 'bcr', 'derogation', 'none', 'unknown'] as const;
export const VENDOR_RISK = ['low', 'medium', 'high', 'critical'] as const;

export type Built = { error: string } | { value: Record<string, unknown> };

export function str(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

function strArray(v: unknown, max = 200): string[] {
  return (v as unknown[]).map(String).slice(0, max);
}

// --- DSR --------------------------------------------------------------------

/** Baut das Insert-Objekt fuer einen neuen DSR (ohne tenant_id — setzt der Handler). */
export function buildDsrInsert(body: Record<string, unknown>): Built {
  const request_type = String(body.request_type ?? '').trim();
  const requester_email = String(body.requester_email ?? '').trim();
  if (!(DSR_REQUEST_TYPES as readonly string[]).includes(request_type)) {
    return { error: `request_type must be one of ${DSR_REQUEST_TYPES.join('|')}` };
  }
  if (!requester_email) return { error: 'requester_email required' };

  const value: Record<string, unknown> = {
    request_type,
    requester_email: requester_email.slice(0, 254),
    status: 'received',
    requester_name: str(body.requester_name, 200),
    subject_description: str(body.subject_description, 5000),
    assigned_to: str(body.assigned_to, 200),
  };
  if (Array.isArray(body.affected_assets)) value.affected_assets = strArray(body.affected_assets, 100);
  if (body.deadline_at) value.deadline_at = body.deadline_at;
  return { value };
}

/** Baut das Patch-Objekt fuer ein DSR-Update. */
export function buildDsrPatch(body: Record<string, unknown>): Built {
  const patch: Record<string, unknown> = {};
  if ('status' in body) {
    if (!(DSR_STATUS as readonly string[]).includes(body.status as string)) {
      return { error: `status must be one of ${DSR_STATUS.join('|')}` };
    }
    patch.status = body.status;
    // Beim Abschluss completed_at setzen, sofern nicht explizit uebergeben.
    if (body.status === 'completed' && !('completed_at' in body)) patch.completed_at = new Date().toISOString();
  }
  for (const k of ['requester_name', 'subject_description', 'response_notes', 'assigned_to']) {
    if (k in body) patch[k] = str(body[k], 5000);
  }
  if ('completed_at' in body) patch.completed_at = body.completed_at || null;
  if (Array.isArray(body.affected_assets)) patch.affected_assets = strArray(body.affected_assets, 100);
  if (Object.keys(patch).length === 0) return { error: 'no updatable fields' };
  return { value: patch };
}

// --- Vendors ----------------------------------------------------------------

/** Baut das Insert-Objekt fuer einen neuen Vendor (ohne tenant_id). */
export function buildVendorInsert(body: Record<string, unknown>): Built {
  const name = String(body.name ?? '').trim();
  if (!name) return { error: 'name required' };
  const fields = vendorFields(body);
  if ('error' in fields) return fields;
  return { value: { name: name.slice(0, 200), ...(fields as { value: Record<string, unknown> }).value } };
}

/** Baut das Patch-Objekt fuer ein Vendor-Update. */
export function buildVendorPatch(body: Record<string, unknown>): Built {
  const fields = vendorFields(body);
  if ('error' in fields) return fields;
  const patch = (fields as { value: Record<string, unknown> }).value;
  if ('name' in body) {
    const name = String(body.name ?? '').trim();
    if (!name) return { error: 'name cannot be empty' };
    patch.name = name.slice(0, 200);
  }
  if (Object.keys(patch).length === 0) return { error: 'no updatable fields' };
  return { value: patch };
}

/** Mappt erlaubte Vendor-Felder mit Enum-Validierung (ohne name). */
function vendorFields(body: Record<string, unknown>): Built {
  const patch: Record<string, unknown> = {};
  for (const k of ['legal_name', 'country', 'website', 'privacy_policy_url', 'notes']) {
    if (k in body) patch[k] = str(body[k], 2000);
  }
  if ('dpa_signed_at' in body) patch.dpa_signed_at = body.dpa_signed_at || null;
  if ('dpa_expires_at' in body) patch.dpa_expires_at = body.dpa_expires_at || null;
  for (const k of ['data_types_processed', 'processing_purposes', 'sub_processors']) {
    if (k in body) {
      if (!Array.isArray(body[k])) return { error: `${k} must be an array` };
      patch[k] = strArray(body[k]);
    }
  }
  if ('dpa_status' in body) {
    if (!(VENDOR_DPA_STATUS as readonly string[]).includes(body.dpa_status as string)) return { error: `dpa_status must be one of ${VENDOR_DPA_STATUS.join('|')}` };
    patch.dpa_status = body.dpa_status;
  }
  if ('transfer_mechanism' in body) {
    if (!(VENDOR_TRANSFER as readonly string[]).includes(body.transfer_mechanism as string)) return { error: `transfer_mechanism must be one of ${VENDOR_TRANSFER.join('|')}` };
    patch.transfer_mechanism = body.transfer_mechanism;
  }
  if ('risk_level' in body) {
    if (!(VENDOR_RISK as readonly string[]).includes(body.risk_level as string)) return { error: `risk_level must be one of ${VENDOR_RISK.join('|')}` };
    patch.risk_level = body.risk_level;
  }
  return { value: patch };
}
