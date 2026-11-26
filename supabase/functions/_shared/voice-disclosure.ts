// KI-Offenlegung für den Telefonpfad (bot-voice-webhook, Twilio).
//
// Pflicht (Art. 50 Abs. 1 EU AI Act, vio.md Regel 1): Der erste Satz jedes
// Gesprächs sagt, dass der Anrufer mit einer KI spricht — vor jeder
// individuellen Begrüßung, nicht abschaltbar, nie leer.
//
// Herkunft des Wortlauts ausschließlich serverseitig:
//   1. voice_bot_configs.disclosure_text des Bots (Mandant + Bot geprüft),
//   2. sonst DEFAULT_VOICE_DISCLOSURE — wortgleich mit dem Spalten-Default
//      aus Migration 20260928130000_voice_runtime_foundation.sql.
// Ein konfigurierter Text, der keinen KI-Hinweis enthält, zu lang ist oder
// fehlt, wird durch den Standardsatz ersetzt (fail-closed: lieber der
// Standardsatz als gar keine Offenlegung). Request-Daten fließen nie ein.
//
// TwiML: Die Offenlegung steht VOR <Gather>. Innerhalb von <Gather> könnte
// Spracheingabe die Ansage unterbrechen (Barge-in); davor wird sie immer
// vollständig gesprochen.
//
// Deno-frei (keine Imports), damit Vitest die Logik direkt prüfen kann.

/** Wortgleich mit dem Default von public.voice_bot_configs.disclosure_text. */
export const DEFAULT_VOICE_DISCLOSURE = 'Hinweis: Sie sprechen mit einem KI-Assistenten.';

/** Obergrenze für einen konfigurierten Offenlegungstext (Zeichen). */
export const MAX_DISCLOSURE_LENGTH = 300;

// „KI“ als eigenes Wort (auch in „KI-Assistent“) oder ausgeschrieben.
const AI_MARKER = /(^|[^\p{L}])KI([^\p{L}]|$)|künstlich\w*\s+Intelligenz/iu;

/** Enthält der Text erkennbar einen Hinweis auf KI? */
export function hasAiMarker(text: string): boolean {
  return AI_MARKER.test(text);
}

/**
 * Wortlaut der Offenlegung aus dem konfigurierten Wert. Liefert nie einen
 * leeren String und nie einen Text ohne KI-Hinweis.
 */
export function resolveVoiceDisclosure(configured: unknown): string {
  if (typeof configured !== 'string') return DEFAULT_VOICE_DISCLOSURE;
  const text = configured.replace(/\s+/g, ' ').trim();
  if (!text || text.length > MAX_DISCLOSURE_LENGTH || !hasAiMarker(text)) {
    return DEFAULT_VOICE_DISCLOSURE;
  }
  return text;
}

/** Minimaler Lesezugriff, strukturell kompatibel mit dem Supabase-Client. */
export interface DisclosureReader {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: string): {
        eq(col: string, val: string): {
          maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
        };
      };
    };
  };
}

/**
 * Lädt den Offenlegungstext des Bots. Lesefehler oder fehlende Konfiguration
 * führen zum Standardsatz, nie zu einem Gespräch ohne Offenlegung.
 */
export async function loadVoiceDisclosure(
  db: DisclosureReader,
  tenantId: string,
  botId: string,
): Promise<string> {
  try {
    const { data, error } = await db
      .from('voice_bot_configs')
      .select('disclosure_text')
      .eq('tenant_id', tenantId)
      .eq('bot_id', botId)
      .maybeSingle();
    if (error || !data) return DEFAULT_VOICE_DISCLOSURE;
    return resolveVoiceDisclosure((data as { disclosure_text?: unknown }).disclosure_text);
  } catch {
    return DEFAULT_VOICE_DISCLOSURE;
  }
}

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * TwiML-Körper eines Gesprächsschritts: optional zuerst die Offenlegung
 * (außerhalb von <Gather>, nicht unterbrechbar), dann Text + Spracheingabe.
 */
export function gatherTurnBody(actionUrl: string, text: string, disclosure?: string): string {
  const preamble = disclosure ? `<Say language="de-DE">${xmlEscape(disclosure)}</Say>` : '';
  return (
    preamble +
    `<Gather input="speech" language="de-DE" speechTimeout="auto" timeout="5" method="POST" action="${xmlEscape(actionUrl)}">` +
    `<Say language="de-DE">${xmlEscape(text)}</Say>` +
    `</Gather>` +
    `<Say language="de-DE">Ich habe nichts gehört. Auf Wiederhören.</Say>` +
    `<Hangup/>`
  );
}

/** Erster Gesprächsschritt: Offenlegung, dann Begrüßung. Offenlegung ist Pflicht. */
export function firstTurnBody(actionUrl: string, disclosure: string, greeting: string): string {
  return gatherTurnBody(actionUrl, greeting, resolveVoiceDisclosure(disclosure));
}
