/**
 * Der Optimizer darf für einen Vertragsplan keinen Betrag ausweisen.
 *
 * Gefunden am 2026-09-08 auf `/claude-code-optimizer`: Die Paket-Karte
 * druckte „1.249 €/Mo." für Enterprise, während `/pricing` daneben „Auf
 * Anfrage" zeigte. Ursache war NICHT ein hartes Literal — `canonicalPrice()`
 * las brav aus der SSoT, prüfte aber nur `priceEur === 0` und nicht
 * `priceOnRequest`. Der Betrag (`monthlyEur: 1_249`) ist dort eine interne
 * Referenzgrösse; öffentlich zugesichert ist er nicht, und
 * `purchaseMode: 'inquiry'` kann ihn nicht einlösen.
 *
 * Es ist derselbe Fehler wie beim ROI-Rechner (siehe
 * `test/config/pricing-ssot.test.ts`, „Rechen-Oberflächen führen keinen Plan
 * ohne Festpreis"): eine zweite Anzeigefläche liest `tier.priceEur` und
 * umgeht damit `priceOnRequest`. Ein Grep nach „1249" findet das nicht, weil
 * die Zahl aus der Quelle stammt — deshalb prüft dieser Test die
 * Anzeige-Zeichenkette, nicht den Quelltext.
 */
import { describe, expect, it } from 'vitest';

import { OPTIMIZER_PACKAGES } from '../../src/pages/claude-code-optimizer/OptimizerKit';
import { tierById } from '../../src/config/pricing';
import { monthlyPriceText } from '../../shared/pricing';

describe('Optimizer-Pakete weisen keinen Preis ohne Deckung aus', () => {
  it('jedes Paket verweist auf einen Plan der SSoT', () => {
    // Ohne diese Kopplung liefe der Test unten ins Leere: Ein Paket mit
    // unbekanntem Key würde von `tierById` mit `undefined` beantwortet und
    // stillschweigend übersprungen.
    for (const pkg of OPTIMIZER_PACKAGES) {
      expect(tierById(pkg.key), `Paket "${pkg.name}"`).toBeDefined();
    }
  });

  it('ein Auf-Anfrage-Plan zeigt „Auf Anfrage" statt eines Betrags', () => {
    const onRequest = OPTIMIZER_PACKAGES.filter(
      (pkg) => tierById(pkg.key)?.priceOnRequest === true,
    );
    // Seit 2026-10-24 ist Enterprise per Checkout buchbar und kein
    // Auf-Anfrage-Plan mehr; heute führt kein Paket einen solchen Plan. Die
    // Regel bleibt für den Fall stehen, dass wieder einer dazukommt.

    for (const pkg of onRequest) {
      expect(pkg.price, `Paket "${pkg.name}"`).toBe('Auf Anfrage');
      // Doppelt geprüft, weil die Zeichenkette künftig anders lauten mag:
      // Eine Ziffer darf dort unter keinen Umständen stehen.
      expect(pkg.price, `Paket "${pkg.name}"`).not.toMatch(/\d/);
    }
  });

  it('Pläne mit Festpreis nennen ihn weiterhin', () => {
    // Gegenprobe: Der Fix darf nicht dazu führen, dass alle Karten
    // „Auf Anfrage" zeigen und Starter/Growth ihren Preis verschweigen.
    const fixed = OPTIMIZER_PACKAGES.filter((pkg) => {
      const tier = tierById(pkg.key);
      return tier !== undefined && !tier.priceOnRequest && tier.priceEur > 0;
    });
    expect(fixed.length).toBeGreaterThan(0);
    // Enterprise nennt seit 2026-10-24 seinen Festpreis.
    expect(fixed.map((pkg) => pkg.key)).toContain('enterprise');

    // Genau der Betrag aus der SSoT — eine bloße Ziffernprüfung ließe einen
    // falschen Betrag (Jahrespreis, veraltetes Literal) grün durch. Pläne mit
    // `netPriceLabel` (Enterprise) tragen den Netto-Hinweis aus der SSoT.
    for (const pkg of fixed) {
      const tier = tierById(pkg.key)!;
      const expected = tier.plan.netPriceLabel
        ? monthlyPriceText(tier.plan)
        : `${tier.priceString} €/Mo.`;
      expect(pkg.price, `Paket "${pkg.name}"`).toBe(expected);
    }
    expect(OPTIMIZER_PACKAGES.find((pkg) => pkg.key === 'enterprise')?.price).toBe(
      '1.498 €/Monat netto',
    );
  });
});
