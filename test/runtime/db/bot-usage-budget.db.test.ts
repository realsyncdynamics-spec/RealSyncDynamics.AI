/**
 * Bot-Kanäle: Budget-Reservierung, Telefon-Kontingent, Rate-Limit (PR A).
 *
 * Migration 20261027120000_bot_usage_budget_hardening.sql. Alles, worauf es
 * ankommt — Advisory-Lock, Unique-Indizes, append-only-Trigger, RLS,
 * SECURITY DEFINER, Rechte — ist SQL und nur gegen echtes Postgres prüfbar.
 *
 * Abnahmekriterien (K-Nummern wie im PR):
 *   K1  Anrufbeginn reserviert atomar, inkl. Obergrenze paralleler Anrufe
 *   K2  Wiederholte Webhooks buchen nicht doppelt (Unique-Constraint)
 *   K3  Fehlender Abschluss: Aufräumjob rechnet als 'estimated' ab
 *   K5  Kontingent erschöpft → Ablehnung (vor Annahme)
 *   K6  Höchstbetrag atomar reservieren, gemessen abrechnen, Unklares schätzen
 *   K7  Parallele Anfragen am Budgetrand überschreiten den harten Stopp nicht
 *   K8  Rate-Limit-Zähler je Schlüssel
 *   K10 Mandantentrennung und Rechte
 *   K11 Herkunft measured|estimated|corrected, Differenzkorrektur, Abrechnungssicht
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { createTenantWithMember, closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

interface PgError extends Error { code?: string }
const SERVER = { role: 'service_role' } as const;

interface ReserveRow {
  decision: string;
  reservation_id: string | null;
  reserved_amount: string | null;
  reason: string | null;
}

async function asServer<T>(ctx: DbCtx, fn: () => Promise<T>): Promise<T> {
  return ctx.withClaims(SERVER, fn);
}

// Großes Mandantenkontingent: In diesen Tests begrenzt das Planlimit
// (p_plan_seconds_monthly). Wo das Mandantenkontingent selbst geprüft wird,
// setzt der Test voiceMonthly ausdrücklich.
const LARGE_VOICE_SECONDS = 10_000_000;

async function setLimits(ctx: DbCtx, tenantId: string, l: {
  aiDaily: number; aiMonthly: number; concurrent: number; maxCall: number; voiceMonthly?: number;
}): Promise<void> {
  await ctx.client.query(
    `INSERT INTO public.bot_usage_limits
       (tenant_id, ai_usd_daily, ai_usd_monthly, voice_max_concurrent_calls, voice_max_call_seconds, voice_seconds_monthly)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (tenant_id) DO UPDATE SET ai_usd_daily = EXCLUDED.ai_usd_daily,
       ai_usd_monthly = EXCLUDED.ai_usd_monthly,
       voice_max_concurrent_calls = EXCLUDED.voice_max_concurrent_calls,
       voice_max_call_seconds = EXCLUDED.voice_max_call_seconds,
       voice_seconds_monthly = EXCLUDED.voice_seconds_monthly`,
    [tenantId, l.aiDaily, l.aiMonthly, l.concurrent, l.maxCall, l.voiceMonthly ?? LARGE_VOICE_SECONDS],
  );
}

async function reserveAi(ctx: DbCtx, tenantId: string, ref: string, usd: number): Promise<ReserveRow> {
  return asServer(ctx, async () => (await ctx.client.query<ReserveRow>(
    `SELECT * FROM public.bot_ai_budget_reserve($1, NULL, $2, $3, '{"channel":"chat"}')`, [tenantId, ref, usd],
  )).rows[0]!);
}

async function reserveCall(ctx: DbCtx, tenantId: string, ref: string, planSeconds: number | null): Promise<ReserveRow> {
  return asServer(ctx, async () => (await ctx.client.query<ReserveRow>(
    `SELECT * FROM public.bot_voice_call_reserve($1, NULL, 'twilio', $2, $3)`, [tenantId, ref, planSeconds],
  )).rows[0]!);
}

async function used(ctx: DbCtx, tenantId: string, resource: string, since: 'day' | 'month'): Promise<number> {
  return asServer(ctx, async () => Number((await ctx.client.query<{ v: string }>(
    `SELECT public.bot_usage_used($1, $2, date_trunc($3, now())) AS v`, [tenantId, resource, since],
  )).rows[0]!.v));
}

async function sqlState(p: Promise<unknown>): Promise<string> {
  try { await p; return 'OK'; } catch (e) { return (e as PgError).code ?? (e as Error).message; }
}

d('bot_usage — KI-Budget (K6, K11)', () => {
  let ctx: DbCtx;
  let tenantA: string;
  let tenantB: string;

  beforeEach(async () => {
    ctx = await openDb();
    tenantA = (await createTenantWithMember(ctx)).tenantId;
    tenantB = (await createTenantWithMember(ctx)).tenantId;
    await setLimits(ctx, tenantA, { aiDaily: 1, aiMonthly: 2, concurrent: 2, maxCall: 300 });
    await setLimits(ctx, tenantB, { aiDaily: 5, aiMonthly: 50, concurrent: 2, maxCall: 600 });
  });
  afterEach(async () => { await closeDb(ctx); });

  it('K6: offene Reservierung zählt, Abrechnung ersetzt sie durch den gemessenen Wert', async () => {
    const r = await reserveAi(ctx, tenantA, 'req-1', 0.4);
    expect(r.decision).toBe('allow');
    expect(await used(ctx, tenantA, 'ai_usd', 'day')).toBeCloseTo(0.4);

    const s = await asServer(ctx, async () => (await ctx.client.query(
      `SELECT * FROM public.bot_usage_settle($1, 'measured', 0.05, NULL, '{}')`, [r.reservation_id],
    )).rows[0]);
    expect(s.duplicate).toBe(false);
    expect(await used(ctx, tenantA, 'ai_usd', 'day')).toBeCloseTo(0.05);
  });

  it('K6: harter Stopp am Tagesbudget inkl. offener Reservierungen; anderer Mandant unberührt', async () => {
    expect((await reserveAi(ctx, tenantA, 'a', 0.5)).decision).toBe('allow');
    expect((await reserveAi(ctx, tenantA, 'b', 0.5)).decision).toBe('allow');
    const denied = await reserveAi(ctx, tenantA, 'c', 0.01);
    expect(denied.decision).toBe('deny');
    expect(denied.reason).toBe('daily_budget');
    // Mandant B mit eigener Konfiguration ist vom Stopp bei A nicht betroffen.
    expect((await reserveAi(ctx, tenantB, 'c', 0.5)).decision).toBe('allow');
  });

  it('K2: zweites Abrechnen derselben Reservierung bucht nicht doppelt', async () => {
    const r = await reserveAi(ctx, tenantA, 'dup', 0.2);
    const settle = () => asServer(ctx, async () => (await ctx.client.query(
      `SELECT * FROM public.bot_usage_settle($1, 'measured', 0.1, NULL, '{}')`, [r.reservation_id],
    )).rows[0]);
    expect((await settle()).duplicate).toBe(false);
    expect((await settle()).duplicate).toBe(true);
    const n = await ctx.client.query(`SELECT count(*)::int AS n FROM public.bot_usage_ledger WHERE reservation_id = $1`, [r.reservation_id]);
    expect(n.rows[0].n).toBe(1);
  });

  it('K6: unklarer Verbrauch = reservierter Höchstbetrag als estimated; Freigabe nur explizit', async () => {
    const r = await reserveAi(ctx, tenantA, 'timeout', 0.5);
    const s = await asServer(ctx, async () => (await ctx.client.query(
      `SELECT * FROM public.bot_usage_settle($1, 'estimated', 0.01, NULL, '{"reason":"timeout"}')`, [r.reservation_id],
    )).rows[0]);
    expect(Number(s.amount)).toBeCloseTo(0.5);

    const r2 = await reserveAi(ctx, tenantA, 'not-sent', 0.3);
    const released = await asServer(ctx, async () => (await ctx.client.query(
      `SELECT public.bot_usage_release($1, 'not_sent:PROVIDER_NOT_CONFIGURED') AS ok`, [r2.reservation_id],
    )).rows[0].ok);
    expect(released).toBe(true);
    const n = await ctx.client.query(`SELECT count(*)::int AS n FROM public.bot_usage_ledger WHERE reservation_id = $1`, [r2.reservation_id]);
    expect(n.rows[0].n).toBe(0);
    expect(await sqlState(asServer(ctx, () => ctx.client.query(
      `SELECT * FROM public.bot_usage_settle($1, 'measured', 0.1, NULL, '{}')`, [r2.reservation_id],
    )))).toBe('55000');
  });

  it('K3: Aufräumjob schließt abgelaufene Reservierungen als estimated', async () => {
    const r = await reserveAi(ctx, tenantB, 'expire', 0.3);
    await ctx.client.query(`UPDATE public.bot_usage_reservations SET expires_at = now() - interval '1 second' WHERE id = $1`, [r.reservation_id]);
    const n = await asServer(ctx, async () => (await ctx.client.query(`SELECT public.bot_usage_sweep_expired() AS n`)).rows[0].n);
    expect(n).toBeGreaterThanOrEqual(1);
    const row = (await ctx.client.query(
      `SELECT origin, amount FROM public.bot_usage_ledger WHERE reservation_id = $1`, [r.reservation_id],
    )).rows[0];
    expect(row.origin).toBe('estimated');
    expect(Number(row.amount)).toBeCloseTo(0.3);
  });

  it('K11: Korrektur als Differenzbuchung; Abrechnungssicht zählt jede Kette genau einmal', async () => {
    const r = await reserveAi(ctx, tenantB, 'corr', 0.3);
    const est = await asServer(ctx, async () => (await ctx.client.query(
      `SELECT ledger_id FROM public.bot_usage_settle($1, 'estimated', NULL, NULL, '{}')`, [r.reservation_id],
    )).rows[0].ledger_id);

    const billable = async () => (await ctx.client.query(
      `SELECT billable_amount FROM public.bot_usage_billable WHERE entry_id = $1`, [est],
    )).rows;
    expect(await billable()).toHaveLength(0); // unkorrigierte Schätzung nicht abrechnungsrelevant

    const corr = await asServer(ctx, async () => (await ctx.client.query(
      `SELECT public.bot_usage_correct($1, 0.12, '{"source":"provider_usage_export"}') AS id`, [est],
    )).rows[0].id);
    const c = (await ctx.client.query(`SELECT amount, usage_at FROM public.bot_usage_ledger WHERE id = $1`, [corr])).rows[0];
    expect(Number(c.amount)).toBeCloseTo(-0.18);

    const rows = await billable();
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].billable_amount)).toBeCloseTo(0.12);
    expect(await used(ctx, tenantB, 'ai_usd', 'month')).toBeCloseTo(0.12);

    expect(await sqlState(asServer(ctx, () => ctx.client.query(
      `SELECT public.bot_usage_correct($1, 0.10, '{"source":"again"}')`, [est],
    )))).toBe('23505');
    expect(await sqlState(asServer(ctx, () => ctx.client.query(
      `SELECT public.bot_usage_correct($1, 0.10, '{"source":"x"}')`, [corr],
    )))).toBe('55000');
    expect(await sqlState(asServer(ctx, () => ctx.client.query(
      `SELECT public.bot_usage_correct($1, 0.10, '{}')`, [est],
    )))).toBe('22023');
  });

  it('K11: Ledger ist append-only; Löschung nur über die Mandantenlöschung', async () => {
    const r = await reserveAi(ctx, tenantB, 'ao', 0.1);
    await asServer(ctx, () => ctx.client.query(
      `SELECT * FROM public.bot_usage_settle($1, 'measured', 0.1, NULL, '{}')`, [r.reservation_id],
    ));
    await ctx.client.query('SAVEPOINT ao');
    expect(await sqlState(ctx.client.query(`UPDATE public.bot_usage_ledger SET amount = 0 WHERE tenant_id = $1`, [tenantB]))).toBe('42501');
    await ctx.client.query('ROLLBACK TO SAVEPOINT ao');
    expect(await sqlState(ctx.client.query(`DELETE FROM public.bot_usage_ledger WHERE tenant_id = $1`, [tenantB]))).toBe('42501');
    await ctx.client.query('ROLLBACK TO SAVEPOINT ao');
    expect(await sqlState(ctx.client.query(`DELETE FROM public.tenants WHERE id = $1`, [tenantB]))).toBe('OK');
  });
});

d('bot_usage — Telefon (K1, K2, K5)', () => {
  let ctx: DbCtx;
  let tenant: string;

  beforeEach(async () => {
    ctx = await openDb();
    tenant = (await createTenantWithMember(ctx)).tenantId;
    await setLimits(ctx, tenant, { aiDaily: 1, aiMonthly: 2, concurrent: 2, maxCall: 300 });
  });
  afterEach(async () => { await closeDb(ctx); });

  it('K1/K2/K5: Reservierung, Parallelität, Idempotenz, Restkontingent, Ablehnung', async () => {
    const a = await reserveCall(ctx, tenant, 'CA-1', 600);
    expect(a.decision).toBe('allow');
    expect(Number(a.reserved_amount)).toBe(300);

    const again = await reserveCall(ctx, tenant, 'CA-1', 600);
    expect(again.decision).toBe('existing');

    expect((await reserveCall(ctx, tenant, 'CA-2', 600)).decision).toBe('allow');
    const third = await reserveCall(ctx, tenant, 'CA-3', 6000);
    expect(third.decision).toBe('deny');
    expect(third.reason).toBe('concurrency');

    const settle = () => asServer(ctx, async () => (await ctx.client.query(
      `SELECT * FROM public.bot_usage_settle_by_ref($1, 'voice_seconds', 'twilio', 'CA-1', 61,
         'twilio:CA-1:terminal', '{"CallDuration":61}')`, [tenant],
    )).rows[0]);
    expect((await settle()).duplicate).toBe(false);
    expect((await settle()).duplicate).toBe(true);

    // 600 − 61 (gebucht) − 300 (CA-2 offen) = 239 s Rest
    const rest = await reserveCall(ctx, tenant, 'CA-4', 600);
    expect(rest.decision).toBe('allow');
    expect(Number(rest.reserved_amount)).toBe(239);

    const exhausted = await reserveCall(ctx, tenant, 'CA-5', 600);
    expect(exhausted.decision).toBe('deny');
    expect(exhausted.reason).toBe('monthly_budget');
  });

  it('K2: Unique-Constraints halten auch an den Funktionen vorbei', async () => {
    await reserveCall(ctx, tenant, 'CA-u', 600);
    await asServer(ctx, () => ctx.client.query(
      `SELECT * FROM public.bot_usage_settle_by_ref($1, 'voice_seconds', 'twilio', 'CA-u', 30, 'twilio:CA-u:terminal', '{}')`, [tenant],
    ));
    await ctx.client.query('SAVEPOINT u');
    expect(await sqlState(ctx.client.query(
      `INSERT INTO public.bot_usage_ledger (tenant_id, resource, origin, amount, event_key)
       VALUES ($1, 'voice_seconds', 'measured', 30, 'twilio:CA-u:terminal')`, [tenant],
    ))).toBe('23505');
    await ctx.client.query('ROLLBACK TO SAVEPOINT u');
    expect(await sqlState(ctx.client.query(
      `INSERT INTO public.bot_usage_ledger (tenant_id, resource, reservation_id, origin, amount)
       SELECT tenant_id, resource, reservation_id, 'measured', 1 FROM public.bot_usage_ledger
        WHERE event_key = 'twilio:CA-u:terminal'`,
    ))).toBe('23505');
    await ctx.client.query('ROLLBACK TO SAVEPOINT u');
  });

  it('K2: Callback ohne Reservierung (Anruf vor Deploy) wird einmal gebucht', async () => {
    const settle = () => asServer(ctx, async () => (await ctx.client.query(
      `SELECT * FROM public.bot_usage_settle_by_ref($1, 'voice_seconds', 'twilio', 'CA-legacy', 90, 'twilio:CA-legacy:terminal', '{}')`, [tenant],
    )).rows[0]);
    expect((await settle()).duplicate).toBe(false);
    expect((await settle()).duplicate).toBe(true);
  });

  it('K1: Folge-Hit eines laufenden Anrufs bleibt "existing", auch wenn er das letzte Kontingent hält', async () => {
    // Plan 300 s = max. Anrufdauer → die erste Reservierung nimmt alles.
    const first = await reserveCall(ctx, tenant, 'CA-last', 300);
    expect(first.decision).toBe('allow');
    expect(Number(first.reserved_amount)).toBe(300);
    const followUp = await reserveCall(ctx, tenant, 'CA-last', 300);
    expect(followUp.decision).toBe('existing');
    expect(followUp.reservation_id).toBe(first.reservation_id);
    // Ein neuer Anruf bekommt dagegen nichts mehr.
    expect((await reserveCall(ctx, tenant, 'CA-next', 300)).decision).toBe('deny');
  });

  it('K3/K11: später Callback nach dem Aufräumjob wird als Korrektur nachgetragen, genau einmal', async () => {
    const r = await reserveCall(ctx, tenant, 'CA-late', 600);
    await ctx.client.query(`UPDATE public.bot_usage_reservations SET expires_at = now() - interval '1 second' WHERE id = $1`, [r.reservation_id]);
    await asServer(ctx, () => ctx.client.query(`SELECT public.bot_usage_sweep_expired()`));
    const late = () => asServer(ctx, async () => (await ctx.client.query(
      `SELECT * FROM public.bot_usage_settle_by_ref($1, 'voice_seconds', 'twilio', 'CA-late', 42, 'twilio:CA-late:terminal', '{"CallDuration":42}')`, [tenant],
    )).rows[0]);
    const first = await late();
    expect(first.duplicate).toBe(false);
    expect(Number(first.amount)).toBe(42 - 300); // Differenz zur Schätzung (300 s)
    expect((await late()).duplicate).toBe(true);
    const billable = await ctx.client.query(
      `SELECT b.billable_amount FROM public.bot_usage_billable b
         JOIN public.bot_usage_ledger l ON l.id = b.entry_id WHERE l.reservation_id = $1`, [r.reservation_id],
    );
    expect(billable.rows.map((x) => Number(x.billable_amount))).toEqual([42]);
  });

  it('K5: Planlimit 0 bzw. Rest < 60 s → Ablehnung', async () => {
    expect((await reserveCall(ctx, tenant, 'CA-z', 59)).decision).toBe('deny');
  });
});

d('bot_usage — Rate-Limit (K8)', () => {
  let ctx: DbCtx;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); });

  it('K8: vierter Treffer im Fenster abgelehnt, anderer Schlüssel unabhängig', async () => {
    const hit = (key: string) => asServer(ctx, async () => (await ctx.client.query(
      `SELECT * FROM public.bot_rate_hit($1, 60, 3)`, [key],
    )).rows[0].allowed as boolean);
    const key = `test:${Math.random()}`;
    expect([await hit(key), await hit(key), await hit(key)]).toEqual([true, true, true]);
    expect(await hit(key)).toBe(false);
    expect(await hit(`${key}:other`)).toBe(true);
  });
});

d('bot_usage — Rechte und Mandantentrennung (K10)', () => {
  let ctx: DbCtx;
  let a: { tenantId: string; userId: string };
  let b: { tenantId: string; userId: string };

  beforeEach(async () => {
    ctx = await openDb();
    a = await createTenantWithMember(ctx);
    b = await createTenantWithMember(ctx);
    for (const t of [a.tenantId, b.tenantId]) {
      await setLimits(ctx, t, { aiDaily: 1, aiMonthly: 2, concurrent: 2, maxCall: 300 });
      const r = await reserveAi(ctx, t, `iso-${t}`, 0.1);
      await asServer(ctx, () => ctx.client.query(
        `SELECT * FROM public.bot_usage_settle($1, 'measured', 0.1, NULL, '{}')`, [r.reservation_id],
      ));
    }
  });
  afterEach(async () => { await closeDb(ctx); });

  it('Mitglied sieht nur eigene Ledger-, Reservierungs- und Abrechnungszeilen', async () => {
    await ctx.withClaims({ sub: a.userId, role: 'authenticated' }, async () => {
      for (const table of ['bot_usage_ledger', 'bot_usage_reservations', 'bot_usage_billable']) {
        const own = await ctx.client.query(`SELECT count(*)::int AS n FROM public.${table} WHERE tenant_id = $1`, [a.tenantId]);
        const foreign = await ctx.client.query(`SELECT count(*)::int AS n FROM public.${table} WHERE tenant_id = $1`, [b.tenantId]);
        expect(own.rows[0].n, table).toBeGreaterThan(0);
        expect(foreign.rows[0].n, table).toBe(0);
      }
    });
  });

  it('authenticated/anon dürfen weder reservieren noch schreiben noch Rate-Zähler lesen', async () => {
    const asUser = (sql: string, params: unknown[] = []) =>
      sqlState(ctx.withClaims({ sub: a.userId, role: 'authenticated' }, () => ctx.client.query(sql, params)));
    expect(await asUser(`SELECT * FROM public.bot_ai_budget_reserve($1, NULL, 'evil', 0.01)`, [a.tenantId])).toBe('42501');
    expect(await asUser(`SELECT public.bot_usage_sweep_expired()`)).toBe('42501');
    expect(await asUser(
      `INSERT INTO public.bot_usage_ledger (tenant_id, resource, origin, amount) VALUES ($1, 'ai_usd', 'measured', 0)`, [a.tenantId],
    )).toBe('42501');
    expect(await asUser(`SELECT count(*) FROM public.bot_rate_buckets`)).toBe('42501');
  });

  it('Interner Aufrufer-Check: ohne service_role-Claim scheitert auch eine Sitzung mit EXECUTE-Recht', async () => {
    // Wie PostgREST: angemeldet als authenticator, Rolle service_role, aber
    // Claim "authenticated" → muss scheitern. Mit Claim service_role → ok.
    await ctx.client.query('SAVEPOINT g');
    await ctx.client.query('SET LOCAL SESSION AUTHORIZATION authenticator');
    await ctx.client.query('SET LOCAL ROLE service_role');
    await ctx.client.query(`SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true)`);
    expect(await sqlState(ctx.client.query(`SELECT public.bot_usage_sweep_expired()`))).toBe('42501');
    await ctx.client.query('ROLLBACK TO SAVEPOINT g');
    await ctx.client.query('SET LOCAL SESSION AUTHORIZATION authenticator');
    await ctx.client.query('SET LOCAL ROLE service_role');
    await ctx.client.query(`SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
    expect(await sqlState(ctx.client.query(`SELECT public.bot_usage_sweep_expired()`))).toBe('OK');
    await ctx.client.query('ROLLBACK TO SAVEPOINT g');
  });
});

d('bot_usage — parallele Anfragen am Budgetrand (K7, K1)', () => {
  /**
   * Braucht echte Verbindungen und festgeschriebene Fixtures — der
   * Advisory-Lock wirkt zwischen Transaktionen. Aufräumen im finally über
   * die Mandantenlöschung (kaskadiert in Reservierungen).
   */
  it('40 parallele KI-Reservierungen à 0,10 USD bei 1,00 USD Tagesbudget → genau 10 Freigaben', async () => {
    const url = getDbUrl()!;
    const admin = new Client({ connectionString: url });
    await admin.connect();
    const claims = JSON.stringify({ role: 'service_role' });
    await admin.query(`SELECT set_config('request.jwt.claims', $1, false)`, [claims]);
    const tid = (await admin.query<{ id: string }>(
      `INSERT INTO public.tenants (name) VALUES ($1) RETURNING id`, [`budget_race_${Date.now()}`],
    )).rows[0]!.id;
    const workers: Client[] = [];
    try {
      await admin.query(
        `INSERT INTO public.bot_usage_limits (tenant_id, ai_usd_daily, ai_usd_monthly, voice_max_concurrent_calls, voice_max_call_seconds, voice_seconds_monthly)
         VALUES ($1, 1.00, 1.00, 3, 120, 100000)`, [tid],
      );
      for (let i = 0; i < 40; i++) {
        const c = new Client({ connectionString: url });
        await c.connect();
        await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [claims]);
        workers.push(c);
      }
      const ai = await Promise.all(workers.map((c, i) => c.query<{ decision: string }>(
        `SELECT decision FROM public.bot_ai_budget_reserve($1, NULL, $2, 0.10, '{"channel":"chat"}')`, [tid, `par-${i}`],
      ).then((r) => r.rows[0]!.decision)));
      expect(ai.filter((x) => x === 'allow')).toHaveLength(10);
      const sum = await admin.query<{ s: string }>(
        `SELECT coalesce(sum(reserved_amount),0) AS s FROM public.bot_usage_reservations WHERE tenant_id = $1 AND resource = 'ai_usd'`, [tid],
      );
      expect(Number(sum.rows[0]!.s)).toBeLessThanOrEqual(1.0);

      const calls = await Promise.all(workers.slice(0, 20).map((c, i) => c.query<{ decision: string }>(
        `SELECT decision FROM public.bot_voice_call_reserve($1, NULL, 'twilio', $2, 6000)`, [tid, `CApar-${i}`],
      ).then((r) => r.rows[0]!.decision)));
      expect(calls.filter((x) => x === 'allow')).toHaveLength(3);
    } finally {
      await Promise.all(workers.map((c) => c.end()));
      await admin.query(`DELETE FROM public.tenants WHERE id = $1`, [tid]);
      await admin.end();
    }
  }, 30_000);
});
