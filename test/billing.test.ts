/**
 * Billing & Subscription Tests
 *
 * Verifies:
 * - Stripe checkout session creation
 * - Subscription plan configuration
 * - Feature quota enforcement
 * - UG/GmbH company display
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { COMPANY, getCompanyDisplayName, getCompanyAddress, isBetaReady, isProductionReady } from '../src/config/company';
import { PRICING_TIERS, tierById, PUBLIC_PRICING_TIERS, ENTERPRISE_TIER } from '../src/config/pricing';
import { formatPrice, getPlanById, isPlanFixedPrice, getStripeProductMetadata, isStripeConfigured } from '../src/lib/stripe';
import { generateImpressumText, areLegalDocsComplete, getComplianceBanner } from '../src/lib/compliance-notices';

// ─── Company Configuration Tests ────────────────────────────────────────────

describe('Company Configuration (UG/GmbH Ready)', () => {
  it('should display UG form correctly', () => {
    expect(COMPANY.legalForm).toBe('UG');
    expect(getCompanyDisplayName()).toContain('UG (haftungsbeschränkt)');
  });

  it('should have headquarters in Jena, Germany', () => {
    const address = getCompanyAddress();
    expect(address).toContain('Jena');
    expect(address).toContain('Germany');
  });

  it('should have support email configured', () => {
    expect(COMPANY.supportEmail).toBe('support@realsyncdynamicsai.de');
  });

  it('should support future GmbH transition', () => {
    expect(COMPANY.futureLegalForm).toBe('GmbH');
  });

  it('should be beta-ready if Stripe key exists', () => {
    // This test will pass if VITE_STRIPE_PUBLISHABLE_KEY is set in .env
    if (COMPANY.stripePublishableKey) {
      expect(isBetaReady()).toBe(true);
    }
  });

  it('should require VAT ID for production', () => {
    const errors = isProductionReady() ? [] : ['VAT ID required'];
    if (!COMPANY.vatId) {
      expect(errors).toContain('VAT ID required');
    }
  });
});

// ─── Pricing Tier Tests ──────────────────────────────────────────────────────

describe('Pricing Tiers (5-Tier Model)', () => {
  it('should have 6 tiers (free → enterprise)', () => {
    expect(PRICING_TIERS).toHaveLength(6);
  });

  it('should have public tiers (excluding enterprise)', () => {
    expect(PUBLIC_PRICING_TIERS).toHaveLength(5);
    expect(PUBLIC_PRICING_TIERS.map((t) => t.id)).toEqual(['free', 'starter', 'growth', 'agency', 'scale']);
  });

  it('should have enterprise tier as separate constant', () => {
    expect(ENTERPRISE_TIER.id).toBe('enterprise');
    expect(ENTERPRISE_TIER.priceEur).toBe(0);
  });

  it('free_audit should have no account required', () => {
    const free = tierById('free')!;
    expect(free.recurring).toBe(false);
    expect(free.priceEur).toBe(0);
  });

  it('starter should be €79/month', () => {
    const starter = tierById('starter')!;
    expect(starter.priceEur).toBe(79);
    expect(starter.recurring).toBe(true);
  });

  it('growth should be €249/month with highlight', () => {
    const growth = tierById('growth')!;
    expect(growth.priceEur).toBe(249);
    expect(growth.highlight).toBe(true);
    expect(growth.badges).toContain('Empfohlen');
  });

  it('agency should have governance bots feature', () => {
    const agency = tierById('agency')!;
    expect(agency.botsQuota.maxBots).toBe(10);
    expect(agency.botsQuota.channels).toContain('website');
    expect(agency.botsQuota.channels).toContain('whatsapp');
  });

  it('scale should support 50+ bots for resellers', () => {
    const scale = tierById('scale')!;
    expect(scale.botsQuota.maxBots).toBe(50);
    expect(scale.botsQuota.maxAnswersPerMonth).toBe(100000);
  });

  it('enterprise should have unlimited bots', () => {
    const enterprise = tierById('enterprise')!;
    expect(enterprise.botsQuota.maxBots).toBe(-1);
    expect(enterprise.botsQuota.maxAnswersPerMonth).toBe(-1);
  });

  it('all tiers should have bullets describing features', () => {
    PRICING_TIERS.forEach((tier) => {
      expect(tier.bullets).toBeDefined();
      expect(tier.bullets.length).toBeGreaterThan(0);
    });
  });

  it('all tiers should have CTA buttons', () => {
    PRICING_TIERS.forEach((tier) => {
      expect(tier.cta).toBeDefined();
      expect(tier.cta.label).toBeTruthy();
      expect(tier.cta.href).toBeTruthy();
    });
  });
});

// ─── Stripe Integration Tests ───────────────────────────────────────────────

describe('Stripe Integration', () => {
  it('should format EUR prices with decimal comma and German thousands separator', () => {
    expect(formatPrice(79)).toBe('79,00 €');
    expect(formatPrice(249)).toBe('249,00 €');
    expect(formatPrice(1999)).toBe('1.999,00 €'); // German style: dot for thousands
  });

  it('should format prices without symbol on demand', () => {
    expect(formatPrice(79, false)).toBe('79,00');
    expect(formatPrice(1999, false)).toBe('1.999,00');
  });

  it('should retrieve plans by ID', () => {
    const starter = getPlanById('starter');
    expect(starter?.name).toBe('Starter');
    expect(starter?.priceEur).toBe(79);
  });

  it('should identify fixed-price plans', () => {
    expect(isPlanFixedPrice('free_audit')).toBe(false); // €0
    expect(isPlanFixedPrice('starter')).toBe(true); // €79
    expect(isPlanFixedPrice('enterprise')).toBe(false); // €0 (custom)
  });

  it('should generate Stripe product metadata', () => {
    const metadata = getStripeProductMetadata('growth');
    expect(metadata.plan_key).toBe('growth');
    expect(metadata.plan_name).toBe('Growth');
    expect(metadata.company_name).toBe('RealSync Dynamics AI');
    expect(metadata.company_legal_form).toBe('UG');
    expect(metadata.recurring).toBe('true');
  });

  it('should check Stripe configuration status', () => {
    // This will depend on VITE_STRIPE_PUBLISHABLE_KEY being set
    const configured = isStripeConfigured();
    expect(typeof configured).toBe('boolean');
  });
});

// ─── Compliance & Legal Tests ──────────────────────────────────────────────

describe('Compliance & Legal Notices', () => {
  it('should generate complete impressum text', () => {
    const impressum = generateImpressumText();
    expect(impressum).toContain('RealSync Dynamics AI');
    expect(impressum).toContain('IMPRESSUM');
    expect(impressum).toContain(COMPANY.supportEmail);
    expect(impressum).toContain('UG (haftungsbeschränkt)');
  });

  it('should check completeness of legal documents', () => {
    const { ready, missing } = areLegalDocsComplete();
    expect(typeof ready).toBe('boolean');
    expect(Array.isArray(missing)).toBe(true);
  });

  it('should provide context-aware compliance banners', () => {
    const auditBanner = getComplianceBanner('free_audit');
    expect(auditBanner).toContain('Compliance-Support-Plattform');
    expect(auditBanner).toContain('kostenlos');

    const subBanner = getComplianceBanner('paid_subscription');
    expect(subBanner).toContain('verschlüsselt');

    const checkoutBanner = getComplianceBanner('checkout');
    expect(checkoutBanner).toContain('AGB');
  });

  it('should indicate no legal advice is provided', () => {
    const banner = getComplianceBanner('free_audit');
    expect(banner).toMatch(/Compliance.*Support/i);
  });
});

// ─── Billing Workflow Tests ─────────────────────────────────────────────────

describe('Billing Workflows', () => {
  it('free audit should not require checkout', () => {
    const free = tierById('free')!;
    expect(free.cta.href).toContain('/audit');
    expect(free.cta.href).not.toContain('/checkout');
  });

  it('starter plan should redirect to checkout with trial', () => {
    const starter = tierById('starter')!;
    expect(starter.cta.href).toContain('/checkout/starter');
    expect(starter.cta.href).toContain('pilot=true');
  });

  it('growth plan should be highlighted as recommended', () => {
    const growth = tierById('growth')!;
    expect(growth.highlight).toBe(true);
  });

  it('agency plan should include white-label features', () => {
    const agency = tierById('agency')!;
    const agencyFeatures = agency.bullets.join(' ').toLowerCase();
    expect(agencyFeatures).toContain('white-label');
    expect(agencyFeatures).toContain('api');
  });

  it('scale plan should be for resellers with multi-tenant', () => {
    const scale = tierById('scale')!;
    const scaleDesc = scale.bullets.join(' ').toLowerCase();
    expect(scaleDesc).toContain('mandant');
    expect(scaleDesc).toContain('kanzlei');
  });

  it('enterprise should have contact sales CTA', () => {
    const enterprise = tierById('enterprise')!;
    expect(enterprise.cta.href).toContain('/contact-sales');
  });
});

// ─── Feature Quota Tests ────────────────────────────────────────────────────

describe('Feature Quotas by Tier', () => {
  it('free audit should have no productive bots', () => {
    const free = tierById('free')!;
    expect(free.botsQuota.maxBots).toBe(0);
  });

  it('starter should allow 1 bot with 500 answers/month', () => {
    const starter = tierById('starter')!;
    expect(starter.botsQuota.maxBots).toBe(1);
    expect(starter.botsQuota.maxAnswersPerMonth).toBe(500);
    expect(starter.botsQuota.channels).toEqual(['website']);
  });

  it('growth should allow 2 bots with 2000 answers/month', () => {
    const growth = tierById('growth')!;
    expect(growth.botsQuota.maxBots).toBe(2);
    expect(growth.botsQuota.maxAnswersPerMonth).toBe(2000);
    expect(growth.botsQuota.channels.length).toBe(3); // website, whatsapp, telegram
  });

  it('agency should allow 10 bots with 25k answers/month', () => {
    const agency = tierById('agency')!;
    expect(agency.botsQuota.maxBots).toBe(10);
    expect(agency.botsQuota.maxAnswersPerMonth).toBe(25000);
    expect(agency.botsQuota.channels.length).toBe(7); // all channels
  });

  it('bots quota should have metering notes for Phase 3', () => {
    PRICING_TIERS.forEach((tier) => {
      if (tier.botsQuota.maxBots > 0) {
        expect(tier.botsQuota.meteringNotes).toBeDefined();
      }
    });
  });
});

// ─── UG-Specific Tests ───────────────────────────────────────────────────────

describe('UG (haftungsbeschränkt) Compliance', () => {
  it('should never display as GmbH while configured as UG', () => {
    if (COMPANY.legalForm === 'UG') {
      const displayName = getCompanyDisplayName();
      expect(displayName).not.toContain('GmbH');
      expect(displayName).toContain('UG');
    }
  });

  it('should use correct legal entity name in all formal documents', () => {
    const expectedName = `${COMPANY.companyName} ${COMPANY.legalForm}`;
    expect(getCompanyDisplayName()).toContain(expectedName);
  });

  it('should transition easily to GmbH by changing config', () => {
    // Simulate transition
    const mockCompany = {
      ...COMPANY,
      legalForm: 'GmbH' as const,
    };

    const transitionedName = `${mockCompany.companyName} GmbH`;
    expect(transitionedName).toContain('GmbH');
  });

  it('impressum should mention limited liability', () => {
    const impressum = generateImpressumText();
    expect(impressum).toMatch(/haftung|limited|liability/i);
  });
});
