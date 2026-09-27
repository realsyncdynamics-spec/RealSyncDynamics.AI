import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Live-Hotfix-Vertrag: Drift-Guard bleibt (verify_jwt=false + eigener
 * Bearer-Check), Credential ist der dedizierte CRON_* Function Secret,
 * fail-closed bei leerem Key. SUPABASE_SERVICE_ROLE_KEY darf nach Auth für
 * PostgREST genutzt werden — nie mit dem inbound Authorization verglichen.
 */

const TRIO = [
  {
    slug: 'governance-monitoring-scheduler',
    env: 'CRON_GOVERNANCE_MONITORING_KEY',
    vault: 'cron_governance_monitoring_key',
  },
  {
    slug: 'scheduler-dispatch',
    env: 'CRON_SCHEDULER_DISPATCH_KEY',
    vault: 'cron_scheduler_dispatch_key',
  },
  {
    slug: 'memory-decay-worker',
    env: 'CRON_MEMORY_DECAY_KEY',
    vault: 'cron_memory_decay_key',
  },
] as const;

function source(slug: string): string {
  return readFileSync(`supabase/functions/${slug}/index.ts`, 'utf8');
}

describe('Cron-Trio: dedizierter CRON_* Key, fail-closed', () => {
  for (const { slug, env, vault } of TRIO) {
    const src = () => source(slug);

    it(`${slug} liest ${env} und vergleicht Bearer dagegen`, () => {
      expect(src()).toContain(`Deno.env.get('${env}')`);
      expect(src()).toMatch(new RegExp(`Bearer \\\$\\{CRON_KEY\\}`));
      expect(src()).toContain(vault);
    });

    it(`${slug}: leerer Key → 401 (fail-closed)`, () => {
      expect(src()).toMatch(/!CRON_KEY\s*\|\|/);
      expect(src()).toMatch(/401/);
      expect(src()).toMatch(/cron only/);
    });

    it(`${slug}: falscher Bearer → 401`, () => {
      expect(src()).toMatch(/authHeader\s*!==\s*`Bearer \$\{CRON_KEY\}`/);
      expect(src()).toMatch(/401/);
    });

    it(`${slug}: inbound Auth vergleicht nicht gegen SERVICE_ROLE`, () => {
      const text = src();
      // SERVICE_ROLE / SERVICE_KEY dürfen nach Auth für PostgREST bleiben,
      // aber nicht im Auth-Guard mit dem Authorization-Header verglichen werden.
      expect(text).not.toMatch(
        /authHeader\s*!==\s*`Bearer \$\{(SERVICE_KEY|SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY)\}`/,
      );
      expect(text).not.toMatch(
        /Authorization[^\n]*Bearer \$\{(SERVICE_KEY|SERVICE_ROLE)\}[^\n]*401|Bearer \$\{(SERVICE_KEY|SERVICE_ROLE)\}[^\n]*authHeader/,
      );
      expect(text).not.toContain('service role required');
      expect(text).not.toContain("current_setting('app.service_role_key')");
    });
  }

  it('config.toml beschreibt Vault cron_* → CRON_* Function Secrets', () => {
    const toml = readFileSync('supabase/config.toml', 'utf8');
    const blockStart = toml.indexOf('Die drei folgenden laufen live');
    expect(blockStart).toBeGreaterThanOrEqual(0);
    const block = toml.slice(blockStart, blockStart + 900);
    expect(block).toContain('cron_governance_monitoring_key');
    expect(block).toContain('cron_scheduler_dispatch_key');
    expect(block).toContain('cron_memory_decay_key');
    expect(block).toContain('CRON_GOVERNANCE_MONITORING_KEY');
    expect(block).toContain('CRON_SCHEDULER_DISPATCH_KEY');
    expect(block).toContain('CRON_MEMORY_DECAY_KEY');
    expect(block).not.toMatch(/Service-Role-Bearer/);
  });

  it('Migration 20260912180000 stellt Trio-Jobs auf Vault cron_* um', () => {
    const sql = readFileSync(
      'supabase/migrations/20260912180000_cron_trio_dedicated_keys.sql',
      'utf8',
    );
    expect(sql).toContain("'cron_scheduler_dispatch_key'");
    expect(sql).toContain("'cron_governance_monitoring_key'");
    expect(sql).toContain("'cron_memory_decay_key'");
    expect(sql).toContain("'scan-scheduler-dispatch'");
    expect(sql).toContain("'governance-monitoring-daily'");
    expect(sql).toContain("'governance-monitoring-hourly'");
    expect(sql).toContain("'memory-decay-hourly'");
    expect(sql).toContain('dispatch_cron_function');
    // Kein Re-Wire auf den kompromittierten Inbound-Vertrag.
    expect(sql).not.toMatch(/'service_role_key'/);
  });
});

/**
 * email-auth-rescan (website-rescan-daily) — gleicher Vertrag wie das Trio,
 * aber mit Constant-Time-Vergleich in logic.ts (checkCronAuth) statt `!==`
 * in index.ts. Die Verhaltens-Tests (401/500 ohne DB-/DNS-Zugriff) stehen in
 * test/edge/email-auth-rescan.test.ts; hier nur der Quelltext-Vertrag.
 */
describe('email-auth-rescan: dedizierter CRON_WEBSITE_RESCAN_KEY, fail-closed', () => {
  const index = () => readFileSync('supabase/functions/email-auth-rescan/index.ts', 'utf8');
  const logic = () => readFileSync('supabase/functions/email-auth-rescan/logic.ts', 'utf8');

  it('liest CRON_WEBSITE_RESCAN_KEY und nennt den Vault-Namen', () => {
    expect(index()).toContain("Deno.env.get('CRON_WEBSITE_RESCAN_KEY')");
    expect(index()).toContain('cron_website_rescan_key');
    expect(index()).toContain('checkCronAuth(');
  });

  it('leerer Key → 500, falscher Bearer → 401 "cron only", Constant-Time-Vergleich', () => {
    const src = logic();
    expect(src).toMatch(/if \(!CRON_KEY\)/);
    expect(src).toMatch(/status: 500/);
    expect(src).toMatch(/status: 401/);
    expect(src).toContain('cron only');
    expect(src).toMatch(/timingSafeEqual\(header, `Bearer \$\{CRON_KEY\}`\)/);
  });

  it('inbound Auth vergleicht nicht gegen SERVICE_ROLE', () => {
    for (const text of [index(), logic()]) {
      expect(text).not.toMatch(/Bearer \$\{(SERVICE_KEY|SERVICE_ROLE|SRK|SUPABASE_SERVICE_ROLE_KEY)\}/);
      expect(text).not.toContain('service role required');
    }
  });

  it('config.toml: verify_jwt=false mit Hinweis auf Vault → Function Secret', () => {
    const toml = readFileSync('supabase/config.toml', 'utf8');
    const i = toml.indexOf('[functions.email-auth-rescan]');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(toml.slice(i, i + 80)).toMatch(/verify_jwt\s*=\s*false/);
    const before = toml.slice(Math.max(0, i - 600), i);
    expect(before).toContain('cron_website_rescan_key');
    expect(before).toContain('CRON_WEBSITE_RESCAN_KEY');
  });

  it('Migration 20260925210000 plant website-rescan-daily mit Vault cron_website_rescan_key', () => {
    const sql = readFileSync('supabase/migrations/20260925210000_email_auth_rescan.sql', 'utf8');
    expect(sql).toContain("'website-rescan-daily'");
    expect(sql).toContain("'30 3 * * *'");
    expect(sql).toContain("'email-auth-rescan'");
    expect(sql).toContain("'cron_website_rescan_key'");
    expect(sql).toContain('dispatch_cron_function');
    expect(sql).toMatch(/cron\.unschedule\('website-rescan-daily'\)/);
    expect(sql).not.toMatch(/'service_role_key'/);
  });

  it('Runbook führt Vault-Namen und Function Secret', () => {
    const md = readFileSync('docs/runbooks/cron-vault-secrets.md', 'utf8');
    expect(md).toContain('cron_website_rescan_key');
    expect(md).toContain('CRON_WEBSITE_RESCAN_KEY');
    expect(md).toContain('website-rescan-daily');
  });
});
