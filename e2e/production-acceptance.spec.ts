import { test, expect, type Page, type Response } from '@playwright/test';

/**
 * Produktions-Akzeptanztest — der Kundenpfad im echten Browser.
 *
 * Anlass (2026-08-30): Ein manueller End-to-End-Durchlauf gegen
 * `realsyncdynamicsai.de` hat drei Fehler gefunden, die weder Unit- noch
 * Integrationstests je sehen konnten, weil sie erst im ausgelieferten
 * Zusammenspiel aus SPA, CSP, Edge Function und Secret entstehen:
 *
 *   1. `gdpr-audit` antwortet auf JEDEN Aufruf mit HTTP 500
 *      (`ReferenceError`, sechs Hilfsfunktionen fehlen) — der kostenlose
 *      Audit, der wichtigste CTA der Startseite, ist tot.
 *   2. `track-pageview` antwortet auf JEDEM Seitenaufruf mit HTTP 500,
 *      weil `PAGEVIEW_HASH_SALT` in der Produktionsumgebung fehlt.
 *   3. Die CSP erlaubt `static.cloudflareinsights.com` nicht, wodurch auch
 *      der zweite Analytics-Weg stumm bleibt.
 *
 * Gemeinsamer Nenner: Alle drei sind in Produktion sichtbar und waren im
 * Repository unsichtbar. Diese Suite laeuft deshalb bewusst gegen die
 * DEPLOYTE Seite, nicht gegen einen lokalen Dev-Server.
 *
 * Ausfuehren:
 *   E2E_BASE_URL=https://realsyncdynamicsai.de npx playwright test e2e/production-acceptance.spec.ts
 *
 * Bewusst NICHT enthalten: alles hinter dem Login. Der Zugang laeuft ueber
 * Magic Link bzw. Google, beides ohne Postfachzugriff nicht automatisierbar.
 * Der eingeloggte Teil bleibt manuell — siehe `docs/qa/produktions-akzeptanz.md`.
 *
 * Ersatzweise abgedeckt (2026-08-31): `/demo-tour/dashboard` zeigt dieselbe
 * Dashboard-Oberflaeche oeffentlich und als Demo gekennzeichnet, und der
 * Kauf-Trichter laesst sich bis zum Anmeldegate des Checkouts verfolgen.
 * Damit sind Dashboard und Billing wenigstens bis an die Login-Grenze
 * geprueft, statt gar nicht.
 */

const PROD = 'https://realsyncdynamicsai.de';
const BASE = process.env.E2E_BASE_URL ?? process.env.TEST_BASE_URL ?? PROD;

// Diese Suite prueft den ausgelieferten Stand. Gegen einen lokalen Dev-Server
// sind Header, CSP und Edge-Function-Secrets andere — die Aussage waere wertlos.
test.skip(
  BASE.includes('localhost') || BASE.includes('127.0.0.1'),
  'Produktions-Akzeptanztest — benoetigt eine deployte Umgebung (E2E_BASE_URL setzen).',
);

test.describe.configure({ mode: 'parallel' });

/** Cookie-Banner wegklicken; er ueberdeckt sonst die Hero-CTAs. */
async function dismissConsent(page: Page): Promise<void> {
  const accept = page.getByRole('button', { name: 'Alles akzeptieren' }).first();
  if ((await accept.count()) > 0 && (await accept.isVisible())) {
    await accept.click();
    await page.waitForTimeout(300);
  }
}

/** Sammelt fehlgeschlagene Backend-Aufrufe waehrend eines Seitenbesuchs. */
function collectFailures(page: Page): { status: number; url: string }[] {
  const failures: { status: number; url: string }[] = [];
  page.on('response', (r: Response) => {
    if (r.status() >= 400) failures.push({ status: r.status(), url: r.url() });
  });
  return failures;
}

// ─────────────────────────────────────────────────────────────────────
// Erreichbarkeit — kein Weissbild auf den Seiten des Kundenpfads
// ─────────────────────────────────────────────────────────────────────

// Die Seiten, die ein Interessent auf dem Weg zum Kauf tatsaechlich sieht.
const KUNDENPFAD = [
  '/', '/audit', '/pricing', '/governance', '/evidence-vault', '/ai-act',
  '/features', '/contact-sales', '/faq', '/legal/impressum', '/legal/privacy',
];

for (const pfad of KUNDENPFAD) {
  test(`${pfad} rendert Inhalt statt Weissbild`, async ({ page }) => {
    const resp = await page.goto(pfad, { waitUntil: 'domcontentloaded' });
    expect(resp?.status(), `${pfad} liefert keinen 2xx-Status`).toBeLessThan(400);

    // Die SPA hydriert nach dem HTML-Dokument; ohne diese Wartezeit misst man
    // die leere Shell und nicht die Seite.
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15_000 });

    const text = await page.locator('#root').innerText();
    // 200 Zeichen trennt eine echte Seite zuverlaessig von einer Fehlerhuelle
    // ("Etwas ist schiefgelaufen") oder einer haengenden Ladeanzeige.
    expect(text.trim().length, `${pfad} rendert praktisch keinen Text`).toBeGreaterThan(200);
  });
}

// ─────────────────────────────────────────────────────────────────────
// Der wichtigste CTA — Scan-Trichter der Startseite
// ─────────────────────────────────────────────────────────────────────

test.describe('Scan-Trichter', () => {
  test('Hero-Formular uebergibt die Domain an /audit', async ({ page }) => {
    await page.goto('/');
    await dismissConsent(page);

    const feld = page.getByPlaceholder(/Ihre Website/i).first();
    await expect(feld, 'Kein Domain-Feld im Hero — der Haupt-CTA fehlt').toBeVisible();
    await feld.fill('example.com');
    await page.getByRole('button', { name: /Website kostenlos scannen/i }).first().click();

    // Die getippte Adresse muss mitreisen; sonst tippt der Besucher sie zweimal.
    await expect(page).toHaveURL(/\/audit\?domain=example\.com/);
  });

  test('/audit uebernimmt ?domain= in das sichtbare Eingabefeld', async ({ page }) => {
    await page.goto('/audit?domain=example.com');
    await dismissConsent(page);

    // Regression 2026-08-30: `AuditLanding` liest `?domain=` korrekt aus, gibt
    // den Wert aber nur an das klassische Formular weiter. Sichtbar ist per
    // Voreinstellung der Chat (`AuditChatHero`), der keine Vorbelegung
    // entgegennimmt — der Besucher sah trotz uebergebener Domain ein leeres
    // Feld. Geprueft wird deshalb das Feld, das der Besucher WIRKLICH sieht.
    const sichtbaresFeld = page.locator('input[type="text"]:visible').first();
    await expect(sichtbaresFeld).toHaveValue('example.com');
  });

  test('gdpr-audit liefert einen Bericht statt HTTP 500', async ({ request }) => {
    // Regression 2026-08-30: Die Function warf `ReferenceError: runChecks is
    // not defined` und beantwortete jeden Aufruf mit 500. Direkt gegen die
    // Function geprueft, damit der Befund unabhaengig von der Oberflaeche
    // eindeutig einer Ursache zuzuordnen ist.
    const resp = await request.post(
      'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/gdpr-audit',
      {
        data: { url: 'https://example.com', email: 'e2e@realsyncdynamics.example' },
        timeout: 120_000,
        failOnStatusCode: false,
      },
    );
    expect(resp.status(), `gdpr-audit antwortet ${resp.status()}: ${(await resp.text()).slice(0, 200)}`).toBe(200);

    const bericht = await resp.json();
    expect(bericht, 'Bericht ohne Score — der Audit hat nichts bewertet').toHaveProperty('score');

    // Vertrag mit der Oberflaeche: `AuditLanding` loest die Report-E-Mail ueber
    // dieses Feld aus und `audit-report-email` liest `gdpr_audits` per `?id=`.
    // Bis zum 2026-08-31 griff die Oberflaeche nach `scan_run_id` — ein Feld,
    // das die Function nie geliefert hat. Weil der Typ es als optional
    // deklarierte, schwieg der Compiler, und kein Kunde bekam je seinen
    // Report zugestellt. Der Name gehoert deshalb geprueft, nicht angenommen.
    expect(bericht, 'Antwort ohne audit_id — die Report-E-Mail kann nicht ausgeloest werden')
      .toHaveProperty('audit_id');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Auth-Gate — geschuetzte Bereiche fuehren zum Login
// ─────────────────────────────────────────────────────────────────────

test('/app/dashboard leitet Nicht-Angemeldete zum Login', async ({ page }) => {
  await page.goto('/app/dashboard');
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('button', { name: /Magic-Link senden/i })).toBeVisible();
});

test('kein Vortaeuschen von Kennzahlen ohne Anmeldung', async ({ page }) => {
  // Befund 2026-08-30: `/app/evidence` ist ohne Gate erreichbar und zeigte
  // einem anonymen Besucher die hart kodierten Zahlen aus
  // `EvidenceVaultView.tsx` ("1.247 Nachweise", "1.198 C2PA-signiert") — als
  // waeren es seine. Ein Datenleck ist es nicht, RLS haelt: `is_tenant_member()`
  // ist ohne Session falsch. Ein Vertrauensschaden ist es trotzdem, und
  // CLAUDE.md §14 verbietet es ausdruecklich ("Kein Element vortaeuschen").
  //
  // Die Regel, gegen die hier geprueft wird, ist bewusst allgemein: Wer einem
  // nicht angemeldeten Besucher Kennzahlen zeigt, muss sie als Demo
  // kennzeichnen. Das Projekt kann das bereits — `/demo-tour/dashboard`
  // ueberschreibt sein Dashboard mit "Demo-Modus — Interaktive Vorschau".
  // Genau dieses Muster fehlt unter `/app/*`.
  await page.goto('/app/evidence');
  await page.waitForTimeout(3_000);
  const text = await page.locator('#root').innerText();

  const zeigtZahlen = /1\.247|1\.198/.test(text);
  const alsDemoGekennzeichnet = /demo[- ]?modus|vorschau|beispieldaten/i.test(text);
  const istAngemeldet = !/NICHT ANGEMELDET/i.test(text);
  expect(
    zeigtZahlen && !istAngemeldet && !alsDemoGekennzeichnet,
    'Evidence Vault zeigt Kennzahlen ohne Anmeldung und ohne Demo-Kennzeichnung',
  ).toBe(false);
});

// ─────────────────────────────────────────────────────────────────────
// Demo-Oberflaeche — die Dashboard-Ebene, die ohne Postfach pruefbar ist
// ─────────────────────────────────────────────────────────────────────

test.describe('Demo-Tour', () => {
  // Der eingeloggte Bereich braucht einen Magic Link und ist deshalb nicht
  // automatisierbar. `/demo-tour/*` ist die naechstbeste Ebene: dasselbe
  // Dashboard-Layout, absichtlich oeffentlich, ausdruecklich als Demo
  // gekennzeichnet. Damit laesst sich wenigstens pruefen, dass die
  // Dashboard-Oberflaeche ueberhaupt rendert.

  test('Demo-Dashboard rendert und weist sich als Demo aus', async ({ page }) => {
    await page.goto('/demo-tour/dashboard');
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15_000 });
    const text = await page.locator('#root').innerText();

    // Die Kennzeichnung ist der Teil, der zaehlt: Ohne sie waeren die
    // Demo-Kennzahlen genau der Vertrauensschaden aus dem Test darueber.
    expect(text, 'Demo-Dashboard ohne Demo-Kennzeichnung').toMatch(/Demo[- ]?Modus/i);
    expect(text, 'Demo-Dashboard rendert keine Kennzahlen').toMatch(/Governance Score/i);
  });

  test('/demo-app fuehrt Nicht-Angemeldete zum Login', async ({ page }) => {
    await page.goto('/demo-app');
    await expect(page).toHaveURL(/\/demo-login/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Kauf-Trichter — vom Preis zur Kasse
// ─────────────────────────────────────────────────────────────────────

test.describe('Kauf-Trichter', () => {
  test('Plan-Schaltflaeche auf /pricing fuehrt in den Checkout', async ({ page }) => {
    await page.goto('/pricing');
    await dismissConsent(page);

    // §14: Eine Kauf-Schaltflaeche, die nichts tut, ist schlimmer als keine.
    const kaufen = page.getByRole('button', { name: /14 Tage kostenlos testen/i }).first();
    await expect(kaufen, 'Keine Kauf-Schaltflaeche auf der Preisseite').toBeVisible();
    await expect(kaufen).toBeEnabled();
    await kaufen.click();

    await expect(page, 'Kauf-Schaltflaeche loest keine Navigation aus').toHaveURL(/\/checkout\//);
  });

  test('Checkout verlangt Anmeldung und verspricht die Rueckkehr', async ({ page }) => {
    await page.goto('/checkout/starter');
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15_000 });
    const text = await page.locator('#root').innerText();

    // Ein Checkout, der anonym startet, waere ein Bezahlvorgang ohne Zuordnung.
    expect(text, 'Checkout ohne Anmeldegate').toMatch(/Anmelden|Login|Magic-Link/i);
    // Der Rueckkehrpfad ist der Unterschied zwischen einem Gate und einer
    // Sackgasse — ohne ihn faellt der Kunde nach dem Login aus dem Trichter.
    expect(text, 'Checkout verspricht keine Rueckkehr nach dem Login').toMatch(/wieder hier|automatisch/i);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Auslieferung — Header, CSP, Telemetrie
// ─────────────────────────────────────────────────────────────────────

test('kein Seitenaufruf erzeugt einen 5xx im Hintergrund', async ({ page }) => {
  const failures = collectFailures(page);
  await page.goto('/');
  await page.waitForTimeout(5_000);

  // Regression 2026-08-30: `track-pageview` lief auf jedem Seitenaufruf in
  // einen 500er, weil `PAGEVIEW_HASH_SALT` in Produktion nie gesetzt wurde.
  // Die Function faellt korrekt "fail closed" — der Fehler ist die fehlende
  // Konfiguration, nicht der Code. Folge: seit 2026-08-03 keine einzige
  // Zeile in `page_views`.
  const serverfehler = failures.filter((f) => f.status >= 500);
  expect(
    serverfehler,
    `Serverfehler beim Seitenaufruf: ${serverfehler.map((f) => `${f.status} ${f.url}`).join(', ')}`,
  ).toEqual([]);
});

test('CSP erlaubt die Skripte, die die Seite selbst laedt', async ({ page }) => {
  const blockiert: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) blockiert.push(m.text());
  });
  await page.goto('/');
  await page.waitForTimeout(5_000);

  // Regression 2026-08-30: Cloudflare Pages injiziert das Web-Analytics-Beacon
  // von `static.cloudflareinsights.com`, `script-src` in `public/_headers`
  // fuehrt die Domain aber nicht — das Beacon wurde bei jedem Aufruf blockiert.
  expect(blockiert, `Von der CSP blockierte Skripte:\n${blockiert.join('\n')}`).toEqual([]);
});

test('Sicherheitsheader sind gesetzt', async ({ request }) => {
  const resp = await request.get(BASE);
  const h = resp.headers();
  expect(h['content-security-policy'], 'CSP-Header fehlt').toBeTruthy();
  expect(h['strict-transport-security'], 'HSTS-Header fehlt').toBeTruthy();
  expect(h['x-content-type-options']).toBe('nosniff');
});

// ─────────────────────────────────────────────────────────────────────
// Mobil — der Trichter muss auf dem Telefon genauso funktionieren
// ─────────────────────────────────────────────────────────────────────

test.describe('Mobil (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('Haupt-CTA ist erreichbar und die Seite scrollt nicht seitwaerts', async ({ page }) => {
    await page.goto('/');
    await dismissConsent(page);

    await expect(page.getByPlaceholder(/Ihre Website/i).first()).toBeVisible();

    // Waagerechtes Scrollen ist auf dem Telefon der haeufigste Layoutfehler
    // und faellt am Desktop nie auf. 1px Toleranz gegen Rundung.
    const ueberstand = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(ueberstand, 'Seite laeuft waagerecht ueber').toBeLessThanOrEqual(1);
  });
});
