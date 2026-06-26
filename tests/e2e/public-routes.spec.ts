import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'https://realsyncdynamicsai.de';

const publicRoutes = [
  { id: 'FE-001', path: '/', label: 'Startseite' },
  { id: 'FE-003', path: '/audit', label: 'Audit' },
  { id: 'FE-004', path: '/ai-act/', label: 'AI Act' },
  { id: 'FE-005', path: '/oeffentliche-verwaltung/', label: 'Öffentliche Verwaltung' },
  { id: 'FE-006', path: '/healthtech', label: 'HealthTech' },
  { id: 'FE-007', path: '/saas-anbieter/', label: 'SaaS-Anbieter' },
  { id: 'FE-008', path: '/checkout/starter/', label: 'Checkout Starter' },
];

for (const route of publicRoutes) {
  test(`[${route.id}] ${route.label} (${route.path}) lädt ohne Fehler`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const response = await page.goto(BASE_URL + route.path, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    expect(response?.status(), `HTTP-Status für ${route.path}`).toBeLessThan(400);
    expect(errors, `JS-Fehler auf ${route.path}`).toHaveLength(0);
  });
}
