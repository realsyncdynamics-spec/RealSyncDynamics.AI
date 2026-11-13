/** OKLCH mit L in 0–100 und C als OKLab-Chroma × 100. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

function srgbToLinear(channel: number): number {
  const x = channel / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  const x = Math.min(1, Math.max(0, channel));
  const s = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
}

export function hexToOklch(hex: string): Oklch {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw;
  const r = srgbToLinear(parseInt(full.slice(0, 2), 16));
  const g = srgbToLinear(parseInt(full.slice(2, 4), 16));
  const b = srgbToLinear(parseInt(full.slice(4, 6), 16));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  let h = Math.atan2(B, A) * (180 / Math.PI);
  if (h < 0) h += 360;
  return { l: L * 100, c: Math.sqrt(A * A + B * B) * 100, h };
}

export function oklchToHex(color: Oklch): string {
  const L = color.l / 100;
  const C = color.c / 100;
  const hr = (color.h * Math.PI) / 180;
  const A = C * Math.cos(hr);
  const B = C * Math.sin(hr);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  const r = linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const b = linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

/** Kleinste signierte Hue-Differenz in Radiant. */
export function hueDeltaRadians(h1: number, h2: number): number {
  let degrees = ((h2 - h1 + 540) % 360) - 180;
  return (degrees * Math.PI) / 180;
}

export function deltaEOklch(a: Oklch, b: Oklch): number {
  const dH = 2 * Math.sqrt(a.c * b.c) * Math.sin(hueDeltaRadians(a.h, b.h) / 2);
  return Math.sqrt((a.l - b.l) ** 2 + (a.c - b.c) ** 2 + dH ** 2);
}
