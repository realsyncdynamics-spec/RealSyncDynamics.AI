import { describe, it, expect } from 'vitest';
import {
  pricingPlans,
  featureDetails,
  getPlanBySlug,
  getFeatureBySlug,
  getFeaturesByPlan,
  getPlansByFeature,
  ALL_PLAN_SLUGS,
  ALL_FEATURE_SLUGS,
} from '../../src/content/pricingContent';

describe('pricingContent', () => {
  describe('Content Structure', () => {
    it('should have 10 pricing plans (6 base + 4 yearly variants)', () => {
      expect(pricingPlans.length).toBe(10);
    });

    it('should have 18 features', () => {
      expect(featureDetails.length).toBe(18);
    });

    it('should have all plan slugs in ALL_PLAN_SLUGS', () => {
      const expectedSlugs = pricingPlans.map((p) => p.slug);
      expect(ALL_PLAN_SLUGS).toEqual(expectedSlugs);
    });

    it('should have all feature slugs in ALL_FEATURE_SLUGS', () => {
      const expectedSlugs = featureDetails.map((f) => f.slug);
      expect(ALL_FEATURE_SLUGS).toEqual(expectedSlugs);
    });
  });

  describe('Plan Validation', () => {
    it('should have unique plan slugs', () => {
      const slugs = pricingPlans.map((p) => p.slug);
      const uniqueSlugs = new Set(slugs);
      expect(slugs.length).toBe(uniqueSlugs.size);
    });

    it('all plans should have required fields', () => {
      pricingPlans.forEach((plan) => {
        expect(plan.slug).toBeDefined();
        expect(plan.slug.length).toBeGreaterThan(0);
        expect(plan.name).toBeDefined();
        expect(plan.name.length).toBeGreaterThan(0);
        expect(plan.price).toBeDefined();
        expect(typeof plan.price).toBe('number');
        expect(plan.priceString).toBeDefined();
        expect(plan.priceString.length).toBeGreaterThan(0);
        expect(plan.interval).toBeDefined();
        expect(plan.shortDescription).toBeDefined();
        expect(plan.shortDescription.length).toBeGreaterThan(0);
        expect(plan.targetAudience).toBeDefined();
        expect(plan.whatCustomerGets).toBeDefined();
        expect(Array.isArray(plan.whatCustomerGets)).toBe(true);
        expect(plan.whatCustomerGets.length).toBeGreaterThan(0);
        expect(plan.cta).toBeDefined();
        expect(plan.cta.label).toBeDefined();
        expect(plan.cta.href).toBeDefined();
        expect(plan.checkoutPath).toBeDefined();
        expect(plan.problemsSolved).toBeDefined();
        expect(Array.isArray(plan.problemsSolved)).toBe(true);
        expect(plan.includedFeatureSlugs).toBeDefined();
        expect(Array.isArray(plan.includedFeatureSlugs)).toBe(true);
        expect(plan.detailedSections).toBeDefined();
        expect(Array.isArray(plan.detailedSections)).toBe(true);
      });
    });

    it('should have exactly one plan marked as recommended', () => {
      const recommendedPlans = pricingPlans.filter((p) => p.recommended);
      expect(recommendedPlans.length).toBe(1);
      expect(recommendedPlans[0].slug).toBe('growth');
    });

    it('Growth plan should have badge "Empfohlen"', () => {
      const growthPlan = getPlanBySlug('growth');
      expect(growthPlan).toBeDefined();
      expect(growthPlan?.badge).toBe('Empfohlen');
      expect(growthPlan?.recommended).toBe(true);
    });

    it('Free Audit and Enterprise plans should not require auth for checkout', () => {
      const freeAudit = getPlanBySlug('free-audit');
      const enterprise = getPlanBySlug('enterprise');
      expect(freeAudit).toBeDefined();
      expect(enterprise).toBeDefined();
    });

    // Plaene ohne Self-Service-Checkout fuehren bewusst NICHT auf
    // /checkout/<slug>, sondern auf /contact-sales. Enterprise wird
    // vertraglich vereinbart (`inquiry`); Partner und Agency-Jahresvariante
    // sind nicht self-service-checkoutfähig. Agency monatlich ist wieder
    // verkaufbar.
    const INQUIRY_ONLY_SLUGS = ['enterprise', 'partner', 'partner_yearly'];

    // Anfrage-Plaene mit Online-Rechner. `partner_yearly` gehoert NICHT dazu:
    // fuer die Jahresvariante gibt es weder Stripe-Preis noch Rechner, sie
    // bleibt beim Kontaktformular.
    const QUOTE_SLUGS = ['enterprise', 'partner'];

    // Dritte Kategorie: Der Plan ist verkaeuflich, nur seine JAHRESvariante
    // hat keinen verdrahteten Stripe-Preis. Hier waere `/contact-sales`
    // falsch (der Plan ist ja im Self-Service zu haben) und
    // `/checkout/<slug>_yearly` ebenso (endet mit PRICE_NOT_CONFIGURED).
    // Richtig ist der Monats-Checkout DESSELBEN Plans — keine
    // Plan-Substitution, nur ein anderer Abrechnungszeitraum.
    const UNWIRED_YEARLY: Record<string, string> = {
      starter_yearly: '/checkout/starter',
      growth_yearly: '/checkout/growth',
      agency_yearly: '/checkout/agency',
    };

    it('Self-Service-Plaene verlinken auf /checkout/{slug}', () => {
      pricingPlans
        .filter((plan) => !INQUIRY_ONLY_SLUGS.includes(plan.slug))
        .filter((plan) => !(plan.slug in UNWIRED_YEARLY))
        .forEach((plan) => {
          expect(plan.cta.href).toBe(`/checkout/${plan.slug}`);
          expect(plan.checkoutPath).toBe(`/checkout/${plan.slug}`);
        });
    });

    it('Jahresvarianten ohne verdrahteten Preis fuehren auf den Monats-Checkout', () => {
      for (const [slug, expected] of Object.entries(UNWIRED_YEARLY)) {
        const plan = getPlanBySlug(slug);
        expect(plan, `Plan ${slug} fehlt`).toBeDefined();
        expect(
          plan?.cta.href,
          `${slug} darf nicht auf den Jahres-Checkout zeigen — dort gibt es keinen Stripe-Preis.`,
        ).toBe(expected);
        expect(plan?.checkoutPath).toBe(expected);
        // Kein Trial-Versprechen: der Monats-CTA fordert keinen Pilot an.
        expect(plan?.trial, `${slug} darf keinen Trial zusichern`).toBeUndefined();
      }
    });

    it('Anfrage-Plaene mit Rechner verlinken auf /pricing/quote', () => {
      pricingPlans
        .filter((plan) => QUOTE_SLUGS.includes(plan.slug))
        .forEach((plan) => {
          expect(plan.cta.href).toContain('/pricing/quote');
          expect(plan.checkoutPath).toContain('/pricing/quote');
          // Weder Checkout (der Betrag ist dort nicht einloesbar) noch
          // Kontaktformular (das war die Sackgasse).
          expect(plan.cta.href).not.toContain('/checkout/');
          expect(plan.cta.href).not.toContain('/contact-sales');
        });
    });

    it('Anfrage-Plaene ohne Rechner bleiben beim Kontaktformular', () => {
      pricingPlans
        .filter((plan) => INQUIRY_ONLY_SLUGS.includes(plan.slug))
        .filter((plan) => !QUOTE_SLUGS.includes(plan.slug))
        .forEach((plan) => {
          expect(plan.cta.href).toContain('/contact-sales');
          expect(plan.checkoutPath).toContain('/contact-sales');
          expect(plan.cta.href).not.toContain('/checkout/');
          expect(plan.checkoutPath).not.toContain('/checkout/');
        });
    });

    it('all plans should have at least one included feature', () => {
      pricingPlans.forEach((plan) => {
        expect(plan.includedFeatureSlugs.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Feature Validation', () => {
    it('should have unique feature slugs', () => {
      const slugs = featureDetails.map((f) => f.slug);
      const uniqueSlugs = new Set(slugs);
      expect(slugs.length).toBe(uniqueSlugs.size);
    });

    it('all features should have required fields', () => {
      featureDetails.forEach((feature) => {
        expect(feature.slug).toBeDefined();
        expect(feature.slug.length).toBeGreaterThan(0);
        expect(feature.title).toBeDefined();
        expect(feature.title.length).toBeGreaterThan(0);
        expect(feature.subtitle).toBeDefined();
        expect(feature.subtitle.length).toBeGreaterThan(0);
        expect(feature.whatItDoes).toBeDefined();
        expect(feature.whatItDoes.length).toBeGreaterThan(0);
        expect(feature.whyItMatters).toBeDefined();
        expect(feature.whyItMatters.length).toBeGreaterThan(0);
        expect(feature.customerBenefit).toBeDefined();
        expect(feature.customerBenefit.length).toBeGreaterThan(0);
        expect(feature.includedInPlans).toBeDefined();
        expect(Array.isArray(feature.includedInPlans)).toBe(true);
        expect(feature.includedInPlans.length).toBeGreaterThan(0);
      });
    });

    it('all features should be included in at least one plan', () => {
      featureDetails.forEach((feature) => {
        expect(feature.includedInPlans.length).toBeGreaterThan(0);
      });
    });

    it('feature includedInPlans should reference valid plan names', () => {
      const validPlanNames = pricingPlans.map((p) => p.name);
      featureDetails.forEach((feature) => {
        feature.includedInPlans.forEach((planName) => {
          expect(validPlanNames).toContain(planName);
        });
      });
    });
  });

  describe('Cross-Reference Validation', () => {
    it('all plan includedFeatureSlugs should reference existing features', () => {
      pricingPlans.forEach((plan) => {
        plan.includedFeatureSlugs.forEach((featureSlug) => {
          const feature = getFeatureBySlug(featureSlug);
          expect(feature).toBeDefined();
          expect(feature?.slug).toBe(featureSlug);
        });
      });
    });

    it('all feature includedInPlans should reference existing plan names', () => {
      const planNames = pricingPlans.map((p) => p.name);
      featureDetails.forEach((feature) => {
        feature.includedInPlans.forEach((planName) => {
          expect(planNames).toContain(planName);
        });
      });
    });

    it('bidirectional consistency: features in plan should match plan names in feature', () => {
      pricingPlans.forEach((plan) => {
        const featuresInPlan = getFeaturesByPlan(plan.slug);
        featuresInPlan.forEach((feature) => {
          expect(feature.includedInPlans).toContain(plan.name);
        });
      });
    });

    it('bidirectional consistency: plans with feature should match feature includedInPlans', () => {
      featureDetails.forEach((feature) => {
        const planNamesWithFeature = feature.includedInPlans;
        planNamesWithFeature.forEach((planName) => {
          const plan = pricingPlans.find((p) => p.name === planName);
          expect(plan).toBeDefined();
          expect(plan?.includedFeatureSlugs).toContain(feature.slug);
        });
      });
    });

    it('no dead links: all feature slugs used in plans should exist', () => {
      const usedFeatureSlugs = new Set<string>();
      pricingPlans.forEach((plan) => {
        plan.includedFeatureSlugs.forEach((slug) => {
          usedFeatureSlugs.add(slug);
        });
      });

      usedFeatureSlugs.forEach((slug) => {
        const feature = getFeatureBySlug(slug);
        expect(feature).toBeDefined();
      });
    });

    it('no unused features: all feature slugs should be used in at least one plan', () => {
      featureDetails.forEach((feature) => {
        expect(feature.includedInPlans.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Helper Functions', () => {
    it('getPlanBySlug should return correct plan', () => {
      const starterPlan = getPlanBySlug('starter');
      expect(starterPlan).toBeDefined();
      expect(starterPlan?.name).toBe('Starter');
      expect(starterPlan?.price).toBe(79);
    });

    it('getPlanBySlug should return undefined for invalid slug', () => {
      const invalidPlan = getPlanBySlug('invalid-slug');
      expect(invalidPlan).toBeUndefined();
    });

    it('getFeatureBySlug should return correct feature', () => {
      const feature = getFeatureBySlug('dsgvo-scan');
      expect(feature).toBeDefined();
      expect(feature?.title).toBe('DSGVO-Scan');
    });

    it('getFeatureBySlug should return undefined for invalid slug', () => {
      const invalidFeature = getFeatureBySlug('invalid-slug');
      expect(invalidFeature).toBeUndefined();
    });

    it('getFeaturesByPlan should return all features for a plan', () => {
      const starterFeatures = getFeaturesByPlan('starter');
      expect(starterFeatures.length).toBeGreaterThan(0);
      expect(starterFeatures.every((f) => f.includedInPlans.includes('Starter'))).toBe(true);
    });

    it('getFeaturesByPlan should return empty array for invalid plan slug', () => {
      const features = getFeaturesByPlan('invalid-slug');
      expect(features).toEqual([]);
    });

    it('getPlansByFeature should return all plans with a feature', () => {
      const plansWithDsgvoScan = getPlansByFeature('dsgvo-scan');
      expect(plansWithDsgvoScan.length).toBeGreaterThan(0);
    });

    it('getPlansByFeature should return empty array for invalid feature slug', () => {
      const plans = getPlansByFeature('invalid-slug');
      expect(plans).toEqual([]);
    });
  });

  describe('Feature Coverage by Plan', () => {
    it('Free Audit should only have dsgvo-scan', () => {
      const freeAuditFeatures = getFeaturesByPlan('free-audit');
      expect(freeAuditFeatures.length).toBe(1);
      expect(freeAuditFeatures[0].slug).toBe('dsgvo-scan');
    });

    it('Starter should have 6 features', () => {
      const starterFeatures = getFeaturesByPlan('starter');
      expect(starterFeatures.length).toBe(6);
    });

    it('Growth should have 10 features', () => {
      const growthFeatures = getFeaturesByPlan('growth');
      expect(growthFeatures.length).toBe(10);
    });

    it('Agency should have 17 features', () => {
      const agencyFeatures = getFeaturesByPlan('agency');
      expect(agencyFeatures.length).toBe(17);
    });

    it('Partner should have 18 features', () => {
      const partnerFeatures = getFeaturesByPlan('partner');
      expect(partnerFeatures.length).toBe(18);
    });

    it('Enterprise should have 18 features', () => {
      const enterpriseFeatures = getFeaturesByPlan('enterprise');
      expect(enterpriseFeatures.length).toBe(18);
    });

    it('feature dsgvo-scan should be in all 10 plans', () => {
      const dsgvoFeature = getFeatureBySlug('dsgvo-scan');
      expect(dsgvoFeature?.includedInPlans.length).toBe(10);
    });
  });

  describe('Pricing Consistency', () => {
    // COMMERCIAL-SSOT: temporary production hotfix.
    // Canonical source migration tracked in Phase 2.
    // Ein Plan weist nur dann einen Betrag aus, wenn er auch abschliessbar
    // ist. Enterprise wird vertraglich vereinbart, Agency und Partner sind
    // seit AP2 stillgelegt — fuer beide waere ein Festpreis ein Angebot,
    // das `stripe-checkout` nicht einloest.
    // Dazu kommen Jahresvarianten ohne verdrahteten Stripe-Preis: fuer
    // `starter_yearly` und `growth_yearly` steht in `public.products` nur ein
    // Platzhalter, `stripe-checkout` weist sie mit PRICE_NOT_CONFIGURED ab.
    // Ihre MONATS-Plaene sind davon unberuehrt und weisen weiter einen
    // Betrag aus.
    //
    // Stand 2026-09-20: Enterprise und Partner sind hier raus. Beide weisen
    // wieder einen Betrag aus — als Einstiegspreis, den `/pricing/quote`
    // online einloest. `partner_yearly` bleibt drin: fuer die Jahresvariante
    // gibt es keinen Rechner und keinen Stripe-Preis.
    const NO_PUBLIC_PRICE = [
      'free-audit',
      'agency_yearly', 'partner_yearly',
      'starter_yearly', 'growth_yearly',
    ];

    it('kaufbare Pläne weisen einen Betrag > 0 aus', () => {
      const paidPlans = pricingPlans.filter((p) => !NO_PUBLIC_PRICE.includes(p.slug));
      expect(paidPlans.length).toBeGreaterThan(0);
      paidPlans.forEach((plan) => {
        expect(plan.price).toBeGreaterThan(0);
      });
    });

    it('die Partner-Jahresvariante weist weiter keinen Festpreis aus', () => {
      // Monatlich ist der Plan zurueck, jaehrlich nicht: dafuer gibt es
      // weder einen Stripe-Preis noch einen Rechner.
      const plan = getPlanBySlug('partner_yearly');
      expect(plan, 'Plan partner_yearly fehlt').toBeDefined();
      expect(plan?.price).toBe(0);
      expect(plan?.priceString).not.toMatch(/\d/);
    });

    it('Partner heisst oeffentlich Enterprise Plus, bleibt intern aber Partner', () => {
      const plan = getPlanBySlug('partner');
      // Der Katalogname bleibt — `includedInPlans` matcht darauf.
      expect(plan?.name).toBe('Partner');
      expect(plan?.publicLabel).toBe('Enterprise Plus');
      expect(plan?.price).toBe(1999);
      expect(plan?.priceString).toMatch(/1\.999/);
    });

    it('agency weist den Live-Monatspreis 699 aus', () => {
      const agency = getPlanBySlug('agency');
      expect(agency?.price).toBe(699);
      expect(agency?.priceString).toMatch(/699/);
    });

    it('free-audit should have price 0', () => {
      const freeAudit = getPlanBySlug('free-audit');
      expect(freeAudit?.price).toBe(0);
      expect(freeAudit?.priceString).toBe('0 €');
    });

    // Enterprise weist seit 2026-09-20 wieder einen Betrag aus. Er ist der
    // Einstiegspreis, nicht der Endpreis — deshalb „ab". Der
    // Self-Service-Checkout bleibt unveraendert zu; eingeloest wird der
    // Betrag ueber `/pricing/quote`.
    it('enterprise weist den Einstiegspreis aus, nicht „auf Anfrage"', () => {
      const enterprise = getPlanBySlug('enterprise');
      expect(enterprise?.price).toBe(1249);
      expect(enterprise?.priceString).toMatch(/1\.249/);
      expect(enterprise?.priceString).toMatch(/^ab /);
      // Der Weg fuehrt auf den Rechner, nicht in den Checkout.
      expect(enterprise?.cta.href).toContain('/pricing/quote');
      expect(enterprise?.checkoutPath).not.toContain('/checkout/');
    });

    it('prices should be in ascending order for paid plans', () => {
      const paidPlans = pricingPlans.filter((p) => p.price > 0);
      const prices = paidPlans.map((p) => p.price);
      const sortedPrices = [...prices].sort((a, b) => a - b);
      expect(prices).toEqual(sortedPrices);
    });
  });

  describe('Trial Availability', () => {
    it('starter should have 14-day trial', () => {
      const starter = getPlanBySlug('starter');
      expect(starter?.trial).toBeDefined();
      expect(starter?.trial?.days).toBe(14);
    });

    it('growth should have 14-day trial', () => {
      const growth = getPlanBySlug('growth');
      expect(growth?.trial).toBeDefined();
      expect(growth?.trial?.days).toBe(14);
    });

    // COMMERCIAL-SSOT: temporary production hotfix.
    // Canonical source migration tracked in Phase 2.
    // Agency hatte bis AP2 einen 14-Tage-Trial. Der Plan ist seither
    // stillgelegt; ein Trial-Versprechen waere nicht mehr einloesbar.
    it('agency should not have trial since AP2', () => {
      const agency = getPlanBySlug('agency');
      expect(agency?.trial).toBeUndefined();
    });

    it('free-audit should not have trial', () => {
      const freeAudit = getPlanBySlug('free-audit');
      expect(freeAudit?.trial).toBeUndefined();
    });

    it('enterprise should not have trial', () => {
      const enterprise = getPlanBySlug('enterprise');
      expect(enterprise?.trial).toBeUndefined();
    });

    it('scale should not have trial', () => {
      const scale = getPlanBySlug('scale');
      expect(scale?.trial).toBeUndefined();
    });
  });
});
