import { test, expect } from '@playwright/test';

const originalBodies = [
  'sun', 'mercury', 'venus', 'moon', 'mars',
  'jupiter', 'saturn', 'uranus', 'neptune',
] as const;

test('COSMOS allows original, self-hosted planet textures and a 60–180% scale', async ({ page }) => {
  const externalTextureRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('cdn.jsdelivr.net/gh/Sanghel/solar-system-3d')) {
      externalTextureRequests.push(request.url());
    }
  });

  await page.goto('/cosmos');
  await expect(page.getByRole('heading', { name: 'COSMOS Explorer' })).toBeVisible();
  await expect(page.getByText('Visuelle Planetengröße: 100 %')).toBeVisible();

  const originals = page.getByRole('checkbox', {
    name: /Original-Planetentexturen anzeigen/,
  });
  await expect(originals).toBeChecked();

  const slider = page.getByRole('slider', { name: 'Planetengröße skalieren' });
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Visuelle Planetengröße: 105 %')).toBeVisible();

  await originals.uncheck();
  await expect(originals).not.toBeChecked();
  await originals.check();
  await expect(originals).toBeChecked();

  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await expect(page.getByText('Visuelle Planetengröße: 100 %')).toBeVisible();
  await expect(originals).toBeChecked();

  expect(externalTextureRequests, 'the planets must never contact the original third-party CDN')
    .toHaveLength(0);
});

test('all nine original planetary assets are available as real local 2:1 maps', async ({ page, request }) => {
  await page.goto('/cosmos');
  for (const body of originalBodies) {
    const path = `/textures/cosmos/${body}.jpg`;
    const response = await request.get(path);
    expect(response.status(), `HTTP status for ${path}`).toBe(200);
    expect(response.headers()['content-type'], `MIME for ${path}`).toMatch(/image\/jpeg/i);
    expect((await response.body()).byteLength, `file size for ${path}`)
      .toBeGreaterThan(20_000);
  }

  const details = await page.evaluate(async (ids: string[]) => Promise.all(ids.map(async (id) => {
    const image = new Image();
    image.src = `/textures/cosmos/${id}.jpg`;
    await image.decode();
    return { id, width: image.naturalWidth, height: image.naturalHeight };
  })), [...originalBodies]);

  for (const { id, width, height } of details) {
    expect(width, `map width for ${id}`).toBeGreaterThanOrEqual(1000);
    expect(height, `map height for ${id}`).toBeGreaterThanOrEqual(500);
    expect(width / height, `equirectangular 2:1 projection for ${id}`).toBeCloseTo(2, 1);
  }
});
