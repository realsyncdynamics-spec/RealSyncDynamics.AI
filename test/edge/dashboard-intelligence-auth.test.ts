/**
 * dashboard-intelligence — P0/P1-Fix 2026-09-29.
 *
 * Vorher: keine Identitätsprüfung im Handler (verify_jwt=true lässt auch den
 * öffentlichen Anon-Key durch) und service_role-Writes für alle Mandanten;
 * Scores entstanden aus einem festen Basiswert 75 und festen Faktoren, obwohl
 * drei der vier Quelltabellen in keiner Migration existieren.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scoreFromSources, type ScoreSources } from '../../supabase/functions/dashboard-intelligence/score';

const src = readFileSync(resolve(__dirname, '../..', 'supabase/functions/dashboard-intelligence/index.ts'), 'utf8');

const OK_EMPTY: ScoreSources = {
  policies: { data: [], error: null },
  audits: { data: [], error: null },
  incidents: { data: [], error: null },
  dpia: { data: [], error: null },
};

describe('scoreFromSources', () => {
  it('returns insufficient_data when a source table is missing', () => {
    const missingTable = { data: null, error: { code: '42P01', message: 'relation does not exist' } };
    const r = scoreFromSources({ ...OK_EMPTY, policies: missingTable, audits: missingTable });
    expect(r).toEqual({ status: 'insufficient_data', missing: ['policies', 'audits'] });
  });

  it('never derives framework scores from the overall value', () => {
    const r = scoreFromSources(OK_EMPTY);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect([r.gdpr, r.nis2, r.dsa, r.ai_act]).toEqual([null, null, null, null]);
    }
  });
});

describe('dashboard-intelligence handler', () => {
  const handler = src.slice(src.indexOf('Deno.serve('));

  it('verifies user + owner/admin membership before any service-role work', () => {
    const authAt = handler.indexOf("requireAuthAndTenant(req, body.tenant_id, ['owner', 'admin'])");
    expect(authAt).toBeGreaterThan(-1);
    expect(handler.indexOf('updateComplianceScores(')).toBeGreaterThan(authAt);
    expect(handler.indexOf('generateInsights(')).toBeGreaterThan(authAt);
  });

  it('no longer creates its own service-role client or runs for all tenants', () => {
    expect(src).not.toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    expect(handler).toContain('updateComplianceScores(admin, auth.tenantId)');
    expect(handler).toContain('generateInsights(admin, [auth.tenantId])');
  });

  it('does not write category values as multiples of the overall score', () => {
    expect(src).not.toMatch(/scores\.overall \* 0\.9/);
    expect(src).toContain('p_policy_compliance: null');
  });
});
