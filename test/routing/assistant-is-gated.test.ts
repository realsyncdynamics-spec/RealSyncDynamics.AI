// `/assistant` ist eine App-Fläche, keine öffentliche Seite.
//
// Die Route hing ohne Wrapper im Router: `<Route path="/assistant"
// element={<CreatorDashboard />} />`. Die Komponente bringt keinen eigenen
// Guard mit — kein `AuthGate`, kein `RequireAal2`, keine Sitzungsprüfung.
// Damit war sie ohne Anmeldung erreichbar, und das ist mehr als eine
// unschöne Ansicht:
//
//   * `CreatorDashboard` ruft `processAIGatewayRequest` auf. Wer die Seite
//     öffnet, kann Modellaufrufe auslösen, ohne je ein Konto zu haben.
//   * Sie bindet `BillingView` und `PromptsView` ein — Abrechnungs- und
//     Arbeitsansichten, die hinter der Anmeldung gehören.
//
// Erschwerend kam hinzu, dass der Kommentar an der Import-Stelle
// „CreatorDashboard ist auth-gated" behauptete. Wer ihn las, hatte keinen
// Anlass, die Route nachzuprüfen.
//
// Geprüft wird die Bauform: Ob der Guard im Browser greift, hängt an einer
// Supabase-Sitzung, die es hier nicht gibt.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const app = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf-8');
const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf-8');

/** Die Route-Zeile für einen Pfad, exakt wie sie im Router steht. */
function routeLine(path: string): string {
  const line = app
    .split('\n')
    .find((text) => text.includes(`path="${path}"`));
  expect(line, `Route ${path} nicht gefunden`).toBeDefined();
  return line ?? '';
}

describe('/assistant ist auth-gegatet', () => {
  it('hängt hinter AppGate', () => {
    expect(routeLine('/assistant')).toContain('<AppGate>');
  });

  it('mountet CreatorDashboard nicht ohne Wrapper', () => {
    // Der Rückfall in genau die Fassung, die den Befund ausgelöst hat.
    expect(app).not.toContain('element={<CreatorDashboard />}');
  });

  it('verlässt sich nicht auf einen Guard in der Komponente', () => {
    // Wäre dort einer, dürfte der Router-Guard trotzdem nicht entfallen —
    // aber heute ist keiner da, und das soll sichtbar bleiben.
    const view = readFileSync(resolve(ROOT, 'src/pages/CreatorDashboard.tsx'), 'utf-8');
    const hasOwnGuard = /AuthGate|RequireAal2|useSupabaseAuth|isAuthenticated/.test(view);
    expect(
      hasOwnGuard,
      'CreatorDashboard bringt jetzt einen eigenen Guard mit — Kommentar und Test hier nachziehen.',
    ).toBe(false);
  });
});

describe('robots.txt hält /assistant heraus', () => {
  /** Alle `Disallow`-Pfade, ohne Kommentarzeilen. */
  const disallowed = robots
    .split('\n')
    .filter((line) => line.trim().startsWith('Disallow:'))
    .map((line) => line.split(':')[1]?.trim());

  it.each(['/assistant', '/command-center', '/ai-command-center'])(
    'sperrt %s',
    (path) => {
      expect(disallowed).toContain(path);
    },
  );

  it('erzeugt keinen Konflikt mit der Sitemap', () => {
    // Die Datei warnt an anderer Stelle selbst davor: Ein Pfad, der zugleich
    // in der sitemap.xml steht und per Disallow gesperrt ist, erzeugt in der
    // Search Console einen Widerspruch.
    const sitemap = readFileSync(resolve(ROOT, 'public/sitemap.xml'), 'utf-8');
    for (const path of ['/assistant', '/command-center', '/ai-command-center']) {
      expect(sitemap, `${path} steht in der Sitemap und ist zugleich gesperrt`).not.toContain(`${path}<`);
    }
  });
});

// `/kodee` trägt dieselbe Last wie `/assistant`.
//
// `KodeeView` ruft ebenfalls `processAIGatewayRequest` auf und hat keinen
// eigenen Guard. Ohne Router-Gate könnte jeder Besucher Modellaufrufe
// auslösen — dieselbe Lücke, nur an anderer Stelle.
//
// `/kodee/connections` steht bewusst NICHT hier: `ConnectionsView` bringt
// einen eigenen `AuthGate` mit. Diese Unterscheidung ist der Grund, warum
// die Prüfung an der View hängt und nicht bloß am Routennamen.
describe('/kodee ist auth-gegatet', () => {
  it('hängt hinter AppGate', () => {
    expect(routeLine('/kodee')).toContain('<AppGate>');
  });

  it('mountet KodeeView nicht ohne Wrapper', () => {
    expect(app).not.toContain('element={<KodeeView />}');
  });

  it('lässt /kodee/connections in Ruhe — dort schützt die View selbst', () => {
    const view = readFileSync(
      resolve(ROOT, 'src/features/kodee/connections/ConnectionsView.tsx'),
      'utf-8',
    );
    expect(view).toContain('AuthGate');
  });
});
