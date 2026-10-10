/**
 * Permission State zu RLS 20261005150000 (websites, security_signals):
 *
 * - Security-Signal-Status setzen nur owner/admin/dpo/editor. Ein von RLS
 *   gefiltertes Update (0 Zeilen) ist ein Fehler — vorher verschluckte die
 *   Ansicht jeden Fehler und zeigte den neuen Status trotzdem an.
 * - Die Knöpfe heißen nach dem, was sie tun (Status setzen, JSON laden),
 *   nicht „Create Risk Review“ / „Create Evidence Snapshot“.
 * - Websites anlegen nur mit schreibender Rolle.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const tenant = vi.hoisted(() => ({ role: 'viewer_auditor' as string }));
const db = vi.hoisted(() => ({ updateRows: [] as Array<{ id: string }>, updateError: null as null | { code?: string; message: string } }));

vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: 't1',
    tenants: [{ tenantId: 't1', name: 'Acme', role: tenant.role }],
    loading: false,
  }),
}));
vi.mock('@/src/features/kodee/connections/AuthGate', () => ({
  AuthGate: ({ children }: { children: (s: unknown) => ReactNode }) => <>{children({})}</>,
}));
vi.mock('@/src/features/workspace/WorkspaceShell', () => ({
  WorkspaceShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const SIGNAL = {
  id: 's1', tenant_id: 't1', source_id: null, provider: 'wazuh', external_id: 'x-1', event_type: 'auth',
  severity: 'high', title: 'Login-Anomalie', description: null, asset_ref: null, raw_payload: {},
  normalized_payload: {}, status: 'open', first_seen_at: null, last_seen_at: null,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
};

vi.mock('@/src/lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const done = (data: unknown) => Promise.resolve({ data, error: null });
      chain.select = () => chain;
      chain.eq = () => chain;
      // security_signals: .order().limit() · governance_risk_links: .order() wird abgewartet
      chain.order = () => (table === 'security_signals' ? chain : done([]));
      chain.limit = () => done([SIGNAL]);
      chain.update = () => ({
        eq: () => ({ select: () => Promise.resolve({ data: db.updateError ? null : db.updateRows, error: db.updateError }) }),
      });
      return chain;
    },
  }),
}));

import { SecuritySignalsView } from '@/src/features/governance/security-signals/SecuritySignalsView';
import { updateSignalStatus, SIGNAL_STATUS_FORBIDDEN } from '@/src/features/governance/security-signals/securitySignalsApi';

beforeEach(() => {
  tenant.role = 'viewer_auditor';
  db.updateRows = [];
  db.updateError = null;
});

describe('updateSignalStatus', () => {
  it('0 betroffene Zeilen (RLS) sind ein Fehler, kein stiller Erfolg', async () => {
    db.updateRows = [];
    await expect(updateSignalStatus('s1', 'accepted')).rejects.toThrow(SIGNAL_STATUS_FORBIDDEN);
  });

  it('Rechtefehler (42501) wird lesbar', async () => {
    db.updateError = { code: '42501', message: 'permission denied for table security_signals' };
    await expect(updateSignalStatus('s1', 'accepted')).rejects.toThrow(SIGNAL_STATUS_FORBIDDEN);
  });

  it('eine gespeicherte Zeile ist Erfolg', async () => {
    db.updateRows = [{ id: 's1' }];
    await expect(updateSignalStatus('s1', 'accepted')).resolves.toBeUndefined();
  });
});

async function openDrawer() {
  render(<MemoryRouter><SecuritySignalsView /></MemoryRouter>);
  fireEvent.click(await screen.findByText('Login-Anomalie'));
}

describe('Security-Signal-Drawer', () => {
  it('viewer_auditor: Status-Knöpfe gesperrt mit Begründung; JSON-Download bleibt', async () => {
    await openDrawer();
    expect(screen.getByRole('button', { name: /Status: In Prüfung/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Status: Akzeptiert/ })).toBeDisabled();
    expect(screen.getByTestId('signal-status-readonly')).toHaveTextContent(SIGNAL_STATUS_FORBIDDEN);
    expect(screen.getByRole('button', { name: /Rohdaten herunterladen \(JSON\)/ })).toBeEnabled();
    expect(screen.queryByText(/Create Risk Review|Create Evidence Snapshot/)).toBeNull();
  });

  it('editor: abgelehntes Speichern zeigt den Fehler und keinen neuen Status', async () => {
    tenant.role = 'editor';
    db.updateRows = [];
    await openDrawer();
    fireEvent.click(screen.getByRole('button', { name: /Status: Akzeptiert/ }));
    expect(await screen.findByTestId('signal-status-error')).toHaveTextContent(SIGNAL_STATUS_FORBIDDEN);
  });

  it('editor: gespeicherter Status ohne Fehler', async () => {
    tenant.role = 'editor';
    db.updateRows = [{ id: 's1' }];
    await openDrawer();
    fireEvent.click(screen.getByRole('button', { name: /Status: In Prüfung/ }));
    await waitFor(() => expect(screen.queryByTestId('signal-status-error')).toBeNull());
  });
});
