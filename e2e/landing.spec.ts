import { test, expect } from '@playwright/test';

/**
 * E2E für die öffentlichen Einstiegsseiten.
 *
 * Positionierung (PR #591 ff.):
 *   - `/`         → PublicWorkspacePreview (Governance-OS-Workspace-Vorschau)
 *   - `/landing`  → Landing.tsx (Marketing-Landing, „European Enterprise Trust")
 *
 * Beide tragen dieselbe Governance-OS-Headline; getestet wird der stabile
 * Kontrakt (Hero, Self-Serve-CTAs, Kern-Sektionen) — keine flüchtigen Counts.
 * CTA-Disziplin: ausschließlich Self-Service-Strings, keine Sales-/Pilot-/
 * Demo-/Call-Sprache.
 */

// Verbotene Beratungs-/Sales-CTAs (Spiegel von runtimeVocab.CI_FORBIDDEN_CTA).
const FORBIDDEN_CTA = [
  /Pilot anfragen/i,
  /Demo anfragen/i,
  /Demo buchen/i,
  /Gespräch buchen/i,
  /Call buchen/i,
  /Beratung anfragen/i,
  /Sales kontaktieren/i,
  /Vertrieb kontaktieren/i,
];

// ─────────────────────────────────────────────────────────────────────
// Marketing-Landing (/landing)
// ─────────────────────────────────────────────────────────────────────
test.describe('Marketing-Landing (/landing)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing');
  });

  test('Hero zeigt Governance-OS-Headline und Self-Serve-CTAs', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: /Das Governance OS für DSGVO, EU AI Act und digitale Souveränität/i,
      }),
    ).toBeVisible();

    // Primär-CTAs: Self-Serve, kein Demo-Zwang.
    await expect(page.getByRole('link', { name: /14 Tage gratis starten/i })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Governance Audit starten/i }).first(),
    ).toBeVisible();

    // Trust-Signale.
    await expect(page.getByText(/EU-Hosting/i).first()).toBeVisible();
    await expect(page.getByText(/Keine Kreditkarte nötig/i)).toBeVisible();
  });

  test('Domain-Scan-Teaser navigiert zum Audit', async ({ page }) => {
    const input = page.getByPlaceholder(/ihre-domain\.de/i);
    await expect(input).toBeVisible();
    await input.fill('example.de');
    await page.getByRole('button', { name: /Scan/i }).click();
    await expect(page).toHaveURL(/\/audit/);
    expect(page.url()).toContain('domain=example.de');
  });

  test('Kern-Sektionen sichtbar', async ({ page }) => {
    for (const heading of [
      /Für jedes Team, das Verantwortung für Compliance trägt/i,
      /Digitale Souveränität als Betriebsmodell/i,
      /Governance für Software, Anbieter und Open-Source-Komponenten/i,
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
  });

  test('Final-CTA mit Self-Serve-Sprache', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Governance OS — kostenlos starten/i }),
    ).toBeVisible();
    await expect(page.getByText(/Keine Kreditkarte erforderlich/i)).toBeVisible();
  });

  test('Footer-Links (Impressum, Datenschutz) erreichbar', async ({ page }) => {
    await expect(page.getByRole('link', { name: /^Impressum$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Datenschutz$/i })).toBeVisible();
  });

  test('Keine verbotenen Sales/Pilot/Demo CTAs', async ({ page }) => {
    for (const pattern of FORBIDDEN_CTA) {
      await expect(page.getByRole('link', { name: pattern })).toHaveCount(0);
      await expect(page.getByRole('button', { name: pattern })).toHaveCount(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// MainLanding (/)
//
// Der Block prüfte bis 2026-08 noch die PublicWorkspacePreview („Betriebssystem
// für …"), die auf `/` längst durch MainLanding ersetzt war — die Assertions
// liefen damit gegen Text, den es auf der Seite nicht mehr gibt. Getestet wird
// jetzt der tatsächliche Kontrakt: Hero-Hierarchie, Prozesskette, CTAs und die
// Claim-Disziplin der Proof-Karten.
// ─────────────────────────────────────────────────────────────────────
test.describe('MainLanding (/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Hero zeigt genau eine H1 mit der Positionierung', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText(/AI Compliance\s*Operations OS\s*for Europe/i);
  });

  test('Prozesskette nennt alle vier Schritte', async ({ page }) => {
    for (const step of ['DISCOVER', 'CLASSIFY', 'ENFORCE', 'PROVE']) {
      await expect(page.getByText(step, { exact: true }).first()).toBeVisible();
    }
  });

  test('Primär- und Sekundär-CTA sind erreichbar', async ({ page }) => {
    // Auf die Hero-Section eingegrenzt: „Dashboard-Demo ansehen" kommt weiter
    // unten (ProductEntryPoints) ein zweites Mal vor.
    const hero = page.locator('main section').first();
    await expect(
      hero.getByRole('link', { name: /Kostenlosen Compliance Audit starten/i }),
    ).toBeVisible();
    const secondary = hero.getByRole('link', { name: /Dashboard-Demo ansehen/i });
    await expect(secondary).toBeVisible();
    await expect(secondary).toHaveAttribute('href', '/demo-tour');
  });

  test('Proof-Karten sind als Beispielwerte ausgewiesen', async ({ page }) => {
    // Schutz gegen Regression: Beispielzahlen dürfen nie unmarkiert als
    // Live-Telemetrie erscheinen.
    await expect(page.getByText(/Produktansicht · Beispielwerte/i).first()).toBeVisible();
  });

  test('Keine unbelegten Konformitäts-Claims im Hero', async ({ page }) => {
    await expect(page.getByText(/^Konform$/)).toHaveCount(0);
    await expect(page.getByText(/garantiert DSGVO|100\s*%\s*rechtssicher/i)).toHaveCount(0);
  });

  test('Kern-Sektionen sichtbar', async ({ page }) => {
    for (const heading of [
      /Evidence zuerst\. Runtime danach\./i,
      /Ein Workflow\. Vier Schritte\./i,
      /Vertrauen ist in die Architektur eingebaut/i,
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
  });

  test('Control Room und Evidence Chain sind sichtbar', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Ihr Compliance Control Room/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Von der Kontrolle zum prüfbaren Nachweis/i })).toBeVisible();
    await expect(page.getByText('AKTIVE CONTROLS', { exact: true })).toBeVisible();
    await expect(page.getByText('COMPLIANCE-DRIFT', { exact: true })).toBeVisible();
    // Evidence-Kette: alle sechs Stufen, in ihrer Reihenfolge nummeriert.
    for (const stage of ['CONTROL AUSGEFÜHRT', 'ERGEBNIS', 'EVIDENZ ERZEUGT', 'SHA-256', 'ZEITSTEMPEL', 'STATUS']) {
      await expect(page.getByText(new RegExp(`\\d\\d · ${stage}`, 'i')).first()).toBeVisible();
    }
  });

  test('Demo-Kennzeichnung begleitet jede erfundene Kennzahl', async ({ page }) => {
    // Claim-Disziplin: Control Room und Evidence Chain zeigen Beispielwerte.
    // Beide MÜSSEN sichtbar als DEMO markiert sein — sonst lesen sich Scores,
    // Evidenz-IDs und Hashes wie echte Produktionsnachweise.
    // Der sichtbare Text ist „DEMO", die Erläuterung folgt als sr-only-Span —
    // geprüft wird beides zusammen, damit die Kennzeichnung auch ohne
    // visuellen Kontext ankommt.
    const badges = page.getByText(/^DEMO\s+—\s+Beispielwerte einer Produktvorschau/);
    expect(await badges.count()).toBeGreaterThanOrEqual(2);
    await expect(badges.first()).toBeVisible();
  });

  test('Risk-Score-Drilldown ist aufklappbar und tastaturbedienbar', async ({ page }) => {
    const trigger = page.getByRole('button', { name: /RISK SCORE/i }).first();
    await trigger.scrollIntoViewIfNeeded();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('AI Governance')).toBeHidden();

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('AI Governance')).toBeVisible();
    await expect(page.getByText(/3 Controls brauchen eine Review/)).toBeVisible();

    // aria-controls muss auf ein real existierendes Panel zeigen.
    const controls = await trigger.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    await expect(page.locator(`[id="${controls}"]`)).toBeVisible();

    // Tastatur: Enter schliesst wieder.
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('Hero-Sequenz endet im Endzustand und ist als Vorschau markiert', async ({ page }) => {
    // Die Sequenz läuft einmal durch und bleibt stehen — sie darf nicht als
    // laufende Telemetrie erscheinen.
    await expect(page.getByText(/CONTROL PLANE/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Produktvorschau/i).first()).toBeVisible();
  });

  test('Event-Flow zeigt den Pfad eines Ereignisses', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Ein Ereignis, ein durchgehender Pfad/i })).toBeVisible();
    for (const stage of ['Neues KI-System erkannt', 'Risiko klassifiziert', 'Evidenz erzeugt', 'Auditfähig']) {
      await expect(page.getByText(stage, { exact: true })).toBeVisible();
    }
  });

  test('Audit-Einstieg übergibt an den echten Audit', async ({ page }) => {
    // Schritt 1 ist bewusst kein Demo-Stepper, sondern die reale Übergabe.
    const input = page.locator('#audit-domain');
    await input.scrollIntoViewIfNeeded();
    await input.fill('beispiel.de');
    await page.getByRole('button', { name: /Audit starten/i }).click();
    await expect(page).toHaveURL(/\/audit\?domain=beispiel\.de/);
  });

  test('Audit-Folgeschritte sind als Vorschau gekennzeichnet', async ({ page }) => {
    await expect(page.getByText(/Was danach passiert/i)).toBeVisible();
    await expect(page.getByText(/^Vorschau/).first()).toBeVisible();
  });

  test('Keine verbotenen Sales/Pilot/Demo CTAs', async ({ page }) => {
    for (const pattern of FORBIDDEN_CTA) {
      await expect(page.getByRole('link', { name: pattern })).toHaveCount(0);
      await expect(page.getByRole('button', { name: pattern })).toHaveCount(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// EU-Datenresidenz-Hotspots — nur Desktop (ab lg)
// ─────────────────────────────────────────────────────────────────────
test.describe('EU-Datenresidenz-Hotspots (/)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Hotspots sind vorhanden, beschriftet und per Tastatur bedienbar', async ({ page }) => {
    for (const c of ['Amsterdam', 'Berlin', 'Frankfurt', 'Paris']) {
      await expect(page.getByRole('button', { name: new RegExp(c, 'i') })).toHaveCount(1);
    }

    const frankfurt = page.getByRole('button', { name: /Frankfurt/i });
    await expect(frankfurt).toHaveAttribute('aria-expanded', 'false');
    await frankfurt.focus();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });

  test('Hotspots werden nicht von den Metrik-Karten verdeckt', async ({ page }) => {
    // Regression-Schutz: Die Marker lagen zunaechst unter dem Hero-Container
    // und waren nur per Tastatur erreichbar. Geprueft wird der echte Treffertest.
    const covered = await page.evaluate(() => {
      const bad: string[] = [];
      for (const btn of Array.from(document.querySelectorAll('button'))) {
        const sr = btn.querySelector('.sr-only');
        if (!sr || !/Produktvorschau, keine Live-Daten/.test(sr.textContent ?? '')) continue;
        const r = btn.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!(top === btn || btn.contains(top))) bad.push((sr.textContent ?? '').split(':')[0].trim());
      }
      return bad;
    });
    expect(covered).toEqual([]);
  });

  test('Die Hotspot-Ebene blockiert den Hero-CTA nicht', async ({ page }) => {
    const cta = page.getByRole('link', { name: /Kostenlosen Compliance Audit starten/i }).first();
    await cta.scrollIntoViewIfNeeded();
    await cta.click();
    await expect(page).toHaveURL(/\/flow\/start-scan/);
  });
});
