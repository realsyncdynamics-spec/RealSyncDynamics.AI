/**
 * P2-1 — Connector-Registratur (DB-Integration)
 *
 * Der wichtigste Test dieser Datei ist der zweite: **Die Klasse lässt sich
 * nicht fälschen.** Alles andere an P2-1 ist Buchhaltung; die Zusage steht
 * und fällt damit, dass ein Mandant seinen Microsoft-365-Connector nicht auf
 * „A — anhaltbar" setzen kann. Ein Rahmenwerk, das die Klasse anzeigt, sie
 * aber vom Client entgegennimmt, wäre schlimmer als keines: Es trüge die
 * Falschaussage mit dem Anschein einer Prüfung.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

async function register(
  ctx: DbCtx,
  tenantId: string,
  systemType: string,
  extra: Record<string, unknown> = {},
): Promise<{ id: string; enforcement_class: string }> {
  const cols = ['tenant_id', 'system_type', 'display_name', ...Object.keys(extra)];
  const vals: unknown[] = [tenantId, systemType, `${systemType}-Anbindung`, ...Object.values(extra)];
  const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
  const r = await ctx.client.query(
    `INSERT INTO public.connector_registry (${cols.join(', ')})
     VALUES (${ph}) RETURNING id, enforcement_class`,
    vals,
  );
  return r.rows[0];
}

d('P2-1 / Klassen-Ableitung (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('leitet die Klasse aus dem Systemtyp ab', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);

    expect((await register(ctx!, tenantId, 'ai_gateway')).enforcement_class).toBe('A');
    expect((await register(ctx!, tenantId, 'siteos_publish')).enforcement_class).toBe('B');
    expect((await register(ctx!, tenantId, 'microsoft365')).enforcement_class).toBe('C');
    expect((await register(ctx!, tenantId, 'browser_direct')).enforcement_class).toBe('D');
  });

  it('DIE KLASSE LÄSST SICH NICHT FÄLSCHEN — ein mitgeschicktes A wird ersetzt', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);

    // Der Angriff, gegen den P2-1 gebaut ist: Ein Mandant behauptet für sein
    // Microsoft 365 die Blockierfähigkeit, die es dort nicht gibt.
    const row = await register(ctx!, tenantId, 'microsoft365', { enforcement_class: 'A' });
    expect(row.enforcement_class).toBe('C');

    // Auch nachträglich nicht.
    await ctx!.client.query(
      `UPDATE public.connector_registry SET enforcement_class = 'A' WHERE id = $1`,
      [row.id],
    );
    const after = await ctx!.client.query(
      `SELECT enforcement_class FROM public.connector_registry WHERE id = $1`, [row.id],
    );
    expect(after.rows[0].enforcement_class).toBe('C');
  });

  it('ein unbekannter Systemtyp wird C, nicht A', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const row = await register(ctx!, tenantId, 'irgendein_neues_system');
    expect(row.enforcement_class).toBe('C');
  });

  it('ändert sich der Systemtyp, folgt die Klasse mit', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const row = await register(ctx!, tenantId, 'microsoft365');
    expect(row.enforcement_class).toBe('C');

    await ctx!.client.query(
      `UPDATE public.connector_registry SET system_type = 'ai_gateway' WHERE id = $1`,
      [row.id],
    );
    const after = await ctx!.client.query(
      `SELECT enforcement_class FROM public.connector_registry WHERE id = $1`, [row.id],
    );
    expect(after.rows[0].enforcement_class).toBe('A');
  });
});

d('P2-1 / Registratur-Regeln (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('dieselbe Bestandszeile lässt sich nicht zweimal registrieren', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const src = '11111111-1111-1111-1111-111111111111';

    await register(ctx!, tenantId, 'microsoft365', {
      source_table: 'enterprise_connectors', source_id: src,
    });
    await expect(
      register(ctx!, tenantId, 'crm', {
        source_table: 'enterprise_connectors', source_id: src,
      }),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('ohne Quellzeile sind mehrere Einträge erlaubt — der Index greift partiell', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await register(ctx!, tenantId, 'chatbot');
    await register(ctx!, tenantId, 'chatbot');
    const n = await ctx!.client.query(
      `SELECT count(*)::int AS n FROM public.connector_registry WHERE tenant_id = $1`, [tenantId],
    );
    expect(n.rows[0].n).toBe(2);
  });

  it('eine unbekannte Quelltabelle wird abgewiesen', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await expect(
      register(ctx!, tenantId, 'crm', { source_table: 'irgendwas', source_id: null }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('tenant_id ist Pflicht — die Isolationsgrenze bleibt', async () => {
    await expect(
      ctx!.client.query(
        `INSERT INTO public.connector_registry (tenant_id, system_type, display_name)
         VALUES (NULL, 'crm', 'x')`,
      ),
    ).rejects.toMatchObject({ code: '23502' });
  });
});

d('P2-1 / Überblick je Mandant (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('zählt je Klasse und weist aus, wo überhaupt blockiert werden kann', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await register(ctx!, tenantId, 'ai_gateway', { status: 'connected' });
    await register(ctx!, tenantId, 'chatbot', { status: 'pending' });
    await register(ctx!, tenantId, 'microsoft365', { status: 'connected' });

    const r = await ctx!.withClaims({ sub: userId }, async () =>
      ctx!.client.query(
        `SELECT * FROM public.connector_enforcement_summary($1::uuid)`, [tenantId],
      ),
    );

    type SummaryRow = {
      enforcement_class: string;
      kann_blockieren: boolean;
      anzahl: string;
      verbunden: string;
    };
    const byClass = new Map<string, SummaryRow>(
      (r.rows as SummaryRow[]).map((x) => [x.enforcement_class, x]),
    );
    expect(Number(byClass.get('A')?.anzahl)).toBe(2);
    expect(Number(byClass.get('A')?.verbunden)).toBe(1);
    expect(byClass.get('A')?.kann_blockieren).toBe(true);
    expect(Number(byClass.get('C')?.anzahl)).toBe(1);
    expect(byClass.get('C')?.kann_blockieren).toBe(false);
  });

  it('gibt einem Nicht-Mitglied nichts zurück — SECURITY DEFINER umgeht RLS', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await register(ctx!, tenantId, 'ai_gateway');

    const fremd = await createTenantWithMember(ctx!, { userEmail: 'fremd@example.com' });
    const r = await ctx!.withClaims({ sub: fremd.userId }, async () =>
      ctx!.client.query(
        `SELECT * FROM public.connector_enforcement_summary($1::uuid)`, [tenantId],
      ),
    );
    expect(r.rows).toHaveLength(0);
  });
});
