// File-Guard (.claude/hooks/file-guard.mjs): technische Änderungskontrolle
// für Agenten. Prüft Regel-Logik und den echten Hook-Prozess (Exit-Code 2).
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { evaluate, globToRegExp, loadConfig } from '../../.claude/hooks/file-guard.mjs';

const ROOT = resolve(__dirname, '../..');
const HOOK = join(ROOT, '.claude/hooks/file-guard.mjs');
const cfg = loadConfig(join(ROOT, '.claude/hooks/file-guard.json'));
const check = (p: string) => evaluate(p, ROOT, cfg);

describe('globToRegExp', () => {
  it('** über Verzeichnisgrenzen, * nicht', () => {
    expect(globToRegExp('src/**').test('src/a/b/c.tsx')).toBe(true);
    expect(globToRegExp('src/*.ts').test('src/a/b.ts')).toBe(false);
    expect(globToRegExp('**/*.generated.ts').test('supabase/functions/_shared/pricing.generated.ts')).toBe(true);
    expect(globToRegExp('**/.env').test('.env')).toBe(true);
  });
});

describe('evaluate — geschützte Bereiche', () => {
  it.each([
    'supabase/migrations/20261126000000_x.sql',
    'supabase/functions/ai-invoke/index.ts',
    '.github/workflows/deploy.yml',
    'shared/pricing.ts',
    'src/config/pricing.ts',
    'src/lib/stripe.ts',
    'src/lib/supabase.ts',
    'src/features/auth/LoginPage.tsx',
    'src/features/billing/StripeAccountInfo.tsx',
    'src/core/access/RouteEntitlementGate.tsx',
    '.claude/settings.json',
    '.claude/hooks/file-guard.json',
    '.env.local',
    'package.json',
    'wrangler.toml',
  ])('blockiert %s', (p) => {
    expect(check(p).allowed).toBe(false);
  });

  it.each(['workers/govard-gateway/src/index.ts', 'services/x/index.ts', 'platform/builder_orchestrator/app/main.py', 'CLAUDE.md'])(
    'blockiert %s (nicht in der Allowlist)',
    (p) => {
      const r = check(p);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe('nicht in der Allowlist');
    },
  );

  it('Pfadtricks führen nicht aus der Prüfung', () => {
    expect(check('src/../supabase/config.toml').allowed).toBe(false);
    expect(check(join(ROOT, 'supabase/config.toml')).allowed).toBe(false);
  });
});

describe('evaluate — erlaubte Frontend-Bereiche', () => {
  it.each([
    'src/components/landing/v3/HeroStage.tsx',
    'src/pages/LandingV3.tsx',
    'public/landing-v3/hero-still.jpg',
    'test/landing/landing-v3.test.tsx',
    'docs/product/capability-matrix.md',
    '.claude/agents/rea.md',
  ])('erlaubt %s', (p) => {
    expect(check(p).allowed).toBe(true);
  });

  it('erlaubt Pfade außerhalb des Repos', () => {
    expect(check('/tmp/scratch.txt').allowed).toBe(true);
  });
});

describe('Hook-Prozess', () => {
  const run = (input: string) =>
    spawnSync(process.execPath, [HOOK], { input, env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT }, encoding: 'utf8' });

  it('Exit 2 bei geschütztem Pfad', () => {
    const r = run(JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: join(ROOT, 'supabase/migrations/x.sql') } }));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('File-Guard');
  });

  it('Exit 0 bei Frontend-Pfad', () => {
    const r = run(JSON.stringify({ tool_name: 'Write', tool_input: { file_path: join(ROOT, 'src/pages/Neu.tsx') } }));
    expect(r.status).toBe(0);
  });

  it('fail-closed bei kaputter Eingabe', () => {
    expect(run('kein json').status).toBe(2);
  });
});
