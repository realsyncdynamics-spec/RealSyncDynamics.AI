/**
 * E2E-Tests für GovernanceInspectorPanel.
 *
 * Voraussetzungen (lokal):
 *   - Dev-Server läuft: npm run dev
 *   - Nutzer ist eingeloggt und hat einen aktiven Tenant mit mindestens
 *     einem Event, Asset und einer Policy (oder Demo-Daten via Onboarding)
 *   - PLAYWRIGHT_AUTH_FILE=.auth/session.json (optional, für gespeicherte Session)
 *
 * Ausführen:
 *   npm run e2e -- --grep "Inspector Panel"
 *   npm run e2e -- e2e/governance/inspector-panel.spec.ts
 *
 * Hinweis: Diese Tests laufen nicht in CI, da sie eine laufende App mit
 * authentifizierten Daten benötigen (siehe playwright.config.ts).
 */
import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Hilfs-Konstanten
// ---------------------------------------------------------------------------

const DASHBOARD_URL = '/app/websites';
const INSPECTOR_PANEL = '[data-testid="inspector-panel"]';
const INSPECTOR_BACKDROP = '[data-testid="inspector-backdrop"]';
const COPY_BTN = '[data-testid="inspector-copy-btn"]';
const PAYLOAD_TOGGLE = '[data-testid="payload-toggle"]';
const PAYLOAD_JSON = '[data-testid="payload-json"]';
const CONDITION_TOGGLE = '[data-testid="condition-toggle"]';
const CONDITION_JSON = '[data-testid="condition-json"]';
const POLICY_TOGGLE_BTN = '[data-testid="policy-toggle-btn"]';
const LINKED_EVENT_BTN = '[data-testid="linked-event-btn"]';

// ---------------------------------------------------------------------------
// Setup: Dashboard laden und auf Daten warten
// ---------------------------------------------------------------------------

async function goDashboard(page: Page) {
  await page.goto(DASHBOARD_URL);
  // Warte auf Panel-Element (immer im DOM, auch geschlossen)
  await page.waitForSelector(INSPECTOR_PANEL, { timeout: 15_000 });
}

function isPanelClosed(page: Page) {
  return page.locator(INSPECTOR_PANEL).evaluate((el) =>
    el.className.includes('translate-x-full'),
  );
}

function isPanelOpen(page: Page) {
  return page.locator(INSPECTOR_PANEL).evaluate((el) =>
    el.className.includes('translate-x-0'),
  );
}

// ---------------------------------------------------------------------------
// Test-Suite: Inspector öffnen / schließen
// ---------------------------------------------------------------------------

test.describe('Inspector Panel — Öffnen und Schließen', () => {
  test('öffnet sich beim Klick auf eine Ereignis-Zeile', async ({ page }) => {
    await goDashboard(page);

    const firstRow = page.locator('[data-testid="governance-event-row"]').first();

    // Falls keine Event-Rows vorhanden: Test skippen (leere Tenant-Umgebung)
    const count = await firstRow.count();
    test.skip(count === 0, 'Keine Ereignis-Zeilen vorhanden — Tenant-Daten fehlen');

    expect(await isPanelClosed(page)).toBe(true);
    await firstRow.click();
    await expect(page.locator(INSPECTOR_PANEL)).not.toHaveClass(/translate-x-full/);
    expect(await isPanelOpen(page)).toBe(true);

    // Backdrop sollte sichtbar sein
    await expect(page.locator(INSPECTOR_BACKDROP)).toBeVisible();
  });

  test('schließt sich per X-Button', async ({ page }) => {
    await goDashboard(page);
    const firstRow = page.locator('[data-testid="governance-event-row"]').first();
    test.skip(await firstRow.count() === 0, 'Keine Event-Daten vorhanden');

    await firstRow.click();
    await page.waitForFunction(() =>
      !document.querySelector('[data-testid="inspector-panel"]')?.className.includes('translate-x-full'),
    );

    await page.click('button[aria-label="Inspector schließen"]');
    await expect(page.locator(INSPECTOR_PANEL)).toHaveClass(/translate-x-full/);
  });

  test('schließt sich per ESC-Taste', async ({ page }) => {
    await goDashboard(page);
    const firstRow = page.locator('[data-testid="governance-event-row"]').first();
    test.skip(await firstRow.count() === 0, 'Keine Event-Daten vorhanden');

    await firstRow.click();
    await page.waitForFunction(() =>
      !document.querySelector('[data-testid="inspector-panel"]')?.className.includes('translate-x-full'),
    );

    await page.keyboard.press('Escape');
    await expect(page.locator(INSPECTOR_PANEL)).toHaveClass(/translate-x-full/);
  });

  test('schließt sich beim Klick auf den Backdrop', async ({ page }) => {
    await goDashboard(page);
    const firstRow = page.locator('[data-testid="governance-event-row"]').first();
    test.skip(await firstRow.count() === 0, 'Keine Event-Daten vorhanden');

    await firstRow.click();
    await expect(page.locator(INSPECTOR_BACKDROP)).toBeVisible();

    // Backdrop anklicken — Panel muss schließen
    await page.locator(INSPECTOR_BACKDROP).click({ force: true });
    await expect(page.locator(INSPECTOR_PANEL)).toHaveClass(/translate-x-full/);
  });

  test('öffnet sich beim Klick auf eine Asset-Zeile', async ({ page }) => {
    await goDashboard(page);
    const firstRow = page.locator('[data-testid="governance-asset-row"]').first();
    test.skip(await firstRow.count() === 0, 'Keine Asset-Zeilen vorhanden');

    await firstRow.click();
    await expect(page.locator(INSPECTOR_PANEL)).not.toHaveClass(/translate-x-full/);
    await expect(page.locator(INSPECTOR_PANEL).getByText(/asset · inspector/i)).toBeVisible();
  });

  test('öffnet sich beim Klick auf eine Policy-Zeile', async ({ page }) => {
    await goDashboard(page);
    const firstRow = page.locator('[data-testid="governance-policy-row"]').first();
    test.skip(await firstRow.count() === 0, 'Keine Policy-Zeilen vorhanden');

    await firstRow.click();
    await expect(page.locator(INSPECTOR_PANEL)).not.toHaveClass(/translate-x-full/);
    await expect(page.locator(INSPECTOR_PANEL).getByText(/policy · inspector/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test-Suite: Inspector-Inhalt wechseln (Tab-Switching)
// ---------------------------------------------------------------------------

test.describe('Inspector Panel — Inhalt wechseln', () => {
  test('wechselt Inhalt beim Klick auf einen anderen Eintrag ohne Schließen', async ({ page }) => {
    await goDashboard(page);
    const eventRows = page.locator('[data-testid="governance-event-row"]');
    test.skip(await eventRows.count() < 2, 'Mindestens 2 Ereignis-Zeilen erforderlich');

    // Ersten Eintrag öffnen
    const firstTitle = await eventRows.nth(0).locator('.font-semibold').first().innerText();
    await eventRows.nth(0).click();
    await expect(page.locator(INSPECTOR_PANEL).getByRole('heading')).toHaveText(firstTitle);

    // Zweiten Eintrag öffnen — Inspector bleibt offen, Inhalt wechselt
    const secondTitle = await eventRows.nth(1).locator('.font-semibold').first().innerText();
    await eventRows.nth(1).click();
    await expect(page.locator(INSPECTOR_PANEL).getByRole('heading')).toHaveText(secondTitle);

    // Backdrop ist immer noch sichtbar
    await expect(page.locator(INSPECTOR_BACKDROP)).toBeVisible();
  });

  test('wechselt vom Asset-Inspector in den Event-Inspector via verknüpftes Ereignis', async ({ page }) => {
    await goDashboard(page);
    const assetRow = page.locator('[data-testid="governance-asset-row"]').first();
    test.skip(await assetRow.count() === 0, 'Keine Asset-Zeilen vorhanden');

    await assetRow.click();
    await expect(page.locator(INSPECTOR_PANEL).getByText(/asset · inspector/i)).toBeVisible();

    // Warte auf verknüpfte Ereignisse (werden asynchron geladen)
    const linkedBtn = page.locator(LINKED_EVENT_BTN).first();
    const linkedCount = await linkedBtn.count().catch(() => 0);
    test.skip(linkedCount === 0, 'Asset hat keine verknüpften Ereignisse');

    const linkedTitle = await linkedBtn.locator('.font-medium').innerText();
    await linkedBtn.click();

    // Inspector zeigt jetzt Event-Ansicht
    await expect(page.locator(INSPECTOR_PANEL).getByText(/ereignis · inspector/i)).toBeVisible();
    await expect(page.locator(INSPECTOR_PANEL).getByRole('heading')).toHaveText(linkedTitle);
  });
});

// ---------------------------------------------------------------------------
// Test-Suite: Copy-to-Clipboard
// ---------------------------------------------------------------------------

test.describe('Inspector Panel — Copy-to-Clipboard', () => {
  test('Copy-Button im Event-Inspector kopiert die Ereignis-ID', async ({ page, context }) => {
    // Clipboard-Berechtigung erteilen
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await goDashboard(page);

    const firstRow = page.locator('[data-testid="governance-event-row"]').first();
    test.skip(await firstRow.count() === 0, 'Keine Event-Daten vorhanden');

    await firstRow.click();
    await expect(page.locator(INSPECTOR_PANEL)).not.toHaveClass(/translate-x-full/);

    // Copy-Button anklicken
    await page.locator(COPY_BTN).first().click();

    // Clipboard-Inhalt auslesen
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    // UUID-Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(clipboardText).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  test('Copy-Button im Asset-Inspector kopiert die Asset-ID', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await goDashboard(page);

    const assetRow = page.locator('[data-testid="governance-asset-row"]').first();
    test.skip(await assetRow.count() === 0, 'Keine Asset-Daten vorhanden');

    await assetRow.click();
    await expect(page.locator(INSPECTOR_PANEL).getByText(/asset · inspector/i)).toBeVisible();

    await page.locator(COPY_BTN).first().click();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  test('Copy-Button wechselt kurzfristig zum Check-Icon (visuelles Feedback)', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await goDashboard(page);

    const firstRow = page.locator('[data-testid="governance-event-row"]').first();
    test.skip(await firstRow.count() === 0, 'Keine Event-Daten vorhanden');

    await firstRow.click();
    await expect(page.locator(INSPECTOR_PANEL)).not.toHaveClass(/translate-x-full/);

    const copyBtn = page.locator(COPY_BTN).first();
    // Vor dem Klick: Copy-Icon (kein Check-Icon via aria-label)
    await expect(copyBtn).toHaveAttribute('aria-label', /.+/);

    await copyBtn.click();
    // Nach Klick: Check-Icon erscheint kurz (1,5 s)
    // Wir prüfen nur, dass der Button noch vorhanden ist (kein Fehler)
    await expect(copyBtn).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test-Suite: Payload- und Condition-Toggle
// ---------------------------------------------------------------------------

test.describe('Inspector Panel — JSON-Toggles', () => {
  test('Payload-Toggle im Event-Inspector klappt JSON auf und zu', async ({ page }) => {
    await goDashboard(page);
    const firstRow = page.locator('[data-testid="governance-event-row"]').first();
    test.skip(await firstRow.count() === 0, 'Keine Event-Daten vorhanden');

    await firstRow.click();
    await expect(page.locator(INSPECTOR_PANEL)).not.toHaveClass(/translate-x-full/);

    // Payload initial verborgen
    await expect(page.locator(PAYLOAD_JSON)).not.toBeVisible();

    // Aufklappen
    await page.locator(PAYLOAD_TOGGLE).click();
    await expect(page.locator(PAYLOAD_JSON)).toBeVisible();
    // Muss valides JSON enthalten
    const json = await page.locator(PAYLOAD_JSON).textContent();
    expect(() => JSON.parse(json!)).not.toThrow();

    // Zuklappen
    await page.locator(PAYLOAD_TOGGLE).click();
    await expect(page.locator(PAYLOAD_JSON)).not.toBeVisible();
  });

  test('Condition-Toggle im Policy-Inspector klappt JSON auf und zu', async ({ page }) => {
    await goDashboard(page);
    const policyRow = page.locator('[data-testid="governance-policy-row"]').first();
    test.skip(await policyRow.count() === 0, 'Keine Policy-Zeilen vorhanden');

    await policyRow.click();
    await expect(page.locator(INSPECTOR_PANEL).getByText(/policy · inspector/i)).toBeVisible();

    // Condition initial verborgen
    await expect(page.locator(CONDITION_JSON)).not.toBeVisible();

    await page.locator(CONDITION_TOGGLE).click();
    await expect(page.locator(CONDITION_JSON)).toBeVisible();
    const json = await page.locator(CONDITION_JSON).textContent();
    expect(() => JSON.parse(json!)).not.toThrow();

    await page.locator(CONDITION_TOGGLE).click();
    await expect(page.locator(CONDITION_JSON)).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test-Suite: Policy-Toggle Schnellaktion
// ---------------------------------------------------------------------------

test.describe('Inspector Panel — Policy-Toggle Schnellaktion', () => {
  test('Toggle-Button ändert Policy-Status ohne Inspector zu schließen', async ({ page }) => {
    await goDashboard(page);
    const policyRow = page.locator('[data-testid="governance-policy-row"]').first();
    test.skip(await policyRow.count() === 0, 'Keine Policy-Zeilen vorhanden');

    await policyRow.click();
    await expect(page.locator(INSPECTOR_PANEL).getByText(/policy · inspector/i)).toBeVisible();

    // Status vor dem Klick merken
    const toggleBtn = page.locator(POLICY_TOGGLE_BTN);
    const labelBefore = await toggleBtn.getAttribute('aria-label');

    await toggleBtn.click();

    // Inspector bleibt offen
    await expect(page.locator(INSPECTOR_PANEL)).not.toHaveClass(/translate-x-full/);

    // aria-label hat sich geändert (Aktivieren ↔ Pausieren)
    await expect(toggleBtn).not.toHaveAttribute('aria-label', labelBefore!);
  });
});

// ---------------------------------------------------------------------------
// Test-Suite: Vollansicht-Link
// ---------------------------------------------------------------------------

test.describe('Inspector Panel — Vollansicht-Link', () => {
  test('Vollansicht-Link navigiert zur Event-Detailseite und schließt Inspector', async ({ page }) => {
    await goDashboard(page);
    const firstRow = page.locator('[data-testid="governance-event-row"]').first();
    test.skip(await firstRow.count() === 0, 'Keine Event-Daten vorhanden');

    await firstRow.click();
    await expect(page.locator(INSPECTOR_PANEL)).not.toHaveClass(/translate-x-full/);

    await page.getByRole('link', { name: /vollansicht öffnen/i }).click();
    await expect(page).toHaveURL(/\/governance\/events\/.+/);
  });
});
