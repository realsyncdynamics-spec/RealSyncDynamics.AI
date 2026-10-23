/**
 * gdpr-delete: eigene Ein-Personen-Workspaces werden mitgelöscht (R-03).
 *
 * Regression zum E2E-Test vom 20.10.2026: Ein frisch registriertes Konto
 * bekam 409 SOLE_OWNER, weil die Registrierung einen Workspace anlegt und es
 * keinen Weg gab, ihn zu löschen. Die DB-Seite prüft
 * test/runtime/db/account-self-deletion.db.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkTenantCleanup } from '../../supabase/functions/gdpr-delete/tenant-cleanup';

const src = readFileSync(resolve(__dirname, '../../supabase/functions/gdpr-delete/index.ts'), 'utf8');
const T1 = '11111111-1111-4111-8111-111111111111';

describe('checkTenantCleanup — fail closed', () => {
  it('passes a verified result, also when there is nothing to delete', () => {
    expect(checkTenantCleanup({ ok: true, dry_run: true, tenants: 1 }, null)).toEqual({ ok: true, tenants: 1 });
    expect(checkTenantCleanup({ ok: true, dry_run: false, tenants: 0 }, null)).toEqual({ ok: true, tenants: 0 });
  });

  it('blocks when the RPC is missing (PGRST202 / 42883)', () => {
    for (const code of ['PGRST202', '42883']) {
      const r = checkTenantCleanup(null, { code, message: 'function not found' });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.status).toBe(503);
        expect(r.code).toBe('WORKSPACE_CLEANUP_UNAVAILABLE');
        expect(r.message).toMatch(/Konto wurde nicht verändert/);
      }
    }
  });

  it('blocks on any other database error without leaking details', () => {
    const r = checkTenantCleanup(null, { code: 'XX000', message: 'boom in tenant Kunde GmbH' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(500);
      expect(r.code).toBe('WORKSPACE_CLEANUP_FAILED');
      expect(JSON.stringify(r)).not.toContain('Kunde GmbH');
    }
  });

  it('blocks when the result cannot be verified', () => {
    for (const data of [
      null, undefined, [], {}, 'ok',
      { ok: true }, { ok: true, tenants: '1' }, { ok: true, tenants: -1 }, { ok: true, tenants: 1.5 },
      { ok: false }, { ok: false, blocked: [] }, { ok: false, blocked: [{ reason: 'unknown' }] },
    ]) {
      const r = checkTenantCleanup(data, null);
      expect(r.ok, JSON.stringify(data) ?? 'undefined').toBe(false);
      if (!r.ok) expect(r.code).toBe('WORKSPACE_CLEANUP_UNVERIFIED');
    }
  });

  it('other members → 409 SOLE_OWNER with the workspace name (code the settings page knows)', () => {
    const r = checkTenantCleanup({ ok: false, blocked: [{ tenant_id: T1, name: 'Kanzlei Team', reason: 'other_members' }] }, null);
    expect(r).toMatchObject({
      ok: false, status: 409, code: 'SOLE_OWNER',
      details: { sole_owner_of: [{ tenant_id: T1, name: 'Kanzlei Team' }] },
    });
  });

  it('billing records → 409 BILLING_RETENTION with the privacy contact', () => {
    const r = checkTenantCleanup({ ok: false, blocked: [{ tenant_id: T1, reason: 'billing_records' }] }, null);
    expect(r).toMatchObject({ ok: false, status: 409, code: 'BILLING_RETENTION' });
    if (!r.ok) expect(r.message).toMatch(/privacy@realsyncdynamicsai\.de/);
  });

  it('retained records → 409 WORKSPACE_RETAINED; the SQLSTATE goes to the log only', () => {
    const r = checkTenantCleanup({ ok: false, blocked: [{ reason: 'retained_records', sqlstate: '42501' }] }, null);
    expect(r).toMatchObject({ ok: false, status: 409, code: 'WORKSPACE_RETAINED', logCode: 'retained_records:42501' });
    if (!r.ok) {
      expect(r.message).not.toMatch(/42501/);
      expect(r.details).toBeUndefined();
    }
  });

  it('names what the person can fix first when several reasons apply', () => {
    const r = checkTenantCleanup({
      ok: false,
      blocked: [{ reason: 'retained_records' }, { tenant_id: T1, reason: 'billing_records' }, { tenant_id: T1, name: 'X', reason: 'other_members' }],
    }, null);
    expect(r).toMatchObject({ ok: false, code: 'SOLE_OWNER' });
  });
});

describe('gdpr-delete wiring (R-03)', () => {
  const dryRun = src.indexOf("p_dry_run: true");
  const dryGate = src.indexOf('if (!tenantPlan.ok) {');
  const erase = src.indexOf("admin.rpc('erase_lead_data'");
  const anonymize = src.indexOf("admin.from('workflow_runs').update(");
  const realRun = src.indexOf("p_dry_run: false");
  const realGate = src.indexOf('if (!tenantCleanup.ok) {');
  const memberships = src.indexOf("admin.from('memberships').delete()");
  const deleteUser = src.indexOf('admin.auth.admin.deleteUser(userId)');

  it('runs the dry run before anything is changed and aborts on a block', () => {
    expect(dryRun).toBeGreaterThan(0);
    expect(dryGate).toBeGreaterThan(dryRun);
    expect(dryGate).toBeLessThan(erase);
    expect(src.slice(dryGate, dryGate + 300))
      .toMatch(/return jsonError\(tenantPlan\.status, tenantPlan\.code, tenantPlan\.message, undefined, tenantPlan\.details\)/);
  });

  it('deletes the workspaces after lead erasure and anonymization, before memberships and the account', () => {
    expect(realRun).toBeGreaterThan(anonymize);
    expect(realGate).toBeGreaterThan(realRun);
    expect(realGate).toBeLessThan(memberships);
    expect(realGate).toBeLessThan(deleteUser);
    expect(src.slice(realGate, realGate + 400)).toMatch(/return jsonError\(tenantCleanup\.status, tenantCleanup\.code,/);
  });

  it('no longer blocks every sole owner on its own', () => {
    expect(src).not.toMatch(/soleOwnerTenants/);
    expect(src).not.toMatch(/Übertrage erst Ownership oder lösche den Workspace/);
  });

  it('logs only the decision code, never raw database messages', () => {
    expect(src).toMatch(/console\.error\('gdpr-delete: workspace pre-flight blocked', \{ code: tenantPlan\.logCode \}\)/);
    expect(src).toMatch(/console\.error\('gdpr-delete: workspace deletion failed', \{ code: tenantCleanup\.logCode \}\)/);
    expect(src).not.toMatch(/tenantPlanErr\.message|tenantDelErr\.message/);
  });

  it('reports the number of deleted workspaces', () => {
    expect(src.slice(src.indexOf('return jsonResponse({'))).toMatch(/deleted_workspaces: tenantCleanup\.tenants/);
  });
});
