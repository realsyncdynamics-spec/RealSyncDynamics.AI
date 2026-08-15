import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:4173';

const publicRoutes = [
  // `heading`: stabiler Substring der jeweiligen Hero-Headline (bestätigt,
  // dass die richtige Seite rendert — nicht nur HTTP 200 via SPA-Fallback).
  // FE-001: Transformation-Hero der Startseite ("Ihre Website. Neu gedacht.
  // Sofort sichtbar."). Bewusst wieder ein semantischer Contract statt
  // `heading: null`: ein beliebiges h1 würde auch der SPA-Fallback einer
  // fehlerhaften Route erfüllen — genau das soll dieser Test ausschließen.
  // Geprüft wird ein stabiler Teilstring, damit sich die Copy weiterentwickeln
  // kann, ohne den Test zu brechen.
  { id: 'FE-001', path: '/', label: 'Startseite', heading: /Neu gedacht/i },
  { id: 'FE-003', path: '/audit', label: 'Audit', heading: /Kostenloser DSGVO- und Tracking-Audit/i },
  { id: 'FE-004', path: '/ai-act/', label: 'AI Act', heading: /AI Act compliance without a consulting engagement/i },
  { id: 'FE-005', path: '/oeffentliche-verwaltung/', label: 'Öffentliche Verwaltung', heading: /KI in der öffentlichen Verwaltung/i },
  { id: 'FE-006', path: '/healthtech', label: 'HealthTech', heading: /KI in HealthTech/i },
  { id: 'FE-007', path: '/saas-anbieter/', label: 'SaaS-Anbieter', heading: /DSGVO für B2B-SaaS/i },
  { id: 'FE-008', path: '/checkout/starter/', label: 'Checkout Starter', heading: /Anmelden, um Starter zu buchen/i },
];

for (const route of publicRoutes) {
  test(`[${route.id}] ${route.label} (${route.path}) lädt ohne Fehler`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const response = await page.goto(BASE_URL + route.path, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    expect(response?.status(), `HTTP-Status für ${route.path}`).toBeLessThan(400);
    expect(errors, `JS-Fehler auf ${route.path}`).toHaveLength(0);

    const heading = route.heading
      ? page.getByRole('heading', { name: route.heading }).first()
      : page.locator('h1').first();

    await expect(
      heading,
      `Hero-Headline für ${route.path}`,
    ).toBeVisible({ timeout: 10000 });
  });
}
