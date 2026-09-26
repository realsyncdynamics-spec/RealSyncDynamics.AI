import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * governance-os-app.css landet im globalen Bundle. Definiert es eine Klasse,
 * die auch die öffentlichen Handoff-Seiten (governance-os-handoff.css) nutzen,
 * ändert es deren Layout — so geschehen mit `.rs-page` auf /pricing (CLS 0,49
 * in Lighthouse). App-Klassen bleiben deshalb disjunkt zu den Landing-Klassen.
 */
const classes = (css: string) => new Set(css.match(/\.rs-[a-z0-9_-]+/g) ?? []);

describe('governance-os-app.css — Geltungsbereich', () => {
  it('definiert keine Klasse der öffentlichen Handoff-Seiten neu', () => {
    const app = classes(readFileSync('src/styles/governance-os-app.css', 'utf8'));
    const landing = classes(readFileSync('src/styles/governance-os-handoff.css', 'utf8'));
    const shared = [...app].filter((c) => landing.has(c));
    expect(shared).toEqual([]);
  });
});
