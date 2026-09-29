/**
 * Voice Runtime — Datenmodell (PR 1: Provider-Interface + Datenmodell).
 *
 * ## Warum gegen echtes Postgres
 *
 * Die Zusagen des Governed Voice Agent stehen in der Datenbank, nicht im
 * Adapter-Code — ein halluzinierender Provider oder fehlerhafter Service-Code
 * mit service_role darf sie nicht umgehen können:
 *
 *   Rufnummer              höchstens EINEM Bot zugeordnet, mandantenübergreifend
 *   Nummern-Bindung        vom Browser nicht schreibbar (sonst Anruf-Hijacking)
 *   Tenant-Konsistenz      Kindzeile trägt den Tenant ihres Elternteils (T11)
 *   Ausführung             nur bei ALLOW oder bestätigtem REQUIRE_CONFIRMATION
 *   Entscheidung           einmalig, nur durch 'policy-engine'
 *   Verifikation           'confirmed' nur mit externer Referenz (T05)
 *   Evidenz                append-only; nur die Kaskade des Löschpfads entfernt sie
 *   RLS                    fremde Mitglieder sehen nichts
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('voice-runtime') ? describe : describe.skip;

interface PgError extends Error { code?: string }
const SERVER = { role: 'service_role' } as const;
const HASH0 = '0'.repeat(64);
const HASH1 = '1'.repeat(64);

async function sqlstate(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'OK';
  } catch (e) {
    return (e as PgError).code ?? (e as Error).message;
  }
}

/** Mandant mit Plan, der Bots erlaubt, plus ein Voice-Bot. */
async function voiceTenant(ctx: DbCtx): Promise<{ tenantId: string; userId: string; botId: string }> {
  const { tenantId, userId } = await createTenantWithMember(ctx);
  await ctx.client.query(
    `INSERT INTO public.subscriptions (tenant_id, plan_key, status)
     VALUES ($1, 'growth', 'active')
     ON CONFLICT (tenant_id) DO UPDATE SET plan_key = 'growth', status = 'active',
       stripe_price_id = NULL, past_due_since = NULL, updated_at = now()`,
    [tenantId],
  );
  const botId = await ctx.withClaims(SERVER, async () => {
    const { rows } = await ctx.client.query<{ id: string }>(
      `INSERT INTO public.bots (tenant_id, name, channel) VALUES ($1, 'Reception Agent', 'voice') RETURNING id`,
      [tenantId],
    );
    return rows[0]!.id;
  });
  return { tenantId, userId, botId };
}

async function session(client: Client, tenantId: string, botId: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.voice_sessions (tenant_id, bot_id, provider, model, policy_ref)
     VALUES ($1, $2, 'grok', 'grok-voice', 'appointment.booking.v1') RETURNING id`,
    [tenantId, botId],
  );
  return rows[0]!.id;
}

async function toolRequest(
  client: Client,
  tenantId: string,
  sessionId: string,
  verdict: 'ALLOW' | 'DENY' | 'REQUIRE_CONFIRMATION' | null,
): Promise<string> {
  const decided = verdict !== null;
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.voice_tool_requests
       (tenant_id, session_id, provider_call_id, tool, argument_keys, args,
        verdict, reason, risk, policy_ref, decided_by, decided_at)
     VALUES ($1, $2, gen_random_uuid()::text, 'schedule_appointment', '{date,time}',
             '{"date":"2026-10-08","time":"14:00"}',
             $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      tenantId, sessionId, verdict,
      decided ? 'test' : null, decided ? 'medium' : null,
      decided ? 'appointment.booking.v1' : null,
      decided ? 'policy-engine' : null, decided ? new Date().toISOString() : null,
    ],
  );
  return rows[0]!.id;
}

d('voice runtime — Datenmodell fail-closed', () => {
  let ctx: DbCtx;

  beforeEach(async () => {
    ctx = await openDb();
  });

  afterEach(async () => {
    await closeDb(ctx);
  });

  it('eine aktive Rufnummer gehört höchstens einem Bot — auch über Mandanten hinweg', async () => {
    const a = await voiceTenant(ctx);
    const b = await voiceTenant(ctx);
    await ctx.client.query(
      `INSERT INTO public.voice_number_bindings (tenant_id, bot_id, phone_number_e164, telephony_provider, status)
       VALUES ($1, $2, '+4930123456', 'telnyx', 'active')`,
      [a.tenantId, a.botId],
    );
    const code = await sqlstate(() => ctx.withClaims(SERVER, () => ctx.client.query(
      `INSERT INTO public.voice_number_bindings (tenant_id, bot_id, phone_number_e164, telephony_provider, status)
       VALUES ($1, $2, '+4930123456', 'telnyx', 'pending')`,
      [b.tenantId, b.botId],
    )));
    expect(code).toBe('23505');
  });

  it('Nummern-Bindung ist für Tenant-Owner aus dem Browser nicht schreibbar', async () => {
    const a = await voiceTenant(ctx);
    const code = await sqlstate(() => ctx.withClaims({ sub: a.userId }, () => ctx.client.query(
      `INSERT INTO public.voice_number_bindings (tenant_id, bot_id, phone_number_e164, telephony_provider)
       VALUES ($1, $2, '+4930999999', 'telnyx')`,
      [a.tenantId, a.botId],
    )));
    expect(code).toBe('42501');
  });

  it('Tenant-Konsistenz: Session darf nicht auf den Bot eines fremden Mandanten zeigen', async () => {
    const a = await voiceTenant(ctx);
    const b = await voiceTenant(ctx);
    const code = await sqlstate(() => ctx.withClaims(SERVER, () => session(ctx.client, a.tenantId, b.botId)));
    expect(code).toBe('42501');
  });

  it('Ausführung nur bei ALLOW oder bestätigtem REQUIRE_CONFIRMATION', async () => {
    const a = await voiceTenant(ctx);
    const s = await session(ctx.client, a.tenantId, a.botId);
    const exec = (reqId: string) => sqlstate(() => ctx.withClaims(SERVER, () => ctx.client.query(
      `INSERT INTO public.voice_executions (tenant_id, tool_request_id) VALUES ($1, $2)`,
      [a.tenantId, reqId],
    )));

    expect(await exec(await toolRequest(ctx.client, a.tenantId, s, null)), 'unentschieden').toBe('42501');
    expect(await exec(await toolRequest(ctx.client, a.tenantId, s, 'DENY')), 'DENY').toBe('42501');

    const pending = await toolRequest(ctx.client, a.tenantId, s, 'REQUIRE_CONFIRMATION');
    expect(await exec(pending), 'unbestätigt').toBe('42501');
    await ctx.client.query(
      `UPDATE public.voice_tool_requests SET confirmed_by = 'caller', confirmed_at = now() WHERE id = $1`,
      [pending],
    );
    expect(await exec(pending), 'bestätigt').toBe('OK');

    expect(await exec(await toolRequest(ctx.client, a.tenantId, s, 'ALLOW')), 'ALLOW').toBe('OK');
  });

  it('Entscheidung ist einmalig und nur durch die Policy Engine', async () => {
    const a = await voiceTenant(ctx);
    const s = await session(ctx.client, a.tenantId, a.botId);
    const denied = await toolRequest(ctx.client, a.tenantId, s, 'DENY');
    expect(await sqlstate(() => ctx.withClaims(SERVER, () => ctx.client.query(
      `UPDATE public.voice_tool_requests SET verdict = 'ALLOW' WHERE id = $1`, [denied],
    )))).toBe('42501');

    const open = await toolRequest(ctx.client, a.tenantId, s, null);
    expect(await sqlstate(() => ctx.withClaims(SERVER, () => ctx.client.query(
      `UPDATE public.voice_tool_requests
          SET verdict = 'ALLOW', risk = 'low', policy_ref = 'x', decided_by = 'llm', decided_at = now()
        WHERE id = $1`, [open],
    )))).toBe('23514');
  });

  it("'confirmed' nur mit externer Referenz aus erfolgreicher Ausführung", async () => {
    const a = await voiceTenant(ctx);
    const s = await session(ctx.client, a.tenantId, a.botId);
    const req = await toolRequest(ctx.client, a.tenantId, s, 'ALLOW');
    const { rows } = await ctx.client.query<{ id: string }>(
      `INSERT INTO public.voice_executions (tenant_id, tool_request_id) VALUES ($1, $2) RETURNING id`,
      [a.tenantId, req],
    );
    const execId = rows[0]!.id;
    expect(await sqlstate(() => ctx.withClaims(SERVER, () => ctx.client.query(
      `UPDATE public.voice_executions SET verification_status = 'confirmed', verified_at = now() WHERE id = $1`,
      [execId],
    )))).toBe('23514');
    expect(await sqlstate(() => ctx.withClaims(SERVER, () => ctx.client.query(
      `UPDATE public.voice_executions
          SET status = 'succeeded', external_ref = 'appt-42', verification_status = 'confirmed', verified_at = now()
        WHERE id = $1`,
      [execId],
    )))).toBe('OK');
  });

  it('Evidenz ist append-only, die Löschkaskade der Session bleibt möglich', async () => {
    const a = await voiceTenant(ctx);
    const s = await session(ctx.client, a.tenantId, a.botId);
    await ctx.client.query(
      `INSERT INTO public.voice_evidence (tenant_id, session_id, seq, kind, prev_hash, hash)
       VALUES ($1, $2, 1, 'session.start', $3, $4)`,
      [a.tenantId, s, HASH0, HASH1],
    );
    expect(await sqlstate(() => ctx.withClaims(SERVER, () => ctx.client.query(
      `UPDATE public.voice_evidence SET kind = 'session.end' WHERE session_id = $1`, [s],
    )))).toBe('42501');
    expect(await sqlstate(() => ctx.withClaims(SERVER, () => ctx.client.query(
      `DELETE FROM public.voice_evidence WHERE session_id = $1`, [s],
    )))).toBe('42501');

    await ctx.withClaims(SERVER, () => ctx.client.query(`DELETE FROM public.voice_sessions WHERE id = $1`, [s]));
    const { rows } = await ctx.client.query(`SELECT 1 FROM public.voice_evidence WHERE session_id = $1`, [s]);
    expect(rows).toHaveLength(0);
  });

  it('RLS: Mitglieder sehen die eigene Session, fremde Mitglieder nichts', async () => {
    const a = await voiceTenant(ctx);
    const b = await voiceTenant(ctx);
    await session(ctx.client, a.tenantId, a.botId);
    const count = (userId: string) => ctx.withClaims({ sub: userId }, async () => {
      const { rows } = await ctx.client.query(`SELECT id FROM public.voice_sessions WHERE tenant_id = $1`, [a.tenantId]);
      return rows.length;
    });
    expect(await count(a.userId)).toBe(1);
    expect(await count(b.userId)).toBe(0);

    expect(await sqlstate(() => ctx.withClaims({ sub: a.userId }, () => session(ctx.client, a.tenantId, a.botId))))
      .toBe('42501');
  });
});
