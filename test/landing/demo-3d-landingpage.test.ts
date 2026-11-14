/**
 * Vertrag der interaktiven 3D-Landingpage (Template-Vorschau, 13.11.2026).
 *
 * - Route `/demo/3d-landingpage` ist lazy registriert und in der SPA-Routenliste.
 * - Einstieg auf der Startseite (Landing v6, Websites, Weg 1) und Rückweg zum Builder `/build`.
 * - Three.js wird nur dynamisch geladen (eigener Chunk, Startseite bleibt schlank).
 * - Ehrliche Kennzeichnung: fiktives Unternehmen, KI-Erstellung „geplant“, keine verbotenen CTAs.
 * - Seite ist noindex und nicht in der Sitemap.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('3D-Landingpage (Template-Vorschau)', () => {
  it('registriert die Route lazy und in der SPA-Routenliste', () => {
    const app = read('src/App.tsx');
    expect(app).toContain("lazy(() => import('./pages/Demo3DLandingPage'))");
    expect(app).toMatch(/path="\/demo\/3d-landingpage" element=\{<Demo3DLandingPage builderHref="\/build" backHref="\/#websites" \/>\}/);
    expect(read('src/config/spaRoutes.generated.ts')).toContain('"/demo/3d-landingpage"');
  });

  it('verlinkt die Seite aus der Website-Karte der Startseite', () => {
    expect(read('src/components/landing/v6/useLandingV6.ts')).toContain(
      "showcase: { label: '3D-Landingpage live erleben', href: '/demo/3d-landingpage' }",
    );
    expect(read('src/components/landing/v6/LandingV6View.tsx')).toContain('data-website-showcase');
  });

  it('lädt Three.js nur dynamisch', () => {
    const page = read('src/pages/Demo3DLandingPage.tsx');
    expect(page).toContain("import('../components/visual/demo-3d/archScene')");
    expect(page).not.toMatch(/^import [^;]*from 'three'/m);
    expect(page).not.toMatch(/^import \{[^}]*createArchScene/m);
    expect(read('src/components/visual/demo-3d/capabilities.ts')).not.toContain("from 'three'");
  });

  it('kennzeichnet Vorlage und Planungsstand ehrlich', () => {
    const page = read('src/pages/Demo3DLandingPage.tsx');
    expect(page).toContain('fiktives Unternehmen');
    expect(page).toMatch(/<strong>geplant<\/strong>/);
    expect(page).not.toMatch(/Pilot anfragen|Demo buchen|Termin vereinbaren|Beratung anfragen/);
    expect(read('src/components/visual/demo-3d/archScene.ts')).not.toContain('Math.random');
  });

  it('bietet Barrierefreiheit und Fallback', () => {
    const page = read('src/pages/Demo3DLandingPage.tsx');
    expect(page).toContain('prefers-reduced-motion');
    expect(page).toContain('isWebGLAvailable');
    expect(page).toContain('Ohne 3D anzeigen');
    expect(page).toContain('role="dialog"');
    // Fokus bleibt im modalen Dialog; Szenenstart übernimmt den aktuellen Konfigurationsstand
    expect(page).toContain("e.key === 'Tab' && openId");
    expect(page).toContain('config: latest.current.config');
    expect(read('src/components/visual/demo-3d/archScene.ts')).toContain('forceContextLoss');
  });

  it('lässt das Modell per Ziehen und per Button drehen, ohne das Scrollen zu sperren', () => {
    const scene = read('src/components/visual/demo-3d/archScene.ts');
    expect(scene).toContain("container.style.touchAction = 'pan-y'");
    expect(scene).toContain('rotateBy(rad)');
    expect(scene).not.toMatch(/preventDefault\(\)/);
    const page = read('src/pages/Demo3DLandingPage.tsx');
    expect(page).toContain('aria-label="Modell nach links drehen"');
    expect(page).toContain("get('qualitaet')");
  });

  it('ist noindex und nicht in der Sitemap', () => {
    const seo = read('src/config/seo.ts');
    const entry = seo.slice(seo.indexOf("'/demo/3d-landingpage'"));
    expect(entry.slice(0, 600)).toContain('noIndex: true');
    expect(read('public/sitemap.xml')).not.toContain('/demo/3d-landingpage');
  });
});
