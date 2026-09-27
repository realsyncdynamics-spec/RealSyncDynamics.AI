import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION = readFileSync(
  resolve(__dirname, '../../supabase/migrations/20260917180000_fix_governance_kpi_rpc_idor.sql'),
  'utf8',
);

const CASES = [
  {
    name: 'governance_kpi_latest_snapshot',
    signature: 'public.governance_kpi_latest_snapshot(UUID)',
    start: 'CREATE OR REPLACE FUNCTION public.governance_kpi_latest_snapshot(p_tenant_id UUID)',
    end: 'CREATE OR REPLACE FUNCTION public.governance_kpi_range(',
  },
  {
    name: 'governance_kpi_range',
    signature: 'public.governance_kpi_range(UUID, DATE, DATE)',
    start: 'CREATE OR REPLACE FUNCTION public.governance_kpi_range(',
    end: 'CREATE OR REPLACE FUNCTION public.governance_kpi_timeseries_data(',
  },
  {
    name: 'governance_kpi_timeseries_data',
    signature: 'public.governance_kpi_timeseries_data(UUID, DATE, DATE, TEXT)',
    start: 'CREATE OR REPLACE FUNCTION public.governance_kpi_timeseries_data(',
    end: 'COMMIT;',
  },
] as const;

function block(start: string, end: string) {
  const from = MIGRATION.indexOf(start);
  const to = MIGRATION.indexOf(end, from + start.length);
  expect(from, `${start} fehlt`).toBeGreaterThan(-1);
  expect(to, `${end} fehlt nach ${start}`).toBeGreaterThan(from);
  return MIGRATION.slice(from, to);
}

describe('Governance KPI RPC IDOR fix migration', () => {
  it('ist additiv und transaktional', () => {
    expect(MIGRATION).toContain('-- loadCockpitData IDOR, DEFINER bypasses snapshot RLS.');
    expect(MIGRATION).toContain('BEGIN;');
    expect(MIGRATION).toContain('COMMIT;');
  });

  it.each(CASES)('%s haelt Mitgliedschaft, service_role und search_path im Rumpf fest', ({ name, start, end }) => {
    const sql = block(start, end);
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain("AND (public.is_tenant_member(p_tenant_id) OR auth.role() = 'service_role')");
    expect(sql).toContain('SET search_path = public, pg_catalog');
    expect(sql).not.toContain('RAISE');
    expect(sql).not.toContain('EXCEPTION');
    expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${name}`);
  });

  it.each(CASES)('%s entzieht PUBLIC/anon und behaelt authenticated/service_role', ({ signature }) => {
    expect(MIGRATION).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC, anon;`);
    expect(MIGRATION).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated, service_role;`);
  });
});
