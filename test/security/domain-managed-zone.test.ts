/**
 * Eine Fremddomain darf nicht als verwaltete Subdomain durchgehen.
 *
 * ## Der Befund
 *
 * Gemessen am 2026-09-20 auf `main`: `website-domain-manager` entschied an
 * zwei Stellen mit
 *
 * ```ts
 * domain.endsWith('realsyncdynamicsai.de')
 * ```
 *
 * ob eine Domain zu unserer Zone gehoert — ohne fuehrenden Punkt. Damit
 * galten auch `xrealsyncdynamicsai.de`, `boesrealsyncdynamicsai.de` und
 * `meine-realsyncdynamicsai.de` als verwaltet. Solche Domains kann jeder
 * registrieren, und wer sie registriert, kontrolliert ihr DNS.
 *
 * Die beiden Stellen:
 *
 * | Funktion | Entscheidung |
 * |---|---|
 * | `connectDomain` | `domain_type`: `'subdomain'` statt `'custom'` |
 * | `validateDomain` | ob `cloudflare_status` auf `'active'` darf |
 *
 * `checkDNSPropagation` fragt echtes DNS ab, prueft aber nur, ob der Name
 * ueberhaupt aufloest — was fuer eine selbst registrierte Domain immer gilt.
 * Zusammen hob das die Regel im Dateikopf auf: „validate-domain must NOT mark
 * custom domains as cloudflare_status=active based on a public DNS lookup
 * alone." Eine Domain-Anbindung ohne tatsaechliche Verifikation.
 *
 * ## Warum am Quelltext geprueft wird
 *
 * Das Laufzeitverhalten ist aus Vitest nicht pruefbar: die Function importiert
 * `jsr:@supabase/supabase-js`, und `vitest.config.ts` loest `jsr:`-Spezifier
 * nicht auf. Dasselbe Verfahren wie in
 * `test/security/cloudflare-deployer-auth.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const QUELLE = readFileSync(
  resolve(ROOT, 'supabase/functions/website-domain-manager/index.ts'),
  'utf8',
);

/** Kommentarfrei — die Zusicherungen gelten dem Code, nicht der Prosa. */
const code = QUELLE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('website-domain-manager: die Zonenpruefung hat eine Punkt-Grenze', () => {
  it('prueft nicht mehr ohne fuehrenden Punkt', () => {
    // Genau diese Form war der Fehler. Sie darf im Code nicht wieder
    // auftauchen — auch nicht an einer dritten Stelle.
    expect(code).not.toMatch(/endsWith\(\s*['"`]realsyncdynamicsai\.de['"`]\s*\)/);
  });

  it('fuehrt die Zone an genau einer Stelle', () => {
    const treffer = code.match(/MANAGED_ZONE\s*=\s*'realsyncdynamicsai\.de'/g) ?? [];
    expect(treffer.length, 'Zone mehrfach oder gar nicht definiert').toBe(1);
  });

  it('vergleicht auf Gleichheit ODER auf Punkt plus Zone', () => {
    expect(code).toContain('host === MANAGED_ZONE');
    expect(code).toContain('host.endsWith(`.${MANAGED_ZONE}`)');
  });

  it('normalisiert vor dem Vergleich', () => {
    // DNS unterscheidet nicht zwischen Gross- und Kleinschreibung, `endsWith`
    // schon. Ohne `toLowerCase()` wuerde `APP.REALSYNCDYNAMICSAI.DE` als
    // Fremddomain gelten — sicher, aber inkonsistent.
    expect(code).toMatch(/domain\.trim\(\)\.toLowerCase\(\)/);
  });
});

describe('website-domain-manager: beide Entscheidungen nutzen dieselbe Pruefung', () => {
  it('connectDomain leitet den Domain-Typ daraus ab', () => {
    expect(code).toContain('const isSubdomain = isManagedDomain(domain)');
  });

  it('validateDomain leitet die Aktivierbarkeit daraus ab', () => {
    expect(code).toContain('const isManagedSubdomain = isManagedDomain(domain)');
  });

  it('es gibt genau eine Pruefung, nicht zwei nebeneinander', () => {
    const definitionen = code.match(/function isManagedDomain\(/g) ?? [];
    expect(definitionen.length).toBe(1);
    const aufrufe = code.match(/isManagedDomain\(domain\)/g) ?? [];
    expect(aufrufe.length, 'beide Aufrufstellen muessen den Helfer nutzen').toBe(2);
  });
});

describe('website-domain-manager: die Preview-Regel steht weiterhin', () => {
  it('nur verwaltete Subdomains duerfen aus einem DNS-Check aktiv werden', () => {
    expect(code).toContain("if (isManagedSubdomain && dnsValid) {");
    expect(code).toMatch(/status\s*=\s*'active'/);
    // Eine Custom-Domain darf diesen Zweig nicht erreichen.
    expect(code).toMatch(/dns_validated_at:\s*dnsValid && isManagedSubdomain/);
  });

  it('der DNS-Check fragt echtes DNS ab', () => {
    // Er beweist nur, dass der Name aufloest — deshalb ist die Zonenpruefung
    // die eigentliche Sperre und nicht dieser Aufruf.
    expect(code).toContain('dns.google/resolve');
  });

  it('die Autorisierung steht vor jeder Domain-Aktion', () => {
    const auth = code.indexOf('requireAuthAndTenant(req,');
    expect(auth, 'Autorisierung fehlt').toBeGreaterThan(-1);
    for (const aufruf of ['connectDomain(', 'validateDomain(', 'disconnectDomain(', 'checkSSL(']) {
      const stelle = code.indexOf(aufruf);
      expect(stelle, `${aufruf} nicht gefunden`).toBeGreaterThan(-1);
      expect(auth, `${aufruf} liegt vor der Autorisierung`).toBeLessThan(stelle);
    }
  });
});
