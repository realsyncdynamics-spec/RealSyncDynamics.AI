import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Die letzten sechs Cron-Empfänger auf dedizierte CRON_* Keys (2026-11-08).
 *
 * Live-Befund: Alle Jobs, die noch Vault `service_role_key` übergaben,
 * scheiterten mit 401 (Daily Digest, Audit-Recheck, Drip, Sub-Processor-
 * Notify, Deadline-Monitor, Score-Calculator). Vertrag wie beim Cron-Trio
 * (`cron-dedicated-keys.test.ts`): verify_jwt=false + eigener Bearer-Check
 * gegen den CRON_* Function Secret, fail-closed bei leerem Key.
 */

const SIX = [
  { slug: 'daily-digest', job: 'daily-digest', env: 'CRON_DAILY_DIGEST_KEY', vault: 'cron_daily_digest_key' },
  { slug: 'audit-recheck-weekly', job: 'audit-recheck-daily', env: 'CRON_AUDIT_RECHECK_KEY', vault: 'cron_audit_recheck_key' },
  { slug: 'audit-drip-cron', job: 'audit-email-drip-daily', env: 'CRON_AUDIT_DRIP_KEY', vault: 'cron_audit_drip_key' },
  { slug: 'sub-processor-notify', job: 'sub-processor-notify-daily', env: 'CRON_SUB_PROCESSOR_NOTIFY_KEY', vault: 'cron_sub_processor_notify_key' },
  { slug: 'governance-deadline-monitor', job: 'governance-deadline-monitor-daily', env: 'CRON_GOVERNANCE_DEADLINE_KEY', vault: 'cron_governance_deadline_key' },
  { slug: 'governance-score-calculator', job: 'governance-score-calculator-hourly', env: 'CRON_GOVERNANCE_SCORE_KEY', vault: 'cron_governance_score_key' },
] as const;

const MIGRATION = 'supabase/migrations/20261108170000_cron_dedicated_keys_remaining.sql';

const source = (slug: string) => readFileSync(`supabase/functions/${slug}/index.ts`, 'utf8');

function stanza(slug: string): string {
  const toml = readFileSync('supabase/config.toml', 'utf8');
  const kopf = `[functions.${slug}]`;
  const start = toml.indexOf(kopf);
  expect(start, `${slug} fehlt in config.toml`).toBeGreaterThanOrEqual(0);
  const rest = toml.slice(start + kopf.length);
  const next = rest.search(/\n\[/);
  return rest.slice(0, next === -1 ? rest.length : next);
}

describe('Cron-Rest: dedizierter CRON_* Key statt service_role', () => {
  for (const { slug, env, vault } of SIX) {
    it(`${slug} liest ${env} und nennt Vault ${vault}`, () => {
      const text = source(slug);
      expect(text).toContain(`Deno.env.get('${env}')`);
      expect(text).toContain(vault);
    });

    it(`${slug}: leerer Key → 500 CRON_KEY_MISSING vor dem Bearer-Vergleich`, () => {
      const text = source(slug);
      const missing = text.search(/if \(!CRON_KEY\) \{\s*return jsonError\(500, 'CRON_KEY_MISSING', /);
      expect(missing).toBeGreaterThanOrEqual(0);
      expect(text).toContain(`'CRON_KEY_MISSING', '${env} not configured'`);
      const compare = text.search(/authHeader\s*!==\s*`Bearer \$\{CRON_KEY\}`/);
      expect(compare).toBeGreaterThan(missing);
    });

    it(`${slug}: falscher Bearer → 401 "cron only"`, () => {
      expect(source(slug)).toMatch(/if \(authHeader\s*!==\s*`Bearer \$\{CRON_KEY\}`\) \{\s*return [^\n]*401/);
    });

    it(`${slug}: Inbound-Auth vergleicht nie gegen service_role`, () => {
      const text = source(slug);
      expect(text).not.toMatch(/authHeader\s*!==\s*`Bearer \$\{(SRK|SERVICE_KEY|SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY)\}`/);
      expect(text).not.toMatch(/requireServiceRole\s*\(/);
    });

    it(`${slug} steht in config.toml auf verify_jwt = false`, () => {
      expect(stanza(slug)).toMatch(/verify_jwt\s*=\s*false/);
    });
  }

  it('Migration stellt alle sechs Jobs auf Vault cron_* um', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    for (const { slug, job, vault } of SIX) {
      expect(sql).toContain(`'${job}'`);
      expect(sql).toContain(`'${slug}'`);
      expect(sql).toContain(`'${vault}'`);
    }
    expect(sql).not.toMatch(/'service_role_key'/);
  });

  it('pre-deploy-lint führt die neuen Cron-Slugs in REQUIRED_PUBLIC_FUNCTIONS', () => {
    const lint = readFileSync('scripts/pre-deploy-lint.mjs', 'utf8');
    for (const { slug } of SIX) expect(lint).toContain(`'${slug}'`);
  });
});
