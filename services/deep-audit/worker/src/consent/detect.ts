import type { Page } from 'playwright';

// Consent-banner detection.
// Tries known CMP selectors first (deterministic), then a text-content
// heuristic for unknown banners. Returns the first hit.

export interface ConsentDetection {
  found: boolean;
  selector?: string;
  /** Name of the CMP family we matched, if known. */
  vendor?: 'cookiebot' | 'onetrust' | 'usercentrics' | 'borlabs' | 'iubenda' | 'generic';
}

const CMP_SELECTORS: ReadonlyArray<{ selector: string; vendor: ConsentDetection['vendor'] }> = [
  // OneTrust
  { selector: '#onetrust-accept-btn-handler', vendor: 'onetrust' },
  // Cookiebot
  { selector: '#CybotCookiebotDialogBodyButtonAccept', vendor: 'cookiebot' },
  { selector: '#CybotCookiebotDialogBodyLevelButtonAccept', vendor: 'cookiebot' },
  // Usercentrics
  { selector: 'button[data-testid="uc-accept-all-button"]', vendor: 'usercentrics' },
  // Borlabs
  { selector: '#BorlabsCookieBox a.cookie-btn-accept-all', vendor: 'borlabs' },
  { selector: '#BorlabsCookieBox button._brlbs-btn-accept-all', vendor: 'borlabs' },
  // Iubenda
  { selector: '.iubenda-cs-accept-btn', vendor: 'iubenda' },
];

const GENERIC_TEXT_SELECTORS: readonly string[] = [
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Accept")',
  'button:has-text("Alle akzeptieren")',
  'button:has-text("Akzeptieren")',
  'button:has-text("Einverstanden")',
  'button:has-text("Zustimmen")',
  'button:has-text("Tout accepter")',
  'a:has-text("Accept all")',
  'a:has-text("Alle akzeptieren")',
];

export async function detectConsent(page: Page): Promise<ConsentDetection> {
  // 1. Try the known CMP selectors first — they're stable + identify vendor.
  for (const { selector, vendor } of CMP_SELECTORS) {
    const el = await page.$(selector);
    if (el) return { found: true, selector, vendor };
  }

  // 2. Fall back to text-content heuristics.
  for (const selector of GENERIC_TEXT_SELECTORS) {
    const el = await page.$(selector);
    if (el) return { found: true, selector, vendor: 'generic' };
  }

  return { found: false };
}
