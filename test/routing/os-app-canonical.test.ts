/**
 * `/os/app/*` darf keine zweite App-Oberfläche mehr sein.
 *
 * ## Warum das ein eigener Test ist
 *
 * Unter `/os/app/*` lag ein Klick-Prototyp mit Mockdaten und ohne
 * Backend-Zugriff — zwölf Routen, die aussahen wie das Produkt. Wer dort
 * „Websites", „Risiken" oder „Evidence" öffnete, sah Zahlen, die nie aus
 * Supabase kamen. Genau das ist der Fehlerfall, den dieses Repo nicht haben
 * darf: eine Fläche, die ein Ergebnis behauptet, statt es zu liefern.
 *
 * Zwei Oberflächen für dieselbe Funktion lassen sich nicht beide ehrlich
 * halten — die zweite driftet zwangsläufig weg. Deshalb gibt es nur noch die
 * kanonische Runtime `/app/*` mit ihren Guards (AppGate, RequireAal2,
 * Entitlements); die alten Pfade sind reine Redirects.
 *
 * Der Test prüft drei Dinge, die beim nächsten Umbau leicht kaputtgehen:
 *   1. Kein Redirect zeigt ins Leere — jedes Ziel ist eine echte Route.
 *   2. Kein `/os/app`-Pfad rendert wieder eine eigene Oberfläche.
 *   3. Die Prototyp-Shell und der Platzhalter sind aus dem Router raus.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGACY_OS_APP_ROUTES } from '../../src/enterprise-os/legacyRouteMap';

const ROOT = resolve(__dirname, '../..');
const APP = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');

/** Alle literal deklarierten Routen-Pfade aus `src/App.tsx`. */
const DECLARED_PATHS = new Set([...APP.matchAll(/path="([^"]+)"/g)].map((m) => m[1]));

describe('/os/app/* → kanonische /app/*-Runtime', () => {
  it('deckt jeden Pfad des früheren Prototyp-Workspace ab', () => {
    const legacyPaths = LEGACY_OS_APP_ROUTES.map(([from]) => from);
    expect(legacyPaths).toEqual([
      '/os/app',
      '/os/app/websites',
      '/os/app/risks',
      '/os/app/compliance',
      '/os/app/evidence',
      '/os/app/monitoring',
      '/os/app/ai-usecases',
      '/os/app/agents',
      '/os/app/reports',
      '/os/app/team',
      '/os/app/billing',
      '/os/app/settings',
      '/os/app/*',
    ]);
  });

  it('leitet jeden Legacy-Pfad auf eine Route, die es wirklich gibt', () => {
    for (const [legacyPath, canonicalPath] of LEGACY_OS_APP_ROUTES) {
      expect(canonicalPath.startsWith('/app/'), `${legacyPath} → ${canonicalPath}`).toBe(true);
      expect(DECLARED_PATHS.has(canonicalPath), `${canonicalPath} fehlt in src/App.tsx`).toBe(true);
    }
  });

  it('lässt keinen Legacy-Pfad im /os-Bereich zurückzeigen', () => {
    for (const [, canonicalPath] of LEGACY_OS_APP_ROUTES) {
      expect(canonicalPath.startsWith('/os')).toBe(false);
    }
  });

  it('verdrahtet die Redirects aus der einen Mapping-Quelle', () => {
    expect(APP).toContain("import { LEGACY_OS_APP_ROUTES } from './enterprise-os/legacyRouteMap'");
    expect(APP).toContain('LEGACY_OS_APP_ROUTES.map(');
    expect(APP).toMatch(/<Navigate to=\{canonicalPath\} replace \/>/);
  });

  it('rendert unter /os/app keine eigene Oberfläche mehr', () => {
    // Ein literaler `path="/os/app…"` im Router hieße: jemand hat neben dem
    // Redirect wieder eine eigene Fläche gehängt.
    const osAppRoutes = [...DECLARED_PATHS].filter((p) => p.startsWith('/os/app'));
    expect(osAppRoutes).toEqual([]);

    // Prototyp-Shell und Platzhalter dürfen nicht zurück in den Router.
    expect(APP).not.toContain('EnterpriseAppShell');
    expect(APP).not.toContain('EnterprisePlaceholderPage');
    expect(APP).not.toContain('EnterpriseAppHomePage');
  });
});
