/**
 * Gate 2 · Website-Scans pro Mandant atomar begrenzt
 * (20260928150000_tenant_audit_scan_quota.sql).
 *
 * Review #1711: Zählen und Anlegen des Laufs waren zwei Aufrufe; parallele
 * Anfragen überschritten das Limit. Jetzt weist ein BEFORE-INSERT-Trigger den
 * 31. gdpr-audit-Lauf eines Mandanten innerhalb einer Stunde ab. Geprüft wird:
 *   - 30 Läufe gehen durch, der 31. scheitert mit TENANT_SCAN_LIMIT_EXCEEDED
 *   - andere Detektoren und andere Mandanten sind nicht betroffen
 *   - Läufe älter als eine Stunde zählen nicht mit
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('tenant-audit-scan-quota') ? describe : describe.skip;

async function insertRun(ctx: DbCtx, tenantId: string, detector = 'gdpr-audit', createdAt?: string): Promise<void> {
  if (createdAt) {
    await ctx.client.query(
      `INSERT INTO public.scan_runs (tenant_id, detector, status, created_at) VALUES ($1, $2, 'running', $3)`,
      [tenantId, detector, createdAt]);
  } else {
    await ctx.client.query(
      `INSERT INTO public.scan_runs (tenant_id, detector, status) VALUES ($1, $2, 'running')`,
      [tenantId, detector]);
  }
}

async function insertError(ctx: DbCtx, tenantId: string, detector = 'gdpr-audit'): Promise<string | null> {
  await ctx.client.query('SAVEPOINT quota_probe');
  try {
    await insertRun(ctx, tenantId, detector);
    await ctx.client.query('RELEASE SAVEPOINT quota_probe');
    return null;
  } catch (e) {
    await ctx.client.query('ROLLBACK TO SAVEPOINT quota_probe');
    return (e as Error).message;
  }
}

d('Gate 2 · scan_runs_tenant_audit_quota', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('lässt 30 gdpr-audit-Läufe je Stunde zu und weist den 31. ab', async () => {
    const a = await createTenantWithMember(ctx!);
    for (let i = 0; i < 30; i++) await insertRun(ctx!, a.tenantId);
    expect(await insertError(ctx!, a.tenantId)).toMatch(/TENANT_SCAN_LIMIT_EXCEEDED/);

    const { rows } = await ctx!.client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM public.scan_runs WHERE tenant_id = $1`, [a.tenantId]);
    expect(rows[0]!.n).toBe('30');
  });

  it('andere Detektoren und andere Mandanten bleiben unberührt', async () => {
    const a = await createTenantWithMember(ctx!);
    const b = await createTenantWithMember(ctx!);
    for (let i = 0; i < 30; i++) await insertRun(ctx!, a.tenantId);

    expect(await insertError(ctx!, a.tenantId, 'email-auth-rescan')).toBeNull();
    expect(await insertError(ctx!, b.tenantId)).toBeNull();
  });

  it('Läufe älter als eine Stunde zählen nicht mit', async () => {
    const a = await createTenantWithMember(ctx!);
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    for (let i = 0; i < 30; i++) await insertRun(ctx!, a.tenantId, 'gdpr-audit', old);
    expect(await insertError(ctx!, a.tenantId)).toBeNull();
  });
});
