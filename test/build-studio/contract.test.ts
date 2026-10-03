import { describe, expect, it } from 'vitest';
import {
  BUILD_STUDIO_LIMITS,
  attachSurface,
  createBuildProject,
  entryRouteFor,
  surfaceKindFor,
} from '../../src/features/build-studio/contract';

describe('Builder-01 contract', () => {
  it('maps landing and website onto the existing SiteOS surface', () => {
    expect(surfaceKindFor('landing')).toBe('site');
    expect(surfaceKindFor('website')).toBe('site');
    expect(entryRouteFor('landing')).toBe('/build');
  });

  it('maps app kinds onto the existing code surface', () => {
    expect(surfaceKindFor('web_app')).toBe('code');
    expect(surfaceKindFor('dashboard')).toBe('code');
    expect(surfaceKindFor('saas_app')).toBe('code');
    expect(entryRouteFor('saas_app')).toBe('/builder/:slug/code');
  });

  it('refuses a project without a session tenant', () => {
    expect(() =>
      createBuildProject({
        id: 'p1',
        tenantId: '  ',
        name: 'North',
        slug: 'north',
        kind: 'landing',
      }),
    ).toThrow(/session/);
  });

  it('does not invent a store or a deploy', () => {
    const project = createBuildProject({
      id: 'p1',
      tenantId: 'tenant-from-session',
      name: 'North',
      slug: 'north',
      kind: 'landing',
      siteRef: 'blueprint-1',
    });
    expect(project.status).toBe('draft');
    expect(project.surfaces).toEqual([
      { kind: 'site', ref: 'blueprint-1', route: '/builder/:slug' },
    ]);
    expect(BUILD_STUDIO_LIMITS).toEqual({
      persistence: 'none',
      tenantSource: 'session',
      deploy: 'not_authorised',
    });
  });

  it('attaches an app as a second surface instead of a second engine', () => {
    const project = createBuildProject({
      id: 'p1',
      tenantId: 'tenant-from-session',
      name: 'North',
      slug: 'north',
      kind: 'landing',
      siteRef: 'blueprint-1',
    });
    const combined = attachSurface(project, {
      kind: 'code',
      ref: 'code-1' as never,
      route: '/builder/:slug/code',
    });
    expect(combined.surfaces.map((surface) => surface.kind)).toEqual(['site', 'code']);
    expect(() => attachSurface(combined, combined.surfaces[1])).toThrow(/already attached/);
  });
});
