/**
 * KI-Register (Auftrag §14): anlegen und bearbeiten aus /app/ai-systems.
 *
 * - „KI-System hinzufügen“ nur für owner/admin (wie governance-resources);
 *   andere Rollen sehen den gesperrten Knopf mit Begründung.
 * - Anlegen schickt Typ, Anbieter, Modell, Betrieb, Datenstandort, Zweck,
 *   Verantwortung und die eigene AI-Act-Einschätzung — Mandant aus dem
 *   TenantProvider, kein metadata.system_type.
 * - Bearbeiten schickt nur Register-Felder (keine Klasse, kein Mandant).
 * - Die Ampel kommt aus den Daten: ohne Angaben „Unzureichende Daten“.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const tenant = vi.hoisted(() => ({ role: 'owner' as string }));
const resources = vi.hoisted(() => ({ createAsset: vi.fn(), updateAsset: vi.fn() }));

vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: 'tenant-1',
    tenants: [{ tenantId: 'tenant-1', name: 'Acme', role: tenant.role }],
    loading: false,
    entitlements: null,
    hasFeature: () => false,
  }),
}));

const base = {
  tenant_id: 'tenant-1', asset_type: 'ai_system', description: null, system_url: null, data_types: [],
  risk_score: 0, status: 'active', metadata: {}, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
};
const assets = [
  {
    ...base, id: 'a1', name: 'Kundenservice-Copilot', owner_email: 'dpo@acme.de', vendor: 'Mistral',
    ai_act_class: 'limited', ai_system_type: 'external_ai', model_name: 'mistral-large',
    deployment_model: 'vendor_cloud', data_residency: 'eu', intended_purpose: 'Antwortentwürfe',
  },
  { ...base, id: 'a2', name: 'Altbestand', owner_email: null, vendor: null, ai_act_class: 'unknown' },
];

vi.mock('@/src/features/governance/governanceApi', () => ({
  fetchTenantAssets: vi.fn(async () => assets),
  fetchAssetEvidenceStats: vi.fn(async () => new Map([['a1', { count: 1, latestAt: '2026-09-20T10:00:00Z' }]])),
}));
vi.mock('@/src/features/governance/gatesApi', () => ({ listConnectors: vi.fn(async () => []) }));
vi.mock('@/src/features/governance/resourcesApi', () => resources);
vi.mock('@/src/lib/ai-act/conformityDossier', () => ({ downloadConformityDossier: vi.fn() }));

import { AiSystemRegistryView } from '@/src/features/governance/ai-registry/AiSystemRegistryView';
import { AiSystemDetailView } from '@/src/features/governance/ai-registry/AiSystemDetailView';
import { resetLangForTests } from '@/src/i18n/useLang';

function renderRegistry() {
  return render(<MemoryRouter><AiSystemRegistryView /></MemoryRouter>);
}
function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/app/ai-systems/${id}`]}>
      <Routes><Route path="/app/ai-systems/:id" element={<AiSystemDetailView />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetLangForTests();
  tenant.role = 'owner';
  resources.createAsset.mockReset().mockResolvedValue({ ok: true, asset: { id: 'new' } });
  resources.updateAsset.mockReset().mockResolvedValue({ ok: true, asset: { id: 'a1' } });
});

describe('/app/ai-systems — KI-System hinzufügen', () => {
  it('zeigt Typ, Anbieter/Modell und eine Ampel aus den Daten', async () => {
    renderRegistry();
    const rows = await screen.findAllByTestId('ai-system-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('Externe KI (Dienst/API)')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Mistral · mistral-large')).toBeInTheDocument();
    expect(within(rows[0]!).getByTestId('registry-light')).toHaveAttribute('data-light', 'green');
    expect(within(rows[1]!).getByTestId('registry-light')).toHaveAttribute('data-light', 'insufficient_data');
  });

  it.each(['editor', 'dpo', 'viewer_auditor'])('%s: Knopf gesperrt mit Begründung', async (role) => {
    tenant.role = role;
    renderRegistry();
    await screen.findAllByTestId('ai-system-row');
    expect(screen.getByTestId('ai-system-add')).toBeDisabled();
    expect(screen.getByTestId('ai-system-add-locked')).toHaveTextContent('Nur Owner oder Admin');
  });

  it('owner legt an: alle Register-Felder, Mandant aus dem Kontext, ohne system_type', async () => {
    renderRegistry();
    await screen.findAllByTestId('ai-system-row');
    fireEvent.click(screen.getByTestId('ai-system-add'));
    const form = screen.getByTestId('ai-system-form');
    fireEvent.change(within(form).getByLabelText(/^Name/), { target: { value: 'Lokales Granite' } });
    fireEvent.change(within(form).getByLabelText(/^Systemtyp/), { target: { value: 'local_ai' } });
    fireEvent.change(within(form).getByLabelText(/^Anbieter/), { target: { value: 'IBM' } });
    fireEvent.change(within(form).getByLabelText(/^Modell/), { target: { value: 'granite4.2:8b' } });
    fireEvent.change(within(form).getByLabelText(/^Betrieb/), { target: { value: 'local_device' } });
    fireEvent.change(within(form).getByLabelText(/^Datenstandort/), { target: { value: 'eu' } });
    fireEvent.change(within(form).getByLabelText(/^Verantwortlich/), { target: { value: 'it@acme.de' } });
    fireEvent.change(within(form).getByLabelText(/^AI-Act-Klasse/), { target: { value: 'minimal' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Anlegen' }));

    await waitFor(() => expect(resources.createAsset).toHaveBeenCalledTimes(1));
    const input = resources.createAsset.mock.calls[0]![0];
    expect(input).toMatchObject({
      tenant_id: 'tenant-1', asset_type: 'ai_system', name: 'Lokales Granite', ai_act_class: 'minimal',
      ai_system_type: 'local_ai', vendor: 'IBM', model_name: 'granite4.2:8b',
      deployment_model: 'local_device', data_residency: 'eu', owner_email: 'it@acme.de', intended_purpose: null,
    });
    expect(input).not.toHaveProperty('metadata');
    await waitFor(() => expect(screen.queryByTestId('ai-system-form')).toBeNull());
  });

  it('Serverablehnung bleibt im Formular sichtbar', async () => {
    resources.createAsset.mockResolvedValue({ ok: false, error: { code: 'FORBIDDEN', message: 'must be owner or admin' } });
    renderRegistry();
    await screen.findAllByTestId('ai-system-row');
    fireEvent.click(screen.getByTestId('ai-system-add'));
    const form = screen.getByTestId('ai-system-form');
    fireEvent.change(within(form).getByLabelText(/^Name/), { target: { value: 'X' } });
    fireEvent.change(within(form).getByLabelText(/^Systemtyp/), { target: { value: 'bot' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Anlegen' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('must be owner or admin');
  });
});

describe('/app/ai-systems/:id — Registerdaten', () => {
  it('zeigt die Felder, die Ampel mit Begründung und die Nachweise', async () => {
    renderDetail('a1');
    const panel = await screen.findByTestId('registry-panel');
    expect(within(panel).getByText('mistral-large')).toBeInTheDocument();
    expect(within(panel).getByText('EU/EWR')).toBeInTheDocument();
    expect(within(panel).getByText(/^1 · jüngster:/)).toBeInTheDocument();
    expect(within(panel).getByTestId('registry-light')).toHaveAttribute('data-light', 'green');
  });

  it('Altbestand ohne Angaben: unzureichende Daten mit den fehlenden Feldern', async () => {
    renderDetail('a2');
    const panel = await screen.findByTestId('registry-panel');
    const light = within(panel).getByTestId('registry-light');
    expect(light).toHaveAttribute('data-light', 'insufficient_data');
    expect(light).toHaveTextContent('Systemtyp fehlt');
    expect(light).toHaveTextContent('AI-Act-Klasse nicht bestimmt');
  });

  it('owner bearbeitet: nur Register-Felder, keine Klasse, kein Mandant', async () => {
    renderDetail('a1');
    const panel = await screen.findByTestId('registry-panel');
    fireEvent.click(within(panel).getByTestId('registry-edit'));
    const form = screen.getByTestId('ai-system-form');
    fireEvent.change(within(form).getByLabelText(/^Datenstandort/), { target: { value: 'third_country' } });
    fireEvent.change(within(form).getByLabelText(/^Status/), { target: { value: 'under_review' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(resources.updateAsset).toHaveBeenCalledTimes(1));
    const input = resources.updateAsset.mock.calls[0]![0];
    expect(input).toMatchObject({ asset_id: 'a1', data_residency: 'third_country', status: 'under_review', model_name: 'mistral-large' });
    for (const k of ['ai_act_class', 'tenant_id', 'asset_type', 'risk_score']) expect(input).not.toHaveProperty(k);
  });

  it('viewer_auditor: Bearbeiten gesperrt', async () => {
    tenant.role = 'viewer_auditor';
    renderDetail('a1');
    const panel = await screen.findByTestId('registry-panel');
    expect(within(panel).getByTestId('registry-edit')).toBeDisabled();
  });
});
