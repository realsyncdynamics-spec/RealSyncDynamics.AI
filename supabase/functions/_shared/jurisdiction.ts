/**
 * Jurisdiction-Detection für den DSGVO-Audit-Scanner.
 *
 * Hintergrund: Der gdpr-audit-Scanner triggert seit jeher einen
 * `no_imprint_link` Befund mit Severity `critical` und §-5-DDG-Referenz,
 * sobald das HTML kein „Impressum"-Wort enthält. Für gewerbliche
 * DE-/AT-/CH-Sites ist das korrekt; für ausländische Mega-Sites
 * (gmail.com, github.com, ...) ist es ein False-Positive — § 5 DDG ist
 * deutsches Recht, das nur greift, wenn der Anbieter in DE sitzt.
 *
 * Diese Heuristik erkennt deutschsprachige Anbieter konservativ:
 *   - TLD `.de` / `.at` / `.ch`
 *   - HTML mit `<html lang="de…">` / `lang="de-…">`
 *   - HTML enthält starke DE-Anbieter-Signale (Rechtsform, +49, deutsche
 *     PLZ-Pattern, „Geschäftsführer", „Handelsregister", …)
 *
 * Die Funktion ist bewusst pure (kein Fetch, kein Network) damit sie
 * direkt aus der Edge-Function aufgerufen und unter Vitest getestet
 * werden kann.
 */

const DE_TLD_SUFFIXES = ['.de', '.at', '.ch'] as const;

const DE_PROVIDER_PATTERNS: ReadonlyArray<RegExp> = [
  // Rechtsformen, die im internationalen Kontext eindeutig deutsch sind.
  // Bewusst NICHT: AG/KG/GbR — diese sind im engl. Sprachraum mehrdeutig
  // (AG = Silver, KG = Kilogram) und produzieren False-Positives.
  /\bGmbH\b/,
  /\bUG\s*\(haftungsbeschränkt\)/i,
  /\be\.\s*K\.\b/,
  /Geschäftsführer/i,
  /Handelsregister/i,
  /\bHRB\s*\d/i,
  /\bUSt[-\s]?IdNr/i,
  /Umsatzsteuer-?Identifikationsnummer/i,
  /Sitz\s+(?:der\s+Gesellschaft|in|:)/i,
  /\+49[\s\-)0-9]/,
  /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]/, // deutsche PLZ (5-stellig) + Stadtname
];

function hasGermanLangAttribute(html: string): boolean {
  // Match opening <html …> tag with lang attribute starting with "de"
  // (de, de-DE, de-AT, de-CH). Case-insensitive, tolerant zu Attribut-
  // Reihenfolge.
  return /<html\b[^>]*\blang\s*=\s*["']?de\b/i.test(html);
}

function hasGermanTld(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return DE_TLD_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
}

function hasGermanProviderSignals(html: string): boolean {
  return DE_PROVIDER_PATTERNS.some((re) => re.test(html));
}

/**
 * True, wenn die Site mit hoher Wahrscheinlichkeit von einem DE/AT/CH-
 * Anbieter betrieben wird — und damit § 5 DDG / § 18 MStV in Reichweite
 * sind. Konservativ: lieber false-negativ (DE-Anbieter wird als non-DE
 * erkannt → Befund wird zu info, aber kein false-positive `critical`)
 * als false-positiv.
 */
export function isLikelyGermanJurisdiction(
  url: string,
  html: string,
): boolean {
  if (hasGermanTld(url)) return true;
  if (hasGermanLangAttribute(html)) return true;
  if (hasGermanProviderSignals(html)) return true;
  return false;
}
