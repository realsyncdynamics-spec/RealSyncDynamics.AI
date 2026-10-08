/**
 * Smoke: /app/voice ohne Login → /welcome (wie /app/dashboard).
 */
import { test, expect } from '@playwright/test';

test('/app/voice leitet Nicht-Angemeldete zum Login', async ({ page }) => {
  await page.goto('/app/voice');
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('button', { name: /Magic-Link senden/i })).toBeVisible();
});
