/**
 * KI-Sekretariat — serverseitiges Freigabe-Gate (Migration 20261125180000).
 *
 * ## Warum gegen echtes Postgres
 *
 * Freigabe, Aktivierung und automatische Pause hängen an einem Trigger,
 * an SECURITY-DEFINER-Funktionen, RLS, `auth.uid()`/`auth.role()` und
 * Zeilensperren. Nichts davon ist in TypeScript nachbildbar. Der Hash wird
 * ausschließlich in SQL berechnet (`secretariat_bot_content_sha256`).
 *
 * ## Matrix
 *
 *   Owner / Admin mit aktuellem Hash     → Freigabe, Aktivierung
 *   Editor, viewer_auditor, dpo          → 42501 (Freigabe), ROLE_REQUIRED (Aktivierung)
 *   fremder Mandant / unbekannter Bot    → 42501 mit identischer Meldung
 *   ohne Anmeldung (anon, sub = NULL)    → verweigert
 *   manipulierter / veralteter Hash      → HASH_MISMATCH, keine Zeile
 *   direktes UPDATE enabled = true       → NOT_APPROVED (Owner, Editor, service_role)
 *   direkter INSERT in die Freigaben     → 42501 (authenticated, service_role, anon)
 *   config.secretariat.approval (Client) → wirkungslos
 *   Inhaltsänderung nach Freigabe        → approved = false, aktiver Bot pausiert
 *   Marker entfernen, tenant_id wechseln → verweigert
 *   Nicht-Sekretariats-Bot               → unverändert (Regression)
 *   Nebenläufigkeit                      → nie „aktiv mit ungültiger Freigabe“
 *   pg_proc                              → search_path = '', keine EXECUTE für anon
 *
 * PR #2178 (offen) beschränkt Schreibrechte auf `public.bots` per RLS auf
 * Owner/Admin. Diese Datei gilt in beiden Welten: Wo ein Editor schreibt,
 * richtet sich die Erwartung nach der tatsächlich installierten
 * UPDATE-Policy (`mitgliedSchreibt`). Das Gate selbst darf sich nie auf
 * diese Policy verlassen — geprüft wird deshalb immer auch der Endzustand.
 *
 * Der Testclient ist Superuser. Ohne JWT-Claims liefert der CI-Stub für
 * `auth.role()` 'authenticated' — Fixture-Inserts laufen deshalb mit
 * service_role-Claims (wie in bots-quota.db.test.ts).
 *
 * Ohne TEST_DB_URL wird übersprungen; mit REQUIRE_DB_TESTS=1 ist das ein Fehler.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { closeDb, getDbUrl, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const run = requireDbOrFail('secretariat-server-gate');
const d = run ? describe : describe.skip;

interface PgError extends Error { code?: string; detail?: string }
type Who =
  | { role: 'anon' }
  | { role: 'service_role'; sub?: string }
  | { role: 'authenticated'; sub?: string };

const SERVER: Who = { role: 'service_role' };
const als = (sub: string): Who => ({ role: 'authenticated', sub });

const GATE_FUNKTIONEN = [
  'approve_secretariat_bot',
  'bots_secretariat_gate',
  'secretariat_bot_approvals_append_only',
  'secretariat_bot_content_sha256',
  'secretariat_bot_gate_status',
];

function unbekannt() {
  return { status: 'unknown', value: null, reason: 'nicht gefunden' };
}
function bekannt(value: string) {
  return { status: 'known', value, confidence: 'high' };
}
function sekretariatConfig(f: { name?: string | null; phone?: string | null; email?: string | null } = {}) {
  const name = f.name === undefined ? 'Muster Sanitär GmbH' : f.name;
  const phone = f.phone === undefined ? '+49 30 123456' : f.phone;
  const email = f.email === undefined ? null : f.email;
  return {
    vertical: 'general',
    secretariat: {
      version: 'sekretariat-2026.11.1',
      sourceUrl: 'https://example.invalid',
      fetchedAt: '2026-11-25T00:00:00Z',
      approval: null,
      fields: {
        businessName: name === null ? unbekannt() : bekannt(name),
        phone: phone === null ? unbekannt() : bekannt(phone),
        email: email === null ? unbekannt() : bekannt(email),
        address: unbekannt(),
        openingHours: unbekannt(),
        services: unbekannt(),
        faq: unbekannt(),
      },
    },
  };
}

/** Anweisung im Claims-/Rollenkontext; 'OK' oder 'SQLSTATE[:DETAIL]'. */
async function versuch(ctx: DbCtx, who: Who, sql: string, params: unknown[] = []): Promise<string> {
  try {
    await als_(ctx, who, () => ctx.client.query(sql, params));
    return 'OK';
  } catch (e) {
    const err = e as PgError;
    return err.detail ? `${err.code}:${err.detail}` : (err.code ?? err.message);
  }
}

/** Wie `versuch`, liefert aber die Meldung (Vergleich auf Existenz-Orakel). */
async function meldung(ctx: DbCtx, who: Who, sql: string, params: unknown[] = []): Promise<string> {
  try {
    await als_(ctx, who, () => ctx.client.query(sql, params));
    return 'OK';
  } catch (e) {
    const err = e as PgError;
    return `${err.code} ${err.message}`;
  }
}

/** withClaims kennt nur authenticated/service_role; anon braucht eine eigene Klammer. */
async function als_<T>(ctx: DbCtx, who: Who, fn: () => Promise<T>): Promise<T> {
  if (who.role !== 'anon') {
    return ctx.withClaims({ sub: who.sub, role: who.role }, fn);
  }
  const sp = `sp_anon_${Math.random().toString(36).slice(2, 10)}`;
  await ctx.client.query(`SAVEPOINT ${sp}`);
  await ctx.client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'anon' })]);
  await ctx.client.query('SET LOCAL ROLE anon');
  try {
    const out = await fn();
    await ctx.client.query(`RELEASE SAVEPOINT ${sp}`);
    await ctx.client.query('RESET ROLE');
    return out;
  } catch (err) {
    await ctx.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    await ctx.client.query('RESET ROLE');
    throw err;
  }
}

interface GateStatus {
  is_secretariat: boolean;
  content_sha256: string | null;
  approved: boolean;
  approved_at: string | null;
  enabled: boolean;
}

async function status(ctx: DbCtx, botId: string, who: Who = SERVER): Promise<GateStatus> {
  return als_(ctx, who, async () => {
    const { rows } = await ctx.client.query<{ s: GateStatus }>(
      'SELECT public.secretariat_bot_gate_status($1) AS s', [botId]);
    return rows[0]!.s;
  });
}

async function hash(ctx: DbCtx, botId: string): Promise<string> {
  const h = (await status(ctx, botId)).content_sha256;
  expect(h).toMatch(/^[0-9a-f]{64}$/);
  return h!;
}

async function enabled(ctx: DbCtx, botId: string): Promise<boolean> {
  const { rows } = await ctx.client.query<{ enabled: boolean }>('SELECT enabled FROM public.bots WHERE id = $1', [botId]);
  return rows[0]!.enabled;
}

async function freigeben(ctx: DbCtx, who: Who, botId: string, h: string | null, aktivieren = false): Promise<string> {
  return versuch(ctx, who, 'SELECT public.approve_secretariat_bot($1, $2, $3)', [botId, h, aktivieren]);
}

async function freigabeZeilen(ctx: DbCtx, botId: string): Promise<number> {
  const { rows } = await ctx.client.query<{ n: string }>(
    'SELECT count(*)::text AS n FROM public.secretariat_bot_approvals WHERE bot_id = $1', [botId]);
  return Number(rows[0]!.n);
}

async function audit(ctx: DbCtx, botId: string, action: string): Promise<Array<{ actor_user_id: string | null; actor_email: string | null; payload: Record<string, unknown> }>> {
  const { rows } = await ctx.client.query(
    `SELECT actor_user_id, actor_email, payload FROM public.governance_admin_log
      WHERE target_type = 'bot' AND target_id = $1 AND action = $2 ORDER BY created_at`,
    [botId, action]);
  return rows as Array<{ actor_user_id: string | null; actor_email: string | null; payload: Record<string, unknown> }>;
}

async function planEnterprise(client: Client | DbCtx['client'], tenantId: string): Promise<void> {
  await client.query(
    `INSERT INTO public.subscriptions (tenant_id, plan_key, status)
     VALUES ($1, 'enterprise', 'active')
     ON CONFLICT (tenant_id) DO UPDATE
       SET plan_key = 'enterprise', status = 'active', stripe_price_id = NULL,
           past_due_since = NULL, updated_at = now()`,
    [tenantId]);
}

/** Ohne #2178 darf jedes Mitglied `bots` beschreiben, mit #2178 nur Owner/Admin. */
async function mitgliedSchreibt(ctx: DbCtx): Promise<boolean> {
  const { rows } = await ctx.client.query<{ q: string | null }>(
    `SELECT pg_get_expr(polqual, polrelid) AS q FROM pg_policy
      WHERE polrelid = 'public.bots'::regclass AND polcmd IN ('w', '*')`);
  return rows.some((r) => /is_tenant_member\(/.test(r.q ?? ''));
}

interface Welt {
  tenantA: string; tenantB: string;
  ownerA: string; adminA: string; editorA: string; viewerA: string; dpoA: string; ownerB: string;
}

async function weltAnlegen(ctx: DbCtx): Promise<Welt> {
  const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tenant = async (n: string) => (await ctx.client.query<{ id: string }>(
    'INSERT INTO public.tenants (name) VALUES ($1) RETURNING id', [`gate_${n}_${tag}`])).rows[0]!.id;
  const tenantA = await tenant('a');
  const tenantB = await tenant('b');
  const nutzer = async (tenantId: string, role: string) => {
    const { rows } = await ctx.client.query<{ id: string }>(
      'INSERT INTO auth.users (email) VALUES ($1) RETURNING id', [`gate_${role}_${tag}_${Math.random().toString(36).slice(2, 8)}@example.invalid`]);
    await ctx.client.query('INSERT INTO public.memberships (tenant_id, user_id, role) VALUES ($1, $2, $3)', [tenantId, rows[0]!.id, role]);
    return rows[0]!.id;
  };
  const w: Welt = {
    tenantA, tenantB,
    ownerA: await nutzer(tenantA, 'owner'),
    adminA: await nutzer(tenantA, 'admin'),
    editorA: await nutzer(tenantA, 'editor'),
    viewerA: await nutzer(tenantA, 'viewer_auditor'),
    dpoA: await nutzer(tenantA, 'dpo'),
    ownerB: await nutzer(tenantB, 'owner'),
  };
  await planEnterprise(ctx.client, tenantA);
  await planEnterprise(ctx.client, tenantB);
  return w;
}

async function botAnlegen(
  ctx: DbCtx,
  tenantId: string,
  opts: { name?: string; config?: unknown; enabled?: boolean; persona?: string | null } = {},
): Promise<string> {
  return als_(ctx, SERVER, async () => {
    const { rows } = await ctx.client.query<{ id: string }>(
      `INSERT INTO public.bots (tenant_id, name, config, enabled, persona)
       VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING id`,
      [tenantId, opts.name ?? 'Sekretariat Muster', JSON.stringify(opts.config ?? sekretariatConfig()),
        opts.enabled ?? false, opts.persona ?? 'Du bist das KI-Sekretariat.']);
    return rows[0]!.id;
  });
}

d('KI-Sekretariat — Freigabe-Gate (Migration 20261125180000)', () => {
  let ctx: DbCtx;
  let w: Welt;

  beforeEach(async () => {
    ctx = await openDb();
    w = await weltAnlegen(ctx);
  });

  afterEach(async () => {
    await closeDb(ctx);
  });

  it('Owner mit gültigem Hash: Freigabe gespeichert, Server-Hash, Prüfpfad ohne Feldwerte', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    const h = await hash(ctx, bot);
    expect(await freigeben(ctx, als(w.ownerA), bot, h)).toBe('OK');

    const { rows } = await ctx.client.query(
      'SELECT tenant_id, content_sha256, approved_by FROM public.secretariat_bot_approvals WHERE bot_id = $1', [bot]);
    expect(rows).toEqual([{ tenant_id: w.tenantA, content_sha256: h, approved_by: w.ownerA }]);

    const s = await status(ctx, bot, als(w.editorA));
    expect([s.is_secretariat, s.approved, s.enabled]).toEqual([true, true, false]);

    const log = await audit(ctx, bot, 'secretariat.approved');
    expect(log.length).toBe(1);
    expect(log[0]!.actor_user_id).toBe(w.ownerA);
    expect(log[0]!.actor_email).toBeNull();
    expect(Object.keys(log[0]!.payload).sort()).toEqual(['approval_id', 'content_sha256']);
    expect(JSON.stringify(log[0]!.payload)).not.toContain('Muster');
  });

  it('Admin mit gültigem Hash: Freigabe und Aktivierung in einem Schritt', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    expect(await freigeben(ctx, als(w.adminA), bot, await hash(ctx, bot), true)).toBe('OK');
    expect(await enabled(ctx, bot)).toBe(true);
    expect((await audit(ctx, bot, 'secretariat.activated')).map((r) => r.actor_user_id)).toEqual([w.adminA]);
  });

  it('Mitglied ohne Owner/Admin (editor, viewer_auditor, dpo) → 42501, keine Zeile', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    const h = await hash(ctx, bot);
    for (const sub of [w.editorA, w.viewerA, w.dpoA]) {
      expect(await freigeben(ctx, als(sub), bot, h, true)).toBe('42501');
    }
    expect(await freigabeZeilen(ctx, bot)).toBe(0);
    expect(await enabled(ctx, bot)).toBe(false);
  });

  it('fremder Mandant → 42501, gleiche Meldung wie für einen unbekannten Bot', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    const h = await hash(ctx, bot);
    expect(await freigeben(ctx, als(w.ownerB), bot, h)).toBe('42501');
    const fremd = await meldung(ctx, als(w.ownerB), 'SELECT public.approve_secretariat_bot($1, $2)', [bot, h]);
    const gibtsNicht = await meldung(ctx, als(w.ownerB), 'SELECT public.approve_secretariat_bot(gen_random_uuid(), $1)', [h]);
    expect(fremd).toBe(gibtsNicht);

    expect(await versuch(ctx, als(w.ownerB), 'SELECT public.secretariat_bot_gate_status($1)', [bot])).toBe('42501');
    expect(await meldung(ctx, als(w.ownerB), 'SELECT public.secretariat_bot_gate_status($1)', [bot]))
      .toBe(await meldung(ctx, als(w.ownerB), 'SELECT public.secretariat_bot_gate_status(gen_random_uuid())'));
    expect(await freigabeZeilen(ctx, bot)).toBe(0);
  });

  it('ohne Anmeldung (anon, sub = NULL) → verweigert', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    const h = await hash(ctx, bot);
    expect(await freigeben(ctx, { role: 'anon' }, bot, h)).toBe('42501');
    expect(await freigeben(ctx, { role: 'authenticated' }, bot, h)).toBe('42501');
    expect(await freigeben(ctx, SERVER, bot, h), 'service_role hat kein auth.uid()').toBe('42501');
    expect(await versuch(ctx, { role: 'anon' }, 'SELECT public.secretariat_bot_gate_status($1)', [bot])).toBe('42501');
    expect(await versuch(ctx, { role: 'authenticated' }, 'SELECT public.secretariat_bot_gate_status($1)', [bot])).toBe('42501');
    expect(await freigabeZeilen(ctx, bot)).toBe(0);
  });

  it('manipulierter oder abweichender Hash → HASH_MISMATCH, nichts gespeichert', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    const h = await hash(ctx, bot);
    for (const falsch of ['0'.repeat(64), h.toUpperCase(), null, 'kein-hash']) {
      expect(await freigeben(ctx, als(w.ownerA), bot, falsch, true)).toBe('P0001:SECRETARIAT_HASH_MISMATCH');
    }
    expect(await freigabeZeilen(ctx, bot)).toBe(0);
    expect(await enabled(ctx, bot)).toBe(false);
  });

  it('Pflichtangaben wie approvalBlockers(): Name und Telefon oder E-Mail', async () => {
    const ohneName = await botAnlegen(ctx, w.tenantA, { config: sekretariatConfig({ name: null }) });
    const ohneKontakt = await botAnlegen(ctx, w.tenantA, { config: sekretariatConfig({ phone: null, email: null }) });
    const leererName = await botAnlegen(ctx, w.tenantA, { config: sekretariatConfig({ name: '   ' }) });
    const nurMail = await botAnlegen(ctx, w.tenantA, { config: sekretariatConfig({ phone: null, email: 'info@example.invalid' }) });
    for (const bot of [ohneName, ohneKontakt, leererName]) {
      expect(await freigeben(ctx, als(w.ownerA), bot, await hash(ctx, bot))).toBe('P0001:SECRETARIAT_FIELDS_MISSING');
    }
    expect(await freigeben(ctx, als(w.ownerA), nurMail, await hash(ctx, nurMail))).toBe('OK');
  });

  it('Nicht-Sekretariats-Bot lässt sich nicht freigeben', async () => {
    const bot = await botAnlegen(ctx, w.tenantA, { config: { vertical: 'general' } });
    expect(await freigeben(ctx, als(w.ownerA), bot, '0'.repeat(64))).toBe('P0001:SECRETARIAT_NOT_FOUND');
  });

  it('direktes UPDATE enabled = true ohne Freigabe → verweigert (Owner, Editor, service_role)', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    const sql = 'UPDATE public.bots SET enabled = true WHERE id = $1';
    expect(await versuch(ctx, als(w.ownerA), sql, [bot])).toBe('42501:SECRETARIAT_NOT_APPROVED');
    expect(await versuch(ctx, als(w.editorA), sql, [bot]))
      .toBe(await mitgliedSchreibt(ctx) ? '42501:SECRETARIAT_NOT_APPROVED' : 'OK' /* RLS: 0 Zeilen */);
    expect(await versuch(ctx, SERVER, sql, [bot])).toBe('42501:SECRETARIAT_NOT_APPROVED');
    expect(await enabled(ctx, bot)).toBe(false);
  });

  it('Sekretariats-Bot nur deaktiviert anlegen (auch Default enabled = true)', async () => {
    const cfg = JSON.stringify(sekretariatConfig());
    expect(await versuch(ctx, SERVER,
      'INSERT INTO public.bots (tenant_id, name, config) VALUES ($1, $2, $3::jsonb)', [w.tenantA, 'x', cfg]))
      .toBe('42501:SECRETARIAT_NOT_APPROVED');
    expect(await versuch(ctx, als(w.ownerA),
      'INSERT INTO public.bots (tenant_id, name, config, enabled) VALUES ($1, $2, $3::jsonb, true)', [w.tenantA, 'x', cfg]))
      .toBe('42501:SECRETARIAT_NOT_APPROVED');
    expect(await versuch(ctx, als(w.ownerA),
      'INSERT INTO public.bots (tenant_id, name, config, enabled) VALUES ($1, $2, $3::jsonb, false)', [w.tenantA, 'x', cfg]))
      .toBe('OK');
  });

  it('mit Freigabe: Aktivierung nur Owner/Admin oder service_role, Editor → ROLE_REQUIRED', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    expect(await freigeben(ctx, als(w.ownerA), bot, await hash(ctx, bot))).toBe('OK');
    const sql = 'UPDATE public.bots SET enabled = true WHERE id = $1';
    const erwartet = await mitgliedSchreibt(ctx) ? '42501:SECRETARIAT_ROLE_REQUIRED' : 'OK' /* RLS: 0 Zeilen */;
    expect(await versuch(ctx, als(w.editorA), sql, [bot])).toBe(erwartet);
    expect(await versuch(ctx, als(w.viewerA), sql, [bot])).toBe(erwartet);
    expect(await enabled(ctx, bot)).toBe(false);
    expect(await versuch(ctx, SERVER, sql, [bot])).toBe('OK');
    expect(await enabled(ctx, bot)).toBe(true);
  });

  it('direkter INSERT in secretariat_bot_approvals → verweigert (authenticated, service_role, anon)', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    const h = await hash(ctx, bot);
    const sql = `INSERT INTO public.secretariat_bot_approvals (bot_id, tenant_id, content_sha256, approved_by)
                 VALUES ($1, $2, $3, $4)`;
    expect(await versuch(ctx, als(w.ownerA), sql, [bot, w.tenantA, h, w.ownerA])).toBe('42501');
    expect(await versuch(ctx, SERVER, sql, [bot, w.tenantA, h, w.ownerA])).toBe('42501');
    expect(await versuch(ctx, { role: 'anon' }, sql, [bot, w.tenantA, h, w.ownerA])).toBe('42501');
    expect(await freigabeZeilen(ctx, bot)).toBe(0);
  });

  it('Freigaben sind append-only; Löschen von Bot oder Mandant entfernt sie per Kaskade', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    expect(await freigeben(ctx, als(w.ownerA), bot, await hash(ctx, bot))).toBe('OK');
    // Superuser-Kontext (Tabelleneigentümer): Trigger sperrt trotzdem.
    await expect(ctx.client.query(`SAVEPOINT ao`)).resolves.toBeDefined();
    const upd = await ctx.client.query(`UPDATE public.secretariat_bot_approvals SET content_sha256 = repeat('b', 64)`)
      .then(() => 'OK', (e: PgError) => e.code);
    await ctx.client.query('ROLLBACK TO SAVEPOINT ao');
    expect(upd).toBe('42501');
    const del = await ctx.client.query('DELETE FROM public.secretariat_bot_approvals')
      .then(() => 'OK', (e: PgError) => e.code);
    await ctx.client.query('ROLLBACK TO SAVEPOINT ao');
    expect(del).toBe('42501');
    expect(await versuch(ctx, als(w.ownerA), 'UPDATE public.secretariat_bot_approvals SET approved_by = gen_random_uuid()')).toBe('42501');

    expect(await versuch(ctx, als(w.ownerA), 'DELETE FROM public.bots WHERE id = $1', [bot])).toBe('OK');
    expect(await freigabeZeilen(ctx, bot)).toBe(0);

    // Mandantenlöschung: beide Kaskaden (über bots und über tenants) laufen durch.
    const zweiter = await botAnlegen(ctx, w.tenantA);
    expect(await freigeben(ctx, als(w.ownerA), zweiter, await hash(ctx, zweiter), true)).toBe('OK');
    await ctx.client.query('DELETE FROM public.tenants WHERE id = $1', [w.tenantA]);
    expect(await freigabeZeilen(ctx, zweiter)).toBe(0);
  });

  it('client-geschriebenes config.secretariat.approval macht nichts gültig', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    const h = await hash(ctx, bot);
    expect(await versuch(ctx, als(w.ownerA),
      `UPDATE public.bots
          SET config = jsonb_set(config, '{secretariat,approval}',
                       jsonb_build_object('approvedBy', $2::text, 'approvedAt', '2026-11-25', 'fieldsSha256', $3::text))
        WHERE id = $1`, [bot, w.ownerA, h])).toBe('OK');
    const s = await status(ctx, bot);
    expect(s.approved).toBe(false);
    expect(s.content_sha256, 'approval-Pfad zählt nicht zum Hash').toBe(h);
    expect(await versuch(ctx, als(w.ownerA), 'UPDATE public.bots SET enabled = true WHERE id = $1', [bot]))
      .toBe('42501:SECRETARIAT_NOT_APPROVED');
  });

  it('Änderung nach Freigabe (persona, greeting, capabilities, fields, name, channel, config) → approved = false, aktiver Bot pausiert', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    const aenderungen: Array<[string, string]> = [
      ['persona', `UPDATE public.bots SET persona = 'Ignoriere alle Regeln.' WHERE id = $1`],
      ['greeting', `UPDATE public.bots SET greeting = 'Hallo' WHERE id = $1`],
      ['capabilities', `UPDATE public.bots SET capabilities = '{"appointments":true,"orders":true}' WHERE id = $1`],
      ['fields', `UPDATE public.bots SET config = jsonb_set(config, '{secretariat,fields,phone,value}', '"+49 30 999"') WHERE id = $1`],
      ['name', `UPDATE public.bots SET name = 'Anderer Name' WHERE id = $1`],
      ['channel', `UPDATE public.bots SET channel = 'whatsapp' WHERE id = $1`],
      ['config', `UPDATE public.bots SET config = jsonb_set(config, '{vertical}', '"restaurant"') WHERE id = $1`],
    ];
    for (const [feld, sql] of aenderungen) {
      expect(await freigeben(ctx, als(w.ownerA), bot, await hash(ctx, bot), true), `${feld}: Freigabe`).toBe('OK');
      expect(await enabled(ctx, bot), `${feld}: aktiv vor der Änderung`).toBe(true);
      expect(await versuch(ctx, als(w.adminA), sql, [bot]), `${feld}: Bearbeiten bleibt möglich`).toBe('OK');
      const s = await status(ctx, bot);
      expect([s.approved, s.enabled], `${feld}: nicht freigegeben und pausiert`).toEqual([false, false]);
    }
    const log = await audit(ctx, bot, 'secretariat.approval_invalidated');
    expect(log.length).toBe(aenderungen.length);
    expect(log.every((r) => r.payload.paused === true && r.actor_user_id === w.adminA)).toBe(true);
  });

  it('Editor ändert einen aktiven Bot: pausiert (ohne #2178) oder RLS verwirft (mit #2178) — nie aktiv mit ungültiger Freigabe', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    expect(await freigeben(ctx, als(w.ownerA), bot, await hash(ctx, bot), true)).toBe('OK');
    expect(await versuch(ctx, als(w.editorA), `UPDATE public.bots SET persona = 'Editor' WHERE id = $1`, [bot])).toBe('OK');
    const s = await status(ctx, bot);
    expect([s.approved, s.enabled]).toEqual(await mitgliedSchreibt(ctx) ? [false, false] : [true, true]);
    expect(s.enabled && !s.approved).toBe(false);
  });

  it('Änderungen außerhalb des Hashes (description, config.secretariat.approval) lassen den Bot aktiv', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    expect(await freigeben(ctx, als(w.ownerA), bot, await hash(ctx, bot), true)).toBe('OK');
    expect(await versuch(ctx, als(w.adminA), `UPDATE public.bots SET description = 'neu' WHERE id = $1`, [bot])).toBe('OK');
    expect(await versuch(ctx, als(w.adminA),
      `UPDATE public.bots SET config = jsonb_set(config, '{secretariat,approval}', '{"x":1}') WHERE id = $1`, [bot])).toBe('OK');
    expect(await enabled(ctx, bot)).toBe(true);
  });

  it('Deaktivieren blockiert das Gate nie (Owner, service_role; Editor, soweit RLS ihn schreiben lässt)', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    const aus = 'UPDATE public.bots SET enabled = false WHERE id = $1';
    // Inhalt unverändert → die Freigabe gilt weiter, Owner darf wieder aktivieren.
    const an = () => versuch(ctx, als(w.ownerA), 'UPDATE public.bots SET enabled = true WHERE id = $1', [bot]);
    expect(await freigeben(ctx, als(w.ownerA), bot, await hash(ctx, bot), true)).toBe('OK');
    expect(await versuch(ctx, als(w.ownerA), aus, [bot])).toBe('OK');
    expect(await enabled(ctx, bot)).toBe(false);
    expect(await an()).toBe('OK');
    expect(await versuch(ctx, SERVER, aus, [bot])).toBe('OK');
    expect(await enabled(ctx, bot)).toBe(false);
    if (await mitgliedSchreibt(ctx)) {
      expect(await an()).toBe('OK');
      expect(await versuch(ctx, als(w.editorA), aus, [bot])).toBe('OK');
      expect(await enabled(ctx, bot)).toBe(false);
    }
  });

  it('Marker entfernen → verweigert (Owner und service_role)', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    expect(await versuch(ctx, als(w.ownerA), `UPDATE public.bots SET config = config - 'secretariat' WHERE id = $1`, [bot]))
      .toBe('42501:SECRETARIAT_MARKER_REMOVED');
    expect(await versuch(ctx, SERVER, `UPDATE public.bots SET config = '{}' WHERE id = $1`, [bot]))
      .toBe('42501:SECRETARIAT_MARKER_REMOVED');
  });

  it('tenant_id- oder id-Wechsel eines Sekretariats-Bots → verweigert', async () => {
    const bot = await botAnlegen(ctx, w.tenantA);
    expect(await versuch(ctx, SERVER, 'UPDATE public.bots SET tenant_id = $2 WHERE id = $1', [bot, w.tenantB]))
      .toBe('42501:SECRETARIAT_IDENTITY_CHANGED');
    expect(await versuch(ctx, als(w.ownerA), 'UPDATE public.bots SET tenant_id = $2 WHERE id = $1', [bot, w.tenantB]))
      .toBe('42501:SECRETARIAT_IDENTITY_CHANGED');
    expect(await versuch(ctx, SERVER, 'UPDATE public.bots SET id = gen_random_uuid() WHERE id = $1', [bot]))
      .toBe('42501:SECRETARIAT_IDENTITY_CHANGED');
  });

  it('Freigabe ist an bot_id gebunden: inhaltsgleicher zweiter Bot bleibt ungültig', async () => {
    const a = await botAnlegen(ctx, w.tenantA);
    const b = await botAnlegen(ctx, w.tenantA);
    expect(await freigeben(ctx, als(w.ownerA), a, await hash(ctx, a))).toBe('OK');
    expect(await hash(ctx, b)).not.toBe(await hash(ctx, a));
    expect((await status(ctx, b)).approved).toBe(false);
  });

  it('Regression: Nicht-Sekretariats-Bots verhalten sich wie bisher', async () => {
    // Owner/Admin dürfen in beiden Welten schreiben (mit und ohne #2178).
    expect(await versuch(ctx, als(w.adminA), `INSERT INTO public.bots (tenant_id, name) VALUES ($1, 'normal')`, [w.tenantA])).toBe('OK');
    const { rows } = await ctx.client.query<{ id: string; enabled: boolean }>(
      `SELECT id, enabled FROM public.bots WHERE tenant_id = $1 AND name = 'normal'`, [w.tenantA]);
    const bot = rows[0]!.id;
    expect(rows[0]!.enabled, 'Default enabled = true bleibt').toBe(true);
    const schreiber = await mitgliedSchreibt(ctx) ? w.editorA : w.adminA;
    expect(await versuch(ctx, als(schreiber), 'UPDATE public.bots SET enabled = false WHERE id = $1', [bot])).toBe('OK');
    expect(await enabled(ctx, bot)).toBe(false);
    expect(await versuch(ctx, als(schreiber), 'UPDATE public.bots SET enabled = true WHERE id = $1', [bot])).toBe('OK');
    expect(await enabled(ctx, bot), 'Aktivieren ohne Freigabe wie bisher').toBe(true);
    expect(await versuch(ctx, als(schreiber), `UPDATE public.bots SET persona = 'neu', greeting = 'x' WHERE id = $1`, [bot])).toBe('OK');
    expect(await enabled(ctx, bot)).toBe(true);
    expect(await versuch(ctx, SERVER, 'UPDATE public.bots SET tenant_id = $2 WHERE id = $1', [bot, w.tenantB])).toBe('OK');
    const s = await status(ctx, bot);
    expect([s.is_secretariat, s.approved, s.content_sha256]).toEqual([false, false, null]);
    const { rows: log } = await ctx.client.query(
      `SELECT 1 FROM public.governance_admin_log WHERE target_id = $1 AND action LIKE 'secretariat.%'`, [bot]);
    expect(log.length).toBe(0);
  });

  it('Marker an einem aktiven Nicht-Sekretariats-Bot ergänzen → verweigert', async () => {
    const bot = await botAnlegen(ctx, w.tenantA, { config: { vertical: 'general' }, enabled: true });
    expect(await versuch(ctx, als(w.ownerA), 'UPDATE public.bots SET config = $2::jsonb WHERE id = $1',
      [bot, JSON.stringify(sekretariatConfig())])).toBe('42501:SECRETARIAT_NOT_APPROVED');
  });

  it('fremder Owner: UPDATE trifft keine Zeile (RLS), nichts geändert', async () => {
    const bot = await botAnlegen(ctx, w.tenantA, { persona: 'original' });
    expect(await versuch(ctx, als(w.ownerB), `UPDATE public.bots SET persona = 'fremd', enabled = true WHERE id = $1`, [bot])).toBe('OK');
    const { rows } = await ctx.client.query<{ persona: string; enabled: boolean }>('SELECT persona, enabled FROM public.bots WHERE id = $1', [bot]);
    expect(rows[0]).toEqual({ persona: 'original', enabled: false });
  });

  it('pg_proc: search_path = \'\' überall, SECURITY DEFINER wo nötig, keine EXECUTE-Rechte für anon', async () => {
    const { rows } = await ctx.client.query<{ proname: string; secdef: boolean; cfg: string[] | null; anon: boolean; authn: boolean }>(
      `SELECT p.proname, p.prosecdef AS secdef, p.proconfig AS cfg,
              has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authn
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = ANY ($1::text[])
        ORDER BY p.proname`, [GATE_FUNKTIONEN]);
    expect(rows.map((r) => r.proname)).toEqual(GATE_FUNKTIONEN);
    for (const r of rows) {
      expect(r.cfg ?? [], `${r.proname}: search_path`).toContain('search_path=""');
      expect(r.anon, `${r.proname}: anon EXECUTE`).toBe(false);
    }
    const secdef = Object.fromEntries(rows.map((r) => [r.proname, r.secdef]));
    expect(secdef).toEqual({
      approve_secretariat_bot: true,
      bots_secretariat_gate: true,
      secretariat_bot_approvals_append_only: true,
      secretariat_bot_content_sha256: false,
      secretariat_bot_gate_status: true,
    });
    expect(rows.filter((r) => r.authn).map((r) => r.proname)).toEqual(['approve_secretariat_bot', 'secretariat_bot_gate_status']);

    const { rows: tab } = await ctx.client.query<{ ai: boolean; au: boolean; si: boolean; anon: boolean; sel: boolean }>(
      `SELECT has_table_privilege('authenticated', 'public.secretariat_bot_approvals', 'INSERT') AS ai,
              has_table_privilege('authenticated', 'public.secretariat_bot_approvals', 'UPDATE') AS au,
              has_table_privilege('service_role', 'public.secretariat_bot_approvals', 'INSERT') AS si,
              has_table_privilege('anon', 'public.secretariat_bot_approvals', 'SELECT') AS anon,
              has_table_privilege('authenticated', 'public.secretariat_bot_approvals', 'SELECT') AS sel`);
    expect(tab[0]).toEqual({ ai: false, au: false, si: false, anon: false, sel: true });
  });

  it('Trigger-Reihenfolge auf public.bots ist die dokumentierte', async () => {
    const { rows } = await ctx.client.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.bots'::regclass AND NOT tgisinternal ORDER BY tgname`);
    const namen = rows.map((r) => r.tgname);
    expect(namen).toContain('bots_secretariat_gate');
    expect(namen.indexOf('bots_enforce_quota')).toBeLessThan(namen.indexOf('bots_secretariat_gate'));
  });
});

d('KI-Sekretariat — Nebenläufigkeit von Änderung und Freigabe', () => {
  /**
   * Zwei echte Verbindungen mit festgeschriebenen Fixtures (Zeilensperren
   * wirken zwischen Transaktionen). Aufräumen im finally.
   */
  async function mitFixtures(fn: (f: { admin: Client; a: Client; b: Client; bot: string; owner: string; bearbeiter: string }) => Promise<void>) {
    const url = getDbUrl()!;
    const admin = new Client({ connectionString: url });
    const a = new Client({ connectionString: url });
    const b = new Client({ connectionString: url });
    await Promise.all([admin.connect(), a.connect(), b.connect()]);
    await admin.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ role: 'service_role' })]);
    const tag = Math.random().toString(36).slice(2, 8);
    let tenantId: string | null = null;
    const users: string[] = [];
    try {
      tenantId = (await admin.query<{ id: string }>('INSERT INTO public.tenants (name) VALUES ($1) RETURNING id', [`gate_race_${tag}`])).rows[0]!.id;
      // admin statt editor: schreibt mit und ohne #2178.
      for (const role of ['owner', 'admin']) {
        const uid = (await admin.query<{ id: string }>('INSERT INTO auth.users (email) VALUES ($1) RETURNING id', [`gate_race_${role}_${tag}@example.invalid`])).rows[0]!.id;
        users.push(uid);
        await admin.query('INSERT INTO public.memberships (tenant_id, user_id, role) VALUES ($1, $2, $3)', [tenantId, uid, role]);
      }
      await planEnterprise(admin, tenantId);
      const bot = (await admin.query<{ id: string }>(
        `INSERT INTO public.bots (tenant_id, name, config, enabled, persona) VALUES ($1, 'race', $2::jsonb, false, 'v1') RETURNING id`,
        [tenantId, JSON.stringify(sekretariatConfig())])).rows[0]!.id;
      await fn({ admin, a, b, bot, owner: users[0]!, bearbeiter: users[1]! });

      // Invariante: nie aktiv ohne gültige Freigabe.
      const { rows } = await admin.query<{ s: GateStatus }>('SELECT public.secretariat_bot_gate_status($1) AS s', [bot]);
      expect(rows[0]!.s.enabled && !rows[0]!.s.approved, 'aktiv mit ungültiger Freigabe').toBe(false);
    } finally {
      for (const c of [a, b]) { try { await c.query('ROLLBACK'); } catch { /* bereits beendet */ } }
      if (tenantId) {
        await admin.query('DELETE FROM public.bots WHERE tenant_id = $1', [tenantId]);
        await admin.query('DELETE FROM public.governance_admin_log WHERE tenant_id = $1', [tenantId]);
        await admin.query('DELETE FROM public.subscriptions WHERE tenant_id = $1', [tenantId]);
        await admin.query('DELETE FROM public.memberships WHERE tenant_id = $1', [tenantId]);
        await admin.query('DELETE FROM public.tenants WHERE id = $1', [tenantId]);
      }
      for (const u of users) await admin.query('DELETE FROM auth.users WHERE id = $1', [u]);
      await Promise.all([admin.end(), a.end(), b.end()]);
    }
  }

  async function claims(c: Client, sub: string): Promise<void> {
    await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role: 'authenticated' })]);
    await c.query('SET LOCAL ROLE authenticated');
  }

  it('Freigabe+Aktivierung hält die Sperre, Änderung wartet → danach pausiert', async () => {
    await mitFixtures(async ({ admin, a, b, bot, owner, bearbeiter }) => {
      const h = (await admin.query<{ s: GateStatus }>('SELECT public.secretariat_bot_gate_status($1) AS s', [bot])).rows[0]!.s.content_sha256;
      await a.query('BEGIN');
      await claims(a, owner);
      await a.query('SELECT public.approve_secretariat_bot($1, $2, true)', [bot, h]);

      await b.query('BEGIN');
      await claims(b, bearbeiter);
      const aenderung = b.query(`UPDATE public.bots SET persona = 'v2' WHERE id = $1`, [bot])
        .then(() => 'OK', (e: PgError) => e.code ?? e.message);
      await new Promise((r) => setTimeout(r, 300));
      await a.query('COMMIT');
      expect(await aenderung).toBe('OK');
      await b.query('COMMIT');

      const { rows } = await admin.query<{ s: GateStatus }>('SELECT public.secretariat_bot_gate_status($1) AS s', [bot]);
      expect([rows[0]!.s.enabled, rows[0]!.s.approved]).toEqual([false, false]);
    });
  });

  it('Änderung hält die Sperre, Freigabe mit altem Hash wartet → HASH_MISMATCH, keine Zeile', async () => {
    await mitFixtures(async ({ admin, a, b, bot, owner, bearbeiter }) => {
      const h = (await admin.query<{ s: GateStatus }>('SELECT public.secretariat_bot_gate_status($1) AS s', [bot])).rows[0]!.s.content_sha256;
      await b.query('BEGIN');
      await claims(b, bearbeiter);
      await b.query(`UPDATE public.bots SET persona = 'v2' WHERE id = $1`, [bot]);

      await a.query('BEGIN');
      await claims(a, owner);
      const freigabe = a.query('SELECT public.approve_secretariat_bot($1, $2, true)', [bot, h])
        .then(() => 'OK', (e: PgError) => `${e.code}:${e.detail}`);
      await new Promise((r) => setTimeout(r, 300));
      await b.query('COMMIT');
      expect(await freigabe).toBe('P0001:SECRETARIAT_HASH_MISMATCH');
      await a.query('ROLLBACK');

      const { rows } = await admin.query<{ n: string }>('SELECT count(*)::text AS n FROM public.secretariat_bot_approvals WHERE bot_id = $1', [bot]);
      expect(rows[0]!.n).toBe('0');
    });
  });
});
