/**
 * governance_evidence append-only (20261016120000_governance_evidence_append_only.sql).
 *
 * Die Hash-Kette pro Mandant lag in einer Tabelle, die jeder mit
 * service_role nachträglich ändern oder löschen konnte. Geprüft wird —
 * als Superuser, also ohne RLS-Schutz, so wie service_role schreibt:
 *   - Anhängen funktioniert unverändert
 *   - UPDATE wird abgewiesen (42501), auch auf harmlose Felder
 *   - DELETE wird abgewiesen, außer mit erklärter Aufbewahrungslöschung
 *   - Fremdschlüssel-Aktionen (Asset/Event hart löschen) verändern die Kette
 *     nicht still, sondern scheitern
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('governance-evidence-append-only') ? describe : describe.skip;

async function append(ctx: DbCtx, tenantId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const row = {
    tenant_id: tenantId, evidence_type: 'json', title: 'Website-Audit example.de',
    content_hash: `h_${Math.random().toString(36).slice(2)}`, previous_hash: null,
    metadata: { source: 'test' }, ...extra,
  };
  const { rows } = await ctx.client.query<{ id: string }>(
    `SELECT public.append_governance_evidence($1::jsonb, NULL) AS id`, [JSON.stringify(row)]);
  return rows[0]!.id;
}

async function pgCode(ctx: DbCtx, sql: string, params: unknown[] = []): Promise<string | null> {
  await ctx.client.query('SAVEPOINT sp_ev');
  try {
    await ctx.client.query(sql, params);
    await ctx.client.query('RELEASE SAVEPOINT sp_ev');
    return null;
  } catch (e) {
    await ctx.client.query('ROLLBACK TO SAVEPOINT sp_ev');
    return (e as { code?: string }).code ?? 'unknown';
  }
}

d('governance_evidence ist append-only', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('Anhängen über append_governance_evidence funktioniert weiter', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    expect(await append(ctx!, tenantId)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('UPDATE wird abgewiesen — Hash, Titel und Metadaten bleiben unverändert', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const id = await append(ctx!, tenantId);
    for (const sql of [
      `UPDATE public.governance_evidence SET content_hash = 'gefaelscht' WHERE id = $1`,
      `UPDATE public.governance_evidence SET title = 'harmlos' WHERE id = $1`,
      `UPDATE public.governance_evidence SET metadata = '{}'::jsonb WHERE id = $1`,
    ]) {
      expect(await pgCode(ctx!, sql, [id]), sql).toBe('42501');
    }
    const { rows } = await ctx!.client.query(`SELECT title FROM public.governance_evidence WHERE id = $1`, [id]);
    expect(rows[0].title).toBe('Website-Audit example.de');
  });

  it('DELETE wird abgewiesen', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const id = await append(ctx!, tenantId);
    expect(await pgCode(ctx!, `DELETE FROM public.governance_evidence WHERE id = $1`, [id])).toBe('42501');
    const { rowCount } = await ctx!.client.query(`SELECT 1 FROM public.governance_evidence WHERE id = $1`, [id]);
    expect(rowCount).toBe(1);
  });

  it('DELETE mit erklärter Aufbewahrungslöschung bleibt möglich (Art. 17 DSGVO)', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const id = await append(ctx!, tenantId);
    await ctx!.client.query(`SELECT set_config('app.evidence_retention_purge', 'on', true)`);
    expect(await pgCode(ctx!, `DELETE FROM public.governance_evidence WHERE id = $1`, [id])).toBeNull();
    await ctx!.client.query(`SELECT set_config('app.evidence_retention_purge', 'off', true)`);
  });

  it('der Schalter öffnet kein UPDATE', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const id = await append(ctx!, tenantId);
    await ctx!.client.query(`SELECT set_config('app.evidence_retention_purge', 'on', true)`);
    expect(await pgCode(ctx!, `UPDATE public.governance_evidence SET title = 'x' WHERE id = $1`, [id])).toBe('42501');
    await ctx!.client.query(`SELECT set_config('app.evidence_retention_purge', 'off', true)`);
  });

  it('hartes Löschen eines referenzierten Assets ändert die Evidence nicht still', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const { rows } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO public.governance_assets (tenant_id, asset_type, name)
       VALUES ($1, 'ai_system', 'Support-Assistent') RETURNING id`, [tenantId]);
    const assetId = rows[0]!.id;
    const id = await append(ctx!, tenantId, { asset_id: assetId });

    expect(await pgCode(ctx!, `DELETE FROM public.governance_assets WHERE id = $1`, [assetId])).toBe('42501');
    const after = await ctx!.client.query(`SELECT asset_id FROM public.governance_evidence WHERE id = $1`, [id]);
    expect(after.rows[0].asset_id).toBe(assetId);
  });

  it('anon und authenticated haben kein UPDATE- oder DELETE-Recht', async () => {
    const { rows } = await ctx!.client.query<{ role: string; upd: boolean; del: boolean }>(`
      SELECT r AS role,
             has_table_privilege(r, 'public.governance_evidence', 'UPDATE') AS upd,
             has_table_privilege(r, 'public.governance_evidence', 'DELETE') AS del
        FROM unnest(ARRAY['anon', 'authenticated']) AS r`);
    expect(rows).toEqual([
      { role: 'anon', upd: false, del: false },
      { role: 'authenticated', upd: false, del: false },
    ]);
  });
});
