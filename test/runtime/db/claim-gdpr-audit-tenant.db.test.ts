/**
 * claim_gdpr_audit — Mandantenwahl bei mehreren Mitgliedschaften.
 *
 * Belegt 20261026120000_claim_gdpr_audit_explicit_tenant.sql:
 *  - zwei owner-Mitgliedschaften ohne Angabe: Abbruch statt Raten;
 *  - expliziter Mandant: Mitgliedschaft und Rolle owner/admin;
 *  - fremder Mandant: abgewiesen;
 *  - wiederholter Claim: nur der bereits zugeordnete Mandant zaehlt.
 *
 * Vorher waehlte `ORDER BY role LIMIT 1` bei zwei owner-Zeilen beliebig.
 * In CI traf das den Signup-Mandanten aus `on_auth_user_created` (#1992).
 *
 * Ohne TEST_DB_URL wird uebersprungen (Muster der uebrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

interface ClaimRow {
  ok: boolean;
  already_claimed: boolean;
  tenant_id: string;
}

d('claim_gdpr_audit — Mandant ausdruecklich statt geraten', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  /** Nutzer mit bestaetigter E-Mail, owner in A und B, plus ein Audit auf seine Adresse. */
  async function zweiOwner(): Promise<{ userId: string; A: string; B: string; auditId: string }> {
    const email = `claim_mt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
    const a = await createTenantWithMember(ctx!, { userEmail: email });
    await ctx!.client.query(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = $1`, [a.userId]);

    // Nicht auf den Signup-Trigger verlassen: B ausdruecklich anlegen.
    const { rows } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`,
      [`t_b_${Date.now()}`],
    );
    const B = rows[0]!.id;
    await ctx!.client.query(
      `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1, $2, 'owner')
       ON CONFLICT (tenant_id, user_id) DO NOTHING`,
      [B, a.userId],
    );

    return { userId: a.userId, A: a.tenantId, B, auditId: await seedAudit(email) };
  }

  async function seedAudit(email: string): Promise<string> {
    const { rows } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO public.gdpr_audits (url, domain, email, score, severity, issues, ip_hash)
       VALUES ('https://kunde.example', 'kunde.example', $1, 70, 'medium', '[]'::jsonb, 'iphash')
       RETURNING id`,
      [email],
    );
    return rows[0]!.id;
  }

  /** Als `authenticated` — derselbe Weg wie `rpc()` aus dem SPA, Grants eingeschlossen. */
  async function claim(userId: string, auditId: string, tenantId?: string): Promise<ClaimRow> {
    const { rows } = await ctx!.withClaims({ sub: userId }, () =>
      tenantId === undefined
        ? ctx!.client.query<{ r: ClaimRow }>(`SELECT public.claim_gdpr_audit($1) AS r`, [auditId])
        : ctx!.client.query<{ r: ClaimRow }>(
            `SELECT public.claim_gdpr_audit($1, $2) AS r`, [auditId, tenantId]),
    );
    return rows[0]!.r;
  }

  async function zuordnung(auditId: string): Promise<{ tenant_id: string | null; claimed_at: Date | null }> {
    const { rows } = await ctx!.client.query<{ tenant_id: string | null; claimed_at: Date | null }>(
      `SELECT tenant_id, claimed_at FROM public.gdpr_audits WHERE id = $1`, [auditId]);
    return rows[0]!;
  }

  it('zwei owner-Mitgliedschaften ohne Angabe: Abbruch, das Audit bleibt frei', async () => {
    const { userId, auditId } = await zweiOwner();

    await expect(claim(userId, auditId)).rejects.toThrow(/tenant ambiguous/);
    expect(await zuordnung(auditId)).toEqual({ tenant_id: null, claimed_at: null });
  });

  it('zwei owner-Mitgliedschaften mit Angabe: genau der genannte Mandant', async () => {
    const { userId, B, auditId } = await zweiOwner();

    const r = await claim(userId, auditId, B);
    expect(r).toMatchObject({ ok: true, already_claimed: false, tenant_id: B });
    expect((await zuordnung(auditId)).tenant_id).toBe(B);
  });

  it('genau eine Mitgliedschaft ohne Angabe: wird uebernommen', async () => {
    const { userId, A, auditId } = await zweiOwner();
    await ctx!.client.query(
      `DELETE FROM public.memberships WHERE user_id = $1 AND tenant_id <> $2`, [userId, A]);

    const r = await claim(userId, auditId);
    expect(r).toMatchObject({ ok: true, already_claimed: false, tenant_id: A });
  });

  it('keine Mitgliedschaft: no tenant', async () => {
    const { userId, auditId } = await zweiOwner();
    await ctx!.client.query(`DELETE FROM public.memberships WHERE user_id = $1`, [userId]);

    await expect(claim(userId, auditId)).rejects.toThrow(/no tenant/);
  });

  it('fremder Mandant: abgewiesen, auch wenn der Nutzer anderswo owner ist', async () => {
    const { userId, auditId } = await zweiOwner();
    const fremd = await createTenantWithMember(ctx!);

    await expect(claim(userId, auditId, fremd.tenantId)).rejects.toThrow(/not a member/);
    expect((await zuordnung(auditId)).claimed_at).toBeNull();
  });

  it('expliziter Mandant mit Rolle editor: abgewiesen', async () => {
    const { userId, B, auditId } = await zweiOwner();
    await ctx!.client.query(
      `UPDATE public.memberships SET role = 'editor' WHERE user_id = $1 AND tenant_id = $2`, [userId, B]);

    await expect(claim(userId, auditId, B)).rejects.toThrow(/insufficient role/);
    expect((await zuordnung(auditId)).claimed_at).toBeNull();
  });

  it('wiederholter Claim ohne Angabe: already_claimed fuer den zugeordneten Mandanten', async () => {
    // Vorher: die zweite Auswahl per LIMIT 1 konnte den anderen owner-Mandanten
    // treffen und warf dann `already claimed`.
    const { userId, B, auditId } = await zweiOwner();
    await claim(userId, auditId, B);

    const r = await claim(userId, auditId);
    expect(r).toMatchObject({ ok: true, already_claimed: true, tenant_id: B });
  });

  it('wiederholter Claim mit demselben Mandanten: already_claimed', async () => {
    const { userId, B, auditId } = await zweiOwner();
    await claim(userId, auditId, B);

    const r = await claim(userId, auditId, B);
    expect(r).toMatchObject({ ok: true, already_claimed: true, tenant_id: B });
  });

  it('wiederholter Claim mit anderem Mandanten: already claimed, Zuordnung bleibt', async () => {
    const { userId, A, B, auditId } = await zweiOwner();
    await claim(userId, auditId, B);

    await expect(claim(userId, auditId, A)).rejects.toThrow(/already claimed/);
    expect((await zuordnung(auditId)).tenant_id).toBe(B);
  });

  it('wiederholter Claim ohne Rolle im zugeordneten Mandanten: already claimed', async () => {
    const { userId, B, auditId } = await zweiOwner();
    await claim(userId, auditId, B);
    await ctx!.client.query(
      `UPDATE public.memberships SET role = 'editor' WHERE user_id = $1 AND tenant_id = $2`, [userId, B]);

    await expect(claim(userId, auditId)).rejects.toThrow(/already claimed/);
  });

  it('beide Signaturen: nur authenticated darf ausfuehren, anon nicht', async () => {
    const { rows } = await ctx!.client.query<{ sig: string; anon: boolean; auth: boolean }>(`
      SELECT f::text AS sig,
             has_function_privilege('anon', f, 'EXECUTE') AS anon,
             has_function_privilege('authenticated', f, 'EXECUTE') AS auth
        FROM unnest(ARRAY[
          'public.claim_gdpr_audit(uuid)'::regprocedure,
          'public.claim_gdpr_audit(uuid, uuid)'::regprocedure
        ]) AS f
    `);
    for (const r of rows) {
      expect(r, r.sig).toMatchObject({ anon: false, auth: true });
    }
    expect(rows).toHaveLength(2);
  });
});
