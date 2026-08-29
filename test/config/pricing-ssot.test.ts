import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADDONS,
  ALL_MODULES,
  ALL_PLANS_ORDERED,
  FEATURE_GROUPS,
  ONE_TIME_PLANS,
  ORDERED_PLANS,
  PLANS,
  PLAN_ORDER,
  PRODUCT_AREAS,
  POLICY_PACK_IDS,
  RUNTIME_PIPELINE,
  addonsFor,
  allPlanKeys,
  checkoutHrefForPlan,
  intervalForPlanKey,
  isOneTimePlan,
  isPlanId,
  isUpgrade,
  normalizePlanKey,
  planByKey,
  planById,
  planRank,
  priceForPlanKey,
  recommendPlan,
  resolvePlan,
} from '../../shared/pricing';
import { CALCULABLE_PRICING_TIERS, PUBLIC_PRICING_TIERS } from '../../src/config/pricing';
import { buildPlanCatalogSql } from '../../scripts/generate-plan-catalog-sql';
import { buildGenerated } from '../../scripts/sync-shared-pricing.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

/**
 * Qualitätskontrolle des Refactorings: Diese Datei erzwingt, dass Preis-,
 * Feature- und Berechtigungsinformationen ausschließlich aus der SSoT
 * stammen und dass alle abgeleiteten Artefakte synchron bleiben.
 */
describe('Pricing SSoT — Struktur', () => {
  it('definiert exakt sechs Abo-Pläne mit den vorgegebenen Preisen', () => {
    // Die Abo-Leiter bleibt bei sechs Rängen. Einmalprodukte werden separat
    // geführt und dürfen sie nicht verlängern.
    expect(ORDERED_PLANS).toHaveLength(6);
    expect(PLAN_ORDER).toHaveLength(6);
    expect(ORDERED_PLANS.map((p) => [p.id, p.price.monthlyEur])).toEqual([
      ['free', 0],
      ['starter', 79],
      ['growth', 249],
      ['agency', 699],
      ['enterprise', 1249],
      ['partner', 1999],
    ]);
  });

  it('führt jeden Plan entweder auf der Abo-Leiter oder als Einmalprodukt', () => {
    // Kein Plan darf aus beiden Listen herausfallen — sonst wäre er in
    // abgeleiteten Artefakten (Plan-Katalog, Pricing-Grids) unsichtbar.
    expect(ALL_PLANS_ORDERED).toHaveLength(PLANS.length);
    expect(new Set(ALL_PLANS_ORDERED.map((p) => p.id)).size).toBe(PLANS.length);
    expect(ORDERED_PLANS.length + ONE_TIME_PLANS.length).toBe(PLANS.length);
  });

  it('kennt keinen Plan-Bezeichner, der „scale" enthält', () => {
    for (const key of allPlanKeys()) {
      expect(key).not.toMatch(/scale/i);
    }
    for (const plan of PLANS) {
      expect(plan.id).not.toMatch(/scale/i);
      expect(plan.name).not.toMatch(/scale/i);
    }
  });

  it('hat eindeutige Plan-Keys ohne Kollisionen', () => {
    const keys = allPlanKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('deckt die drei Produktbereiche vollständig ab', () => {
    expect(PRODUCT_AREAS.map((a) => a.label)).toEqual(['GOVERN', 'AUTOMATE', 'ENGAGE']);
    const areaModuleIds = PRODUCT_AREAS.flatMap((a) => a.modules).sort();
    const allModuleIds = ALL_MODULES.map((m) => m.id).sort();
    expect(areaModuleIds).toEqual(allModuleIds);
  });

  it('enthält die sechs geforderten Policy Packs', () => {
    expect(POLICY_PACK_IDS).toEqual([
      'dsgvo', 'eu_ai_act', 'nis2', 'dora', 'iso_27001', 'tisax',
    ]);
  });

  it('bildet die Runtime-Kette in der verbindlichen Reihenfolge ab', () => {
    expect(RUNTIME_PIPELINE.map((s) => s.label)).toEqual([
      'Website / API', 'Runtime Scan', 'Policy Engine', 'Evidence Vault',
      'Risk Engine', 'Automation', 'Audit Export',
    ]);
  });

  it('gliedert Features in genau vier Gruppen', () => {
    expect(FEATURE_GROUPS.map((g) => g.label)).toEqual([
      'Audit & Evidence', 'AI Governance', 'Automation & Ops', 'Multi Tenant & Reseller',
    ]);
    for (const plan of PLANS) {
      for (const group of FEATURE_GROUPS) {
        expect(Array.isArray(plan.features[group.id]), `${plan.id}/${group.id}`).toBe(true);
      }
      expect(Object.keys(plan.features).sort()).toEqual(FEATURE_GROUPS.map((g) => g.id).sort());
    }
  });

  it('referenziert nur existierende Module und Add-ons', () => {
    const moduleIds = new Set(ALL_MODULES.map((m) => m.id));
    const addonIds = new Set(ADDONS.map((a) => a.id));
    for (const plan of PLANS) {
      for (const module of plan.modules) {
        expect(moduleIds.has(module), `${plan.id} referenziert unbekanntes Modul ${module}`).toBe(true);
      }
      expect(new Set(plan.modules).size, `${plan.id} hat doppelte Module`).toBe(plan.modules.length);
      for (const addon of plan.addons) {
        expect(addonIds.has(addon), `${plan.id} referenziert unbekanntes Add-on ${addon}`).toBe(true);
      }
    }
  });

  it('Add-ons sind nur für Pläne buchbar, die sie auch führen', () => {
    for (const addon of ADDONS) {
      for (const planId of addon.availableFor) {
        expect(
          addonsFor(planId).some((a) => a.id === addon.id),
          `${addon.id} ist für ${planId} freigegeben, aber nicht im Plan gelistet`,
        ).toBe(true);
      }
    }
  });
});

describe('Pricing SSoT — Monotonie', () => {
  it('Module wachsen entlang der Plan-Reihenfolge', () => {
    // Free ist bewusst kein Untermenge-Vorgänger von Starter im Preis, aber
    // ein höherer Plan darf nie Module verlieren.
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      const lower = planById(PLAN_ORDER[i - 1]);
      const higher = planById(PLAN_ORDER[i]);
      for (const module of lower.modules) {
        expect(
          higher.modules.includes(module),
          `${higher.id} verliert Modul "${module}" gegenüber ${lower.id}`,
        ).toBe(true);
      }
    }
  });

  it('Berechtigungen werden nie zurückgenommen', () => {
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      const lower = planById(PLAN_ORDER[i - 1]);
      const higher = planById(PLAN_ORDER[i]);
      for (const [key, enabled] of Object.entries(lower.permissions)) {
        if (!enabled) continue;
        expect(
          higher.permissions[key as keyof typeof higher.permissions],
          `${higher.id} verliert Berechtigung "${key}" gegenüber ${lower.id}`,
        ).toBe(true);
      }
    }
  });

  it('Limits sinken nie (–1 gilt als unbegrenzt)', () => {
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      const lower = planById(PLAN_ORDER[i - 1]);
      const higher = planById(PLAN_ORDER[i]);
      for (const key of Object.keys(lower.limits) as Array<keyof typeof lower.limits>) {
        const a = lower.limits[key];
        const b = higher.limits[key];
        if (b === -1) continue;
        expect(a === -1 ? Infinity : a, `${higher.id}.${key} < ${lower.id}.${key}`)
          .toBeLessThanOrEqual(b);
      }
    }
  });

  it('isUpgrade folgt der Preisreihenfolge', () => {
    expect(isUpgrade('starter', 'growth')).toBe(true);
    expect(isUpgrade('partner', 'growth')).toBe(false);
    expect(isUpgrade('growth', 'growth')).toBe(false);
  });
});

describe('Pricing SSoT — Altdaten und Auflösung', () => {
  it('bildet Legacy-Keys auf die kanonischen Keys ab', () => {
    expect(normalizePlanKey('scale')).toBe('partner');
    expect(normalizePlanKey('scale_yearly')).toBe('partner_yearly');
    expect(normalizePlanKey('free')).toBe('free_audit');
    expect(normalizePlanKey('free_tier')).toBe('free_audit');
    expect(normalizePlanKey('  SCALE  ')).toBe('partner');
    expect(normalizePlanKey('nonsense')).toBeNull();
    expect(normalizePlanKey(null)).toBeNull();
  });

  it('planByKey löst Jahresvarianten und Legacy-Keys korrekt auf', () => {
    expect(planByKey('scale')?.id).toBe('partner');
    expect(planByKey('partner_yearly')?.id).toBe('partner');
    expect(planByKey('growth_yearly')?.id).toBe('growth');
    expect(planByKey('unbekannt')).toBeNull();
  });

  it('priceForPlanKey liefert die Variante, nicht den Basispreis', () => {
    expect(priceForPlanKey('growth')).toBe(249);
    expect(priceForPlanKey('growth_yearly')).toBe(2490);
    expect(priceForPlanKey('scale_yearly')).toBe(19000);
  });

  it('resolvePlan akzeptiert Plan, PlanId und Plan-Key', () => {
    expect(resolvePlan(planById('growth'))?.id).toBe('growth');
    expect(resolvePlan('growth')?.id).toBe('growth');
    expect(resolvePlan('growth_yearly')?.id).toBe('growth');
    expect(resolvePlan('scale')?.id).toBe('partner');
    expect(resolvePlan(undefined)).toBeNull();
  });
});

describe('Pricing SSoT — Checkout-Ziele', () => {
  it('erzeugt für jeden Plan ein internes Ziel passend zum Kaufmodus', () => {
    for (const plan of PLANS) {
      const href = checkoutHrefForPlan(plan);
      expect(href.startsWith('/'), `${plan.id}: ${href}`).toBe(true);
      if (plan.purchaseMode === 'free') expect(href).toContain('/audit');
      if (plan.purchaseMode === 'inquiry') expect(href).toContain('/contact-sales');
      if (plan.purchaseMode === 'checkout') expect(href).toContain(`/checkout/${plan.planKey}`);
      // Einmalprodukte nutzen denselben Checkout-Einstieg wie Abos; der
      // Kaufmodus wird serverseitig aus der SSoT abgeleitet, nicht aus der URL.
      if (plan.purchaseMode === 'one_time') expect(href).toContain(`/checkout/${plan.planKey}`);
    }
  });

  it('hängt an Einmalprodukte keinen Pilot-Trial-Parameter', () => {
    // Ein Trial ist ohne Subscription nicht darstellbar — `pilot=true` würde
    // in der Edge Function ins Leere laufen.
    for (const plan of ONE_TIME_PLANS) {
      expect(checkoutHrefForPlan(plan)).not.toContain('pilot');
      expect(plan.trialDays).toBe(0);
    }
  });

  it('verwendet für Jahresvarianten den Jahres-Plan-Key', () => {
    expect(checkoutHrefForPlan('growth', { interval: 'year' })).toContain('/checkout/growth_yearly');
  });
});

describe('Governance Score → Planempfehlung', () => {
  it('empfiehlt Partner, sobald mehr Mandanten als Enterprise nötig sind', () => {
    expect(recommendPlan({ score: 95, tenants: 20 }).planId).toBe('partner');
  });

  it('empfiehlt Enterprise bei mehreren Organisationen', () => {
    expect(recommendPlan({ score: 95, tenants: 3 }).planId).toBe('enterprise');
  });

  it('empfiehlt Agency bei API- oder White-Label-Bedarf', () => {
    expect(recommendPlan({ score: 90, needsApi: true }).planId).toBe('agency');
    expect(recommendPlan({ score: 90, needsWhiteLabel: true }).planId).toBe('agency');
    expect(recommendPlan({ score: 90, domains: 8 }).planId).toBe('agency');
  });

  it('leitet aus niedrigem Score einen laufenden Betrieb ab', () => {
    expect(recommendPlan({ score: 20 }).planId).toBe('growth');
    expect(recommendPlan({ score: 55 }).planId).toBe('growth');
    expect(recommendPlan({ score: 85 }).planId).toBe('starter');
  });

  it('liefert immer eine Begründung für den CTA', () => {
    for (const score of [0, 30, 60, 90, 100]) {
      expect(recommendPlan({ score }).reason.length).toBeGreaterThan(10);
    }
  });
});

describe('Pricing SSoT — Einmalprodukte', () => {
  it('kennt Governance Launch als Einmalkauf zu 349 €', () => {
    const plan = planByKey('governance_launch');
    expect(plan).not.toBeNull();
    expect(plan!.purchaseMode).toBe('one_time');
    expect(plan!.name).toBe('Governance Launch');
    // Der Betrag steht in `oneTimeEur`; `monthlyEur` ist 0, weil nichts
    // wiederkehrend abgerechnet wird.
    expect(plan!.price.oneTimeEur).toBe(349);
    expect(plan!.price.monthlyEur).toBe(0);
    expect(plan!.price.yearlyEur).toBeNull();
    expect(priceForPlanKey('governance_launch')).toBe(349);
    expect(intervalForPlanKey('governance_launch')).toBe('one_time');
  });

  it('isOneTimePlan trennt Einmalkäufe von Abos', () => {
    expect(isOneTimePlan('governance_launch')).toBe(true);
    expect(isOneTimePlan('starter')).toBe(false);
    expect(isOneTimePlan('free_audit')).toBe(false);
    expect(isOneTimePlan('unbekannt')).toBe(false);
    expect(isOneTimePlan(null)).toBe(false);
  });

  it('ONE_TIME_PLANS enthält genau die Pläne mit purchaseMode one_time', () => {
    expect(ONE_TIME_PLANS.length).toBeGreaterThan(0);
    expect(ONE_TIME_PLANS.every((p) => p.purchaseMode === 'one_time')).toBe(true);
    expect(ONE_TIME_PLANS.map((p) => p.id)).toEqual(
      PLANS.filter((p) => p.purchaseMode === 'one_time').map((p) => p.id),
    );
  });

  it('hält Einmalprodukte von der Abo-Leiter fern', () => {
    for (const plan of ONE_TIME_PLANS) {
      // Nicht auf der Leiter: sonst würden die Monotonie-Invarianten
      // (Module/Berechtigungen/Limits wachsen) fälschlich auf ein
      // Einmalprodukt angewandt.
      expect(PLAN_ORDER).not.toContain(plan.id);
      expect(planRank(plan.id)).toBe(-1);
      expect(plan.yearlyPlanKey).toBeNull();
    }
  });

  it('behandelt Einmalprodukte in isUpgrade als unvergleichbar', () => {
    // Ohne Sonderfall würde Rang -1 jedes Abo als „Upgrade" ausweisen und
    // nachgelagerte PLAN_ORDER.slice(-1, …)-Pfade leerlaufen lassen.
    expect(isUpgrade('governance_launch', 'growth')).toBe(false);
    expect(isUpgrade('growth', 'governance_launch')).toBe(false);
  });

  it('löst Einmalprodukte über jeden Auflösungsweg auf', () => {
    // resolvePlan() nimmt den PlanId-Pfad nur, wenn isPlanId() greift —
    // deshalb muss isPlanId() auch Pläne abseits der Leiter kennen.
    expect(isPlanId('governance_launch')).toBe(true);
    expect(resolvePlan('governance_launch')?.id).toBe('governance_launch');
    expect(planById('governance_launch').planKey).toBe('governance_launch');
    expect(allPlanKeys()).toContain('governance_launch');
  });

  it('verspricht kein Limit ohne die zugehörige Berechtigung', () => {
    // Ein Kontingent > 0, das kein Gate freigibt, würde in der
    // Limit-Anzeige einen Umfang vorspiegeln, den der Plan nicht hat.
    for (const plan of PLANS) {
      if (!plan.permissions.api) {
        expect(plan.limits.apiCallsPerMonth, `${plan.id}.apiCallsPerMonth`).toBe(0);
        expect(plan.limits.apiKeys, `${plan.id}.apiKeys`).toBe(0);
      }
      if (!plan.permissions.bulkOperations) {
        expect(plan.limits.bulkJobsPerMonth, `${plan.id}.bulkJobsPerMonth`).toBe(0);
      }
    }
  });

  it('verspricht keine Behebungspläne ohne das Modul remediation', () => {
    // Bekannte Altabweichung: `starter` führt remediationPlans = 5, hat das
    // Modul `remediation` aber nicht — `hasFeature(plan, 'fix_snippets')` ist
    // dort also false, während die Limit-Anzeige 5 Pläne verspricht. Das ist
    // eine Produktentscheidung (Limit senken oder Modul ergänzen) und wird
    // hier bewusst nur festgehalten, nicht stillschweigend korrigiert.
    const KNOWN_DRIFT: string[] = ['starter'];
    for (const plan of PLANS) {
      if (plan.modules.includes('remediation')) continue;
      if (KNOWN_DRIFT.includes(plan.id)) continue;
      expect(plan.limits.remediationPlans, `${plan.id}.remediationPlans`).toBe(0);
    }
    // Die Ausnahmeliste darf nicht wachsen, ohne dass es auffällt.
    expect(KNOWN_DRIFT).toEqual(['starter']);
  });
});

describe('Abgeleitete Artefakte bleiben synchron', () => {
  it('supabase/functions/_shared/pricing.generated.ts entspricht shared/pricing.ts', () => {
    const source = readFileSync(join(ROOT, 'shared', 'pricing.ts'), 'utf8');
    const generated = readFileSync(
      join(ROOT, 'supabase', 'functions', '_shared', 'pricing.generated.ts'),
      'utf8',
    );
    expect(generated).toBe(buildGenerated(source));
  });

  it('die Plan-Katalog-Migration entspricht shared/pricing.ts', () => {
    const migrationsDir = join(ROOT, 'supabase', 'migrations');
    const catalogMigration = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('_canonical_plan_catalog.sql'))
      .sort()
      .pop();
    expect(catalogMigration, 'Katalog-Migration nicht gefunden').toBeDefined();
    const sql = readFileSync(join(migrationsDir, catalogMigration!), 'utf8');
    expect(sql).toContain(buildPlanCatalogSql());
  });
});

/**
 * COMMERCIAL-SSOT: temporary production hotfix.
 * Canonical source migration tracked in Phase 2.
 *
 * Produktions-Sicherheit: Ein öffentlich ausgewiesener Festpreis ist ein
 * Angebot. Es darf nur dort stehen, wo der Self-Service-Checkout es auch
 * einlösen kann. Enterprise verletzte das — 1.249 €/Monat plus 14-Tage-Trial
 * standen öffentlich, während `public.products` für den Plan-Key nur einen
 * Sentinel trägt und `stripe-checkout` jeden Versuch mit
 * `PRICE_NOT_CONFIGURED` abweist.
 */
describe('Öffentliche Angebote sind erfüllbar', () => {
  it('kein Self-Service-Plan verbirgt seinen Preis', () => {
    // Umgekehrter Fehlerfall: Wer kaufbar ist, muss den Preis auch nennen.
    for (const plan of PLANS.filter((p) => p.purchaseMode === 'checkout')) {
      expect(plan.priceOnRequest ?? false).toBe(false);
    }
  });

  it('ein Plan ohne öffentlichen Festpreis ist weder kaufbar noch testbar', () => {
    for (const plan of PLANS.filter((p) => p.priceOnRequest === true)) {
      // Kein Self-Service-Checkout …
      expect(plan.purchaseMode).toBe('inquiry');
      // … und damit auch kein Self-Service-Trial.
      expect(plan.trialDays).toBe(0);

      const href = checkoutHrefForPlan(plan, { interval: 'month' });
      expect(href).toContain('/contact-sales');
      expect(href).not.toContain('/checkout/');
      expect(href).not.toContain('pilot=true');
    }
  });

  it('Enterprise ist anfragepflichtig, ohne Festpreis und ohne Trial', () => {
    const enterprise = planById('enterprise');
    expect(enterprise.purchaseMode).toBe('inquiry');
    expect(enterprise.priceOnRequest).toBe(true);
    expect(enterprise.trialDays).toBe(0);

    // Auch die Jahresvariante darf keinen Kaufpfad öffnen.
    for (const interval of ['month', 'year'] as const) {
      const href = checkoutHrefForPlan(enterprise, { interval });
      expect(href).not.toContain('/checkout/');
      expect(href).not.toContain('pilot=true');
    }
  });

  it('ein Trial-Versprechen setzt einen Self-Service-Checkout voraus', () => {
    // Verhindert die Rückkehr des Enterprise-Falls über einen anderen Plan:
    // Trial-Tage ohne Checkout wären ein Versprechen ohne Einlöseweg.
    for (const plan of PLANS.filter((p) => p.trialDays > 0)) {
      expect(plan.purchaseMode).toBe('checkout');
    }
  });
});

/**
 * COMMERCIAL-SSOT: temporary production hotfix.
 * Canonical source migration tracked in Phase 2.
 *
 * Nachgezogen nach einem Fund auf der Cloudflare-Preview: die Plan-Karte
 * zeigte bereits „Auf Anfrage", während der ROI-Rechner daneben weiterhin
 * „Enterprise 1249 €/Mo" rechnete und daraus eine konkrete Ersparnis ableitete.
 * Ursache: der Rechner las `tier.priceEur` aus `PUBLIC_PRICING_TIERS` und
 * umging damit `priceOnRequest`. Ein Literal-Grep nach „1249" findet so etwas
 * nicht — der Betrag stammte aus der SSoT, nicht aus dem Quelltext.
 */
describe('Rechen-Oberflächen führen keinen Plan ohne Festpreis', () => {
  it('CALCULABLE_PRICING_TIERS enthält keinen Auf-Anfrage-Plan', () => {
    for (const tier of CALCULABLE_PRICING_TIERS) {
      expect(tier.priceOnRequest).toBe(false);
      // Jeder verbleibende Tier muss einen echten Betrag haben — sonst
      // rechnet der ROI-Rechner mit 0 und behauptet falsche Ersparnisse.
      expect(tier.priceEur).toBeGreaterThan(0);
    }
  });

  it('genau die Auf-Anfrage-Pläne fehlen gegenüber PUBLIC_PRICING_TIERS', () => {
    const excluded = PUBLIC_PRICING_TIERS
      .filter((tier) => !CALCULABLE_PRICING_TIERS.includes(tier))
      .map((tier) => tier.plan.id);
    const onRequest = PUBLIC_PRICING_TIERS
      .filter((tier) => tier.priceOnRequest)
      .map((tier) => tier.plan.id);
    expect(excluded).toEqual(onRequest);
  });
});
