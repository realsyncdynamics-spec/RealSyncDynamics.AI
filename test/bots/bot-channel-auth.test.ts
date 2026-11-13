import { describe, expect, it } from 'vitest';
import { originAllowed } from '../../supabase/functions/_shared/bot-budget.ts';
import {
  assertBotBrowserAccess,
  mintWidgetToken,
  readWidgetToken,
  verifyWidgetToken,
  WIDGET_TOKEN_HEADER,
} from '../../supabase/functions/_shared/bot-channel-auth.ts';

const secret = 'test-widget-signing-key';
const tenantId = '11111111-1111-1111-1111-111111111111';
const botId = '22222222-2222-2222-2222-222222222222';
const origin = 'https://kunde.de';
const now = new Date('2026-11-13T11:00:00Z');
const cfg = { allowed_origins: ['https://kunde.de/'] };

describe('originAllowed fail-closed', () => {
  it('lehnt fehlende oder leere Listen ab', () => {
    expect(originAllowed(null, {})).toBe(false);
    expect(originAllowed('https://x.de', { allowed_origins: [] })).toBe(false);
    expect(originAllowed('https://kunde.de', undefined)).toBe(false);
  });

  it('erlaubt nur exakte, normalisierte Origins aus der Liste', () => {
    expect(originAllowed('https://kunde.de', cfg)).toBe(true);
    expect(originAllowed('https://kunde.de/', cfg)).toBe(true);
    expect(originAllowed('https://evil.de', cfg)).toBe(false);
    expect(originAllowed(null, cfg)).toBe(false);
  });
});

describe('widget token HMAC (bestehende computeMetaSignatureHex + timingSafeEqual)', () => {
  it('stellt ein Token aus und prüft es gegen dieselben Claims', async () => {
    const token = await mintWidgetToken({ secret, tenantId, botId, origin, now, ttlSec: 3600 });
    const ok = await verifyWidgetToken({ secret, token, tenantId, botId, origin, now });
    expect(ok).toEqual({ ok: true, exp: Math.floor(now.getTime() / 1000) + 3600 });
  });

  it('lehnt abgelaufene, falsch gebundene oder falsch signierte Tokens ab', async () => {
    const token = await mintWidgetToken({ secret, tenantId, botId, origin, now, ttlSec: 60 });
    const later = new Date(now.getTime() + 61_000);
    expect((await verifyWidgetToken({ secret, token, tenantId, botId, origin, now: later })).ok).toBe(false);
    expect((await verifyWidgetToken({ secret, token, tenantId: 'other', botId, origin, now })).ok).toBe(false);
    expect((await verifyWidgetToken({ secret, token, tenantId, botId, origin: 'https://evil.de', now })).ok).toBe(false);
    expect((await verifyWidgetToken({ secret: 'other-secret', token, tenantId, botId, origin, now })).ok).toBe(false);
    expect((await verifyWidgetToken({ secret, token: token.slice(0, -2) + 'ab', tenantId, botId, origin, now })).ok).toBe(false);
    expect((await verifyWidgetToken({ secret, token: 'v1.deadbeef.00', tenantId, botId, origin, now })).ok).toBe(false);
    expect((await verifyWidgetToken({ secret: '', token, tenantId, botId, origin, now })).ok).toBe(false);
  });
});

describe('assertBotBrowserAccess', () => {
  it('liest den Token aus Header oder Body und fordert Origin plus Secret', async () => {
    const token = await mintWidgetToken({ secret, tenantId, botId, origin, now, ttlSec: 3600 });
    const reqHeader = new Request('https://fn.example/bot-chat', {
      method: 'POST',
      headers: { origin, [WIDGET_TOKEN_HEADER]: token },
    });
    const ok = await assertBotBrowserAccess({
      secret, req: reqHeader, body: {}, tenantId, botId, botConfig: cfg, now,
    });
    expect(ok).toEqual({ ok: true });

    const reqBody = new Request('https://fn.example/bot-chat', {
      method: 'POST',
      headers: { origin },
    });
    expect(readWidgetToken(reqBody, { widget_token: token })).toBe(token);
    const fromBody = await assertBotBrowserAccess({
      secret, req: reqBody, body: { widget_token: token }, tenantId, botId, botConfig: cfg, now,
    });
    expect(fromBody).toEqual({ ok: true });
  });

  it('ist fail-closed ohne Secret, Token, Origin-Liste oder passende Origin', async () => {
    const token = await mintWidgetToken({ secret, tenantId, botId, origin, now, ttlSec: 3600 });
    const req = new Request('https://fn.example/bot-chat', {
      method: 'POST',
      headers: { origin, [WIDGET_TOKEN_HEADER]: token },
    });
    expect((await assertBotBrowserAccess({
      secret: '', req, body: {}, tenantId, botId, botConfig: cfg, now,
    })).status).toBe(500);
    expect((await assertBotBrowserAccess({
      secret, req: new Request('https://fn.example/bot-chat', { headers: { origin } }),
      body: {}, tenantId, botId, botConfig: cfg, now,
    })).status).toBe(401);
    expect((await assertBotBrowserAccess({
      secret, req, body: {}, tenantId, botId, botConfig: { allowed_origins: [] }, now,
    })).status).toBe(403);
    expect((await assertBotBrowserAccess({
      secret,
      req: new Request('https://fn.example/bot-chat', {
        headers: { origin: 'https://evil.de', [WIDGET_TOKEN_HEADER]: token },
      }),
      body: {}, tenantId, botId, botConfig: cfg, now,
    })).status).toBe(403);
  });
});
