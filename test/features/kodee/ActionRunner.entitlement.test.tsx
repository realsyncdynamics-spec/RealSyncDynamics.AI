import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const tenant = { activeTenantId: 'tenant-1' as string | null, features: new Set<string>() };

vi.mock('../../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: tenant.activeTenantId,
    hasFeature: (key: string) => tenant.features.has(key),
  }),
}));
vi.mock('../../../src/features/kodee/api', () => ({
  runAction: vi.fn(async () => ({ ok: true, action: 'vps.status', data: {}, duration_ms: 1 })),
}));
vi.mock('../../../src/features/kodee/advise', () => ({ adviseAction: vi.fn() }));

import { ActionRunner } from '../../../src/features/kodee/ActionRunner';
import { runAction } from '../../../src/features/kodee/api';

function renderRunner() {
  render(
    <MemoryRouter>
      <ActionRunner connectionId="conn-1" onResult={() => {}} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  tenant.activeTenantId = 'tenant-1';
  tenant.features = new Set();
  vi.mocked(runAction).mockClear();
});

describe('ActionRunner — SSH-Aktionen ab Agency', () => {
  it('zeigt ohne ai.tool.vps_status nur den Tarifhinweis', () => {
    renderRunner();
    expect(screen.getByTestId('kodee-actions-locked').textContent).toMatch(/ab Agency/);
    expect(screen.queryByText('Status')).toBeNull();
  });

  it('sendet mit Entitlement den aktiven Mandanten an runAction', async () => {
    tenant.features = new Set(['ai.tool.vps_status']);
    renderRunner();
    expect(screen.queryByTestId('kodee-actions-locked')).toBeNull();
    fireEvent.click(screen.getByText('Status'));
    await waitFor(() => expect(runAction).toHaveBeenCalled());
    expect(vi.mocked(runAction).mock.calls[0].slice(0, 3)).toEqual(['tenant-1', 'conn-1', 'vps.status']);
  });
});
