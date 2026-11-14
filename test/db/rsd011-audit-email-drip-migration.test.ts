/**
 * RSD-011: die additive Drip-Migration bleibt idempotent, haelt die
 * Original-Signatur und das Consent-Gate aus 20261015120000, und vergibt
 * EXECUTE nur an service_role. Kein Live-DB-Zugriff.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = resolve(
  __dirname,
  '../../supabase/migrations/20261114104500_rsd011_restore_audit_email_drip.sql',
);
const rollback = resolve(
  __dirname,
  '../../supabase/rollback/20261114104500_rsd011_restore_audit_email_drip.sql',
);
const sql = readFileSync(migration, 'utf8');
const rb = readFileSync(rollback, 'utf8');

describe('RSD-011 Migration 20261114104500', () => {
  it('liegt zusammen mit einer Rollback-Datei vor', () => {
    expect(existsSync(migration)).toBe(true);
    expect(existsSync(rollback)).toBe(true);
  });

  it('legt Tabelle, Indizes und RLS additiv und idempotent an', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.audit_email_drip');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_audit_drip_due');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_audit_drip_email');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_drip_unsubscribe');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('CREATE POLICY "drip_service_all"');
    expect(sql).toContain('TO service_role');
    expect(sql).not.toMatch(/DROP TABLE\s+public\.audit_email_drip/i);
  });

  it('setzt die drei Funktionen per CREATE OR REPLACE mit Original-Signatur', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.audit_email_drip_create_for_audit\s*\(\s*\)/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.audit_email_drip_due\s*\(\s*p_limit int DEFAULT 50\s*\)/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.audit_email_drip_advance\s*\(\s*p_id uuid,\s*p_error text DEFAULT NULL\s*\)/);
    expect(sql).toContain('DROP TRIGGER IF EXISTS trg_audit_create_drip ON public.gdpr_audits');
    expect(sql).toContain('EXECUTE FUNCTION public.audit_email_drip_create_for_audit()');
  });

  it('bewahrt das Consent- und Double-Opt-in-Gate aus 20261015120000', () => {
    expect(sql).toContain('a.marketing_consent = true');
    expect(sql).toContain('a.marketing_consent_revoked_at IS NULL');
    expect(sql).toContain('l.followup_doi_confirmed_at IS NOT NULL');
    expect(sql).toContain('l.marketing_consent_revoked_at IS NULL');
    expect(sql).toContain('JOIN public.sales_leads l ON l.id = a.sales_lead_id');
    expect(sql).toContain('AND d.current_step < 3');
  });

  it('entzieht PUBLIC/anon/authenticated EXECUTE und gewaehrt service_role due/advance', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.audit_email_drip_due(int) FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.audit_email_drip_due(int) TO service_role');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.audit_email_drip_advance(uuid, text) FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.audit_email_drip_advance(uuid, text) TO service_role');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.audit_email_drip_create_for_audit() FROM PUBLIC, anon, authenticated');
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.audit_email_drip_due\(int\) TO (PUBLIC|anon|authenticated)/);
  });

  it('fasst den bestehenden Cron-Job und keine Secrets an', () => {
    expect(sql).not.toMatch(/cron\.schedule/i);
    expect(sql).not.toMatch(/cron\.alter_job/i);
    expect(sql).not.toMatch(/net\.http_post\s*\(/i);
    expect(sql).not.toMatch(/vault\./i);
    expect(sql).not.toMatch(/service_role_key|Bearer /);
  });
});

describe('RSD-011 Rollback', () => {
  it('entfernt Trigger und Funktionen und droppt die Tabelle nur wenn leer', () => {
    expect(rb).toContain('DROP TRIGGER IF EXISTS trg_audit_create_drip ON public.gdpr_audits');
    expect(rb).toContain('DROP FUNCTION IF EXISTS public.audit_email_drip_due(integer)');
    expect(rb).toContain('DROP FUNCTION IF EXISTS public.audit_email_drip_advance(uuid, text)');
    expect(rb).toContain('DROP FUNCTION IF EXISTS public.audit_email_drip_create_for_audit()');
    expect(rb).toContain('IF EXISTS (SELECT 1 FROM public.audit_email_drip)');
    expect(rb).toContain('DROP TABLE public.audit_email_drip');
  });
});
