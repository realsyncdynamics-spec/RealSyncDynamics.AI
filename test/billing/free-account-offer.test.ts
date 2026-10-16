import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatPriceEur, planById } from '@/shared/pricing';
import {
  FREE_ACCOUNT_HEADLINE,
  growthTrialOfferLabel,
  starterFromPriceLabel,
} from '../../src/features/billing/freeAccountOffer';

// Die drei Seiten, die das Angebot des kostenlosen Kontos (E-F6) nennen.
const CONSUMERS = [
  'src/features/workspace/FreePlanPanel.tsx',
  'src/unified-entry/pages/TrialOfferPage.tsx',
  'src/unified-entry/pages/PostRegisterOnboardingPage.tsx',
].map((path) => ({ path, source: readFileSync(resolve(path), 'utf8') }));

describe('Angebot kostenloses Konto — eine Quelle', () => {
  it('nimmt Tage und Preis aus der Pricing-SSoT', () => {
    expect(growthTrialOfferLabel()).toBe(
      `Growth ${planById('growth').trialDays} Tage kostenlos testen`,
    );
    expect(starterFromPriceLabel()).toBe(
      `Starter ab ${formatPriceEur(planById('starter').price.monthlyEur)} / Monat`,
    );
  });

  it('verspricht nur eine Testphase, die die SSoT auch hergibt', () => {
    expect(planById('growth').trialDays).toBeGreaterThan(0);
  });

  it.each(CONSUMERS)('$path liest den Wortlaut aus freeAccountOffer', ({ source }) => {
    expect(source).toContain('features/billing/freeAccountOffer');
    // Keine eigene Ableitung von Tagen oder Preisen neben dem Modul.
    expect(source).not.toContain('trialDays');
    expect(source).not.toContain('formatPriceEur(');
    expect(source).not.toContain(`'${FREE_ACCOUNT_HEADLINE}'`);
    expect(source).not.toContain(`>${FREE_ACCOUNT_HEADLINE}<`);
  });
});
