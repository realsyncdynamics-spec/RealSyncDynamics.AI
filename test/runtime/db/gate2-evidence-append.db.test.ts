/**
 * Gate 2 · Evidence-Kette ohne Verzweigung
 * (20260928140100_gate2_evidence_append_rpc.sql).
 *
 * Review #1698: Lesen des Kettenkopfs und Einfügen waren zwei Aufrufe; zwei
 * gleichzeitige Scans konnten an denselben Vorgänger anhängen. Geprüft wird:
 *   - Anhängen an den aktuellen Kopf gelingt, created_at folgt der Kette
 *   - veralteter erwarteter Kopf → NULL, nichts geschrieben
 *   - erster Eintrag eines Mandanten (Kopf NULL) und fremder Mandant stören sich nicht
 *   - previous_hash in der Zeile muss dem erwarteten Kopf entsprechen
 *   - anon und authenticated haben kein EXECUTE
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('gate2-evidence-append') ? describe : describe.skip;

function row(tenantId: string, contentHash: string, previousHash: string | null) {
  return {
    tenant_id: tenantId,
    evidence_type: 'json',
    title: 'Website-Audit example.de',
    content_hash: contentHash,
    previous_hash: previousHash,
    metadata: { source: 'tenant-audit' },
  };
}

async function append(ctx: DbCtx, r: Record<string, unknown>, expected: string | null): Promise<string | null> {
  const { rows } = await ctx.client.query<{ id: string | null }>(
    `SELECT public.append_governance_evidence($1::jsonb, $2) AS id`, [JSON.stringify(r), expected]);
  return rows[0]!.id;
}

async function pgCode(p: Promise<unknown>): Promise<string | null> {
  try { await p; return null; } catch (e) { return (e as { code?: string }).code ?? 'unknown'; }
}

d('Gate 2 · append_governance_evidence', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('hängt an den aktuellen Kopf an und weist einen veralteten Kopf ab', async () => {
    const a = await createTenantWithMember(ctx!);
    expect(await append(ctx!, row(a.tenantId, 'h1', null), null)).not.toBeNull();
    expect(await append(ctx!, row(a.tenantId, 'h2', 'h1'), 'h1')).not.toBeNull();

    // Ein zweiter Schreiber, der noch h1 für den Kopf hält, verzweigt nicht.
    expect(await append(ctx!, row(a.tenantId, 'h2b', 'h1'), 'h1')).toBeNull();
    // Auch ein zweiter „erster" Eintrag wird abgewiesen.
    expect(await append(ctx!, row(a.tenantId, 'h1b', null), null)).toBeNull();

    const { rows } = await ctx!.client.query<{ content_hash: string; previous_hash: string | null }>(
      `SELECT content_hash, previous_hash FROM public.governance_evidence
        WHERE tenant_id = $1 ORDER BY created_at, id`, [a.tenantId]);
    expect(rows).toEqual([
      { content_hash: 'h1', previous_hash: null },
      { content_hash: 'h2', previous_hash: 'h1' },
    ]);
  });

  it('Ketten verschiedener Mandanten sind unabhängig', async () => {
    const a = await createTenantWithMember(ctx!);
    const b = await createTenantWithMember(ctx!);
    expect(await append(ctx!, row(a.tenantId, 'a1', null), null)).not.toBeNull();
    expect(await append(ctx!, row(b.tenantId, 'b1', null), null)).not.toBeNull();
  });

  it('previous_hash der Zeile muss dem erwarteten Kopf entsprechen (22023)', async () => {
    const a = await createTenantWithMember(ctx!);
    expect(await pgCode(append(ctx!, row(a.tenantId, 'h1', 'x'), null))).toBe('22023');
  });

  it('anon und authenticated haben kein EXECUTE', async () => {
    const a = await createTenantWithMember(ctx!);
    for (const rolle of ['anon', 'authenticated'] as const) {
      await ctx!.client.query(`SAVEPOINT sp_${rolle}`);
      await ctx!.client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: rolle === 'anon' ? null : a.userId, role: rolle }),
      ]);
      await ctx!.client.query(`SET LOCAL ROLE ${rolle}`);
      const code = await pgCode(append(ctx!, row(a.tenantId, 'h1', null), null));
      await ctx!.client.query(`ROLLBACK TO SAVEPOINT sp_${rolle}`);
      await ctx!.client.query(`RESET ROLE`);
      expect(code).toBe('42501');
    }
  });
});
