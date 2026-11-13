/**
 * Fiktive Mandanten für die Hüllen-Vorschau.
 * Keine Kundendaten, keine Schreibzugriffe. Nur auf den Vorschau-Pfaden aktiv.
 */
import type { TenantRole } from '../billing/types';
import type { PlanKey } from '@/shared/pricing';
import type { TenantSummary } from './load-entitlements';

/** Modi aus dem Design-Token-Set (semantic). Neutraler Basis-Modus ist light-cream. */
export const THEME_MODES = ['light-cream', 'pure-white-silver', 'warm-graphite'] as const;
export type ThemeModeId = (typeof THEME_MODES)[number];
export const DEFAULT_THEME_MODE: ThemeModeId = 'light-cream';

export const FIXTURE_ACTIVE_KEY = 'realsync.fixtureTenantId';

export interface FixtureTenant extends TenantSummary {
  plan: PlanKey;
  themeId: ThemeModeId;
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
    tenantId: 'fixture-lichtkante',
    name: 'Fixture · Lichtkante',
    isPublicSector: false,
    industry: 'handwerk',
    role: 'owner' satisfies TenantRole,
    plan: 'starter',
    themeId: 'light-cream',
    featureFlags: { ...FLAGS_OFF, 'shell.api-console': true },
  },
  {
    tenantId: 'fixture-silberweiss',
    name: 'Fixture · Silberweiß',
    isPublicSector: false,
    industry: 'atelier',
    role: 'admin',
    plan: 'growth',
    themeId: 'pure-white-silver',
    featureFlags: { ...FLAGS_OFF, 'shell.terminal': true, 'shell.seo': true },
  },
  {
    tenantId: 'fixture-warmgraphit',
    name: 'Fixture · Warmgraphit',
    isPublicSector: false,
    industry: 'werkstatt',
    role: 'viewer_auditor',
    plan: 'enterprise',
    themeId: 'warm-graphite',
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
