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
test.describe('Workspace-Vorschau (/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Hero zeigt AI-OS-Headline und Self-Serve-CTAs', async ({ page }) => {
    // Europa-Erde-Hero (Zielbild): englische AI-OS-Positionierung.
    await expect(
      page.getByRole('heading', {
        name: /The AI Operating System for GDPR, EU AI Act/i,
      }),
    ).toBeVisible();

    await expect(
      page.getByText(/AI Governance & Code Optimization OS for Trust & Value/i),
    ).toBeVisible();

    // Self-Serve-CTAs (kein Demo-/Sales-Zwang); „Start for Free" auch in der Nav.
    await expect(page.getByRole('link', { name: /Start for Free/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /View Product Tour/i })).toBeVisible();
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
