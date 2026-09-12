import { test, expect } from '@playwright/test';
import { HERO_HEADLINE_TEST_SUBSTRING, HERO_HEADLINE_LINES } from '../src/components/governance-frontend/hero-content';
import { PLATFORM_LIVE_ITEMS } from '../src/product/implementation-status';

/**
 * E2E für die öffentlichen Einstiegsseiten.
 *
 * Positionierung (PR #591 ff.):
 *   - `/`         → PublicWorkspacePreview (Governance-OS-Workspace-Vorschau)
 *   - `/landing`  → Landing.tsx (Marketing-Landing, „European Enterprise Trust")
 *
 * Beide tragen dieselbe Governance-OS-Headline; getestet wird der stabile
 * Kontrakt (Hero, Self-Serve-CTAs, Kern-Sektionen) — keine flüchtigen Counts.
 * CTA-Disziplin: ausschließlich Self-Service-Strings, keine Sales-/Pilot-/
 * Demo-/Call-Sprache.
 */

// Verbotene Beratungs-/Sales-CTAs (Spiegel von runtimeVocab.CI_FORBIDDEN_CTA).
const FORBIDDEN_CTA = [
  /Pilot anfragen/i,
  /Demo anfragen/i,
  /Demo buchen/i,
  /Gespräch buchen/i,
  /Call buchen/i,
  /Beratung anfragen/i,
  /Sales kontaktieren/i,
  /Vertrieb kontaktieren/i,
];

// ─────────────────────────────────────────────────────────────────────
// Marketing-Landing (/landing)
// ─────────────────────────────────────────────────────────────────────
test.describe('Marketing-Landing (/landing)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing');
  });

  test('Hero zeigt Governance-OS-Headline und Self-Serve-CTAs', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: /Das Governance OS für DSGVO, EU AI Act und digitale Souveränität/i,
      }),
    ).toBeVisible();

    // Primär-CTAs: Self-Serve, kein Demo-Zwang.
    await expect(page.getByRole('link', { name: /14 Tage gratis starten/i })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Governance Audit starten/i }).first(),
    ).toBeVisible();

    // Trust-Signale.
    await expect(page.getByText(/EU-Hosting/i).first()).toBeVisible();
    await expect(page.getByText(/Keine Kreditkarte nötig/i)).toBeVisible();
  });

  test('Domain-Scan-Teaser navigiert zum Audit', async ({ page }) => {
    const input = page.getByPlaceholder(/ihre-domain\.de/i);
    await expect(input).toBeVisible();
    await input.fill('example.de');
    await page.getByRole('button', { name: /Scan/i }).click();
    await expect(page).toHaveURL(/\/audit/);
    expect(page.url()).toContain('domain=example.de');
  });

  test('Kern-Sektionen sichtbar', async ({ page }) => {
    for (const heading of [
      /Für jedes Team, das Verantwortung für Compliance trägt/i,
      /Digitale Souveränität als Betriebsmodell/i,
      /Governance für Software, Anbieter und Open-Source-Komponenten/i,
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
  });

  test('Final-CTA mit Self-Serve-Sprache', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Governance OS — kostenlos starten/i }),
    ).toBeVisible();
    await expect(page.getByText(/Keine Kreditkarte erforderlich/i)).toBeVisible();
  });

  test('Footer-Links (Impressum, Datenschutz) erreichbar', async ({ page }) => {
    await expect(page.getByRole('link', { name: /^Impressum$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Datenschutz$/i })).toBeVisible();
  });

  test('Keine verbotenen Sales/Pilot/Demo CTAs', async ({ page }) => {
    for (const pattern of FORBIDDEN_CTA) {
      await expect(page.getByRole('link', { name: pattern })).toHaveCount(0);
      await expect(page.getByRole('button', { name: pattern })).toHaveCount(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Governance-OS Workspace-Vorschau (/)
// ─────────────────────────────────────────────────────────────────────
// Seit dem Governance-AI-Landing (a5479fcb / 1e948122) rendert `/` die
// Governance-AI-Seite, nicht mehr die Workspace-Vorschau. Diese Suite läuft
// nicht in CI (dort läuft nur `npm run test:e2e`), deshalb war sie unbemerkt
// gegen eine Landing gerichtet, die es nicht mehr gibt.
test.describe('Governance-AI-Landing (/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Hero zeigt Governance-Headline und CTAs', async ({ page }) => {
    // Erwartung aus derselben Quelle wie die H1 — sonst driftet der Test bei
    // jedem Landing-Umbau weg (genau das ist zwischen 13.08. und 16.08.
    // siebenmal passiert).
    await expect(
      page.getByRole('heading', { name: new RegExp(HERO_HEADLINE_TEST_SUBSTRING, 'i') }).first(),
    ).toBeVisible();

    // Nicht auf den zusammengesetzten Fliesstext pruefen: Die H1 rendert je
    // Zeile ein eigenes Block-Element, zwischen denen kein Leerzeichen steht.
    //
    // Und nicht auf ein Wort festnageln: Hier stand `'Code-Compliance'` —
    // abgeschrieben aus der damaligen Headline. Bei der naechsten Aenderung an
    // hero-content.ts fiel der Test um, obwohl die Seite in Ordnung war. Die
    // Zeilen kommen jetzt aus derselben Quelle wie die H1.
    const h1 = page.getByRole('heading', { level: 1 }).first();
    for (const line of HERO_HEADLINE_LINES) {
      await expect(h1).toContainText(line);
    }

    // P0: Scan-Submit → `/audit`, secondary outline → Governance OS.
    await expect(
      page.getByRole('button', { name: /Kostenlosen Governance Scan starten/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Explore the Governance OS|Governance OS ansehen/i }).first(),
    ).toBeVisible();
  });

  test('Hero-Visual ist Europa + Sunrise, kein Sphere-HUD', async ({ page }) => {
    // Scenery only — no interactive Governance Sphere / DEMO chrome on `/`.
    await expect(page.locator('[data-hero-visual="europe-sunrise"]')).toBeVisible();
    await expect(page.locator('[data-governance-sphere]')).toHaveCount(0);
    await expect(page.getByText(/^Live\b/)).toHaveCount(0);
    // Mobile Beispiel-Streifen bleibt ehrlich beschriftet, falls sichtbar.
    const beispiel = page.getByText(/BEISPIELANSICHT/i);
    if ((await beispiel.count()) > 0) {
      await expect(beispiel.first()).toBeVisible();
    }
  });

  test('Plattform-Sektion rendert die Faehigkeitsquelle, nicht eine eigene Liste', async ({ page }) => {
    const platform = page.locator('#platform');
    await expect(platform.getByRole('heading', { name: /^Eine Runtime\./i })).toBeVisible();

    // Registry SSoT: nur LIVE items mit showOnPlatform.
    for (const cap of PLATFORM_LIVE_ITEMS) {
      await expect(platform.getByText(cap.name, { exact: true })).toBeVisible();
    }
  });

  test('Rechtslinks im Footer sind erreichbar (§ 5 DDG)', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: /^Impressum$/ })).toBeVisible();
    await expect(footer.getByRole('link', { name: /^Datenschutz$/ })).toBeVisible();
  });

  test('Keine verbotenen Sales/Pilot/Demo CTAs', async ({ page }) => {
    for (const pattern of FORBIDDEN_CTA) {
      await expect(page.getByRole('link', { name: pattern })).toHaveCount(0);
      await expect(page.getByRole('button', { name: pattern })).toHaveCount(0);
    }
  });
});
