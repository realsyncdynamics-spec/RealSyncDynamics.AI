/**
 * Offline guards for PR A (#1806) migration — no drip coupling.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/20261008133000_audit_marketing_consent.sql'),
  'utf8',
);

describe('PR A marketing consent migration (offline)', () => {
  it('never references audit_email_drip or drip RPCs', () => {
    expect(sql.toLowerCase()).not.toMatch(/audit_email_drip/);
    expect(sql.toLowerCase()).not.toMatch(/drip-unsubscribe/);
  });

  it('adds consent columns to sales_leads and gdpr_audits idempotently', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS marketing_consent_text_version text/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS marketing_consent_revoked_at timestamptz/);
    expect(sql).toMatch(/ALTER TABLE public\.sales_leads/);
    expect(sql).toMatch(/ALTER TABLE public\.gdpr_audits/);
  });

  it('allowlists audit_followup_v1_de and audit_followup_v1_en', () => {
    expect(sql).toMatch(/audit_followup_v1_de/);
    expect(sql).toMatch(/audit_followup_v1_en/);
  });

  it('uses search_path = \'\' and revokes trigger functions from public/anon/authenticated', () => {
    expect(sql).toMatch(/SET search_path = ''/);
    expect(sql).toMatch(/pg_catalog\.now\(\)/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.marketing_consent_before_insert\(\) FROM PUBLIC/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.marketing_consent_before_insert\(\) FROM anon/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.marketing_consent_before_insert\(\) FROM authenticated/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.marketing_consent_before_update\(\) FROM PUBLIC/);
  });
});
