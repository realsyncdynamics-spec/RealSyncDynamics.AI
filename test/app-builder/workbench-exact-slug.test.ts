/**
 * /build sends new apps to /builder/<slug>/code. A slug that is not in the
 * tenant's list must start its own draft, never load (and then save over)
 * another project.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, '../../src/features/app-builder/BoltWorkbench.tsx'), 'utf8');

describe('BoltWorkbench project lookup', () => {
  it('matches the route slug exactly', () => {
    expect(source).toMatch(/listed\.find\(\(p\) => p\.slug === projectSlug\);/);
  });

  it('has no fallback to another listed project', () => {
    expect(source).not.toMatch(/\?\?\s*listed\[0\]/);
  });
});
