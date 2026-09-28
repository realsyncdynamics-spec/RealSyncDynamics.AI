import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Governance AI ist vorübergehend verborgen: GovernanceAiWorkspace ruft
// ai-gateway mit dem Anon-Key auf. Der Test stellt sicher, dass der
// Workspace bei abgeschaltetem Flag weder geladen noch gemountet wird und
// dass kein Gateway-Aufruf entsteht.

const workspace = vi.hoisted(() => ({ imported: 0, mounted: 0 }));
const gateway = vi.hoisted(() => ({ constructed: 0 }));

vi.mock('@/src/features/governance/dashboard/GovernanceAiWorkspace', () => {
  workspace.imported += 1;
  return {
    GovernanceAiWorkspace: () => {
      workspace.mounted += 1;
      return <div data-testid="governance-ai-workspace">Workspace</div>;
    },
  };
});

vi.mock('@/src/core/ai-gateway/edgeClient', async (orig) => {
  const actual = await orig<typeof import('@/src/core/ai-gateway/edgeClient')>();
  class CountingClient extends actual.AiGatewayEdgeClient {
    constructor(...args: ConstructorParameters<typeof actual.AiGatewayEdgeClient>) {
      super(...args);
      gateway.constructed += 1;
    }
  }
  return { ...actual, AiGatewayEdgeClient: CountingClient };
});

import { GovernanceAiRoute } from '@/src/features/governance/dashboard/GovernanceAiRoute';
import { GOVERNANCE_AI_PATH, isGovernanceAiEnabled } from '@/src/config/featureFlags';
import { buildCommandCatalog, resolveCommandPath } from '@/src/components/governance-os/commandCenterCatalog';
import { ComplianceStatusView } from '@/src/features/governance/dashboard/ComplianceStatusDashboard';
import { resetLangForTests, setLang } from '@/src/i18n/useLang';

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={[GOVERNANCE_AI_PATH]}>
      <GovernanceAiRoute />
    </MemoryRouter>,
  );
}

function renderStatus() {
  return render(
    <MemoryRouter initialEntries={['/app/dashboard']}>
      <ComplianceStatusView tenantName="Acme GmbH" activeTenantId="tenant-1" data={null} loading={false} error={null} />
    </MemoryRouter>,
  );
}

let fetchSpy: { mock: { calls: unknown[][] }; mockRestore: () => void };

beforeEach(() => {
  workspace.imported = 0;
  workspace.mounted = 0;
  gateway.constructed = 0;
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  vi.unstubAllEnvs();
  fetchSpy.mockRestore();
  act(() => resetLangForTests());
});

function gatewayFetches(): number {
  return fetchSpy.mock.calls.filter((call) => String(call[0]).includes('ai-gateway')).length;
}

describe('GOVERNANCE_AI-Flag', () => {
  it('ist standardmäßig aus und nur mit exakt "true" an', () => {
    vi.stubEnv('VITE_GOVERNANCE_AI_ENABLED', '');
    expect(isGovernanceAiEnabled()).toBe(false);
    vi.stubEnv('VITE_GOVERNANCE_AI_ENABLED', 'false');
    expect(isGovernanceAiEnabled()).toBe(false);
    vi.stubEnv('VITE_GOVERNANCE_AI_ENABLED', '1');
    expect(isGovernanceAiEnabled()).toBe(false);
    vi.stubEnv('VITE_GOVERNANCE_AI_ENABLED', 'true');
    expect(isGovernanceAiEnabled()).toBe(true);
  });
});

describe('/app/assistant bei abgeschaltetem Flag', () => {
  it('zeigt den neutralen Hinweis mit Link zum Dashboard', () => {
    renderRoute();
    expect(screen.getByRole('heading', { name: 'Governance AI ist vorübergehend nicht verfügbar.' })).toBeInTheDocument();
    expect(screen.getByText('Wir sichern den Zugang gerade zusätzlich ab.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zum Dashboard' })).toHaveAttribute('href', '/app/dashboard');
  });

  it('lädt und mountet GovernanceAiWorkspace nicht und ruft ai-gateway nicht auf', async () => {
    renderRoute();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('governance-ai-workspace')).not.toBeInTheDocument();
    expect(workspace.imported).toBe(0);
    expect(workspace.mounted).toBe(0);
    expect(gateway.constructed).toBe(0);
    expect(gatewayFetches()).toBe(0);
  });

  it('zeigt den Hinweis auf Englisch, wenn EN aktiv ist', () => {
    act(() => setLang('en'));
    renderRoute();
    expect(screen.getByRole('heading', { name: 'Governance AI is temporarily unavailable.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the dashboard' })).toHaveAttribute('href', '/app/dashboard');
  });

  it('führt Governance AI weder in der Palette noch im Dashboard-Header', () => {
    const catalog = buildCommandCatalog();
    expect(catalog.some((c) => c.path === GOVERNANCE_AI_PATH)).toBe(false);
    expect(catalog.find((c) => c.id === 'nav-assistant-workspace')).toBeUndefined();
    // Die Sidebar-Aktion „Assistent öffnen“ ist eine andere Fläche und bleibt.
    expect(catalog.find((c) => c.id === 'action-assistant')).toBeDefined();

    renderStatus();
    expect(screen.queryByRole('link', { name: /Governance AI/ })).not.toBeInTheDocument();
    expect(document.querySelector(`a[href="${GOVERNANCE_AI_PATH}"]`)).toBeNull();
  });
});

describe('/app/assistant bei eingeschaltetem Flag (bisheriges Verhalten)', () => {
  beforeEach(() => vi.stubEnv('VITE_GOVERNANCE_AI_ENABLED', 'true'));

  it('mountet GovernanceAiWorkspace statt des Hinweises', async () => {
    renderRoute();
    await waitFor(() => expect(screen.getByTestId('governance-ai-workspace')).toBeInTheDocument());
    expect(screen.queryByTestId('governance-ai-unavailable')).not.toBeInTheDocument();
    expect(workspace.mounted).toBeGreaterThan(0);
  });

  it('führt den Eintrag in der Palette und den Link im Dashboard-Header', () => {
    const entry = buildCommandCatalog().find((c) => c.id === 'nav-assistant-workspace');
    expect(entry).toBeDefined();
    expect(resolveCommandPath(entry!)).toBe(GOVERNANCE_AI_PATH);

    renderStatus();
    expect(screen.getByRole('link', { name: /Governance AI/ })).toHaveAttribute('href', GOVERNANCE_AI_PATH);
  });
});
