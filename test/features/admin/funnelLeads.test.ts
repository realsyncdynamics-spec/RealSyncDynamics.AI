/**
 * Lead-Verwaltung: Filter passen zur RPC, Quoten werden nie erfunden,
 * Zugriff wird in der Datenbank geprüft.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONVERSION_LABELS, FUNNEL_FILTERS, formatRate } from '../../../src/features/admin/funnelLeads';

const ROOT = resolve(__dirname, '../../..');
const migration = readFileSync(resolve(ROOT, 'supabase/migrations/20261015120000_funnel_lead_capture.sql'), 'utf8');
const app = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');
const panel = readFileSync(resolve(ROOT, 'src/features/admin/FunnelLeadsPanel.tsx'), 'utf8');

describe('FUNNEL_FILTERS', () => {
  it('offers exactly the five requested stages plus "Alle"', () => {
    expect(FUNNEL_FILTERS.map((f) => f.label)).toEqual([
      'Alle', 'Neu', 'Scan gestartet', 'Scan abgeschlossen', 'Pilot begonnen', 'Kunde geworden',
    ]);
  });
  it('every stage filter is accepted by admin_funnel_leads', () => {
    const allow = migration.match(/p_stage NOT IN \(([^)]+)\)/)?.[1] ?? '';
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
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.erase_lead_data\(text, uuid\) FROM PUBLIC, anon, authenticated;/);
    expect(panel).toContain('Endgültig löschen');
  });
  it('no new RLS policy opens sales_leads to tenants', () => {
    expect(migration).not.toMatch(/CREATE POLICY[^;]*sales_leads/i);
  });
  it('/app/leads is routed to the guarded LeadsView and reads only via RPC', () => {
    expect(app).toContain('<Route path="/app/leads" element={<LeadsView />} />');
    expect(panel).not.toMatch(/from\('sales_leads'\)/);
  });
});
