import { test, expect } from '@playwright/test';

test.describe('Audit → Website Preview → optional Voice → Governance (public routing)', () => {
  test('pre-fills SiteOS from scan URL without mutating the customer website', async ({ page }) => {
    await page.goto('/handwerk-website?source_url=https%3A%2F%2Fexample.de%2F&audit_id=demo-audit-1&source=post_scan');
    await expect(page.getByRole('textbox', { name: 'Website URL' })).toHaveValue('https://example.de/');
    await expect(page.getByRole('button', { name: /Website analysieren/ })).toBeVisible();
    // This deliberately does not invoke any real customer API, payment or publication.
  });

  test('Voice configuration explicitly permits continuing to Governance without checkout', async ({ page }) => {
    await page.goto('/phonebot/start?source=website_transformation&domain=example.de&audit_id=demo-audit-1');
    await expect(page.getByRole('link', { name: /Weiter zur Governance-Aktivierung/ })).toBeVisible();
    await page.getByRole('link', { name: /Weiter zur Governance-Aktivierung/ }).click();
    await expect(page).toHaveURL(/\/welcome\?next=/);
    const next = new URL(page.url()).searchParams.get('next');
    expect(next).toBe('/app/activation?audit_id=demo-audit-1');
  });
});
