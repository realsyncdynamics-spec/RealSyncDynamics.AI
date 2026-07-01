/**
 * Bulk-Jobs — Domain-Listen-Parsing für den CSV-/Massen-Import.
 *
 * Pure, deterministisch, KEINE Side-Effects. Normalisiert nach denselben
 * Regeln wie scansApi.normaliseDomain (lowercase, ohne Schema/Pfad, nur
 * a-z0-9.-, gültiger Hostname), plus Dedupe + strukturierte Ablehnungsgründe
 * für die UI. Trennt an Zeilenumbrüchen, Komma, Semikolon und Whitespace —
 * deckt damit CSV-Zeilen, eine-Domain-pro-Zeile und Copy-Paste-Listen ab.
 */

export interface ParsedDomains {
  /** Normalisierte, eindeutige, gültige Domains (Reihenfolge des ersten Auftretens). */
  valid: string[];
  /** Abgelehnte Roh-Token mit Grund (für UI-Feedback). */
  rejected: Array<{ raw: string; reason: string }>;
  /** Anzahl entfernter Duplikate. */
  duplicates: number;
  /** Anzahl nicht-leerer Token insgesamt. */
  total: number;
}

/**
 * Normalisiert einen Roh-String zu einem Hostname oder null (ungültig).
 * Spiegelt scansApi.normaliseDomain.
 */
export function normalizeDomain(raw: string): string | null {
  const s = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.\-]/g, '');
  if (!s) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s)) {
    return null;
  }
  return s;
}

/**
 * Parst eine Freitext-/CSV-Domainliste in gültige Domains + Ablehnungen.
 * Duplikate (nach Normalisierung) werden einmalig behalten und gezählt.
 */
export function parseDomainList(input: string): ParsedDomains {
  const tokens = (input ?? '')
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const valid: string[] = [];
  const rejected: Array<{ raw: string; reason: string }> = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (const raw of tokens) {
    const norm = normalizeDomain(raw);
    if (!norm) {
      rejected.push({ raw, reason: 'kein gültiger Domainname' });
      continue;
    }
    if (seen.has(norm)) {
      duplicates++;
      continue;
    }
    seen.add(norm);
    valid.push(norm);
  }

  return { valid, rejected, duplicates, total: tokens.length };
}
