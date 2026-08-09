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
// MainLanding (/)
//
// Der Block prüfte bis 2026-08 noch die PublicWorkspacePreview („Betriebssystem
// für …"), die auf `/` längst durch MainLanding ersetzt war — die Assertions
// liefen damit gegen Text, den es auf der Seite nicht mehr gibt. Getestet wird
// jetzt der tatsächliche Kontrakt: Hero-Hierarchie, Prozesskette, CTAs und die
// Claim-Disziplin der Proof-Karten.
// ─────────────────────────────────────────────────────────────────────
test.describe('MainLanding (/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Hero zeigt genau eine H1 mit der Positionierung', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText(/AI Compliance\s*Operations OS\s*for Europe/i);
  });

  test('Prozesskette nennt alle vier Schritte', async ({ page }) => {
    for (const step of ['DISCOVER', 'CLASSIFY', 'ENFORCE', 'PROVE']) {
      await expect(page.getByText(step, { exact: true }).first()).toBeVisible();
    }
  });

  test('Primär- und Sekundär-CTA sind erreichbar', async ({ page }) => {
    // Auf die Hero-Section eingegrenzt: „Dashboard-Demo ansehen" kommt weiter
    // unten (ProductEntryPoints) ein zweites Mal vor.
    const hero = page.locator('main section').first();
    await expect(
      hero.getByRole('link', { name: /Kostenlosen Compliance Audit starten/i }),
    ).toBeVisible();
    const secondary = hero.getByRole('link', { name: /Dashboard-Demo ansehen/i });
    await expect(secondary).toBeVisible();
    await expect(secondary).toHaveAttribute('href', '/demo-tour');
  });

  test('Proof-Karten sind als Beispielwerte ausgewiesen', async ({ page }) => {
    // Schutz gegen Regression: Beispielzahlen dürfen nie unmarkiert als
    // Live-Telemetrie erscheinen.
    await expect(page.getByText(/Produktansicht · Beispielwerte/i).first()).toBeVisible();
  });

  test('Keine unbelegten Konformitäts-Claims im Hero', async ({ page }) => {
    await expect(page.getByText(/^Konform$/)).toHaveCount(0);
    await expect(page.getByText(/garantiert DSGVO|100\s*%\s*rechtssicher/i)).toHaveCount(0);
  });

  test('Kern-Sektionen sichtbar', async ({ page }) => {
    for (const heading of [
      /Evidence zuerst\. Runtime danach\./i,
      /Ein Workflow\. Vier Schritte\./i,
      /Vertrauen ist in die Architektur eingebaut/i,
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
  });

  test('Keine verbotenen Sales/Pilot/Demo CTAs', async ({ page }) => {
    for (const pattern of FORBIDDEN_CTA) {
      await expect(page.getByRole('link', { name: pattern })).toHaveCount(0);
      await expect(page.getByRole('button', { name: pattern })).toHaveCount(0);
    }
  });
});
