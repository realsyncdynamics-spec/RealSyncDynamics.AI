/**
 * gdpr-delete: Lead-/Scan-Löschung ist fail closed (Regression zu P0 aus der
 * Prüfung vom 2026-10-17) und die Antwort enthält keine E-Mail-Adresse (P1).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { anonymizationFailures, checkLeadErasure } from '../../supabase/functions/gdpr-delete/lead-erasure';

const src = readFileSync(resolve(__dirname, '../../supabase/functions/gdpr-delete/index.ts'), 'utf8');

const COUNTS = {
  sales_leads_deleted: 1,
  gdpr_audits_anonymized: 2,
  drip_rows_deleted: 0,
  newsletter_rows_deleted: 0,
  waitlist_rows_deleted: 0,
};

describe('checkLeadErasure — fail closed', () => {
  it('passes only a complete, numeric result', () => {
    expect(checkLeadErasure(COUNTS, null)).toEqual({ ok: true, counts: COUNTS, receiptId: null });
    expect(checkLeadErasure({ ...COUNTS, receipt_id: 'r-1' }, null)).toEqual({ ok: true, counts: COUNTS, receiptId: 'r-1' });
  });

  it('blocks the account deletion when the RPC is missing (PGRST202 / 42883)', () => {
    for (const code of ['PGRST202', '42883']) {
      const r = checkLeadErasure(null, { code, message: 'function not found' });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.status).toBe(503);
        expect(r.code).toBe('ERASURE_UNAVAILABLE');
        expect(r.message).toMatch(/Konto wurde nicht verändert/);
      }
    }
  });

  it('blocks on any other database error without leaking details', () => {
    const r = checkLeadErasure(null, { code: 'XX000', message: 'boom for lead@kunde.example' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(500);
      expect(JSON.stringify(r)).not.toContain('lead@kunde.example');
    }
  });

  it('blocks when the result cannot be verified', () => {
    for (const data of [null, undefined, [], {}, { ...COUNTS, sales_leads_deleted: '1' }, 'ok']) {
      const r = checkLeadErasure(data, null);
      expect(r.ok, JSON.stringify(data) ?? 'undefined').toBe(false);
      if (!r.ok) expect(r.code).toBe('ERASURE_UNVERIFIED');
    }
  });
});

describe('anonymizationFailures — Supabase-Fehler kommen als { error }, nicht als Ablehnung', () => {
  const T = ['workflow_runs', 'ai_tool_runs'];
  it('reports nothing when every query succeeded', () => {
    expect(anonymizationFailures([
      { status: 'fulfilled', value: { error: null } },
      { status: 'fulfilled', value: { error: null } },
    ], T)).toEqual([]);
  });
  it('catches a fulfilled query that carries a database error', () => {
    expect(anonymizationFailures([
      { status: 'fulfilled', value: { error: null } },
      { status: 'fulfilled', value: { error: { code: '42501', message: 'permission denied' } } },
    ], T)).toEqual([{ table: 'ai_tool_runs', code: '42501' }]);
  });
  it('catches rejected promises and missing results', () => {
    expect(anonymizationFailures([
      { status: 'rejected', reason: new Error('network') },
      { status: 'fulfilled', value: null },
    ], T)).toEqual([{ table: 'workflow_runs', code: 'rejected' }, { table: 'ai_tool_runs', code: 'no_result' }]);
  });
});

describe('gdpr-delete wiring', () => {
  it('erases lead data before any account change and aborts on failure', () => {
    const erase = src.indexOf("admin.rpc('erase_lead_data'");
    const gate = src.indexOf('if (!leadErasure.ok) {');
    const anonymize = src.indexOf("admin.from('workflow_runs').update(");
    const memberships = src.indexOf("admin.from('memberships').delete()");
    const deleteUser = src.indexOf('admin.auth.admin.deleteUser(userId)');
    expect(erase).toBeGreaterThan(0);
    expect(gate).toBeGreaterThan(erase);
    expect(anonymize).toBeGreaterThan(gate);
    expect(memberships).toBeGreaterThan(gate);
    expect(deleteUser).toBeGreaterThan(gate);
    expect(src.slice(gate, gate + 250)).toMatch(/return jsonError\(leadErasure\.status, leadErasure\.code, leadErasure\.message\)/);
  });

  it('aborts when an anonymization fails, before memberships and the account are deleted', () => {
    const check = src.indexOf('if (anonymizationErrors.length > 0) {');
    expect(check).toBeGreaterThan(src.indexOf('anonymizationFailures(anonymizations, ANON_TABLES)'));
    expect(check).toBeLessThan(src.indexOf("admin.from('memberships').delete()"));
    expect(check).toBeLessThan(src.indexOf('admin.auth.admin.deleteUser(userId)'));
    expect(src.slice(check, check + 400)).toMatch(/return jsonError\(500, 'ANONYMIZATION_FAILED'/);
    expect(src).not.toMatch(/anonymization_warnings/);
  });

  it('returns the receipt and no raw database messages', () => {
    expect(src).toMatch(/erasure_receipt_id: leadErasure\.receiptId/);
    expect(src).not.toMatch(/\$\{memErr\.message\}|\$\{authErr\.message\}/);
  });

  it('no longer tolerates a missing RPC', () => {
    expect(src).not.toMatch(/PGRST202|42883/);
    expect(src).not.toMatch(/skipped: 'erase_lead_data not deployed'/);
  });

  it('does not return the deleted e-mail address', () => {
    const response = src.slice(src.indexOf('return jsonResponse({'));
    expect(response).toMatch(/deleted_user: \{ id: userId \}/);
    expect(response).not.toMatch(/email: userEmail|userEmail/);
  });
});
