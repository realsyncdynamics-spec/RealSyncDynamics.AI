/**
 * Der Online-Preisrechner nennt einen Betrag, der aus der SSoT stammt.
 *
 * Drei Dinge duerfen hier nie kaputtgehen, weil sie jeweils ein echtes
 * Versprechen an den Besucher sind:
 *
 *   1. Der genannte Betrag liegt nie unter dem Listenpreis des Plans.
 *      „ab 1.249 €" auf der Karte und dann 900 € im Rechner waere die
 *      Ueberraschung, wegen der Preisseiten misstrauisch machen.
 *   2. Kein Posten entsteht ausserhalb der SSoT. Die KI formuliert die
 *      Fragen; die Beträge kommen aus `PLANS` und `ADDONS`.
 *   3. Browser und Edge Function rechnen dasselbe. `sales-lead` ruft
 *      dieselbe Funktion auf — ein zweiter Preis darf nicht entstehen.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ADDONS,
  QUOTE_CONTRACT_ITEMS,
  QUOTE_PLAN_IDS,
  addonsFor,
  computeQuote,
  isQuotePlanId,
  planById,
  publicLabelOf,
  quoteDimensionsFor,
  quoteFingerprint,
  quotePlanForTenants,
  type QuotePlanId,
} from '../../shared/pricing';

const SALES_LEAD = readFileSync('supabase/functions/sales-lead/index.ts', 'utf8');
const PAGE = readFileSync('src/pages/pricing/PricingQuotePage.tsx', 'utf8');

describe('Quote — der Betrag kommt aus der SSoT', () => {
  it('kennt genau die zwei Anfrage-Plaene', () => {
    expect([...QUOTE_PLAN_IDS]).toEqual(['enterprise', 'partner']);
    for (const id of QUOTE_PLAN_IDS) {
      expect(planById(id).purchaseMode).toBe('inquiry');
    }
    expect(isQuotePlanId('starter')).toBe(false);
    expect(isQuotePlanId('enterprise')).toBe(true);
  });

  it.each([...QUOTE_PLAN_IDS])('%s startet beim Listenpreis', (planId) => {
    const quote = computeQuote({ planId, quantities: {}, contractItems: [] });
    expect(quote.monthlyEur).toBe(planById(planId).price.monthlyEur);
    expect(quote.baseMonthlyEur).toBe(planById(planId).price.monthlyEur);
    expect(quote.lines).toEqual([]);
  });

  it('nennt die Betraege, die der Eigentuemer festgelegt hat', () => {
    expect(computeQuote({ planId: 'enterprise', quantities: {}, contractItems: [] }).monthlyEur).toBe(1249);
    expect(computeQuote({ planId: 'partner', quantities: {}, contractItems: [] }).monthlyEur).toBe(1999);
  });

  it('traegt das oeffentliche Label, nicht den Katalognamen', () => {
    expect(computeQuote({ planId: 'partner', quantities: {}, contractItems: [] }).publicLabel).toBe(
      'Enterprise Plus',
    );
    expect(publicLabelOf(planById('enterprise'))).toBe('Enterprise');
  });

  it.each([...QUOTE_PLAN_IDS])('%s geht nie unter den Listenpreis', (planId) => {
    const base = planById(planId).price.monthlyEur;
    // Auch mit absurden Eingaben: negative Mengen, unbekannte Bausteine,
    // erfundene Vertragspunkte.
    const quote = computeQuote({
      planId,
      quantities: { response_pack: -50, erfunden: 9_000, voice: -1 },
      contractItems: ['gibt_es_nicht'],
    });
    expect(quote.monthlyEur).toBeGreaterThanOrEqual(base);
    expect(quote.lines).toEqual([]);
    expect(quote.contractItems).toEqual([]);
  });

  it('rechnet Bausteine mit ihrem SSoT-Betrag und klemmt die Menge', () => {
    const dims = quoteDimensionsFor('enterprise');
    const bots = dims.find((d) => d.id === 'agency_bot_pack')!;
    const addon = ADDONS.find((a) => a.id === 'agency_bot_pack')!;
    expect(bots.unitEur).toBe(addon.priceEur);

    const quote = computeQuote({
      planId: 'enterprise',
      quantities: { agency_bot_pack: 99_999 },
      contractItems: [],
    });
    const line = quote.lines.find((l) => l.id === 'agency_bot_pack')!;
    expect(line.quantity).toBe(bots.unit!.max);
    expect(line.monthlyEur).toBe(addon.priceEur * bots.unit!.max);
    expect(quote.monthlyEur).toBe(1249 + line.monthlyEur);
  });

  it('bietet je Plan nur die Bausteine an, die der Plan auch fuehrt', () => {
    for (const planId of QUOTE_PLAN_IDS) {
      const erlaubt = new Set(addonsFor(planId).map((a) => a.id));
      for (const dim of quoteDimensionsFor(planId)) {
        if (dim.kind !== 'addon') continue;
        expect(erlaubt.has(dim.id as never), `${dim.id} ist auf ${planId} nicht freigegeben`).toBe(true);
      }
    }
  });

  it('haelt Vertragspunkte betragslos', () => {
    for (const planId of QUOTE_PLAN_IDS) {
      for (const dim of quoteDimensionsFor(planId)) {
        if (dim.kind !== 'contract') continue;
        expect(dim.unitEur, `${dim.id} traegt einen Betrag`).toBe(0);
      }
    }
    // Vertragspunkte gewaehlt → Betrag unveraendert. Sonst gaebe es einen
    // zweiten, nicht ausgewiesenen Preis.
    const ohne = computeQuote({ planId: 'enterprise', quantities: {}, contractItems: [] });
    const mit = computeQuote({
      planId: 'enterprise',
      quantities: {},
      contractItems: QUOTE_CONTRACT_ITEMS.map((c) => c.id),
    });
    expect(mit.monthlyEur).toBe(ohne.monthlyEur);
    expect(mit.contractItems).toHaveLength(QUOTE_CONTRACT_ITEMS.length);
  });

  it('deckt die vom Eigentuemer genannten Dimensionen ab', () => {
    const ids = new Set(QUOTE_CONTRACT_ITEMS.map((c) => c.id));
    for (const erwartet of ['sla', 'eu_local', 'custom_dpa', 'sso']) {
      expect(ids.has(erwartet), `Vertragspunkt ${erwartet} fehlt`).toBe(true);
    }
  });

  it('macht aus „mehr Organisationen" einen Planwechsel, keinen Aufpreis', () => {
    const grenze = planById('enterprise').limits.tenants;
    expect(quotePlanForTenants(grenze)).toBe('enterprise');
    expect(quotePlanForTenants(grenze + 1)).toBe('partner');
  });
});

describe('Quote — die Kennung ist stabil', () => {
  it('ist fuer wirkungsgleiche Antworten identisch', () => {
    const a = { planId: 'enterprise' as QuotePlanId, quantities: { voice: 1 }, contractItems: ['sla'] };
    const b = {
      planId: 'enterprise' as QuotePlanId,
      quantities: { voice: 1, unbekannt: 7 },
      contractItems: ['sla'],
    };
    expect(quoteFingerprint(a)).toBe(quoteFingerprint(b));
  });

  it('unterscheidet sich bei anderem Betrag', () => {
    const a = computeQuote({ planId: 'enterprise', quantities: {}, contractItems: [] });
    const b = computeQuote({ planId: 'enterprise', quantities: { voice: 1 }, contractItems: [] });
    expect(a.fingerprint).not.toBe(b.fingerprint);
    expect(b.monthlyEur).toBeGreaterThan(a.monthlyEur);
  });

  it('unterscheidet die beiden Plaene', () => {
    const e = computeQuote({ planId: 'enterprise', quantities: {}, contractItems: [] });
    const p = computeQuote({ planId: 'partner', quantities: {}, contractItems: [] });
    expect(e.fingerprint).not.toBe(p.fingerprint);
  });
});

describe('Quote — Server und Seite rechnen dasselbe', () => {
  it('laesst die Edge Function den Betrag neu rechnen', () => {
    // Ohne diesen Aufruf waere der Betrag das, was der Browser behauptet.
    expect(SALES_LEAD).toContain('computeQuote(');
    expect(SALES_LEAD).toContain("body.mode === 'quote'");
  });

  it('nimmt den Betrag nicht aus dem Request entgegen', () => {
    // `normalizeQuoteAnswers` liest ausschliesslich Plan, Mengen und
    // Vertragspunkte — nie einen Betrag.
    expect(SALES_LEAD).toContain('function normalizeQuoteAnswers');
    expect(SALES_LEAD).not.toContain('body.monthly_eur');
    expect(SALES_LEAD).not.toContain('body.amount');
  });

  it('verwirft Dimensionen, die das Modell erfunden hat', () => {
    // Die Fragen kommen aus `quoteDimensionsFor`; eine zurueckgegebene id
    // ohne Entsprechung wird uebersprungen.
    expect(SALES_LEAD).toContain('quoteDimensionsFor');
    expect(SALES_LEAD).toContain('if (!base) continue;');
  });

  it('protokolliert den Provider-Call am Lead', () => {
    expect(SALES_LEAD).toContain('ai: ai.log');
    expect(SALES_LEAD).toContain('callProvider(');
  });

  it('haelt an einem Fragebogen fest, wenn das Modell ausfaellt', () => {
    // Kein Fehlerzustand fuer den Besucher: es bleibt bei den Standardfragen,
    // und der Betrag ist derselbe — er kam ohnehin nie aus dem Modell.
    expect(SALES_LEAD).toContain('const fallback: QuoteQuestion[]');
    expect(SALES_LEAD).toContain('generated: false');
  });
});

describe('Quote — die Seite zeigt, was gerechnet wurde', () => {
  it('rechnet ueber die SSoT, nicht mit eigenen Zahlen', () => {
    expect(PAGE).toContain('computeQuote');
    // Kein Betrag im Quelltext der Seite.
    expect(PAGE).not.toMatch(/\b1\.?249\b/);
    expect(PAGE).not.toMatch(/\b1\.?999\b/);
  });

  it('nennt den Betrag im Klartext', () => {
    expect(PAGE).toContain('Ihr Preis');
    expect(PAGE).toContain('quote-amount');
    expect(PAGE).toContain('/ Monat');
  });

  it('traegt denselben Betrag auf dem Anfrage-CTA', () => {
    // Der CTA sendet `answers`; der Server leitet daraus denselben Betrag ab.
    expect(PAGE).toContain('Diesen Preis anfragen');
    expect(PAGE).toContain("action: 'submit'");
    expect(PAGE).toContain('setServerQuote');
  });

  it('weist jeden Posten einzeln aus', () => {
    expect(PAGE).toContain('quote.lines.map');
    expect(PAGE).toContain('Einstiegspreis');
  });
});
