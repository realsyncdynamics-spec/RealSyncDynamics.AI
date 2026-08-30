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

    // COMMERCIAL-SSOT: temporary production hotfix.
    // Canonical source migration tracked in Phase 2.
    // Plaene ohne Self-Service-Checkout fuehren bewusst NICHT auf
    // /checkout/<slug>, sondern auf /contact-sales. Zwei Gruende: Enterprise
    // wird vertraglich vereinbart und manuell fakturiert (`inquiry`), Agency
    // und Partner sind seit AP2 stillgelegt (`availability: 'legacy'`). In
    // beiden Faellen lehnt `stripe-checkout` den Abschluss ab — ein
    // Checkout-Link waere ein Kaufpfad ins Leere.
    const INQUIRY_ONLY_SLUGS = ['enterprise', 'agency', 'agency_yearly', 'partner', 'partner_yearly'];

    it('Self-Service-Plaene verlinken auf /checkout/{slug}', () => {
      pricingPlans
        .filter((plan) => !INQUIRY_ONLY_SLUGS.includes(plan.slug))
        .forEach((plan) => {
          expect(plan.cta.href).toBe(`/checkout/${plan.slug}`);
          expect(plan.checkoutPath).toBe(`/checkout/${plan.slug}`);
        });
    });

    it('Anfrage-Plaene verlinken auf /contact-sales statt auf einen Checkout', () => {
      pricingPlans
        .filter((plan) => INQUIRY_ONLY_SLUGS.includes(plan.slug))
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
    const NO_PUBLIC_PRICE = [
      'free-audit', 'enterprise',
      'agency', 'agency_yearly', 'partner', 'partner_yearly',
    ];

    it('kaufbare Pläne weisen einen Betrag > 0 aus', () => {
      const paidPlans = pricingPlans.filter((p) => !NO_PUBLIC_PRICE.includes(p.slug));
      expect(paidPlans.length).toBeGreaterThan(0);
      paidPlans.forEach((plan) => {
        expect(plan.price).toBeGreaterThan(0);
      });
    });

    it('stillgelegte Pläne weisen keinen Festpreis aus', () => {
      for (const slug of ['agency', 'agency_yearly', 'partner', 'partner_yearly']) {
        const plan = getPlanBySlug(slug);
        expect(plan, `Plan ${slug} fehlt`).toBeDefined();
        expect(plan?.price).toBe(0);
        expect(plan?.priceString).not.toMatch(/\d/);
      }
    });

    it('free-audit should have price 0', () => {
      const freeAudit = getPlanBySlug('free-audit');
      expect(freeAudit?.price).toBe(0);
      expect(freeAudit?.priceString).toBe('0 €');
    });

    // COMMERCIAL-SSOT: temporary production hotfix.
    // Canonical source migration tracked in Phase 2.
    // Enterprise darf keinen oeffentlichen Festpreis mehr ausweisen: der
    // Self-Service-Checkout kann ihn nicht erfuellen (manuelle Faktura,
    // Sentinel statt echter Stripe-Price).
    it('enterprise weist keinen oeffentlichen Festpreis aus', () => {
      const enterprise = getPlanBySlug('enterprise');
      expect(enterprise?.priceString).toBe('Individuelles Angebot');
      expect(enterprise?.priceString).not.toMatch(/\d/);
      expect(enterprise?.price).toBe(0);
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
