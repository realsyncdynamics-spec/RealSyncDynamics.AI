import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E für die Startseite (/) und die Marketing-Landing-Seite (/landing).
 *
 * Seit "Governance OS v1" rendern sowohl "/" als auch "/landing"
 * dieselbe <Landing/>-Komponente mit dem Governance-OS-Hero
 * ("Kontinuierliche Governance für Websites, KI-Systeme und Prozesse.").
 * Die frühere PublicWorkspacePreview (Governance-OS-Shell) ist unter
 * /preview erreichbar.
 *
 * CTA-Disziplin: ausschließlich Self-Service-Strings; keine Beratungs-/
 * Pilot-/Demo-/Call-/Sales-Sprache.
 */
test('Landing (/) renders the simplified hero + CTAs', async ({ page }) => {
  await page.goto('/');

  // Hero — Governance-OS-Headline
  await expect(
    page.getByRole('heading', { name: /Kontinuierliche Governance/i }),
  ).toBeVisible();

  // Subheadline
  await expect(
    page.getByText(/erkennt Risiken, erzeugt Evidence/i),
  ).toBeVisible();

  // Primärer CTA „Kostenlosen Audit starten" (Button, startet Domain-Scan)
  await expect(
    page.getByRole('button', { name: /Kostenlosen Audit starten/i }),
  ).toBeVisible();

  // Sekundärer CTA „Automation Skills ansehen" → /automations
  const automationsLink = page.getByRole('link', { name: /Automation Skills ansehen/i }).first();
  await expect(automationsLink).toBeVisible();
  await expect(automationsLink).toHaveAttribute('href', /\/automations/);

  // Beta-Programm-CTA
  await expect(
    page.getByRole('link', { name: /Für Beta bewerben/i }),
  ).toBeVisible();

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
 * Smoke-E2E für die Marketing-Landing-Seite (/landing) — identische
 * <Landing/>-Komponente wie "/", siehe oben.
 */
test('Marketing landing (/landing) renders the same simplified hero + CTAs', async ({ page }) => {
  await page.goto('/landing');

  // Hero — Governance-OS-Headline (identisch zu "/")
  await expect(
    page.getByRole('heading', { name: /Kontinuierliche Governance/i }),
  ).toBeVisible();

  // Primary CTA „Kostenlosen Audit starten" → /audit
  const primary = page.getByRole('button', { name: /Kostenlosen Audit starten/i }).first();
  await expect(primary).toBeVisible();

  // Final-CTA „Dashboard öffnen" → /welcome
  const dashboardCta = page.getByRole('link', { name: /^Dashboard öffnen$/i }).first();
  await expect(dashboardCta).toBeVisible();
  await expect(dashboardCta).toHaveAttribute('href', /\/welcome/);

  // Footer-Legal-Links
  await expect(page.getByRole('link', { name: /^Impressum$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Datenschutz$/i })).toBeVisible();
});
