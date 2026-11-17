import { test, expect } from '@playwright/test';


const publicRoutes = [
  { id: 'FE-001', path: '/', label: 'Startseite', heading: /Website- und KI-Risiken prüfen.*Nachweise dokumentieren/i },
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

// Öffentliche Landing: ausschließlich Governance und SiteOS-Preview als Produktkarten.
test('[FE-009] Startseite verlinkt nur überprüfbare Produktflächen', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Governance Runtime', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SiteOS Preview', exact: true })).toBeVisible();
  await expect(page.locator('#plattform article')).toHaveCount(2);
  await expect(page.getByRole('link', { name: /Kostenlosen Scan starten/i })).toHaveAttribute('href', '/audit?source=governance-first-hero');
  await expect(page.getByRole('link', { name: /SiteOS Preview anfragen/i })).toHaveAttribute('href', '/kontakt?intent=siteos-preview&source=governance-first-hero');
  await expect(page.getByRole('link', { name: /Entwurfsoberfläche ansehen/i })).toHaveAttribute('href', '/build');
});

test('[FE-010] Nicht freigegebene Voice- und Creator-Produkte werden nicht angeboten', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('company-voice-launcher')).toHaveCount(0);
  for (const name of ['AI Voice Agent', 'AI App Builder', 'AI Creative Studio', 'Claude Code Optimizer']) {
    await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.locator('a[href^="/app/media-studio"]')).toHaveCount(0);
});

test('[FE-011] Optimizer benennt Website-Audit und fehlende Code-Automation klar', async ({ page }) => {
  await page.goto('/claude-code-optimizer', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Claude Code Optimizer' }).last()).toBeVisible();
  await expect(page.getByText(/automatische Repository-.*Analyse mit Code-Änderungen/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Website scannen/i })).toBeVisible();
});
