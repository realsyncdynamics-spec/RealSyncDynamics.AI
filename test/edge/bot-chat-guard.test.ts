/**
 * `bot-chat`: öffentlicher Endpoint ohne JWT — Schranken vor Kontingent und
 * Modellkosten.
 *
 * Vorher genügte das Paar (tenant_id, bot_id) aus dem Seitenquelltext. Ein
 * Skript in Schleife verbuchte je Anfrage eine Einheit
 * `limit.bot_messages_monthly` plus einen bezahlten Modellaufruf, bis das
 * Monatskontingent des Mandanten leer und sein Bot für echte Besucher aus war.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CONVERSATION_MESSAGES_PER_MINUTE,
  MAX_CONVERSATION_REF_CHARS,
  TENANT_MESSAGES_PER_MINUTE,
  decideOrigin,
  exceededScope,
  normalizeOrigin,
  parseBotChatInput,
} from '../../supabase/functions/_shared/bot-chat-guard';

const T = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('parseBotChatInput', () => {
  it('nimmt eine gültige Anfrage an', () => {
    const r = parseBotChatInput({ tenant_id: T, bot_id: B, message: 'Hallo', conversation_ref: 'web-1a2b', contact_label: ' Kim ' });
    expect(r).toEqual({ ok: true, value: { tenantId: T, botId: B, message: 'Hallo', conversationRef: 'web-1a2b', contactLabel: 'Kim' } });
  });

  it('lehnt Nicht-UUIDs ab, bevor sie in eine Abfrage gehen', () => {
    expect(parseBotChatInput({ tenant_id: 'x', bot_id: B, message: 'a' }).ok).toBe(false);
    expect(parseBotChatInput({ tenant_id: T, bot_id: `${B} or 1=1`, message: 'a' }).ok).toBe(false);
    expect(parseBotChatInput({ tenant_id: 1, bot_id: B, message: 'a' }).ok).toBe(false);
  });

  it('verlangt eine Nachricht und begrenzt ihre Länge', () => {
    expect(parseBotChatInput({ tenant_id: T, bot_id: B, message: '   ' }).ok).toBe(false);
    expect(parseBotChatInput({ tenant_id: T, bot_id: B, message: 'x'.repeat(4001) }).ok).toBe(false);
  });

  it('begrenzt conversation_ref auf Länge und Zeichenvorrat', () => {
    expect(parseBotChatInput({ tenant_id: T, bot_id: B, message: 'a', conversation_ref: 'x'.repeat(MAX_CONVERSATION_REF_CHARS + 1) }).ok).toBe(false);
    expect(parseBotChatInput({ tenant_id: T, bot_id: B, message: 'a', conversation_ref: 'a b' }).ok).toBe(false);
    expect(parseBotChatInput({ tenant_id: T, bot_id: B, message: 'a', conversation_ref: { x: 1 } }).ok).toBe(false);
  });

  it('behandelt leere optionale Felder als nicht gesetzt', () => {
    const r = parseBotChatInput({ tenant_id: T, bot_id: B, message: 'a', conversation_ref: '', contact_label: null });
    expect(r.ok && r.value.conversationRef).toBeNull();
    expect(r.ok && r.value.contactLabel).toBeNull();
  });
});

describe('normalizeOrigin', () => {
  it('vergleicht nur Schema, Host und Port', () => {
    expect(normalizeOrigin('https://Shop.Example.de:443/pfad?x=1')).toBe('https://shop.example.de');
    expect(normalizeOrigin('http://localhost:5173')).toBe('http://localhost:5173');
  });
  it('verwirft alles außer http(s)', () => {
    expect(normalizeOrigin('javascript:alert(1)')).toBeNull();
    expect(normalizeOrigin('null')).toBeNull();
    expect(normalizeOrigin('')).toBeNull();
    expect(normalizeOrigin(42)).toBeNull();
  });
});

describe('decideOrigin', () => {
  it('ohne Liste bleibt der Bot offen, aber als uneingeschränkt markiert', () => {
    expect(decideOrigin('https://irgendwo.de', {})).toEqual({ allowed: true, restricted: false });
    expect(decideOrigin(null, null)).toEqual({ allowed: true, restricted: false });
  });

  it('mit Liste nur die eingetragenen Websites', () => {
    const config = { allowed_origins: ['https://www.firma.de'] };
    expect(decideOrigin('https://www.firma.de', config)).toEqual({ allowed: true, restricted: true });
    expect(decideOrigin('https://WWW.firma.de/', config)).toEqual({ allowed: true, restricted: true });
    expect(decideOrigin('https://firma.de', config)).toEqual({ allowed: false });
    expect(decideOrigin('https://www.firma.de.evil.io', config)).toEqual({ allowed: false });
    expect(decideOrigin('http://www.firma.de', config)).toEqual({ allowed: false });
  });

  it('ohne Origin-Header (Skript, curl) ist ein eingeschränkter Bot gesperrt', () => {
    expect(decideOrigin(null, { allowed_origins: ['https://www.firma.de'] })).toEqual({ allowed: false });
  });

  it('eine leere oder unbrauchbare Liste sperrt, statt zu öffnen', () => {
    expect(decideOrigin('https://www.firma.de', { allowed_origins: [] })).toEqual({ allowed: false });
    expect(decideOrigin('https://www.firma.de', { allowed_origins: 'https://www.firma.de' })).toEqual({ allowed: false });
    expect(decideOrigin('https://www.firma.de', { allowed_origins: ['kein-origin'] })).toEqual({ allowed: false });
  });
});

describe('exceededScope', () => {
  it('lässt bis knapp unter die Grenzen durch', () => {
    expect(exceededScope({ conversation: CONVERSATION_MESSAGES_PER_MINUTE - 1, tenant: TENANT_MESSAGES_PER_MINUTE - 1 })).toBeNull();
  });
  it('meldet die engere Grenze zuerst', () => {
    expect(exceededScope({ conversation: CONVERSATION_MESSAGES_PER_MINUTE, tenant: TENANT_MESSAGES_PER_MINUTE })).toBe('conversation');
    expect(exceededScope({ conversation: 0, tenant: TENANT_MESSAGES_PER_MINUTE })).toBe('tenant');
  });
});

describe('bot-chat (Quelltext): Schranken vor Kontingent und Modell', () => {
  const s = readFileSync('supabase/functions/bot-chat/index.ts', 'utf8');
  const at = (needle: string) => {
    const i = s.indexOf(needle);
    expect(i, needle).toBeGreaterThan(-1);
    return i;
  };

  it('prüft Eingabe, Quelle, Herkunft und Takt, bevor Kontingent verbucht wird', () => {
    const quota = at('await consumeUsage(');
    for (const guard of [
      'parseBotChatInput(body)',
      'checkAnonRateLimit(',
      'decideOrigin(',
      "if (exceeded) return rateLimited(exceeded)",
    ]) {
      expect(at(guard), guard).toBeLessThan(quota);
    }
    expect(quota).toBeLessThan(at('await runAiTool('));
  });

  it('zählt den Takt aus bot_messages (über Isolate hinweg), nicht nur im Speicher', () => {
    expect(s).toMatch(/from\('bot_messages'\)[\s\S]*?\.eq\('tenant_id', tenantId\)/);
    expect(s).toMatch(/from\('bot_messages'\)[\s\S]*?\.eq\('conversation_id', conversationId\)/);
  });

  it('gibt einem anonymen Aufrufer keine internen Fehlertexte zurück', () => {
    expect(s).not.toMatch(/jsonError\(500, 'INTERNAL', \(e as Error\)\.message\)/);
  });
});
