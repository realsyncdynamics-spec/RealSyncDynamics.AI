/**
 * Beobachtungsbetrieb — Auswertung gegen die Datenbank (Plan §7)
 *
 * ## Warum das ein DB-Test sein muss
 *
 * Die Zusage dieser Auswertung ist eine Aussage über **fehlende** Zeilen: Ein
 * Kanal, der nie geschrieben hat, muss trotzdem erscheinen — als unbeobachtet.
 * Das lässt sich am Quelltext nur ungefähr prüfen (steht da ein LEFT JOIN?),
 * am Ergebnis dagegen genau.
 *
 * Und es ist die Eigenschaft, an der alles hängt: Am 2026-09-04 protokollierte
 * der Publish Gate tagelang nichts, weil sein Aufruf falsch war und der Fehler
 * in einem `catch` verschwand. Eine Auswertung, die nur vorhandene Zeilen
 * gruppiert, hätte in dieser Zeit „keine Divergenzen" gemeldet — und das
 * Umschalten der Enforcement-Schalter leichter aussehen lassen, als es war.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('Plan §7 / Beobachtungsbetrieb') ? describe : describe.skip;

interface Row {
  source: string;
  beobachtet: boolean;
  eintraege: string;
  divergenzen: string;
  v2_strenger: string;
  v2_lockerer: string;
  wuerde_sperren: string;
  unbekannt: string;
  erste: string | null;
  letzte: string | null;
}

async function log(
  ctx: DbCtx,
  tenantId: string,
  source: string,
  legacy: string | null,
  v2: string | null,
): Promise<void> {
  await ctx.client.query(
    `INSERT INTO public.pdp_shadow_log
       (tenant_id, source, legacy_status, v2_status, diverged, snapshot_version)
     VALUES ($1, $2, $3, $4, $3 IS DISTINCT FROM $4, 'v-test')`,
    [tenantId, source, legacy, v2],
  );
}

async function readiness(ctx: DbCtx, tenantId: string, userId: string): Promise<Row[]> {
  await ctx.client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
  const r = await ctx.client.query(
    `SELECT * FROM public.pdp_shadow_readiness($1)`,
    [tenantId],
  );
  return r.rows as Row[];
}

d('Plan §7 / Beobachtungsbetrieb (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('zeigt jeden Kanal, auch den, der nie geschrieben hat', async () => {
    // Der Kern. Ein `GROUP BY` über die Zeilen liesse die stummen Kanäle weg.
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await log(ctx!, tenantId, 'ai-gateway', 'allow', 'allow');

    const rows = await readiness(ctx!, tenantId, userId);
    const bekannt = await ctx!.client.query(
      `SELECT unnest(public.pdp_shadow_known_sources()) AS s`,
    );

    expect(rows.map((r) => r.source).sort())
      .toEqual(bekannt.rows.map((r: { s: string }) => r.s).sort());
    expect(rows.length).toBeGreaterThan(1);

    const gateway = rows.find((r) => r.source === 'ai-gateway')!;
    expect(gateway.beobachtet).toBe(true);

    const stumm = rows.filter((r) => r.source !== 'ai-gateway');
    expect(stumm.length).toBeGreaterThan(0);
    for (const r of stumm) {
      expect(r.beobachtet).toBe(false);
      expect(Number(r.eintraege)).toBe(0);
      // Und ausdrücklich kein Zeitraum: Wer nichts gemeldet hat, hat auch
      // keine Beobachtungsdauer.
      expect(r.erste).toBeNull();
      expect(r.letzte).toBeNull();
    }
  });

  it('zählt die Richtung der Abweichung getrennt', async () => {
    // „12 Divergenzen" ist keine Entscheidungsgrundlage. Strenger kostet
    // Arbeitsfähigkeit, lockerer heisst: die heutige Zusage ist ungedeckt.
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await log(ctx!, tenantId, 'ai-gateway', 'allow', 'block');   // strenger
    await log(ctx!, tenantId, 'ai-gateway', 'block', 'allow');   // lockerer
    await log(ctx!, tenantId, 'ai-gateway', 'warn', 'warn');     // gleich

    const g = (await readiness(ctx!, tenantId, userId))
      .find((r) => r.source === 'ai-gateway')!;

    expect(Number(g.eintraege)).toBe(3);
    expect(Number(g.divergenzen)).toBe(2);
    expect(Number(g.v2_strenger)).toBe(1);
    expect(Number(g.v2_lockerer)).toBe(1);
  });

  it('zählt require_approval als sperrend, nicht nur block', async () => {
    // Eine verlangte Freigabe hält genauso an wie eine Sperre. Wer nur
    // `block` zählte, unterschätzte die Folgen des Umschaltens.
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await log(ctx!, tenantId, 'bot-chat', null, 'block');
    await log(ctx!, tenantId, 'bot-chat', null, 'require_approval');
    await log(ctx!, tenantId, 'bot-chat', null, 'warn');

    const b = (await readiness(ctx!, tenantId, userId))
      .find((r) => r.source === 'bot-chat')!;
    expect(Number(b.wuerde_sperren)).toBe(2);
  });

  it('meldet ein unbekanntes Verdikt, statt es als harmlos zu zählen', async () => {
    // Ein neues Vokabular, das niemand in `pdp_verdict_rank` nachgetragen hat,
    // darf nicht stillschweigend wie `allow` behandelt werden.
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await log(ctx!, tenantId, 'm365-audit', null, 'quarantaene');

    const m = (await readiness(ctx!, tenantId, userId))
      .find((r) => r.source === 'm365-audit')!;
    expect(Number(m.unbekannt)).toBe(1);
    expect(Number(m.wuerde_sperren)).toBe(0);
    expect(Number(m.v2_strenger)).toBe(0);
  });

  it('ordnet die Verdikte beider Engines nach Strenge', async () => {
    const r = await ctx!.client.query(
      `SELECT public.pdp_verdict_rank('allow')            AS a,
              public.pdp_verdict_rank('log')              AS l,
              public.pdp_verdict_rank('warn')             AS w,
              public.pdp_verdict_rank('require_approval') AS ra,
              public.pdp_verdict_rank('block')            AS b,
              public.pdp_verdict_rank('erfunden')         AS x`,
    );
    const row = r.rows[0];
    expect(Number(row.a)).toBeLessThan(Number(row.l));
    expect(Number(row.l)).toBeLessThan(Number(row.w));
    expect(Number(row.w)).toBeLessThan(Number(row.ra));
    expect(Number(row.ra)).toBeLessThan(Number(row.b));
    // NULL, nicht 0 — sonst wäre Unbekanntes so harmlos wie `allow`.
    expect(row.x).toBeNull();
  });

  it('zeigt einem Fremden nichts', async () => {
    // SECURITY DEFINER umgeht RLS; die Grenze stellt die Funktion selbst her.
    const a = await createTenantWithMember(ctx!, { userEmail: 'a@example.com' });
    const b = await createTenantWithMember(ctx!, { userEmail: 'b@example.com' });
    await log(ctx!, a.tenantId, 'ai-gateway', 'allow', 'block');

    const fremd = await readiness(ctx!, a.tenantId, b.userId);
    expect(fremd).toEqual([]);

    // Gegenprobe: Das eigene Mitglied sieht sehr wohl etwas — sonst prüfte
    // der Test oben nur, dass die Funktion generell nichts liefert.
    const eigen = await readiness(ctx!, a.tenantId, a.userId);
    expect(eigen.length).toBeGreaterThan(0);
  });

  it('grenzt nach Zeitraum ab', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await ctx!.client.query(
      `INSERT INTO public.pdp_shadow_log
         (tenant_id, source, legacy_status, v2_status, diverged, snapshot_version, created_at)
       VALUES ($1, 'ai-gateway', 'allow', 'block', true, 'v-test', now() - interval '90 days')`,
      [tenantId],
    );

    await ctx!.client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    const jung = await ctx!.client.query(
      `SELECT beobachtet FROM public.pdp_shadow_readiness($1) WHERE source = 'ai-gateway'`,
      [tenantId],
    );
    // Vorgabe sind 30 Tage — der 90 Tage alte Eintrag zählt nicht mehr.
    expect(jung.rows[0].beobachtet).toBe(false);

    const alt = await ctx!.client.query(
      `SELECT beobachtet FROM public.pdp_shadow_readiness($1, now() - interval '180 days')
       WHERE source = 'ai-gateway'`,
      [tenantId],
    );
    expect(alt.rows[0].beobachtet).toBe(true);
  });
});
