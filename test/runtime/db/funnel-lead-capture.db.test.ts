/**
 * Funnel-Lead-Erfassung (Migration 20261015120000) gegen das voll migrierte
 * Schema: Deduplizierung, zwei Ansprechpartner einer Domain, serverseitige
 * Validierung, Scan-Fehler ohne Lead-Verlust, Registrierung übernimmt die
 * Zuordnung, Pilot/Kunde aus subscriptions, Rechte und Tenant-Isolation.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('funnel-lead-capture') ? describe : describe.skip;

async function capture(
  ctx: DbCtx,
  email: string,
  domain: string,
  opts: { source?: string; stage?: string; consent?: boolean; company?: string | null } = {},
): Promise<{ lead_id: string; is_new: boolean }> {
  const { rows } = await ctx.client.query<{ lead_id: string; is_new: boolean }>(
    `SELECT * FROM public.capture_funnel_lead($1, $2, $3, $4, $5, '/audit', 'iphash', 'ua', $6, $7, '{}'::jsonb)`,
    [
      email,
      domain,
      opts.company ?? null,
      opts.source ?? 'governance_scan',
      opts.stage ?? 'scan_started',
      opts.consent ?? false,
      opts.consent ? 'audit_followup_v1_de' : null,
    ],
  );
  return rows[0]!;
}

async function expectSqlState(ctx: DbCtx, sql: string, params: unknown[], state: string): Promise<void> {
  await ctx.client.query('SAVEPOINT expect_fail');
  try {
    await ctx.client.query(sql, params);
    await ctx.client.query('RELEASE SAVEPOINT expect_fail');
    throw new Error(`expected SQLSTATE ${state}, statement succeeded`);
  } catch (err) {
    await ctx.client.query('ROLLBACK TO SAVEPOINT expect_fail');
    expect((err as { code?: string }).code).toBe(state);
  }
}

async function lead(ctx: DbCtx, key: string) {
  const { rows } = await ctx.client.query<{
    id: string; funnel_stage: string; audit_id: string | null; tenant_id: string | null;
    user_id: string | null; submission_count: number; source: string; company: string | null;
    marketing_consent: boolean; converted_at: string | null;
  }>(`SELECT * FROM public.sales_leads WHERE lead_key = $1`, [key]);
  return rows;
}

async function insertAudit(ctx: DbCtx, email: string, leadId: string): Promise<string> {
  const { rows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.gdpr_audits (url, domain, email, score, severity, issues, ip_hash, sales_lead_id)
     VALUES ('https://kunde.example', 'kunde.example', $1, 70, 'medium', '[]'::jsonb, 'iphash', $2)
     RETURNING id`,
    [email, leadId],
  );
  return rows[0]!.id;
}

d('funnel lead capture (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('1/4: valid lead is stored once; a repeat submission refreshes the same row', async () => {
    const first = await capture(ctx!, 'Lead@Kunde.example', 'kunde.example', { company: 'Kunde GmbH' });
    expect(first.is_new).toBe(true);
    const again = await capture(ctx!, 'lead@kunde.example', 'KUNDE.example', { source: 'landing', stage: 'captured', consent: true });
    expect(again).toEqual({ lead_id: first.lead_id, is_new: false });

    const rows = await lead(ctx!, 'lead@kunde.example|kunde.example');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      submission_count: 2,
      source: 'governance_scan',     // erste Quelle bleibt
      company: 'Kunde GmbH',
      funnel_stage: 'scan_started',  // 'captured' stuft nicht zurück
      marketing_consent: false,      // Einwilligung nur beim ersten Erfassen
    });
  });

  it('5: two contacts of the same domain stay separate leads', async () => {
    const a = await capture(ctx!, 'ceo@kunde.example', 'kunde.example');
    const b = await capture(ctx!, 'cfo@kunde.example', 'kunde.example');
    expect(a.lead_id).not.toBe(b.lead_id);
    const { rows } = await ctx!.client.query(
      `SELECT count(*)::int AS n FROM public.sales_leads WHERE company_domain = 'kunde.example' AND lead_key IS NOT NULL`,
    );
    expect(rows[0].n).toBe(2);
  });

  it('2/3: invalid domain, e-mail, source and stage are rejected server-side', async () => {
    const sql = `SELECT public.capture_funnel_lead($1, $2, NULL, $3, $4)`;
    await expectSqlState(ctx!, sql, ['x@kunde.example', 'localhost', 'governance_scan', 'captured'], '22023');
    await expectSqlState(ctx!, sql, ['x@kunde.example', '192.168.0.1', 'governance_scan', 'captured'], '22023');
    await expectSqlState(ctx!, sql, ['kein-at-zeichen', 'kunde.example', 'governance_scan', 'captured'], '22023');
    await expectSqlState(ctx!, sql, ['a|b@kunde.example', 'kunde.example', 'governance_scan', 'captured'], '22023');
    await expectSqlState(ctx!, sql, ['x@kunde.example', 'kunde.example', 'evil', 'captured'], '22023');
    await expectSqlState(ctx!, sql, ['x@kunde.example', 'kunde.example', 'landing', 'registered'], '22023');
  });

  it('7: a failed scan keeps the lead; a retry is allowed; completion links the audit', async () => {
    const { lead_id } = await capture(ctx!, 'lead@kunde.example', 'kunde.example');
    const failed = await ctx!.client.query(`SELECT public.mark_funnel_lead_scan($1, 'failed') AS s`, [lead_id]);
    expect(failed.rows[0].s).toBe('scan_failed');
    expect(await lead(ctx!, 'lead@kunde.example|kunde.example')).toHaveLength(1);

    await capture(ctx!, 'lead@kunde.example', 'kunde.example');
    expect((await lead(ctx!, 'lead@kunde.example|kunde.example'))[0]!.funnel_stage).toBe('scan_started');

    const auditId = await insertAudit(ctx!, 'lead@kunde.example', lead_id);
    const done = await ctx!.client.query(`SELECT public.mark_funnel_lead_scan($1, 'completed', $2) AS s`, [lead_id, auditId]);
    expect(done.rows[0].s).toBe('scan_completed');
    // spätere Fehlversuche stufen nicht zurück
    await ctx!.client.query(`SELECT public.mark_funnel_lead_scan($1, 'failed')`, [lead_id]);
    expect((await lead(ctx!, 'lead@kunde.example|kunde.example'))[0]).toMatchObject({
      funnel_stage: 'scan_completed', audit_id: auditId,
    });
    await expectSqlState(ctx!, `SELECT public.mark_funnel_lead_scan($1, 'completed')`, [lead_id], '22023');
  });

  it('10: claiming the audit after registration links tenant and user to exactly that lead', async () => {
    const email = `lead_${Date.now()}@kunde.example`;
    const { tenantId, userId } = await createTenantWithMember(ctx!, { userEmail: email });
    const { lead_id } = await capture(ctx!, email, 'kunde.example');
    const other = await capture(ctx!, 'cfo@kunde.example', 'kunde.example');
    const auditId = await insertAudit(ctx!, email, lead_id);
    await ctx!.client.query(`SELECT public.mark_funnel_lead_scan($1, 'completed', $2)`, [lead_id, auditId]);

    // Claim wie audit-claim / claim_gdpr_audit: Service-Role setzt die Spalten.
    await ctx!.client.query(
      `UPDATE public.gdpr_audits SET tenant_id = $1, user_id = $2, claimed_at = now() WHERE id = $3`,
      [tenantId, userId, auditId],
    );
    const rows = await lead(ctx!, `${email}|kunde.example`);
    expect(rows[0]).toMatchObject({ funnel_stage: 'registered', tenant_id: tenantId, user_id: userId });
    const { rows: o } = await ctx!.client.query(`SELECT tenant_id FROM public.sales_leads WHERE id = $1`, [other.lead_id]);
    expect(o[0].tenant_id).toBeNull();
  });

  it('pilot and paid subscription emit funnel events and mark the lead converted; billing never blocks', async () => {
    const email = `pilot_${Date.now()}@kunde.example`;
    const { tenantId, userId } = await createTenantWithMember(ctx!, { userEmail: email });
    const { lead_id } = await capture(ctx!, email, 'kunde.example');
    const auditId = await insertAudit(ctx!, email, lead_id);
    await ctx!.client.query(
      `UPDATE public.gdpr_audits SET tenant_id = $1, user_id = $2, claimed_at = now() WHERE id = $3`,
      [tenantId, userId, auditId],
    );
    // Der Mandant hat per Trigger bereits ein Free-Abo; Testphase und Kauf
    // aktualisieren dieselbe Zeile (UNIQUE tenant_id).
    await ctx!.client.query(
      `UPDATE public.subscriptions SET status = 'trialing', trial_end = now() + interval '14 days' WHERE tenant_id = $1`,
      [tenantId],
    );
    await ctx!.client.query(
      `UPDATE public.subscriptions SET status = 'active', stripe_subscription_id = $2 WHERE tenant_id = $1`,
      [tenantId, `sub_test_${Date.now()}`],
    );
    const { rows: ev } = await ctx!.client.query(
      `SELECT event_name, metadata FROM public.marketing_events WHERE tenant_id = $1 ORDER BY created_at, event_name`,
      [tenantId],
    );
    expect(ev.map((e) => e.event_name).sort()).toEqual(['pilot_started', 'subscription_activated']);
    expect(JSON.stringify(ev)).not.toContain(email);
    expect((await lead(ctx!, `${email}|kunde.example`))[0]!.converted_at).not.toBeNull();

    // Fehler im Mess-Trigger darf den Abo-Schreibvorgang nicht verhindern.
    await ctx!.client.query(`ALTER TABLE public.marketing_events ADD CONSTRAINT tmp_block CHECK (event_name <> 'pilot_started') NOT VALID`);
    const t2 = await createTenantWithMember(ctx!);
    await ctx!.client.query(`UPDATE public.subscriptions SET status = 'trialing' WHERE tenant_id = $1`, [t2.tenantId]);
    const { rows: s2 } = await ctx!.client.query(`SELECT status FROM public.subscriptions WHERE tenant_id = $1`, [t2.tenantId]);
    expect(s2[0].status).toBe('trialing');
  });

  it('8/9/13: anon and tenants cannot capture or read leads; admin RPCs need the platform role', async () => {
    const email = `iso_${Date.now()}@kunde.example`;
    const member = await createTenantWithMember(ctx!, { userEmail: email });
    const { lead_id } = await capture(ctx!, email, 'kunde.example');
    const auditId = await insertAudit(ctx!, email, lead_id);
    await ctx!.client.query(
      `UPDATE public.gdpr_audits SET tenant_id = $1, user_id = $2, claimed_at = now() WHERE id = $3`,
      [member.tenantId, member.userId, auditId],
    );

    // Auch der eigene Mandant sieht seinen Lead nicht.
    const visible = await ctx!.withClaims({ sub: member.userId, role: 'authenticated' }, async () =>
      (await ctx!.client.query(`SELECT count(*)::int AS n FROM public.sales_leads`)).rows[0].n);
    expect(visible).toBe(0);

    await expect(ctx!.withClaims({ sub: member.userId, role: 'authenticated' }, () =>
      ctx!.client.query(`SELECT * FROM public.admin_funnel_leads()`))).rejects.toMatchObject({ code: '42501' });
    await expect(ctx!.withClaims({ sub: member.userId, role: 'authenticated' }, () =>
      ctx!.client.query(`SELECT public.admin_funnel_kpis()`))).rejects.toMatchObject({ code: '42501' });
    await expect(ctx!.withClaims({ sub: member.userId, role: 'authenticated' }, () =>
      ctx!.client.query(`SELECT public.capture_funnel_lead('x@kunde.example', 'kunde.example')`))).rejects.toMatchObject({ code: '42501' });

    // anon: weder Tabelle noch RPC (je eigener Savepoint, damit ein
    // erwarteter Fehler die Test-Transaktion nicht abbricht).
    const asAnon = async <T,>(fn: () => Promise<T>): Promise<T | { code?: string }> => {
      await ctx!.client.query('SAVEPOINT anon_sp');
      await ctx!.client.query(`SELECT set_config('request.jwt.claims', '{"role":"anon"}', true)`);
      await ctx!.client.query('SET LOCAL ROLE anon');
      try {
        const out = await fn();
        await ctx!.client.query('RELEASE SAVEPOINT anon_sp');
        await ctx!.client.query('RESET ROLE');
        return out;
      } catch (e) {
        await ctx!.client.query('ROLLBACK TO SAVEPOINT anon_sp');
        await ctx!.client.query('RESET ROLE');
        return e as { code?: string };
      }
    };
    const anonRead = await asAnon(async () =>
      (await ctx!.client.query(`SELECT count(*)::int AS n FROM public.sales_leads`)).rows[0].n as number);
    // Entweder RLS liefert 0 Zeilen oder die Tabelle ist gar nicht freigegeben.
    expect(anonRead === 0 || (anonRead as { code?: string }).code === '42501').toBe(true);
    const anonCapture = await asAnon(() =>
      ctx!.client.query(`SELECT public.capture_funnel_lead('x@kunde.example', 'kunde.example')`));
    expect((anonCapture as { code?: string }).code).toBe('42501');
    const anonAdmin = await asAnon(() => ctx!.client.query(`SELECT * FROM public.admin_funnel_leads()`));
    expect((anonAdmin as { code?: string }).code).toBe('42501');

    // Plattform-Operator sieht Trichter und Kennzahlen.
    const op = await createTenantWithMember(ctx!);
    await ctx!.client.query(`INSERT INTO public.platform_operators (user_id) VALUES ($1)`, [op.userId]);
    const rows = await ctx!.withClaims({ sub: op.userId, role: 'authenticated' }, async () =>
      (await ctx!.client.query(`SELECT email, conversion_stage, registered FROM public.admin_funnel_leads()`)).rows);
    // Übernommen heißt: Ein Audit existiert — Stufe „Scan abgeschlossen“.
    expect(rows).toContainEqual({ email, conversion_stage: 'scan_completed', registered: true });
    const kpis = await ctx!.withClaims({ sub: op.userId, role: 'authenticated' }, async () =>
      (await ctx!.client.query(`SELECT public.admin_funnel_kpis(30) AS k`)).rows[0].k);
    expect(kpis.leads_total).toBeGreaterThanOrEqual(1);
    expect(kpis).toHaveProperty('pilot_to_customer_rate');
  });

  it('11: no follow-up mail series is due without consent — a scan alone is no opt-in', async () => {
    const { rows: hasDrip } = await ctx!.client.query(
      `SELECT to_regclass('public.audit_email_drip') IS NOT NULL AS ok`,
    );
    if (!hasDrip[0].ok) return; // Live-Ledger ohne Drip-Objekte: Gate wird übersprungen (siehe Migration).
    const mk = async (email: string, consent: boolean) => (await ctx!.client.query<{ id: string }>(
      `INSERT INTO public.gdpr_audits (url, domain, email, score, severity, issues, ip_hash,
                                       marketing_consent, marketing_consent_text_version)
       VALUES ('https://kunde.example', 'kunde.example', $1, 70, 'medium', '[]'::jsonb, 'iphash', $2, $3)
       RETURNING id`,
      [email, consent, consent ? 'audit_followup_v1_de' : null],
    )).rows[0]!.id;
    const without = await mk(`noconsent_${Date.now()}@kunde.example`, false);
    const withConsent = await mk(`consent_${Date.now()}@kunde.example`, true);
    // Die Serie entsteht weiterhin per Trigger — fällig wird sie nur mit Einwilligung.
    await ctx!.client.query(
      `UPDATE public.audit_email_drip SET next_send_at = now() - interval '1 minute' WHERE audit_id IN ($1, $2)`,
      [without, withConsent],
    );
    const { rows: due } = await ctx!.client.query<{ audit_id: string }>(
      `SELECT audit_id FROM public.audit_email_drip_due(1000)`,
    );
    const ids = due.map((r) => r.audit_id);
    expect(ids).toContain(withConsent);
    expect(ids).not.toContain(without);

    // Widerruf beendet die Serie.
    await ctx!.client.query(`UPDATE public.gdpr_audits SET marketing_consent_revoked_at = now() WHERE id = $1`, [withConsent]);
    const { rows: after } = await ctx!.client.query<{ audit_id: string }>(
      `SELECT audit_id FROM public.audit_email_drip_due(1000)`,
    );
    expect(after.map((r) => r.audit_id)).not.toContain(withConsent);
  });

  it('retention purge removes only inactive leads without account, purchase or consent', async () => {
    await capture(ctx!, 'old@kunde.example', 'kunde.example');
    await capture(ctx!, 'optin@kunde.example', 'kunde.example', { consent: true });
    await ctx!.client.query(`UPDATE public.sales_leads SET last_activity_at = now() - interval '2 years' WHERE lead_key IS NOT NULL`);
    await expectSqlState(ctx!, `SELECT public.purge_stale_funnel_leads(interval '1 day')`, [], '22023');
    const { rows } = await ctx!.client.query(`SELECT public.purge_stale_funnel_leads(interval '12 months') AS n`);
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
    expect(await lead(ctx!, 'old@kunde.example|kunde.example')).toHaveLength(0);
    expect(await lead(ctx!, 'optin@kunde.example|kunde.example')).toHaveLength(1);
  });
});
