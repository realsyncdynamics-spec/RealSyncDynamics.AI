/**
 * Detection von Pflicht-Subpages (Datenschutzerklärung, Impressum).
 *
 * Status: DOM-Scan auf der Landingpage. Sucht nach Links, deren href oder
 * sichtbarer Text auf eine Datenschutzerklärung bzw. ein Impressum zeigt.
 * Liefert die Facts, die die Rule Engine unter `page.privacy_policy.url_found`
 * und `page.impressum.url_found` erwartet (siehe `src/rules/gdpr.json`).
 *
 * Bewusst out of scope für diesen Detector:
 *   - tatsächliches Aufrufen der Subpage und Inhalts-Analyse
 *     (`mentions_avv` etc.) → folgt in Phase 8.2 zusammen mit
 *     Evidence-Persistierung.
 */
import type { Page } from 'playwright';

type LegalPageFinding = {
  url_found: boolean;
  url: string | null;
};

const PRIVACY_HREF_PATTERNS: RegExp[] = [
  /\/datenschutz(erkl(a|ä)rung)?\/?/i,
  /\/privacy(-?policy)?\/?/i,
  /\/data-?protection\/?/i,
];

const PRIVACY_TEXT_PATTERNS: RegExp[] = [
  /datenschutz/i,
  /privacy\s*policy/i,
  /data\s*protection/i,
];

const IMPRESSUM_HREF_PATTERNS: RegExp[] = [
  /\/impressum\/?/i,
  /\/legal\/impressum\/?/i,
  /\/imprint\/?/i,
  /\/legal-?notice\/?/i,
];

const IMPRESSUM_TEXT_PATTERNS: RegExp[] = [
  /impressum/i,
  /imprint/i,
  /legal\s*notice/i,
];

export async function detectLegalPages(
  page: Page,
): Promise<{ privacy_policy: LegalPageFinding; impressum: LegalPageFinding }> {
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .map((a) => ({
        href: a.href,
        text: (a.textContent || '').trim(),
      }))
      .filter((l) => !!l.href);
  });

  const privacy = pickFirstMatch(links, PRIVACY_HREF_PATTERNS, PRIVACY_TEXT_PATTERNS);
  const impressum = pickFirstMatch(links, IMPRESSUM_HREF_PATTERNS, IMPRESSUM_TEXT_PATTERNS);

  return {
    privacy_policy: privacy,
    impressum,
  };
}

function pickFirstMatch(
  links: { href: string; text: string }[],
  hrefPatterns: RegExp[],
  textPatterns: RegExp[],
): LegalPageFinding {
  for (const link of links) {
    const hrefHit = hrefPatterns.some((p) => p.test(link.href));
    const textHit = textPatterns.some((p) => p.test(link.text));
    if (hrefHit || textHit) {
      return { url_found: true, url: link.href };
    }
  }
  return { url_found: false, url: null };
}
