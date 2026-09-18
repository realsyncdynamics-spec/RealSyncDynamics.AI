import { describe, expect, it } from 'vitest';
import { formatContextPack, packProjectContext } from '../../src/features/app-builder/bolt/context-pack';

function files(n: number, size = 800) {
  return Array.from({ length: n }, (_, i) => ({
    path: i === 0 ? 'index.html' : `extra-${i}.js`,
    content: `/* ${i} */ ${'x'.repeat(size)}`,
  }));
}

describe('packProjectContext', () => {
  it('always keeps the tree and prefers index.html', () => {
    const pack = packProjectContext({ prompt: 'Füge eine Tabelle hinzu', files: files(6) });
    expect(pack.tree).toContain('index.html');
    expect(pack.files.some((f) => f.path === 'index.html')).toBe(true);
  });

  it('selects files mentioned in the prompt before others', () => {
    const pack = packProjectContext({
      prompt: 'Bitte extra-3.js umbenennen',
      files: files(8, 200),
      budgetChars: 2_000,
    });
    expect(pack.files.some((f) => f.path === 'extra-3.js')).toBe(true);
  });

  it('omits overflow instead of dumping the whole tree', () => {
    const pack = packProjectContext({
      prompt: 'folge',
      files: files(20, 3_000),
      budgetChars: 8_000,
    });
    expect(pack.omitted.length).toBeGreaterThan(0);
    expect(pack.chars).toBeLessThanOrEqual(12_000);
    expect(formatContextPack(pack, 'folge').length).toBeLessThanOrEqual(24_000);
  });

  it('includes diagnostics and last change in the formatted pack', () => {
    const pack = packProjectContext({
      prompt: 'korrigiere',
      files: [{ path: 'index.html', content: '<div>' }],
      diagnostics: [{ path: 'index.html', severity: 'error', message: 'unclosed div' }],
      lastChange: 'Kundentabelle',
      riskClass: 'minimal',
    });
    const text = formatContextPack(pack, 'korrigiere');
    expect(text).toMatch(/unclosed div/);
    expect(text).toMatch(/Kundentabelle/);
    expect(text).toMatch(/Risikoklasse: minimal/);
  });
});
