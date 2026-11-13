/**
 * /app/datasets darf einem Mandanten keine Demo-Datensätze als seine eigenen zeigen.
 *
 * Vorher: leere Mandantenliste oder Ladefehler → still `DEMO_DATASETS`
 * („Bewerbungs-Trainingskorpus 2024“, „2 dokumentiert“) ohne Hinweis.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const tenantState: { activeTenantId: string | null } = { activeTenantId: 'tenant-a' };
const listDatasets = vi.fn();

vi.mock('../../../src/core/access/TenantProvider', () => ({
  useTenant: () => tenantState,
}));
vi.mock('../../../src/features/kodee/connections/AuthGate', () => ({
  AuthGate: ({ children }: { children: () => React.ReactNode }) => <>{children()}</>,
}));
vi.mock('../../../src/features/governance/withPerformanceMonitoring', () => ({
  withPerformanceMonitoring: (c: unknown) => c,
}));
vi.mock('../../../src/features/governance/aiActDataGovernanceApi', async (orig) => ({
  ...(await orig<typeof import('../../../src/features/governance/aiActDataGovernanceApi')>()),
  listDatasets: (...args: unknown[]) => listDatasets(...args),
  createDataset: vi.fn(),
}));

import { AiActDataGovernanceView } from '../../../src/features/governance/data-governance/AiActDataGovernanceView';

const DEMO_NAME = 'Bewerbungs-Trainingskorpus 2024';

function renderView() {
  return render(
    <MemoryRouter>
      <AiActDataGovernanceView />
    </MemoryRouter>,
  );
}

describe('AiActDataGovernanceView — Herkunft der Datensätze', () => {
  beforeEach(() => {
    listDatasets.mockReset();
    tenantState.activeTenantId = 'tenant-a';
  });

  it('leere Mandantenliste zeigt den Leerzustand, keine Demo-Daten', async () => {
    listDatasets.mockResolvedValue([]);
    renderView();
    expect(await screen.findByText('Noch keine Datensätze dokumentiert.')).toBeInTheDocument();
    expect(screen.queryByText(DEMO_NAME)).not.toBeInTheDocument();
    expect(screen.queryByTestId('preview-data-notice')).not.toBeInTheDocument();
    expect(listDatasets).toHaveBeenCalledWith('tenant-a');
  });

  it('Ladefehler zeigt einen sichtbaren Fehler, keine Ersatzdaten und keine Zahlen', async () => {
    listDatasets.mockRejectedValue(new Error('network'));
    renderView();
    expect(await screen.findByTestId('datasets-load-error')).toBeInTheDocument();
    expect(screen.queryByText(DEMO_NAME)).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBe(3);
  });

  it('ohne Mandant: Beispieldaten nur mit Vorschau-Hinweis', async () => {
    tenantState.activeTenantId = null;
    renderView();
    expect(await screen.findByText(DEMO_NAME)).toBeInTheDocument();
    expect(screen.getByTestId('preview-data-notice')).toBeInTheDocument();
    expect(listDatasets).not.toHaveBeenCalled();
  });

  it('Mandantendaten werden ohne Vorschau-Hinweis angezeigt', async () => {
    listDatasets.mockResolvedValue([]);
    renderView();
    await waitFor(() => expect(screen.queryByText('Datensätze werden geladen …')).not.toBeInTheDocument());
    expect(screen.queryByTestId('preview-data-notice')).not.toBeInTheDocument();
  });
});
