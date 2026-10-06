/**
 * VoiceSessionsView — honest empty / error / no-tenant UI.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { VoiceSessionRow } from '@/src/features/governance/voice/voiceApi';

const { tenantState, listMock } = vi.hoisted(() => ({
  tenantState: {
    activeTenantId: 'tenant-a' as string | null,
    loading: false,
  },
  listMock: vi.fn<() => Promise<VoiceSessionRow[]>>(),
}));

vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: tenantState.activeTenantId,
    tenants: [],
    loading: tenantState.loading,
  }),
}));

vi.mock('@/src/features/governance/voice/voiceApi', async (orig) => {
  const actual = await orig<typeof import('@/src/features/governance/voice/voiceApi')>();
  return { ...actual, listVoiceSessions: listMock };
});

import { VoiceSessionsView } from '@/src/features/governance/voice/VoiceSessionsView';

function renderView() {
  return render(
    <MemoryRouter>
      <VoiceSessionsView />
    </MemoryRouter>,
  );
}

describe('VoiceSessionsView', () => {
  beforeEach(() => {
    tenantState.activeTenantId = 'tenant-a';
    tenantState.loading = false;
    listMock.mockReset();
  });

  it('zeigt Empty-State bei 0 Rows', async () => {
    listMock.mockResolvedValueOnce([]);
    renderView();
    await waitFor(() => expect(screen.getByTestId('voice-sessions-empty')).toBeInTheDocument());
    expect(screen.getByText('Noch keine Voice-Sessions.')).toBeInTheDocument();
    expect(screen.getByText(/Voice-Runtime-Dienst ist noch nicht live/i)).toBeInTheDocument();
  });

  it('zeigt Fehler-State ohne Beispieldaten', async () => {
    listMock.mockRejectedValueOnce(new Error('Netzwerkfehler'));
    renderView();
    await waitFor(() => expect(screen.getByTestId('voice-sessions-error')).toBeInTheDocument());
    expect(screen.getByText(/konnten nicht geladen werden/i)).toBeInTheDocument();
    expect(screen.queryByTestId('voice-sessions-list')).toBeNull();
    expect(screen.queryByText('Noch keine Voice-Sessions.')).toBeNull();
  });

  it('fetcht nicht ohne Tenant und zeigt Hinweis', async () => {
    tenantState.activeTenantId = null;
    renderView();
    await waitFor(() => expect(screen.getByTestId('voice-no-tenant')).toBeInTheDocument());
    expect(listMock).not.toHaveBeenCalled();
  });
});
