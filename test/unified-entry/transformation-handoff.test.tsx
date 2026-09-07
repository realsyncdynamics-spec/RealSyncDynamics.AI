import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { buildSiteFromPrompt, canonicalHash } from '../../packages/siteos-core/src/index';

/**
 * Der Erstbau (`/unified-entry/transformation`) endet im App Builder
 * Workspace — ein Builder, nicht zwei. Geprüft wird die Übergabe: Ziel,
 * Slug, Quelle, und dass eine Anweisung aus dem Workspace den Erstbau
 * erreicht.
 */
const invoke = vi.fn();
vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke: (...args: unknown[]) => invoke(...args) } }),
}));
const buildSite = vi.fn();
vi.mock('../../src/features/siteos/siteOsApi', () => ({
  buildSite: (...args: unknown[]) => buildSite(...args),
  errorMessage: (e: { message?: string }) => e.message ?? 'Fehler',
}));
vi.mock('../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({ activeTenantId: 'tenant-1', loading: false }),
}));
vi.mock('../../src/features/supabase/SupabaseAuthContext', () => ({
  useSupabaseAuth: () => ({ isAuthenticated: true }),
}));
vi.mock('../../src/components/landing/EdgeFunctionAvailabilityNotice', () => ({
  allEdgeFunctionsAvailable: () => true,
  EdgeFunctionAvailabilityNotice: () => null,
}));
vi.mock('../../src/features/billing/checkout', () => ({ createSiteOsCheckoutSession: vi.fn() }));
vi.mock('../../src/components/preview/SandboxedPreviewFrame', () => ({ SandboxedPreviewFrame: () => null }));

const { default: PreviewSelectionPage } = await import('../../src/unified-entry/pages/PreviewSelectionPage');

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}{loc.search}</div>;
}

function renderAt(search: string) {
  window.history.replaceState({}, '', `/unified-entry/transformation${search}`);
  return render(
    <MemoryRouter initialEntries={[`/unified-entry/transformation${search}`]}>
      <Routes>
        <Route path="/unified-entry/transformation" element={<PreviewSelectionPage />} />
        <Route path="/builder/:slug" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

let sampleSlug = '';
beforeEach(async () => {
  invoke.mockReset(); buildSite.mockReset();
  invoke.mockResolvedValue({ data: { source_url: 'https://ihre-firma.de/', title: 'Ihre Firma', description: null, h1: null, services: ['Beratung'], visible_text: '' }, error: null });
  const { blueprint } = await buildSiteFromPrompt('Erstelle eine Website für einen Zahnarzt in Hamburg.', { locale: 'de', model: 'test-model', createdAt: '2026-09-06T00:00:00.000Z' });
  sampleSlug = blueprint.slug;
  buildSite.mockResolvedValue({ kind: 'ok', data: { ok: true, unchanged: false, blueprint, content_sha256: await canonicalHash(blueprint), version: 1, slug: blueprint.slug, findings: [], scores: {} } });
});

describe('Erstbau → Workspace', () => {
  it('leitet nach dem Erstbau in den Workspace der neuen Site, mit der Quelle als Parameter', async () => {
    renderAt('?url=https%3A%2F%2Fihre-firma.de%2F');
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(`/builder/${sampleSlug}?source=https%3A%2F%2Fihre-firma.de%2F`));
    expect(buildSite).toHaveBeenCalledTimes(1);
  });

  it('nimmt eine Anweisung aus dem Workspace in den Erstbau auf', async () => {
    renderAt('?url=https%3A%2F%2Fihre-firma.de%2F&instruction=Hero+hochwertiger');
    await waitFor(() => expect(buildSite).toHaveBeenCalledTimes(1));
    const args = buildSite.mock.calls[0][0] as { prompt: string };
    expect(args.prompt).toContain('Zusätzliche Kundenanweisung: Hero hochwertiger');
  });
});
