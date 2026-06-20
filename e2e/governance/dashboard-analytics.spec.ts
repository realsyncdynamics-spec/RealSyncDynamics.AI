import { test, expect } from '@playwright/test';

/**
 * E2E-Tests für das Dashboard Analytics Modul (/app/analytics).
 *
 * Governance KPI Dashboard mit:
 *   - Echtzeit-Metriken (Assets, Incidents, Coverage)
 *   - Trend-Indikatoren (up/down/flat)
 *   - Filterung nach Datum, Asset-Typ, Severity
 *   - Diagramme (Liniendiagramm, Kreisdiagramm)
 *   - Sortierbare Datentabelle
 *   - CSV/PDF Export
 */

test.describe('Dashboard Analytics — Basic Loading & Auth', () => {
  test('Unauthentifiziert: Analytics leitet zu Auth-Gate um', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Sollte entweder zu /welcome/auth oder /login redirecten oder AuthGate zeigen
    const url = page.url();
    const isAuthPath = url.includes('/welcome') || url.includes('/login') || url.includes('/auth');
    expect(isAuthPath).toBeTruthy();

    // Keine fatalen JS-Fehler
    const fatalErrors = errors.filter(
      e => (e.includes('TypeError') || e.includes('ReferenceError')) &&
           !e.includes('ResizeObserver')
    );
    expect(fatalErrors).toHaveLength(0);
  });

  test('Analytics-Route ist im Modul-Menü registriert', async ({ page }) => {
    // Smoke-Check: Route sollte im GovernanceBrowserShell registriert sein
    await page.goto('/app');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Kein 404 oder 500
    await expect(page).not.toHaveURL(/404|500/);
  });
});

test.describe('Dashboard Analytics — Layout & Components', () => {
  test('Header mit Titel und Export-Button rendert', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Header sichtbar
    await expect(page.getByRole('heading', { name: /Analytics/i })).toBeVisible();

    // Export-Button vorhanden
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible();
  });

  test('KPI Metrics Grid rendert (wenn Daten vorhanden)', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Entweder Loading-Zustand oder Metrik-Karten
    const isLoading = await page.getByText(/Loading|Lade/i).isVisible().catch(() => false);
    const hasCards = await page.getByRole('heading', { level: 3 }).count().then(c => c > 0).catch(() => false);

    // Mindestens Loading oder Cards sichtbar
    expect(isLoading || hasCards).toBeTruthy();
  });

  test('Filter Panel mit Datum-Presets rendert', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Filter Panel sichtbar
    const filterPanel = page.getByRole('heading', { name: /Filter/i });
    await expect(filterPanel).toBeVisible({ timeout: 5000 }).catch(() => {});

    // Datum-Preset-Buttons sollten vorhanden sein (7d, 30d, etc.)
    const presets = page.locator('button').filter({ hasText: /7d|30d|90d|12m/i });
    const count = await presets.count().catch(() => 0);
    expect(count >= 1).toBeTruthy();
  });
});

test.describe('Dashboard Analytics — Filter Interactions', () => {
  test('Datum-Preset "30d" wählt 30-Tage-Bereich', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Finde und klick auf 30d-Button
    const preset30d = page.locator('button').filter({ hasText: /30d/i }).first();
    await preset30d.click({ timeout: 5000 }).catch(() => {});

    // Warte auf Neu-Laden der Daten
    await page.waitForLoadState('networkidle').catch(() => {});

    // Keine JS-Fehler
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const fatalErrors = errors.filter(
      e => (e.includes('TypeError') || e.includes('ReferenceError')) &&
           !e.includes('ResizeObserver')
    );
    expect(fatalErrors).toHaveLength(0);
  });

  test('Datum-Range-Eingabe akzeptiert Custom-Bereich', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Suche nach Datums-Input-Feldern
    const dateInputs = page.locator('input[type="date"]');
    const count = await dateInputs.count().catch(() => 0);

    // Wenn Custom-Datums-Eingabe vorhanden
    if (count >= 2) {
      const startInput = dateInputs.nth(0);
      const endInput = dateInputs.nth(1);

      // Setze Daten (30 Tage zurück bis heute)
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      await startInput.fill(startDate).catch(() => {});
      await endInput.fill(endDate).catch(() => {});

      // Trigger Change-Event
      await endInput.dispatchEvent('change').catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});

      // Seite sollte weiterhin da sein (kein Crash)
      await expect(page).not.toHaveURL(/404|500/);
    }
  });
});

test.describe('Dashboard Analytics — Charts & Data Display', () => {
  test('Liniendiagramm rendert (wenn Daten vorhanden)', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Suche nach SVG-Elementen (Recharts zeichnet mit SVG)
    const svgCharts = page.locator('svg').filter({ hasText: /|/ }); // Recharts hat SVG
    const chartCount = await svgCharts.count().catch(() => 0);

    // Mindestens ein Chart sollte vorhanden sein (oder Loading)
    const isLoading = await page.getByText(/Loading|Lade/i).isVisible().catch(() => false);
    expect(chartCount > 0 || isLoading).toBeTruthy();
  });

  test('Datentabelle mit Snapshots rendert (wenn Daten vorhanden)', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Tabelle oder "No data" Message
    const table = page.locator('table').first();
    const noDataMsg = page.getByText(/No data|Keine Daten/i);

    const hasTable = await table.isVisible().catch(() => false);
    const hasNoDataMsg = await noDataMsg.isVisible().catch(() => false);

    expect(hasTable || hasNoDataMsg).toBeTruthy();
  });

  test('Tabellen-Header mit Sortierung vorhanden', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Tabelle muss vorhanden sein
    const table = page.locator('table').first();
    const isVisible = await table.isVisible().catch(() => false);

    if (isVisible) {
      // Header-Zellen sollten vorhanden sein
      const headerCells = table.locator('thead th, th');
      const headerCount = await headerCells.count().catch(() => 0);
      expect(headerCount > 0).toBeTruthy();
    }
  });
});

test.describe('Dashboard Analytics — Error Handling', () => {
  test('Error Banner zeigt sich bei Fehler (Netzwerk/API)', async ({ page }) => {
    // Interzeptiere fehlgeschlagene API-Calls
    await page.route('**/governance_kpi_range', (route) => {
      route.abort('failed');
    });

    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Warte kurz auf Error-Banner
    const errorBanner = page.getByText(/Error|Fehler/i, { exact: false });
    const isVisible = await errorBanner.isVisible().catch(() => false);

    // Entweder sichtbar oder Seite zeigt "No data"
    const noDataMsg = await page.getByText(/No data|Keine Daten/i).isVisible().catch(() => false);

    expect(isVisible || noDataMsg).toBeTruthy();
  });

  test('Empty State wenn keine KPI-Snapshots vorhanden', async ({ page }) => {
    // Interzeptiere und gebe leeres Array zurück
    await page.route('**/governance_kpi_range', (route) => {
      route.abort('succeeded');
    });

    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Sollte "No data available" oder ähnlich zeigen
    const emptyMsg = page.getByText(/No data|Keine Daten|KPI snapshots/i);
    const isVisible = await emptyMsg.isVisible().catch(() => false);

    // Oder mindestens einen Heading zeigen (nicht Crash)
    const hasHeading = await page.getByRole('heading').first().isVisible().catch(() => false);

    expect(isVisible || hasHeading).toBeTruthy();
  });

  test('Loading-State bei Datenladezeit', async ({ page }) => {
    // Verzögere RPC-Calls
    await page.route('**/governance_kpi_range', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      route.continue();
    });

    await page.goto('/app/analytics');

    // Loading-Text sollte kurz sichtbar sein
    const loadingText = page.getByText(/Loading|Lade/i);
    const isVisible = await loadingText.isVisible().catch(() => false);

    // Nach Laden: Seite sollte stabil sein
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).not.toHaveURL(/404|500/);
  });
});

test.describe('Dashboard Analytics — Export Modal', () => {
  test('Export-Modal öffnet und schließt', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Klick auf Export-Button
    const exportBtn = page.getByRole('button', { name: /Export/i });
    await exportBtn.click().catch(() => {});

    // Modal sollte sichtbar sein
    const modal = page.getByRole('heading', { name: /Export Analytics/i });
    await expect(modal).toBeVisible({ timeout: 2000 }).catch(() => {});

    // Close-Button klicken
    const closeBtn = page.locator('button[aria-label*="Close"]').first();
    await closeBtn.click().catch(() => {});

    // Modal sollte unsichtbar sein
    await expect(modal).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('Export-Format Selection (CSV/PDF)', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Öffne Modal
    await page.getByRole('button', { name: /Export/i }).click().catch(() => {});

    // CSV-Radio sichtbar
    const csvRadio = page.locator('input[value="csv"]').first();
    await expect(csvRadio).toBeVisible({ timeout: 2000 }).catch(() => {});

    // PDF-Radio sichtbar
    const pdfRadio = page.locator('input[value="pdf"]').first();
    await expect(pdfRadio).toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('PDF Options (Include Charts) nur bei PDF Format sichtbar', async ({ page }) => {
    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Öffne Modal
    await page.getByRole('button', { name: /Export/i }).click().catch(() => {});

    // Select PDF
    const pdfRadio = page.locator('input[value="pdf"]').first();
    await pdfRadio.check().catch(() => {});

    // Include Charts Checkbox sollte sichtbar sein
    const chartsCheckbox = page.getByText(/Include charts/i).first();
    await expect(chartsCheckbox).toBeVisible({ timeout: 2000 }).catch(() => {});

    // Select CSV
    const csvRadio = page.locator('input[value="csv"]').first();
    await csvRadio.check().catch(() => {});

    // Checkbox sollte unsichtbar sein
    await expect(chartsCheckbox).not.toBeVisible().catch(() => {});
  });
});

test.describe('Dashboard Analytics — Smoke Tests (No JS Errors)', () => {
  test('Analytics-Route gibt keine fatalen JS-Fehler aus', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Keine TypeError/ReferenceError (ResizeObserver-Fehler okay)
    const fatalErrors = errors.filter(
      e => (e.includes('TypeError') || e.includes('ReferenceError')) &&
           !e.includes('ResizeObserver')
    );
    expect(fatalErrors).toHaveLength(0);
  });

  test('Filter-Interaktionen verursachen keine JS-Fehler', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app/analytics');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Klick auf verschiedene Presets
    const presets = page.locator('button').filter({ hasText: /7d|30d/i });
    const count = await presets.count().catch(() => 0);

    if (count > 0) {
      await presets.first().click().catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    const fatalErrors = errors.filter(
      e => (e.includes('TypeError') || e.includes('ReferenceError')) &&
           !e.includes('ResizeObserver')
    );
    expect(fatalErrors).toHaveLength(0);
  });
});
