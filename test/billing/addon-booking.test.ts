import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  ADDONS,
  ADDON_PRODUCT_PREFIX,
  ENTITLEMENT_DEPENDENCIES,
  ENTITLEMENT_KEYS,
  PLANS,
  PLAN_ENTITLEMENTS,
  addonBookableOnPlan,
  addonById,
  addonGrantedKeys,
  addonMissingDependencies,
  addonPricePreview,
  addonProductSentinel,
  bookedAddonsMonthlyEur,
  planById,
  planGrants,
} from '../../shared/pricing';
import { buildPlanCatalogSql } from '../../scripts/generate-plan-catalog-sql';

/**
 * Add-on-Buchung (AP5–AP8): Das Modell, das ein neues Modul zu „ein Key plus
 * ein Stripe-Price" macht — kein neues Paket.
 *
 * Geprüft wird, was beim Weiterbauen am ehesten kaputtgeht: dass jedes
 * Add-on etwas gewährt, dass es nur bekannte Keys nennt, dass Abhängigkeiten
 * beim Buchen erkannt werden, dass die Preisvorschau nur aus der Quelle
 * rechnet — und dass die Migration dieselben Zeilen trägt wie die Quelle.
 */

const MIGRATIONEN = join('supabase', 'migrations');

function neuesteKatalogMigration(): string {
  const datei = readdirSync(MIGRATIONEN)
    .filter((f) => f.endsWith('_canonical_plan_catalog.sql'))
    .sort()
    .pop();
  if (!datei) throw new Error('keine Katalog-Migration gefunden');
  return readFileSync(join(MIGRATIONEN, datei), 'utf8');
}

describe('Jedes Add-on gewährt etwas Bekanntes', () => {
  it.each(ADDONS.map((a) => a.id))('%s nennt mindestens einen Key', (id) => {
    const addon = addonById(id)!;
    expect(addonGrantedKeys(addon).length).toBeGreaterThan(0);
  });

  it('verwendet ausschließlich Keys aus dem kanonischen Vokabular', () => {
    const bekannt = new Set<string>(ENTITLEMENT_KEYS);
    for (const addon of ADDONS) {
      for (const key of Object.keys(addon.grants)) {
        expect(bekannt.has(key), `${addon.id} nennt unbekannten Key ${key}`).toBe(true);
      }
    }
  });

  it('kennt keine Abhängigkeit auf einen unbekannten Key', () => {
    const bekannt = new Set<string>(ENTITLEMENT_KEYS);
    for (const [key, braucht] of ENTITLEMENT_DEPENDENCIES) {
      expect(bekannt.has(key)).toBe(true);
      expect(bekannt.has(braucht)).toBe(true);
      expect(key).not.toBe(braucht);
    }
  });

  it('verkauft Self-Service-Plänen nichts, was ihr Plan ohnehin schon vollständig hat', () => {
    // Ein Add-on, dessen sämtliche Keys der Plan bereits trägt, wäre ein
    // Kauf ohne Gegenwert — genau der Widerspruch aus zielzustand §3.2
    // (WhatsApp an Growth verkauft, das den Kanal schon enthält).
    //
    // Enterprise bleibt hier außen vor: Es ist ein Vertragsplan mit
    // unbegrenzten Kontingenten, seine Entitlements bestimmt der Vertrag
    // (CLAUDE.md §7). Dass `availableFor` ihn dennoch nennt, ist ein
    // gemeldeter Befund (docs/product/addon-booking.md §6), keine Regel —
    // zur Laufzeit meldet `subscription-addons` ein solches Add-on als
    // „bereits enthalten" statt es zu verkaufen.
    for (const addon of ADDONS) {
      for (const planId of addon.availableFor) {
        const plan = planById(planId);
        if (plan.availability !== 'self_service') continue;
        const neu = addonGrantedKeys(addon).filter((key) => {
          const wert = addon.grants[key]!;
          const planWert = PLAN_ENTITLEMENTS[plan.planKey]?.[key] ?? null;
          // Ein Kontingent ist additiv und damit ein Gegenwert — außer der
          // Plan ist dort schon unbegrenzt.
          if (key.startsWith('limit.')) return planWert !== -1;
          return !planGrants(plan.planKey, key) || (wert === -1 && planWert !== -1);
        });
        expect(neu.length, `${addon.id} bringt ${planId} nichts Neues`).toBeGreaterThan(0);
      }
    }
  });

  it('bietet Add-ons nur Plänen an, die sie auch führen', () => {
    for (const addon of ADDONS) {
      for (const planId of addon.availableFor) {
        expect(addonBookableOnPlan(addon, planId), `${addon.id} auf ${planId}`).toBe(true);
      }
    }
  });
});

describe('Abhängigkeiten werden beim Buchen erkannt (AP8)', () => {
  it('WhatsApp bringt bots.enabled selbst mit — keine offene Abhängigkeit', () => {
    expect(addonMissingDependencies(addonById('whatsapp')!, [])).toEqual([]);
  });

  it('Voice bringt bots.enabled selbst mit', () => {
    expect(addonMissingDependencies(addonById('voice')!, [])).toEqual([]);
  });

  it('White Label erfüllt whitelabel.dashboard → whitelabel.reports aus sich heraus', () => {
    expect(addonMissingDependencies(addonById('white_label')!, [])).toEqual([]);
  });

  it('meldet eine fehlende Abhängigkeit, wenn weder Mandant noch Add-on sie tragen', () => {
    // Konstruierter Fall: ein Add-on, das nur `bots.voice` gewährt.
    const nurVoice = { ...addonById('voice')!, grants: { 'bots.voice': 1 } };
    expect(addonMissingDependencies(nurVoice, [])).toEqual(['bots.enabled']);
    expect(addonMissingDependencies(nurVoice, ['bots.enabled'])).toEqual([]);
  });

  it('meldet jede fehlende Abhängigkeit nur einmal', () => {
    const doppelt = {
      ...addonById('voice')!,
      grants: { 'bots.voice': 1, 'bots.whatsapp': 1 },
    };
    expect(addonMissingDependencies(doppelt, [])).toEqual(['bots.enabled']);
  });
});

describe('Buchbarkeit folgt plan.addons, nicht availableFor', () => {
  it('Starter darf WhatsApp buchen, Growth nicht — Growth enthält den Kanal', () => {
    expect(addonBookableOnPlan('whatsapp', 'starter')).toBe(true);
    expect(addonBookableOnPlan('whatsapp', 'growth')).toBe(false);
    expect(addonBookableOnPlan('whatsapp', 'free')).toBe(false);
  });

  it('Bestandskunden auf Agency behalten ihre Add-ons, obwohl der Plan stillgelegt ist', () => {
    const agency = planById('agency');
    for (const id of agency.addons) {
      expect(addonBookableOnPlan(id, 'agency')).toBe(true);
    }
  });

  it('Jahresvarianten und Plan-Keys werden aufgelöst', () => {
    expect(addonBookableOnPlan('voice', 'growth_yearly')).toBe(true);
    expect(addonBookableOnPlan('voice', 'growth')).toBe(true);
  });
});

describe('Preisvorschau rechnet nur aus der Quelle (AP7)', () => {
  it('alt, Zuschlag, neu — für eine erste Buchung', () => {
    const growth = planById('growth');
    const voice = addonById('voice')!;
    const vorschau = addonPricePreview('growth', [], voice);
    expect(vorschau.currentMonthlyEur).toBe(growth.price.monthlyEur);
    expect(vorschau.deltaMonthlyEur).toBe(voice.priceEur);
    expect(vorschau.newMonthlyEur).toBe(growth.price.monthlyEur + voice.priceEur);
  });

  it('zählt bereits gebuchte Add-ons in den alten Betrag', () => {
    const growth = planById('growth');
    const voice = addonById('voice')!;
    const wl = addonById('white_label')!;
    const vorschau = addonPricePreview('growth', [{ id: 'voice', quantity: 1 }], wl);
    expect(vorschau.currentMonthlyEur).toBe(growth.price.monthlyEur + voice.priceEur);
    expect(vorschau.newMonthlyEur).toBe(growth.price.monthlyEur + voice.priceEur + wl.priceEur);
  });

  it('wertet eine Menge unter 1 als 1', () => {
    const rp = addonById('response_pack')!;
    expect(bookedAddonsMonthlyEur([{ id: 'response_pack', quantity: 0 }])).toBe(rp.priceEur);
    expect(addonPricePreview('starter', [], rp, 0).deltaMonthlyEur).toBe(rp.priceEur);
  });

  it('kennt keinen Betrag, der nicht in ADDONS oder PLANS steht', () => {
    const summeAllerAddons = ADDONS.reduce((s, a) => s + a.priceEur, 0);
    const alle = ADDONS.map((a) => ({ id: a.id, quantity: 1 }));
    expect(bookedAddonsMonthlyEur(alle)).toBe(summeAllerAddons);
  });
});

describe('Die Katalog-Migration trägt dieselben Zeilen wie die Quelle', () => {
  const sql = neuesteKatalogMigration();

  it('enthält den generierten Block unverändert', () => {
    expect(sql).toContain(buildPlanCatalogSql());
  });

  it('legt je Add-on ein Produkt mit Sentinel-Price an', () => {
    for (const addon of ADDONS) {
      expect(sql).toContain(`('${addonProductSentinel(addon.id)}', 'Add-on: ${addon.name}', NULL)`);
      expect(addonProductSentinel(addon.id).startsWith(ADDON_PRODUCT_PREFIX)).toBe(true);
    }
  });

  it('schreibt jede gewährte Zeile in product_entitlements', () => {
    for (const addon of ADDONS) {
      for (const key of addonGrantedKeys(addon)) {
        expect(sql).toContain(`('${addon.id}', '${key}', ${addon.grants[key]})`);
      }
    }
  });

  it('schreibt jede Abhängigkeit in entitlement_dependencies', () => {
    for (const [key, braucht] of ENTITLEMENT_DEPENDENCIES) {
      expect(sql).toContain(`('${key}', '${braucht}')`);
    }
  });

  it('überschreibt stripe_price_id und product_id nie aus dem Katalog', () => {
    // Die Price-ID trägt der Betreiber nach; ein Katalog-Lauf, der sie
    // zurücksetzte, machte jedes Add-on beim nächsten Deploy unbuchbar.
    const addonBlock = sql.slice(sql.indexOf('INSERT INTO public.plan_addons'), sql.indexOf('INSERT INTO public.products'));
    expect(addonBlock).not.toContain('stripe_price_id');
    expect(addonBlock).not.toContain('product_id');
  });
});

describe('Der Auflöser kennt die Add-on-Quelle', () => {
  const schema = readFileSync(join(MIGRATIONEN, '20260904000000_addon_booking_schema.sql'), 'utf8');

  it('erlaubt source = addon_subscription an entitlement_grants', () => {
    expect(schema).toMatch(/CHECK \(source IN \([^)]*'addon_subscription'/);
  });

  it('summiert limit-Kontingente aus Add-on-Grants statt das Maximum zu nehmen', () => {
    expect(schema).toContain("g.source = 'addon_subscription'");
    expect(schema).toMatch(/SUM\(pe\.value \* ag\.quantity\)/);
    expect(schema).toMatch(/COALESCE\(b\.value, 0\) \+ COALESCE\(z\.value, 0\)/);
  });

  it('lässt Add-on-Grants nur mit wirksamem Abo zählen', () => {
    const addonBlock = schema.slice(schema.indexOf('addon_grants AS'), schema.indexOf('zusatz AS'));
    expect(addonBlock).toContain('(SELECT ok FROM abo_wirksam) IS TRUE');
  });

  it('lässt Mitgliedschaftsprüfung und Signatur unverändert', () => {
    expect(schema).toContain("auth.role() = 'service_role'");
    expect(schema).toContain('RETURNS TABLE(key text, kind text, value integer)');
    expect(schema).toMatch(/m\.user_id = auth\.uid\(\)/);
  });
});

describe('Kein bezahlter Plan verliert durch das Add-on-Modell einen Key', () => {
  // Reine Sicherung: Diese Datei ändert PLAN_ENTITLEMENTS nicht. Sollte
  // jemand ein Add-on „aus dem Plan herauslösen", bricht das hier.
  it.each(PLANS.filter((p) => p.price.monthlyEur > 0).map((p) => p.planKey))(
    '%s trägt weiterhin bots.enabled, wenn er einen Bot verspricht',
    (planKey) => {
      const plan = PLANS.find((p) => p.planKey === planKey)!;
      if (plan.limits.bots > 0 || plan.limits.bots === -1) {
        expect(PLAN_ENTITLEMENTS[planKey]?.['bots.enabled']).toBe(1);
      }
    },
  );
});

describe('Angebotszustand je Mandant (Function und Oberfläche teilen ihn)', async () => {
  const { addonOfferStatus } = await import('../../shared/pricing');
  const growth = { 'bots.enabled': 1, 'bots.chat': 1, 'limit.bot_messages_monthly': 2000 };

  it('gebucht bleibt gebucht', () => {
    const r = addonOfferStatus({ addon: addonById('voice')!, plan: 'growth', held: growth, booked: [{ id: 'voice', quantity: 1 }], purchasable: true });
    expect(r.status).toBe('booked');
  });

  it('WhatsApp ist auf Growth nicht im Angebot — der Plan enthält den Kanal', () => {
    const r = addonOfferStatus({ addon: addonById('whatsapp')!, plan: 'growth', held: growth, booked: [], purchasable: true });
    expect(r.status).toBe('not_for_plan');
  });

  it('verkauft nichts, was der Mandant schon vollständig hält', () => {
    const alles = { 'whitelabel.reports': 1, 'whitelabel.dashboard': 1 };
    const r = addonOfferStatus({ addon: addonById('white_label')!, plan: 'growth', held: alles, booked: [], purchasable: true });
    expect(r.status).toBe('included');
  });

  it('ein Kontingent bleibt Gegenwert, solange es nicht unbegrenzt ist', () => {
    const r = addonOfferStatus({ addon: addonById('response_pack')!, plan: 'growth', held: growth, booked: [], purchasable: true });
    expect(r.status).toBe('bookable');
    const unbegrenzt = { ...growth, 'limit.bot_messages_monthly': -1 };
    expect(addonOfferStatus({ addon: addonById('response_pack')!, plan: 'growth', held: unbegrenzt, booked: [], purchasable: true }).status).toBe('included');
  });

  it('meldet fehlende Voraussetzungen vor der Kaufbarkeit', () => {
    const nurVoice = { ...addonById('voice')!, grants: { 'bots.voice': 1 } };
    const r = addonOfferStatus({ addon: nurVoice, plan: 'growth', held: {}, booked: [], purchasable: false });
    expect(r.status).toBe('missing_dependency');
    expect(r.missing).toEqual(['bots.enabled']);
  });

  it('ohne Stripe-Price ist ein Add-on ehrlich nicht buchbar', () => {
    const r = addonOfferStatus({ addon: addonById('voice')!, plan: 'growth', held: growth, booked: [], purchasable: false });
    expect(r.status).toBe('not_purchasable');
  });

  it('mit Price, Plan und erfüllten Voraussetzungen: buchbar', () => {
    const r = addonOfferStatus({ addon: addonById('voice')!, plan: 'growth', held: growth, booked: [], purchasable: true });
    expect(r.status).toBe('bookable');
  });
});
