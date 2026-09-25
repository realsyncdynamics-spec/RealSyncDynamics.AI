/**
 * P0-2 — Klassifizierung ohne ai_classification.limited (Free): Eingaben
 * gesperrt, gleiche Entscheidung wie das Nav-Schloss; dauerhafter Hinweis,
 * dass es noch keinen Speicherpfad gibt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const ent = vi.hoisted(() => ({ values: {} as Record<string, number> }));
vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: 'tenant-1',
    tenants: [],
    loading: false,
    entitlements: { byKey: {} },
    hasFeature: (key: string) => (ent.values[key] ?? 0) !== 0,
  }),
}));

const assets = [
  {
    id: 'a1',
    tenant_id: 'tenant-1',
    asset_type: 'ai_system',
    name: 'Support-Chatbot',
    description: null,
    owner_email: 'ops@example.com',
    vendor: 'Anthropic',
    system_url: null,
    data_types: [],
    risk_score: 10,
    ai_act_class: 'limited',
    status: 'active',
    metadata: { system_type: 'microsoft365' },
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'a2',
    tenant_id: 'tenant-1',
    asset_type: 'ai_system',
    name: 'Gateway',
    description: null,
    owner_email: null,
    vendor: null,
    system_url: null,
    data_types: [],
    risk_score: 0,
    ai_act_class: 'unknown',
    status: 'active',
    metadata: {},
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'w1',
    tenant_id: 'tenant-1',
    asset_type: 'website',
    name: 'Website',
    description: null,
    owner_email: null,
    vendor: null,
    system_url: null,
    data_types: [],
    risk_score: 0,
    ai_act_class: 'unknown',
    status: 'active',
    metadata: {},
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

vi.mock('@/src/features/governance/governanceApi', () => ({
  fetchTenantAssets: vi.fn(async () => assets),
}));
vi.mock('@/src/features/governance/gatesApi', () => ({
  listConnectors: vi.fn(async () => [
    {
      id: 'c1',
      tenant_id: 'tenant-1',
      system_type: 'ai_gateway',
      display_name: 'Gateway',
      source_table: 'governance_assets',
      source_id: 'a2',
      enforcement_class: 'A',
    },
  ]),
}));
vi.mock('@/src/lib/ai-act/conformityDossier', () => ({
  downloadConformityDossier: vi.fn(),
}));

import { AiSystemDetailView } from '@/src/features/governance/ai-registry/AiSystemDetailView';
import { resetLangForTests } from '@/src/i18n/useLang';
import { PLAN_ENTITLEMENTS } from '@/shared/pricing';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/ai-systems/:id" element={<AiSystemDetailView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Klassifizierung — Entitlement ai_classification.limited', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetLangForTests();
  });

  it('Free: Eingaben gesperrt, Hinweis „nicht enthalten“ und „nicht gespeichert“', async () => {
    ent.values = { ...(PLAN_ENTITLEMENTS.free_audit as Record<string, number>) };
    renderAt('/app/ai-systems/a1');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Support-Chatbot' })).toBeInTheDocument());
    expect(screen.getByTestId('classify-locked')).toBeInTheDocument();
    expect(screen.getByTestId('classify-no-save')).toHaveTextContent(/nicht gespeichert/);
    expect(screen.getByRole('button', { name: /Begrenzt/ })).toBeDisabled();
    expect(screen.getByRole('switch')).toBeDisabled();
    // „Zu Enforcement“ trägt das Schloss (policy.packs fehlt in Free).
    expect(screen.getByTestId('to-enforce-locked')).toBeInTheDocument();
  });

  it('mit Entitlement: Eingaben aktiv, Speicherpfad-Hinweis bleibt', async () => {
    ent.values = { 'ai_classification.limited': 1 };
    renderAt('/app/ai-systems/a1');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Support-Chatbot' })).toBeInTheDocument());
    expect(screen.queryByTestId('classify-locked')).toBeNull();
    expect(screen.getByTestId('classify-no-save')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Begrenzt/ })).not.toBeDisabled();
  });
});
