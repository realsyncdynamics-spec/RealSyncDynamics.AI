/**
 * Bot-Kontingent — Durchsetzung im Schreibpfad (P0-5b).
 *
 * ## Warum gegen echtes Postgres
 *
 * `limit.bots` wurde verkauft und nirgends durchgesetzt: Bot-Anlage läuft aus
 * dem Browser direkt über PostgREST, RLS prüft nur Mitgliedschaft. Migration
 * 20260920130000 setzt einen BEFORE-INSERT-Trigger auf `public.bots`, der
 * für Clients zuerst die Mitgliedschaft prüft (Postgres wendet RLS erst NACH
 * BEFORE-Triggern an), dann je Mandant sperrt und das Kontingent aus dem
 * Entitlement-Auflöser liest. Alles daran — Trigger, Lock, SECURITY DEFINER,
 * RLS, `auth.uid()` — ist SQL und in TypeScript nicht nachbildbar.
 *
 * ## Matrix
 *
 *   free_audit                 → erster Insert abgelehnt (BOTS_NOT_ENTITLED)
 *   Starter (1)                → 1 erlaubt, 2 abgelehnt (BOT_QUOTA_EXCEEDED)
 *   Growth (2)                 → 1, 2 erlaubt, 3 abgelehnt
 *   Einmal-Grant limit.bots=-1 → unbegrenzt
 *   Add-on-Position +5 × 2     → Starter wird zu 11
 *   service_role               → dieselbe Quota, kein Freifahrtschein
 *   Fremder Nutzer             → 42501 bei Free, vollem Starter UND freiem
 *                                Growth — nie ein BOTS_*-Code (kein Leck)
 *   Bulk-INSERT über das Limit → gesamte Anweisung scheitert, 0 Zeilen
 *   Update / Deaktivieren /
 *   Löschen am Limit           → frei; Löschen gibt den Platz frei
 *   Altbestand auf Free        → bleibt, weiterer wird abgelehnt
 *   zwei gleichzeitige Inserts → genau einer bekommt den letzten Platz
 *
 * Der Testclient ist Superuser. Ohne JWT-Claims liefert der CI-Stub für
 * `auth.role()` 'authenticated' — deshalb laufen Fixture-Inserts hier mit
 * service_role-Claims, wie ein Admin-Client. In Produktion hat eine Sitzung
 * ohne JWT `auth.role() = NULL` und ist kein Client.
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { createTenantWithMember, closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const __dirname = dirname(fileURLToPath(import.meta.url));

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

interface PgError extends Error { code?: string; detail?: string }
const SERVER = { role: 'service_role' } as const;

/** Plan eines Mandanten setzen (der tenants-Trigger hat bereits ein Free-Abo angelegt). */
async function planSetzen(client: Client, tenantId: string, planKey: string): Promise<void> {
  await client.query(
    `INSERT INTO public.subscriptions (tenant_id, plan_key, status)
     VALUES ($1, $2, 'active')
     ON CONFLICT (tenant_id) DO UPDATE
       SET plan_key = EXCLUDED.plan_key, status = 'active',
           stripe_price_id = NULL, past_due_since = NULL, updated_at = now()`,
    [tenantId, planKey],
  );
}

/** Insert im Claims-/Rollenkontext; liefert 'OK' oder den DETAIL-Code bzw. SQLSTATE der Ablehnung. */
async function versuchAls(
  ctx: DbCtx,
  claims: { sub?: string; role?: string },
  tenantId: string,
  name: string,
): Promise<string> {
  try {
    await ctx.withClaims(claims, async () => {
      await ctx.client.query(`INSERT INTO public.bots (tenant_id, name) VALUES ($1, $2)`, [tenantId, name]);
    });
    return 'OK';
  } catch (e) {
    const err = e as PgError;
    return err.detail || err.code || err.message;
  }
}

/** Wegwerf-Produkt mit Entitlements, per Grant an einen Mandanten. */
async function grantAnlegen(
  client: Client,
  tenantId: string,
  opts: { source: 'manual' | 'addon_subscription'; quantity: number; entitlements: Array<[string, number]> },
): Promise<void> {
  const price = `test_${Math.random().toString(36).slice(2, 10)}`;
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.products (stripe_price_id, name) VALUES ($1, $1) RETURNING id`,
    [price],
  );
  const productId = rows[0]!.id;
  for (const [key, value] of opts.entitlements) {
    await client.query(
      `INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
       SELECT $1, e.id, $3 FROM public.entitlements e WHERE e.key = $2`,
      [productId, key, value],
    );
  }
  await client.query(
    `INSERT INTO public.entitlement_grants
       (tenant_id, product_id, plan_key, source, purchase_reference, status, quantity)
     VALUES ($1, $2, 'starter', $3, $4, 'active', $5)`,
    [tenantId, productId, opts.source, price, opts.quantity],
  );
}

d('bots — Kontingent im Schreibpfad (Trigger bots_enforce_quota)', () => {
  let ctx: DbCtx;

  beforeEach(async () => {
    ctx = await openDb();
  });

  afterEach(async () => {
    await closeDb(ctx);
  });

  it('Trigger und Funktionen existieren, Rechte sind minimal', async () => {
    const { rows } = await ctx.client.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.bots'::regclass AND tgname = 'bots_enforce_quota'`,
    );
    expect(rows.length, 'BEFORE-INSERT-Trigger fehlt').toBe(1);

    const { rows: acl } = await ctx.client.query<{ proname: string; ok: boolean }>(
      `SELECT p.proname,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ok
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('tenant_entitlements', 'tenant_entitlements_resolve', 'bots_quota')`,
    );
    const byName = new Map(acl.map((r) => [r.proname, r.ok]));
    expect(byName.get('tenant_entitlements'), 'öffentlicher Auflöser bleibt für authenticated').toBe(true);
    expect(byName.get('tenant_entitlements_resolve'), 'interner Rumpf ist nicht öffentlich').toBe(false);
    expect(byName.get('bots_quota'), 'bots_quota nur für service_role').toBe(false);
  });

  it('free_audit: kein Bot — weder als Mitglied noch als Server', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx);
    // Kein Plan gesetzt: der tenants-Trigger hat ein Free-Abo angelegt.
    expect(await versuchAls(ctx, { sub: userId }, tenantId, 'f1')).toBe('BOTS_NOT_ENTITLED');
    expect(await versuchAls(ctx, SERVER, tenantId, 'f2')).toBe('BOTS_NOT_ENTITLED');
    const { rows } = await ctx.client.query(`SELECT 1 FROM public.bots WHERE tenant_id = $1`, [tenantId]);
    expect(rows.length).toBe(0);
  });

  it('Starter (1): erster erlaubt, zweiter abgelehnt', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx);
    await planSetzen(ctx.client, tenantId, 'starter');
    expect(await versuchAls(ctx, { sub: userId }, tenantId, 's1')).toBe('OK');
    expect(await versuchAls(ctx, { sub: userId }, tenantId, 's2')).toBe('BOT_QUOTA_EXCEEDED');
  });

  it('Growth (2): 1 und 2 erlaubt, 3 abgelehnt', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx);
    await planSetzen(ctx.client, tenantId, 'growth');
    expect(await versuchAls(ctx, { sub: userId }, tenantId, 'g1')).toBe('OK');
    expect(await versuchAls(ctx, { sub: userId }, tenantId, 'g2')).toBe('OK');
    expect(await versuchAls(ctx, { sub: userId }, tenantId, 'g3')).toBe('BOT_QUOTA_EXCEEDED');
  });

  it('Einmal-Grant mit limit.bots = -1 hebt das Limit auf', async () => {
    const { tenantId } = await createTenantWithMember(ctx);
    await planSetzen(ctx.client, tenantId, 'starter');
    await grantAnlegen(ctx.client, tenantId, {
      source: 'manual', quantity: 1,
      entitlements: [['bots.enabled', 1], ['limit.bots', -1]],
    });
    for (let i = 1; i <= 6; i++) {
      expect(await versuchAls(ctx, SERVER, tenantId, `u${i}`), `Insert ${i}`).toBe('OK');
    }
  });

  it('Add-on-Position (+5, Menge 2) erhöht Starter auf 11', async () => {
    const { tenantId } = await createTenantWithMember(ctx);
    await planSetzen(ctx.client, tenantId, 'starter');
    await grantAnlegen(ctx.client, tenantId, {
      source: 'addon_subscription', quantity: 2,
      entitlements: [['limit.bots', 5]],
    });
    const { rows } = await ctx.client.query<{ max_bots: number }>(
      `SELECT max_bots FROM public.bots_quota($1)`, [tenantId],
    );
    expect(rows[0]!.max_bots, 'nur plan_catalog zu lesen wäre hier falsch').toBe(11);
    for (let i = 1; i <= 11; i++) {
      expect(await versuchAls(ctx, SERVER, tenantId, `a${i}`), `Insert ${i}`).toBe('OK');
    }
    expect(await versuchAls(ctx, SERVER, tenantId, 'a12')).toBe('BOT_QUOTA_EXCEEDED');
  });

  it('service_role unterliegt derselben Produkt-Quota', async () => {
    const { tenantId } = await createTenantWithMember(ctx);
    await planSetzen(ctx.client, tenantId, 'starter');
    expect(await versuchAls(ctx, SERVER, tenantId, 'r1')).toBe('OK');
    expect(await versuchAls(ctx, SERVER, tenantId, 'r2')).toBe('BOT_QUOTA_EXCEEDED');
  });

  it('fremder Nutzer bekommt immer 42501 — nie BOTS_NOT_ENTITLED oder BOT_QUOTA_EXCEEDED', async () => {
    // Postgres prüft WITH CHECK erst nach BEFORE-Triggern. Prüfte der Trigger
    // das Kontingent vor der Mitgliedschaft, verriete die Fehlerart einem
    // Fremden Plan und Auslastung. Drei Zustände, dreimal dieselbe Antwort.
    const frei = await createTenantWithMember(ctx);          // free_audit
    const voll = await createTenantWithMember(ctx);          // Starter, 1/1
    const offen = await createTenantWithMember(ctx);         // Growth, 0/2
    const fremd = await createTenantWithMember(ctx);
    await planSetzen(ctx.client, voll.tenantId, 'starter');
    await planSetzen(ctx.client, offen.tenantId, 'growth');
    expect(await versuchAls(ctx, SERVER, voll.tenantId, 'v1')).toBe('OK');

    expect(await versuchAls(ctx, { sub: fremd.userId }, frei.tenantId, 'x0'), 'Free').toBe('42501');
    expect(await versuchAls(ctx, { sub: fremd.userId }, voll.tenantId, 'x1'), 'Starter voll').toBe('42501');
    expect(await versuchAls(ctx, { sub: fremd.userId }, offen.tenantId, 'x2'), 'Growth unter Limit').toBe('42501');
    expect(await versuchAls(ctx, { role: 'anon' }, frei.tenantId, 'x3'), 'anon').toBe('42501');

    await ctx.withClaims({ sub: fremd.userId }, async () => {
      const { rows } = await ctx.client.query(`SELECT 1 FROM public.bots WHERE tenant_id = $1`, [voll.tenantId]);
      expect(rows.length).toBe(0);
    });
    // Und der Server sieht weiterhin die echten Codes.
    expect(await versuchAls(ctx, SERVER, frei.tenantId, 'y0')).toBe('BOTS_NOT_ENTITLED');
    expect(await versuchAls(ctx, SERVER, voll.tenantId, 'y1')).toBe('BOT_QUOTA_EXCEEDED');
  });

  it('Bulk-INSERT über das Limit: die gesamte Anweisung scheitert, 0 Zeilen', async () => {
    // Zeilenweiser BEFORE-Trigger: die zweite Zeile zählt die erste derselben
    // Anweisung bereits mit und lehnt ab — damit rollt Postgres die ganze
    // Anweisung zurück. Genau dieses Verhalten wird hier festgeschrieben.
    const { tenantId } = await createTenantWithMember(ctx);
    await planSetzen(ctx.client, tenantId, 'starter');
    let ergebnis = 'OK';
    try {
      await ctx.withClaims(SERVER, async () => {
        await ctx.client.query(
          `INSERT INTO public.bots (tenant_id, name) VALUES ($1, 'bulk-1'), ($1, 'bulk-2')`,
          [tenantId],
        );
      });
    } catch (e) {
      ergebnis = (e as PgError).detail || (e as PgError).code || 'FEHLER';
    }
    expect(ergebnis).toBe('BOT_QUOTA_EXCEEDED');
    const { rows } = await ctx.client.query(`SELECT 1 FROM public.bots WHERE tenant_id = $1`, [tenantId]);
    expect(rows.length, 'kein Teilerfolg').toBe(0);
  });

  it('Update, Deaktivieren, Löschen bleiben am Limit frei; Löschen gibt den Platz frei', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx);
    await planSetzen(ctx.client, tenantId, 'starter');
    expect(await versuchAls(ctx, { sub: userId }, tenantId, 'b1')).toBe('OK');
    await ctx.withClaims({ sub: userId }, async () => {
      await ctx.client.query(`UPDATE public.bots SET name = 'b1-neu', enabled = false WHERE tenant_id = $1`, [tenantId]);
    });
    expect(await versuchAls(ctx, { sub: userId }, tenantId, 'b2'), 'deaktiviert zählt weiter').toBe('BOT_QUOTA_EXCEEDED');
    await ctx.withClaims({ sub: userId }, async () => {
      await ctx.client.query(`DELETE FROM public.bots WHERE tenant_id = $1`, [tenantId]);
    });
    expect(await versuchAls(ctx, { sub: userId }, tenantId, 'b3')).toBe('OK');
  });

  it('Altbestand auf Free bleibt lesbar und änderbar; ein weiterer Bot wird abgelehnt', async () => {
    // Seed-Fall aus der Messung: ein Bot auf einem free_audit-Mandanten.
    // Durchsetzung ist vorwärtsgerichtet — die Zeile wird nicht angetastet.
    const { tenantId, userId } = await createTenantWithMember(ctx);
    await ctx.client.query(`ALTER TABLE public.bots DISABLE TRIGGER bots_enforce_quota`);
    await ctx.client.query(`INSERT INTO public.bots (tenant_id, name) VALUES ($1, 'alt-bestand')`, [tenantId]);
    await ctx.client.query(`ALTER TABLE public.bots ENABLE TRIGGER bots_enforce_quota`);
    await ctx.withClaims({ sub: userId }, async () => {
      const { rowCount } = await ctx.client.query(`UPDATE public.bots SET enabled = false WHERE tenant_id = $1`, [tenantId]);
      expect(rowCount).toBe(1);
    });
    expect(await versuchAls(ctx, { sub: userId }, tenantId, 'neu')).toBe('BOTS_NOT_ENTITLED');
  });

  it('tenant_entitlements() antwortet weiterhin nur Mitglied und Server', async () => {
    // Die Migration teilt den Auflöser in Rumpf und Hülle. Die Regel der
    // Hülle ist dieselbe wie vorher — geprüft in
    // tenant-entitlements-callers.db.test.ts; hier nur der Rauchtest.
    const { tenantId, userId } = await createTenantWithMember(ctx);
    const fremd = await createTenantWithMember(ctx);
    await planSetzen(ctx.client, tenantId, 'starter');
    const zaehle = async (claims: { sub?: string; role?: string }) =>
      ctx.withClaims(claims, async () => {
        const { rows } = await ctx.client.query(`SELECT 1 FROM public.tenant_entitlements($1)`, [tenantId]);
        return rows.length;
      });
    expect(await zaehle({ sub: userId })).toBeGreaterThan(0);
    expect(await zaehle(SERVER)).toBeGreaterThan(0);
    expect(await zaehle({ sub: fremd.userId })).toBe(0);
  });
});

d('Release-Gate der Migration 20260920130000 — Endzustand von #1491', () => {
  /**
   * Das Gate wird aus der Migrationsdatei gelesen und gegen das volle Schema
   * ausgeführt: einmal so, wie es ist (muss durchlaufen), einmal mit dem
   * Live-Befund nachgestellt — Enterprise-Produkt ohne Bot-Zuordnung — (muss
   * abbrechen). Beides innerhalb der Test-Transaktion, nichts bleibt zurück.
   */
  const MIGRATION = join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20260920130000_bots_quota_enforcement.sql');
  const sql = readFileSync(MIGRATION, 'utf8');
  const gate = sql.slice(
    sql.indexOf('-- >>> RELEASE-GATE >>>') + '-- >>> RELEASE-GATE >>>'.length,
    sql.indexOf('-- <<< RELEASE-GATE <<<'),
  );

  let ctx: DbCtx;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); });

  it('läuft auf dem vollständigen Katalog durch', async () => {
    expect(gate).toContain('DO $$');
    await expect(ctx.client.query(gate)).resolves.toBeDefined();
  });

  it('bricht ab, wenn das Enterprise-Produkt die Bot-Zuordnung nicht trägt (Live-Befund)', async () => {
    const { rowCount } = await ctx.client.query(
      `DELETE FROM public.product_entitlements pe
        USING public.products p, public.entitlements e
       WHERE pe.product_id = p.id AND pe.entitlement_id = e.id
         AND p.default_for_plan_key = 'enterprise'
         AND e.key IN ('bots.enabled', 'limit.bots', 'bots.chat')`,
    );
    expect(rowCount, 'Vorbedingung: Enterprise trägt die Keys im migrierten Schema').toBeGreaterThan(0);
    await expect(ctx.client.query(gate)).rejects.toThrow(/Release-Gate: Entitlement-Parität aus 20260920120000/);
  });

  it('bricht ab, wenn gar kein Enterprise-Produkt existiert (fail closed statt leerer Menge)', async () => {
    // #1491 joint an vorhandene products — ohne Enterprise-Produkt kann es
    // nichts zuordnen. Diesen Zustand darf 20260920130000 nicht akzeptieren.
    const { rowCount } = await ctx.client.query(
      `UPDATE public.products SET default_for_plan_key = NULL
        WHERE default_for_plan_key IN ('enterprise', 'enterprise_yearly')`,
    );
    expect(rowCount, 'Vorbedingung: mindestens ein Enterprise-Produkt im Schema').toBeGreaterThan(0);
    await expect(ctx.client.query(gate)).rejects.toThrow(/Release-Gate/);
  });

  it('bricht auch ab, wenn nur limit.bots fehlt', async () => {
    await ctx.client.query(
      `DELETE FROM public.product_entitlements pe
        USING public.products p, public.entitlements e
       WHERE pe.product_id = p.id AND pe.entitlement_id = e.id
         AND p.default_for_plan_key = 'enterprise' AND e.key = 'limit.bots'`,
    );
    await expect(ctx.client.query(gate)).rejects.toThrow(/Release-Gate/);
  });
});

d('bots — zwei gleichzeitige Inserts bekommen nicht beide den letzten Platz', () => {
  /**
   * Braucht zwei echte Verbindungen und festgeschriebene Fixtures — der
   * Advisory-Lock wirkt zwischen Transaktionen, nicht innerhalb einer. Die
   * Fixtures werden im finally wieder entfernt.
   */
  it('Growth (2) mit einem Bot: A und B parallel → genau ein Erfolg, zwei Bots', async () => {
    const url = getDbUrl()!;
    const admin = new Client({ connectionString: url });
    const a = new Client({ connectionString: url });
    const b = new Client({ connectionString: url });
    await Promise.all([admin.connect(), a.connect(), b.connect()]);
    // Admin-Kontext auf allen drei Verbindungen (siehe Kopf der Datei).
    const claims = JSON.stringify({ role: 'service_role' });
    for (const c of [admin, a, b]) {
      await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [claims]);
    }

    const suffix = Math.random().toString(36).slice(2, 8);
    let tenantId: string | null = null;
    let userId: string | null = null;
    try {
      const t = await admin.query<{ id: string }>(`INSERT INTO public.tenants (name) VALUES ($1) RETURNING id`, [`race_${suffix}`]);
      tenantId = t.rows[0]!.id;
      const u = await admin.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, [`race_${suffix}@example.com`]);
      userId = u.rows[0]!.id;
      await admin.query(`INSERT INTO public.memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')`, [tenantId, userId]);
      await planSetzen(admin, tenantId, 'growth');
      await admin.query(`INSERT INTO public.bots (tenant_id, name) VALUES ($1, 'vorhanden')`, [tenantId]);

      // A öffnet die Transaktion und hält den Lock; B läuft in die Wartestellung.
      await a.query('BEGIN');
      await a.query(`INSERT INTO public.bots (tenant_id, name) VALUES ($1, 'A')`, [tenantId]);
      const bVersuch = b
        .query(`INSERT INTO public.bots (tenant_id, name) VALUES ($1, 'B')`, [tenantId])
        .then(() => 'OK')
        .catch((e: PgError) => e.detail || e.code || e.message);
      await new Promise((r) => setTimeout(r, 300));
      await a.query('COMMIT');

      expect(await bVersuch, 'B zählt nach dem Lock die Zeile von A mit').toBe('BOT_QUOTA_EXCEEDED');
      const { rows } = await admin.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.bots WHERE tenant_id = $1`, [tenantId]);
      expect(Number(rows[0]!.n)).toBe(2);
    } finally {
      try { await a.query('ROLLBACK'); } catch { /* bereits beendet */ }
      if (tenantId) {
        await admin.query(`DELETE FROM public.bots WHERE tenant_id = $1`, [tenantId]);
        await admin.query(`DELETE FROM public.subscriptions WHERE tenant_id = $1`, [tenantId]);
        await admin.query(`DELETE FROM public.memberships WHERE tenant_id = $1`, [tenantId]);
        await admin.query(`DELETE FROM public.tenants WHERE id = $1`, [tenantId]);
      }
      if (userId) await admin.query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
      await Promise.all([admin.end(), a.end(), b.end()]);
    }
  });
});
