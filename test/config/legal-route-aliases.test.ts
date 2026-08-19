import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Die Rechtstexte tragen eine Pflicht, keine Vorliebe: § 5 DDG verlangt, dass
 * das Impressum leicht erkennbar und unmittelbar erreichbar ist. Erreichbar
 * heisst hier auch: fuer einen Abruf ohne JavaScript.
 *
 * Der SPA-Fallback (`/*  /index.html  200`) macht das zur Fussangel. Jede
 * unbekannte URL antwortet mit HTTP 200 und der index.html der Startseite —
 * ein Pruefwerkzeug ohne JS liest daraus „Seite existiert, aber ohne
 * Impressum" statt „Seite gibt es nicht". Deshalb gehoert jedes gaengige
 * Alias als echter 301 vor den Fallback.
 */

const redirects = readFileSync('public/_redirects', 'utf8');
const FALLBACK = '/*  /index.html';

describe('Rechtstext-Aliase in public/_redirects', () => {
  it('leitet das englische /legal/imprint auf den kanonischen Pfad', async () => {
    expect(redirects).toMatch(/^\/legal\/imprint\s+\/legal\/impressum\s+301$/m);

    // Ziel ist der kanonische Pfad — sonst zeigt der 301 auf eine Seite, die
    // per canonical ohnehin weiterverweist, und die Kette wird unnoetig lang.
    const { SEO_CONFIG } = await import('../../src/config/seo');
    expect(SEO_CONFIG['/impressum']?.canonical).toContain('/legal/impressum');
  });

  it('stellt die Alias-Regeln vor den SPA-Fallback', () => {
    // Nach dem Fallback wuerde keine Regel mehr greifen: `/*` faengt alles ab.
    expect(redirects.indexOf('/legal/imprint')).toBeLessThan(redirects.indexOf(FALLBACK));
  });

  it('haelt den SPA-Fallback als letzte Regel', () => {
    const lines = redirects
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#'));
    expect(lines[lines.length - 1]).toBe('/*  /index.html  200');
  });
});
