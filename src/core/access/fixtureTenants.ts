/**
 * Fiktive Mandanten für die Hüllen-Vorschau.
 * Keine Kundendaten, keine Schreibzugriffe. Nur auf den Vorschau-Pfaden aktiv.
 */
import type { TenantRole } from '../billing/types';
import type { PlanKey } from '@/shared/pricing';
import type { TenantSummary } from './load-entitlements';

/** Basis-Modi der Light Experience. Fixture-Vorschau nutzt die DNA-Beispiele. */
export const THEME_MODES = ['light-cream', 'pure-white-silver', 'warm-graphite'] as const;
export type ThemeModeId = (typeof THEME_MODES)[number];
export const DEFAULT_THEME_MODE: ThemeModeId = 'light-cream';

/** Beispiel-Themes, klar als Beispiel gekennzeichnet. Keine Kundenmarken. */
export const FIXTURE_THEMES = ['beispiel-handwerk', 'beispiel-b2b-saas', 'beispiel-kanzlei'] as const;
export type FixtureThemeId = (typeof FIXTURE_THEMES)[number];
export type TenantThemeId = ThemeModeId | FixtureThemeId;

export const FIXTURE_ACTIVE_KEY = 'realsync.fixtureTenantId';

export interface FixtureTenant extends TenantSummary {
  plan: PlanKey;
  themeId: FixtureThemeId;
  featureFlags: Readonly<Record<string, boolean>>;
}

const FLAGS_OFF = {
  'shell.platform-admin': false,
  'shell.api-console': false,
  'shell.terminal': false,
  'shell.command-center': false,
  'shell.seo': false,
  'shell.legacy-modules': false,
  'shell.print': false,
} as const;

export const FIXTURE_TENANTS: readonly FixtureTenant[] = [
  {
    tenantId: 'fixture-handwerk',
    name: 'Beispiel · Handwerk',
    isPublicSector: false,
    industry: 'handwerk',
    role: 'owner' satisfies TenantRole,
    plan: 'starter',
    themeId: 'beispiel-handwerk',
    featureFlags: { ...FLAGS_OFF, 'shell.api-console': true },
  },
  {
    tenantId: 'fixture-b2b-saas',
    name: 'Beispiel · B2B-SaaS',
    isPublicSector: false,
    industry: 'software',
    role: 'admin',
    plan: 'growth',
    themeId: 'beispiel-b2b-saas',
    featureFlags: { ...FLAGS_OFF, 'shell.terminal': true, 'shell.seo': true },
  },
  {
    tenantId: 'fixture-kanzlei',
    name: 'Beispiel · Kanzlei',
    isPublicSector: false,
    industry: 'kanzlei',
    role: 'viewer_auditor',
    plan: 'enterprise',
    themeId: 'beispiel-kanzlei',
    featureFlags: { ...FLAGS_OFF, 'shell.print': true },
  },
];

export function isFixtureTenantPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return path === '/design/app-shell'
    || path.startsWith('/design/app-shell/')
    || path === '/app/preview'
    || path.startsWith('/app/preview/');
}

export function pathRequestsFixtures(): boolean {
  if (typeof window === 'undefined') return false;
  const base = String(import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '');
  const raw = window.location.pathname || '/';
  const path = base && raw.startsWith(base)
    ? (raw.slice(base.length).startsWith('/') ? raw.slice(base.length) : `/${raw.slice(base.length)}`) || '/'
    : raw;
  return isFixtureTenantPath(path || '/');
}
