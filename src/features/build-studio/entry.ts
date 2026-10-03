/**
 * Builder-02. `/build` is the one entry. The kind decides the engine;
 * the engines and their routes stay as they are.
 */

import { slugify } from '../../../packages/siteos-core/src/index';
import {
  BUILD_PROJECT_KINDS,
  surfaceHref,
  surfaceKindFor,
  type AppBuilderSlug,
  type BuildProjectKind,
} from './contract';

export const DEFAULT_BUILD_KIND: BuildProjectKind = 'website';

export const BUILD_KIND_LABEL: Readonly<Record<BuildProjectKind, string>> = {
  landing: 'Landingpage',
  website: 'Website',
  web_app: 'Web-App',
  dashboard: 'Dashboard',
  saas_app: 'SaaS-App',
};

/** `?kind=` from old entries. Anything unknown keeps today's website flow. */
export function parseBuildKind(raw: string | null | undefined): BuildProjectKind {
  const value = raw?.trim().toLowerCase();
  return (BUILD_PROJECT_KINDS as readonly string[]).includes(value ?? '')
    ? (value as BuildProjectKind)
    : DEFAULT_BUILD_KIND;
}

/**
 * Where a code kind continues. Name first, else the opening words of the
 * description. Tenant and entitlement are checked by the code builder page.
 */
export function codeEntryHref(kind: BuildProjectKind, name: string, description = ''): string {
  if (surfaceKindFor(kind) !== 'code') {
    throw new Error(`${kind} stays in the SiteOS flow on /build`);
  }
  const source = name.trim() || description.trim().split(/\s+/).slice(0, 4).join(' ');
  // slugify falls back to 'site' when nothing survives; an app is not a site.
  const base = slugify(source);
  const slug = (base === 'site' && !/site/i.test(source) ? 'app' : base) as AppBuilderSlug;
  return surfaceHref({ kind: 'code', slug, route: '/builder/:slug/code' });
}
