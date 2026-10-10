/**
 * Risikoinventar: Permission State. Seit 20261005120000 schreibt nur noch die
 * Edge Function, und die lässt create/update/delete nur für owner, admin, dpo
 * und editor zu. Die Oberfläche bietet Lesenden keine Schaltflächen an, die
 * der Server ohnehin ablehnt.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const tenant = vi.hoisted(() => ({ role: 'viewer_auditor' }));
const api = vi.hoisted(() => ({
  listRiskInventory: vi.fn(),
  createRiskInventory: vi.fn(),
  updateRiskInventory: vi.fn(),
  deleteRiskInventory: vi.fn(),
}));

vi.mock('../../../src/features/governance/aiActRiskInventoryApi', async (orig) => ({
  ...(await orig<typeof import('../../../src/features/governance/aiActRiskInventoryApi')>()),
  ...api,
}));
vi.mock('../../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: 't1',
    tenants: [{ tenantId: 't1', name: 'Acme GmbH', role: tenant.role }],
    setActiveTenant: () => undefined,
    loading: false,
  }),
}));
vi.mock('../../../src/features/kodee/connections/AuthGate', () => ({
  AuthGate: ({ children }: { children: (session: unknown) => ReactNode }) => <>{children({})}</>,
}));

import { AiActRiskInventoryView } from '../../../src/features/governance/AiActRiskInventoryView';

const ITEM = {
  id: 'i1', tenant_id: 't1', name: 'HR-Screening', description: null, severity: 'high',
  matched_use_cases: [], prohibited_triggers: [], limited_triggers: [], has_prohibited_overlay: false,
  confidence_score: null, registry_version: null, notes: null, classified_by: null,
  created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z',
};

async function renderAs(role: string) {
  tenant.role = role;
  api.listRiskInventory.mockResolvedValue({ ok: true, items: [ITEM] });
  render(<MemoryRouter><AiActRiskInventoryView /></MemoryRouter>);
  await screen.findByText('HR-Screening');
}

describe('Risikoinventar — Schreibrechte nach Rolle', () => {
  it('viewer_auditor: liest, aber Anlegen ist gesperrt und Bearbeiten/Löschen fehlen', async () => {
    await renderAs('viewer_auditor');
    const neu = screen.getByRole('button', { name: /Neuer Eintrag/ });
    expect(neu).toBeDisabled();
    expect(neu).toHaveAttribute('title', 'Ihre Rolle darf das Inventar nur lesen.');
    expect(screen.queryByTitle('Bearbeiten')).toBeNull();
    expect(screen.queryByTitle('Löschen')).toBeNull();
  });

  it.each(['owner', 'admin', 'dpo', 'editor'])('%s: darf anlegen, bearbeiten und löschen', async (role) => {
    await renderAs(role);
    expect(screen.getByRole('button', { name: /Neuer Eintrag/ })).toBeEnabled();
    expect(screen.getByTitle('Bearbeiten')).toBeInTheDocument();
    expect(screen.getByTitle('Löschen')).toBeInTheDocument();
  });
});
