// Speicherbare Zeichenketten.
//
// Auszüge werden an vielen Stellen mit `.slice(0, n)` gekürzt. Trifft der
// Schnitt ein Emoji (zwei UTF-16-Einheiten), bleibt ein einzelnes Surrogat
// stehen; `JSON.stringify` schreibt es als `\ud83d`, und Postgres lehnt
// solche Zeichen in json/jsonb ab — ebenso NUL (`\u0000`). Der Lauf schlüge
// dann erst beim Speichern fehl, nachdem der Nachweis schon geschrieben ist.
//
// Deshalb wird an den Ausgängen des Kerns bereinigt (Snapshot, Positionierung,
// Bewertung, Richtung): strukturerhaltend, deterministisch und in Browser,
// Deno und Vitest gleich — ohne Lookbehind, das ältere Browser nicht kennen.

const SUSPECT = /[\u0000\uD800-\uDFFF]/;

/** Entfernt einzelne Surrogate und NUL; unveränderte Texte bleiben dieselben. */
export function wellFormedText(value: string): string {
  if (!SUSPECT.test(value)) return value;
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 0) continue;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += value[i] + value[i + 1];
        i += 1;
      }
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) continue;
    out += value[i];
  }
  return out;
}

/**
 * Bereinigt alle Zeichenketten einer Struktur (Werte, nicht Schlüssel — die
 * setzt der Code selbst). Gibt dieselbe Referenz zurück, wenn nichts zu tun
 * war.
 */
export function toWellFormed<T>(value: T): T {
  if (typeof value === 'string') return wellFormedText(value) as T;
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((entry) => {
      const next = toWellFormed(entry);
      if (next !== entry) changed = true;
      return next;
    });
    return (changed ? out : value) as T;
  }
  if (value !== null && typeof value === 'object') {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const next = toWellFormed(entry);
      if (next !== entry) changed = true;
      out[key] = next;
    }
    return (changed ? out : value) as T;
  }
  return value;
}
