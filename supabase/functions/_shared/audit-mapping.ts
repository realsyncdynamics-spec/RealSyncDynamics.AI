// Pure mapping helpers für tenant-audit: gdpr-audit Issue → Finding-
// Felder. Hier herausgezogen, damit Vitest die Heuristik testen kann
// ohne den Edge-Function-Wrapper (mit Deno/JSR-Specifiern) zu laden.

export type FindingCategory =
  | 'consent' | 'tracker' | 'ai_act' | 'tom' | 'dpa'
  | 'accessibility' | 'security' | 'transparency' | 'data_quality'
  | 'documentation' | 'other';

export type FindingEvidenceLevel =
  | 'observed' | 'inferred' | 'reported' | 'unverifiable';

/**
 * gdpr-audit Issue-IDs → Finding-Category. Heuristik nach Substring-
 * Match in der ID; trifft pro Token zuerst → letztes Match gewinnt
 * für die nachfolgenden Tokens nur, wenn der Issue mehrere matched.
 * Reihenfolge bewusst: consent vor tracker (social_pixel_no_consent
 * soll consent sein, nicht tracker).
 */
export function categoryFor(issueId: string): FindingCategory {
  const id = issueId.toLowerCase();
  // Reihenfolge: spezifischere Tokens zuerst, weil das schwache `ai`-
  // Match sonst `dpia_missing_for_ai` und `fetch_failed` (enthält "ai"
  // bzw. "fail" mit Substring "ai") falsch klassifizieren würde.
  if (id.includes('fetch_failed') || id.includes('_error') || id.endsWith('error')) return 'other';
  if (id.includes('dpia') || id.includes('vvt') || id.includes('register')) return 'documentation';
  if (id.includes('dpa') || id.includes('avv') || id.includes('vendor')) return 'dpa';
  if (id.includes('impressum') || id.includes('privacy') || id.includes('datenschutz')) return 'transparency';
  if (id.includes('header') || id.includes('hsts') || id.includes('csp') || id.includes('tls')) return 'security';
  if (id.includes('consent') || id.includes('cookie') || id.includes('banner')) return 'consent';
  if (id.includes('tracker') || id.includes('pixel') || id.includes('analytics')) return 'tracker';
  if (id.includes('chatbot') || id.startsWith('ai_') || id.includes('_ai_') || id.endsWith('_ai')) return 'ai_act';
  return 'other';
}

/**
 * Confidence-Heuristik: HTML-DOM-Beobachtungen 0.85, inferrierte
 * Vendor-Erkennungen 0.7, fetch-Fehler 0.3. Future PR ersetzt das
 * durch detector-seitige Konfidenz pro Regel.
 */
export function confidenceFor(issueId: string): number {
  const id = issueId.toLowerCase();
  if (id.includes('fetch_failed')) return 0.30;
  if (id.includes('vendor') || id.includes('inferred')) return 0.70;
  return 0.85;
}

/**
 * Evidence-Level Mapping passend zur Confidence-Heuristik.
 * fetch_failed → unverifiable (kein HTML beobachtbar)
 * vendor/inferred → inferred (abgeleitet aus Indizien)
 * sonst → observed (direkte DOM/Network/Header-Beobachtung)
 */
export function evidenceLevelFor(issueId: string): FindingEvidenceLevel {
  const id = issueId.toLowerCase();
  if (id.includes('fetch_failed')) return 'unverifiable';
  if (id.includes('vendor') || id.includes('inferred')) return 'inferred';
  return 'observed';
}
