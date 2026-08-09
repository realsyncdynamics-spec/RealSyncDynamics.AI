/**
 * P0-Sicherheitshärtung — Regressionstest zu 20260820000000_p0_security_hardening.sql
 *
 * Deckt die Befunde C-01, C-03 und H-01…H-04 aus
 * docs/audits/CODE_REALITY_AUDIT_2026-08-09.md ab.
 *
 * Warum dieser Test existiert
 * ---------------------------
 * Zum Zeitpunkt des Audits liefen 2851 Unit-Tests grün, während 33 Tabellen
 * ohne RLS und 7 anon-freigegebene IDOR-RPCs im Repo lagen. Der Grund: die
 * einzige RLS-Suite deckte 4 Assertions auf einer Tabelle ab und lief in CI
 * überhaupt nicht (TEST_DB_URL war nie gesetzt). Ein Sicherheitsversprechen,
 * das kein Test prüft, hält genau so lange wie die Aufmerksamkeit der Person,
 * die es zuletzt gelesen hat.
 *
 * Die Tests hier sind bewusst als Invarianten über das GESAMTE Schema
 * formuliert, nicht als Liste einzelner Tabellennamen. Eine neue Tabelle ohne
 * RLS lässt den ersten Test fallen, ohne dass jemand ihn anfassen muss —
 * genau das fehlte bisher.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

/**
 * Bewusst öffentliche Referenzkataloge ohne Mandantenbezug. Für sie ist
 * `USING (true)` die richtige Antwort: es sind Nachschlagewerke (DSGVO-/
 * ISO-Kontrollkataloge, Webhook-Event-Typen, Vorlagen), keine Kundendaten.
 * Wer hier etwas hinzufügt, muss sich rechtfertigen — deshalb steht die
 * Liste im Test und nicht in einer Konfiguration.
 */
const INTENTIONAL_PUBLIC_READ = new Set([
  'compliance_frameworks',
  'framework_controls',
  'iso_control_definitions',
  'iso_control_mappings',
  'policy_pack_catalog',
  'policy_pack_controls',
  'webhook_event_types',
  'agent_profiles',
  'workflow_templates',
  'sub_processor_changes',
  'sub_processor_subscriptions',
]);

d('P0 hardening — schema-wide invariants (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  // ── C-03 ────────────────────────────────────────────────────────────
  it('jede Tabelle in public hat RLS aktiviert', async () => {
    const { rows } = await ctx!.client.query<{ relname: string }>(`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND NOT c.relrowsecurity
      ORDER BY c.relname
    `);
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  // ── H-01…H-04 ───────────────────────────────────────────────────────
  it('keine permissive Policy trifft PUBLIC/anon/authenticated ausserhalb der Katalog-Ausnahmen', async () => {
    const { rows } = await ctx!.client.query<{ tablename: string; policyname: string; roles: string }>(`
      SELECT tablename, policyname, roles::text AS roles
      FROM pg_policies
      WHERE schemaname = 'public'
        AND (qual = 'true' OR with_check = 'true')
        AND NOT (roles::text[] @> ARRAY['service_role'] AND array_length(roles::text[], 1) = 1)
        AND roles::text <> '{postgres}'
      ORDER BY tablename, policyname
    `);
    const unexpected = rows.filter((r) => !INTENTIONAL_PUBLIC_READ.has(r.tablename));
    expect(unexpected.map((r) => `${r.tablename}.${r.policyname} → ${r.roles}`)).toEqual([]);
  });

  it('eine permissive Policy, die "Service role" heisst, gilt auch nur fuer service_role', async () => {
    // Der eigentliche Fehler war nie die Absicht, sondern die fehlende
    // TO-Klausel: ohne sie gilt eine Policy in Postgres fuer PUBLIC.
    //
    // Wichtig ist die Einschraenkung auf PERMISSIVE Policies. Das Repo nutzt
    // an mehreren Stellen bewusst das Gegenteil — etwa
    //   CREATE POLICY "vps_ssh_keys ist nur für Service-Role lesbar"
    //     ON ... FOR ALL USING (false) WITH CHECK (false);
    // Eine solche Policy heisst zwar "service role", richtet sich an PUBLIC
    // und ist trotzdem korrekt: sie sperrt jeden, und service_role kommt
    // ueber BYPASSRLS daran vorbei, ohne eine eigene Policy zu brauchen.
    // Das ist fail-closed und genau richtig. Nur `USING (true)` ohne
    // TO-Klausel ist der Fehler.
    const { rows } = await ctx!.client.query<{ tablename: string; policyname: string; roles: string }>(`
      SELECT tablename, policyname, roles::text AS roles
      FROM pg_policies
      WHERE schemaname = 'public'
        AND policyname ILIKE '%service%role%'
        AND (qual = 'true' OR with_check = 'true')
        AND NOT (roles::text[] @> ARRAY['service_role'])
      ORDER BY tablename, policyname
    `);
    expect(rows.map((r) => `${r.tablename}.${r.policyname} → ${r.roles}`)).toEqual([]);
  });

  // ── C-01 ────────────────────────────────────────────────────────────
  it('kein SECURITY-DEFINER-RPC mit Tenant-Parameter ist fuer anon ausfuehrbar', async () => {
    // Das Muster, nicht die Namensliste: SECURITY DEFINER umgeht RLS, und
    // wenn die Mandanten-ID zugleich ein Aufruferparameter ist, ist jede
    // anon-Freigabe ein IDOR — unabhaengig davon, wie die Funktion heisst.
    const { rows } = await ctx!.client.query<{ proname: string; args: string }>(`
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosecdef
        AND pg_get_function_identity_arguments(p.oid) ILIKE '%uuid%'
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
        AND p.proname NOT IN (
          -- Token-basierte Public-Endpunkte: der Parameter IST das Geheimnis,
          -- nicht eine erratbare Objekt-ID.
          'audit_share_get', 'get_rebuild_status_by_token'
        )
      ORDER BY p.proname
    `);
    expect(rows.map((r) => `${r.proname}(${r.args})`)).toEqual([]);
  });

  it('jede SECURITY-DEFINER-Funktion hat einen gesetzten search_path', async () => {
    const { rows } = await ctx!.client.query<{ proname: string }>(`
      SELECT p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosecdef
        AND (p.proconfig IS NULL
             OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'))
      ORDER BY p.proname
    `);
    expect(rows.map((r) => r.proname)).toEqual([]);
  });

  // ── Funktionaler Nachweis statt nur Metadaten ───────────────────────
  it('Steuerdaten sind zwischen Mandanten tatsaechlich isoliert', async () => {
    // tax_documents stand im Audit als schwerster Einzelfall: personen-
    // bezogene Steuerdaten in einem DSGVO-Produkt, komplett ohne RLS.
    const A = await createTenantWithMember(ctx!, { tenantName: 'tax-A', userEmail: 'a@example.com' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'tax-B', userEmail: 'b@example.com' });

    const yearOf = async (tenantId: string, label: string) => {
      const { rows } = await ctx!.client.query<{ id: string }>(
        `INSERT INTO public.tax_years (tenant_id, year, status)
         VALUES ($1, $2, 'open') RETURNING id`,
        [tenantId, label === 'A' ? 2024 : 2025],
      );
      return rows[0]!.id;
    };
    await yearOf(A.tenantId, 'A');
    await yearOf(B.tenantId, 'B');

    await ctx!.withClaims({ sub: B.userId }, async () => {
      const { rows } = await ctx!.client.query<{ tenant_id: string }>(
        `SELECT tenant_id FROM public.tax_years`,
      );
      expect(rows.every((r) => r.tenant_id === B.tenantId)).toBe(true);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('ein Nicht-Mitglied sieht keine fremden Inventardaten', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'inv-A', userEmail: 'ia@example.com' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'inv-B', userEmail: 'ib@example.com' });

    await ctx!.client.query(
      `INSERT INTO public.inventory_locations (tenant_id, code, name, kind)
       VALUES ($1, 'LAGER-A', 'Lager A', 'warehouse')`,
      [A.tenantId],
    );

    await ctx!.withClaims({ sub: B.userId }, async () => {
      const { rows } = await ctx!.client.query<{ n: string }>(
        `SELECT count(*)::int AS n FROM public.inventory_locations`,
      );
      expect(Number(rows[0]!.n)).toBe(0);
    });
  });

  // ── C-02 ────────────────────────────────────────────────────────────
  it('die erste bezahlte Subscription eines Tenants laesst sich provisionieren', async () => {
    // Reproduziert exakt die Sequenz, an der der Webhook scheiterte:
    //   1. Tenant anlegen  → Trigger legt Free-Tier-Zeile an,
    //                        stripe_subscription_id = NULL
    //   2. Zahlung         → Webhook-Upsert mit dem bezahlten Abo
    //
    // Mit onConflict 'stripe_subscription_id' (dem alten Stand) wird Schritt 2
    // zum INSERT, weil Postgres NULLs in Unique-Indizes als verschieden
    // behandelt — und verletzt subscriptions_tenant_id_key mit 23505.
    // Der Test bildet den Upsert so nach, wie die Edge Function ihn schickt.
    const A = await createTenantWithMember(ctx!, { tenantName: 'billing-A', userEmail: 'bill@example.com' });

    const { rows: before } = await ctx!.client.query<{ plan_key: string; stripe_subscription_id: string | null }>(
      `SELECT plan_key, stripe_subscription_id FROM public.subscriptions WHERE tenant_id = $1`,
      [A.tenantId],
    );
    // Der Free-Tier-Trigger muss die Vorbedingung ueberhaupt erst herstellen —
    // ohne ihn testet dieser Fall nichts.
    expect(before).toHaveLength(1);
    expect(before[0]!.plan_key).toBe('free_tier');
    expect(before[0]!.stripe_subscription_id).toBeNull();

    await ctx!.client.query(
      `INSERT INTO public.subscriptions
         (tenant_id, stripe_customer_id, stripe_subscription_id, plan_key, status, billing_interval)
       VALUES ($1, 'cus_test', 'sub_test', 'growth', 'active', 'month')
       ON CONFLICT (tenant_id) DO UPDATE SET
         stripe_customer_id     = EXCLUDED.stripe_customer_id,
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         plan_key               = EXCLUDED.plan_key,
         status                 = EXCLUDED.status`,
      [A.tenantId],
    );

    const { rows: after } = await ctx!.client.query<{ plan_key: string; stripe_subscription_id: string }>(
      `SELECT plan_key, stripe_subscription_id FROM public.subscriptions WHERE tenant_id = $1`,
      [A.tenantId],
    );
    expect(after).toHaveLength(1);           // genau ein Abo pro Tenant bleibt gewahrt
    expect(after[0]!.plan_key).toBe('growth');
    expect(after[0]!.stripe_subscription_id).toBe('sub_test');
  });

  it('subscriptions traegt UNIQUE(tenant_id) — die Regel, gegen die der Upsert laufen muss', async () => {
    const { rows } = await ctx!.client.query<{ n: string }>(`
      SELECT count(*)::int AS n FROM pg_constraint
      WHERE conname = 'subscriptions_tenant_id_key' AND contype = 'u'
    `);
    expect(Number(rows[0]!.n)).toBe(1);
  });

  it('eine unauthentifizierte Session sieht keine Steuerdaten', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'tax-anon', userEmail: 'anon@example.com' });
    await ctx!.client.query(
      `INSERT INTO public.tax_years (tenant_id, year, status) VALUES ($1, 2024, 'open')`,
      [A.tenantId],
    );

    await ctx!.withClaims({}, async () => {
      const { rows } = await ctx!.client.query<{ n: string }>(
        `SELECT count(*)::int AS n FROM public.tax_years`,
      );
      expect(Number(rows[0]!.n)).toBe(0);
    });
  });
});
