// Escaping für den Renderer.
//
// Der Blueprint enthält Text, der aus einem Prompt oder aus einem
// Sprachmodell stammt. Beides ist nicht vertrauenswürdig. Jeder Wert, der
// ins HTML wandert, läuft deshalb durch eine dieser Funktionen — ohne
// Ausnahme und ohne „das ist doch nur ein Titel"-Abkürzung.
//
// Der Renderer baut Strings statt eines DOM (er muss in Deno ohne DOM
// laufen). Damit liegt die gesamte XSS-Sicherheit in diesem Modul.

const HTML_ENTITIES: Readonly<Record<string, string>> = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

/**
 * Escaped Text für Element-Inhalte UND Attributwerte. Bewusst eine einzige
 * Funktion für beides: zwei Varianten laden dazu ein, im Zweifel die
 * schwächere zu wählen. `"` und `'` sind deshalb immer mit erfasst.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

/** Erlaubte Schemata für Links. Alles andere wird verworfen. */
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * Prüft und escaped eine URL. Gibt `null` zurück, wenn das Ziel nicht
 * sicher ist — `javascript:`, `data:` und Verwandte kommen nicht durch.
 *
 * Relative Pfade (`/kontakt`, `#anker`) sind erlaubt; sie können das
 * Dokument nicht verlassen.
 */
export function safeUrl(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (raw === '') return null;

  // Relative Ziele: kein Schema möglich, solange kein Doppelpunkt vor dem
  // ersten Slash steht (`javascript:alert(1)` hätte einen).
  if (raw.startsWith('/') || raw.startsWith('#')) {
    // Protokollrelative URLs (`//evil.example`) sind KEIN sicherer
    // relativer Pfad — sie wechseln den Host.
    if (raw.startsWith('//')) return null;
    return escapeHtml(raw);
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    // Nicht parsebar und nicht relativ ⇒ verwerfen.
    return null;
  }

  if (!SAFE_SCHEMES.includes(parsed.protocol)) return null;
  return escapeHtml(parsed.toString());
}

/**
 * Serialisiert Daten für ein `<script type="application/ld+json">`.
 *
 * JSON allein reicht hier nicht: ein `</script>` in einem String würde den
 * Block vorzeitig beenden und den Rest als Markup ausführbar machen. Die
 * kritischen Sequenzen werden deshalb unicode-escaped — das ist innerhalb
 * von JSON bedeutungsgleich, aber für den HTML-Parser unsichtbar.
 * U+2028/U+2029 sind mitbehandelt: gültiges JSON, in JavaScript aber
 * Zeilentrenner. Als \u-Sequenz notiert, weil sie als Literal im
 * Quelltext die Zeile und damit das Regex-Literal beenden würden.
 */
export function jsonLdPayload(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Baut ein Attribut oder liefert '' — spart `undefined`-Prüfungen im Markup. */
export function attr(name: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  return ` ${name}="${escapeHtml(value)}"`;
}
