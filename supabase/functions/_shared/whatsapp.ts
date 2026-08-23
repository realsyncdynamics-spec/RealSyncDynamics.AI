// Gemeinsame, reine Helfer für den WhatsApp-Business-Kanal (whatsapp-webhook).
//
// Bewusst ohne jsr-/Deno-Imports gehalten — gleiche Technik wie _shared/bots.ts:
// die Parsing-Logik bleibt in Vitest importierbar (test/bots/whatsapp-parse.test.ts),
// der Deno-spezifische Teil (Signaturprüfung, Graph-API-Aufrufe) lebt in der
// Function selbst.
//
// Meta liefert Webhook-Payloads der WhatsApp Business Cloud API in der Form
// entry[] → changes[] → value { metadata, contacts[], messages[], statuses[] }.
// Wir verarbeiten in v1 ausschließlich eingehende Textnachrichten; Status-
// Updates (sent/delivered/read) und andere Nachrichtentypen werden ignoriert,
// ohne den Webhook fehlschlagen zu lassen — Meta wiederholt sonst die Zustellung.

export interface WhatsAppInboundText {
  /** Meta-ID der Geschäftsnummer, über die die Nachricht einging. */
  phoneNumberId: string;
  /** WhatsApp-ID (Telefonnummer) des Absenders. */
  from: string;
  /** Meta-Message-ID — dient als Dedupe-Referenz. */
  waMessageId: string;
  text: string;
  /** Anzeigename aus contacts[].profile.name, falls mitgeliefert. */
  contactName: string | null;
}

interface WaMessage {
  id?: unknown;
  from?: unknown;
  type?: unknown;
  text?: { body?: unknown };
}

interface WaContact {
  wa_id?: unknown;
  profile?: { name?: unknown };
}

interface WaChangeValue {
  metadata?: { phone_number_id?: unknown };
  contacts?: unknown;
  messages?: unknown;
}

/**
 * Zieht alle eingehenden Textnachrichten aus einem Webhook-Payload.
 * Tolerant gegenüber fehlenden/fremden Feldern: alles, was nicht dem
 * erwarteten Text-Schema entspricht, wird still übersprungen.
 */
export function extractInboundTextMessages(payload: unknown): WhatsAppInboundText[] {
  const out: WhatsAppInboundText[] = [];
  const entries = (payload as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = (change as { value?: WaChangeValue })?.value;
      const phoneNumberId = String(value?.metadata?.phone_number_id ?? '');
      if (!phoneNumberId) continue;

      const contacts = Array.isArray(value?.contacts) ? (value!.contacts as WaContact[]) : [];
      const nameByWaId = new Map<string, string>();
      for (const c of contacts) {
        const waId = typeof c?.wa_id === 'string' ? c.wa_id : '';
        const name = typeof c?.profile?.name === 'string' ? c.profile.name : '';
        if (waId && name) nameByWaId.set(waId, name);
      }

      const messages = Array.isArray(value?.messages) ? (value!.messages as WaMessage[]) : [];
      for (const m of messages) {
        if (m?.type !== 'text') continue;
        const from = typeof m.from === 'string' ? m.from : '';
        const id = typeof m.id === 'string' ? m.id : '';
        const body = typeof m.text?.body === 'string' ? m.text.body.trim() : '';
        if (!from || !id || !body) continue;
        out.push({
          phoneNumberId,
          from,
          waMessageId: id,
          text: body,
          contactName: nameByWaId.get(from) ?? null,
        });
      }
    }
  }
  return out;
}

/** Request-Body für die Graph-API (POST /{phone_number_id}/messages). */
export function buildGraphTextMessage(to: string, text: string): Record<string, unknown> {
  // WhatsApp begrenzt Textnachrichten auf 4096 Zeichen.
  const safeText = text.length > 4000 ? text.slice(0, 3997) + '…' : text;
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: safeText },
  };
}
