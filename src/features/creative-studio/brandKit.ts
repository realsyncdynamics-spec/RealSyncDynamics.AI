/**
 * Brand-Kit für den Social-Editor.
 *
 * Farben und Schriften kommen aus dem Mandanten (`tenants.brand_colors`,
 * `custom_logo_url`, optionale Schriftnamen in `custom_css`) und werden auf
 * die semantischen DesignOS-Tokens gelegt (`inferBrand` / `tokensFromBrand`).
 * Fehlt belastbares Branding, bleibt ein gekennzeichnetes Demo-Brand-Kit.
 */
import { TYPOGRAPHY } from '../../styles/design-tokens';
import { inferBrand } from '../../core/realsync-os/design/designState';
import type { BrandIntelligence, DesignIntent } from '../../core/realsync-os/design/types';

export const BRAND_COLOR_TOKENS = ['color.ink', 'color.paper', 'color.accent', 'color.muted'] as const;
export const BRAND_FONT_TOKENS = ['type.heading', 'type.body'] as const;

export type BrandColorToken = (typeof BRAND_COLOR_TOKENS)[number];
export type BrandFontToken = (typeof BRAND_FONT_TOKENS)[number];
export type BrandTokenId = BrandColorToken | BrandFontToken;

export interface BrandKitTokens {
  'color.ink': string;
  'color.paper': string;
  'color.accent': string;
  'color.muted': string;
  'type.heading': string;
  'type.body': string;
}

export interface BrandKit {
  source: 'tenant' | 'demo';
  label: string;
  companyName: string | null;
  logoUrl: string | null;
  /** true, solange das Logo kein Mandanten-Logo ist. */
  logoIsDemo: boolean;
  tokens: BrandKitTokens;
  voice: string;
  vertical: string | null;
}

export interface TenantBrandRow {
  company_name?: string | null;
  brand_colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  } | null;
  custom_logo_url?: string | null;
  custom_css?: Record<string, unknown> | null;
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const FONT = /^[\p{L}0-9][\p{L}0-9 .,'-]{0,60}$/u;

const DEMO_INTENT: DesignIntent = {
  text: 'Social-Motiv',
  mode: 'prompt',
  locale: 'de',
  wantsPublish: false,
};

/** Sichtbares Demo-Logo. Kein Kundenzeichen. */
export const DEMO_LOGO_SRC = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="96" viewBox="0 0 360 96">
    <rect width="360" height="96" fill="#1D4E4A"/>
    <text x="24" y="60" fill="#F7F7F5" font-family="sans-serif" font-size="36">DEMO</text>
  </svg>`,
)}`;

function hexOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value.trim()) ? value.trim() : fallback;
}

function fontOr(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return FONT.test(trimmed) ? trimmed : fallback;
}

/** Nur http(s)-Logos aus dem Mandanten. data:- und script-URLs werden verworfen. */
export function safeLogoUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function kitFromBrand(brand: BrandIntelligence, extra: Pick<BrandKit, 'source' | 'label' | 'companyName' | 'logoUrl' | 'logoIsDemo'> & {
  heading?: string;
  body?: string;
}): BrandKit {
  return {
    source: extra.source,
    label: extra.label,
    companyName: extra.companyName,
    logoUrl: extra.logoUrl,
    logoIsDemo: extra.logoIsDemo,
    voice: brand.voice,
    vertical: brand.vertical ?? null,
    tokens: {
      'color.ink': brand.colors.ink,
      'color.paper': brand.colors.paper,
      'color.accent': brand.colors.accent,
      'color.muted': brand.colors.muted,
      'type.heading': extra.heading ?? brand.typography.heading,
      'type.body': extra.body ?? brand.typography.body,
    },
  };
}

/** DesignOS-Standard, klar als Demo gekennzeichnet. Kein Mandanten-Branding. */
export function demoBrandKit(): BrandKit {
  const brand = inferBrand(DEMO_INTENT);
  return kitFromBrand(brand, {
    source: 'demo',
    label: 'Demo-Brand-Kit',
    companyName: null,
    logoUrl: DEMO_LOGO_SRC,
    logoIsDemo: true,
    heading: TYPOGRAPHY.fontFamily.display,
    body: TYPOGRAPHY.fontFamily.sans,
  });
}

/**
 * Mandantenzeile auf semantische Tokens legen.
 * Ungültige Hex-Werte und unsichere Logo-URLs fallen auf die DesignOS-DNA zurück.
 * Ohne jede nutzbare Angabe bleibt das Demo-Brand-Kit.
 */
export function brandKitFromTenant(row: TenantBrandRow | null | undefined): BrandKit {
  const demo = demoBrandKit();
  if (!row) return demo;

  const colors = row.brand_colors ?? {};
  const css = row.custom_css ?? {};
  const logoUrl = safeLogoUrl(row.custom_logo_url);
  const hasColor = ['primary', 'secondary', 'accent', 'background', 'text'].some(
    (key) => typeof colors[key as keyof typeof colors] === 'string' && HEX.test(String(colors[key as keyof typeof colors]).trim()),
  );
  if (!hasColor && !logoUrl && !row.company_name) return demo;

  const base = inferBrand(DEMO_INTENT);
  const brand: BrandIntelligence = {
    ...base,
    colors: {
      ink: hexOr(colors.text, base.colors.ink),
      paper: hexOr(colors.background, base.colors.paper),
      accent: hexOr(colors.primary ?? colors.accent, base.colors.accent),
      muted: hexOr(colors.secondary, base.colors.muted),
    },
  };

  const company = typeof row.company_name === 'string' && row.company_name.trim()
    ? row.company_name.trim().slice(0, 120)
    : null;

  return kitFromBrand(brand, {
    source: 'tenant',
    label: company ? `Brand-Kit · ${company}` : 'Brand-Kit des Mandanten',
    companyName: company,
    logoUrl: logoUrl ?? demo.logoUrl,
    logoIsDemo: logoUrl === null,
    heading: fontOr(css.fontHeading ?? css.font_heading, TYPOGRAPHY.fontFamily.display),
    body: fontOr(css.fontBody ?? css.font_body, TYPOGRAPHY.fontFamily.sans),
  });
}

export function resolveToken(kit: BrandKit, token: BrandTokenId): string {
  return kit.tokens[token];
}

export function isBrandColorToken(value: string): value is BrandColorToken {
  return (BRAND_COLOR_TOKENS as readonly string[]).includes(value);
}

export function isBrandFontToken(value: string): value is BrandFontToken {
  return (BRAND_FONT_TOKENS as readonly string[]).includes(value);
}
