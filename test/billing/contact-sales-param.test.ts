/**
 * Wächter: Der Anfrage-CTA muss einen Parameter tragen, den das
 * Kontaktformular auch liest.
 *
 * ## Der Fehler, den dieser Test verhindert
 *
 * `checkoutHrefForPlan()` erzeugte für Vertragspläne
 * `/contact-sales?plan=<planKey>`. `src/pages/ContactSales.tsx` wertet
 * genau drei Parameter aus — `tier`, `source`, `intent`. Ein `?plan=`
 * fällt dort stillschweigend auf den Boden: kein Fehler, keine Warnung,
 * die Seite lädt normal. Sichtbar wurde es nur an zwei Stellen, an denen
 * niemand hinsieht — die Überschrift zeigte „Founding Access anfragen"
 * statt „Enterprise — Founding Access", und der Lead ging mit
 * `tier: undefined` in die Datenbank.
 *
 * ## Warum er zweimal auftrat
 *
 * Am 2026-08-30 war er schon einmal behoben worden — aber nur an vier
 * hartkodierten CTAs (CLAUDE.md §10, „Korrektur am selben Tag"). Der
 * Generator blieb unangetastet und hat ihn über alle seine Aufrufer neu
 * verteilt. Eine Korrektur am Symptom hält nicht, solange die Quelle sie
 * nachliefert; deshalb prüft dieser Test die **Quelle**.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PLANS, checkoutHrefForPlan } from '../../shared/pricing';

const contactSales = readFileSync(
  resolve(__dirname, '../../src/pages/ContactSales.tsx'),
  'utf8',
);

/** Die Parameter, die ContactSales.tsx tatsächlich aus der URL liest. */
const GELESENE_PARAMETER = ['tier', 'source', 'intent'] as const;

describe('Anfrage-CTAs sprechen die Sprache des Kontaktformulars', () => {
  it('ContactSales liest weiterhin genau diese Parameter', () => {
    // Ändert sich das, ist dieser Test die Stelle, an der es auffällt —
    // und nicht der Vertrieb, dem Leads ohne Plan-Zuordnung auflaufen.
    for (const name of GELESENE_PARAMETER) {
      expect(contactSales, `ContactSales liest '${name}' nicht mehr`).toContain(`params.get('${name}')`);
    }
    expect(contactSales, "ContactSales liest 'plan' — dann ist dieser Test falsch, nicht der Code").not.toContain("params.get('plan')");
  });

  const anfragePlaene = PLANS.filter(plan => plan.purchaseMode === 'inquiry');

  it('es gibt überhaupt einen Plan, für den das gilt', () => {
    // Sonst prüft `it.each` unten nichts und wäre still grün.
    expect(anfragePlaene.length).toBeGreaterThan(0);
  });

  it.each(anfragePlaene.map(plan => plan.id))('%s führt auf ?tier=, nicht ?plan=', id => {
    const href = checkoutHrefForPlan(id, { source: 'test' });
    expect(href).toContain('/contact-sales?');
    expect(href).toContain(`tier=${id}`);
    expect(href).not.toContain('plan=');
  });

  it('übergibt die Plan-ID, nicht den planKey mit Intervall', () => {
    // ContactSales zeigt den Wert unverändert an. Aus `enterprise_monthly`
    // würde dort „Enterprise_monthly — Founding Access"; eine Anfrage hat
    // ausserdem gar kein Abrechnungsintervall.
    for (const plan of anfragePlaene) {
      const jaehrlich = checkoutHrefForPlan(plan.id, { interval: 'year', source: 'test' });
      expect(jaehrlich).toContain(`tier=${plan.id}`);
      expect(jaehrlich).not.toContain('_yearly');
    }
  });
});
