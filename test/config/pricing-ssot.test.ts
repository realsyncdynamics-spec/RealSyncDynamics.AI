import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADDONS,
  ALL_MODULES,
  FEATURE_GROUPS,
  ORDERED_PLANS,
  PLANS,
  PLAN_ORDER,
  PRODUCT_AREAS,
  POLICY_PACK_IDS,
  RUNTIME_PIPELINE,
  addonsFor,
  allPlanKeys,
  checkoutHrefForPlan,
  isUpgrade,
  normalizePlanKey,
  planByKey,
  planById,
  priceForPlanKey,
  recommendPlan,
  resolvePlan,
} from '../../shared/pricing';
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
  it('definiert exakt sechs Pläne mit den vorgegebenen Preisen', () => {
    expect(PLANS).toHaveLength(6);
    expect(ORDERED_PLANS.map((p) => [p.id, p.price.monthlyEur])).toEqual([
      ['free', 0],
      ['starter', 79],
      ['growth', 249],
      ['agency', 699],
      ['enterprise', 1249],
      ['partner', 1999],
    ]);
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
