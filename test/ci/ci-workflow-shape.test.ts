/**
 * Form der CI-Workflows: die Eigenschaften, die einen Merge tragen.
 *
 * Gemessen am 2026-09-21 auf #1499: vier volle CI-Ketten in 30 Minuten fuer
 * denselben Zwei-Dateien-Diff, weil jeder Sync mit `main` einen neuen Lauf
 * startete, ohne den vorigen abzuloesen. Der Umbau in `ci.yml` (Concurrency,
 * `build` in drei parallele Teil-Jobs plus Sammelknoten, schneller Pfad im
 * `db`-Job) hat drei Stellen, an denen ein spaeterer Edit still Fake-Success
 * erzeugen kann. Dieser Test haelt sie fest — als Text, ohne YAML-Parser
 * (keiner in den Dependencies, und `actions-pinned.test.ts` arbeitet genauso).
 *
 *   1. Der Sammelknoten `build` MUSS `!cancelled()` tragen. Mit dem impliziten
 *      `success()` wuerde er bei einem roten Teil-Job uebersprungen — und ein
 *      uebersprungener Required Check gilt fuer GitHub als bestanden.
 *   2. Der schnelle Pfad im `db`-Job MUSS auf einer WEITEN Pfadliste stehen.
 *      Jeder Eintrag hier ist ein Weg, das Schema oder die DB-Tests mittelbar
 *      zu aendern; faellt einer weg, laeuft der teure Teil fuer genau diese
 *      Aenderung nicht mehr.
 *   3. Die Append-only-Pruefung laeuft auf JEDEM PR, auch auf dem schnellen
 *      Pfad.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WORKFLOWS = resolve(__dirname, '../../.github/workflows');
const ci = readFileSync(resolve(WORKFLOWS, 'ci.yml'), 'utf8');
const e2e = readFileSync(resolve(WORKFLOWS, 'e2e.yml'), 'utf8');
const driftAlert = readFileSync(resolve(WORKFLOWS, 'drift-alert.yml'), 'utf8');

/** Zeilen eines Top-Level-Jobs (`  name:` bis zum naechsten `  name:`). */
function job(source: string, id: string): string {
  const start = source.search(new RegExp(`^  ${id}:\\s*$`, 'm'));
  expect(start, `Job ${id} fehlt`).toBeGreaterThan(-1);
  const rest = source.slice(start + id.length + 3);
  const next = rest.search(/^  [a-z][a-z0-9_-]*:\s*$/m);
  return rest.slice(0, next === -1 ? undefined : next);
}

function code(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

describe('ci.yml: Concurrency', () => {
  it('gruppiert je PR und loest nur PR-Laeufe ab, nie main oder die Merge Queue', () => {
    const c = code(ci);
    expect(c).toMatch(/^concurrency:\n  group: ci-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}\n/m);
    expect(c).toMatch(/^  cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}\n/m);
    expect(c).not.toMatch(/cancel-in-progress: true/);
  });

  it('gibt e2e.yml dieselbe Regel', () => {
    const c = code(e2e);
    expect(c).toMatch(/^concurrency:\n  group: e2e-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}\n/m);
    expect(c).toMatch(/^  cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}\n/m);
  });
});

describe('ci.yml: build in drei Teil-Jobs plus Sammelknoten', () => {
  const DRAFT_RULE = "if: github.event_name != 'pull_request' || !github.event.pull_request.draft";

  it('hat gates, unit, spa mit derselben Draft-Regel wie bisher', () => {
    for (const id of ['gates', 'unit', 'spa']) {
      expect(code(job(ci, id)), id).toContain(DRAFT_RULE);
    }
  });

  it('verteilt die Schritte des alten build-Jobs vollstaendig und ohne Duplikat', () => {
    const gates = code(job(ci, 'gates'));
    for (const cmd of [
      'npm run check:context',
      'npm run lint',
      'npm run check:edge-syntax',
      'npm run check:edge-refs',
      'npm run check:pricing',
      'npm run check:limits',
      'npm run check:offer-prices',
    ]) {
      expect(gates, cmd).toContain(`run: ${cmd}\n`);
    }
    expect(code(job(ci, 'unit'))).toContain('run: npm test\n');
    expect(code(job(ci, 'spa'))).toContain('run: npm run build\n');
    // Kein Teil-Job fuehrt einen Schritt eines anderen aus.
    expect(gates).not.toContain('npm test');
    expect(gates).not.toContain('npm run build');
    expect(code(job(ci, 'unit'))).not.toContain('npm run build');
    expect(code(job(ci, 'spa'))).not.toContain('npm test');
  });

  it('behaelt den Check-Namen build: Job-ID build, kein abweichender name', () => {
    const b = code(job(ci, 'build'));
    expect(b).toMatch(/^    needs: \[gates, unit, spa\]$/m);
    expect(b).not.toMatch(/^    name:/m);
  });

  it('laeuft auch bei rotem Teil-Job (!cancelled) und wird selbst rot', () => {
    const b = code(job(ci, 'build'));
    expect(b).toMatch(/^    if: \$\{\{ !cancelled\(\) &&/m);
    expect(b).toContain("github.event_name != 'pull_request' || !github.event.pull_request.draft");
    for (const part of ['needs.gates.result', 'needs.unit.result', 'needs.spa.result']) {
      expect(b, part).toContain(part);
    }
    expect(b).toContain('*=success) ;;');
    expect(b).toContain('exit "$rot"');
  });
});

describe('ci.yml: schneller Pfad im db-Job', () => {
  const db = code(job(ci, 'db'));

  it('behaelt Job-Name und Draft-Regel', () => {
    expect(db).toContain('name: Migration validation');
    expect(db).toContain("if: github.event_name != 'pull_request' || !github.event.pull_request.draft");
  });

  it('erkennt den Diff nach dem Checkout mit voller Historie', () => {
    const checkout = db.indexOf('actions/checkout@');
    const relevant = db.indexOf('id: relevant');
    expect(checkout).toBeGreaterThan(-1);
    expect(relevant).toBeGreaterThan(checkout);
    expect(db.slice(checkout, relevant)).toContain('fetch-depth: 0');
    expect(db).toContain('git diff --name-only origin/main...HEAD');
  });

  it('laeuft bei Nicht-PR-Events und bei Erkennungsfehlern voll', () => {
    expect(db).toMatch(/if \[ "\$EVENT" != "pull_request" \]; then\n\s+echo "Kein PR-Event[^\n]*\n\s+echo "run=true"/);
    expect(db).toMatch(/if ! changed=\$\(git diff --name-only origin\/main\.\.\.HEAD\); then\n[^\n]*\n\s+echo "run=true"/);
  });

  it('haelt die weite Pfadliste (jeder Eintrag ein mittelbarer Weg ins Schema)', () => {
    const muster = /muster='\^\((.+)\)'/.exec(db);
    expect(muster).not.toBeNull();
    const alternativen = muster![1].split('|');
    for (const pflicht of [
      'supabase/',
      'shared/',
      'test/runtime/db/',
      'test/db/',
      'scripts/test-db/',
      'scripts/sync-shared-pricing\\.mjs',
      'scripts/generate-plan-catalog-sql\\.ts',
      '\\.github/workflows/ci\\.yml',
      'package\\.json',
      'package-lock\\.json',
      'vitest\\.config\\.ts',
      'test/setup\\.ts',
    ]) {
      expect(alternativen, pflicht).toContain(pflicht);
    }
  });

  it('gated jeden teuren Schritt, nicht aber die Append-only-Pruefung', () => {
    const gate = "if: steps.relevant.outputs.run == 'true'";
    for (const step of [
      'name: Postgres starten (Pull mit Wiederholung)',
      'name: Auf Postgres warten',
      'name: Bootstrap Supabase-equivalent stubs',
      'name: Apply all migrations in order',
      'name: Grant Supabase-equivalent table privileges',
      'name: Install dependencies (fuer die DB-Tests)',
      'name: DB-Integrationstests gegen das voll migrierte Schema',
    ]) {
      const at = db.indexOf(step);
      expect(at, step).toBeGreaterThan(-1);
      // Das Gate steht in den naechsten Zeilen desselben Schritts.
      expect(db.slice(at, at + 200), step).toContain(gate);
    }
    const setupNode = db.lastIndexOf('actions/setup-node@');
    expect(db.slice(setupNode, setupNode + 200)).toContain(gate);

    const appendOnly = db.indexOf('name: Verify migrations are append-only');
    expect(appendOnly).toBeGreaterThan(-1);
    const tail = db.slice(appendOnly, appendOnly + 260);
    expect(tail).toContain("if: github.event_name == 'pull_request' && !contains(github.event.pull_request.title, '[hotfix]')");
    expect(tail).not.toContain('steps.relevant');
  });

  it('haelt REQUIRE_DB_TESTS auf dem vollen Pfad', () => {
    expect(db).toContain("REQUIRE_DB_TESTS: '1'");
  });
});

describe('drift-alert.yml: Notifier bleibt grün', () => {
  it('verwaltet Drift-Issues ohne den Benachrichtigungsjob rot zu faerben', () => {
    expect(driftAlert).toContain('Issue für Drift-Befund pflegen');
    expect(driftAlert).toContain('github.event.workflow_run.conclusion == \'failure\' ||');
    expect(driftAlert).toContain('github.event.workflow_run.conclusion == \'success\'');
    expect(driftAlert).not.toContain('core.setFailed(');
    expect(driftAlert).toContain('core.info(`${guard} weiterhin rot — Issue #${existing.number} aktualisiert.`);');
    expect(driftAlert).toContain('core.info(`${guard} rot — Issue #${created.number} angelegt.`);');
  });
});
