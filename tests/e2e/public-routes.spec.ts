import { test, expect } from '@playwright/test';


const publicRoutes = [
  { id: 'FE-001', path: '/', label: 'Startseite', heading: /KI gestalten.*Kunden erreichen.*Arbeit vereinfachen/i },
  { id: 'FE-003', path: '/audit', label: 'Audit', heading: /Ihr KI-Bestand in vier Fragen/i },
  { id: 'FE-004', path: '/ai-act/', label: 'AI Act', heading: /EU-AI-Act-Compliance ohne Beratungsprojekt/i },
  { id: 'FE-005', path: '/oeffentliche-verwaltung/', label: 'Öffentliche Verwaltung', heading: /KI in der öffentlichen Verwaltung/i },
  { id: 'FE-006', path: '/healthtech', label: 'HealthTech', heading: /KI in HealthTech/i },
  { id: 'FE-007', path: '/saas-anbieter/', label: 'SaaS-Anbieter', heading: /DSGVO für B2B-SaaS/i },
  { id: 'FE-008', path: '/checkout/starter/?purchase=1', label: 'Checkout Starter', heading: /Anmelden, um Starter zu buchen/i },
];

for (const route of publicRoutes) {
  test(`[${route.id}] ${route.label} (${route.path}) lädt ohne Fehler`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const response = await page.goto(route.path, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    expect(response?.status(), `HTTP-Status für ${route.path}`).toBeLessThan(400);
    expect(errors, `JS-Fehler auf ${route.path}`).toHaveLength(0);

    await expect(
      page.getByRole('heading', { name: route.heading }).first(),
      `Hero-Headline für ${route.path}`,
    ).toBeVisible();
  });
}

// Das neue Produkt-Hub muss beide angeforderten Studios und die bestehenden
// Kernprodukte als echte Navigation anbieten, nicht nur als Marketingtext.
test('[FE-009] Startseite verknüpft sechs Produktbereiche', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  for (const title of [
    'AI Voice Agent', 'AI App Builder', 'AI Landingpage Designer',
    'Claude Code Optimizer', 'Governance Dashboard', 'AI Creative Studio',
  ]) {
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: /Landingpage gestalten/i })).toHaveAttribute('href', '/build');
  await expect(page.getByRole('link', { name: /Bilder erstellen/i })).toHaveAttribute('href', '/app/media-studio?type=image');
  await expect(page.getByRole('link', { name: /Videos erstellen/i })).toHaveAttribute('href', '/app/media-studio?type=video');
});

test('[FE-010] Die neue Startseite behält den bisherigen Voice-Bot', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const launcher = page.getByTestId('company-voice-launcher');
  await expect(launcher).toBeVisible();
  await launcher.click();
  await expect(page.getByTestId('company-voice-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Demo schließen' }).click();
  await expect(page.getByTestId('company-voice-panel')).toHaveCount(0);
});
