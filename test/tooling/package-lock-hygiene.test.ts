import { describe, expect, it } from 'vitest';
import { lockfileRelevantPackageChanges } from '../../scripts/lib/package-lock-hygiene.mjs';

describe('package-lock hygiene', () => {
  it('ignoriert reine scripts-Aenderungen', () => {
    const before = {
      name: 'app',
      version: '1.0.0',
      scripts: { build: 'vite build' },
      dependencies: { react: '^19.0.0' },
    };
    const after = {
      ...before,
      scripts: { build: 'vite build && node scripts/check.mjs' },
    };

    expect(lockfileRelevantPackageChanges(before, after)).toEqual([]);
  });

  it('erkennt Dependency-Aenderungen', () => {
    const before = { dependencies: { react: '^19.0.0' } };
    const after = { dependencies: { react: '^19.1.0' } };

    expect(lockfileRelevantPackageChanges(before, after)).toEqual(['dependencies']);
  });

  it('erkennt devDependencies, overrides und workspaces', () => {
    const before = {
      devDependencies: { vitest: '^4.1.5' },
      overrides: { foo: '1.0.0' },
      workspaces: ['apps/*'],
    };
    const after = {
      devDependencies: { vitest: '^4.2.0' },
      overrides: { foo: '1.0.1' },
      workspaces: ['apps/*', 'packages/*'],
    };

    expect(lockfileRelevantPackageChanges(before, after)).toEqual([
      'devDependencies',
      'workspaces',
      'overrides',
    ]);
  });

  it('erkennt Root-Metadaten, die npm im Lockfile spiegelt', () => {
    const before = { name: 'app', version: '1.0.0', license: 'MIT' };
    const after = { name: 'app-next', version: '1.0.1', license: 'Apache-2.0' };

    expect(lockfileRelevantPackageChanges(before, after)).toEqual([
      'name',
      'version',
      'license',
    ]);
  });
});
