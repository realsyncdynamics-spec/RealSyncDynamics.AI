/**
 * Bot-Kanäle: Kanalgrenzen, geschützte Kanalreserve, zentraler Fallback,
 * Telefon-Durchsetzung (Nacharbeit PR #2044, Gate 1 + Gate 4).
 *
 * Migration 20261027140000_bot_usage_channel_limits_voice_enforcement.sql
 * auf 20261027120000_bot_usage_budget_hardening.sql.
 *
 * Geprüft
 *   G4-1  Fehlende Konfiguration → keine unbegrenzte Nutzung (Fallback zentral)
 *   G4-2  Fehlender/unbekannter Kanal → Ablehnung
 *   G4-3  Kanalgrenze erreicht → nur dieser Kanal blockiert (Tag und Monat)
 *   G4-4  Mandantengrenze erreicht → alle Kanäle blockiert
 *   G4-5  Geschützte Reserve: abgerechneter + offen reservierter Verbrauch
 *         des geschützten Kanals zählt; Tag und Monat eigenständig
 *   G4-6  Ungültige Konfiguration wird abgewiesen
 *   G4-7  Parallel: Chat + Workspace können die Telefonreserve nicht
 *         aufbrauchen (Tag und Monat, mit offen reserviertem Anruf)
 *   G1    Überfällige Anrufe werden ohne weiteren Gesprächsschritt gefunden;
 *         Protokollierung ändert weder Status noch Betrag noch Ledger
 *   R     Rechte und Mandantentrennung der neuen Objekte
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { createTenantWithMember, closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

interface PgError extends Error { code?: string }
interface ReserveRow { decision: string; reservation_id: string | null; reason: string | null }

const SERVER = { role: 'service_role' } as const;

function asServer<T>(ctx: DbCtx, fn: () => Promise<T>): Promise<T> {
  return ctx.withClaims(SERVER, fn);
}

async function sqlState(p: Promise<unknown>): Promise<string> {
  try { await p; return 'OK'; } catch (e) { return (e as PgError).code ?? (e as Error).message; }
}

async function tenantLimits(ctx: DbCtx, tenantId: string, daily: number, monthly: number): Promise<void> {
  await ctx.client.query(
    `INSERT INTO public.bot_usage_limits (tenant_id, ai_usd_daily, ai_usd_monthly) VALUES ($1,$2,$3)
     ON CONFLICT (tenant_id) DO UPDATE SET ai_usd_daily = EXCLUDED.ai_usd_daily, ai_usd_monthly = EXCLUDED.ai_usd_monthly`,
    [tenantId, daily, monthly],
  );
}

async function channelLimits(ctx: DbCtx, tenantId: string, channel: string, l: {
  daily?: number | null; monthly?: number | null; reserveDaily?: number; reserveMonthly?: number;
}): Promise<void> {
  await ctx.client.query(
    `INSERT INTO public.bot_usage_channel_limits
       (tenant_id, channel, usd_daily, usd_monthly, reserved_usd_daily, reserved_usd_monthly)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (tenant_id, channel) DO UPDATE SET usd_daily = EXCLUDED.usd_daily,
       usd_monthly = EXCLUDED.usd_monthly, reserved_usd_daily = EXCLUDED.reserved_usd_daily,
       reserved_usd_monthly = EXCLUDED.reserved_usd_monthly`,
    [tenantId, channel, l.daily ?? null, l.monthly ?? null, l.reserveDaily ?? 0, l.reserveMonthly ?? 0],
  );
}

async function reserve(ctx: DbCtx, tenantId: string, ref: string, usd: number, channel: string | null): Promise<ReserveRow> {
  const meta = channel === null ? '{}' : JSON.stringify({ channel });
  return asServer(ctx, async () => (await ctx.client.query<ReserveRow>(
    `SELECT decision, reservation_id, reason FROM public.bot_ai_budget_reserve($1, NULL, $2, $3, $4::jsonb)`,
    [tenantId, ref, usd, meta],
  )).rows[0]!);
}

async function settle(ctx: DbCtx, reservationId: string, amount: number): Promise<void> {
  await asServer(ctx, () => ctx.client.query(
    `SELECT * FROM public.bot_usage_settle($1, 'measured', $2, NULL, '{}')`, [reservationId, amount],
  ));
}

d('Gate 4 — Fallback und Kanalpflicht', () => {
  let ctx: DbCtx;
  let tenant: string;
  beforeEach(async () => { ctx = await openDb(); tenant = (await createTenantWithMember(ctx)).tenantId; });
  afterEach(async () => { await closeDb(ctx); });

  it('G4-1: ohne Limits-Zeile gilt die zentrale vorläufige Obergrenze — nie unbegrenzt', async () => {
    const fb = (await ctx.client.query<{ d: string; m: string }>(
      `SELECT public.bot_usage_fallback('ai_usd_daily') AS d, public.bot_usage_fallback('ai_usd_monthly') AS m`,
    )).rows[0]!;
    const daily = Number(fb.d);
    expect(daily).toBeGreaterThan(0);
    expect((await reserve(ctx, tenant, 'fb-1', daily - 0.01, 'chat')).decision).toBe('allow');
    const denied = await reserve(ctx, tenant, 'fb-2', 0.02, 'chat');
    expect(denied.decision).toBe('deny');
    expect(denied.reason).toBe('daily_budget');
  });

  it('G4-1: Tabellen-Defaults lesen dieselbe zentrale Quelle; unbekannter Schlüssel → 0', async () => {
    await ctx.client.query(`INSERT INTO public.bot_usage_limits (tenant_id) VALUES ($1)`, [tenant]);
    const row = (await ctx.client.query<{ ok: boolean; unknown: string }>(
      `SELECT (l.ai_usd_daily = public.bot_usage_fallback('ai_usd_daily')
           AND l.ai_usd_monthly = public.bot_usage_fallback('ai_usd_monthly')
           AND l.voice_max_concurrent_calls = public.bot_usage_fallback('voice_max_concurrent_calls')
           AND l.voice_max_call_seconds = public.bot_usage_fallback('voice_max_call_seconds')) AS ok,
              public.bot_usage_fallback('does_not_exist') AS unknown
         FROM public.bot_usage_limits l WHERE l.tenant_id = $1`, [tenant],
    )).rows[0]!;
    expect(row.ok).toBe(true);
    expect(Number(row.unknown)).toBe(0);
  });

  it('G4-2: fehlender oder unbekannter Kanal wird abgelehnt', async () => {
    await tenantLimits(ctx, tenant, 1, 10);
    expect((await reserve(ctx, tenant, 'nochan', 0.1, null)).reason).toBe('invalid');
    expect((await reserve(ctx, tenant, 'badchan', 0.1, 'sms')).reason).toBe('invalid');
    const n = await ctx.client.query(`SELECT count(*)::int AS n FROM public.bot_usage_reservations WHERE tenant_id = $1`, [tenant]);
    expect(n.rows[0].n).toBe(0);
  });

  it('Reservierung trägt den Kanal; Wiederholung derselben Referenz liefert existing', async () => {
    await tenantLimits(ctx, tenant, 1, 10);
    const r = await reserve(ctx, tenant, 'same', 0.1, 'whatsapp');
    const ch = await ctx.client.query(`SELECT channel FROM public.bot_usage_reservations WHERE id = $1`, [r.reservation_id]);
    expect(ch.rows[0].channel).toBe('whatsapp');
    expect((await reserve(ctx, tenant, 'same', 0.1, 'whatsapp')).decision).toBe('existing');
  });
});

d('Gate 4 — Kanalgrenzen und Mandantengrenze', () => {
  let ctx: DbCtx;
  let tenant: string;
  beforeEach(async () => { ctx = await openDb(); tenant = (await createTenantWithMember(ctx)).tenantId; });
  afterEach(async () => { await closeDb(ctx); });

  it('G4-3: Kanal-Tagesgrenze erreicht → nur dieser Kanal blockiert', async () => {
    await tenantLimits(ctx, tenant, 2, 20);
    await channelLimits(ctx, tenant, 'chat', { daily: 0.5 });
    expect((await reserve(ctx, tenant, 'c1', 0.4, 'chat')).decision).toBe('allow');
    const denied = await reserve(ctx, tenant, 'c2', 0.2, 'chat');
    expect(denied.decision).toBe('deny');
    expect(denied.reason).toBe('channel_daily_budget');
    expect((await reserve(ctx, tenant, 'w1', 0.2, 'whatsapp')).decision).toBe('allow');
    expect((await reserve(ctx, tenant, 'v1', 0.2, 'voice')).decision).toBe('allow');
  });

  it('G4-3: Kanal-Monatsgrenze wird eigenständig geprüft', async () => {
    await tenantLimits(ctx, tenant, 5, 20);
    await channelLimits(ctx, tenant, 'whatsapp', { daily: null, monthly: 0.3 });
    expect((await reserve(ctx, tenant, 'w1', 0.3, 'whatsapp')).decision).toBe('allow');
    expect((await reserve(ctx, tenant, 'w2', 0.01, 'whatsapp')).reason).toBe('channel_monthly_budget');
    expect((await reserve(ctx, tenant, 'c1', 0.3, 'chat')).decision).toBe('allow');
  });

  it('G4-4: Mandantengrenze erreicht → alle Kanäle blockiert', async () => {
    await tenantLimits(ctx, tenant, 1, 10);
    expect((await reserve(ctx, tenant, 'c1', 1, 'chat')).decision).toBe('allow');
    for (const ch of ['chat', 'whatsapp', 'voice', 'workspace']) {
      const r = await reserve(ctx, tenant, `x-${ch}`, 0.01, ch);
      expect(r.decision).toBe('deny');
      expect(r.reason).toBe('daily_budget');
    }
  });
});

d('Gate 4 — geschützte Telefonreserve', () => {
  let ctx: DbCtx;
  let tenant: string;
  beforeEach(async () => { ctx = await openDb(); tenant = (await createTenantWithMember(ctx)).tenantId; });
  afterEach(async () => { await closeDb(ctx); });

  it('G4-5: andere Kanäle erreichen nur Mandantengrenze − ungenutzte Reserve; Telefon behält seinen Anteil', async () => {
    await tenantLimits(ctx, tenant, 1, 10);
    await channelLimits(ctx, tenant, 'voice', { reserveDaily: 0.4 });
    expect((await reserve(ctx, tenant, 'c1', 0.6, 'chat')).decision).toBe('allow');
    const denied = await reserve(ctx, tenant, 'c2', 0.01, 'workspace');
    expect(denied.decision).toBe('deny');
    expect(denied.reason).toBe('protected_reserve');
    expect((await reserve(ctx, tenant, 'v1', 0.4, 'voice')).decision).toBe('allow');
    expect((await reserve(ctx, tenant, 'v2', 0.01, 'voice')).reason).toBe('daily_budget');
  });

  it('G4-5: offen reservierter Telefonverbrauch zählt gegen die Reserve, abgerechneter ebenso', async () => {
    await tenantLimits(ctx, tenant, 1, 10);
    await channelLimits(ctx, tenant, 'voice', { reserveDaily: 0.4 });
    // Laufender Anruf: 0,3 offen reserviert → ungenutzte Reserve 0,1.
    const v = await reserve(ctx, tenant, 'v-open', 0.3, 'voice');
    expect(v.decision).toBe('allow');
    // Chat-Spielraum = 1,0 − 0,3 (verbraucht) − 0,1 (ungenutzte Reserve) = 0,6
    expect((await reserve(ctx, tenant, 'c1', 0.6, 'chat')).decision).toBe('allow');
    expect((await reserve(ctx, tenant, 'c2', 0.01, 'chat')).reason).toBe('protected_reserve');
    // Abrechnung des Anrufs mit 0,3 ändert daran nichts (Ledger statt Reservierung).
    await settle(ctx, v.reservation_id!, 0.3);
    expect((await reserve(ctx, tenant, 'c3', 0.01, 'chat')).reason).toBe('protected_reserve');
    expect((await reserve(ctx, tenant, 'v2', 0.1, 'voice')).decision).toBe('allow');
  });

  it('G4-5: Verbrauch über die Reserve hinaus schützt nichts doppelt', async () => {
    await tenantLimits(ctx, tenant, 1, 10);
    await channelLimits(ctx, tenant, 'voice', { reserveDaily: 0.4 });
    const v = await reserve(ctx, tenant, 'v1', 0.5, 'voice');
    await settle(ctx, v.reservation_id!, 0.5);
    // Reserve vollständig genutzt → Chat darf den Rest 0,5 nutzen.
    expect((await reserve(ctx, tenant, 'c1', 0.5, 'chat')).decision).toBe('allow');
  });

  it('G4-5: Monatsreserve wird unabhängig von der Tagesreserve geprüft', async () => {
    await tenantLimits(ctx, tenant, 5, 3);
    await channelLimits(ctx, tenant, 'voice', { reserveDaily: 0, reserveMonthly: 2 });
    expect((await reserve(ctx, tenant, 'c1', 1, 'chat')).decision).toBe('allow');
    expect((await reserve(ctx, tenant, 'c2', 0.01, 'chat')).reason).toBe('protected_reserve');
    expect((await reserve(ctx, tenant, 'v1', 2, 'voice')).decision).toBe('allow');
  });

  it('G4-5: freigegebene Reservierungen zählen nicht', async () => {
    await tenantLimits(ctx, tenant, 1, 10);
    await channelLimits(ctx, tenant, 'voice', { reserveDaily: 0.4 });
    const v = await reserve(ctx, tenant, 'v1', 0.4, 'voice');
    await asServer(ctx, () => ctx.client.query(`SELECT public.bot_usage_release($1, 'not_sent:test')`, [v.reservation_id]));
    // Reserve wieder vollständig ungenutzt → Chat bleibt bei 0,6.
    expect((await reserve(ctx, tenant, 'c1', 0.6, 'chat')).decision).toBe('allow');
    expect((await reserve(ctx, tenant, 'c2', 0.01, 'chat')).reason).toBe('protected_reserve');
  });
});

d('Gate 4 — ungültige Konfiguration', () => {
  let ctx: DbCtx;
  let tenant: string;
  beforeEach(async () => { ctx = await openDb(); tenant = (await createTenantWithMember(ctx)).tenantId; });
  afterEach(async () => { await closeDb(ctx); });

  async function attempt(sql: string, params: unknown[]): Promise<string> {
    await ctx.client.query('SAVEPOINT cfg');
    const state = await sqlState(ctx.client.query(sql, params));
    await ctx.client.query(state === 'OK' ? 'RELEASE SAVEPOINT cfg' : 'ROLLBACK TO SAVEPOINT cfg');
    return state;
  }

  it('G4-6: Reserven über der Mandantengrenze, negative Werte, Reserve über Kanalgrenze → abgewiesen', async () => {
    await tenantLimits(ctx, tenant, 1, 10);
    expect(await attempt(
      `INSERT INTO public.bot_usage_channel_limits (tenant_id, channel, reserved_usd_daily) VALUES ($1, 'voice', 1.5)`, [tenant],
    )).toBe('23514');
    expect(await attempt(
      `INSERT INTO public.bot_usage_channel_limits (tenant_id, channel, reserved_usd_daily) VALUES ($1, 'voice', -0.1)`, [tenant],
    )).toBe('23514');
    expect(await attempt(
      `INSERT INTO public.bot_usage_channel_limits (tenant_id, channel, usd_daily, reserved_usd_daily) VALUES ($1, 'voice', 0.2, 0.3)`, [tenant],
    )).toBe('23514');
    expect(await attempt(
      `INSERT INTO public.bot_usage_channel_limits (tenant_id, channel, usd_daily) VALUES ($1, 'voice', -1)`, [tenant],
    )).toBe('23514');
    expect(await attempt(
      `INSERT INTO public.bot_usage_channel_limits (tenant_id, channel) VALUES ($1, 'sms')`, [tenant],
    )).toBe('23514');
    // Summe zweier Reserven über der Grenze
    await channelLimits(ctx, tenant, 'voice', { reserveDaily: 0.6 });
    expect(await attempt(
      `INSERT INTO public.bot_usage_channel_limits (tenant_id, channel, reserved_usd_daily) VALUES ($1, 'whatsapp', 0.5)`, [tenant],
    )).toBe('23514');
    // Mandantengrenze unter die Reserven senken
    expect(await attempt(
      `UPDATE public.bot_usage_limits SET ai_usd_daily = 0.5 WHERE tenant_id = $1`, [tenant],
    )).toBe('23514');
  });

  it('G4-6: inkonsistente Altdaten → Reservierung mit invalid_config abgelehnt', async () => {
    await tenantLimits(ctx, tenant, 1, 10);
    await ctx.client.query(`ALTER TABLE public.bot_usage_channel_limits DISABLE TRIGGER bot_usage_channel_limits_validate`);
    await ctx.client.query(
      `INSERT INTO public.bot_usage_channel_limits (tenant_id, channel, reserved_usd_daily) VALUES ($1, 'voice', 2)`, [tenant],
    );
    await ctx.client.query(`ALTER TABLE public.bot_usage_channel_limits ENABLE TRIGGER bot_usage_channel_limits_validate`);
    for (const ch of ['chat', 'voice']) {
      const r = await reserve(ctx, tenant, `inv-${ch}`, 0.01, ch);
      expect(r.decision).toBe('deny');
      expect(r.reason).toBe('invalid_config');
    }
  });
});

d('Gate 1 — überfällige Anrufe ohne weiteren Gesprächsschritt', () => {
  let ctx: DbCtx;
  let tenant: string;
  beforeEach(async () => { ctx = await openDb(); tenant = (await createTenantWithMember(ctx)).tenantId; });
  afterEach(async () => { await closeDb(ctx); });

  async function call(ref: string, ageSeconds: number): Promise<string> {
    const r = await asServer(ctx, async () => (await ctx.client.query<ReserveRow>(
      `SELECT reservation_id FROM public.bot_voice_call_reserve($1, NULL, 'twilio', $2, NULL, $3::jsonb)`,
      [tenant, ref, JSON.stringify({ account_sid: 'AC' + '0'.repeat(32) })],
    )).rows[0]!);
    await ctx.client.query(
      `UPDATE public.bot_usage_reservations SET created_at = now() - make_interval(secs => $2) WHERE id = $1`,
      [r.reservation_id, ageSeconds],
    );
    return r.reservation_id!;
  }

  async function overdue(lead = 60, maxAttempts = 3): Promise<Array<{ reservation_id: string; call_ref: string; account_sid: string; attempts: number }>> {
    return asServer(ctx, async () => (await ctx.client.query(
      `SELECT * FROM public.bot_voice_overdue_calls($1, $2, 100)`, [lead, maxAttempts],
    )).rows);
  }

  it('G1: Anruf über (reservierte Dauer − Vorlauf) wird gefunden, jüngerer nicht', async () => {
    await ctx.client.query(
      `INSERT INTO public.bot_usage_limits (tenant_id, voice_max_call_seconds, voice_max_concurrent_calls) VALUES ($1, 300, 5)`, [tenant],
    );
    const old = await call('CAold', 250);   // 300 − 60 = 240 ≤ 250 → überfällig
    await call('CAyoung', 100);
    const rows = await overdue();
    expect(rows.map((r) => r.reservation_id)).toEqual([old]);
    expect(rows[0]!.call_ref).toBe('CAold');
    expect(rows[0]!.account_sid).toMatch(/^AC0{32}$/);
    const ch = await ctx.client.query(`SELECT channel FROM public.bot_usage_reservations WHERE id = $1`, [old]);
    expect(ch.rows[0].channel).toBe('voice');
  });

  it('G1: Protokollierung ändert weder Status, Betrag noch Ledger; erledigt → nicht mehr gelistet', async () => {
    await ctx.client.query(
      `INSERT INTO public.bot_usage_limits (tenant_id, voice_max_call_seconds) VALUES ($1, 120)`, [tenant],
    );
    const id = await call('CAx', 500);
    const before = (await ctx.client.query(`SELECT status, reserved_amount FROM public.bot_usage_reservations WHERE id = $1`, [id])).rows[0];
    await asServer(ctx, () => ctx.client.query(`SELECT public.bot_voice_record_hangup($1, false, 'unavailable')`, [id]));
    expect((await overdue())[0]!.attempts).toBe(1);
    await asServer(ctx, () => ctx.client.query(`SELECT public.bot_voice_record_hangup($1, true, 'ended')`, [id]));
    // Doppelt protokolliert (z. B. zweiter Worker) → weiterhin kein Fehler, keine Buchung.
    await asServer(ctx, () => ctx.client.query(`SELECT public.bot_voice_record_hangup($1, true, 'not_active')`, [id]));
    expect(await overdue()).toHaveLength(0);
    const after = (await ctx.client.query(`SELECT status, reserved_amount FROM public.bot_usage_reservations WHERE id = $1`, [id])).rows[0];
    expect(after).toEqual(before);
    expect(after.status).toBe('open');
    const n = await ctx.client.query(`SELECT count(*)::int AS n FROM public.bot_usage_ledger WHERE reservation_id = $1`, [id]);
    expect(n.rows[0].n).toBe(0);
  });

  it('G1: nach max. Versuchen nicht mehr gelistet; Budget bleibt reserviert (Sweep rechnet später ab)', async () => {
    await ctx.client.query(
      `INSERT INTO public.bot_usage_limits (tenant_id, voice_max_call_seconds) VALUES ($1, 120)`, [tenant],
    );
    const id = await call('CAy', 500);
    for (let i = 0; i < 3; i++) {
      await asServer(ctx, () => ctx.client.query(`SELECT public.bot_voice_record_hangup($1, false, 'unavailable')`, [id]));
    }
    expect(await overdue(60, 3)).toHaveLength(0);
    const r = (await ctx.client.query(`SELECT status FROM public.bot_usage_reservations WHERE id = $1`, [id])).rows[0];
    expect(r.status).toBe('open');
  });
});

d('Rechte und Mandantentrennung der neuen Objekte', () => {
  let ctx: DbCtx;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); });

  it('authenticated darf neue Funktionen nicht ausführen und Kanalgrenzen nicht schreiben; liest nur eigene', async () => {
    const a = await createTenantWithMember(ctx);
    const b = await createTenantWithMember(ctx);
    await tenantLimits(ctx, a.tenantId, 1, 10);
    await tenantLimits(ctx, b.tenantId, 1, 10);
    await channelLimits(ctx, a.tenantId, 'voice', { reserveDaily: 0.2 });
    await channelLimits(ctx, b.tenantId, 'voice', { reserveDaily: 0.3 });

    const asUser = (sql: string, params: unknown[] = []) =>
      sqlState(ctx.withClaims({ sub: a.userId, role: 'authenticated' }, () => ctx.client.query(sql, params)));

    expect(await asUser(`SELECT public.bot_voice_overdue_calls(0, 3, 10)`)).toBe('42501');
    expect(await asUser(`SELECT public.bot_voice_record_hangup(gen_random_uuid(), true, 'x')`)).toBe('42501');
    expect(await asUser(`SELECT public.bot_usage_used_channel($1, 'ai_usd', 'chat', now())`, [a.tenantId])).toBe('42501');
    expect(await asUser(
      `INSERT INTO public.bot_usage_channel_limits (tenant_id, channel) VALUES ($1, 'chat')`, [a.tenantId],
    )).toBe('42501');

    const seen = await ctx.withClaims({ sub: a.userId, role: 'authenticated' }, async () =>
      (await ctx.client.query(`SELECT tenant_id FROM public.bot_usage_channel_limits`)).rows.map((r) => r.tenant_id));
    expect(seen).toEqual([a.tenantId]);
  });
});

d('Gate 4 — parallele Last gegen die Telefonreserve (G4-7)', () => {
  /**
   * Echte Verbindungen, festgeschriebene Fixtures (der Advisory-Lock wirkt
   * zwischen Transaktionen). Aufräumen über Mandantenlöschung.
   */
  async function race(period: 'day' | 'month'): Promise<void> {
    const url = getDbUrl()!;
    const admin = new Client({ connectionString: url });
    await admin.connect();
    const claims = JSON.stringify({ role: 'service_role' });
    await admin.query(`SELECT set_config('request.jwt.claims', $1, false)`, [claims]);
    const tid = (await admin.query<{ id: string }>(
      `INSERT INTO public.tenants (name) VALUES ($1) RETURNING id`, [`reserve_race_${period}_${Date.now()}`],
    )).rows[0]!.id;
    const workers: Client[] = [];
    try {
      // Grenze 1,00 in der geprüften Periode, 0,40 Telefonreserve; die andere
      // Periode großzügig, damit nur die geprüfte greift.
      const [daily, monthly] = period === 'day' ? [1, 100] : [100, 1];
      await admin.query(
        `INSERT INTO public.bot_usage_limits (tenant_id, ai_usd_daily, ai_usd_monthly) VALUES ($1,$2,$3)`, [tid, daily, monthly],
      );
      await admin.query(
        `INSERT INTO public.bot_usage_channel_limits (tenant_id, channel, reserved_usd_daily, reserved_usd_monthly)
         VALUES ($1, 'voice', $2, $3)`, [tid, period === 'day' ? 0.4 : 0, period === 'month' ? 0.4 : 0],
      );
      // Laufender Anruf: 0,10 offen reserviert.
      const open = (await admin.query<{ decision: string }>(
        `SELECT decision FROM public.bot_ai_budget_reserve($1, NULL, 'voice-open', 0.10, '{"channel":"voice"}')`, [tid],
      )).rows[0]!.decision;
      expect(open).toBe('allow');

      for (let i = 0; i < 40; i++) {
        const c = new Client({ connectionString: url });
        await c.connect();
        await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [claims]);
        workers.push(c);
      }
      // 20 × Chat + 20 × Workspace à 0,05 gleichzeitig.
      const results = await Promise.all(workers.map((c, i) => c.query<{ decision: string; reason: string | null }>(
        `SELECT decision, reason FROM public.bot_ai_budget_reserve($1, NULL, $2, 0.05, $3::jsonb)`,
        [tid, `race-${i}`, JSON.stringify({ channel: i % 2 === 0 ? 'chat' : 'workspace' })],
      ).then((r) => r.rows[0]!)));
      // Spielraum = 1,00 − 0,10 (Anruf) − 0,30 (ungenutzte Reserve) = 0,60 → 12 Freigaben.
      expect(results.filter((r) => r.decision === 'allow')).toHaveLength(12);
      expect(results.filter((r) => r.decision === 'deny').every((r) => r.reason === 'protected_reserve')).toBe(true);

      const nonVoice = await admin.query<{ s: string }>(
        `SELECT coalesce(sum(reserved_amount),0) AS s FROM public.bot_usage_reservations
          WHERE tenant_id = $1 AND resource = 'ai_usd' AND channel IN ('chat','workspace')`, [tid],
      );
      expect(Number(nonVoice.rows[0]!.s)).toBeCloseTo(0.6, 6);

      // Telefon kann die restliche Reserve vollständig nutzen.
      const voice = (await admin.query<{ decision: string }>(
        `SELECT decision FROM public.bot_ai_budget_reserve($1, NULL, 'voice-2', 0.30, '{"channel":"voice"}')`, [tid],
      )).rows[0]!.decision;
      expect(voice).toBe('allow');
    } finally {
      await Promise.all(workers.map((c) => c.end()));
      await admin.query(`DELETE FROM public.tenants WHERE id = $1`, [tid]);
      await admin.end();
    }
  }

  it('Tagesreserve hält gegen 40 parallele Chat-/Workspace-Reservierungen', () => race('day'), 30_000);
  it('Monatsreserve hält gegen 40 parallele Chat-/Workspace-Reservierungen', () => race('month'), 30_000);
});
