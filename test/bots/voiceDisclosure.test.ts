import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_VOICE_DISCLOSURE,
  MAX_DISCLOSURE_LENGTH,
  firstTurnBody,
  gatherTurnBody,
  hasAiMarker,
  loadVoiceDisclosure,
  resolveVoiceDisclosure,
  type DisclosureReader,
} from '../../supabase/functions/_shared/voice-disclosure';

const ACTION = 'https://example.supabase.co/functions/v1/bot-voice-webhook';

function reader(result: { data: unknown; error: unknown } | Error, seen: string[] = []): DisclosureReader {
  return {
    from(table) {
      seen.push(`from:${table}`);
      return {
        select(cols) {
          seen.push(`select:${cols}`);
          return {
            eq(c1, v1) {
              seen.push(`eq:${c1}=${v1}`);
              return {
                eq(c2, v2) {
                  seen.push(`eq:${c2}=${v2}`);
                  return {
                    maybeSingle() {
                      if (result instanceof Error) return Promise.reject(result);
                      return Promise.resolve(result);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe('KI-Offenlegung: Wortlaut', () => {
  it('Standardsatz ist wortgleich mit dem Spalten-Default der Migration', () => {
    const sql = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260928130000_voice_runtime_foundation.sql'),
      'utf8',
    );
    expect(sql).toContain(`disclosure_text TEXT NOT NULL DEFAULT '${DEFAULT_VOICE_DISCLOSURE}'`);
  });

  it('erkennt KI-Hinweise, auch zusammengesetzt und ausgeschrieben', () => {
    expect(hasAiMarker('Sie sprechen mit dem KI-Assistenten der Firma Muster.')).toBe(true);
    expect(hasAiMarker('Hier spricht eine künstliche Intelligenz.')).toBe(true);
    expect(hasAiMarker('ki-gestützte Annahme')).toBe(true);
  });

  it('wertet Wörter, die „ki“ nur enthalten, nicht als Hinweis', () => {
    expect(hasAiMarker('Willkommen bei Kiosk Kim, Ihr Skiverleih.')).toBe(false);
    expect(hasAiMarker('Hallo, hier ist Susi.')).toBe(false);
  });

  it('übernimmt einen gültigen konfigurierten Text (Leerraum normalisiert)', () => {
    expect(resolveVoiceDisclosure('  Sie sprechen mit dem\n KI-Assistenten von Muster Bau. '))
      .toBe('Sie sprechen mit dem KI-Assistenten von Muster Bau.');
  });

  it.each([
    ['fehlt', undefined],
    ['null', null],
    ['kein String', 42],
    ['leer', '   '],
    ['ohne KI-Hinweis', 'Hallo, hier ist die Firma Muster. Wie kann ich helfen?'],
    ['zu lang', `KI ${'x'.repeat(MAX_DISCLOSURE_LENGTH)}`],
  ])('ersetzt einen ungültigen Text (%s) durch den Standardsatz', (_name, value) => {
    expect(resolveVoiceDisclosure(value)).toBe(DEFAULT_VOICE_DISCLOSURE);
  });
});

describe('KI-Offenlegung: Laden (fail-closed auf Standardsatz)', () => {
  it('liest disclosure_text für genau diesen Mandanten und Bot', async () => {
    const seen: string[] = [];
    const text = await loadVoiceDisclosure(
      reader({ data: { disclosure_text: 'Sie sprechen mit einer KI von Muster Bau.' }, error: null }, seen),
      'tenant-1', 'bot-1',
    );
    expect(text).toBe('Sie sprechen mit einer KI von Muster Bau.');
    expect(seen).toEqual([
      'from:voice_bot_configs', 'select:disclosure_text', 'eq:tenant_id=tenant-1', 'eq:bot_id=bot-1',
    ]);
  });

  it('ohne Konfiguration → Standardsatz', async () => {
    expect(await loadVoiceDisclosure(reader({ data: null, error: null }), 't', 'b')).toBe(DEFAULT_VOICE_DISCLOSURE);
  });

  it('Lesefehler → Standardsatz, kein Gespräch ohne Offenlegung', async () => {
    expect(await loadVoiceDisclosure(reader({ data: null, error: { message: 'boom' } }), 't', 'b'))
      .toBe(DEFAULT_VOICE_DISCLOSURE);
    expect(await loadVoiceDisclosure(reader(new Error('network')), 't', 'b')).toBe(DEFAULT_VOICE_DISCLOSURE);
  });
});

describe('KI-Offenlegung: TwiML des ersten Schritts', () => {
  const body = firstTurnBody(ACTION, 'Sie sprechen mit einer KI.', 'Guten Tag, Muster Bau.');

  it('spricht die Offenlegung zuerst und außerhalb von <Gather> (nicht unterbrechbar)', () => {
    expect(body.startsWith('<Say language="de-DE">Sie sprechen mit einer KI.</Say><Gather')).toBe(true);
    const disclosureAt = body.indexOf('Sie sprechen mit einer KI.');
    expect(disclosureAt).toBeLessThan(body.indexOf('<Gather'));
    expect(disclosureAt).toBeLessThan(body.indexOf('Guten Tag, Muster Bau.'));
  });

  it('Begrüßung steht danach in <Gather>', () => {
    const gather = body.slice(body.indexOf('<Gather'), body.indexOf('</Gather>'));
    expect(gather).toContain('Guten Tag, Muster Bau.');
  });

  it('ersetzt eine leere Offenlegung auch hier durch den Standardsatz', () => {
    expect(firstTurnBody(ACTION, '', 'Hallo').startsWith(`<Say language="de-DE">${DEFAULT_VOICE_DISCLOSURE}</Say>`)).toBe(true);
  });

  it('escapet Text und URL', () => {
    const b = firstTurnBody(`${ACTION}?a=1&b=2`, 'KI-Hinweis <x>', 'A & B');
    expect(b).toContain('KI-Hinweis &lt;x&gt;');
    expect(b).toContain('A &amp; B');
    expect(b).toContain('action="https://example.supabase.co/functions/v1/bot-voice-webhook?a=1&amp;b=2"');
  });

  it('Folgeschritte wiederholen die Offenlegung nicht', () => {
    expect(gatherTurnBody(ACTION, 'Antwort').startsWith('<Gather')).toBe(true);
  });
});

describe('bot-voice-webhook verdrahtet die Offenlegung', () => {
  const src = readFileSync(resolve(__dirname, '../../supabase/functions/bot-voice-webhook/index.ts'), 'utf8');

  it('erster Schritt im Telefonpfad nutzt firstTurnBody mit geladener Offenlegung', () => {
    const block = src.slice(src.indexOf('if (!speech) {'), src.indexOf('// SpeechResult vorhanden'));
    expect(block).toContain('loadVoiceDisclosure(');
    expect(block).toContain('firstTurnBody(actionUrl, disclosure, greeting)');
    expect(block).not.toContain('speakAndGather(');
  });

  it('JSON-Testkanal liefert die Offenlegung vor der Begrüßung', () => {
    const block = src.slice(src.indexOf('if (!message) {'), src.indexOf('const reply = await replyForVoice('));
    expect(block).toContain('loadVoiceDisclosure(');
    expect(block).toContain('reply: `${disclosure} ${greeting}`');
  });

  it('Offenlegung kommt nie aus Request-Daten', () => {
    expect(src).not.toMatch(/params\.get\(['"]disclosure/);
    expect(src).not.toMatch(/body\.disclosure/);
  });
});
