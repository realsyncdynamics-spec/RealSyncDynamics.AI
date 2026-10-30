/**
 * Statischer Vertrag: Der Stripe-Webhook koppelt die Bot-Kostenbremsen an den
 * Abo-Lebenszyklus (Migration 20261030120000). Fehler werfen (Stripe-Retry),
 * Enterprise ohne Profil wird als Alarm geloggt.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync('supabase/functions/stripe-webhook/index.ts', 'utf8');

function caseBlock(label: string): string {
  const i = src.indexOf(`case '${label}'`);
  expect(i, label).toBeGreaterThan(-1);
  return src.slice(i, src.indexOf('break;', i));
}

describe('stripe-webhook → bot_usage_sync_from_subscription', () => {
  it('Abo-Events (created/updated/deleted) synchronisieren die Limits', () => {
    expect(caseBlock('customer.subscription.deleted')).toContain('syncBotUsageLimits(admin, subscriptionTenantId(sub), event.id)');
  });
  it('checkout.session.completed (Abo) synchronisiert die Limits', () => {
    expect(caseBlock('checkout.session.completed')).toMatch(/mode === 'subscription'[\s\S]*syncBotUsageLimits\(admin, session\.metadata\?\.tenant_id/);
  });
  it('Quelle ist stripe:<event_id>, DB-Fehler werfen, Enterprise-Alarm wird geloggt', () => {
    expect(src).toContain("admin.rpc('bot_usage_sync_from_subscription'");
    expect(src).toContain('p_source: `stripe:${eventId}`');
    expect(src).toMatch(/if \(error\) throw new Error\(`bot_usage_sync_from_subscription failed/);
    expect(src).toContain("data === 'alarm_missing_profile'");
  });
});
