import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { tenant } = vi.hoisted(() => ({
  tenant: {
    activeTenantId: 'tenant-a' as string | null,
    loading: false,
    error: null as string | null,
    tenants: [{ tenantId: 'tenant-a', name: 'Beispielbetrieb', role: 'owner' }],
  },
}));

vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => tenant,
}));

import { VoiceSetupView } from '@/src/features/governance/voice/VoiceSetupView';
import { VOICE_PREVIEW_ONBOARDING_URL } from '@/src/config/voice-onboarding';

function show() {
  render(<MemoryRouter><VoiceSetupView /></MemoryRouter>);
}

describe('VoiceSetupView – sicherer Account-zu-Vorschau-Handoff', () => {
  beforeEach(() => {
    tenant.activeTenantId = 'tenant-a';
    tenant.loading = false;
    tenant.error = null;
    tenant.tenants = [{ tenantId: 'tenant-a', name: 'Beispielbetrieb', role: 'owner' }];
  });

  it('zeigt den aktiven RealSync-Mandanten und die ausdrücklich getrennte Vorschau', () => {
    show();
    expect(screen.getByTestId('voice-setup-tenant')).toHaveTextContent('Beispielbetrieb');
    expect(screen.getByText(/kein single sign-on, kein automatisches speichern/i)).toBeInTheDocument();
    expect(screen.getByText(/keine ungeprüfte Übernahme in Supabase oder D1/i)).toBeInTheDocument();
  });

  it('öffnet nur den festen externen Onboarding-Host ohne Token oder Tenant-ID', () => {
    show();
    const link = screen.getByTestId('voice-setup-open-preview');
    expect(link).toHaveAttribute('href', VOICE_PREVIEW_ONBOARDING_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.getAttribute('href')).not.toContain('tenant-a');
    expect(link.getAttribute('href')).not.toContain('token');
  });

  it('zeigt keinen externen Handoff ohne aktive Mitgliedschaft', () => {
    tenant.activeTenantId = null;
    show();
    expect(screen.getByTestId('voice-setup-no-tenant')).toBeInTheDocument();
    expect(screen.queryByTestId('voice-setup-open-preview')).not.toBeInTheDocument();
  });

  it('verweigert den Handoff bei nicht zur Mitgliedschaft passenden Tenant-IDs', () => {
    tenant.activeTenantId = 'fremder-tenant';
    show();
    expect(screen.getByTestId('voice-setup-no-tenant')).toBeInTheDocument();
    expect(screen.queryByTestId('voice-setup-open-preview')).not.toBeInTheDocument();
  });

  it('zeigt Ladezustand ohne den Konfigurator', () => {
    tenant.loading = true;
    show();
    expect(screen.getByTestId('voice-setup-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('voice-setup-open-preview')).not.toBeInTheDocument();
  });

  it('verweigert Handoff bei Tenant-Fehler', () => {
    tenant.error = 'load failed';
    show();
    expect(screen.getByTestId('voice-setup-error')).toBeInTheDocument();
    expect(screen.queryByTestId('voice-setup-open-preview')).not.toBeInTheDocument();
  });
});
