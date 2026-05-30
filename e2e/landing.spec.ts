import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E für die statische Landing im Governance-OS-Framing.
 *
 * Aligned mit `src/pages/Landing.tsx`: Hero (Mission), Problem,
 * Lösung (Detect/Monitor/Govern/Automate), Architektur-Kette,
 * 4 Nutzenkarten, Evidence-Vorschau (Demo-Daten), Layer-Teaser,
 * CTA-Block, kompakter Footer. Weiterhin vollständig statisch —
 * keine Auto-Scroll-Sektionen, kein RuntimeCanvas / LiveScan / FAQ.
 *
 * Assertions prüfen stabile, kopierarme Anker. Tiefere Inhalte
 * (Pricing, Runtime, FAQ usw.) liegen auf Unterseiten.
 */
test('Landing renders the governance-OS hero + narrative + CTAs + footer', async ({ page }) => {
  await page.goto('/');

  // Hero — Governance-OS-Headline
  await expect(
    page.getByRole('heading', {
      name: /Den regulatorischen Zustand Ihrer Systeme messen, versionieren und beweisen\./i,
    }),
  ).toBeVisible();

  // Primary CTA „Kostenlosen Audit starten" → /audit
  const primary = page.getByRole('link', { name: /Kostenlosen Audit starten/i }).first();
  await expect(primary).toBeVisible();
  await expect(primary).toHaveAttribute('href', /\/audit/);

  // Secondary CTA „Plattform ansehen" → /runtime
  const secondary = page.getByRole('link', { name: /^Plattform ansehen$/i }).first();
  await expect(secondary).toBeVisible();
  await expect(secondary).toHaveAttribute('href', /\/runtime/);

  // Tertiary CTA „Demo anfragen" → /contact-sales
  const third = page.getByRole('link', { name: /^Demo anfragen$/i }).first();
  await expect(third).toBeVisible();
  await expect(third).toHaveAttribute('href', /\/contact-sales/);

  // Lösung — Detect · Monitor · Govern · Automate
  await expect(
    page.getByRole('heading', { name: /Detect · Monitor · Govern · Automate/i }),
  ).toBeVisible();

  // Architektur-Kette
  await expect(
    page.getByRole('heading', { name: /^Eine Kette vom Signal zum Nachweis$/i }),
  ).toBeVisible();

  // Value-Sektion „Was Sie sofort sehen" + die vier Nutzenkarten
  await expect(
    page.getByRole('heading', { name: /^Was Sie sofort sehen$/i }),
  ).toBeVisible();
  for (const card of ['Risiko-Score', 'Top-Findings', 'Evidence-Report', 'Nächster Schritt']) {
    await expect(page.getByRole('heading', { name: new RegExp(`^${card}$`) })).toBeVisible();
  }

  // Evidence-Vorschau — klar als Demo gelabelt
  await expect(
    page.getByRole('heading', { name: /^So sieht ein Report aus$/i }),
  ).toBeVisible();
  await expect(page.getByText(/Beispieldaten · Demo-Vorschau/i)).toBeVisible();

  // Footer-Legal-Links
  await expect(page.getByRole('link', { name: /^Impressum$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Datenschutz$/i })).toBeVisible();
});
