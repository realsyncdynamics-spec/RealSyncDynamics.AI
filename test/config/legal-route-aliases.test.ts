import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Die Rechtstexte tragen eine Pflicht, keine Vorliebe: § 5 DDG verlangt, dass
 * das Impressum leicht erkennbar und unmittelbar erreichbar ist. Erreichbar
 * heisst hier auch: fuer einen Abruf ohne JavaScript.
 *
 * Der SPA-Fallback macht das zur Fussangel: jede unbekannte URL antwortet
 * mit HTTP 200, und ein Pruefwerkzeug ohne JS liest daraus „Seite existiert,
 * aber ohne Impressum" statt „Seite gibt es nicht". Deshalb gehoert jedes
 * gaengige Alias als echter 301 vor den Fallback.
 */

const redirects = readFileSync('public/_redirects', 'utf8');
const FALLBACK = '/*  /404.html';

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
    // Nach dem Fallback wuerde keine Regel mehr greifen: `/*` faengt alles ab.
    const lines = redirects
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#'));
    expect(lines[lines.length - 1]).toBe('/*  /404.html  200');
  });

  it('liefert als Fallback ein noindex-Dokument statt der Startseite', () => {
    // index.html traegt Titel, Canonical und `robots: index, follow` der
    // Startseite. Stuende die hier, praesentierte sich jede unbekannte URL
    // einem Abruf ohne JS als indexierbare Startseite.
    expect(redirects).not.toMatch(/^\/\*\s+\/index\.html/m);
    expect(redirects).toMatch(/^\/\*\s+\/404\.html\s+200$/m);
  });
});
