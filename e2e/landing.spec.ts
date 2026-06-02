import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E für die Startseite (/).
 *
 * Seit PR #515 zeigt "/" die PublicWorkspacePreview (Governance-OS-Shell),
 * nicht mehr die Landing-Marketing-Seite. Die Landing ist unter /landing erreichbar.
 *
 * CTA-Disziplin: ausschließlich Self-Service-Strings; keine Beratungs-/
 * Pilot-/Demo-/Call-/Sales-Sprache.
 */
test('Landing renders the self-service governance-OS narrative + CTAs', async ({ page }) => {
  await page.goto('/');

  // Hero — Governance-OS-Headline
  await expect(
    page.getByRole('heading', { name: /Governance OS/i }),
  ).toBeVisible();

  // EU-Sovereign-Beschreibung
  await expect(
    page.getByText(/EU-souveräne SaaS-Plattform/i),
  ).toBeVisible();

  // Primärer CTA „Dashboard öffnen" (button, navigiert zu /app)
  await expect(
    page.getByRole('button', { name: /Dashboard öffnen/i }),
  ).toBeVisible();

  // Sekundärer CTA „Audit starten" (button, navigiert zu /audit)
  await expect(
    page.getByRole('button', { name: /Audit starten/i }),
  ).toBeVisible();

  // Feature-Kacheln sichtbar
  for (const tile of ['Websites', 'KI-Systeme', 'Risiken', 'Compliance']) {
    await expect(page.getByText(tile).first()).toBeVisible();
  }

  // Keine alten Vertriebs-/Pilot-CTAs auf der Startseite. Bewusst präzise
  // (Mehrwort-CTA-Phrasen), damit legitime globale Komponenten-Texte — etwa
  // der Assistent-Disclaimer „Für tiefere Beratung …" oder „ersetzt keine
  // Rechtsberatung" — NICHT fälschlich als Treffer zählen. Spiegelt die
  // CI-Gate-Logik aus .github/workflows/cta-enforcement.yml.
  for (const forbidden of [
    /Agency Pilot anfragen/i, /Pilot anfragen/i, /Pilot starten/i,
    /Demo anfragen/i, /Beratung anfragen/i, /Gespräch buchen/i,
    /Call buchen/i, /Runtime ansehen/i,
  ]) {
    await expect(page.getByRole('link', { name: forbidden })).toHaveCount(0);
  }
});

/**
 * Smoke-E2E für die Marketing-Landing-Seite (/landing).
 */
test('Marketing landing (/landing) renders governance-OS narrative + CTAs', async ({ page }) => {
  await page.goto('/landing');

  // Hero — Governance-OS-Headline
  await expect(
    page.getByRole('heading', {
      name: /Governance Operating System für DSGVO, AI Act und Continuous Compliance\./i,
    }),
  ).toBeVisible();

  // Primary CTA „Kostenlos starten" → /audit
  const primary = page.getByRole('link', { name: /^Kostenlos starten$/i }).first();
  await expect(primary).toBeVisible();
  await expect(primary).toHaveAttribute('href', /\/audit/);

  // Footer-Legal-Links
  await expect(page.getByRole('link', { name: /^Impressum$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Datenschutz$/i })).toBeVisible();
});
