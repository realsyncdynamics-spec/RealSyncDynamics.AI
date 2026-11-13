/**
 * Lead-Verwaltung: Filter passen zur RPC, Quoten werden nie erfunden,
 * Zugriff wird in der Datenbank geprüft. Die Roh-Tabs laufen über
 * Operator-RPCs; die Routen stehen hinter OperatorRoute.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONVERSION_LABELS, FUNNEL_FILTERS, formatRate } from '../../../src/features/admin/funnelLeads';

const ROOT = resolve(__dirname, '../../..');
const migration = readFileSync(resolve(ROOT, 'supabase/migrations/20261015120000_funnel_lead_capture.sql'), 'utf8');
const leadsMigration = readFileSync(
  resolve(ROOT, 'supabase/migrations/20261113160000_harden_leads_acl_and_policies.sql'),
  'utf8',
);
const leadsRollback = readFileSync(
  resolve(ROOT, 'supabase/rollbacks/20261113160000_harden_leads_acl_and_policies.ROLLBACK.sql'),
  'utf8',
);
const app = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');
const panel = readFileSync(resolve(ROOT, 'src/features/admin/FunnelLeadsPanel.tsx'), 'utf8');
const leadsView = readFileSync(resolve(ROOT, 'src/features/admin/LeadsView.tsx'), 'utf8');
const operatorRoute = readFileSync(resolve(ROOT, 'src/features/admin/OperatorRoute.tsx'), 'utf8');

describe('FUNNEL_FILTERS', () => {
  it('offers exactly the five requested stages plus "Alle"', () => {
    expect(FUNNEL_FILTERS.map((f) => f.label)).toEqual([
      'Alle', 'Neu', 'Scan gestartet', 'Scan abgeschlossen', 'Pilot begonnen', 'Kunde geworden',
    ]);
  });
  it('every stage filter is accepted by admin_funnel_leads', () => {
    const fn = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.admin_funnel_leads'));
    const allow = fn.match(/p_stage NOT IN \(([^)]+)\)/)?.[1] ?? '';
    expect(allow).not.toBe('');
    for (const f of FUNNEL_FILTERS.filter((x) => x.id !== 'all')) {
      expect(allow).toContain(`'${f.id}'`);
      expect(CONVERSION_LABELS[f.id as keyof typeof CONVERSION_LABELS]).toBeTruthy();
    }
  });
});

describe('formatRate (keine erfundenen Kennzahlen)', () => {
  it('shows a dash when the denominator was zero', () => {
    expect(formatRate(null)).toBe('—');
    expect(formatRate(undefined)).toBe('—');
    expect(formatRate(Number.NaN)).toBe('—');
  });
  it('formats real rates as percent', () => {
    expect(formatRate(0)).toBe('0 %');
    expect(formatRate(0.5)).toBe('50 %');
    expect(formatRate(0.3333)).toBe('33,3 %');
  });
  it('the database returns NULL rates for a zero denominator', () => {
    expect(migration).toMatch(/'scan_completion_rate', CASE WHEN v_started > 0/);
    expect(migration).toMatch(/'lead_to_pilot_rate', CASE WHEN v_total > 0/);
    expect(migration).toMatch(/'pilot_to_customer_rate', CASE WHEN v_pilot > 0/);
  });
});

describe('Zugriff (unberechtigter Zugriff auf Lead-Verwaltung)', () => {
  it('both admin RPCs gate on the platform role inside the database', () => {
    const leads = migration.slice(migration.indexOf('FUNCTION public.admin_funnel_leads'));
    const kpis = migration.slice(migration.indexOf('FUNCTION public.admin_funnel_kpis'));
    expect(leads.slice(0, 1500)).toMatch(/IF NOT public\.is_platform_operator\(\) THEN\s*RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'/);
    expect(kpis.slice(0, 1500)).toMatch(/IF NOT public\.is_platform_operator\(\) THEN\s*RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'/);
  });
  it('anon cannot execute them; capture is service_role only', () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.admin_funnel_leads\(text, integer\) FROM PUBLIC, anon;/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.capture_funnel_lead\([^)]*\)\s*FROM PUBLIC, anon, authenticated;/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.capture_funnel_lead\([^)]*\)\s*TO service_role;/);
  });
  it('the Art. 17 erase RPC for leads without account is gated the same way', () => {
    const erase = migration.slice(migration.indexOf('FUNCTION public.admin_erase_lead_data'));
    expect(erase.slice(0, 800)).toMatch(/IF NOT public\.is_platform_operator\(\) THEN\s*RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.erase_lead_data\(text, uuid, text, uuid\) FROM PUBLIC, anon, authenticated;/);
    expect(panel).toContain('Endgültig löschen');
  });
  it('no new RLS policy opens sales_leads to tenants', () => {
    expect(migration).not.toMatch(/CREATE POLICY[^;]*sales_leads/i);
    expect(leadsMigration).toMatch(/CREATE POLICY "sales_leads operator_read"/);
    expect(leadsMigration).toMatch(/USING \(public\.is_platform_operator\(\)\)/);
    expect(leadsMigration).not.toMatch(/is_tenant_member.*sales_leads|sales_leads.*is_tenant_member/);
  });
  it('/app/leads and /admin/leads sit behind OperatorRoute and LeadsView reads only via RPC', () => {
    expect(app).toMatch(/<Route path="\/app\/leads" element=\{<OperatorRoute><LeadsView \/><\/OperatorRoute>\} \/>/);
    expect(app).toMatch(/<Route path="\/admin\/leads" element=\{<OperatorRoute><LeadsView \/><\/OperatorRoute>\} \/>/);
    expect(panel).not.toMatch(/from\('sales_leads'\)/);
    expect(leadsView).not.toMatch(/from\('sales_leads'\)/);
    expect(leadsView).not.toMatch(/from\('gdpr_audits'\)/);
    expect(leadsView).toContain("rpc('admin_sales_leads'");
    expect(leadsView).toContain("rpc('admin_gdpr_audits'");
    expect(leadsView).not.toContain('AuthGate');
    expect(leadsView).not.toContain('is_super_admin');
  });
  it('OperatorRoute checks is_platform_operator and redirects like SuperAdminRoute', () => {
    expect(operatorRoute).toContain("rpc('is_platform_operator')");
    expect(operatorRoute).toContain('/welcome?next=');
    expect(operatorRoute).toContain('"/app/dashboard"');
  });
  it('new list RPCs are operator-gated and revoked from anon', () => {
    expect(leadsMigration).toMatch(/FUNCTION public\.admin_sales_leads[\s\S]{0,800}IF NOT public\.is_platform_operator\(\) THEN\s*RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'/);
    expect(leadsMigration).toMatch(/FUNCTION public\.admin_gdpr_audits[\s\S]{0,800}IF NOT public\.is_platform_operator\(\) THEN\s*RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'/);
    expect(leadsMigration).toMatch(/REVOKE ALL ON FUNCTION public\.admin_sales_leads\(integer\) FROM PUBLIC, anon;/);
    expect(leadsMigration).toMatch(/REVOKE ALL ON FUNCTION public\.admin_gdpr_audits\(integer\) FROM PUBLIC, anon;/);
    expect(leadsMigration).toMatch(/REVOKE ALL ON FUNCTION public\.is_platform_operator\(\) FROM PUBLIC, anon;/);
  });

  it('does not drop or rewrite gdpr_audits.tenant_read', () => {
    expect(leadsMigration).not.toMatch(/DROP POLICY[^;]*tenant_read/);
    expect(leadsMigration).not.toMatch(/CREATE POLICY "gdpr_audits tenant_read"/);
    expect(leadsRollback).not.toMatch(/DROP POLICY[^;]*tenant_read/);
    expect(leadsRollback).not.toMatch(/CREATE POLICY "gdpr_audits tenant_read"/);
  });
  it('rollback does not re-grant anon EXECUTE on is_platform_operator (P0 v2.1 bleibt)', () => {
    expect(leadsRollback).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.is_platform_operator\(\) TO anon/);
    expect(leadsRollback).toMatch(/REVOKE ALL ON FUNCTION public\.is_platform_operator\(\) FROM PUBLIC, anon;/);
  });
});
