import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * UNDECLARED_NO_JWT — Drift-Guard 2026-09-10.
 *
 * Drei Cron-Functions liefen live mit verify_jwt=false, ohne Stanza in
 * config.toml. Zwei prüfen den Service-Role-Bearer selbst; der
 * Monitoring-Scheduler tat das nicht — bei ausgeschaltetem Gateway-JWT
 * wäre er für jeden im Internet auslösbar.
 *
 * Wer verify_jwt abschaltet, übernimmt die Auth. Der Test hält beides:
 * die Deklaration und den Bearer-Check.
 */

const TOML = readFileSync('supabase/config.toml', 'utf8');

function stanza(slug: string): string {
  const kopf = `[functions.${slug}]`;
  const start = TOML.indexOf(kopf);
  expect(start, `${slug} fehlt in config.toml`).toBeGreaterThanOrEqual(0);
  const rest = TOML.slice(start + kopf.length);
  const next = rest.search(/\n\[/);
  return rest.slice(0, next === -1 ? rest.length : next);
}

function source(slug: string): string {
  return readFileSync(`supabase/functions/${slug}/index.ts`, 'utf8');
}

const CRON_SLUGS = [
  'governance-monitoring-scheduler',
  'scheduler-dispatch',
  'memory-decay-worker',
  'daily-digest',
  'audit-drip-cron',
  'audit-recheck-weekly',
  'governance-analytics-aggregator',
  'sub-processor-notify',
  'website-maintenance-daily-cron',
] as const;

describe('Cron-Functions: verify_jwt=false ist deklariert und selbst geprüft', () => {
  for (const slug of CRON_SLUGS) {
    it(`${slug} steht in config.toml auf verify_jwt = false`, () => {
      expect(stanza(slug)).toMatch(/verify_jwt\s*=\s*false/);
    });

    it(`${slug} weist fremde Bearer mit 401 ab`, () => {
      const src = source(slug);
      expect(src).toMatch(/Authorization/);
      expect(src).toMatch(/401/);
      expect(src).toMatch(/cron only|service role required|UNAUTHORIZED/);
    });
  }

  it('pre-deploy-lint führt die Cron-Slugs in REQUIRED_PUBLIC_FUNCTIONS', () => {
    const lint = readFileSync('scripts/pre-deploy-lint.mjs', 'utf8');
    for (const slug of [
      'governance-monitoring-scheduler',
      'scheduler-dispatch',
      'memory-decay-worker',
      'sub-processor-notify',
      'website-maintenance-daily-cron',
    ]) {
      expect(lint).toContain(`'${slug}'`);
    }
  });

  it('stellt Digest, Recheck und Drip auf dispatch_cron_function um', () => {
    const sql = readFileSync('supabase/migrations/20260910180000_cron_auth_remaining.sql', 'utf8');
    expect(sql).toContain("dispatch_cron_function");
    expect(sql).toContain("'daily-digest'");
    expect(sql).toContain("'audit-recheck-weekly'");
    expect(sql).toContain("'audit-drip-cron'");
    expect(sql).toContain("'service_role_key'");
    expect(sql).toMatch(/SELECT public\.dispatch_cron_function/g);
  });

  it('stellt sub-processor-notify-daily auf dispatch_cron_function um', () => {
    const sql = readFileSync(
      'supabase/migrations/20260910190000_cron_auth_sub_processor.sql',
      'utf8',
    );
    expect(sql).toContain("dispatch_cron_function");
    expect(sql).toContain("'sub-processor-notify'");
    expect(sql).toContain("'sub-processor-notify-daily'");
    expect(sql).toContain("'service_role_key'");
  });

  it('website-maintenance-agent sperrt run-daily-maintenance hinter den Service-Role-Bearer', () => {
    const src = source('website-maintenance-agent');
    expect(src).toMatch(/run-daily-maintenance/);
    expect(src).toMatch(/Authorization/);
    expect(src).toMatch(/401/);
    expect(src).toMatch(/cron only/);
  });
});
