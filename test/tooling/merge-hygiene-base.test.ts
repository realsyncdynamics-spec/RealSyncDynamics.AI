import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  comparisonBaseRef,
  lockfileRelevantPackageChanges,
} from '../../scripts/lib/package-lock-hygiene.mjs';

// Szenario aus der Praxis: ein Branch aendert nur ein npm-Script, waehrend main
// zwischenzeitlich eine Dependency bumpt. Vergleicht man gegen die Spitze von
// main statt gegen den Merge-Base, wird mains Dependency-Bump diesem Branch
// zugeschrieben und die Lockfile-Warnung feuert ohne Anlass.
describe('merge-hygiene Vergleichsbasis', () => {
  let repo: string;
  const git = (args: string) =>
    execSync(`git ${args}`, { cwd: repo, encoding: 'utf8' }).trim();

  const writePkg = (pkg: unknown) =>
    writeFileSync(join(repo, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'merge-hygiene-'));
    git('init -q -b main');
    git('config user.email test@example.com');
    git('config user.name Test');

    writePkg({ name: 'app', version: '1.0.0', scripts: { build: 'vite build' }, dependencies: { react: '^19.0.0' } });
    git('add package.json');
    git('commit -q -m base');
    const branchPoint = git('rev-parse HEAD');

    // main zieht weiter: Dependency-Bump, den dieser Branch nicht gemacht hat.
    writePkg({ name: 'app', version: '1.0.0', scripts: { build: 'vite build' }, dependencies: { react: '^19.2.0' } });
    git('commit -q -am "main: react bump"');

    // Feature-Branch vom Branchpunkt, aendert ausschliesslich ein npm-Script.
    git(`checkout -q -b feature ${branchPoint}`);
    writePkg({ name: 'app', version: '1.0.0', scripts: { build: 'vite build && node scripts/check.mjs' }, dependencies: { react: '^19.0.0' } });
    git('commit -q -am "feature: npm-Script ergaenzt"');
  });

  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  const fieldsAgainst = (ref: string) => {
    const before = JSON.parse(git(`show ${ref}:package.json`));
    const after = JSON.parse(git('show HEAD:package.json'));
    return lockfileRelevantPackageChanges(before, after);
  };

  it('loest auf den gemeinsamen Vorfahren auf, nicht auf die Spitze von main', () => {
    expect(comparisonBaseRef(git, 'main')).toBe(git('merge-base main HEAD'));
    expect(comparisonBaseRef(git, 'main')).not.toBe(git('rev-parse main'));
  });

  it('meldet keine Lockfile-Relevanz, wenn nur main die Dependency geaendert hat', () => {
    expect(fieldsAgainst(comparisonBaseRef(git, 'main'))).toEqual([]);
  });

  it('gegen die Spitze von main entstuende der Fehlalarm', () => {
    expect(fieldsAgainst('main')).toEqual(['dependencies']);
  });

  it('faellt auf baseRef zurueck, wenn kein Merge-Base ermittelbar ist', () => {
    const failing = () => {
      throw new Error('no merge base');
    };
    expect(comparisonBaseRef(failing, 'origin/main')).toBe('origin/main');
  });
});
