import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:4173';

const legalRoutes = [
  // Konkreter, stabiler Inhalt je Rechtstext: Impressum trägt ein <h1>Impressum,
  // die Datenschutzerklärung rendert ihren Titel als Marken-Header.
  { id: 'LEGAL-001', path: '/impressum', label: 'Impressum', required: true, content: /Impressum/i },
  { id: 'LEGAL-002', path: '/datenschutz', label: 'Datenschutz', required: true, content: /Datenschutzerklärung/i },
  { id: 'LEGAL-003', path: '/agb', label: 'AGB', required: false, content: /AGB|Allgemeine Geschäftsbedingungen/i },
];

for (const route of legalRoutes) {
  test(`[${route.id}] ${route.label} (${route.path}) ist erreichbar`, async ({ page }) => {
    const response = await page.goto(BASE_URL + route.path, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    if (!route.required && response?.status() === 404) {
      test.skip(true, `${route.label} nicht vorhanden (404) – optional`);
      return;
    }

    expect(response?.status(), `HTTP-Status ${route.path}`).toBeLessThan(400);

    // Konkreter Mindestinhalt statt nur Body-Länge.
    await expect(page.getByText(route.content).first()).toBeVisible({ timeout: 10000 });
  });
}
