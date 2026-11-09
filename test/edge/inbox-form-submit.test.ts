// @vitest-environment node
/**
 * PR C, Schritt 3: inbox-form-submit.
 *
 * handler.ts läuft gegen ein In-Memory-Repo; kein Deno, kein Netz, keine DB.
 *
 * Geprüft
 *   F1  Gültige Anfrage → 201, Konversation (channel form, open), Intake,
 *       Nachricht; Antwort ohne tenant_id/bot_id
 *   F2  Doppel-Submit (gleiche site_ref + nonce) → 200 duplicate, eine Zeile
 *   F3  Unbekannte / deaktivierte site_ref → 404, nichts geschrieben
 *   F4  Honeypot → 400, nichts geschrieben; nicht einmal resolve
 *   F5  Gefälschte tenant_id / bot_id im Body werden ignoriert
 *   F6  Validierung: site_ref-Format, nonce, Anliegen, Kontakt, Einwilligung
 *   F7  Body > 16 KB → 413; ungültiges JSON → 400; GET → 405; OPTIONS → CORS
 *   F8  Rate-Limit: Isolate-Zähler → 429 vor resolve; DB-Zähler je ip_hash → 429 nach resolve;
 *       Kontingent je Seite IP-unabhängig; clientIp nimmt den letzten XFF-Eintrag
 *   F9  Fehlendes Salt → 503, nichts geschrieben; IP nie im Klartext
 *   F10 Scheitert Intake nach dem Anlegen → Konversation entfernt, 500
 *   F11 Längenkappung auf die Intake-CHECKs
 *   F12 handler/logic/repo bleiben vitest-importierbar (kein Deno/jsr)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { handleInboxFormSubmit, RATE_LIMIT_PER_HOUR, RATE_LIMIT_PER_SITE_PER_HOUR, type HandlerDeps } from '../../supabase/functions/inbox-form-submit/handler';
import type { InboxRepo, NewConversation, NewIntake, ResolvedInbox } from '../../supabase/functions/inbox-form-submit/repo';
import { LIMITS, clientIp, hashIp } from '../../supabase/functions/inbox-form-submit/logic';

const SITE_REF = 'AbCdEfGhIjKlMnOpQrStUvWx'; // 24 Zeichen base64url
const OTHER_REF = 'ZyXwVuTsRqPoNmLkJiHgFeDc';
const SALT = 'test-salt-0123456789';
const TENANT = '11111111-1111-4111-8111-111111111111';
const BOT = '22222222-2222-4222-8222-222222222222';
const PROJECT = '33333333-3333-4333-8333-333333333333';
const BINDING = '44444444-4444-4444-8444-444444444444';

interface Store {
  bindings: Map<string, ResolvedInbox>;
  conversations: Array<NewConversation & { id: string }>;
  intakes: NewIntake[];
  messages: Array<{ conversation_id: string; content: string }>;
  calls: string[];
  failIntake?: boolean;
}

function newStore(): Store {
  const s: Store = { bindings: new Map(), conversations: [], intakes: [], messages: [], calls: [] };
  s.bindings.set(SITE_REF, { binding_id: BINDING, tenant_id: TENANT, bot_id: BOT, website_project_id: PROJECT });
  return s;
}

let seq = 0;
function memRepo(s: Store): InboxRepo {
  return {
    async resolveSiteInbox(ref) { s.calls.push('resolve'); return s.bindings.get(ref) ?? null; },
    async countRecentByIpHash(tenantId, ipHash, sinceIso) {
      s.calls.push('count');
      return s.conversations.filter((c) =>
        c.tenant_id === tenantId && c.metadata.ip_hash === ipHash && c.now >= sinceIso).length;
    },
    async countRecentByBinding(tenantId, bindingId, sinceIso) {
      s.calls.push('count');
      return s.conversations.filter((c) =>
        c.tenant_id === tenantId && c.metadata.binding_id === bindingId && c.now >= sinceIso).length;
    },
    async insertConversation(c) {
      s.calls.push('insert');
      const dup = s.conversations.find((x) => x.bot_id === c.bot_id && x.external_ref === c.external_ref);
      if (dup) return { ok: false, reason: 'duplicate', id: dup.id };
      const id = `aaaaaaaa-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
      s.conversations.push({ ...c, id });
      return { ok: true, id };
    },
    async insertIntake(i) {
      s.calls.push('intake');
      if (s.failIntake) return { ok: false, message: 'boom' };
      s.intakes.push(i);
      return { ok: true };
    },
    async insertUserMessage(m) { s.calls.push('message'); s.messages.push(m); return { ok: true }; },
    async deleteConversation(id) {
      s.calls.push('delete');
      s.conversations = s.conversations.filter((c) => c.id !== id);
    },
  };
}

function deps(s: Store, over: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    repo: memRepo(s),
    hashSalt: SALT,
    now: () => new Date('2026-11-03T12:00:00.000Z'),
    anonLimit: () => ({ allowed: true }),
    ...over,
  };
}

const validBody = (over: Record<string, unknown> = {}) => ({
  site_ref: SITE_REF,
  nonce: 'nonce-0123456789abcdef',
  anliegen: 'Heizung tropft, bitte Rückruf.',
  kontakt_name: 'Max Muster',
  kontakt_telefon: '+49 171 1234567',
  kontakt_email: 'max@example.com',
  terminwunsch: 'Dienstag vormittags',
  einwilligung: true,
  ...over,
});

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/functions/v1/inbox-form-submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('inbox-form-submit', () => {
  it('F1: gültige Anfrage → 201, Konversation + Intake + Nachricht, keine IDs in der Antwort', async () => {
    const s = newStore();
    const res = await handleInboxFormSubmit(post(validBody()), deps(s));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.status).toBe('received');
    expect(typeof json.reference).toBe('string');
    expect(JSON.stringify(json)).not.toContain(TENANT);
    expect(JSON.stringify(json)).not.toContain(BOT);

    expect(s.conversations).toHaveLength(1);
    const c = s.conversations[0]!;
    expect(c.tenant_id).toBe(TENANT);
    expect(c.bot_id).toBe(BOT);
    expect(c.external_ref).toBe(`form:${SITE_REF}:nonce-0123456789abcdef`);
    expect(c.contact_label).toBe('Max Muster');
    expect(c.metadata.source).toBe('site_form');
    expect(c.metadata.binding_id).toBe(BINDING);

    expect(s.intakes).toHaveLength(1);
    const i = s.intakes[0]!;
    expect(i.conversation_id).toBe(c.id);
    expect(i.tenant_id).toBe(TENANT);
    expect(i.anliegen).toBe('Heizung tropft, bitte Rückruf.');
    expect(i.terminwunsch).toBe('Dienstag vormittags');
    expect(i.einwilligung_at).toBe('2026-11-03T12:00:00.000Z');

    expect(s.messages).toEqual([{ tenant_id: TENANT, conversation_id: c.id, bot_id: BOT, content: 'Heizung tropft, bitte Rückruf.' }]);
    expect(s.calls).toEqual(['resolve', 'count', 'count', 'insert', 'intake', 'message']);
  });

  it('F2: Doppel-Submit mit gleicher site_ref + nonce → 200 duplicate, eine Konversation', async () => {
    const s = newStore();
    const first = await handleInboxFormSubmit(post(validBody()), deps(s));
    const second = await handleInboxFormSubmit(post(validBody({ anliegen: 'Zweiter Versuch, anderer Text' })), deps(s));
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await second.json()).status).toBe('duplicate');
    expect(s.conversations).toHaveLength(1);
    expect(s.intakes).toHaveLength(1);
    expect(s.messages).toHaveLength(1);
  });

  it('F2b: andere nonce → neue Konversation', async () => {
    const s = newStore();
    await handleInboxFormSubmit(post(validBody()), deps(s));
    await handleInboxFormSubmit(post(validBody({ nonce: 'nonce-fedcba9876543210' })), deps(s));
    expect(s.conversations).toHaveLength(2);
  });

  it('F3: unbekannte oder deaktivierte site_ref → 404, nichts geschrieben', async () => {
    const s = newStore();
    const res = await handleInboxFormSubmit(post(validBody({ site_ref: OTHER_REF })), deps(s));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_FOUND');
    expect(s.conversations).toHaveLength(0);
    expect(s.calls).toEqual(['resolve']);
  });

  it('F4: Honeypot → 400 ohne resolve und ohne Schreiben', async () => {
    const s = newStore();
    const res = await handleInboxFormSubmit(post(validBody({ company_website: 'http://spam.example' })), deps(s));
    expect(res.status).toBe(400);
    expect(s.calls).toEqual([]);
    expect(s.conversations).toHaveLength(0);
  });

  it('F5: gefälschte tenant_id / bot_id im Body werden ignoriert', async () => {
    const s = newStore();
    const res = await handleInboxFormSubmit(
      post(validBody({ tenant_id: '99999999-9999-4999-8999-999999999999', bot_id: '88888888-8888-4888-8888-888888888888' })),
      deps(s),
    );
    expect(res.status).toBe(201);
    expect(s.conversations[0]!.tenant_id).toBe(TENANT);
    expect(s.conversations[0]!.bot_id).toBe(BOT);
    expect(s.intakes[0]!.tenant_id).toBe(TENANT);
  });

  it('F6: Validierung', async () => {
    const cases: Array<[Record<string, unknown>, number, string]> = [
      [{ site_ref: 'short' }, 400, 'BAD_REQUEST'],
      [{ site_ref: SITE_REF + '!' }, 400, 'BAD_REQUEST'],
      [{ nonce: 'x' }, 400, 'BAD_REQUEST'],
      [{ nonce: 'has spaces in it yes' }, 400, 'BAD_REQUEST'],
      [{ anliegen: '' }, 400, 'VALIDATION'],
      [{ anliegen: 'ab' }, 400, 'VALIDATION'],
      [{ kontakt_email: null, kontakt_telefon: null }, 400, 'VALIDATION'],
      [{ kontakt_email: 'nicht-eine-mail' }, 400, 'VALIDATION'],
      [{ kontakt_telefon: 'abc' }, 400, 'VALIDATION'],
      [{ einwilligung: false }, 400, 'VALIDATION'],
      [{ einwilligung: 'true' }, 400, 'VALIDATION'],
    ];
    for (const [over, status, code] of cases) {
      const s = newStore();
      const res = await handleInboxFormSubmit(post(validBody(over)), deps(s));
      expect(res.status, JSON.stringify(over)).toBe(status);
      expect((await res.json()).error.code, JSON.stringify(over)).toBe(code);
      expect(s.conversations, JSON.stringify(over)).toHaveLength(0);
    }
  });

  it('F6b: nur Telefon ohne E-Mail reicht; Aliasfelder name/email/phone werden gelesen', async () => {
    const s = newStore();
    const res = await handleInboxFormSubmit(
      post({ site_ref: SITE_REF, nonce: 'nonce-0123456789abcdef', anliegen: 'Rückruf bitte', phone: '0171 1234567', einwilligung: true }),
      deps(s),
    );
    expect(res.status).toBe(201);
    expect(s.intakes[0]!.kontakt_telefon).toBe('0171 1234567');
    expect(s.intakes[0]!.kontakt_email).toBeNull();
    expect(s.conversations[0]!.contact_label).toBe('0171 1234567');
  });

  it('F7: Body zu gross → 413; ungültiges JSON → 400; Array → 400; GET → 405; OPTIONS → CORS', async () => {
    const s = newStore();
    const big = post(validBody({ anliegen: 'x'.repeat(17 * 1024) }));
    expect((await handleInboxFormSubmit(big, deps(s))).status).toBe(413);
    expect((await handleInboxFormSubmit(post('{not json'), deps(s))).status).toBe(400);
    expect((await handleInboxFormSubmit(post([1, 2]), deps(s))).status).toBe(400);
    const get = new Request('http://localhost/functions/v1/inbox-form-submit', { method: 'GET' });
    expect((await handleInboxFormSubmit(get, deps(s))).status).toBe(405);
    const opt = new Request('http://localhost/functions/v1/inbox-form-submit', { method: 'OPTIONS' });
    const pre = await handleInboxFormSubmit(opt, deps(s));
    expect(pre.status).toBeLessThan(300);
    expect(pre.headers.get('access-control-allow-origin')).toBe('*');
    expect(s.calls).toEqual([]);
  });

  it('F8a: Isolate-Rate-Limit → 429 vor resolve', async () => {
    const s = newStore();
    const res = await handleInboxFormSubmit(post(validBody()), deps(s, { anonLimit: () => ({ allowed: false }) }));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    expect(s.calls).toEqual([]);
  });

  it('F8b: DB-Rate-Limit je ip_hash und Mandant → 429 nach resolve, kein Insert', async () => {
    const s = newStore();
    for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) {
      const res = await handleInboxFormSubmit(post(validBody({ nonce: `nonce-${String(i).padStart(14, '0')}` })), deps(s));
      expect(res.status).toBe(201);
    }
    const res = await handleInboxFormSubmit(post(validBody({ nonce: 'nonce-overflow0000000' })), deps(s));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('3600');
    expect(s.conversations).toHaveLength(RATE_LIMIT_PER_HOUR);
    // Andere IP → eigener Zähler.
    const other = await handleInboxFormSubmit(
      post(validBody({ nonce: 'nonce-otherip00000000' }), { 'x-forwarded-for': '198.51.100.9' }), deps(s));
    expect(other.status).toBe(201);
  });

  it('F8c: wechselnde X-Forwarded-For umgehen das Limit nicht (Kontingent je Seite, IP-unabhängig)', async () => {
    const s = newStore();
    for (let i = 0; i < RATE_LIMIT_PER_SITE_PER_HOUR; i++) {
      const res = await handleInboxFormSubmit(
        post(validBody({ nonce: `nonce-site-${String(i).padStart(10, '0')}` }), { 'x-forwarded-for': `10.0.${Math.floor(i / 250)}.${i % 250}` }),
        deps(s));
      expect(res.status, `#${i}`).toBe(201);
    }
    const res = await handleInboxFormSubmit(
      post(validBody({ nonce: 'nonce-site-overflow0000' }), { 'x-forwarded-for': '192.0.2.1' }), deps(s));
    expect(res.status).toBe(429);
    expect(s.conversations).toHaveLength(RATE_LIMIT_PER_SITE_PER_HOUR);
    // Anderes Binding (andere Seite) hat ein eigenes Kontingent.
    s.bindings.set(OTHER_REF, { binding_id: '55555555-5555-4555-8555-555555555555', tenant_id: TENANT, bot_id: BOT, website_project_id: PROJECT });
    const other = await handleInboxFormSubmit(
      post(validBody({ site_ref: OTHER_REF, nonce: 'nonce-other-site-000000' }), { 'x-forwarded-for': '192.0.2.1' }), deps(s));
    expect(other.status).toBe(201);
  });

  it('F8d: clientIp nimmt den vertrauenswürdigen (letzten) XFF-Eintrag, nie den vom Client gesetzten ersten', () => {
    const h = (o: Record<string, string>) => new Headers(o);
    expect(clientIp(h({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientIp(h({ 'x-forwarded-for': 'evil, 2001:db8::1' }))).toBe('2001:db8::1');
    expect(clientIp(h({ 'x-forwarded-for': 'not-an-ip' }))).toBe('unknown');
    expect(clientIp(h({ 'cf-connecting-ip': '198.51.100.9', 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }))).toBe('198.51.100.9');
    expect(clientIp(h({}))).toBe('unknown');
    // Zwei Requests mit verschiedenem Client-Prefix, gleicher echter IP → gleicher Hash.
    const a = clientIp(h({ 'x-forwarded-for': 'a.a.a.a, 203.0.113.7' }));
    const b = clientIp(h({ 'x-forwarded-for': 'b.b.b.b, 203.0.113.7' }));
    expect(a).toBe(b);
  });

  it('F9: fehlendes Salt → 503 ohne Schreiben; IP nur als HMAC-Hash gespeichert', async () => {
    const s = newStore();
    const res = await handleInboxFormSubmit(post(validBody()), deps(s, { hashSalt: '' }));
    expect(res.status).toBe(503);
    expect(s.calls).toEqual([]);

    await handleInboxFormSubmit(post(validBody()), deps(s));
    const meta = JSON.stringify(s.conversations[0]!.metadata);
    expect(meta).not.toContain('203.0.113.7');
    expect(s.conversations[0]!.metadata.ip_hash).toBe(await hashIp('203.0.113.7', SALT));
    expect(await hashIp('203.0.113.7', SALT)).not.toBe(await hashIp('203.0.113.7', 'anderes-salt'));
    await expect(hashIp('203.0.113.7', '')).rejects.toThrow();
  });

  it('F10: Intake scheitert nach dem Anlegen → Konversation entfernt, 500', async () => {
    const s = newStore();
    s.failIntake = true;
    const res = await handleInboxFormSubmit(post(validBody()), deps(s));
    expect(res.status).toBe(500);
    expect(s.conversations).toHaveLength(0);
    expect(s.calls).toEqual(['resolve', 'count', 'count', 'insert', 'intake', 'delete']);
  });

  it('F11: Längenkappung auf die Intake-CHECKs', async () => {
    const s = newStore();
    const res = await handleInboxFormSubmit(
      post(validBody({
        anliegen: 'a'.repeat(5000),
        kontakt_name: 'n'.repeat(300),
        terminwunsch: 't'.repeat(600),
      })),
      deps(s),
    );
    expect(res.status).toBe(201);
    const i = s.intakes[0]!;
    expect(i.anliegen).toHaveLength(LIMITS.anliegen);
    expect(i.kontakt_name).toHaveLength(LIMITS.kontakt_name);
    expect(i.terminwunsch).toHaveLength(LIMITS.terminwunsch);
  });

  it('F12: handler/logic/repo bleiben vitest-importierbar (kein Deno / jsr); index.ts nutzt das Salt', () => {
    for (const f of ['handler.ts', 'logic.ts', 'repo.ts']) {
      const src = readFileSync(`supabase/functions/inbox-form-submit/${f}`, 'utf8');
      expect(src, f).not.toMatch(/from 'jsr:|from 'npm:|\bDeno\.(env|serve)\(/);
    }
    const index = readFileSync('supabase/functions/inbox-form-submit/index.ts', 'utf8');
    expect(index).toContain("Deno.env.get('INBOX_FORM_HASH_SALT')");
    const toml = readFileSync('supabase/config.toml', 'utf8');
    expect(toml).toMatch(/\[functions\.inbox-form-submit\]\s*\nverify_jwt = false/);
  });
});
