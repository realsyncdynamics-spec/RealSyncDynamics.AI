/**
 * /app/onboarding — Rollen (Entscheidung zu #1930):
 *
 * - owner/admin: Assistent durchlaufen und anlegen (create_asset).
 * - editor/dpo/viewer_auditor: Assistent ansehen, Hinweis schon in Schritt 1,
 *   Anlegen gesperrt — kein create_asset-Aufruf, kein spätes 403.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const tenant = vi.hoisted(() => ({ role: 'owner' as string }));
const resources = vi.hoisted(() => ({
  createAsset: vi.fn(),
  saveAssetClassification: vi.fn(),
  autoMapAsset: vi.fn(),
}));

vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: 'tenant-1',
    tenants: [{ tenantId: 'tenant-1', name: 'Acme', role: tenant.role }],
    setActiveTenant: vi.fn(),
    loading: false,
    entitlements: null,
    hasFeature: () => false,
  }),
}));
vi.mock('@/src/features/kodee/connections/AuthGate', () => ({
  AuthGate: ({ children }: { children: (session: unknown) => ReactNode }) => <>{children({})}</>,
}));
vi.mock('@/src/features/governance/resourcesApi', () => resources);

import { OnboardingView } from '@/src/features/governance/OnboardingView';
import { resetLangForTests } from '@/src/i18n/useLang';

function renderOnboarding() {
  return render(<MemoryRouter><OnboardingView /></MemoryRouter>);
}

function fillRegisterStep() {
  fireEvent.change(screen.getByPlaceholderText(/Kundenservice-Chatbot/), { target: { value: 'Website-Chatbot' } });
  fireEvent.change(screen.getByPlaceholderText(/Beantwortet Kundenanfragen/), {
    target: { value: 'Beantwortet Kundenanfragen auf unserer Website.' },
  });
}

beforeEach(() => {
  resetLangForTests();
  tenant.role = 'owner';
  resources.createAsset.mockReset().mockResolvedValue({
    ok: true,
    asset: { id: 'new', name: 'Website-Chatbot', intended_purpose: 'Beantwortet Kundenanfragen auf unserer Website.' },
  });
});

describe('/app/onboarding — Schreibrecht', () => {
  it.each(['owner', 'admin'])('%s: kein Hinweis, Anlegen ruft create_asset', async (role) => {
    tenant.role = role;
    renderOnboarding();
    expect(screen.queryByTestId('registry-write-locked')).toBeNull();
    fillRegisterStep();
    const submit = screen.getByRole('button', { name: /System registrieren/ });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(resources.createAsset).toHaveBeenCalledTimes(1));
    expect(resources.createAsset.mock.calls[0]![0]).toMatchObject({
      tenant_id: 'tenant-1',
      asset_type: 'ai_system',
      name: 'Website-Chatbot',
      ai_act_class: 'unknown',
    });
    // Weiter zur Risikoeinstufung — gespeichert wird sie erst dort.
    expect(await screen.findByRole('button', { name: /Risikobewertung durchführen/ })).toBeInTheDocument();
  });

  it.each(['editor', 'dpo', 'viewer_auditor'])('%s: Hinweis ab Schritt 1, Anlegen gesperrt', (role) => {
    tenant.role = role;
    renderOnboarding();
    expect(screen.getByTestId('registry-write-locked')).toHaveTextContent('Registrieren können nur Owner oder Admin');
    fillRegisterStep();
    expect(screen.getByTestId('registry-write-locked')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /System registrieren/ });
    expect(submit).toBeDisabled();
    fireEvent.submit(submit.closest('form')!);
    expect(resources.createAsset).not.toHaveBeenCalled();
  });
});
