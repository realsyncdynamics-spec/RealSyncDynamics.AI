/**
 * Phase 2 der Key-Sanierung: requireCronKey für governance-deadline-monitor,
 * governance-score-calculator und automation-trigger-trial-webhook.
 *
 * Verhalten über checkCronKey (Deno-frei, derselbe Code wie in Produktion),
 * dazu der Quelltext-Vertrag von Helfer, Functions, config.toml, Migration
 * und Runbook.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkCronKey } from '../../supabase/functions/_shared/cronKey';

const KEY = 'k-' + 'z'.repeat(30);
const ENV = 'CRON_GOVERNANCE_SCORE_KEY';

describe('checkCronKey — Verhalten', () => {
  it('passender Bearer → ok', () => {
    expect(checkCronKey(KEY, `Bearer ${KEY}`, ENV)).toEqual({ ok: true });
  });

  it('Leerraum um das Function Secret stört nicht', () => {
    expect(checkCronKey(` ${KEY}\n`, `Bearer ${KEY}`, ENV)).toEqual({ ok: true });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['leer', ''],
    ['nur Leerraum', '   '],
  ])('Secret %s → 500 CRON_KEY_MISSING (fail-closed, auch mit Header)', (_l, key) => {
    expect(checkCronKey(key as string | undefined | null, `Bearer ${KEY}`, ENV)).toEqual({
      ok: false,
      status: 500,
      code: 'CRON_KEY_MISSING',
      message: `${ENV} not configured`,
    });
  });

  it.each([
    ['kein Header', null],
    ['leerer Header', ''],
    ['nur Präfix', 'Bearer '],
    ['falscher Key', `Bearer ${KEY}x`],
    ['Key ohne Präfix', KEY],
    ['anderes Schema', `Basic ${KEY}`],
    ['Präfix kleingeschrieben', `bearer ${KEY}`],
    ['Service-Role-artiger Token', 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig'],
  ])('%s → 401 cron only', (_l, header) => {
    expect(checkCronKey(KEY, header as string | null, ENV)).toEqual({
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'cron only',
    });
  });

  it('Meldungen enthalten weder Key noch Header', () => {
    const r = checkCronKey(KEY, `Bearer wrong-${KEY}`, ENV);
    expect(JSON.stringify(r)).not.toContain(KEY);
  });
});

describe('Quelltext-Vertrag', () => {
  const read = (p: string) => readFileSync(p, 'utf8');

  it('cronKey.ts vergleicht konstantzeitig und bleibt Deno-frei', () => {
    const src = read('supabase/functions/_shared/cronKey.ts');
    expect(src).toMatch(/timingSafeEqual\(header, `Bearer \$\{CRON_KEY\}`\)/);
    expect(src).not.toMatch(/!==\s*`Bearer/);
    expect(src).not.toContain('Deno.');
    expect(src).not.toMatch(/from 'jsr:|from 'npm:/);
  });

  it('requireCronKey in auth.ts liest das Function Secret und delegiert an checkCronKey', () => {
    const src = read('supabase/functions/_shared/auth.ts');
    expect(src).toMatch(/export function requireCronKey\(req: Request, envName: string\): Response \| null/);
    expect(src).toMatch(/checkCronKey\(Deno\.env\.get\(envName\), req\.headers\.get\('Authorization'\), envName\)/);
  });

  const FUNCTIONS = [
    ['governance-deadline-monitor', 'CRON_GOVERNANCE_DEADLINE_KEY', 'cron_governance_deadline_key'],
    ['governance-score-calculator', 'CRON_GOVERNANCE_SCORE_KEY', 'cron_governance_score_key'],
    ['automation-trigger-trial-webhook', 'CRON_TRIAL_WEBHOOK_KEY', 'cron_trial_webhook_key'],
  ] as const;

  const toml = read('supabase/config.toml');
  const stanza = (slug: string) => {
    const head = `[functions.${slug}]`;
    const i = toml.indexOf(head);
    expect(i, `${slug} fehlt in config.toml`).toBeGreaterThanOrEqual(0);
    const rest = toml.slice(i + head.length);
    const next = rest.search(/\n\[/);
    return rest.slice(0, next === -1 ? rest.length : next);
  };

  it.each(FUNCTIONS)('%s prüft %s, nicht den Service-Role-Key', (slug, env) => {
    const src = read(`supabase/functions/${slug}/index.ts`);
    expect(src).toContain(`requireCronKey(req, '${env}')`);
    expect(src).not.toMatch(/requireServiceRole/);
    expect(src).not.toMatch(/Bearer \$\{(SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE|SRK)\}/);
  });

  it.each(FUNCTIONS)('%s: config.toml verify_jwt = false mit Vault- und Secret-Namen', (slug, env, vault) => {
    expect(stanza(slug)).toMatch(/verify_jwt\s*=\s*false/);
    expect(toml).toContain(vault);
    expect(toml).toContain(env);
  });

  it('pre-deploy-lint führt die drei Slugs als öffentlich', () => {
    const lint = read('scripts/pre-deploy-lint.mjs');
    for (const [slug] of FUNCTIONS) expect(lint).toContain(`'${slug}'`);
  });

  it('Runbook führt Vault-Namen und Function Secrets', () => {
    const md = read('docs/runbooks/cron-vault-secrets.md');
    for (const [, env, vault] of FUNCTIONS) {
      expect(md).toContain(vault);
      expect(md).toContain(env);
    }
  });

  describe('Migration 20261103120000', () => {
    const sql = read('supabase/migrations/20261103120000_cron_keys_deadline_score_trial.sql');
    const code = sql
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('--'))
      .join('\n');

    it('stellt die beiden Cron-Jobs per Kommando auf dispatch_cron_function um', () => {
      expect(code).toContain("('governance-deadline-monitor', 'cron_governance_deadline_key')");
      expect(code).toContain("('governance-score-calculator', 'cron_governance_score_key')");
      expect(code).toMatch(/cron\.alter_job\(/);
      expect(code).toMatch(/SELECT public\.dispatch_cron_function\(%L, %L\)/);
      // Name und Zeitplan bleiben live, kein Raten, kein Neuanlegen.
      expect(code).not.toMatch(/cron\.schedule\(/);
      expect(code).not.toMatch(/cron\.unschedule\(/);
      expect(code).not.toMatch(/schedule\s*:=/);
    });

    it('lässt Trial-Webhook-Jobs unberührt', () => {
      const loop = code.slice(code.indexOf('FOR v_target IN'), code.indexOf('END LOOP;\nEND;'));
      expect(loop).not.toContain('automation-trigger-trial-webhook');
    });

    it('Trial-Trigger holt den Token aus cron_trial_webhook_key', () => {
      expect(code).toContain("get_app_secret('cron_trial_webhook_key')");
      expect(code).toContain('CREATE OR REPLACE FUNCTION public.trigger_trial_webhook()');
    });

    it('kein Rückfall auf den Service-Role-Key, keine Secret-Werte', () => {
      expect(code).not.toMatch(/'service_role_key'/);
      expect(code).not.toMatch(/vault\.create_secret/);
      expect(code).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    });

    it('nichts Destruktives', () => {
      expect(code).not.toMatch(/\b(DROP|TRUNCATE|DELETE FROM)\b/i);
    });
  });
});
