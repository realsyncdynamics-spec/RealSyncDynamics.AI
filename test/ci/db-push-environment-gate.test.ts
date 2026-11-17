/**
 * E6: Environment-Gate vor jedem produktiven `supabase db push`.
 *
 * Das Ziel muss eindeutig feststehen (Environment → erwartete Projekt-Ref →
 * Deploy-Secret → verlinktes Projekt), sonst bricht das Gate ab. Zugangsdaten
 * erscheinen weder in den Gate-Meldungen noch im gefilterten db-push-Log.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  maskRef,
  redactSecrets,
  runVerify,
  verifyDbTarget,
} from '../../scripts/ci/verify-db-target.mjs';

// Synthetische Werte, zur Laufzeit gebaut (keine echten Refs oder Keys).
const PROD_REF = 'prodrefaaaaaaaaaaaaa';
const OTHER_REF = 'stagingbbbbbbbbbbbbb';
const DB_PASSWORD = 'pw-' + 'x'.repeat(24);
const ACCESS_TOKEN = 'sbp_' + 'a1'.repeat(20);

const ok = {
  environment: 'production',
  expectedRef: PROD_REF,
  targetRef: PROD_REF,
  linkedRef: PROD_REF,
  gitRef: 'refs/heads/main',
};

describe('verifyDbTarget — positiv', () => {
  it('production von main mit übereinstimmenden Refs', () => {
    expect(verifyDbTarget(ok)).toEqual({ ok: true, environment: 'production', ref: PROD_REF });
  });

  it('staging ist nicht an main gebunden', () => {
    const r = verifyDbTarget({
      ...ok,
      environment: 'staging',
      expectedRef: OTHER_REF,
      targetRef: OTHER_REF,
      linkedRef: OTHER_REF,
      gitRef: 'refs/heads/feature',
    });
    expect(r.ok).toBe(true);
  });

  it('Leerraum um die Werte (z. B. Zeilenende aus der Ref-Datei) stört nicht', () => {
    expect(verifyDbTarget({ ...ok, linkedRef: `${PROD_REF}\n`, expectedRef: ` ${PROD_REF} ` }).ok).toBe(true);
  });
});

describe('verifyDbTarget — negativ (fail-closed)', () => {
  const cases: Array<[string, Partial<typeof ok>, string]> = [
    ['Environment fehlt', { environment: '' }, 'ENV_MISSING'],
    ['Environment undefiniert', { environment: undefined }, 'ENV_MISSING'],
    ['unbekanntes Environment', { environment: 'prod' }, 'ENV_UNKNOWN'],
    ['erwartete Ref fehlt (Variable nicht gesetzt)', { expectedRef: '' }, 'EXPECTED_REF_MISSING'],
    ['erwartete Ref ungültig', { expectedRef: 'NOT-A-REF' }, 'EXPECTED_REF_INVALID'],
    ['Deploy-Secret leer', { targetRef: '' }, 'TARGET_REF_MISSING'],
    ['Deploy-Secret zeigt auf anderes Projekt', { targetRef: OTHER_REF }, 'TARGET_REF_MISMATCH'],
    ['kein verlinktes Projekt', { linkedRef: '' }, 'LINKED_REF_MISSING'],
    ['verlinktes Projekt widerspricht', { linkedRef: OTHER_REF }, 'LINKED_REF_MISMATCH'],
    ['production nicht von main', { gitRef: 'refs/heads/feature' }, 'PRODUCTION_NOT_MAIN'],
    ['production ohne Git-Ref', { gitRef: undefined }, 'PRODUCTION_NOT_MAIN'],
  ];

  it.each(cases)('%s → %s', (_label, patch, code) => {
    const r = verifyDbTarget({ ...ok, ...patch });
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ code });
  });

  it('Meldungen nennen Refs nur maskiert', () => {
    const r = verifyDbTarget({ ...ok, targetRef: OTHER_REF });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).not.toContain(PROD_REF);
      expect(r.message).not.toContain(OTHER_REF);
      expect(r.message).toContain(maskRef(OTHER_REF));
    }
  });
});

describe('maskRef', () => {
  it('zeigt nur die letzten vier Zeichen', () => {
    expect(maskRef(PROD_REF)).toBe('***aaaa');
    expect(maskRef('')).toBe('(leer)');
    expect(maskRef(undefined)).toBe('(leer)');
    expect(maskRef('abc')).toBe('***');
  });
});

describe('redactSecrets', () => {
  it('ersetzt bekannte Secret-Werte', () => {
    const out = redactSecrets(`password ${DB_PASSWORD} token ${ACCESS_TOKEN}`, [DB_PASSWORD, ACCESS_TOKEN]);
    expect(out).not.toContain(DB_PASSWORD);
    expect(out).not.toContain(ACCESS_TOKEN);
  });

  it('ersetzt Zugangsdaten in Postgres-URIs, auch ohne bekanntes Secret', () => {
    const out = redactSecrets(
      'Connecting to postgresql://postgres.abc:s3cr3t-value@db.example.supabase.co:5432/postgres',
    );
    expect(out).toContain('postgresql://***:***@db.example.supabase.co');
    expect(out).not.toContain('s3cr3t-value');
  });

  it('ersetzt Supabase-Access-Tokens, JWTs und password=…', () => {
    const jwt = ['eyJ' + 'h'.repeat(12), 'p'.repeat(16), 's'.repeat(16)].join('.');
    const out = redactSecrets(`t=${ACCESS_TOKEN} k=${jwt} dsn password=hunter22&x=1`);
    expect(out).not.toContain(ACCESS_TOKEN);
    expect(out).not.toContain(jwt);
    expect(out).not.toContain('hunter22');
    expect(out).toContain('password=***');
  });

  it('lässt normale Ausgabe unverändert', () => {
    const line = 'Applying migration 20261103000000_cron_keys.sql...\nFinished supabase db push.';
    expect(redactSecrets(line, [DB_PASSWORD])).toBe(line);
  });

  it('ignoriert leere und sehr kurze Secrets (kein Wegredigieren normaler Zeichen)', () => {
    expect(redactSecrets('abc def', ['', 'a', undefined as unknown as string])).toBe('abc def');
  });
});

describe('runVerify — liest Environment und verlinkte Ref', () => {
  function linkedFile(content: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'db-gate-'));
    const file = join(dir, 'project-ref');
    writeFileSync(file, content);
    return file;
  }

  function capture() {
    const lines: string[] = [];
    return {
      lines,
      log: { log: (m: string) => lines.push(m), error: (m: string) => lines.push(m) },
    };
  }

  const baseEnv = {
    DEPLOY_ENVIRONMENT: 'production',
    SUPABASE_EXPECTED_PROJECT_REF: PROD_REF,
    SUPABASE_PROJECT_ID: PROD_REF,
    GITHUB_REF: 'refs/heads/main',
    SUPABASE_DB_PASSWORD: DB_PASSWORD,
    SUPABASE_ACCESS_TOKEN: ACCESS_TOKEN,
  };

  it('Exit 0 bei passendem Ziel, Ausgabe ohne Secrets und ohne volle Ref', () => {
    const { lines, log } = capture();
    const code = runVerify({ ...baseEnv, SUPABASE_LINKED_REF_FILE: linkedFile(`${PROD_REF}\n`) }, log);
    expect(code).toBe(0);
    const out = lines.join('\n');
    expect(out).toContain('verifiziert');
    expect(out).not.toContain(PROD_REF);
    expect(out).not.toContain(DB_PASSWORD);
    expect(out).not.toContain(ACCESS_TOKEN);
  });

  it('Exit 1, wenn die Ref-Datei fehlt (Link nicht gelaufen)', () => {
    const { lines, log } = capture();
    const code = runVerify({ ...baseEnv, SUPABASE_LINKED_REF_FILE: '/nonexistent/project-ref' }, log);
    expect(code).toBe(1);
    expect(lines.join('\n')).toContain('LINKED_REF_MISSING');
  });

  it('Exit 1 ohne erwartete Ref, Meldung ohne Secrets', () => {
    const { lines, log } = capture();
    const code = runVerify(
      { ...baseEnv, SUPABASE_EXPECTED_PROJECT_REF: '', SUPABASE_LINKED_REF_FILE: linkedFile(PROD_REF) },
      log,
    );
    expect(code).toBe(1);
    const out = lines.join('\n');
    expect(out).toContain('EXPECTED_REF_MISSING');
    expect(out).not.toContain(DB_PASSWORD);
    expect(out).not.toContain(ACCESS_TOKEN);
  });
});

describe('CLI', () => {
  const script = 'scripts/ci/verify-db-target.mjs';

  it('verify ohne Konfiguration bricht mit Exit 1 ab', () => {
    const r = spawnSync(process.execPath, [script, 'verify'], {
      env: { PATH: process.env.PATH ?? '', SUPABASE_LINKED_REF_FILE: '/nonexistent/project-ref' },
      encoding: 'utf8',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('ENV_MISSING');
  });

  it('redact filtert stdin und behält Zeilen bei', () => {
    const input = `line 1\nconnect postgresql://u:${DB_PASSWORD}@host/db\nsecret ${DB_PASSWORD}\n`;
    const r = spawnSync(process.execPath, [script, 'redact'], {
      env: { PATH: process.env.PATH ?? '', SUPABASE_DB_PASSWORD: DB_PASSWORD },
      input,
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain(DB_PASSWORD);
    expect(r.stdout.split('\n')).toHaveLength(4);
    expect(r.stdout).toContain('line 1');
  });

  it('unbekannter Modus → Exit 2', () => {
    const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    expect(r.status).toBe(2);
  });
});

describe('Workflows und Skripte nutzen das Gate', () => {
  const pushers = ['.github/workflows/deploy.yml', '.github/workflows/migration-reconciliation.yml'];

  it.each(pushers)('%s: Environment production und Gate-Variablen gesetzt', (file) => {
    const yml = readFileSync(file, 'utf8');
    expect(yml).toMatch(/^ {4}environment: production$/m);
    expect(yml).toMatch(/DEPLOY_ENVIRONMENT: production/);
    expect(yml).toMatch(/SUPABASE_EXPECTED_PROJECT_REF: \$\{\{ vars\.SUPABASE_EXPECTED_PROJECT_REF \}\}/);
  });

  it.each(pushers)('%s: Gate läuft vor jedem Repair und jedem db push', (file) => {
    const yml = readFileSync(file, 'utf8');
    const gate = yml.indexOf('node scripts/ci/verify-db-target.mjs verify');
    expect(gate).toBeGreaterThan(-1);
    for (const needle of ['supabase db push', 'supabase migration repair']) {
      let at = yml.indexOf(needle);
      while (at !== -1) {
        // Kommentare zählen nicht als Aufruf.
        const lineStart = yml.lastIndexOf('\n', at) + 1;
        if (!yml.slice(lineStart, at).trimStart().startsWith('#')) {
          expect(at, `${needle} @${at}`).toBeGreaterThan(gate);
        }
        at = yml.indexOf(needle, at + needle.length);
      }
    }
  });

  it.each(pushers)('%s: db-push-Ausgabe geht durch den Redact-Filter', (file) => {
    const yml = readFileSync(file, 'utf8');
    const calls = yml.split('\n').filter((l) => /^\s*supabase db push\b/.test(l));
    expect(calls.length).toBeGreaterThan(0);
    for (const line of calls) {
      expect(line).toContain('| node scripts/ci/verify-db-target.mjs redact |');
    }
  });

  it('deploy-phase4.sh verifiziert vor db push', () => {
    const sh = readFileSync('scripts/deploy-phase4.sh', 'utf8');
    const gate = sh.indexOf('node scripts/ci/verify-db-target.mjs verify');
    const push = sh.indexOf('supabase db push');
    expect(gate).toBeGreaterThan(-1);
    expect(push).toBeGreaterThan(gate);
  });
});
