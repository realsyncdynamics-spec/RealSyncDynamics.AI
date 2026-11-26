/**
 * RSD-014: additive RLS-Policies fuer Tabellen mit tenant_id ohne Policy.
 * Dateibasiert, kein Live-DB-Zugriff.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = resolve(
  __dirname,
  '../../supabase/migrations/20261114104700_rsd014_tenant_rls_policies.sql',
);
const rollback = resolve(
  __dirname,
  '../../supabase/rollback/20261114104700_rsd014_tenant_rls_policies.sql',
);
const sql = readFileSync(migration, 'utf8');
const rb = readFileSync(rollback, 'utf8');

const memberTables = [
  'ai_evidence_retention',
  'ai_runtime_events',
  'bot_usage_plan_alerts',
  'bot_usage_plan_applications',
  'browser_executions',
  'compliance_escalation_chain',
  'enterprise_agent_policies',
  'enterprise_ai_audit_events',
  'enterprise_ai_system_registry',
  'enterprise_connectors',
  'enterprise_feedback_reports',
  'enterprise_founders_access',
];
const serviceOnly = ['_operation_metrics', 'seo_marketing_audit_log'];

describe('RSD-014 Migration 20261114104700', () => {
  it('liegt zusammen mit einer Rollback-Datei vor', () => {
    expect(existsSync(migration)).toBe(true);
    expect(existsSync(rollback)).toBe(true);
  });

  it('legt fuer jede Member-Tabelle tenant-isoliertes SELECT und service_role ALL an', () => {
    for (const t of memberTables) {
      expect(sql).toContain(`CREATE POLICY rsd014_${t}_tenant_select`);
      expect(sql).toContain(`ON public.${t}`);
      expect(sql).toContain('USING (is_tenant_member(tenant_id))');
      expect(sql).toContain(`CREATE POLICY rsd014_${t}_service_all`);
    }
    expect(sql).toContain('TO authenticated');
    expect(sql).toContain('TO service_role');
  });

  it('oeffnet _operation_metrics und seo_marketing_audit_log nicht fuer authenticated', () => {
    for (const t of serviceOnly) {
      expect(sql).toContain(`CREATE POLICY rsd014_${t}_service_all`);
      expect(sql).not.toContain(`rsd014_${t}_tenant_select`);
    }
  });

  it('fasst Partitionen, Stripe/Auth-Funktionen und Edge Functions nicht an', () => {
    expect(sql).not.toMatch(/runtime_events_20/);
    expect(sql).not.toContain('verify_api_key');
    expect(sql).not.toContain('sync_stripe_subscription');
    expect(sql).not.toContain('resolve_api_token');
    expect(sql).not.toContain('custom_access_token_hook');
    expect(sql).not.toContain('check_and_increment_quota');
    expect(sql).not.toContain('get_tenant_branding_by_domain');
    expect(sql).not.toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).not.toMatch(/REVOKE EXECUTE/i);
  });

  it('engt die restriktive memberships-UPDATE-Policy ein, WITH CHECK bleibt', () => {
    expect(sql).toContain('memberships prevent-last-owner-downgrade');
    expect(sql).toContain('AS RESTRICTIVE');
    expect(sql).toContain('USING (is_tenant_member(tenant_id))');
    expect(sql).toContain('WITH CHECK (can_set_membership_role(tenant_id, user_id, role))');
  });

  it('gewaehrt authenticated SELECT nur auf den Member-Tabellen', () => {
    expect(sql).toContain('GRANT SELECT ON TABLE');
    expect(sql).toContain('TO authenticated');
    for (const t of memberTables) {
      expect(sql).toContain(`public.${t}`);
    }
    expect(sql).not.toMatch(/GRANT SELECT[\s\S]*_operation_metrics[\s\S]*TO authenticated/);
  });
});

describe('RSD-014 Rollback', () => {
  it('entfernt die neuen Policies und stellt memberships USING true wieder her', () => {
    for (const t of memberTables) {
      expect(rb).toContain(`DROP POLICY IF EXISTS rsd014_${t}_tenant_select ON public.${t}`);
      expect(rb).toContain(`DROP POLICY IF EXISTS rsd014_${t}_service_all ON public.${t}`);
    }
    expect(rb).toContain('REVOKE SELECT ON TABLE');
    expect(rb).toContain('USING (true)');
    expect(rb).toContain('WITH CHECK (can_set_membership_role(tenant_id, user_id, role))');
  });
});
