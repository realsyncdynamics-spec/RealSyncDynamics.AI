/**
 * RSD-015 schema restoration contract checks. These are static tests:
 * they do not verify a real database or delivery and MUST NOT be represented
 * as a production-ready end-to-end test.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(__dirname, '../../supabase/migrations/20261117163800_rsd015_restore_sub_processor_schema.sql'), 'utf8',
);
const rollback = readFileSync(
  resolve(__dirname, '../../supabase/rollback/20261117163800_rsd015_restore_sub_processor_schema.sql'), 'utf8',
);
const publicPage = readFileSync(
  resolve(__dirname, '../../src/features/legal/SubProcessors.tsx'), 'utf8',
);

describe('RSD-015 additive subprocessor schema', () => {
  it('restores all three original tables, nonduplicate receipts and verified state', () => {
    for (const table of [
      'sub_processor_subscriptions',
      'sub_processor_changes',
      'sub_processor_notifications',
    ]) {
      expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.' + table);
      expect(migration).toContain('ALTER TABLE public.' + table + ' ENABLE ROW LEVEL SECURITY');
    }
    expect(migration).toContain('verified_at');
    expect(migration).toContain('UNIQUE (change_id, subscription_id)');
    expect(migration).toContain('sp_notif_sent_receipt_only');
  });

  it('does not reopen the original anonymous or authenticated Data API', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "sp_sub_anon_insert"');
    expect(migration).toContain('DROP POLICY IF EXISTS "sp_changes_authenticated_read"');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO service_role');
    expect(migration).not.toMatch(/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE)\b[\s\S]*?\bTO\s+(?:anon|authenticated)\b/i);
    expect(migration).not.toContain('TO anon, authenticated\n  WITH CHECK (true)');
  });

  it('provides service-only SECURITY INVOKER RPCs with pinned schema lookup', () => {
    expect(migration).toContain('public.sub_processor_changes_pending()');
    expect(migration).toContain('public.sub_processor_change_mark_notified(p_id uuid)');
    expect(migration).toContain('LANGUAGE sql STABLE SECURITY INVOKER SET search_path =');
    expect(migration).toContain("LANGUAGE plpgsql SECURITY INVOKER SET search_path =");
    expect(migration).not.toContain('SECURITY DEFINER');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.sub_processor_changes_pending()');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.sub_processor_change_mark_notified(uuid)');
  });

  it('will not mark zero recipients or any missing/failed delivery as notified', () => {
    expect(migration).toContain('AND EXISTS (');
    expect(migration).toContain('AND NOT EXISTS (');
    expect(migration).toContain('s.verified_at IS NOT NULL AND s.unsubscribed_at IS NULL');
    expect(migration).toContain('n.resend_message_id IS NOT NULL');
    expect(migration).toContain('n.error_message IS NULL');
    expect(migration).toContain("RAISE EXCEPTION 'change not fully notified");
  });

  it('avoids old cron/secret reconfiguration and live side effects', () => {
    expect(migration).not.toMatch(/cron\.schedule|cron\.alter_job|net\.http_post/);
    expect(migration).not.toMatch(/vault\.|set_app_secret|service_role_key|RESEND_API_KEY/);
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.sub_processor/i);
  });

  it('refuses rollback when any table contains evidence or subscriptions', () => {
    expect(rollback).toContain('rollback refused: preserving nonempty tables');
    expect(rollback).toContain('SELECT 1 FROM public.sub_processor_notifications');
    expect(rollback).toContain('SELECT 1 FROM public.sub_processor_changes');
    expect(rollback).toContain('SELECT 1 FROM public.sub_processor_subscriptions');
    expect(rollback).not.toContain('CASCADE');
  });
});

describe('RSD-015 public subscription release gate', () => {
  it('does not send address data directly via anonymous PostgREST', () => {
    expect(publicPage).not.toContain('rest/v1/sub_processor_subscriptions');
    expect(publicPage).not.toContain('getSupabaseAnonKey');
    expect(publicPage).not.toContain('Authorization: `Bearer ${SUPABASE_ANON_KEY}`');
  });

  it('does not falsely confirm registration or automatic notifications', () => {
    expect(publicPage).not.toContain('SubProcessorSubscribeForm');
    expect(publicPage).not.toContain('Wir senden dir 30 Tage vor jeder');
    expect(publicPage).not.toContain('Eingetragen.');
    expect(publicPage).toContain('Der automatische E-Mail-Anmeldeprozess ist derzeit nicht freigegeben.');
    expect(publicPage).toContain('keine bestätigte Anmeldung');
    expect(publicPage).toContain('mailto:privacy@realsyncdynamicsai.de');
  });
});
