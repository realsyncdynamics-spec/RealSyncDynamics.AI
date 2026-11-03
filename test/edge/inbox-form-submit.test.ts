/**
 * PR C, Schritt 3: öffentliches Formular → Posteingang (inbox-form-submit).
 *
 * Geprüft ohne Datenbank (Mock-Client):
 *   F1  Validierung: Pflichtfelder, Grenzen = CHECK-Constraints, Rückkanal,
 *       Formate von site_ref / nonce / E-Mail / Telefon / Terminwunsch-Zeit
 *   F2  Honeypot
 *   F3  Rate-Limit je Quelle und je Seite
 *   F4  Auflösung fail-closed (keine Zeile, Fehler, kaputte Zeile)
 *   F5  Schreibpfad: Kanal form, Status open, Mandant/Bot nur aus Auflösung,
 *       Nonce als external_ref, Intake mit quelle form, keine Einwilligung
 *   F6  Doppelabsendung: 23505 → Erfolg ohne zweite Konversation; fehlender
 *       Intake wird ergänzt; doppelter Intake ist Erfolg
 *   F7  Fehler → kein Erfolg, Stufe benannt
 *   F8  Handler-Vertrag: Schalter, Reihenfolge, kein KI-Aufruf, keine
 *       Kontaktdaten in Logs, config.toml + pre-deploy-lint, Registereintrag
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  HONEYPOT_FIELD,
  LIMITS,
  RATE_LIMIT_PER_SITE,
  RATE_LIMIT_PER_SOURCE,
  checkFormRateLimit,
  formExternalRef,
  formSubmitEnabled,
  isHoneypotTripped,
  resolveInbox,
  submitFormRequest,
  validateFormBody,
  type FormInput,
  type InboxDbClient,
  type ResolvedInbox,
} from '../../supabase/functions/inbox-form-submit/logic';
import { resetAnonRateLimits } from '../../supabase/functions/_shared/anonRateLimit';
import { getImplementation } from '../../src/product/implementation-status';

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const SITE_REF = 'AbCdEfGhIjKlMnOpQrStUv_-';
const NONCE = '3f1c9a7e-0b2d-4c8e-9f6a-1d2e3f4a5b6c';

const VALID = {
  site_ref: SITE_REF,
  nonce: NONCE,
  anliegen: 'Heizung macht Geräusche, bitte Rückruf.',
  kontakt_name: 'Erika Muster',
  kontakt_telefon: '+49 30 1234567',
  kontakt_email: 'Erika@Example.org',
  terminwunsch: 'Dienstag vormittags',
  terminwunsch_zeit: '2026-11-10T09:00:00+01:00',
};

const INBOX: ResolvedInbox = {
  bindingId: '11111111-1111-1111-1111-111111111111',
  tenantId: '22222222-2222-2222-2222-222222222222',
  botId: '33333333-3333-3333-3333-333333333333',
  websiteProjectId: '44444444-4444-4444-4444-444444444444',
};

function input(overrides: Partial<FormInput> = {}): FormInput {
  const v = validateFormBody(VALID);
  if (!v.ok) throw new Error('fixture invalid');
  return { ...v.input, ...overrides };
}

type Res = { data?: unknown; error: { code?: string; message?: string } | null };

/** Mock: Konversations-Insert, Lookup und Intake-Insert getrennt steuerbar. */
function mockDb(opts: { conv?: Res; lookup?: Res; intake?: Res; rpc?: Res } = {}) {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const lookups: Array<{ table: string; filters: Array<[string, string]> }> = [];
  const rpcRes: Res = opts.rpc ?? { data: [], error: null };
  const rpc = vi.fn(async () => ({ data: rpcRes.data ?? null, error: rpcRes.error }));
  const db: InboxDbClient = {
    rpc,
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          inserts.push({ table, row });
          const res: Res = table === 'bot_conversations'
            ? (opts.conv ?? { data: { id: 'conv-new' }, error: null })
            : (opts.intake ?? { error: null });
          const thenable = Promise.resolve({ error: res.error });
          return Object.assign(thenable, {
            select: () => ({ single: async () => ({ data: res.data ?? null, error: res.error }) }),
          });
        },
        select() {
          const filters: Array<[string, string]> = [];
          lookups.push({ table, filters });
          return {
            eq(c1: string, v1: string) {
              filters.push([c1, v1]);
              return {
                eq(c2: string, v2: string) {
                  filters.push([c2, v2]);
                  return {
                    maybeSingle: async () => {
                      const r = opts.lookup ?? { data: { id: 'conv-existing' }, error: null };
                      return { data: r.data ?? null, error: r.error };
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
  return { db, rpc, inserts, lookups };
}

describe('F1 validateFormBody', () => {
  it('accepts a complete request and normalises e-mail and time', () => {
    const v = validateFormBody(VALID);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.input.kontaktEmail).toBe('erika@example.org');
    expect(v.input.terminwunschZeit).toBe('2026-11-10T08:00:00.000Z');
    expect(v.input.siteRef).toBe(SITE_REF);
  });

  it('accepts the minimum: anliegen plus one return channel', () => {
    const phoneOnly = validateFormBody({ site_ref: SITE_REF, nonce: NONCE, anliegen: 'x', kontakt_telefon: '030 123456' });
    const mailOnly = validateFormBody({ site_ref: SITE_REF, nonce: NONCE, anliegen: 'x', kontakt_email: 'a@b.de' });
    expect(phoneOnly.ok && mailOnly.ok).toBe(true);
    if (phoneOnly.ok) {
      expect(phoneOnly.input.kontaktName).toBeNull();
      expect(phoneOnly.input.terminwunsch).toBeNull();
      expect(phoneOnly.input.terminwunschZeit).toBeNull();
    }
  });

  it.each([
    ['site_ref', { site_ref: 'short' }],
    ['site_ref', { site_ref: 'A'.repeat(23) + '!' }],
    ['site_ref', { site_ref: 123 }],
    ['nonce', { nonce: undefined }],
    ['nonce', { nonce: 'kurz' }],
    ['nonce', { nonce: 'a'.repeat(65) }],
    ['nonce', { nonce: 'has spaces in the nonce!!' }],
    ['anliegen', { anliegen: '' }],
    ['anliegen', { anliegen: '   ' }],
    ['anliegen', { anliegen: 'a'.repeat(LIMITS.anliegen + 1) }],
    ['anliegen', { anliegen: 42 }],
    ['kontakt_name', { kontakt_name: 'n'.repeat(LIMITS.kontakt_name + 1) }],
    ['kontakt_telefon', { kontakt_telefon: 'ruf mich an' }],
    ['kontakt_telefon', { kontakt_telefon: '1'.repeat(LIMITS.kontakt_telefon + 1) }],
    ['kontakt_email', { kontakt_email: 'keine-adresse' }],
    ['kontakt_email', { kontakt_email: `${'a'.repeat(LIMITS.kontakt_email)}@x.de` }],
    ['kontakt', { kontakt_telefon: '', kontakt_email: null }],
    ['terminwunsch', { terminwunsch: 't'.repeat(LIMITS.terminwunsch + 1) }],
    ['terminwunsch_zeit', { terminwunsch_zeit: 'morgen früh' }],
    ['terminwunsch_zeit', { terminwunsch_zeit: 12345 }],
  ])('rejects invalid %s', (field: string, patch: Record<string, unknown>) => {
    const v = validateFormBody({ ...VALID, ...patch });
    expect(v).toEqual({ ok: false, field });
  });

  it('accepts fields exactly at the database limits', () => {
    const v = validateFormBody({
      ...VALID,
      anliegen: 'a'.repeat(LIMITS.anliegen),
      kontakt_name: 'n'.repeat(LIMITS.kontakt_name),
      terminwunsch: 't'.repeat(LIMITS.terminwunsch),
    });
    expect(v.ok).toBe(true);
  });

  it('strips control characters but keeps line breaks', () => {
    const v = validateFormBody({ ...VALID, anliegen: 'Zeile 1\nZeile\u0000 2\u0007' });
    expect(v.ok && v.input.anliegen).toBe('Zeile 1\nZeile 2');
  });

  it('ignores tenant, bot and consent fields from the body', () => {
    const v = validateFormBody({ ...VALID, tenant_id: 'evil', bot_id: 'evil', einwilligung_at: '2026-01-01' });
    expect(v.ok).toBe(true);
    if (v.ok) expect(JSON.stringify(v.input)).not.toContain('evil');
  });

  it('keeps the limits in sync with the intake CHECK constraints', () => {
    const migration = read('supabase/migrations/20261103000000_inbox_handoff.sql');
    for (const [col, max] of Object.entries(LIMITS)) {
      expect(migration).toContain(`char_length(${col}) <= ${max}`);
    }
  });
});

describe('F2 honeypot', () => {
  it('trips only on a filled honeypot field', () => {
    expect(HONEYPOT_FIELD).toBe('company_website');
    expect(isHoneypotTripped({ company_website: 'https://spam.example' })).toBe(true);
    expect(isHoneypotTripped({ company_website: '  ' })).toBe(false);
    expect(isHoneypotTripped({ company_website: '' })).toBe(false);
    expect(isHoneypotTripped({})).toBe(false);
  });
});

describe('F3 rate limit', () => {
  beforeEach(() => resetAnonRateLimits());

  it('allows 5 per source and site, then blocks that source', () => {
    for (let i = 0; i < RATE_LIMIT_PER_SOURCE.max; i++) expect(checkFormRateLimit('ip-a', SITE_REF)).toBe(true);
    expect(checkFormRateLimit('ip-a', SITE_REF)).toBe(false);
    expect(checkFormRateLimit('ip-b', SITE_REF)).toBe(true);
  });

  it('caps a single site across many sources', () => {
    for (let i = 0; i < RATE_LIMIT_PER_SITE.max; i++) expect(checkFormRateLimit(`ip-${i}`, SITE_REF)).toBe(true);
    expect(checkFormRateLimit('ip-new', SITE_REF)).toBe(false);
    expect(checkFormRateLimit('ip-new', 'ZZZZZZZZZZZZZZZZZZZZZZZZ')).toBe(true);
  });

  it('does not let a blocked source consume the site quota', () => {
    for (let i = 0; i < 20; i++) checkFormRateLimit('ip-flood', SITE_REF);
    for (let i = 0; i < RATE_LIMIT_PER_SITE.max - RATE_LIMIT_PER_SOURCE.max; i++) {
      expect(checkFormRateLimit(`ip-${i}`, SITE_REF)).toBe(true);
    }
  });
});

describe('F4 resolveInbox (fail-closed)', () => {
  it('maps the RPC row', async () => {
    const { db, rpc } = mockDb({
      rpc: {
        data: [{ binding_id: INBOX.bindingId, tenant_id: INBOX.tenantId, bot_id: INBOX.botId, website_project_id: INBOX.websiteProjectId }],
        error: null,
      },
    });
    expect(await resolveInbox(db, SITE_REF)).toEqual({ ok: true, inbox: INBOX });
    expect(rpc).toHaveBeenCalledWith('resolve_site_inbox', { p_site_ref: SITE_REF });
  });

  it('returns not_found for no row', async () => {
    expect(await resolveInbox(mockDb({ rpc: { data: [], error: null } }).db, SITE_REF)).toEqual({ ok: false, reason: 'not_found' });
    expect(await resolveInbox(mockDb({ rpc: { data: null, error: null } }).db, SITE_REF)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('returns error on RPC error or incomplete row', async () => {
    expect(await resolveInbox(mockDb({ rpc: { data: null, error: { code: 'PGRST202' } } }).db, SITE_REF))
      .toEqual({ ok: false, reason: 'error', code: 'PGRST202' });
    expect(await resolveInbox(mockDb({ rpc: { data: [{ tenant_id: 'x' }], error: null } }).db, SITE_REF))
      .toEqual({ ok: false, reason: 'error' });
  });
});

describe('F5 submitFormRequest write path', () => {
  const NOW = new Date('2026-11-03T10:00:00.000Z');

  it('creates an open form conversation and its intake', async () => {
    const { db, inserts } = mockDb();
    expect(await submitFormRequest(db, INBOX, input(), NOW)).toEqual({ ok: true, duplicate: false });
    expect(inserts.map((i) => i.table)).toEqual(['bot_conversations', 'bot_conversation_intake']);

    const conv = inserts[0].row;
    expect(conv).toMatchObject({
      tenant_id: INBOX.tenantId,
      bot_id: INBOX.botId,
      channel: 'form',
      status: 'open',
      external_ref: `form:${NONCE}`,
      contact_label: 'Erika Muster',
      last_message_at: NOW.toISOString(),
    });
    expect(conv).not.toHaveProperty('assigned_to');
    expect(conv).not.toHaveProperty('handed_off_at');

    const intake = inserts[1].row;
    expect(intake).toMatchObject({
      conversation_id: 'conv-new',
      tenant_id: INBOX.tenantId,
      quelle: 'form',
      anliegen: VALID.anliegen,
      kontakt_email: 'erika@example.org',
      terminwunsch: 'Dienstag vormittags',
    });
    expect(intake).not.toHaveProperty('einwilligung_at');
  });

  it('uses the nonce as per-bot idempotency key', () => {
    expect(formExternalRef(NONCE)).toBe(`form:${NONCE}`);
    const bots = read('supabase/migrations/20260628120000_bots_foundation.sql');
    expect(bots).toMatch(/uq_bot_conversations_bot_ref\s+ON public\.bot_conversations\(bot_id, external_ref\)/);
  });
});

describe('F6 double submission', () => {
  const NOW = new Date('2026-11-03T10:00:00.000Z');

  it('treats a repeated nonce as success without a second conversation', async () => {
    const { db, inserts, lookups } = mockDb({
      conv: { error: { code: '23505' } },
      intake: { error: { code: '23505' } },
    });
    expect(await submitFormRequest(db, INBOX, input(), NOW)).toEqual({ ok: true, duplicate: true });
    expect(lookups[0]).toEqual({
      table: 'bot_conversations',
      filters: [['bot_id', INBOX.botId], ['external_ref', `form:${NONCE}`]],
    });
    expect(inserts.filter((i) => i.table === 'bot_conversations')).toHaveLength(1);
  });

  it('adds a missing intake on retry after an aborted first attempt', async () => {
    const { db, inserts } = mockDb({ conv: { error: { code: '23505' } } });
    expect(await submitFormRequest(db, INBOX, input(), NOW)).toEqual({ ok: true, duplicate: true });
    expect(inserts[1]).toMatchObject({ table: 'bot_conversation_intake', row: { conversation_id: 'conv-existing' } });
  });
});

describe('F7 failures are never reported as success', () => {
  const NOW = new Date();

  it('conversation insert error', async () => {
    const { db, inserts } = mockDb({ conv: { error: { code: '23514' } } });
    expect(await submitFormRequest(db, INBOX, input(), NOW)).toEqual({ ok: false, reason: 'error', stage: 'conversation', code: '23514' });
    expect(inserts).toHaveLength(1);
  });

  it('lookup after duplicate fails', async () => {
    const { db } = mockDb({ conv: { error: { code: '23505' } }, lookup: { data: null, error: null } });
    expect(await submitFormRequest(db, INBOX, input(), NOW)).toMatchObject({ ok: false, stage: 'lookup' });
  });

  it('intake insert error', async () => {
    const { db } = mockDb({ intake: { error: { code: '42501' } } });
    expect(await submitFormRequest(db, INBOX, input(), NOW)).toEqual({ ok: false, reason: 'error', stage: 'intake', code: '42501' });
  });
});

describe('F8 handler contract', () => {
  const index = read('supabase/functions/inbox-form-submit/index.ts');
  const logic = read('supabase/functions/inbox-form-submit/logic.ts');

  it('is off unless explicitly enabled', () => {
    expect(formSubmitEnabled(undefined)).toBe(false);
    expect(formSubmitEnabled('')).toBe(false);
    expect(formSubmitEnabled('1')).toBe(false);
    expect(formSubmitEnabled('TRUE')).toBe(false);
    expect(formSubmitEnabled('true')).toBe(true);
    expect(index).toContain("formSubmitEnabled(Deno.env.get('INBOX_FORM_SUBMIT_ENABLED'))");
  });

  it('checks switch → size → honeypot → validation → rate limit → resolve → write', () => {
    const order = [
      'formSubmitEnabled(',
      'readCappedText(',
      'isHoneypotTripped(',
      'validateFormBody(',
      'checkFormRateLimit(',
      'resolveInbox(',
      'submitFormRequest(',
    ].map((s) => index.indexOf(s));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('makes no AI call and takes no tenant/bot/consent from the body', () => {
    for (const src of [index, logic]) {
      expect(src).not.toMatch(/ai-gateway|aiGateway|anthropic|openai|_shared\/ai\.ts|ollama/i);
      expect(src).not.toMatch(/body\.(tenant_id|bot_id|einwilligung)/);
    }
  });

  it('logs no contact data', () => {
    const logs = [...index.matchAll(/console\.(?:error|log|warn)\(([^;]*)\);/g)].map((m) => m[1]);
    expect(logs.length).toBeGreaterThan(0);
    for (const l of logs) expect(l).not.toMatch(/kontakt|anliegen|email|telefon|input\b|body\b/i);
  });

  it('is registered as public (verify_jwt = false) in config.toml and pre-deploy-lint', () => {
    expect(read('supabase/config.toml')).toMatch(/\[functions\.inbox-form-submit\]\s*\nverify_jwt = false/);
    expect(read('scripts/pre-deploy-lint.mjs')).toContain("'inbox-form-submit',");
  });

  it('is registered as not productive and hidden from the public roadmap', () => {
    const item = getImplementation('inbox-form-intake');
    expect(item?.status).toBe('coming-soon');
    expect(item?.showOnRoadmap).toBe(false);
    expect(item?.showOnPlatform).toBe(false);
    expect(item?.evidence).toContain('supabase/functions/inbox-form-submit/index.ts');
  });
});
