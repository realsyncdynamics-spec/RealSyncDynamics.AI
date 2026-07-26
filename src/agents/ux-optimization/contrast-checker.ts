/**
 * Color Contrast Checker
 *
 * Validates WCAG color contrast compliance for text and UI elements
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface ContrastResult {
  ratio: number;
  wcagAA: boolean;
  wcagAAA: boolean;
  level: 'AAA' | 'AA' | 'fail';
  recommendation?: string;
}

/**
 * Parse hex color to RGB
 */
export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error(`Invalid hex color: ${hex}`);

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Calculate relative luminance (WCAG definition)
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
export function getLuminance(rgb: RGB): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
    const v = val / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * Returns ratio as number (e.g., 4.5:1 returns 4.5)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const lum1 = getLuminance(rgb1);
  const lum2 = getLuminance(rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG standards
 */
export function checkContrast(
  textColor: string,
  backgroundColor: string,
  isLargeText: boolean = false
): ContrastResult {
  const ratio = getContrastRatio(textColor, backgroundColor);

  // WCAG standards:
  // Normal text (< 18pt or 14pt bold): AA = 4.5:1, AAA = 7:1
  // Large text (≥ 18pt or 14pt bold): AA = 3:1, AAA = 4.5:1
  const aaThreshold = isLargeText ? 3 : 4.5;
  const aaaThreshold = isLargeText ? 4.5 : 7;

  const wcagAA = ratio >= aaThreshold;
  const wcagAAA = ratio >= aaaThreshold;

  let level: 'AAA' | 'AA' | 'fail' = 'fail';
  if (wcagAAA) level = 'AAA';
  else if (wcagAA) level = 'AA';

  return {
    ratio: Math.round(ratio * 100) / 100,
    wcagAA,
    wcagAAA,
    level,
    recommendation:
      !wcagAA
        ? `Contrast ratio ${ratio.toFixed(2)}:1 fails WCAG AA. Need ${aaThreshold}:1 minimum.`
        : !wcagAAA
        ? `Meets AA but not AAA. Ratio is ${ratio.toFixed(2)}:1 (AAA needs ${aaaThreshold}:1).`
        : 'Excellent contrast, meets AAA standard.',
  };
}

/**
 * Common color palette (RealSync dashboard)
 */
export const REALSYNC_PALETTE = {
  // Obsidian theme (dark dashboard)
  obsidian: '#0A0A0B',
  titanium: '#E2E2E2',
  'security-blue': '#0052FF',
  'slate-900': '#0F172A',
  'slate-800': '#1E293B',
  'slate-700': '#334155',
  'slate-600': '#475569',
  'slate-500': '#64748B',
  'slate-400': '#94A3B8',
  'slate-300': '#CBD5E1',
  'slate-200': '#E2E8F0',
  'slate-100': '#F1F5F9',
  'slate-50': '#F8FAFC',
  // Petrol (landing pages)
  'petrol-700': '#0F766E',
  'petrol-600': '#14919B',
  'petrol-500': '#20B2AA',
};

/**
 * Validate text on common background combinations
 */
export function validateCommonCombinations(): Array<{
  textColor: string;
  backgroundColor: string;
  result: ContrastResult;
}> {
  const combinations = [
    // Dark theme (Obsidian/Titanium)
    { text: REALSYNC_PALETTE.titanium, bg: REALSYNC_PALETTE.obsidian },
    { text: REALSYNC_PALETTE.obsidian, bg: REALSYNC_PALETTE.titanium },
    { text: REALSYNC_PALETTE['security-blue'], bg: REALSYNC_PALETTE.obsidian },
    // Light theme (Slate)
    { text: REALSYNC_PALETTE['slate-900'], bg: REALSYNC_PALETTE['slate-50'] },
    { text: REALSYNC_PALETTE['slate-50'], bg: REALSYNC_PALETTE['slate-900'] },
    { text: REALSYNC_PALETTE['petrol-700'], bg: REALSYNC_PALETTE['slate-50'] },
  ];

  return combinations.map(({ text, bg }) => ({
    textColor: text,
    backgroundColor: bg,
    result: checkContrast(text, bg),
  }));
}

/**
 * Detect low contrast issues in theme
 */
export function detectContrastIssues(): Array<{
  textColor: string;
  backgroundColor: string;
  ratio: number;
  status: 'pass' | 'warn' | 'fail';
}> {
  return validateCommonCombinations()
    .map(({ textColor, backgroundColor, result }) => ({
      textColor,
      backgroundColor,
      ratio: result.ratio,
      status: result.wcagAAA ? 'pass' : result.wcagAA ? 'warn' : 'fail',
    }))
    .filter(item => item.status !== 'pass');
}
