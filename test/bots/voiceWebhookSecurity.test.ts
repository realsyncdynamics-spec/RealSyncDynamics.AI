import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  computeTwilioSignature,
  twilioSignaturePayload,
  verifyTwilioSignature,
} from '../../supabase/functions/_shared/twilio-signature';
import { normalizeE164 } from '../../supabase/functions/_shared/voice-number-binding';

const TOKEN = 'test_auth_token';
const URL_ = 'https://example.supabase.co/functions/v1/bot-voice-webhook';
const PARAMS: Array<[string, string]> = [
  ['To', '+4930123456'],
  ['From', '+491701234567'],
  ['CallSid', 'CA123'],
  ['SpeechResult', 'Ich möchte einen Termin'],
];

/** Unabhängige Referenz über node:crypto — nicht dieselbe Implementierung. */
function reference(token: string, url: string, params: Array<[string, string]>): string {
  const payload = url + [...params].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => k + v).join('');
  return createHmac('sha1', token).update(payload, 'utf8').digest('base64');
}

describe('Twilio-Signatur', () => {
  it('sortiert Parameter nach Namen und hängt sie an die URL', () => {
    expect(twilioSignaturePayload('https://x/y?a=1', [['b', '2'], ['a', '1']])).toBe('https://x/y?a=1a1b2');
  });

  it('stimmt mit einer unabhängigen HMAC-SHA1-Referenz überein', async () => {
    expect(await computeTwilioSignature(TOKEN, URL_, PARAMS)).toBe(reference(TOKEN, URL_, PARAMS));
  });

  it('akzeptiert eine gültige Signatur', async () => {
    expect(await verifyTwilioSignature(TOKEN, URL_, PARAMS, reference(TOKEN, URL_, PARAMS))).toBe(true);
  });

  it('lehnt manipulierte Parameter ab (fremde Nummer eingesetzt)', async () => {
    const sig = reference(TOKEN, URL_, PARAMS);
    const forged = PARAMS.map(([k, v]) => [k, k === 'To' ? '+4989999999' : v] as [string, string]);
    expect(await verifyTwilioSignature(TOKEN, URL_, forged, sig)).toBe(false);
  });

  it('lehnt eine andere URL ab (tenant_id per Query untergeschoben)', async () => {
    const sig = reference(TOKEN, URL_, PARAMS);
    expect(await verifyTwilioSignature(TOKEN, `${URL_}?tenant_id=x`, PARAMS, sig)).toBe(false);
  });

  it.each([
    ['fehlender Token', undefined, URL_, 'sig'],
    ['fehlende URL', TOKEN, undefined, 'sig'],
    ['fehlender Header', TOKEN, URL_, undefined],
  ])('fail-closed bei %s', async (_label, token, url, header) => {
    expect(await verifyTwilioSignature(token, url, PARAMS, header)).toBe(false);
  });
});

describe('normalizeE164', () => {
  it.each([
    ['+49 30 123456', '+4930123456'],
    ['+49 (30) 123-456', '+4930123456'],
    ['+4930123456', '+4930123456'],
  ])('%s → %s', (raw, out) => {
    expect(normalizeE164(raw)).toBe(out);
  });

  it.each([['030123456'], ['+0123456789'], ['+49'], [''], [null], [42]])('lehnt %s ab', (raw) => {
    expect(normalizeE164(raw)).toBeNull();
  });
});

describe('bot-voice-webhook: Tenant nie aus Aufrufer-Daten', () => {
  const src = readFileSync(
    join(resolve(__dirname, '../../supabase/functions'), 'bot-voice-webhook/index.ts'),
    'utf8',
  );

  it('liest tenant_id/bot_id nicht aus Query-Parametern', () => {
    expect(src).not.toMatch(/searchParams\.get\(\s*['"](tenant_id|bot_id)['"]/);
  });

  it('prüft die Twilio-Signatur vor der Nummern-Auflösung', () => {
    const sig = src.indexOf('await verifyTwilioSignature(');
    const binding = src.indexOf('await resolveVoiceNumberBinding(');
    expect(sig).toBeGreaterThan(-1);
    expect(binding).toBeGreaterThan(sig);
  });

  it('JSON-Modus verlangt JWT + Mitgliedschaft vor resolveBot', () => {
    const json = src.slice(src.indexOf('── Modus B'));
    const auth = json.indexOf('await requireAuthAndTenant(');
    const bot = json.indexOf('await resolveBot(');
    expect(auth).toBeGreaterThan(-1);
    expect(bot).toBeGreaterThan(auth);
  });
});
