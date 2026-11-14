import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Trial-Webhook (2026-11-08): DB-Trigger trigger_trial_webhook und Function
 * automation-trigger-trial-webhook nutzen den eigenen Key cron_trial_webhook_key
 * statt Vault service_role_key. Vertrag wie die Cron-Empfänger aus #2119
 * (_shared/cronKey.ts: fail-closed, konstantzeitig, Vault-Fallback).
 */

const fnSrc = () => readFileSync('supabase/functions/automation-trigger-trial-webhook/index.ts', 'utf8');
const sql = () => readFileSync('supabase/migrations/20261108180000_trial_webhook_cron_key.sql', 'utf8');

function stanza(slug: string): string {
  const toml = readFileSync('supabase/config.toml', 'utf8');
  const kopf = `[functions.${slug}]`;
  const start = toml.indexOf(kopf);
  expect(start, `${slug} fehlt in config.toml`).toBeGreaterThanOrEqual(0);
  const rest = toml.slice(start + kopf.length);
  const next = rest.search(/\n\[/);
  return rest.slice(0, next === -1 ? rest.length : next);
}

describe('Trial-Webhook: eigener Key statt service_role', () => {
  it('Function prüft requireCronKey mit CRON_TRIAL_WEBHOOK_KEY / cron_trial_webhook_key', () => {
    const s = fnSrc();
    expect(s).toContain("from '../_shared/cronKey.ts'");
    expect(s).toMatch(/await requireCronKey\(req, 'CRON_TRIAL_WEBHOOK_KEY', 'cron_trial_webhook_key'/);
    expect(s).not.toMatch(/requireServiceRole\s*\(/);
  });

  it('config.toml: verify_jwt = false (Key ist kein JWT, Prüfung im Code)', () => {
    expect(stanza('automation-trigger-trial-webhook')).toMatch(/verify_jwt\s*=\s*false/);
  });

  it('pre-deploy-lint führt den Slug in REQUIRED_PUBLIC_FUNCTIONS', () => {
    expect(readFileSync('scripts/pre-deploy-lint.mjs', 'utf8')).toContain("'automation-trigger-trial-webhook'");
  });

  it('Migration: Trigger liest cron_trial_webhook_key, nie service_role_key', () => {
    const s = sql();
    expect(s).toContain("get_app_secret('cron_trial_webhook_key')");
    expect(s).not.toMatch(/get_app_secret\('service_role_key'\)/);
    // Fehlendes Secret blockiert den INSERT nicht.
    expect(s).toMatch(/IF v_token IS NULL OR v_token = '' THEN\s*RAISE WARNING[^;]*;\s*RETURN NEW;/);
  });
});
