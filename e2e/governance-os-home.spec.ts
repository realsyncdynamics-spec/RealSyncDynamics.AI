import { test, expect } from '@playwright/test';

/**
 * E2E für die „Governance OS 2050"-Homepage (/governance-os).
 *
 * Dunkles Premium-Design (eigene dunkle Navigation, 3D-Europa-Globe). Getestet
 * wird der stabile Kontrakt — Hero, Self-Serve-CTAs, die acht Kern-Sektionen,
 * Final-CTA und Footer — sowie die CTA-Disziplin (keine Sales-/Pilot-/Demo-/
 * Call-Sprache). Bewusst ohne flüchtige Element-Counts.
 *
 * Der 3D-Globe (Three.js) wird lazy geladen und ist nicht Teil des Kontrakts;
 * Playwright läuft mit prefers-reduced-motion-neutralem Default — die Seite
 * rendert unabhängig vom WebGL-Status (statischer Fallback-Globe).
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

test.describe('Governance-OS-Homepage (/governance-os)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance-os');
  });

  test('Hero zeigt 2050-Headline und Self-Serve-CTAs', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: /Das KI-Betriebssystem für DSGVO & EU AI Act/i,
        level: 1,
      }),
    ).toBeVisible();

    // Sub-Tagline sichtbar.
    await expect(page.getByText(/by RealSync Dynamics AI/i)).toBeVisible();

    await expect(page.getByText(/DSGVO-konform, AI-Act-ready und auditierbar/i)).toBeVisible();

    // Primär-CTA: Self-Serve, kein Demo-Zwang.
    await expect(
      page.getByRole('link', { name: /Kostenlos starten/i }).first(),
    ).toBeVisible();
    // Sekundär-CTA: Produkt-Tour.
    await expect(page.getByRole('link', { name: /Produkt-Tour ansehen/i })).toBeVisible();

    // Trust-Signale im Hero.
    await expect(page.getByText(/EU-Hosting/i).first()).toBeVisible();
    await expect(page.getByText(/Keine Kreditkarte/i).first()).toBeVisible();
  });

  test('Kern-Sektionen sichtbar', async ({ page }) => {
    for (const heading of [
      /Ein System für Ihre digitale Compliance/i,
      /Ein Betriebssystem — neun Module, ein Prüfpfad/i,
      /Sofort nutzbare Automation Skills/i,
      /Evidence statt Behauptungen/i,
      /Enterprise Trust für Europa/i,
      /Self-Service vom ersten Scan an/i,
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
  });

  test('Final-CTA mit Self-Serve-Sprache', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: /Kostenlosen Audit starten/i }).last(),
    ).toBeVisible();
    await expect(page.getByText(/Keine Kreditkarte · EU-Hosting/i)).toBeVisible();
  });

  test('Hero-Audit-CTA navigiert zum Audit', async ({ page }) => {
    await page.locator('a[href*="governance-os-hero"]').first().click();
    await expect(page).toHaveURL(/\/audit/);
    expect(page.url()).toContain('source=governance-os-hero');
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
// Startseite "/" = KI-Betriebssystem (erstes Produkt)
// ─────────────────────────────────────────────────────────────────────
test.describe('Startseite (/)', () => {
  test('Root zeigt das KI-Betriebssystem', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /Das KI-Betriebssystem für DSGVO & EU AI Act/i, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(/by RealSync Dynamics AI/i)).toBeVisible();
  });
});
