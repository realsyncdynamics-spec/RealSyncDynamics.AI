/**
 * Builder-01. Product identity over the two stores that already exist.
 * Not a table, not a tenant, not a deploy.
 */

export const BUILD_PROJECT_KINDS = [
  'landing',
  'website',
  'web_app',
  'dashboard',
  'saas_app',
] as const;

export type BuildProjectKind = (typeof BUILD_PROJECT_KINDS)[number];

export const BUILD_PROJECT_STATUSES = [
  'draft',
  'preview',
  'review',
  'approved',
  'published',
] as const;

export type BuildProjectStatus = (typeof BUILD_PROJECT_STATUSES)[number];

/**
 * Both stores keep one row per (tenant_id, slug, version). A row id pins one
 * version; the routes are addressed by slug. A surface therefore points at the
 * store slug, never at a row id.
 */
export type SiteOsSlug = string & { readonly __brand: 'SiteOsSlug' };
export type AppBuilderSlug = string & { readonly __brand: 'AppBuilderSlug' };

export type BuildSurface =
  | {
      kind: 'site';
      slug: SiteOsSlug;
      route: '/builder/:slug';
    }
  | {
      kind: 'code';
      slug: AppBuilderSlug;
      route: '/builder/:slug/code';
    };

export interface BuildProject {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  kind: BuildProjectKind;
  status: BuildProjectStatus;
  surfaces: readonly BuildSurface[];
  createdAt: string;
  updatedAt: string;
}

const SITE_KINDS = new Set<BuildProjectKind>(['landing', 'website']);

export function surfaceKindFor(kind: BuildProjectKind): BuildSurface['kind'] {
  return SITE_KINDS.has(kind) ? 'site' : 'code';
}

export function entryRouteFor(kind: BuildProjectKind): BuildSurface['route'] | '/build' {
  return surfaceKindFor(kind) === 'site' ? '/build' : '/builder/:slug/code';
}

export function surfaceHref(surface: BuildSurface): string {
  const slug = encodeURIComponent(surface.slug);
  return surface.kind === 'site' ? `/builder/${slug}` : `/builder/${slug}/code`;
}

export function createBuildProject(input: {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  kind: BuildProjectKind;
  siteSlug?: string;
  codeSlug?: string;
  now?: string;
}): BuildProject {
  if (!input.tenantId.trim()) {
    throw new Error('tenantId comes from the session, not the URL');
  }
  const now = input.now ?? new Date().toISOString();
  const surface = surfaceKindFor(input.kind);
  // A slug for the other engine is a caller error, not something to drop silently.
  if (surface === 'site' && input.codeSlug) {
    throw new Error(`${input.kind} opens a site surface; attach code with attachSurface`);
  }
  if (surface === 'code' && input.siteSlug) {
    throw new Error(`${input.kind} opens a code surface; attach a site with attachSurface`);
  }
  const surfaces: BuildSurface[] = [];
  if (surface === 'site' && input.siteSlug) {
    surfaces.push({
      kind: 'site',
      slug: input.siteSlug as SiteOsSlug,
      route: '/builder/:slug',
    });
  }
  if (surface === 'code' && input.codeSlug) {
    surfaces.push({
      kind: 'code',
      slug: input.codeSlug as AppBuilderSlug,
      route: '/builder/:slug/code',
    });
  }
  return {
    id: input.id,
    tenantId: input.tenantId,
    name: input.name,
    slug: input.slug,
    kind: input.kind,
    status: 'draft',
    surfaces,
    createdAt: now,
    updatedAt: now,
  };
}

/** A second surface is how a site and an app share one project. Not a new engine. */
export function attachSurface(project: BuildProject, surface: BuildSurface, now = new Date().toISOString()): BuildProject {
  if (project.surfaces.some((existing) => existing.kind === surface.kind)) {
    throw new Error(`surface ${surface.kind} already attached`);
  }
  return {
    ...project,
    surfaces: [...project.surfaces, surface],
    updatedAt: now,
  };
}

export const BUILD_STUDIO_LIMITS = {
  persistence: 'none',
  tenantSource: 'session',
  deploy: 'not_authorised',
} as const;
