/**
 * Farbquelle für Logo und Mood.
 * Kein Netz, keine Modell-API. Roh-RGB wird gemittelt, ein eingebettetes
 * #RRGGBB wird bevorzugt, sonst ein dokumentierter Stub.
 */
export interface ColorSample {
  hex: string;
  method: 'embedded-hex' | 'raw-rgb-average' | 'stub';
}

export function extractColor(bytes: Uint8Array | null | undefined): ColorSample {
  if (!bytes || bytes.length === 0) return { hex: '#2457E6', method: 'stub' };
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const embedded = text.match(/#([0-9a-fA-F]{6})\b/);
  if (embedded) return { hex: `#${embedded[1]!.toUpperCase()}`, method: 'embedded-hex' };
  if (bytes.length < 3) return { hex: '#2457E6', method: 'stub' };
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i + 2 < bytes.length; i += 3) {
    r += bytes[i]!;
    g += bytes[i + 1]!;
    b += bytes[i + 2]!;
    count += 1;
  }
  const hex = (n: number) => Math.round(n / count).toString(16).padStart(2, '0');
  return { hex: `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase(), method: 'raw-rgb-average' };
}
