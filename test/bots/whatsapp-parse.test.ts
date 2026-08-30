import { describe, expect, it } from 'vitest';
import {
  buildGraphTextMessage,
  extractInboundTextMessages,
} from '../../supabase/functions/_shared/whatsapp';

// Realistische Payload-Form der WhatsApp Business Cloud API (v20).
function cloudApiPayload(overrides: Record<string, unknown> = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '4930123456', phone_number_id: 'PNID-1' },
              contacts: [{ profile: { name: 'Erika Beispiel' }, wa_id: '4915799999999' }],
              messages: [
                {
                  from: '4915799999999',
                  id: 'wamid.abc',
                  timestamp: '1787500000',
                  type: 'text',
                  text: { body: '  Habt ihr morgen offen?  ' },
                },
              ],
              ...overrides,
            },
          },
        ],
      },
    ],
  };
}

describe('extractInboundTextMessages', () => {
  it('extrahiert Textnachricht mit phone_number_id, Absender und Kontaktname', () => {
    const msgs = extractInboundTextMessages(cloudApiPayload());
    expect(msgs).toEqual([
      {
        phoneNumberId: 'PNID-1',
        from: '4915799999999',
        waMessageId: 'wamid.abc',
        text: 'Habt ihr morgen offen?',
        contactName: 'Erika Beispiel',
      },
    ]);
  });

  it('ignoriert Status-Updates (keine messages) statt zu werfen', () => {
    const payload = cloudApiPayload({
      messages: undefined,
      statuses: [{ id: 'wamid.abc', status: 'delivered' }],
    });
    expect(extractInboundTextMessages(payload)).toEqual([]);
  });

  it('überspringt Nicht-Text-Nachrichten, behält Textnachrichten daneben', () => {
    const payload = cloudApiPayload({
      messages: [
        { from: '4915799999999', id: 'wamid.img', type: 'image', image: { id: 'media-1' } },
        { from: '4915799999999', id: 'wamid.txt', type: 'text', text: { body: 'Hallo' } },
      ],
    });
    const msgs = extractInboundTextMessages(payload);
    expect(msgs.map((m) => m.waMessageId)).toEqual(['wamid.txt']);
  });

  it('liefert leer für kaputte oder fremde Payloads', () => {
    expect(extractInboundTextMessages(null)).toEqual([]);
    expect(extractInboundTextMessages({})).toEqual([]);
    expect(extractInboundTextMessages({ entry: 'nope' })).toEqual([]);
    expect(extractInboundTextMessages({ entry: [{ changes: [{ value: {} }] }] })).toEqual([]);
  });

  it('ohne Kontaktprofil bleibt contactName null', () => {
    const payload = cloudApiPayload({ contacts: [] });
    expect(extractInboundTextMessages(payload)[0].contactName).toBeNull();
  });
});

describe('buildGraphTextMessage', () => {
  it('baut den Cloud-API-Body für eine Textantwort', () => {
    expect(buildGraphTextMessage('4915799999999', 'Ja, 9–18 Uhr.')).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '4915799999999',
      type: 'text',
      text: { preview_url: false, body: 'Ja, 9–18 Uhr.' },
    });
  });

  it('kürzt Antworten über 4000 Zeichen — WhatsApp-Limit ist 4096', () => {
    const body = buildGraphTextMessage('4915799999999', 'x'.repeat(5000));
    const text = (body.text as { body: string }).body;
    expect(text.length).toBeLessThanOrEqual(4000);
    expect(text.endsWith('…')).toBe(true);
  });
});
