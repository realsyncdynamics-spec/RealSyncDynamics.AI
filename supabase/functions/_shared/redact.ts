// PII-Redactor — geteilte Logik fuer Evidence- und Audit-Exporte.
//
// Drei Policy-Modi (pro Funktion entschieden, nicht global):
//
//   'always'            — jeder String wird durch den Redactor geschickt.
//                         Einsatz: Bundles fuer Dritte (Aufsichtsbehoerde,
//                         externe Auditoren).
//   'third_party_only'  — nur explizit uebergebene Teilbaeume werden
//                         redactiert. Einsatz: Reports, die Owner-Daten
//                         im Klartext enthalten muessen, aber Drittpartei-
//                         Daten schwaerzen sollen (z.B. URLs/Form-Daten
//                         von gescannten Fremdseiten).
//   'never'             — keine Mutation. Einsatz: Art. 15 DSGVO-Exporte,
//                         Steuerberater-Bundles. Hier MUSS Klartext sein.
//
// In allen drei Faellen wird das Ereignis in pii_redaction_log
// protokolliert — auch 'never', damit der DSB-Audit zeigt, dass die
// Entscheidung bewusst war und welche Funktion welche Policy fuhr.
//
// Regex-Set ist konservativ aus extension-ai-monitor/src/content.js:67-75
// portiert und um typische Server-PII-Faelle ergaenzt (IPv4, DE-SVN).
// False Positives sind hier akzeptabel — ein zu eifriger Redactor
// schwaerzt eine technische ID, ein zu lascher leakt eine IBAN.

export type RedactionPolicy = 'always' | 'third_party_only' | 'never';

export type PiiCategory =
  | 'email'
  | 'phone_de'
  | 'phone_intl'
  | 'iban'
  | 'credit_card'
  | 'german_tax_id'
  | 'german_ssn'
  | 'date_of_birth'
  | 'ipv4'
  | 'ipv6';

export type HitsByCategory = Record<PiiCategory, number>;

interface PatternDef {
  name: PiiCategory;
  re: RegExp;
}

// Reihenfolge ist wichtig: spezifischere Muster zuerst, sonst frisst
// credit_card eine IBAN-Zahlenfolge. IBAN -> Tax-ID -> Telefon -> Karte.
const PII_PATTERNS: ReadonlyArray<PatternDef> = [
  { name: 'email',         re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { name: 'iban',          re: /\b[A-Z]{2}\d{2}\s?(?:\d{4}\s?){3,7}\d{1,4}\b/g },
  { name: 'german_tax_id', re: /\b\d{2}[\s/]\d{3}[\s/]\d{3}[\s/]\d{4}\b/g },
  { name: 'german_ssn',    re: /\b\d{2}\s?\d{6}\s?[A-Z]\s?\d{3}\b/g },
  { name: 'date_of_birth', re: /\b(?:0?[1-9]|[12][0-9]|3[01])[./-](?:0?[1-9]|1[0-2])[./-](?:19|20)\d{2}\b/g },
  { name: 'phone_de',      re: /\+?49[\s\-/]\d[\d\s\-/]{7,}/g },
  { name: 'phone_intl',    re: /\+\d{1,3}[\s\-]\d{4,}[\d\s\-]{4,}/g },
  { name: 'credit_card',   re: /\b(?:\d[ -]?){13,19}\b/g },
  { name: 'ipv4',          re: /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}\b/g },
  { name: 'ipv6',          re: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g },
];

export function emptyHits(): HitsByCategory {
  return {
    email: 0, phone_de: 0, phone_intl: 0, iban: 0, credit_card: 0,
    german_tax_id: 0, german_ssn: 0, date_of_birth: 0, ipv4: 0, ipv6: 0,
  };
}

function addHits(target: HitsByCategory, src: HitsByCategory): void {
  for (const key of Object.keys(target) as PiiCategory[]) {
    target[key] += src[key];
  }
}

/** Redactiert einen einzelnen String. Liefert Treffer-Zaehlung. */
export function redactString(input: string): { text: string; hits: HitsByCategory } {
  const hits = emptyHits();
  if (typeof input !== 'string' || input.length === 0) return { text: input, hits };
  let out = input;
  for (const p of PII_PATTERNS) {
    // Stateful-regex (`g`) braucht reset zwischen Aufrufen.
    p.re.lastIndex = 0;
    let count = 0;
    out = out.replace(p.re, () => {
      count++;
      return `[REDACTED:${p.name}]`;
    });
    if (count > 0) hits[p.name] += count;
  }
  return { text: out, hits };
}

/**
 * Redactiert rekursiv ein JSON-Strukturobjekt. Strings werden redactiert,
 * Zahlen/Booleans/null durchgelassen, Objekte/Arrays rekursiv.
 *
 * WICHTIG: Erstellt eine Kopie. Die Eingabe wird nicht mutiert.
 */
export function redactJson<T>(input: T): { redacted: T; hits: HitsByCategory } {
  const hits = emptyHits();
  const redacted = walk(input, hits) as T;
  return { redacted, hits };
}

function walk(value: unknown, hits: HitsByCategory): unknown {
  if (typeof value === 'string') {
    const r = redactString(value);
    addHits(hits, r.hits);
    return r.text;
  }
  if (Array.isArray(value)) {
    return value.map((v) => walk(v, hits));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walk(v, hits);
    }
    return out;
  }
  return value;
}

/**
 * Wendet eine Policy auf einen Wert an.
 *
 * - 'always'           — vollstaendige rekursive Redaction.
 * - 'third_party_only' — der Caller hat bereits den Drittpartei-Teilbaum
 *                        isoliert und ruft dies darauf auf; semantisch
 *                        identisch zu 'always' fuer diesen Teilbaum.
 * - 'never'            — Wert unveraendert zurueck, hits = 0.
 */
export function applyPolicy<T>(
  value: T,
  policy: RedactionPolicy,
): { redacted: T; hits: HitsByCategory } {
  if (policy === 'never') {
    return { redacted: value, hits: emptyHits() };
  }
  return redactJson(value);
}

export function sumHits(hits: HitsByCategory): number {
  let total = 0;
  for (const k of Object.keys(hits) as PiiCategory[]) total += hits[k];
  return total;
}
