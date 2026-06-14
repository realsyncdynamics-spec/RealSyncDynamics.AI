import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E für die Startseite (/) und die Marketing-Landing-Seite (/landing).
 *
 * Seit dem Routing-Wechsel rendern sowohl "/" als auch "/landing" dieselbe
 * <Landing/>-Komponente mit dem auf Audit-Conversion optimierten Hero
 * ("Prüfen Sie Ihre Website in 30 Sekunden"). Die frühere
 * PublicWorkspacePreview (Governance-OS-Shell) ist unter /preview erreichbar.
 *
 * CTA-Disziplin: ausschließlich Self-Service-Strings; keine Beratungs-/
 * Pilot-/Demo-/Call-/Sales-Sprache.
 */
test('Landing (/) renders the audit-conversion hero + CTAs', async ({ page }) => {
  await page.goto('/');

  // Hero — Audit-Conversion-Headline
  await expect(
    page.getByRole('heading', { name: /in 30 Sekunden/i }),
  ).toBeVisible();

  // Subheadline — Tracker/Cookies/Drittlandtransfer-Beschreibung
  await expect(
    page.getByText(/Tracker, Cookies, Drittlandtransfers/i),
  ).toBeVisible();

  // Primärer CTA „Kostenlos prüfen" (Button, startet Domain-Scan)
  await expect(
    page.getByRole('button', { name: /Kostenlos prüfen/i }),
  ).toBeVisible();

  // Trust-Signale im Hero
  for (const signal of ['Kein Account erforderlich', 'Kostenloser Erstcheck']) {
    await expect(page.getByText(signal).first()).toBeVisible();
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
 * Smoke-E2E für die Marketing-Landing-Seite (/landing) — identische
 * <Landing/>-Komponente wie "/", siehe oben.
 */
test('Marketing landing (/landing) renders the same audit-conversion hero + CTAs', async ({ page }) => {
  await page.goto('/landing');

  // Hero — Audit-Conversion-Headline (identisch zu "/")
  await expect(
    page.getByRole('heading', { name: /in 30 Sekunden/i }),
  ).toBeVisible();

  // Primary CTA „Kostenlos starten" → /audit
  const primary = page.getByRole('link', { name: /^Kostenlos starten$/i }).first();
  await expect(primary).toBeVisible();
  await expect(primary).toHaveAttribute('href', /\/audit/);

  // Footer-Legal-Links
  await expect(page.getByRole('link', { name: /^Impressum$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Datenschutz$/i })).toBeVisible();
});
