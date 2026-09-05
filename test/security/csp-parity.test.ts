import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Zweck: Die Anwendung liefert ihre Content-Security-Policy an ZWEI Stellen
 * aus — als HTTP-Header aus `public/_headers` (Cloudflare Pages) und als
 * `<meta http-equiv>` in `index.html`. Beide gelten gleichzeitig und werden
 * vom Browser als **Schnittmenge** ausgewertet: Was in einer der beiden
 * fehlt, ist gesperrt, egal wie großzügig die andere ist.
 *
 * Sicherheitsrelevanz: Die Divergenz wirkt in beide Richtungen. Fehlt eine
 * Quelle in der Meta-Policy, bricht eine Funktion still — der Browser meldet
 * das nur in der Konsole, die Anwendung merkt nichts. Wird umgekehrt der
 * Header großzügiger gemacht in dem Glauben, damit sei die Policy gelockert,
 * entsteht ein falsches Bild der tatsächlichen Sicherheitslage.
 *
 * Anlass: Am 2026-08-31 wurde `static.cloudflareinsights.com` in
 * `public/_headers` ergänzt, um das eigene Analytics-Beacon zu entsperren.
 * Der Fix galt als erledigt, weil der ausgelieferte HTTP-Header die Domain
 * enthielt. Im Browser blieb das Skript trotzdem blockiert: Die Meta-Policy
 * in `index.html` kannte sie nicht, und die Schnittmenge entschied. Der
 * Kommentar über dem Meta-Tag hatte genau davor gewarnt — ein Kommentar
 * bricht aber keinen Build. Dieser Test tut es.
 *
 * Bewusst NICHT geprüft wird Gleichheit der ganzen Policy: `frame-ancestors`
 * wird in einem Meta-CSP laut Spezifikation ignoriert und steht deshalb zu
 * Recht nur im Header. Geprüft wird, dass keine Direktive der Meta-Policy
 * strenger ist als dieselbe Direktive im Header.
 */

const ROOT = resolve(__dirname, '../..');

/** Zerlegt eine CSP in `{ direktive: [quelle, …] }`. */
function parseCsp(policy: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const teil of policy.split(';')) {
    const token = teil.trim().split(/\s+/).filter(Boolean);
    if (token.length === 0) continue;
    const [direktive, ...quellen] = token;
    out[direktive.toLowerCase()] = quellen;
  }
  return out;
}

function headerCsp(): string {
  const datei = readFileSync(resolve(ROOT, 'public/_headers'), 'utf8');
  const zeile = datei
    .split('\n')
    .find(z => z.trim().startsWith('Content-Security-Policy:'));
  if (!zeile) throw new Error('Keine Content-Security-Policy in public/_headers gefunden.');
  return zeile.trim().replace(/^Content-Security-Policy:\s*/, '');
}

function metaCsp(): string {
  const datei = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  const treffer = datei.match(
    /<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/i,
  );
  if (!treffer) throw new Error('Kein Content-Security-Policy-Meta-Tag in index.html gefunden.');
  return treffer[1];
}

// `frame-ancestors` wird in einem Meta-CSP ignoriert und gehoert deshalb
// ausschliesslich in den Header. Keine Divergenz, sondern die Spezifikation.
const NUR_IM_HEADER = new Set(['frame-ancestors']);

describe('CSP-Parität zwischen public/_headers und index.html', () => {
  const header = parseCsp(headerCsp());
  const meta = parseCsp(metaCsp());

  it('erlaubt in der Meta-Policy jede Quelle, die der Header erlaubt', () => {
    const fehlend: string[] = [];
    for (const [direktive, quellen] of Object.entries(header)) {
      if (NUR_IM_HEADER.has(direktive)) continue;
      const metaQuellen = meta[direktive];
      // Direktive fehlt in der Meta-Policy ganz: dann greift default-src,
      // was in aller Regel strenger ist — als Divergenz melden.
      if (!metaQuellen) {
        fehlend.push(`${direktive} (in index.html gar nicht gesetzt)`);
        continue;
      }
      for (const quelle of quellen) {
        if (!metaQuellen.includes(quelle)) fehlend.push(`${direktive}: ${quelle}`);
      }
    }
    expect(
      fehlend,
      'Diese Quellen stehen in public/_headers, fehlen aber im Meta-CSP von index.html. ' +
        'Der Browser wertet beide Policies als Schnittmenge aus — sie sind damit trotz ' +
        'des Headers gesperrt. Beide Stellen gemeinsam pflegen.',
    ).toEqual([]);
  });

  it('hält das Cloudflare-Beacon in beiden Policies offen', () => {
    // Regressionsschutz fuer den konkreten Vorfall: Das Beacon laedt als
    // Skript von static.cloudflareinsights.com und sendet die Messwerte per
    // POST an cloudflareinsights.com — zwei Direktiven, zwei Dateien.
    expect(header['script-src']).toContain('https://static.cloudflareinsights.com');
    expect(meta['script-src']).toContain('https://static.cloudflareinsights.com');
    expect(header['connect-src']).toContain('https://cloudflareinsights.com');
    expect(meta['connect-src']).toContain('https://cloudflareinsights.com');
  });
});
