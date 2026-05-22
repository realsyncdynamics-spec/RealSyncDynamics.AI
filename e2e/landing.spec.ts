import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E for the conversion-hardened Landing.
 *
 * Aligned with `src/pages/Landing.tsx` nach landing-conversion-hardening:
 * Hero ist auf deutsche Enterprise-Sprache umgestellt, ein 30-Sekunden-
 * Ergebnisblock und ein FAQ-Block sind neu. CTAs sind „Kostenlosen Audit
 * starten" / „Runtime ansehen".
 *
 * Assertions prüfen stabile, kopierarme Anker (Eyebrows, Primary-CTA,
 * Plan-Namen) — so brechen kleinere Copy-Anpassungen den Spec nicht.
 */
test('Landing renders the conversion-hardened sections + primary CTA + plan grid', async ({ page }) => {
  await page.goto('/');

  // 01 Hero — Headline „Kontinuierliche KI- und DSGVO-Governance …"
  await expect(
    page.getByRole('heading', {
      name: /Kontinuierliche KI- und DSGVO-Governance.*überprüfbarer Evidence/i,
    }),
  ).toBeVisible();

  // Primary CTA „Kostenlosen Audit starten" routed to /audit
  const primary = page.getByRole('button', { name: /Kostenlosen Audit starten/i }).first();
  await expect(primary).toBeVisible();

  // Secondary CTA „Runtime ansehen" → /runtime
  await expect(page.getByRole('link', { name: /Runtime ansehen/i }).first()).toBeVisible();

  // 30-Sekunden-Ergebnisblock
  await expect(page.getByText(/Ergebnis\s*·\s*30 Sekunden/i)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Was Sie in den ersten 30 Sekunden sehen\./i }),
  ).toBeVisible();

  // Trust-Block (Zielgruppen-Fit, keine erfundenen Logos)
  await expect(
    page.getByRole('heading', { name: /Entwickelt für Teams, die Governance nachweisen müssen\./i }),
  ).toBeVisible();

  // FAQ-Block am Ende
  await expect(page.getByRole('heading', { name: /^Häufige Fragen\.$/i })).toBeVisible();
  await expect(page.getByText(/Ist RealSync ein Cookie-Banner\?/i)).toBeVisible();

  // RuntimeActivation — Plan-Namen unverändert
  for (const name of ['Free Audit', 'Starter', 'Growth', 'Agency', 'Enterprise']) {
    await expect(
      page.getByRole('heading', { level: 3, name: new RegExp(`^${name}$`) }),
    ).toBeVisible();
  }
});
