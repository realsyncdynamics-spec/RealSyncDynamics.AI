import { test, expect } from '@playwright/test';

test('COSMOS opens the geographic building-import view without invented city geometry', async ({ page }) => {
  await page.goto('/cosmos');
  await page.getByRole('button', { name: 'Erde geografisch erkunden' }).click();
  await page.getByRole('button', { name: '3D-Gebäude aus GeoJSON' }).click();
  await expect(page.getByRole('heading', { name: 'Geografische 3D-Gebäude' })).toBeVisible();
  await expect(page.getByText('Noch keine Gebäudedaten geladen.')).toBeVisible();

  const geojson = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { height: 12, name: 'Validiertes Testpolygon' },
      geometry: { type: 'Polygon', coordinates: [[
        [13.404, 52.52], [13.4041, 52.52],
        [13.4041, 52.5201], [13.404, 52.5201],
        [13.404, 52.52],
      ]] },
    }],
  };
  await page.locator('input[type="file"]').setInputFiles({
    name: 'local-test-only.geojson',
    mimeType: 'application/geo+json',
    buffer: Buffer.from(JSON.stringify(geojson)),
  });
  await expect(page.getByText('1 Gebäudegrundrisse')).toBeVisible();
  await expect(page.getByText('0 Gebäudehöhen sind geschätzt.')).toBeVisible();
  await expect(page.getByText('Datenquelle und Nutzungsrechte der Datei nicht verifiziert.', {
    exact: false,
  })).toBeVisible();

  await page.getByRole('button', { name: 'Weltkugel' }).click();
  await expect(page.getByRole('heading', { name: 'Erde erkunden' })).toBeVisible();
});
