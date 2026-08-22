/**
 * Pfad-Auflösung des siteos-Routers.
 *
 * ## Warum das geprüft wird
 *
 * Der Router fasst vier Endpunkte in einem Function-Slot zusammen — der
 * einzige Grund, warum SiteOS unter dem Free-Plan-Limit überhaupt eine
 * Chance auf Produktion hat (`src/config/production-edge-functions.ts`).
 * Löst er einen Pfad falsch auf, ist der Preis nicht ein Tippfehler, sondern
 * der komplette öffentliche Builder-Trichter: `/handwerk-website` und
 * `/app/siteos/builder` laufen beide über `discover` und `builder`.
 *
 * Unter Test steht **nur** die Routing-Schicht: eine reine Funktion ohne
 * Deno-Importe. Die vier Handler sind unverändert aus den Einzel-Functions
 * übernommen (`git log --follow` auf den Dateien zeigt die Herkunft).
 *
 * ## Der Fall, der hier wirklich zählt
 *
 * `/siteos-builder` — der alte Bindestrich-Slug — darf **nicht** auflösen.
 * Sonst würde ein Aufrufer, der den Cutover verpasst hat, klaglos bedient,
 * und der vergessene Aufruf fiele erst auf, wenn niemand mehr weiß, woher er
 * kommt. Ein 404 an dieser Stelle ist die gewünschte Antwort.
 */
import { describe, expect, it } from 'vitest';
import { resolveEndpoint, ROUTER_SLUG } from '../../supabase/functions/siteos/resolve';

/** Muss mit der Route-Map in supabase/functions/siteos/index.ts übereinstimmen. */
const ENDPOINTS = ['agents', 'builder', 'discover', 'publish-gate', 'runtime-scan'];

describe('siteos Router — resolveEndpoint', () => {
  it.each(ENDPOINTS)('löst /%s auf den Endpunkt auf', (ep) => {
    expect(resolveEndpoint(`/${ROUTER_SLUG}/${ep}`)).toBe(ep);
  });

  it('versteht den vollen Pfad inklusive /functions/v1-Präfix', () => {
    expect(resolveEndpoint(`/functions/v1/${ROUTER_SLUG}/runtime-scan`)).toBe('runtime-scan');
  });

  it('verträgt einen abschließenden Schrägstrich', () => {
    expect(resolveEndpoint(`/${ROUTER_SLUG}/builder/`)).toBe('builder');
  });

  it('gibt ohne Endpunkt null zurück', () => {
    expect(resolveEndpoint(`/${ROUTER_SLUG}`)).toBeNull();
    expect(resolveEndpoint(`/${ROUTER_SLUG}/`)).toBeNull();
    expect(resolveEndpoint(`/functions/v1/${ROUTER_SLUG}/`)).toBeNull();
  });

  it.each(['siteos-builder', 'siteos-discover', 'siteos-runtime-scan', 'siteos-agents'])(
    'behandelt den alten Slug /%s nicht als Router-Pfad',
    (oldSlug) => {
      expect(resolveEndpoint(`/${oldSlug}`)).toBeNull();
      expect(resolveEndpoint(`/functions/v1/${oldSlug}`)).toBeNull();
    }
  );

  it('gibt unbekannte Tiefe unverändert zurück, damit der Router 404 liefert', () => {
    // Absichtlich kein stiller Fallback auf das erste Segment: `a/b` trifft
    // keinen Eintrag in der Route-Map und endet deshalb im 404-Zweig.
    expect(resolveEndpoint(`/${ROUTER_SLUG}/a/b`)).toBe('a/b');
  });

  it('erkennt keinen Router in einem fremden Pfad', () => {
    expect(resolveEndpoint('/functions/v1/governance-memory')).toBeNull();
    expect(resolveEndpoint('/')).toBeNull();
  });
});

describe('siteos Router — Route-Map und Handler stimmen überein', () => {
  it('hat für jeden Endpunkt eine Handler-Datei und umgekehrt', async () => {
    const { readdirSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const dir = resolve(__dirname, '../../supabase/functions/siteos/handlers');
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => f.replace(/\.ts$/, ''))
      .sort();

    // Zwei Listen, die auseinanderlaufen können: eine Handler-Datei ohne
    // Eintrag in der Route-Map ist toter Code, ein Eintrag ohne Datei ein
    // Importfehler beim Deploy.
    expect(files).toEqual([...ENDPOINTS].sort());
  });

  it('registriert in index.ts genau diese Endpunkte', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(__dirname, '../../supabase/functions/siteos/index.ts'),
      'utf8'
    );
    const map = /const routes[^{]*\{([\s\S]*?)\n\};/.exec(source)?.[1] ?? '';
    const registered = [...map.matchAll(/'([a-z-]+)':/g)].map((m) => m[1]).sort();
    expect(registered).toEqual([...ENDPOINTS].sort());
  });
});
