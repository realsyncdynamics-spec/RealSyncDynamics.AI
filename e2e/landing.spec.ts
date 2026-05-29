import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E für die minimale, stabile Landing.
 *
 * Aligned mit `src/pages/Landing.tsx` nach `fix(landing): reduce
 * homepage to stable German conversion surface`: Hero (kurz, deutsch,
 * ohne Animation), 4 Nutzenkarten, Evidence-Vorschau (Demo-Daten),
 * CTA-Block, kompakter Footer. Keine Auto-Scroll-Sektionen, kein
 * RuntimeCanvas / LiveScan / FAQ / Plan-Grid auf der Startseite.
 *
 * Assertions prüfen stabile, kopierarme Anker. Tiefere Inhalte
 * (Pricing, Runtime, FAQ usw.) liegen auf Unterseiten.
 */
test('Landing renders the minimal hero + value cards + CTAs + footer', async ({ page }) => {
  await page.goto('/');

  // Hero — neue Headline
  await expect(
    page.getByRole('heading', {
      name: /Mehrere Websites\..*Kontinuierlich überwacht\..*Audit-ready\./i,
    }),
  ).toBeVisible();

  // Primary CTA „Kostenlosen Audit starten" → /audit
  const primary = page.getByRole('link', { name: /Kostenlosen Audit starten/i }).first();
  await expect(primary).toBeVisible();
  await expect(primary).toHaveAttribute('href', /\/audit/);

  // Secondary CTA „Runtime ansehen" → /runtime
  const secondary = page.getByRole('link', { name: /^Runtime ansehen$/i }).first();
  await expect(secondary).toBeVisible();
  await expect(secondary).toHaveAttribute('href', /\/runtime/);

  // Third CTA „Agency Pilot anfragen" → /agencies
  const third = page.getByRole('link', { name: /Agency Pilot anfragen/i }).first();
  await expect(third).toBeVisible();
  await expect(third).toHaveAttribute('href', /\/agencies/);

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

  // CTA-Block — Sekundärlinks auf Unterseiten
  for (const link of ['Evidence ansehen', 'AI Act ansehen', 'Sicherheit ansehen', 'Entwickler ansehen', 'Preise ansehen']) {
    await expect(page.getByRole('link', { name: new RegExp(`^${link}$`) })).toBeVisible();
  }

  // Footer-Legal-Links
  await expect(page.getByRole('link', { name: /^Impressum$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Datenschutz$/i })).toBeVisible();
});
