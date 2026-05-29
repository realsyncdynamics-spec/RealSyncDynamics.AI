import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E für die Enterprise-positionierte Landing.
 *
 * Aligned mit `src/pages/Landing.tsx` nach Enterprise-Repositionierung:
 * Hero (kontinuierliche Governance), Zielgruppen-Sektion, 4 Nutzenkarten,
 * Risiko-Abschnitt, Evidence-Vorschau, Vertrauen-Sektion, CTA-Block,
 * Footer. Keine Animationen, keine Auto-Scroll-Sektionen.
 *
 * Assertions prüfen stabile, kopierarme Anker. Tiefere Inhalte liegen
 * auf Unterseiten (/runtime, /evidence, /ai-act, /security, /pricing).
 */
test('Landing renders the enterprise hero + sections + CTAs + footer', async ({ page }) => {
  await page.goto('/');

  // Hero — neue Enterprise-Headline
  await expect(
    page.getByRole('heading', {
      name: /Kontinuierliche Governance für Websites, Plattformen und digitale Geschäftsprozesse/i,
    }),
  ).toBeVisible();

  // Primary CTA „Enterprise-Risiko prüfen" → /audit
  const primary = page.getByRole('link', { name: /Enterprise-Risiko prüfen/i }).first();
  await expect(primary).toBeVisible();
  await expect(primary).toHaveAttribute('href', /\/audit/);

  // Secondary CTA „AI-Act-/DSGVO-Pilot starten" → /agencies
  const secondary = page.getByRole('link', { name: /AI-Act-\/DSGVO-Pilot starten/i }).first();
  await expect(secondary).toBeVisible();
  await expect(secondary).toHaveAttribute('href', /\/agencies/);

  // Tertiary CTA „Runtime ansehen" → /runtime
  const third = page.getByRole('link', { name: /^Runtime ansehen$/i }).first();
  await expect(third).toBeVisible();
  await expect(third).toHaveAttribute('href', /\/runtime/);

  // Zielgruppen-Sektion
  await expect(
    page.getByRole('heading', { name: /Gebaut für Enterprise-Properties und regulierte Teams/i }),
  ).toBeVisible();

  // Value-Sektion „Was Sie sofort sehen" + die vier Nutzenkarten
  await expect(
    page.getByRole('heading', { name: /^Was Sie sofort sehen$/i }),
  ).toBeVisible();
  for (const card of ['Risiko-Score', 'Top-Findings', 'Evidence-Report', 'Nächster Schritt']) {
    await expect(page.getByRole('heading', { name: new RegExp(`^${card}$`) })).toBeVisible();
  }

  // Risiko-Sektion
  await expect(
    page.getByRole('heading', { name: /Risiken, die im Tagesgeschäft entstehen/i }),
  ).toBeVisible();

  // Evidence-Vorschau — klar als Demo gelabelt
  await expect(
    page.getByRole('heading', { name: /^So sieht ein Report aus$/i }),
  ).toBeVisible();
  await expect(page.getByText(/Beispieldaten · Demo-Vorschau/i)).toBeVisible();

  // Vertrauen-Sektion
  await expect(
    page.getByRole('heading', { name: /Was Sie prüfen können, bevor Sie unterschreiben/i }),
  ).toBeVisible();

  // CTA-Block — Sekundärlinks auf Unterseiten
  for (const link of ['Evidence ansehen', 'AI Act ansehen', 'Sicherheit ansehen', 'Entwickler ansehen', 'Preise ansehen']) {
    await expect(page.getByRole('link', { name: new RegExp(`^${link}$`) }).first()).toBeVisible();
  }

  // Footer-Legal-Links
  await expect(page.getByRole('link', { name: /^Impressum$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Datenschutz$/i })).toBeVisible();
});
