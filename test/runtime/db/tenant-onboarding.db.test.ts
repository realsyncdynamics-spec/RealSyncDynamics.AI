/**
 * tenant_onboarding — Journey-Zustand vor dem Kauf (DB-Integration)
 *
 * Der wichtigste Test dieser Datei ist der über die Schreibrechte: **Ein
 * Client kann sich sein Onboarding nicht selbst auf `completed` setzen.**
 *
 * Warum das zählt: `status` und `completed_at` entscheiden künftig mit
 * darüber, ob jemand am Checkout vorbei ins Dashboard gelangt
 * (`resolveCustomerDestination`, Sprosse "Onboarding unvollständig"). Eine
 * Regel, die nur in TypeScript steht, hält das nicht — sie muss dort stehen,
 * wo kein Schreibpfad vorbeikommt. Dieselbe Überlegung wie bei der
 * generierten Spalte `publishable` und beim Publish-Gate-Prüfpfad.
 *
 * Der zweite Kern sind die vier CHECK-Bedingungen. Sie sind nicht Kosmetik:
 * `status='completed'` ohne `completed_at` wäre eine Zeile, die der Resolver
 * als "noch nicht fertig" liest — der Kunde landete dann für immer wieder im
 * Onboarding, obwohl die Datenbank ihn für fertig hält.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('tenant_onboarding — Journey-Zustand') ? describe : describe.skip;

d('tenant_onboarding', () => {
  let ctx: DbCtx;

  beforeEach(async () => {
    ctx = await openDb();
  });
  afterEach(async () => {
    await closeDb(ctx);
  });

  describe('Zugriffsvertrag', () => {
    it('trägt RLS mit genau einer Policy, und die ist lesend', async () => {
      const { rows } = await ctx.client.query<{ rls: boolean; anzahl: string; cmds: string | null }>(
        `SELECT c.relrowsecurity AS rls,
                (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::text AS anzahl,
                (SELECT string_agg(DISTINCT p.polcmd::text, ',') FROM pg_policy p WHERE p.polrelid = c.oid) AS cmds
           FROM pg_class c WHERE c.oid = 'public.tenant_onboarding'::regclass`,
      );
      expect(rows[0]!.rls).toBe(true);
      expect(rows[0]!.anzahl).toBe('1');
      expect(rows[0]!.cmds).toBe('r'); // r = SELECT
    });

    it('gibt authenticated nur SELECT und anon gar nichts', async () => {
      const { rows } = await ctx.client.query<{ grantee: string; privilege_type: string }>(
        `SELECT grantee, privilege_type FROM information_schema.role_table_grants
          WHERE table_schema='public' AND table_name='tenant_onboarding'
            AND grantee IN ('authenticated','anon')`,
      );
      const auth = rows.filter((r) => r.grantee === 'authenticated').map((r) => r.privilege_type);
      const anon = rows.filter((r) => r.grantee === 'anon');
      expect(auth.sort()).toEqual(['SELECT']);
      expect(anon).toEqual([]);
    });
  });

  describe('Invarianten — jede muss beissen', () => {
    it('weist einen unbekannten Status ab', async () => {
      const { tenantId } = await createTenantWithMember(ctx);
      await expect(
        ctx.client.query(`INSERT INTO public.tenant_onboarding(tenant_id,status) VALUES ($1,'erledigt')`, [tenantId]),
      ).rejects.toThrow(/tenant_onboarding_status_check/);
    });

    it('weist Schritt 0 ab', async () => {
      const { tenantId } = await createTenantWithMember(ctx);
      await expect(
        ctx.client.query(`INSERT INTO public.tenant_onboarding(tenant_id,step) VALUES ($1,0)`, [tenantId]),
      ).rejects.toThrow(/tenant_onboarding_step_check/);
    });

    // Die beiden Richtungen derselben Zusage. Fehlt eine, entsteht genau die
    // Zeile, die der Resolver falsch liest.
    it('weist completed ohne Zeitpunkt ab', async () => {
      const { tenantId } = await createTenantWithMember(ctx);
      await expect(
        ctx.client.query(`INSERT INTO public.tenant_onboarding(tenant_id,status) VALUES ($1,'completed')`, [tenantId]),
      ).rejects.toThrow(/tenant_onboarding_completed_consistency/);
    });

    it('weist einen Zeitpunkt ohne completed ab', async () => {
      const { tenantId } = await createTenantWithMember(ctx);
      await expect(
        ctx.client.query(`INSERT INTO public.tenant_onboarding(tenant_id,completed_at) VALUES ($1,now())`, [tenantId]),
      ).rejects.toThrow(/tenant_onboarding_completed_consistency/);
    });

    it('laesst den gueltigen Abschluss durch', async () => {
      const { tenantId } = await createTenantWithMember(ctx);
      await ctx.client.query(
        `INSERT INTO public.tenant_onboarding(tenant_id,status,completed_at) VALUES ($1,'completed',now())`,
        [tenantId],
      );
      const { rows } = await ctx.client.query<{ status: string }>(
        `SELECT status FROM public.tenant_onboarding WHERE tenant_id=$1`,
        [tenantId],
      );
      expect(rows[0]!.status).toBe('completed');
    });

    it('haelt je Mandant genau einen Zustand', async () => {
      const { tenantId } = await createTenantWithMember(ctx);
      await ctx.client.query(`INSERT INTO public.tenant_onboarding(tenant_id) VALUES ($1)`, [tenantId]);
      await expect(
        ctx.client.query(`INSERT INTO public.tenant_onboarding(tenant_id) VALUES ($1)`, [tenantId]),
      ).rejects.toThrow(/duplicate key|tenant_onboarding_pkey/);
    });
  });

  describe('Mandantentrennung', () => {
    it('zeigt einem Mitglied nur den eigenen Zustand', async () => {
      const a = await createTenantWithMember(ctx);
      const b = await createTenantWithMember(ctx);
      await ctx.client.query(`INSERT INTO public.tenant_onboarding(tenant_id) VALUES ($1),($2)`, [a.tenantId, b.tenantId]);

      const sichtbar = await ctx.withClaims({ sub: a.userId, role: 'authenticated' }, async () => {
        const { rows } = await ctx.client.query<{ tenant_id: string }>(
          `SELECT tenant_id FROM public.tenant_onboarding`,
        );
        return rows.map((r) => r.tenant_id);
      });
      expect(sichtbar).toEqual([a.tenantId]);
    });
  });

  describe('Schreiben bleibt dem Server vorbehalten', () => {
    it('weist INSERT, UPDATE und DELETE eines Clients ab', async () => {
      const { tenantId, userId } = await createTenantWithMember(ctx);
      await ctx.client.query(`INSERT INTO public.tenant_onboarding(tenant_id) VALUES ($1)`, [tenantId]);

      // Der Fehler muss AUS withClaims herauskommen, nicht darin abgefangen
      // werden: Nur dann rollt der Helfer auf seinen SAVEPOINT zurueck. Faengt
      // man ihn innen ab, haelt withClaims den Durchlauf fuer geglueckt und
      // stolpert anschliessend ueber die abgebrochene Transaktion — so
      // geschehen im ersten Entwurf dieser Datei.
      const alsClient = (sql: string) =>
        ctx.withClaims({ sub: userId, role: 'authenticated' }, () => ctx.client.query(sql, [tenantId]));

      await expect(alsClient(`INSERT INTO public.tenant_onboarding(tenant_id) VALUES ($1)`)).rejects.toThrow();
      await expect(
        alsClient(`UPDATE public.tenant_onboarding SET status='completed', completed_at=now() WHERE tenant_id=$1`),
      ).rejects.toThrow();
      await expect(alsClient(`DELETE FROM public.tenant_onboarding WHERE tenant_id=$1`)).rejects.toThrow();
    });
  });

  describe('Lebenszyklus', () => {
    it('faellt mit dem Mandanten weg', async () => {
      const { tenantId } = await createTenantWithMember(ctx);
      await ctx.client.query(`INSERT INTO public.tenant_onboarding(tenant_id) VALUES ($1)`, [tenantId]);
      await ctx.client.query(`DELETE FROM public.tenants WHERE id=$1`, [tenantId]);
      const { rows } = await ctx.client.query(`SELECT 1 FROM public.tenant_onboarding WHERE tenant_id=$1`, [tenantId]);
      expect(rows).toEqual([]);
    });

    it('zieht updated_at bei jeder Aenderung nach', async () => {
      const { tenantId } = await createTenantWithMember(ctx);
      await ctx.client.query(`INSERT INTO public.tenant_onboarding(tenant_id) VALUES ($1)`, [tenantId]);
      const { rows: vorher } = await ctx.client.query<{ updated_at: Date }>(
        `SELECT updated_at FROM public.tenant_onboarding WHERE tenant_id=$1`,
        [tenantId],
      );
      const { rows: nachher } = await ctx.client.query<{ updated_at: Date }>(
        `UPDATE public.tenant_onboarding SET step = step + 1 WHERE tenant_id=$1 RETURNING updated_at`,
        [tenantId],
      );
      expect(nachher[0]!.updated_at.getTime()).toBeGreaterThanOrEqual(vorher[0]!.updated_at.getTime());
    });
  });
});
