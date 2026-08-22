import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FORBIDDEN_SANDBOX_PAIR,
  hasForbiddenSandboxCombination,
  previewCsp,
  sandboxTokens,
  withPreviewCsp,
} from '../../src/lib/preview-sandbox';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Diese Datei bewacht eine Sicherheitsgrenze, keine Formatierung.
 *
 * `allow-scripts` zusammen mit `allow-same-origin` an einem
 * `srcDoc`-Rahmen gibt erzeugtem Code die Herkunft der Anwendung — und
 * damit Zugriff auf deren `localStorage`, in dem die Supabase-Sitzung
 * liegt. Die Kombination darf nirgends entstehen, auch nicht versehentlich
 * und auch nicht an einem Rahmen, der die Marken selbst zusammensetzt.
 */
describe('Sandbox-Marken', () => {
  it('erlaubt einer statischen Vorschau gar nichts', () => {
    expect(sandboxTokens('static')).toBe('');
  });

  it('gibt einer interaktiven Vorschau Skripte, aber keine eigene Herkunft', () => {
    const tokens = sandboxTokens('interactive');
    expect(tokens).toContain('allow-scripts');
    expect(tokens).not.toContain('allow-same-origin');
  });

  it('erzeugt die verbotene Kombination in keiner Stufe', () => {
    for (const isolation of ['static', 'interactive'] as const) {
      expect(hasForbiddenSandboxCombination(sandboxTokens(isolation)), isolation).toBe(false);
    }
  });

  it('erkennt die verbotene Kombination, egal in welcher Reihenfolge', () => {
    expect(hasForbiddenSandboxCombination('allow-scripts allow-same-origin')).toBe(true);
    expect(hasForbiddenSandboxCombination('allow-same-origin allow-scripts')).toBe(true);
    expect(hasForbiddenSandboxCombination('allow-forms allow-same-origin allow-scripts')).toBe(true);
    expect(hasForbiddenSandboxCombination('allow-scripts allow-forms')).toBe(false);
    expect(hasForbiddenSandboxCombination('allow-same-origin')).toBe(false);
    expect(hasForbiddenSandboxCombination('')).toBe(false);
  });
});

describe('Content-Security-Policy der Vorschau', () => {
  it('geht von „nichts erlaubt" aus', () => {
    expect(previewCsp('static')).toContain("default-src 'none'");
  });

  it('sperrt Skripte in der statischen Stufe vollständig', () => {
    expect(previewCsp('static')).toContain("script-src 'none'");
  });

  it('lässt in der interaktiven Stufe nur eingebettetes Skript zu, kein Nachladen', () => {
    const csp = previewCsp('interactive');
    expect(csp).toContain("script-src 'unsafe-inline'");
    expect(csp).not.toMatch(/script-src[^;]*https?:/);
  });

  it('verhindert, dass ein erzeugtes Formular irgendwohin sendet', () => {
    expect(previewCsp('static')).toContain("form-action 'none'");
    expect(previewCsp('interactive')).toContain("form-action 'none'");
  });

  it('erlaubt keine ausgehenden Verbindungen', () => {
    expect(previewCsp('interactive')).toContain("connect-src 'none'");
  });
});

describe('CSP wird tatsächlich in das Dokument gesetzt', () => {
  it('setzt sie direkt hinter den vorhandenen Kopf', () => {
    const out = withPreviewCsp('<!doctype html><html lang="de"><head><title>x</title></head><body>a</body></html>', 'static');
    expect(out).toContain('http-equiv="Content-Security-Policy"');
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('<title>'));
  });

  it('kommt auch mit Attributen am head-Element zurecht', () => {
    const out = withPreviewCsp('<html><head data-x="1"><title>x</title></head></html>', 'static');
    expect(out).toContain('http-equiv="Content-Security-Policy"');
    expect(out).toContain('data-x="1"');
  });

  it('erzeugt einen Kopf, wenn keiner da ist — statt die Richtlinie fallenzulassen', () => {
    const out = withPreviewCsp('<html><body>a</body></html>', 'static');
    expect(out).toContain('http-equiv="Content-Security-Policy"');
  });

  it('lässt ein Fragment ohne html-Element nicht ungeschützt', () => {
    const out = withPreviewCsp('<div>a</div>', 'static');
    expect(out).toContain('http-equiv="Content-Security-Policy"');
  });
});

/**
 * Der eigentliche Wächter: Er liest den Quellcode, nicht die Absicht.
 * Ein neuer Rahmen mit der verbotenen Kombination lässt diesen Test
 * fehlschlagen, auch wenn er `preview-sandbox.ts` gar nicht kennt.
 */
describe('Kein Rahmen im Repository mit der verbotenen Kombination', () => {
  function sourceFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) sourceFiles(full, acc);
      else if (/\.(tsx?|jsx?|html)$/.test(entry)) acc.push(full);
    }
    return acc;
  }

  it('findet nirgends allow-scripts zusammen mit allow-same-origin', () => {
    const offenders: string[] = [];
    for (const file of [...sourceFiles(join(ROOT, 'src')), ...sourceFiles(join(ROOT, 'packages'))]) {
      const source = readFileSync(file, 'utf-8');
      // Nur die Datei, die das Verbot beschreibt, darf beide Marken nennen.
      if (file.endsWith('preview-sandbox.ts')) continue;
      for (const match of source.matchAll(/sandbox\s*=\s*["'{]([^"'}]*)["'}]/g)) {
        if (hasForbiddenSandboxCombination(match[1])) {
          offenders.push(`${file.replace(ROOT, '')}: ${match[1]}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('benennt das verbotene Paar unmissverständlich', () => {
    expect([...FORBIDDEN_SANDBOX_PAIR]).toEqual(['allow-scripts', 'allow-same-origin']);
  });
});
