// Kanonisierung + Hashing für SiteOS.
//
// Der Blueprint-Hash ist der Anker jedes Nachweises: er landet als
// `content_sha256` im Evidence Vault und als Claim im Herkunftsnachweis.
// Deshalb muss die Kanonisierung über alle Laufzeiten hinweg BIT-IDENTISCH
// sein — Browser, Deno-Edge-Function und Node-Test müssen für dieselbe
// Struktur denselben Hash liefern.
//
// Regeln (bewusst eng gefasst, damit sie stabil bleiben):
//   1. Objekt-Schlüssel werden lexikografisch nach Code-Unit sortiert.
//   2. Array-Reihenfolge ist bedeutungstragend und bleibt erhalten.
//   3. `undefined` und Funktionen werden ausgelassen — in Objekten wie in
//      Arrays (im Array wird die Position zu `null`, analog zu JSON.stringify).
//   4. Zahlen müssen endlich sein; NaN/Infinity sind ein Fehler statt still
//      zu `null` zu werden, weil ein stiller Verlust den Nachweis entwertet.
//   5. Keine Einrückung, kein Whitespace.
//
// Diese Regeln entsprechen der Kanonisierung in
// `supabase/functions/_shared/provenanceCore.ts` (dort für ein festes
// Claim-Schema mit fixer Feldreihenfolge) — hier verallgemeinert auf
// beliebige Strukturen.

export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue | undefined };

/**
 * Serialisiert einen Wert deterministisch. Wirft bei nicht darstellbaren
 * Zahlen, statt sie stillschweigend zu verfälschen.
 */
export function canonicalize(value: unknown): string {
  const out = encodeValue(value);
  // Ein Top-Level-`undefined` hat keine kanonische Darstellung.
  if (out === undefined) throw new Error('canonicalize: value is not serializable');
  return out;
}

function encodeValue(value: unknown): string | undefined {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        throw new Error(`canonicalize: non-finite number (${String(value)})`);
      }
      // JSON.stringify liefert für endliche Zahlen die kürzeste
      // Round-Trip-Darstellung — über Engines hinweg identisch.
      return JSON.stringify(value);
    case 'undefined':
    case 'function':
    case 'symbol':
      return undefined;
    case 'bigint':
      throw new Error('canonicalize: bigint is not supported');
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => encodeValue(item) ?? 'null');
    return `[${items.join(',')}]`;
  }

  // Date ist die einzige zugelassene Nicht-Plain-Objektform; sie wird auf
  // ihre ISO-Darstellung reduziert, damit Zeitstempel nie als leeres
  // Objekt im Nachweis landen.
  if (value instanceof Date) return JSON.stringify(value.toISOString());

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const encoded = encodeValue(record[key]);
    if (encoded === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${encoded}`);
  }
  return `{${parts.join(',')}}`;
}

function bufToHex(buf: Uint8Array): string {
  let out = '';
  for (let i = 0; i < buf.length; i++) out += buf[i].toString(16).padStart(2, '0');
  return out;
}

/** SHA-256 über UTF-8-Bytes, hex-kodiert in Kleinbuchstaben. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bufToHex(new Uint8Array(digest));
}

/**
 * Kanonischer Hash einer beliebigen Struktur. Für Blueprints der Anker
 * im Evidence Vault; für Prompts die Kennung in `BlueprintOrigin`.
 */
export async function canonicalHash(value: unknown): Promise<string> {
  return sha256Hex(canonicalize(value));
}
