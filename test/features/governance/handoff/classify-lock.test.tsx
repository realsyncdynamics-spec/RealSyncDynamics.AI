/**
 * Klassifizierung im KI-Register: speicherbar über governance-resources
 * classify_asset für owner/admin (Server prüft), sonst lesend. Hängt nicht
 * mehr an ai_classification.limited (kein Plan gewährt den Key).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const ent = vi.hoisted(() => ({ values: {} as Record<string, number>, role: 'member' as string }));
vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: 'tenant-1',
    tenants: [{ tenantId: 'tenant-1', role: ent.role }],
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
  fetchAssetEvidenceStats: vi.fn(async () => new Map()),
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
const api = vi.hoisted(() => ({
  saveAssetClassification: vi.fn(async () => ({ ok: true })),
}));
vi.mock('@/src/features/governance/resourcesApi', () => ({
  saveAssetClassification: api.saveAssetClassification,
  createAsset: vi.fn(),
  updateAsset: vi.fn(),
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

// Der Mount-Effekt (setTier(storedTier)) kann unter Last nach dem ersten Klick
// laufen; wie in ai-system-detail-route.test.tsx klicken, bis die Wahl steht.
async function pickTier(name: RegExp) {
  await waitFor(() => {
    fireEvent.click(screen.getByRole('button', { name }));
    expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
  });
}

describe('Klassifizierung — Speichern über classify_asset', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetLangForTests();
    api.saveAssetClassification.mockClear();
  });

  it('Mitglied ohne owner/admin: Eingaben gesperrt, kein Speichern', async () => {
    ent.role = 'member';
    ent.values = { ...(PLAN_ENTITLEMENTS.free_audit as Record<string, number>) };
    renderAt('/app/ai-systems/a1');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Support-Chatbot' })).toBeInTheDocument());
    expect(screen.getByTestId('classify-locked')).toHaveTextContent(/Nur Owner oder Admin/);
    expect(screen.getByRole('button', { name: /Begrenzt/ })).toBeDisabled();
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.queryByTestId('classify-save')).toBeNull();
    // „Zu Enforcement“ trägt das Schloss (policy.packs fehlt in Free).
    expect(screen.getByTestId('to-enforce-locked')).toBeInTheDocument();
  });

  it('Owner im Free-Plan: Eingaben aktiv, Speichern schreibt Klasse, Annex III und Art. 50', async () => {
    ent.role = 'owner';
    ent.values = { ...(PLAN_ENTITLEMENTS.free_audit as Record<string, number>) };
    renderAt('/app/ai-systems/a1');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Support-Chatbot' })).toBeInTheDocument());
    expect(screen.queryByTestId('classify-locked')).toBeNull();
    const save = screen.getByTestId('classify-save');
    expect(save).toBeDisabled();
    expect(screen.getByTestId('classify-save-status')).toHaveTextContent(/keine offenen Änderungen/);

    fireEvent.click(screen.getByRole('button', { name: /Hoch/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Annex III' }), { target: { value: 'employment' } });
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByTestId('draft-unsaved')).toBeInTheDocument();
    expect(save).not.toBeDisabled();

    fireEvent.click(save);
    await waitFor(() => expect(api.saveAssetClassification).toHaveBeenCalledTimes(1));
    expect(api.saveAssetClassification).toHaveBeenCalledWith({
      asset_id: 'a1',
      ai_act_class: 'high',
      annex_iii_category: 'employment',
      art50: true,
    });
  });

  it('Art. 50 nicht erfasst und nicht bedient: Speichern lässt art50 weg', async () => {
    ent.role = 'owner';
    renderAt('/app/ai-systems/a1');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Support-Chatbot' })).toBeInTheDocument());
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    await pickTier(/Hoch/);
    fireEvent.click(screen.getByTestId('classify-save'));
    await waitFor(() => expect(api.saveAssetClassification).toHaveBeenCalledTimes(1));
    expect(api.saveAssetClassification).toHaveBeenCalledWith({
      asset_id: 'a1',
      ai_act_class: 'high',
      annex_iii_category: null,
    });
  });

  it('Während des Speicherns sind die Eingaben gesperrt', async () => {
    ent.role = 'owner';
    let resolve!: (v: unknown) => void;
    api.saveAssetClassification.mockImplementationOnce(
      () => new Promise((r) => { resolve = r; }) as never,
    );
    renderAt('/app/ai-systems/a1');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Support-Chatbot' })).toBeInTheDocument());
    await pickTier(/Hoch/);
    fireEvent.click(screen.getByTestId('classify-save'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Minimal/ })).toBeDisabled());
    expect(screen.getByRole('combobox', { name: 'Annex III' })).toBeDisabled();
    expect(screen.getByRole('switch')).toBeDisabled();
    await act(async () => resolve({ ok: true }));
  });

  it('Serverfehler wird angezeigt, Entwurf bleibt', async () => {
    ent.role = 'admin';
    api.saveAssetClassification.mockResolvedValueOnce({ ok: false, error: { code: 'FORBIDDEN', message: 'must be owner or admin' } } as never);
    renderAt('/app/ai-systems/a1');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Support-Chatbot' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Minimal/ }));
    fireEvent.click(screen.getByTestId('classify-save'));
    expect(await screen.findByRole('alert')).toHaveTextContent('must be owner or admin');
    expect(screen.getByTestId('draft-unsaved')).toBeInTheDocument();
  });

  it('Verwerfen setzt auf den gespeicherten Stand zurück', async () => {
    ent.role = 'owner';
    renderAt('/app/ai-systems/a1');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Support-Chatbot' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Hoch/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(screen.queryByTestId('draft-unsaved')).toBeNull();
    expect(screen.getByRole('button', { name: /Begrenzt/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
