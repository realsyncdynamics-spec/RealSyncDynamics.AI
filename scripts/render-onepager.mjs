/**
 * Rendert den Vertriebs-/Feature-Onepager (docs/sales/onepager.html) nach PDF (A4).
 *
 * Nutzung:
 *   node scripts/render-onepager.mjs [input.html] [output.pdf]
 *
 * Standard: docs/sales/onepager.html -> docs/sales/RealSyncDynamics-Onepager.pdf
 *
 * Nutzt das vorinstallierte Chromium (Playwright). In CI/lokal ohne globalen
 * Chromium-Pfad wird PLAYWRIGHT_BROWSERS_PATH respektiert; optional kann
 * CHROMIUM_EXECUTABLE_PATH gesetzt werden.
 */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2] ?? path.join(root, 'docs/sales/onepager.html');
const output = process.argv[3] ?? path.join(root, 'docs/sales/RealSyncDynamics-Onepager.pdf');

const launchOpts = {};
if (process.env.CHROMIUM_EXECUTABLE_PATH) {
  launchOpts.executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
}

const browser = await chromium.launch(launchOpts);
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(input).href, { waitUntil: 'networkidle' });
  await page.pdf({
    path: output,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  console.log(`Onepager gerendert: ${output}`);
} finally {
  await browser.close();
}
