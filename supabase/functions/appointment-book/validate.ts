// Eingabeprüfung für appointment-book. Reine Funktion ohne DB-Zugriff.

export const APPOINTMENT_LIMITS = {
  customerName: 120,
  contact: 254,
  service: 120,
  notes: 2000,
  conversationRef: 128,
  /** requested_at höchstens so weit in der Vergangenheit … */
  pastMs: 24 * 60 * 60 * 1000,
  /** … und höchstens so weit in der Zukunft. */
  futureMs: 400 * 24 * 60 * 60 * 1000,
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AppointmentInput {
  tenantId: string;
  botId: string;
  customerName: string;
  contact: string | null;
  service: string | null;
  requestedAt: string | null;
  notes: string | null;
  conversationRef: string | null;
}

export type ParseResult =
  | { ok: true; value: AppointmentInput }
  | { ok: false; message: string };

function fail(message: string): ParseResult {
  return { ok: false, message };
}

/** Optionaler Text: fehlt → null, sonst getrimmt und längenbegrenzt. */
function optionalText(
  raw: unknown,
  field: string,
  max: number,
  allowNumber = false,
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };
  let s: string;
  if (typeof raw === 'string') s = raw;
  else if (allowNumber && typeof raw === 'number' && Number.isFinite(raw)) s = String(raw);
  else return { ok: false, message: `${field} must be a string` };
  s = s.trim();
  if (!s) return { ok: true, value: null };
  if (s.length > max) return { ok: false, message: `${field} too long (max ${max})` };
  return { ok: true, value: s };
}

export function parseAppointmentInput(body: Record<string, unknown>, now: Date = new Date()): ParseResult {
  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : '';
  const botId = typeof body.bot_id === 'string' ? body.bot_id.trim() : '';
  if (!tenantId) return fail('tenant_id required');
  if (!botId) return fail('bot_id required');
  if (!UUID.test(tenantId) || !UUID.test(botId)) return fail('tenant_id and bot_id must be UUIDs');

  if (typeof body.customer_name !== 'string' || !body.customer_name.trim()) {
    return fail('customer_name required');
  }
  const customerName = body.customer_name.trim();
  if (customerName.length > APPOINTMENT_LIMITS.customerName) {
    return fail(`customer_name too long (max ${APPOINTMENT_LIMITS.customerName})`);
  }

  // Telefonnummern kommen aus Widgets teils als Zahl — weiter erlaubt.
  const contact = optionalText(body.contact, 'contact', APPOINTMENT_LIMITS.contact, true);
  if (!contact.ok) return fail(contact.message);
  const service = optionalText(body.service, 'service', APPOINTMENT_LIMITS.service);
  if (!service.ok) return fail(service.message);
  const notes = optionalText(body.notes, 'notes', APPOINTMENT_LIMITS.notes);
  if (!notes.ok) return fail(notes.message);
  const conversationRef = optionalText(body.conversation_ref, 'conversation_ref', APPOINTMENT_LIMITS.conversationRef);
  if (!conversationRef.ok) return fail(conversationRef.message);

  let requestedAt: string | null = null;
  if (body.requested_at !== undefined && body.requested_at !== null && body.requested_at !== '') {
    if (typeof body.requested_at !== 'string') return fail('requested_at must be ISO-8601');
    const d = new Date(body.requested_at);
    if (Number.isNaN(d.getTime())) return fail('requested_at must be ISO-8601');
    const t = d.getTime();
    if (t < now.getTime() - APPOINTMENT_LIMITS.pastMs || t > now.getTime() + APPOINTMENT_LIMITS.futureMs) {
      return fail('requested_at out of range');
    }
    requestedAt = d.toISOString();
  }

  return {
    ok: true,
    value: {
      tenantId,
      botId,
      customerName,
      contact: contact.value,
      service: service.value,
      requestedAt,
      notes: notes.value,
      conversationRef: conversationRef.value,
    },
  };
}
