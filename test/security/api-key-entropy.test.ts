/**
 * Der API-Key darf nicht aus schwachem Zufall entstehen.
 *
 * ## Warum das ein eigener Test ist
 *
 * `/welcome` erzeugt im Browser einen Schlüssel `rsd_live_<40 Zeichen>`,
 * speichert davon nur `sha256` und `key_prefix` in `api_keys` und zeigt dem
 * Kunden den Klartext genau einmal. Der Schlüssel ist damit ein Geheimnis mit
 * Zugriff auf den Mandanten — seine Unvorhersagbarkeit ist die ganze
 * Sicherheit.
 *
 * Bis 2026-09-14 fiel die Erzeugung still auf `Math.random()` zurück, wenn
 * `crypto.getRandomValues` fehlte. Das Ergebnis sieht aus wie ein sicherer
 * Schlüssel, ist aber vorhersagbar, und niemand kann ihm ansehen, aus welcher
 * Quelle er stammt — weder der Kunde noch der Server, der nur den Hash sieht.
 *
 * Dieselbe Lücke war für den OAuth-`state` schon geschlossen worden
 * (`IntegrationSettings.tsx`), mit der ausdrücklichen Begründung: „Bewusst
 * **kein** Rückfall auf `Math.random()`. Ein stiller Wechsel auf schwachen
 * Zufall wäre genau die Lücke, die hier geschlossen wird." Die Entscheidung
 * galt nur an einer von zwei Stellen. Jetzt an beiden — und dieser Test hält
 * sie fest.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

const WELCOME = read('src/pages/Welcome.tsx');
const INTEGRATION_SETTINGS = read('src/features/seo-marketing-dashboard/IntegrationSettings.tsx');

/** Kommentare ausblenden — dort steht die Historie, warum es den Test gibt. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('API-Key-Erzeugung in /welcome', () => {
  it('kennt keinen Rückfall auf Math.random', () => {
    expect(code(WELCOME)).not.toContain('Math.random');
  });

  it('wirft, wenn keine sichere Zufallsquelle da ist', () => {
    expect(WELCOME).toContain('if (!source?.getRandomValues)');
    expect(WELCOME).toContain('stellt keine sichere Zufallsquelle bereit');
  });

  it('faltet nicht per Modulo über die Alphabetgrenze', () => {
    // 256 % 62 = 8 — ohne Verwerfen kämen acht Zeichen häufiger vor.
    expect(WELCOME).toContain('const limit = 256 - (256 % alphabet.length)');
    expect(WELCOME).toContain('if (buf[i] >= limit) continue;');
  });

  it('erzeugt den Schlüssel weiterhin mit 40 Zeichen hinter rsd_live_', () => {
    expect(WELCOME).toContain('`rsd_live_${randString(40)}`');
  });

  it('speichert nur Hash und Präfix, nie den Klartext', () => {
    expect(WELCOME).toContain('const keyHash = await sha256Hex(plain)');
    expect(WELCOME).toContain('key_hash: keyHash');
    expect(WELCOME).toContain('key_prefix: keyPrefix');
    expect(code(WELCOME)).not.toContain('key_plain');
  });
});

describe('Die Entscheidung gilt an beiden Stellen', () => {
  it('hält den OAuth-state unverändert ohne Rückfall', () => {
    expect(code(INTEGRATION_SETTINGS)).not.toContain('Math.random');
    expect(INTEGRATION_SETTINGS).toContain('if (!source?.getRandomValues)');
  });
});

describe('Die Ziehung selbst', () => {
  /** Dieselbe Logik wie in `Welcome.tsx` — hier ausführbar nachgebaut. */
  const draw = (len: number, getRandomValues: (b: Uint8Array) => void) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const limit = 256 - (256 % alphabet.length);
    let out = '';
    const buf = new Uint8Array(len);
    while (out.length < len) {
      getRandomValues(buf);
      for (let i = 0; i < buf.length && out.length < len; i++) {
        if (buf[i] >= limit) continue;
        out += alphabet[buf[i] % alphabet.length];
      }
    }
    return out;
  };

  it('liefert auch dann die volle Länge, wenn viele Bytes verworfen werden', () => {
    // Jedes zweite Byte liegt über der Grenze und muss verworfen werden.
    let n = 0;
    const alternating = (b: Uint8Array) => {
      for (let i = 0; i < b.length; i++) b[i] = n++ % 2 === 0 ? 250 : 10;
    };
    expect(draw(40, alternating)).toHaveLength(40);
  });

  it('endet auch bei durchweg verworfenen Bytes nicht mit halbem Schlüssel', () => {
    // Erst verwerfen, dann brauchbare Bytes — die Schleife muss nachziehen.
    let round = 0;
    const lateSuccess = (b: Uint8Array) => {
      b.fill(round++ === 0 ? 255 : 7);
    };
    expect(draw(40, lateSuccess)).toHaveLength(40);
  });

  it('nutzt das volle Alphabet statt nur der ersten Zeichen', () => {
    const uniform = (b: Uint8Array) => {
      for (let i = 0; i < b.length; i++) b[i] = i % 248;
    };
    const drawn = draw(200, uniform);
    expect(new Set(drawn).size).toBeGreaterThan(50);
  });
});
