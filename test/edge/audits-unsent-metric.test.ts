/**
 * „Audits unversendet“ zählt nur Audits mit Empfänger.
 *
 * Mandanten- und Optimizer-Scans speichern gdpr_audits.email = '' (keine
 * Adresse, kein Versand vorgesehen). Als „unversendet“ gezählt, lösten sie in
 * /admin/system und im Daily Digest die Warnung „Resend-Key fehlt?“ aus.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('audits_unsent_email ohne Audits ohne Empfänger', () => {
  it('admin_system_health filtert email <> \'\' (und ändert sonst nichts)', () => {
    const before = readFileSync('supabase/migrations/20260506190000_admin_system_health_rpc.sql', 'utf8');
    const after = readFileSync('supabase/migrations/20261010041500_admin_health_exclude_recipientless_audits.sql', 'utf8');
    const fn = (sql: string) => sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION'), sql.indexOf('$$;') + 3);
    expect(fn(after)).toContain("WHERE email_sent_at IS NULL AND email <> '' AND created_at > now() - interval '24 hours'");
    expect(fn(after).replace(" AND email <> ''", '')).toBe(fn(before));
  });

  it('daily-digest filtert dieselben Zeilen', () => {
    const src = readFileSync('supabase/functions/daily-digest/index.ts', 'utf8');
    expect(src).toContain(".is('email_sent_at', null).neq('email', '')");
  });
});
