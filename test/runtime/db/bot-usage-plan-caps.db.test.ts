/**
 * Bot-Kanäle: Eurodeckel und Tarifprofile auf Option A.
 *
 * Migration 20261028100000_bot_usage_plan_caps.sql (Blocker 2 aus PR #2044,
 * Owner-Entscheidung 28.10.2026). Option A selbst (ohne Zeile bzw. ohne
 * Telefonkontingent → 'invalid_config') prüft bot-usage-channel-limits.
 *
 * Abnahmekriterien
 *   P1  Beschlossene Werte: Starter 60 Min./8 €, Growth 250 Min./30 €,
 *       Agency 750 Min./90 €; kein Enterprise-Profil
 *   P2  Option A bleibt: ohne Zeile und mit Nullzeile weder KI noch Telefon
 *   P3  Minuten = Minimum aus Zeile und Entitlement; Enterprise nie unbegrenzt
 *   P4  Eurodeckel unabhängig vom Minutendeckel, kanalübergreifend,
 *       inkl. Telefonie und Fixkosten; Zeile ohne Eurodeckel erlaubt nichts
 *   P5  Anrufdauer so begrenzt, dass Telefonie + KI-Schätzung in den
 *       Restdeckel passen
 *   P6  Parallele KI- und Telefon-Reservierungen überschreiten den
 *       Eurodeckel nicht gemeinsam (gemeinsamer Lock)
 *   P7  Seed: Tarifwerte nur für aktive Abos mit Profil, sonst Nullzeile;
 *       bestehende Zeilen unverändert; idempotent; bucht nichts
 *   P8  Kosten je Gespräch nachvollziehbar (Sicht), mandantengetrennt
 *   P9  Rechte: neue Funktionen und Profile nur service_role
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { createTenantWithMember, closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

interface PgError extends Error { code?: string }
interface ReserveRow { decision: string; reservation_id: string | null; reserved_amount: string | null; reason: string | null }

const SERVER = { role: 'service_role' } as const;

function asServer<T>(ctx: DbCtx, fn: () => Promise<T>): Promise<T> {
  return ctx.withClaims(SERVER, fn);
}

async function sqlState(p: Promise<unknown>): Promise<string> {
  try { await p; return 'OK'; } catch (e) { return (e as PgError).code ?? (e as Error).message; }
}

async function row(ctx: DbCtx, tenantId: string): Promise<Record<string, string> | undefined> {
  return (await ctx.client.query(`SELECT * FROM public.bot_usage_limits WHERE tenant_id = $1`, [tenantId])).rows[0];
}

async function limits(ctx: DbCtx, tenantId: string, l: {
  minutes: number; eur: number; aiUsd?: number; maxCall?: number; concurrent?: number;
  voiceRate?: number; aiRate?: number; fixed?: number;
}): Promise<void> {
  await ctx.client.query(
    `INSERT INTO public.bot_usage_limits
       (tenant_id, ai_usd_daily, ai_usd_monthly, voice_seconds_monthly, cost_eur_monthly,
        voice_max_call_seconds, voice_max_concurrent_calls,
        voice_cost_usd_per_minute, ai_cost_usd_per_minute_estimate, fixed_cost_usd_monthly)
     VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [tenantId, l.aiUsd ?? 1000, l.minutes * 60, l.eur, l.maxCall ?? 600, l.concurrent ?? 10,
     l.voiceRate ?? 0.12, l.aiRate ?? 0.05, l.fixed ?? 0],
  );
}

async function reserveAi(ctx: DbCtx, tenantId: string, ref: string, usd: number, meta: Record<string, string> = {}): Promise<ReserveRow> {
  return asServer(ctx, async () => (await ctx.client.query<ReserveRow>(
    `SELECT * FROM public.bot_ai_budget_reserve($1, NULL, $2, $3, $4::jsonb)`,
    [tenantId, ref, usd, JSON.stringify({ channel: 'voice', ...meta })],
  )).rows[0]!);
}

async function reserveCall(ctx: DbCtx, tenantId: string, ref: string, planSeconds: number | null): Promise<ReserveRow> {
  return asServer(ctx, async () => (await ctx.client.query<ReserveRow>(
    `SELECT * FROM public.bot_voice_call_reserve($1, NULL, 'twilio', $2, $3)`, [tenantId, ref, planSeconds],
  )).rows[0]!);
}

async function settleCall(ctx: DbCtx, tenantId: string, ref: string, seconds: number): Promise<void> {
  await asServer(ctx, () => ctx.client.query(
    `SELECT * FROM public.bot_usage_settle_by_ref($1, 'voice_seconds', 'twilio', $2, $3, $4, '{}')`,
    [tenantId, ref, seconds, `twilio:${ref}:terminal`],
  ));
}

async function settleAi(ctx: DbCtx, reservationId: string, usd: number): Promise<void> {
  await asServer(ctx, () => ctx.client.query(
    `SELECT * FROM public.bot_usage_settle($1, 'measured', $2, NULL, '{}')`, [reservationId, usd],
  ));
}

async function costUsed(ctx: DbCtx, tenantId: string): Promise<number> {
  return asServer(ctx, async () => Number((await ctx.client.query<{ v: string }>(
    `SELECT public.bot_usage_cost_eur_used($1, date_trunc('month', now())) AS v`, [tenantId],
  )).rows[0]!.v));
}

d('P1 — beschlossene Tarifwerte', () => {
  let ctx: DbCtx;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); });

  it('Starter 60/8, Growth 250/30, Agency 750/90; Enterprise nicht als Profil', async () => {
    const rows = (await ctx.client.query<{ plan_key: string; voice_minutes_monthly: number; cost_eur_monthly: string }>(
      `SELECT plan_key, voice_minutes_monthly, cost_eur_monthly FROM public.bot_usage_plan_profiles ORDER BY plan_key`,
    )).rows.map((r) => [r.plan_key, r.voice_minutes_monthly, Number(r.cost_eur_monthly)]);
    expect(rows).toEqual([['agency', 750, 90], ['growth', 250, 30], ['starter', 60, 8]]);
    expect(await sqlState(ctx.client.query(
      `INSERT INTO public.bot_usage_plan_profiles (plan_key, voice_minutes_monthly, cost_eur_monthly, decided_at, decided_by)
       VALUES ('enterprise', 1, 1, now(), 'x')`,
    ))).toBe('23514');
  });

  it('apply_plan_profile: Tarifwerte in Sekunden, Nullzeile bei NULL, Enterprise nur explizit', async () => {
    const t = (await createTenantWithMember(ctx)).tenantId;
    await asServer(ctx, () => ctx.client.query(`SELECT public.bot_usage_apply_plan_profile($1, 'growth', 'test')`, [t]));
    let r = (await row(ctx, t))!;
    expect(Number(r.voice_seconds_monthly)).toBe(250 * 60);
    expect(Number(r.cost_eur_monthly)).toBe(30);
    expect(Number(r.ai_usd_monthly)).toBe(30);
    expect(r.plan_profile).toBe('growth');

    await asServer(ctx, () => ctx.client.query(`SELECT public.bot_usage_apply_plan_profile($1, NULL, 'test-downgrade')`, [t]));
    r = (await row(ctx, t))!;
    expect(Number(r.voice_seconds_monthly)).toBe(0);
    expect(Number(r.cost_eur_monthly)).toBe(0);
    expect(Number(r.ai_usd_monthly)).toBe(0);

    expect(await sqlState(asServer(ctx, () => ctx.client.query(
      `SELECT public.bot_usage_apply_plan_profile($1, 'enterprise', 'test')`, [t],
    )))).toBe('22023');
  });
});

d('P2/P3 — Option A und Minuten', () => {
  let ctx: DbCtx;
  let tenant: string;
  beforeEach(async () => { ctx = await openDb(); tenant = (await createTenantWithMember(ctx)).tenantId; });
  afterEach(async () => { await closeDb(ctx); });

  it('P2: ohne Zeile weder KI noch Telefon — auch bei Entitlement ohne Monatsgrenze', async () => {
    const ai = await reserveAi(ctx, tenant, 'p2-ai', 0.001);
    expect([ai.decision, ai.reason]).toEqual(['deny', 'invalid_config']);
    const call = await reserveCall(ctx, tenant, 'CA-p2', null);
    expect([call.decision, call.reason]).toEqual(['deny', 'invalid_config']);
  });

  it('P2: Nullzeile (Seed für free/Testphase) lehnt beides ab', async () => {
    await limits(ctx, tenant, { minutes: 0, eur: 0, aiUsd: 0 });
    expect((await reserveAi(ctx, tenant, 'p2z-ai', 0.001)).decision).toBe('deny');
    const call = await reserveCall(ctx, tenant, 'CA-p2z', null);
    expect([call.decision, call.reason]).toEqual(['deny', 'invalid_config']);
  });

  it('P3: Minimum aus Zeile (60 Min.) und Entitlement; Entitlement 0 → keine Minuten', async () => {
    await limits(ctx, tenant, { minutes: 60, eur: 1000, maxCall: 600 });
    // Entitlement 500 Min. (Agency-Wert) > Zeile 60 Min. → Zeile begrenzt.
    for (let i = 0; i < 6; i++) {
      const r = await reserveCall(ctx, tenant, `CA-m${i}`, 500 * 60);
      expect(r.decision, `call ${i}`).toBe('allow');
      expect(Number(r.reserved_amount)).toBe(600);
      await settleCall(ctx, tenant, `CA-m${i}`, 600);
    }
    const over = await reserveCall(ctx, tenant, 'CA-m6', 500 * 60);
    expect([over.decision, over.reason]).toEqual(['deny', 'monthly_budget']);

    const t2 = (await createTenantWithMember(ctx)).tenantId;
    await limits(ctx, t2, { minutes: 750, eur: 1000 });
    expect((await reserveCall(ctx, t2, 'CA-ent0', 0)).decision).toBe('deny');
    // Entitlement 2 Min. < Zeile 750 Min. → Entitlement begrenzt.
    const small = await reserveCall(ctx, t2, 'CA-ent2', 120);
    expect(Number(small.reserved_amount)).toBe(120);
  });

  it('P3: Enterprise (-1 → NULL) ist mit Zeile begrenzt, nie unbegrenzt', async () => {
    await limits(ctx, tenant, { minutes: 2, eur: 1000, maxCall: 600 });
    const r = await reserveCall(ctx, tenant, 'CA-ent', null);
    expect(r.decision).toBe('allow');
    expect(Number(r.reserved_amount)).toBe(120);
    const second = await reserveCall(ctx, tenant, 'CA-ent-2', null);
    expect([second.decision, second.reason]).toEqual(['deny', 'monthly_budget']);
  });
});

d('P4/P5 — Eurodeckel', () => {
  let ctx: DbCtx;
  let tenant: string;
  beforeEach(async () => { ctx = await openDb(); tenant = (await createTenantWithMember(ctx)).tenantId; });
  afterEach(async () => { await closeDb(ctx); });

  it('P4: Zeile ohne Eurodeckel (Default 0) erlaubt weder KI noch Telefon', async () => {
    await ctx.client.query(
      `INSERT INTO public.bot_usage_limits (tenant_id, ai_usd_daily, ai_usd_monthly, voice_seconds_monthly)
       VALUES ($1, 100, 100, 100000)`, [tenant],
    );
    const ai = await reserveAi(ctx, tenant, 'p4-zero', 0.01);
    expect([ai.decision, ai.reason]).toEqual(['deny', 'cost_budget']);
    const call = await reserveCall(ctx, tenant, 'CA-p4-zero', null);
    expect([call.decision, call.reason]).toEqual(['deny', 'cost_budget']);
  });

  it('P4: KI stoppt am Eurodeckel unabhängig von großen USD- und Minutengrenzen; Fixkosten zählen', async () => {
    await limits(ctx, tenant, { minutes: 1000, eur: 1, aiUsd: 1000, fixed: 0.2 });
    expect(await costUsed(ctx, tenant)).toBeCloseTo(0.2);
    expect((await reserveAi(ctx, tenant, 'e1', 0.3)).decision).toBe('allow');
    expect((await reserveAi(ctx, tenant, 'e2', 0.3)).decision).toBe('allow');
    const third = await reserveAi(ctx, tenant, 'e3', 0.3); // 0.2 + 0.6 + 0.3 > 1
    expect([third.decision, third.reason]).toEqual(['deny', 'cost_budget']);
    expect((await reserveAi(ctx, tenant, 'e4', 0.19)).decision).toBe('allow');
  });

  it('P4: Telefonie verbraucht den Eurodeckel; danach lehnt die KI ab (auch im Chat)', async () => {
    await limits(ctx, tenant, { minutes: 1000, eur: 1.2, voiceRate: 0.12, aiRate: 0 });
    const c = await reserveCall(ctx, tenant, 'CA-e', null);
    expect(c.decision).toBe('allow');
    await settleCall(ctx, tenant, 'CA-e', 540); // 9 Min. × 0,12 = 1,08 €
    expect(await costUsed(ctx, tenant)).toBeCloseTo(1.08);
    const chat = await asServer(ctx, async () => (await ctx.client.query<ReserveRow>(
      `SELECT * FROM public.bot_ai_budget_reserve($1, NULL, 'chat-e', 0.2, '{"channel":"chat"}')`, [tenant],
    )).rows[0]!);
    expect([chat.decision, chat.reason]).toEqual(['deny', 'cost_budget']);
  });

  it('P5: Anrufdauer = Restdeckel zum Satz Telefonie + KI-Schätzung; < 60 s → Ablehnung', async () => {
    // 8 € (Starter), Fix 1,35 → 6,65 € frei; Satz 0,17 €/Min. → 2347 s.
    await limits(ctx, tenant, { minutes: 1000, eur: 8, fixed: 1.35, maxCall: 3600 });
    const r = await reserveCall(ctx, tenant, 'CA-p5', null);
    expect(r.decision).toBe('allow');
    expect(Number(r.reserved_amount)).toBe(2347);
    // Offene Reservierung zählt nur Telefonie: 2347/60 × 0,12 = 4,694 €.
    expect(await costUsed(ctx, tenant)).toBeCloseTo(1.35 + 2347 / 60 * 0.12, 3);
    // Rest 1,956 € → 690 s für einen zweiten Anruf.
    const r2 = await reserveCall(ctx, tenant, 'CA-p5-2', null);
    expect(Number(r2.reserved_amount)).toBe(690);
    // KI im ersten Gespräch hat noch Raum (die Schätzung ist nicht reserviert).
    expect((await reserveAi(ctx, tenant, 'p5-ai', 0.05, { call_ref: 'CA-p5' })).decision).toBe('allow');
    const t2 = (await createTenantWithMember(ctx)).tenantId;
    await limits(ctx, t2, { minutes: 1000, eur: 0.1 });
    const tiny = await reserveCall(ctx, t2, 'CA-tiny', null);
    expect([tiny.decision, tiny.reason]).toEqual(['deny', 'cost_budget']);
  });
});

d('P7 — Seed', () => {
  let ctx: DbCtx;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); });

  async function tenantWith(plan: string, status: string): Promise<string> {
    const t = (await createTenantWithMember(ctx)).tenantId;
    // Der Tenant-Trigger legt bereits ein free_tier-Abo an (UNIQUE tenant_id).
    await ctx.client.query(
      `UPDATE public.subscriptions SET plan_key = $2, status = $3, updated_at = now() WHERE tenant_id = $1`,
      [t, plan, status],
    );
    return t;
  }

  it('Tarifwerte nur für aktive Abos mit Profil; sonst Nullzeile; Bestand unverändert; idempotent', async () => {
    const starter = await tenantWith('starter', 'active');
    const agency = await tenantWith('agency', 'active');
    const trial = await tenantWith('growth', 'trialing');
    const canceled = await tenantWith('growth', 'canceled');
    const free = await tenantWith('free_audit', 'active');
    const enterprise = await tenantWith('enterprise', 'active');
    const configured = await tenantWith('growth', 'active');
    await limits(ctx, configured, { minutes: 5, eur: 2 });

    const n = await asServer(ctx, async () => Number((await ctx.client.query(
      `SELECT public.bot_usage_seed_missing_limits('test-seed') AS n`,
    )).rows[0].n));
    expect(n).toBeGreaterThanOrEqual(6);

    const s = (await row(ctx, starter))!;
    expect([Number(s.voice_seconds_monthly), Number(s.cost_eur_monthly), s.plan_profile]).toEqual([3600, 8, 'starter']);
    expect(s.config_source).toBe('test-seed:starter:active');
    const a = (await row(ctx, agency))!;
    expect([Number(a.voice_seconds_monthly), Number(a.cost_eur_monthly)]).toEqual([45000, 90]);
    for (const t of [trial, canceled, free, enterprise]) {
      const z = (await row(ctx, t))!;
      expect([Number(z.voice_seconds_monthly), Number(z.cost_eur_monthly), Number(z.ai_usd_monthly)], t).toEqual([0, 0, 0]);
    }
    const c = (await row(ctx, configured))!;
    expect([Number(c.voice_seconds_monthly), Number(c.cost_eur_monthly)]).toEqual([300, 2]);

    const again = await asServer(ctx, async () => Number((await ctx.client.query(
      `SELECT public.bot_usage_seed_missing_limits('test-seed-2') AS n`,
    )).rows[0].n));
    expect(again).toBe(0);
    const ledger = await ctx.client.query(
      `SELECT count(*)::int AS n FROM public.bot_usage_ledger WHERE tenant_id = ANY($1::uuid[])`,
      [[starter, agency, trial, canceled, free, enterprise]],
    );
    expect(ledger.rows[0].n).toBe(0);
  });
});

d('P8/P9 — Kosten je Gespräch und Rechte', () => {
  let ctx: DbCtx;
  let a: { tenantId: string; userId: string };
  let b: { tenantId: string; userId: string };
  beforeEach(async () => {
    ctx = await openDb();
    a = await createTenantWithMember(ctx);
    b = await createTenantWithMember(ctx);
    for (const t of [a.tenantId, b.tenantId]) await limits(ctx, t, { minutes: 100, eur: 100 });
  });
  afterEach(async () => { await closeDb(ctx); });

  it('P8: Sekunden, Telefonie zum Satz der Reservierung, gemessene KI des Gesprächs', async () => {
    expect((await reserveCall(ctx, a.tenantId, 'CA-cost', null)).decision).toBe('allow');
    const ai1 = await reserveAi(ctx, a.tenantId, 'cost-1', 0.05, { call_ref: 'CA-cost' });
    const ai2 = await reserveAi(ctx, a.tenantId, 'cost-2', 0.05, { call_ref: 'CA-cost' });
    const other = await reserveAi(ctx, a.tenantId, 'cost-x', 0.05, { call_ref: 'CA-other' });
    await settleAi(ctx, ai1.reservation_id!, 0.011);
    await settleAi(ctx, ai2.reservation_id!, 0.009);
    await settleAi(ctx, other.reservation_id!, 0.04);
    await settleCall(ctx, a.tenantId, 'CA-cost', 90);

    // Spätere Satzänderung verändert die Kosten des abgeschlossenen Gesprächs nicht.
    await ctx.client.query(`UPDATE public.bot_usage_limits SET voice_cost_usd_per_minute = 1 WHERE tenant_id = $1`, [a.tenantId]);

    const r = (await ctx.client.query(
      `SELECT seconds, seconds_origin, telephony_usd_estimated, ai_usd, total_eur_estimated
         FROM public.bot_voice_call_costs WHERE call_ref = 'CA-cost'`,
    )).rows[0];
    expect(Number(r.seconds)).toBe(90);
    expect(r.seconds_origin).toBe('measured');
    expect(Number(r.telephony_usd_estimated)).toBeCloseTo(0.18);
    expect(Number(r.ai_usd)).toBeCloseTo(0.02);
    expect(Number(r.total_eur_estimated)).toBeCloseTo(0.2);
  });

  it('P8: Mitglied sieht nur die Gespräche des eigenen Mandanten', async () => {
    await reserveCall(ctx, a.tenantId, 'CA-a', null);
    await reserveCall(ctx, b.tenantId, 'CA-b', null);
    await ctx.withClaims({ sub: a.userId, role: 'authenticated' }, async () => {
      const refs = (await ctx.client.query(`SELECT call_ref FROM public.bot_voice_call_costs`)).rows.map((x) => x.call_ref);
      expect(refs).toContain('CA-a');
      expect(refs).not.toContain('CA-b');
    });
  });

  it('P9: authenticated darf weder Profile lesen noch Profile anwenden, seeden oder Kosten abfragen', async () => {
    const asUser = (sql: string, params: unknown[] = []) =>
      sqlState(ctx.withClaims({ sub: a.userId, role: 'authenticated' }, () => ctx.client.query(sql, params)));
    expect(await asUser(`SELECT * FROM public.bot_usage_plan_profiles`)).toBe('42501');
    expect(await asUser(`SELECT public.bot_usage_apply_plan_profile($1, 'agency', 'evil')`, [a.tenantId])).toBe('42501');
    expect(await asUser(`SELECT public.bot_usage_seed_missing_limits('evil')`)).toBe('42501');
    expect(await asUser(`SELECT public.bot_usage_cost_eur_used($1, now())`, [a.tenantId])).toBe('42501');
    expect(await asUser(
      `UPDATE public.bot_usage_limits SET cost_eur_monthly = 99999 WHERE tenant_id = $1`, [a.tenantId],
    )).toBe('42501');
  });
});

d('P6 — parallele KI- und Telefon-Reservierungen am Eurodeckel', () => {
  /**
   * Echte Verbindungen und festgeschriebene Fixtures — der Advisory-Lock
   * wirkt zwischen Transaktionen. Aufräumen über die Mandantenlöschung.
   */
  it('30 KI à 0,10 € und 10 Anrufe parallel bei 2,00 € → Summe der Reservierungen ≤ Deckel', async () => {
    const url = getDbUrl()!;
    const admin = new Client({ connectionString: url });
    await admin.connect();
    const claims = JSON.stringify({ role: 'service_role' });
    await admin.query(`SELECT set_config('request.jwt.claims', $1, false)`, [claims]);
    const tid = (await admin.query<{ id: string }>(
      `INSERT INTO public.tenants (name) VALUES ($1) RETURNING id`, [`cost_race_${Date.now()}`],
    )).rows[0]!.id;
    const workers: Client[] = [];
    try {
      // Satz 0,12 €/Min. Telefonie, KI-Schätzung 0 → ein Anruf reserviert
      // höchstens 600 s = 1,20 €.
      await admin.query(
        `INSERT INTO public.bot_usage_limits
           (tenant_id, ai_usd_daily, ai_usd_monthly, voice_seconds_monthly, cost_eur_monthly,
            voice_max_call_seconds, voice_max_concurrent_calls, voice_cost_usd_per_minute,
            ai_cost_usd_per_minute_estimate)
         VALUES ($1, 100, 100, 60000, 2.00, 600, 20, 0.12, 0)`, [tid],
      );
      for (let i = 0; i < 40; i++) {
        const c = new Client({ connectionString: url });
        await c.connect();
        await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [claims]);
        workers.push(c);
      }
      await Promise.all(workers.map((c, i) => (i < 30
        ? c.query(`SELECT decision FROM public.bot_ai_budget_reserve($1, NULL, $2, 0.10, '{"channel":"voice"}')`, [tid, `cr-${i}`])
        : c.query(`SELECT decision FROM public.bot_voice_call_reserve($1, NULL, 'twilio', $2, NULL)`, [tid, `CAcr-${i}`]))));
      const total = await admin.query<{ v: string }>(
        `SELECT public.bot_usage_cost_eur_used($1, date_trunc('month', now())) AS v`, [tid],
      );
      expect(Number(total.rows[0]!.v)).toBeLessThanOrEqual(2.0 + 1e-9);
      const n = await admin.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM public.bot_usage_reservations WHERE tenant_id = $1`, [tid],
      );
      expect(n.rows[0]!.n).toBeGreaterThan(0);
    } finally {
      await Promise.all(workers.map((c) => c.end()));
      await admin.query(`DELETE FROM public.tenants WHERE id = $1`, [tid]);
      await admin.end();
    }
  });
});
