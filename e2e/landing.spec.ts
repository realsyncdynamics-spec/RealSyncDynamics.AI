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

  test('Hero zeigt KI-Betriebssystem-Headline und Self-Serve-CTAs', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: /Das KI-Betriebssystem für DSGVO & EU AI Act/i,
      }),
    ).toBeVisible();

    // Primär-CTAs: Self-Serve
    await expect(page.getByRole('link', { name: /KI-Betriebssystem entdecken/i })).toBeVisible();

    // Feature-Highlights
    await expect(page.getByText(/DSGVO-KONFORM/i)).toBeVisible();
    await expect(page.getByText(/AI-ACT-READY/i)).toBeVisible();
    await expect(page.getByText(/KONTINUIERLICH/i)).toBeVisible();
  });

  test('Landing ist vollständig sichtbar und reagiert auf Scrolling', async ({ page }) => {
    // Prüfe, dass die Seite loaded und kein kritischer Error
    const heading = page.getByRole('heading', {
      name: /Das KI-Betriebssystem für DSGVO & EU AI Act/i,
    });
    await expect(heading).toBeVisible();

    // Scrolle zur Seite zu überprüfen, dass keine Fehler beim Rendering
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForLoadState('networkidle');
  });

  test('Glass Panels und Feature-Cards sichtbar', async ({ page }) => {
    // Neue Landing zeigt Glass Panels mit Status-Infos
    await expect(page.getByText(/DSGVO/i)).toBeVisible();
    await expect(page.getByText(/RISK SCORE/i)).toBeVisible();
    await expect(page.getByText(/EVIDENCE/i)).toBeVisible();
  });

  test('Footer mit Links sichtbar', async ({ page }) => {
    // Footer sollte am Ende der Seite sichtbar sein
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await expect(page.getByRole('contentinfo')).toBeVisible();
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
