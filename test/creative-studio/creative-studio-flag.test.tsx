import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { buildCommandCatalog } from '../../src/components/governance-os/commandCenterCatalog';
import { CREATIVE_STUDIO_PATH, isCreativeStudioEditorEnabled } from '../../src/config/featureFlags';
import { creativeStudioGate } from '../../src/features/creative-studio/access';

const tenant = vi.hoisted(() => ({ missing: false, loading: false }));

vi.mock('../../src/core/access/TenantProvider', () => ({
  useOptionalTenant: () => (tenant.missing ? null : { loading: tenant.loading }),
}));

vi.mock('../../src/features/creative-studio/SocialDesignEditor', () => ({
  SocialDesignEditor: () => <div data-testid="social-design-editor" />,
}));

import { CreativeStudioRoute } from '../../src/features/creative-studio/CreativeStudioRoute';

function renderRoute() {
  return render(
    <MemoryRouter>
      <CreativeStudioRoute />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  tenant.missing = false;
  tenant.loading = false;
});

describe('creative_studio_editor', () => {
  it('ist standardmäßig aus und nur mit exakt "true" an', () => {
    vi.stubEnv('VITE_CREATIVE_STUDIO_EDITOR_ENABLED', '');
    expect(isCreativeStudioEditorEnabled()).toBe(false);
    vi.stubEnv('VITE_CREATIVE_STUDIO_EDITOR_ENABLED', 'false');
    expect(isCreativeStudioEditorEnabled()).toBe(false);
    vi.stubEnv('VITE_CREATIVE_STUDIO_EDITOR_ENABLED', '1');
    expect(isCreativeStudioEditorEnabled()).toBe(false);
    vi.stubEnv('VITE_CREATIVE_STUDIO_EDITOR_ENABLED', 'true');
    expect(isCreativeStudioEditorEnabled()).toBe(true);
  });

  it('schließt zu, solange Entitlements laden, auch bei gesetztem Flag', () => {
    expect(creativeStudioGate({ flagEnabled: false, entitlementsLoading: true })).toBe('closed');
    expect(creativeStudioGate({ flagEnabled: false, entitlementsLoading: false })).toBe('closed');
    expect(creativeStudioGate({ flagEnabled: true, entitlementsLoading: true })).toBe('loading');
    expect(creativeStudioGate({ flagEnabled: true, entitlementsLoading: false })).toBe('open');
  });
});

describe('/app/creative-studio', () => {
  it('zeigt bei Flag aus die NotFound-Seite und lädt den Editor nicht', async () => {
    vi.stubEnv('VITE_CREATIVE_STUDIO_EDITOR_ENABLED', 'false');
    tenant.loading = false;
    renderRoute();
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId('social-design-editor')).not.toBeInTheDocument();
  });

  it('zeigt beim Laden nicht den Editor', () => {
    vi.stubEnv('VITE_CREATIVE_STUDIO_EDITOR_ENABLED', 'true');
    tenant.loading = true;
    renderRoute();
    expect(screen.getByTestId('creative-studio-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('social-design-editor')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Seite nicht gefunden' })).not.toBeInTheDocument();
  });

  it('bleibt zu, wenn kein Mandantenkontext da ist', () => {
    vi.stubEnv('VITE_CREATIVE_STUDIO_EDITOR_ENABLED', 'true');
    tenant.missing = true;
    renderRoute();
    expect(screen.getByTestId('creative-studio-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('social-design-editor')).not.toBeInTheDocument();
  });

  it('zeigt den Editor, wenn das Flag an ist und die Entitlements geladen sind', async () => {
    vi.stubEnv('VITE_CREATIVE_STUDIO_EDITOR_ENABLED', 'true');
    tenant.loading = false;
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('social-design-editor')).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Seite nicht gefunden' })).not.toBeInTheDocument();
  });
});

describe('Navigation', () => {
  it('führt den Editor bei Flag aus und während des Ladens nicht', () => {
    vi.stubEnv('VITE_CREATIVE_STUDIO_EDITOR_ENABLED', 'false');
    expect(buildCommandCatalog({ entitlementsLoading: false }).some((c) => c.path === CREATIVE_STUDIO_PATH)).toBe(false);
    vi.stubEnv('VITE_CREATIVE_STUDIO_EDITOR_ENABLED', 'true');
    expect(buildCommandCatalog({ entitlementsLoading: true }).some((c) => c.path === CREATIVE_STUDIO_PATH)).toBe(false);
    expect(buildCommandCatalog({ entitlementsLoading: false }).some((c) => c.path === CREATIVE_STUDIO_PATH)).toBe(true);
  });
});
