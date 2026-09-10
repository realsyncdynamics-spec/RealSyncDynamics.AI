// `/assistant` und `/dashboard` sind dieselbe Workspace-Fläche.
//
// Bis 2026-09 hing `/assistant` an `CreatorDashboard` — einer zweiten,
// parallelen Chat-Oberfläche neben `/app/dashboard`. `/dashboard` leitete
// bereits auf `/app` um. Beide URLs zeigen jetzt auf `/app/dashboard`
// (Governance OS mit Assistent). Die Aliase bleiben stehen, damit Bookmarks
// und Altlinks nicht 404 liefern; das Ziel trägt `AppGate`.
//
// `CreatorDashboard` ist entfernt. Ein Rückfall in `element={<CreatorDashboard />}`
// würde wieder zwei Produktflächen erzeugen.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const app = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf-8');
const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf-8');
const redirects = readFileSync(resolve(ROOT, 'public/_redirects'), 'utf-8');

/** Die Route-Zeile für einen Pfad, exakt wie sie im Router steht. */
function routeLine(path: string): string {
  const line = app
    .split('\n')
    .find((text) => text.includes(`path="${path}"`));
  expect(line, `Route ${path} nicht gefunden`).toBeDefined();
  return line ?? '';
}

describe('/assistant und /dashboard sind dieselbe Fläche', () => {
  it.each(['/assistant', '/dashboard', '/command-center', '/ai-command-center'])(
    '%s leitet auf /app/dashboard um',
    (path) => {
      expect(routeLine(path)).toContain('Navigate to="/app/dashboard"');
    },
  );

  it('hält das Ziel hinter AppGate', () => {
    expect(routeLine('/app/dashboard')).toContain('<AppGate>');
    expect(routeLine('/app/dashboard')).toContain('DashboardRouter');
  });

  it('mountet die abgelöste parallele Chat-Seite nicht', () => {
    expect(app).not.toMatch(/pages\/CreatorDashboard/);
    expect(app).not.toContain('element={<CreatorDashboard');
  });

  it.each(['/assistant', '/dashboard', '/command-center', '/ai-command-center'])(
    'hat einen 301 in _redirects für %s',
    (path) => {
      expect(redirects).toMatch(new RegExp(`^${path}\\s+/app/dashboard\\s+301`, 'm'));
    },
  );
});

describe('robots.txt hält die Aliase heraus', () => {
  /** Alle `Disallow`-Pfade, ohne Kommentarzeilen. */
  const disallowed = robots
    .split('\n')
    .filter((line) => line.trim().startsWith('Disallow:'))
    .map((line) => line.split(':')[1]?.trim());

  it.each(['/assistant', '/command-center', '/ai-command-center', '/dashboard', '/app'])(
    'sperrt %s',
    (path) => {
      expect(disallowed).toContain(path);
    },
  );

  it('erzeugt keinen Konflikt mit der Sitemap', () => {
    const sitemap = readFileSync(resolve(ROOT, 'public/sitemap.xml'), 'utf-8');
    for (const path of ['/assistant', '/command-center', '/ai-command-center']) {
      expect(sitemap, `${path} steht in der Sitemap und ist zugleich gesperrt`).not.toContain(`${path}<`);
    }
  });
});

// `/kodee` trägt dieselbe Last wie der frühere Assistent.
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
