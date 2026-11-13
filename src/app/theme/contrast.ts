/** WCAG 2.x Kontrast. AA: Fließtext 4.5:1, große Schrift und UI-Teile 3:1. */

export function relativeLuminance(hex: string): number {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw;
  const channels = [0, 2, 4].map((index) => {
    const value = parseInt(full.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastPair {
  name: string;
  foreground: string;
  background: string;
  minimum: number;
}

export interface ContrastGap extends ContrastPair {
  ratio: number;
}

export function contrastGaps(vars: Record<string, string>, pairs: readonly ContrastPair[]): ContrastGap[] {
  return pairs.flatMap((pair) => {
    const foreground = vars[pair.foreground];
    const background = vars[pair.background];
    if (!foreground || !background) {
      return [{ ...pair, ratio: 0 }];
    }
    const ratio = contrastRatio(foreground, background);
    return ratio + 1e-9 < pair.minimum ? [{ ...pair, ratio }] : [];
  });
}

/** Paare, die die Hülle als Text benutzt. Die müssen AA halten. */
export const REQUIRED_TEXT_PAIRS: readonly ContrastPair[] = [
  { name: 'text-primary/default', foreground: '--color-text-primary', background: '--color-surface-default', minimum: 4.5 },
  { name: 'text-primary/raised', foreground: '--color-text-primary', background: '--color-surface-raised', minimum: 4.5 },
  { name: 'text-primary/metric', foreground: '--color-text-primary', background: '--color-surface-metric', minimum: 4.5 },
  { name: 'text-secondary/default', foreground: '--color-text-secondary', background: '--color-surface-default', minimum: 4.5 },
  { name: 'text-secondary/raised', foreground: '--color-text-secondary', background: '--color-surface-raised', minimum: 4.5 },
  { name: 'text-inverse/inverse', foreground: '--color-text-inverse', background: '--color-surface-inverse', minimum: 4.5 },
];

/**
 * Weitere Paare aus dem gelieferten Set. Was hier scheitert, bleibt ein
 * Befund am Designer-Token und wird nicht still umgefärbt.
 */
export const REPORTED_PAIRS: readonly ContrastPair[] = [
  { name: 'text-muted/default', foreground: '--color-text-muted', background: '--color-surface-default', minimum: 4.5 },
  { name: 'text-micro/default', foreground: '--color-text-micro', background: '--color-surface-default', minimum: 4.5 },
  { name: 'text-accent/default', foreground: '--color-text-accent', background: '--color-surface-default', minimum: 4.5 },
  { name: 'kpi-label/metric', foreground: '--kpi-label', background: '--kpi-bg', minimum: 4.5 },
  { name: 'footer/default', foreground: '--footer-text', background: '--color-surface-default', minimum: 4.5 },
  { name: 'hero-lead/default', foreground: '--hero-lead', background: '--color-surface-default', minimum: 4.5 },
  { name: 'hero-emphasis/default', foreground: '--hero-emphasis', background: '--color-surface-default', minimum: 4.5 },
  { name: 'badge-demo', foreground: '--badge-demo-text', background: '--badge-demo-bg', minimum: 4.5 },
  { name: 'input-placeholder', foreground: '--input-placeholder', background: '--input-bg', minimum: 4.5 },
  { name: 'border/default', foreground: '--color-border-default', background: '--color-surface-default', minimum: 3 },
  { name: 'sidebar-border', foreground: '--sidebar-border', background: '--sidebar-bg', minimum: 3 },
];
