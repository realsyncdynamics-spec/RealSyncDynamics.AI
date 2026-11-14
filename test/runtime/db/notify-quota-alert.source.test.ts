import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MIGRATION = 'supabase/migrations/20261113180000_fix_notify_quota_alert.sql';
const sql = readFileSync(MIGRATION, 'utf8');

describe('notify_quota_alert Fix-Migration (Quellvertrag)', () => {
  it('hängt Empfänger an public.memberships, nicht an tenant_memberships', () => {
    expect(sql).toMatch(/FROM public\.memberships m/);
    expect(sql).toMatch(/m\.role IN \('owner', 'admin'\)/);
    expect(sql).not.toMatch(/FROM public\.tenant_memberships/);
  });

  it('schreibt Live-Spalten von webhook_deliveries, nicht das Alt-Schema', () => {
    expect(sql).toMatch(/INSERT INTO public\.webhook_deliveries \(/);
    expect(sql).toMatch(/subscription_id/);
    expect(sql).toMatch(/event_key/);
    expect(sql).toMatch(/request_body/);
    expect(sql).not.toMatch(/INSERT INTO public\.webhook_deliveries \(webhook_id, event_type, event_data/);
  });

  it('bildet warning_80/limit_exceeded auf zulässige email_notifications.event_type ab', () => {
    expect(sql).toMatch(/WHEN 'warning_80' THEN 'quota_warning'/);
    expect(sql).toMatch(/WHEN 'limit_exceeded' THEN 'quota_exceeded'/);
    expect(sql).toMatch(/VALUES \(\s*p_tenant_id, v_member_email, v_email_event_type/s);
  });

  it('bewahrt SECURITY DEFINER, search_path und service_role-Grant', () => {
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path TO 'public', 'extensions', 'pg_temp'/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.notify_quota_alert\(uuid, text, integer, integer\) TO service_role/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.notify_quota_alert\(uuid, text, integer, integer\) FROM anon, authenticated/);
  });

  it('ergänzt die fehlenden Katalog-Keys und bleibt eine reine Datei-Migration', () => {
    expect(sql).toMatch(/'quota\.warning'/);
    expect(sql).toMatch(/'quota\.exceeded'/);
    expect(sql).toMatch(/NICHT anwenden, bevor Dominik die Migration ausdrücklich freigibt/);
  });
});
