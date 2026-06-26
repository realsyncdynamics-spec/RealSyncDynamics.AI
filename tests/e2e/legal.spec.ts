import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'https://realsyncdynamicsai.de';

const legalRoutes = [
  { id: 'LEGAL-001', path: '/impressum', label: 'Impressum', required: true },
  { id: 'LEGAL-002', path: '/datenschutz', label: 'Datenschutz', required: true },
  { id: 'LEGAL-003', path: '/agb', label: 'AGB', required: false },
];

for (const route of legalRoutes) {
  const testFn = route.required ? test : test;

  testFn(`[${route.id}] ${route.label} (${route.path}) ist erreichbar`, async ({ page }) => {
    const response = await page.goto(BASE_URL + route.path, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    if (!route.required && response?.status() === 404) {
      test.skip(true, `${route.label} nicht vorhanden (404) – optional`);
      return;
    }

    expect(response?.status(), `HTTP-Status ${route.path}`).toBeLessThan(400);

    // Mindestinhalt prüfen
    const content = await page.locator('body').textContent();
    expect(content?.length ?? 0).toBeGreaterThan(200);
  });
}
