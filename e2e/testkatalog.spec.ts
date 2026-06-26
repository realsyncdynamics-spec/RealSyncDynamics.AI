import { test, expect } from '@playwright/test';

/**
 * Testkatalog – RealSyncDynamics.AI
 * ──────────────────────────────────────────────────────────────────────────
 * Automatisierte E2E-Abdeckung des manuellen Testkatalogs (FE/GOV/BE/CO/
 * MAIL/SEC). Jeder Test trägt die Katalog-ID im Titel, damit die Traceability
 * zur Spezifikation erhalten bleibt.
 *
 * WICHTIG – Lauf gegen den lokalen Dev/Preview-Server (playwright.config.ts:
 * baseURL = http://localhost:3000), NICHT gegen die Live-Domain. Routen des
 * Katalogs sind hier auf die tatsächlichen App-Routen gemappt:
 *
 *   Katalog                  →  App-Route (src/App.tsx)
 *   /ai-act/                 →  /ai-act        (AiActPage)
 *   /oeffentliche-verwaltung/→  /oeffentliche-verwaltung (PublicSectorLanding)
 *   /checkout/starter/       →  /checkout/starter (CheckoutPage, :planKey)
 *
 * Backend-/Stripe-/Mail-abhängige Katalog-Fälle (echtes Scan-Ergebnis,
 * Stripe-Zahlung, E-Mail-Zustellung) lassen sich ohne gemockte Edge-Functions
 * und Stripe-Testmodus nicht deterministisch in CI prüfen. Diese sind als
 * `test.skip` mit Begründung markiert, damit die ID dokumentiert bleibt und
 * der Grund nachvollziehbar ist — statt rote, flakige Netz-Tests zu erzeugen.
 */

// Alle öffentlichen Einstiege aus dem Katalog (auf reale Routen gemappt).
const PUBLIC_ROUTES = [
  '/',
  '/audit',
  '/ai-act',
  '/oeffentliche-verwaltung',
  '/healthtech',
  '/saas-anbieter',
  '/checkout/starter',
] as const;

// ───────────────────────────────────────────────────────────────────────────
// FE – Frontend / Routing / Navigation
// ───────────────────────────────────────────────────────────────────────────
test.describe('FE – Routing & Navigation', () => {
  test('FE-001: Startseite lädt ohne 404/500 und zeigt Audit- + Preis-Einstiege', async ({ page }) => {
    await page.goto('/');

    // Hero-Headline der Unternehmenshauptseite (MainLanding).
    await expect(
      page.getByRole('heading', { level: 1, name: /Betriebssystem für/i }),
    ).toBeVisible();

    // Governance-/Audit-Einstieg + Preis-Einstieg sind erreichbar.
    await expect(
      page.getByRole('link', { name: /Kostenloses Audit starten/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Preise, die mit Ihrer Verantwortung skalieren/i }),
    ).toBeVisible();
  });

  test('FE-002: Primärer Audit-CTA navigiert auf /audit', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Kostenloses Audit starten/i }).first().click();
    await expect(page).toHaveURL(/\/audit/);
    await expect(
      page.getByRole('heading', { level: 1, name: /Kostenloser DSGVO- und Tracking-Audit/i }),
    ).toBeVisible();
  });

  test('FE-003: Deep-Links laden direkt (kein 404/White-Screen)', async ({ page }) => {
    const expectedHeadings: Record<string, RegExp> = {
      '/audit': /Kostenloser DSGVO- und Tracking-Audit/i,
      '/ai-act': /AI Act compliance without a consulting engagement/i,
      '/oeffentliche-verwaltung': /KI in der öffentlichen Verwaltung/i,
      '/healthtech': /KI in HealthTech/i,
      '/saas-anbieter': /DSGVO für B2B-SaaS/i,
    };

    for (const [route, heading] of Object.entries(expectedHeadings)) {
      const resp = await page.goto(route);
      // SPA liefert 200 für den index; nie 404/500 vom Server.
      expect(resp?.status(), `HTTP-Status für ${route}`).toBeLessThan(400);
      await expect(
        page.getByRole('heading', { name: heading }).first(),
        `Hero-Heading für ${route}`,
      ).toBeVisible();
    }
  });

  test('FE-004: Footer-Rechtslinks (Impressum, Datenschutz) erreichbar', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');

    // Footer enthält die Rechtslinks mehrfach (Spalte + Legal-Nav) — .first().
    const impressum = footer.getByRole('link', { name: /^Impressum$/i }).first();
    await expect(impressum).toBeVisible();
    await expect(impressum).toHaveAttribute('href', /\/impressum$/);

    const datenschutz = footer.getByRole('link', { name: /^Datenschutz$/i }).first();
    await expect(datenschutz).toBeVisible();
    await expect(datenschutz).toHaveAttribute('href', /\/datenschutz$/);

    // Klick führt auf die Rechtstextseite (Datenschutzerklärung).
    await datenschutz.click();
    await expect(page).toHaveURL(/\/datenschutz/);
    await expect(page.getByText(/Datenschutzerklärung/i).first()).toBeVisible();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// GOV – Governance: DSGVO-Audit + EU-AI-Act
// ───────────────────────────────────────────────────────────────────────────
test.describe('GOV – DSGVO-Audit', () => {
  test('GOV-001: Audit-Einstieg rendert Scan-Eingabe (Chat + klassisches Formular)', async ({ page }) => {
    await page.goto('/audit');

    // Default: Chat-Hero. Umschalt-Link auf das klassische Formular existiert.
    const toForm = page.getByRole('button', { name: /klassische Formular/i });
    await expect(toForm).toBeVisible();
    await toForm.click();

    // Klassisches Formular: Pflichtfelder URL + E-Mail und Scan-Trigger.
    await expect(page.getByText(/Deine Website-URL/i)).toBeVisible();
    await expect(page.getByText(/E-Mail \(für Report-Zustellung\)/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Jetzt prüfen/i })).toBeVisible();
  });

  test('GOV-002: Audit benennt Tracking-/Consent-Prüfung als Scan-Inhalt', async ({ page }) => {
    // Ohne gemocktes gdpr-audit-Backend kein echtes Tracker-Finding prüfbar.
    // Deterministisch prüfbar: die Audit-Seite stellt Tracking-/Consent-Checks
    // als Leistungsumfang dar (Tracking-Audit-Headline).
    await page.goto('/audit');
    await expect(
      page.getByRole('heading', { name: /Tracking-Audit/i }).first(),
    ).toBeVisible();
  });

  test.skip('GOV-003: Report-Export herunterladbar — benötigt gdpr-audit-Backend (Edge Function) + abgeschlossenen Scan, nicht in CI mockbar', () => {});
});

test.describe('GOV – EU-AI-Act', () => {
  test('GOV-004: AI-Act-Seite stellt Risikoklassen-Hierarchie dar', async ({ page }) => {
    await page.goto('/ai-act');

    await expect(
      page.getByRole('heading', { level: 1, name: /AI Act compliance without a consulting engagement/i }),
    ).toBeVisible();

    // Risiko-Klassifikation (minimal / limited / high / prohibited) ist die
    // im EU-AI-Act vorgegebene Pflichtenhierarchie.
    await expect(
      page.getByText(/minimal \/ limited \/ high \/ prohibited/i),
    ).toBeVisible();
  });

  test('GOV-005: Oversight- und Policy-Hinweise bei höherem Risiko sichtbar', async ({ page }) => {
    await page.goto('/ai-act');
    // AgentOversightSection + PolicyEngineSection dokumentieren Oversight,
    // Freigaben und Policy-Pflichten.
    await expect(page.getByText(/Oversight/i).first()).toBeVisible();
    await expect(page.getByText(/menschlicher Freigabe/i)).toBeVisible();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// BE – Backend / Persistenz / Fehlerbehandlung
// ───────────────────────────────────────────────────────────────────────────
test.describe('BE – Backend', () => {
  test.skip('BE-001: Persistenz nach Reload/Re-Login — benötigt authentifizierte Session + Audit-Ergebnis im Backend, nicht in CI prüfbar', () => {});

  test('BE-002: Ungültige Eingabe erzeugt valide Reaktion ohne White-Screen/500', async ({ page }) => {
    // a) Audit-Formular: Submit ist client-seitig gesperrt, solange Pflicht-
    //    felder leer sind (kein 500-Leak durch Leersenden).
    await page.goto('/audit');
    await page.getByRole('button', { name: /klassische Formular/i }).click();
    await expect(page.getByRole('button', { name: /Jetzt prüfen/i })).toBeDisabled();

    // b) Unbekannte Route → NotFound-Seite (nicht 500/leer).
    await page.goto('/diese-route-gibt-es-nicht-xyz');
    await expect(
      page.getByRole('heading', { name: /Seite nicht gefunden/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Zur Startseite/i })).toBeVisible();

    // c) Unbekannter Checkout-Plan → klare Fehlermeldung statt White-Screen.
    await page.goto('/checkout/nicht-existent');
    await expect(page.getByText(/Unbekanntes Paket/i)).toBeVisible();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CO – Checkout
// ───────────────────────────────────────────────────────────────────────────
test.describe('CO – Checkout', () => {
  test('CO-001: /checkout/starter zeigt Login-Hinweis + Rückkehr in den Checkout', async ({ page }) => {
    await page.goto('/checkout/starter');

    // Ohne Session: no_user-Shell mit Login-Aufforderung für den Starter-Plan.
    await expect(
      page.getByRole('heading', { name: /Anmelden, um Starter zu buchen/i }),
    ).toBeVisible();
    // Klarer Rückkehr-Hinweis: nach Login automatisch zurück in den Checkout.
    await expect(
      page.getByText(/sofort wieder hier — der Checkout startet automatisch/i),
    ).toBeVisible();
  });

  test('CO-002: Preislogik konsistent — Starter 79 € auf /pricing, Planname im Checkout', async ({ page }) => {
    // Öffentlicher Preis.
    await page.goto('/pricing');
    await expect(page.getByText('Starter', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/79\s*€/).first()).toBeVisible();

    // Gleicher Plan-Schlüssel im Checkout (Planname „Starter").
    await page.goto('/checkout/starter');
    await expect(
      page.getByRole('heading', { name: /Anmelden, um Starter zu buchen/i }),
    ).toBeVisible();
  });

  test.skip('CO-003: Erfolgreiche Stripe-Zahlung — benötigt Stripe-Testmodus + create-checkout-session Edge Function, nicht in CI ausführbar', () => {});

  test.skip('CO-004: Abgelehnte Karte — benötigt Stripe-Testmodus (Decline-Karte), nicht in CI ausführbar', () => {});

  test('CO-005: Abbruchfluss landet sauber auf /checkout/cancelled', async ({ page }) => {
    // Stripe ruft nach Abbruch die cancel-URL auf; der Screen ist deterministisch.
    const resp = await page.goto('/checkout/cancelled');
    expect(resp?.status()).toBeLessThan(400);
    await expect(
      page.getByRole('heading', { name: /Checkout abgebrochen/i }),
    ).toBeVisible();
    // Sauberer Rückkehrpfad: zurück zu Preisen / Audit, keine Doppelbuchung.
    await expect(page.getByRole('link', { name: /Preise|Pricing/i }).first()).toBeVisible();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// MAIL – E-Mail-Auslöser
// ───────────────────────────────────────────────────────────────────────────
test.describe('MAIL – E-Mail', () => {
  test.skip('MAIL-001: Audit-Report-Mail — benötigt Resend-Versand + abgeschlossenen Scan, Zustellung nicht in CI prüfbar', () => {});
  test.skip('MAIL-002: Checkout-Bestätigungsmail — benötigt Stripe-Webhook + Resend-Versand, Zustellung nicht in CI prüfbar', () => {});
});

// ───────────────────────────────────────────────────────────────────────────
// SEC – Datenschutz / Recht / EU-AI-Act-Nachweise
// ───────────────────────────────────────────────────────────────────────────
test.describe('SEC – Datenschutz & Recht', () => {
  test('SEC-001: Consent-Banner zeigt Ablehnen gleichwertig auf erster Ebene', async ({ page, context }) => {
    // DSGVO Art. 7 III / TTDSG §25: „Ablehnen" muss ohne Mehr-Klick erreichbar
    // sein, bevor nicht-essenzielle Tracker feuern dürfen.
    await context.clearCookies();
    await page.goto('/');
    await expect(page.getByTestId('consent-reject-all')).toBeVisible();
    await expect(page.getByTestId('consent-accept-all')).toBeVisible();
  });

  test('SEC-002: Rechtstexte (Impressum, Datenschutz) sind erreichbar und konsistent verlinkt', async ({ page }) => {
    // Impressum hat ein semantisches <h1>Impressum; die Datenschutzerklärung
    // rendert ihren Titel als Marken-Header — geprüft wird der jeweils stabile
    // Inhalt plus HTTP < 400 (kein 404/500-Leak).
    const routes: Array<{ path: string; assert: (p: typeof page) => Promise<void> }> = [
      { path: '/impressum', assert: (p) => expect(p.getByRole('heading', { level: 1, name: /^Impressum$/i })).toBeVisible() },
      { path: '/legal/impressum', assert: (p) => expect(p.getByRole('heading', { level: 1, name: /^Impressum$/i })).toBeVisible() },
      { path: '/datenschutz', assert: (p) => expect(p.getByText(/Datenschutzerklärung/i).first()).toBeVisible() },
      { path: '/legal/datenschutz', assert: (p) => expect(p.getByText(/Datenschutzerklärung/i).first()).toBeVisible() },
    ];
    for (const { path, assert } of routes) {
      const resp = await page.goto(path);
      expect(resp?.status(), `HTTP-Status für ${path}`).toBeLessThan(400);
      await assert(page);
    }
  });

  test('SEC-003: EU-AI-Act-Pflichten werden risikobasiert dargestellt', async ({ page }) => {
    await page.goto('/ai-act');
    // Risikobasierte Klassifikation + menschliche Freigabe + Evidence-Chain
    // als nachvollziehbare Pflicht-Darstellung.
    await expect(
      page.getByText(/minimal \/ limited \/ high \/ prohibited/i),
    ).toBeVisible();
    await expect(page.getByText(/Evidence-Chain/i)).toBeVisible();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Sammelprüfung: keiner der öffentlichen Einstiege wirft einen Server-Fehler.
// ───────────────────────────────────────────────────────────────────────────
test('Smoke: alle öffentlichen Katalog-Routen liefern < 400', async ({ page }) => {
  for (const route of PUBLIC_ROUTES) {
    const resp = await page.goto(route);
    expect(resp?.status(), `HTTP-Status für ${route}`).toBeLessThan(400);
  }
});
