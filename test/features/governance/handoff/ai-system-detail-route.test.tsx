/**
 * /app/ai-systems/:id — Klassifizierung (Handoff v2 §8).
 *
 * Prüft Route (lazy, AppGate + Shell), echte Daten statt Beispielsystemen,
 * Klasse aus shared/enforcement-classes und dass eine Stufenwahl ohne
 * Backend-Pfad sichtbar als „Entwurf · nicht gespeichert" markiert ist.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => ({ activeTenantId: 'tenant-1', tenants: [], loading: false }),
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

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/ai-systems/:id" element={<AiSystemDetailView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('/app/ai-systems/:id — Route', () => {
  const app = readFileSync('src/App.tsx', 'utf8');

  it('ist lazy registriert und hängt hinter AppGate + GovernanceBrowserShell', () => {
    expect(app).toMatch(/const AiSystemDetailView = lazy\(\(\) => import\('\.\/features\/governance\/ai-registry\/AiSystemDetailView'\)/);
    const line = app.split('\n').find((l) => l.includes('path="/app/ai-systems/:id"'));
    expect(line, 'Route /app/ai-systems/:id fehlt').toBeDefined();
    expect(line).toContain('<AppGate>');
    expect(line).toContain('<GovernanceBrowserShell>');
    expect(line).toContain('<AiSystemDetailView />');
  });

  it('lässt die statische Agent-Registry-Route bestehen', () => {
    expect(app).toContain('path="/app/ai-systems/agents"');
  });
});

describe('AiSystemDetailView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetLangForTests();
  });

  it('zeigt das echte System mit abgeleiteter Klasse und Begründung', async () => {
    renderAt('/app/ai-systems/a1');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Support-Chatbot' })).toBeInTheDocument());
    // microsoft365 ⇒ Klasse C laut shared/enforcement-classes
    expect(screen.getByTestId('classify-overline')).toHaveTextContent('Microsoft 365 · Klasse C');
    expect(screen.getByTestId('classify-reason')).toHaveTextContent(/Microsoft Graph/);
    // Nur KI-Systeme in der Liste — keine Website, keine Beispielsysteme
    expect(screen.queryByText('Website')).not.toBeInTheDocument();
    expect(screen.queryByText(/CV-Screening/)).not.toBeInTheDocument();
    // Gespeicherte Stufe „Begrenzt" ist aktiv, kein Entwurf
    expect(screen.getByRole('button', { name: /Begrenzt/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('draft-unsaved')).not.toBeInTheDocument();
  });

  it('nimmt die Connector-Klasse aus dem DB-Trigger, nicht den Asset-Typ', async () => {
    renderAt('/app/ai-systems/a2');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Gateway' })).toBeInTheDocument());
    expect(screen.getByTestId('classify-overline')).toHaveTextContent('AI-Gateway · Klasse A');
  });

  it('markiert eine Stufenwahl als Entwurf, weil es keinen Speicherpfad gibt', async () => {
    renderAt('/app/ai-systems/a1');
    await waitFor(() => expect(screen.getByRole('button', { name: /Hochrisiko/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Hochrisiko/ }));
    expect(screen.getByRole('button', { name: /Hochrisiko/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('draft-unsaved')).toHaveTextContent('Entwurf · nicht gespeichert');
    // Pflichten folgen der gewählten Stufe
    expect(screen.getByTestId('obligations')).toHaveTextContent('Art. 9');
    expect(screen.getByTestId('obligations')).toHaveTextContent('Art. 49');
  });

  it('meldet ein unbekanntes System ehrlich', async () => {
    renderAt('/app/ai-systems/does-not-exist');
    await waitFor(() => expect(screen.getByTestId('ai-system-not-found')).toBeInTheDocument());
  });
});
