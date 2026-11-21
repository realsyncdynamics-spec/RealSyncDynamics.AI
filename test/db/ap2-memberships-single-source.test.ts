/**
 * AP2: die aktive Migration bleibt additiv, Rollback und Rueckbau liegen
 * ausserhalb von supabase/migrations, das Pruef-SQL schreibt nicht.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const migration = readFileSync(
  resolve(root, 'supabase/migrations/20261120160200_ap2_memberships_single_source.sql'),
  'utf8',
);
const rollback = readFileSync(
  resolve(root, 'supabase/rollback/20261120160200_ap2_memberships_single_source.sql'),
  'utf8',
);
const draft = readFileSync(
  resolve(root, 'supabase/drafts/NOT_ACTIVATED_ap2_drop_tenant_memberships.sql'),
  'utf8',
);
const verify = readFileSync(
  resolve(root, 'supabase/verify/ap2_tenant_memberships_coverage.sql'),
  'utf8',
);
const repair = readFileSync(
  resolve(root, 'supabase/migrations/20261120180000_ap2_membership_policy_column_guard.sql'),
  'utf8',
);

const policies = [
  'api_calls tenant_member_read',
  'webhook_endpoints tenant_member_read',
  'webhook_endpoints tenant_member_insert',
  'webhook_endpoints tenant_member_update',
  'webhook_endpoints tenant_member_delete',
  'webhook_deliveries tenant_member_read',
  'quota_alerts tenant_member_read',
  'email_notifications tenant_member_read',
  'Users can read controls in their frameworks',
  'Users can create controls in their frameworks',
  'Users can update controls in their frameworks',
  'Users can delete controls in their frameworks',
  'Users can read mappings in their frameworks',
  'Users can create mappings in their frameworks',
  'Users can delete mappings in their frameworks',
  "Users can view their tenant's rate limit configs",
  "Users can update their tenant's rate limit configs",
  "Users can view their tenant's rate limit violations",
];

describe('AP2 Dateivertrag', () => {
  it('stellt jede direkte Policy auf is_tenant_member um und loescht die Tabelle nicht', () => {
    expect(migration).not.toMatch(/DROP\s+TABLE/i);
    expect(migration).not.toMatch(/DROP\s+FUNCTION\s+public\.has_tenant_membership/i);
    expect(migration).toContain('public.is_tenant_member(p_tenant_id)');
    expect(migration).toContain("m.role = 'admin'");
    expect(migration).toContain('FROM public.memberships m');
    expect(migration).toContain('AP2_WRITE_GRANT_SNAPSHOT');
    for (const name of policies) {
      expect(migration).toContain(name);
      expect(rollback).toContain(name);
    }
  });

  it('legt Rollback und Rueckbau nicht in den Migrationsordner', () => {
    expect(rollback).toContain('FROM public.tenant_memberships');
    expect(rollback).toContain('AP2_WRITE_GRANT_SNAPSHOT');
    expect(draft).toContain('NICHT AKTIVIERT');
    expect(draft).toContain('ap2.allow_decommission');
    expect(draft).toContain('DROP TABLE public.tenant_memberships');
    expect(migration).not.toContain('DROP TABLE public.tenant_memberships');
  });

  it('ersetzt die webhook-Policy nur, wenn die genannte Spalte existiert', () => {
    expect(repair).toContain("column_name = 'webhook_id'");
    expect(repair).toContain('FROM public.memberships m');
    expect(repair).toContain("m.role = 'admin'");
    expect(repair).not.toMatch(/DROP\s+TABLE/i);
    expect(rollback).toContain("column_name = 'webhook_id'");
    const restore = rollback.slice(rollback.indexOf('webhook_deliveries tenant_member_read'));
    expect(restore.indexOf("column_name = 'webhook_id'")).toBeLessThan(restore.indexOf('DROP POLICY "webhook_deliveries tenant_member_read"'));
  });

  it('Pruef-SQL ist nur lesend', () => {
    expect(verify).toMatch(/SELECT/i);
    expect(verify).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE)\b/i);
    expect(verify).toContain('fehlend_in_memberships');
    expect(verify).toContain('admin_rolle_weicht');
  });
});
