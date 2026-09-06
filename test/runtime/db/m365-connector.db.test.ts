/**
 * P2-2 — Microsoft 365 als nachgelagerte Anbindung (DB-Integration)
 *
 * ## Was hier geprüft wird und warum in der Datenbank
 *
 * Die Zusage von P2-2 ist eine Ehrlichkeitszusage: Diese Anbindung kann
 * nichts verhindern, und wenn eine Richtlinie sperren wollte, steht das
 * ausdrücklich in der Zeile. Läge diese Regel nur im TypeScript des
 * Abholjobs, hinge sie am Wohlverhalten des aufrufenden Codes — und der läuft
 * in einem Cron-Job, den niemand ansieht.
 *
 * Deshalb tragen zwei CHECK-Bedingungen die Zusage:
 *
 *   1. `m365_audit_events_class_c_honest` — in dieser Tabelle kann nie ein
 *      blockierendes Verdikt als angewandt stehen.
 *   2. `m365_audit_events_downgrade_reacts` — eine vermerkte Herabstufung
 *      erzwingt eine Reaktion. Eine Herabstufung ohne Reaktion wäre eine
 *      Notiz ohne Adressaten.
 *
 * Dieselbe Konstruktion wie beim Klassen-Trigger in P2-1 und beim
 * Ausfall-CHECK in P2-3: Die Ehrlichkeit gehört dorthin, wo sie nicht
 * umgangen werden kann.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('P2-2 / Microsoft-365-Anbindung') ? describe : describe.skip;

/** Erwartet einen Fehler und hält die Transaktion offen (SAVEPOINT-Muster). */
async function rejects(ctx: DbCtx, sql: string, params: unknown[] = []): Promise<string> {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await ctx.client.query(`SAVEPOINT ${sp}`);
  let message = '';
  try {
    await ctx.client.query(sql, params);
  } catch (e) {
    message = (e as Error).message;
  }
  await ctx.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
  return message;
}

async function makeConnection(ctx: DbCtx, tenantId: string): Promise<string> {
  const r = await ctx.client.query(
    `INSERT INTO public.m365_connections (tenant_id, azure_tenant_id, client_id, credentials_enc)
     VALUES ($1, gen_random_uuid()::text, gen_random_uuid()::text, 'v1:aaa:bbb')
     RETURNING id`,
    [tenantId],
  );
  return r.rows[0].id as string;
}

async function insertEvent(
  ctx: DbCtx,
  tenantId: string,
  connectionId: string,
  over: Record<string, string | null> = {},
): Promise<Record<string, unknown>> {
  const r = await ctx.client.query(
    `INSERT INTO public.m365_audit_events
       (tenant_id, connection_id, graph_id, stream, occurred_at, activity_kind,
        result, verdict, verdict_downgraded_from, pdp_status)
     VALUES ($1, $2, $3, 'directory_audits', now(), 'sharing_link_created',
             'success', $4, $5, $6)
     RETURNING id, verdict, verdict_downgraded_from, pdp_status`,
    [
      tenantId, connectionId,
      over.graph_id ?? `g_${Math.random().toString(36).slice(2, 12)}`,
      over.verdict ?? 'log_only',
      over.verdict_downgraded_from ?? null,
      over.pdp_status ?? 'consulted',
    ],
  );
  return r.rows[0];
}

d('P2-2 / Microsoft 365 (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  // ── Die Klasse ist abgeleitet, nicht eingegeben ─────────────────────────
  it('stuft microsoft365 als C ein — auch wenn der Client A behauptet', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const r = await ctx!.client.query(
      `INSERT INTO public.connector_registry
         (tenant_id, system_type, display_name, enforcement_class)
       VALUES ($1, 'microsoft365', 'Microsoft 365', 'A')
       RETURNING enforcement_class`,
      [tenantId],
    );
    // Der Trigger überschreibt, er prüft nicht. Prüfen hiesse, dem Aufrufer
    // die Möglichkeit zu lassen, es richtig zu treffen und dabei zu lügen.
    expect(r.rows[0].enforcement_class).toBe('C');
  });

  // ── Die Ehrlichkeitsregel, maschinell erzwungen ─────────────────────────
  it('nimmt die drei ehrlichen Verdikte an', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const conn = await makeConnection(ctx!, tenantId);
    for (const v of ['log_only', 'warn', 'react']) {
      const row = await insertEvent(ctx!, tenantId, conn, { verdict: v });
      expect(row.verdict).toBe(v);
    }
  });

  it('weist ein blockierendes Verdikt ab — die Klasse gibt es nicht her', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const conn = await makeConnection(ctx!, tenantId);
    const msg = await rejects(
      ctx!,
      `INSERT INTO public.m365_audit_events
         (tenant_id, connection_id, graph_id, stream, occurred_at, activity_kind, verdict)
       VALUES ($1, $2, 'g_block', 'directory_audits', now(), 'sharing_link_created', 'block')`,
      [tenantId, conn],
    );
    expect(msg).toMatch(/verdict|constraint|check/i);
  });

  it('lässt eine vermerkte Herabstufung nicht ohne Reaktion stehen', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const conn = await makeConnection(ctx!, tenantId);
    // Genau die stille Variante, die der Auftrag verbietet: Die Regel wollte
    // sperren, und in der Zeile stünde nur „protokolliert".
    const msg = await rejects(
      ctx!,
      `INSERT INTO public.m365_audit_events
         (tenant_id, connection_id, graph_id, stream, occurred_at, activity_kind,
          verdict, verdict_downgraded_from)
       VALUES ($1, $2, 'g_silent', 'directory_audits', now(), 'sharing_link_created',
               'log_only', 'block')`,
      [tenantId, conn],
    );
    expect(msg).toMatch(/downgrade_reacts|constraint|check/i);

    // Mit Reaktion geht es durch.
    const ok = await insertEvent(ctx!, tenantId, conn, {
      verdict: 'react', verdict_downgraded_from: 'block',
    });
    expect(ok.verdict).toBe('react');
    expect(ok.verdict_downgraded_from).toBe('block');
  });

  it('kennt nur block und require_approval als Herabstufungsgrund', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const conn = await makeConnection(ctx!, tenantId);
    const msg = await rejects(
      ctx!,
      `INSERT INTO public.m365_audit_events
         (tenant_id, connection_id, graph_id, stream, occurred_at, activity_kind,
          verdict, verdict_downgraded_from)
       VALUES ($1, $2, 'g_odd', 'directory_audits', now(), 'sharing_link_created',
               'react', 'warn')`,
      [tenantId, conn],
    );
    expect(msg).toMatch(/constraint|check/i);
  });

  // ── Idempotenz des Abholpfads ───────────────────────────────────────────
  it('lässt dasselbe Graph-Ereignis nur einmal zu', async () => {
    // Ein zweiter Lauf über dasselbe Zeitfenster darf keine zweite Bewertung
    // desselben Vorgangs erzeugen — sonst zählte jede Kennzahl doppelt.
    const { tenantId } = await createTenantWithMember(ctx!);
    const conn = await makeConnection(ctx!, tenantId);
    await insertEvent(ctx!, tenantId, conn, { graph_id: 'g_fix' });
    const msg = await rejects(
      ctx!,
      `INSERT INTO public.m365_audit_events
         (tenant_id, connection_id, graph_id, stream, occurred_at, activity_kind)
       VALUES ($1, $2, 'g_fix', 'directory_audits', now(), 'sharing_link_created')`,
      [tenantId, conn],
    );
    expect(msg).toMatch(/duplicate|unique/i);
  });

  it('hält den Fortschrittszeiger je Strom getrennt', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const conn = await makeConnection(ctx!, tenantId);
    for (const s of ['directory_audits', 'sign_ins']) {
      await ctx!.client.query(
        `INSERT INTO public.m365_sync_state (tenant_id, connection_id, stream, watermark_at)
         VALUES ($1, $2, $3, now())`,
        [tenantId, conn, s],
      );
    }
    const msg = await rejects(
      ctx!,
      `INSERT INTO public.m365_sync_state (tenant_id, connection_id, stream)
       VALUES ($1, $2, 'sign_ins')`,
      [tenantId, conn],
    );
    expect(msg).toMatch(/duplicate|unique/i);
  });

  // ── Die erweiterten CHECK-Bedingungen ───────────────────────────────────
  it('nimmt microsoft365 als Quelle eines governance_events an', async () => {
    // Ohne diese Erweiterung könnte eine Reaktion keinen Vorgang anlegen:
    // governance_incidents.event_id ist NOT NULL.
    const { tenantId } = await createTenantWithMember(ctx!);
    const r = await ctx!.client.query(
      `INSERT INTO public.governance_events (tenant_id, event_type, event_source, title, risk_level)
       VALUES ($1, 'sharing_link_created', 'microsoft365', 'Test', 'high')
       RETURNING event_source`,
      [tenantId],
    );
    expect(r.rows[0].event_source).toBe('microsoft365');
  });

  it('nimmt die bisherigen Quellen weiterhin an — erweitert, nicht ersetzt', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    for (const s of ['website_scanner', 'sdk', 'ci_cd', 'agent_runtime']) {
      const r = await ctx!.client.query(
        `INSERT INTO public.governance_events (tenant_id, event_type, event_source, title)
         VALUES ($1, 't', $2, 'Test') RETURNING event_source`,
        [tenantId, s],
      );
      expect(r.rows[0].event_source).toBe(s);
    }
  });

  it('nimmt m365-audit als Shadow-Kanal an', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const r = await ctx!.client.query(
      `INSERT INTO public.pdp_shadow_log (tenant_id, source, legacy_status, v2_status, diverged, snapshot_version)
       VALUES ($1, 'm365-audit', NULL, 'block', false, 'v-test') RETURNING source`,
      [tenantId],
    );
    expect(r.rows[0].source).toBe('m365-audit');
  });

  // ── Die Übersichtsfunktion ──────────────────────────────────────────────
  it('zählt Herabstufungen getrennt aus', async () => {
    // Die Frage „wie oft wollte eine Regel sperren und konnte es nicht?" ist
    // die ehrlichste Kennzahl dieser Anbindung. Im Frontend gerechnet bliebe
    // eine falsche Formel unbemerkt.
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const conn = await makeConnection(ctx!, tenantId);
    await insertEvent(ctx!, tenantId, conn, { verdict: 'log_only' });
    await insertEvent(ctx!, tenantId, conn, { verdict: 'warn' });
    await insertEvent(ctx!, tenantId, conn, {
      verdict: 'react', verdict_downgraded_from: 'block',
    });
    await insertEvent(ctx!, tenantId, conn, {
      verdict: 'react', verdict_downgraded_from: 'require_approval',
    });

    await ctx!.client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    const r = await ctx!.client.query(
      `SELECT verdict, anzahl, herabgestuft FROM public.m365_reaction_summary($1)`,
      [tenantId],
    );
    const byVerdict = Object.fromEntries(
      r.rows.map((x: Record<string, unknown>) => [x.verdict, x]),
    );
    expect(Number(byVerdict.react.anzahl)).toBe(2);
    expect(Number(byVerdict.react.herabgestuft)).toBe(2);
    expect(Number(byVerdict.warn.herabgestuft)).toBe(0);
  });
});
