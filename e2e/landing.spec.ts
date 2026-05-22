import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E for the runtime-narrative Landing (5 sections).
 *
 * Aligned with `src/pages/Landing.tsx` post homepage-runtime refactor.
 * Old long-form-Landing / HeroOnly assertions ("Automatisierte DSGVO…",
 * "Beispiel-Report ansehen") are no longer mounted on `/` — the homepage
 * is now exclusively:
 *   01 HeroSection · 02 LiveScanCanvasSection · 03 GlobalRuntimeFeedSection
 *   04 GovernanceAgentsSection · 05 RuntimeActivationSection
 *
 * The assertions below check stable, copy-low elements (eyebrows, primary
 * CTA, plan names) so future copy tweaks don't keep tripping this spec.
 */
test('Landing renders the 5 runtime sections + Run Scan + plan grid', async ({ page }) => {
  await page.goto('/');

  // 01 Hero — headline split into two spans
  await expect(
    page.getByRole('heading', { name: /This system is\s+already running\./i }),
  ).toBeVisible();

  // Primary CTA is "Run Scan", routed to /audit
  const primary = page.getByRole('button', { name: /^Run Scan$/i }).first();
  await expect(primary).toBeVisible();

  // 02-04 section eyebrows (mono uppercase, "NN · keyword")
  await expect(page.getByText(/02\s*·\s*detect/i)).toBeVisible();
  await expect(page.getByText(/03\s*·\s*monitor/i)).toBeVisible();
  await expect(page.getByText(/04\s*·\s*govern\s*\+\s*automate/i)).toBeVisible();
  await expect(page.getByText(/05\s*·\s*activate/i)).toBeVisible();

  // 02 LiveScanCanvas — section H2
  await expect(
    page.getByRole('heading', { name: /The runtime detects issues in real time\./i }),
  ).toBeVisible();

  // 03 GlobalRuntimeFeed — section H2
  await expect(
    page.getByRole('heading', { name: /Events continuously happen\./i }),
  ).toBeVisible();

  // 04 GovernanceAgents — section H2
  await expect(
    page.getByRole('heading', { name: /AI systems are governed operationally\./i }),
  ).toBeVisible();

  // 05 RuntimeActivation — section H2 + 5-plan grid
  await expect(
    page.getByRole('heading', { name: /^Activate your runtime\.$/i }),
  ).toBeVisible();
  for (const name of ['Free Audit', 'Starter', 'Growth', 'Agency', 'Enterprise']) {
    await expect(
      page.getByRole('heading', { level: 3, name: new RegExp(`^${name}$`) }),
    ).toBeVisible();
  }
});
