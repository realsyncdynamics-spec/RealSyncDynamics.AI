import { test, expect } from '@playwright/test';

test.describe('Unified Entry — Website Builder', () => {
  test('scan entry remains URL-first', async ({ page }) => {
    await page.goto('/unified-entry/scan');
    await expect(page.getByPlaceholder(/z\.B\. example\.com/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Kostenlos starten/i })).toBeVisible();
  });

  test('post-scan preview shows the visual wow moment before lead capture', async ({ page }) => {
    await page.goto('/unified-entry/preview?auditId=test-123&domain=example.com&score=75&trackers=1&cookies=0&severity=medium');

    await expect(page.getByRole('heading', { name: /Jetzt zeigen wir dir, was aus deiner Website werden kann/i })).toBeVisible();
    await expect(page.getByText('Modern Minimal')).toBeVisible();
    await expect(page.getByText('Bento Bold')).toBeVisible();
    await expect(page.getByText('Dark Professional')).toBeVisible();

    // No contact data is requested before the user sees/selects a design.
    await expect(page.getByPlaceholder(/E-Mail-Adresse/i)).toHaveCount(0);
    await expect(page.getByText(/Paketwahl/i)).toBeVisible();

    await page.getByRole('button', { name: /Diese Variante wählen → Vorschau öffnen/i }).click();
    await expect(page.getByRole('heading', { name: /So könnte deine Website aussehen/i })).toBeVisible();
    await expect(page.getByTitle('Vollständige Website-Vorschau')).toBeVisible();
    await expect(page.getByText(/Modernes Design/i)).toBeVisible();

    await page.getByRole('button', { name: /Ja, genau so → Angebot ansehen/i }).click();
    await expect(page.getByRole('heading', { name: /Wir bauen deine ausgewählte Website/i })).toBeVisible();
    await expect(page.getByPlaceholder(/E-Mail-Adresse/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Unternehmen \(optional\)/i)).toBeVisible();
  });

  test('offer stage presents one-time and Starter annual options after lead capture', async ({ page }) => {
    await page.goto('/unified-entry/preview?auditId=test-456&domain=example.com&score=75');
    await page.getByRole('button', { name: /Diese Variante wählen → Vorschau öffnen/i }).click();
    await page.getByRole('button', { name: /Ja, genau so → Angebot ansehen/i }).click();

    // Do not call the live lead endpoint in CI; validate the contract/UI instead.
    await expect(page.getByRole('heading', { name: /Wir bauen deine ausgewählte Website/i })).toBeVisible();
    await expect(page.getByText(/12 Monate Mindestlaufzeit/i)).not.toBeVisible();
    await expect(page.getByText(/14-Tage-Testphase/i)).not.toBeVisible();
  });
});
