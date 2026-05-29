import { test, expect } from '@playwright/test';

// Smoke-E2E fuer OAuthProviderButtons (gehostet in Welcome.tsx, Step 1).
//
// Regression-Guard fuer PR #416: das Provider-Set ist auf Google +
// GitHub reduziert, weil Azure + LinkedIn im Supabase-Dashboard nicht
// aktiviert sind und tote Buttons 400 validation_failed triggern. Wenn
// jemand spaeter Microsoft/LinkedIn wieder ins Array aufnimmt ohne den
// Dashboard-Setup zu machen, faellt dieser Test auf.
//
// Das tatsaechliche Click->/authorize-Verhalten ist in den Vitest-Unit-
// Tests mit gemocktem signInWithOAuth abgedeckt; ein Browser-Click
// braeuchte konfigurierte VITE_SUPABASE_URL und ist hier out of scope.

test.describe('OAuth provider buttons', () => {
  test('rendert nur Google + GitHub, keinen Azure/LinkedIn', async ({ page }) => {
    // Welcome rendert OAuthProviderButtons nur in Step 1 und nur mit
    // session-Query-Param (siehe onboarding.spec.ts fuer Hintergrund).
    await page.goto('/welcome?session=cs_test_e2e_oauth&product=RealSync');

    await expect(
      page.getByRole('button', { name: /Mit Google fortfahren/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Mit GitHub fortfahren/i }),
    ).toBeVisible();

    await expect(
      page.getByRole('button', { name: /Mit Microsoft fortfahren/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /Mit LinkedIn fortfahren/i }),
    ).toHaveCount(0);
  });
});
