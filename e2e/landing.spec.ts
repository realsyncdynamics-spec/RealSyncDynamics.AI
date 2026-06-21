import { test, expect } from '@playwright/test';

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

  test('Seite lädt ohne Fehler', async ({ page }) => {
    // Prüfe, dass Seite antwortet
    await expect(page).toHaveTitle(/RealSyncDynamics/i);

    // Prüfe, dass Haupt-Container sichtbar ist
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible();
  });

  test('CTAs sind sichtbar und funktionieren', async ({ page }) => {
    // Primär-CTA: "KI-Betriebssystem entdecken"
    const cta = page.getByRole('link', { name: /KI-Betriebssystem|entdecken/i }).first();
    await expect(cta).toBeVisible();

    // Prüfe href
    const href = await cta.getAttribute('href');
    expect(href).toBeTruthy();
  });

  test('Feature-Labels sichtbar', async ({ page }) => {
    // Feature-Highlights sollten sichtbar sein
    await expect(page.getByText(/DSGVO/i)).toBeVisible();
    await expect(page.getByText(/AI ACT|AI-ACT/i)).toBeVisible();
  });
    await page.waitForLoadState('networkidle');
  });

  test('Navigation Links vorhanden', async ({ page }) => {
    // Navbar sollte Links haben
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();

    // Mindestens ein Link sollte da sein
    const links = page.locator('nav a');
    await expect(links).toHaveCount(6); // Näherungswert
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
test.describe('Workspace-Vorschau (/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Hero zeigt Governance-OS-Headline und Workspace-CTAs', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: /Das Governance OS für DSGVO, EU AI Act und digitale Souveränität/i,
      }),
    ).toBeVisible();

    await expect(page.getByText(/Automatisch erkennen · Kontinuierlich monitoren · Immer nachweisbar/i)).toBeVisible();

    await expect(page.getByRole('button', { name: /Dashboard öffnen/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Governance Audit starten/i })).toBeVisible();
  });

  test('Governance Complexity Score-Einstieg navigiert zum Assessment', async ({ page }) => {
    await expect(page.getByText(/Governance Complexity Score/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Score ermitteln/i }).click();
    await expect(page).toHaveURL(/\/governance-score/);
  });

  test('Plattform-Module-Sektion sichtbar', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Alles\. In einer Oberfläche\./i }),
    ).toBeVisible();
    // Erkennen · Monitoren · Beweisen — Kern-Value-Props.
    for (const label of ['Erkennen', 'Monitoren', 'Beweisen']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('Keine verbotenen Sales/Pilot/Demo CTAs', async ({ page }) => {
    for (const pattern of FORBIDDEN_CTA) {
      await expect(page.getByRole('link', { name: pattern })).toHaveCount(0);
      await expect(page.getByRole('button', { name: pattern })).toHaveCount(0);
    }
  });
});
