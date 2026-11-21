/**
 * Komponenten-Integrationstest des echten WorkspaceGuide (React + Supabase-Adapter).
 * Die Browser-Sitzung und die Datenbank werden kontrolliert simuliert; dies ist
 * kein produktiver Login-Test und kein Ersatz für die PostgreSQL-RLS-Tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const runtime = vi.hoisted(() => ({
  tenantId: 'tenant-a',
  userId: 'member-a',
  role: 'owner' as 'owner' | 'viewer_auditor',
  records: {} as Record<string, { focus: string; completed_steps: string[] }>,
  saves: [] as Array<{ tenant_id: string; user_id: string; focus: string; completed_steps: string[] }>,
  failSave: false,
}));

const recordKey = (tenantId: string, userId: string) => tenantId + ':' + userId;

vi.mock('../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: runtime.tenantId,
    loading: false,
    tenants: [
      { tenantId: 'tenant-a', name: 'Alpha GmbH', role: runtime.role },
      { tenantId: 'tenant-b', name: 'Beta Agentur', role: 'viewer_auditor' },
    ],
  }),
}));

vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: runtime.userId } }, error: null }),
    },
    from: (table: string) => {
      if (table !== 'workspace_onboarding_state') throw new Error('Unerwartete Tabelle: ' + table);
      return {
        select: () => {
          const scoped: Record<string, string> = {};
          const query = {
            eq: (column: string, value: string) => {
              scoped[column] = value;
              return query;
            },
            maybeSingle: async () => ({
              data: runtime.records[recordKey(scoped.tenant_id, scoped.user_id)] ?? null,
              error: null,
            }),
          };
          return query;
        },
        upsert: async (row: {
          tenant_id: string;
          user_id: string;
          focus: string;
          completed_steps: string[];
        }) => {
          if (runtime.failSave) return { error: { message: 'Test: Speichern nicht möglich' } };
          const stored = { focus: row.focus, completed_steps: [...row.completed_steps] };
          runtime.saves.push({ ...row, completed_steps: [...row.completed_steps] });
          runtime.records[recordKey(row.tenant_id, row.user_id)] = stored;
          return { error: null };
        },
      };
    },
  }),
}));

import { WorkspaceGuide } from '../../src/features/onboarding/WorkspaceGuide';

function renderGuide() {
  return render(<MemoryRouter><WorkspaceGuide /></MemoryRouter>);
}

beforeEach(() => {
  runtime.tenantId = 'tenant-a';
  runtime.userId = 'member-a';
  runtime.role = 'owner';
  runtime.records = {};
  runtime.saves = [];
  runtime.failSave = false;
});

describe('WorkspaceGuide – Frontend-Zustand, Persistenz und Tenant-Wechsel', () => {
  it('lädt den Workspace und speichert die Produktauswahl für den aktiven Nutzer', async () => {
    renderGuide();
    expect(await screen.findByText('Alpha GmbH')).toBeInTheDocument();
    expect(screen.getByText('0 von 5 Schritten markiert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Voice-Agent/i }));
    await waitFor(() => expect(screen.getByText('1 von 5 Schritten markiert')).toBeInTheDocument());
    expect(runtime.records['tenant-a:member-a']).toEqual({
      focus: 'voice',
      completed_steps: ['focus'],
    });
    expect(screen.getByRole('link', { name: /Modul öffnen/i })).toHaveAttribute('href', '/app/voice');
  });

  it('lädt den gespeicherten Fortschritt nach erneutem Mounten', async () => {
    const first = renderGuide();
    await screen.findByText('Alpha GmbH');
    const entry = screen.getByText('Arbeitsbereich einrichten').closest('article');
    expect(entry).not.toBeNull();
    fireEvent.click(within(entry as HTMLElement).getByRole('button', { name: /Als erledigt markieren/i }));
    await waitFor(() => expect(screen.getByText('1 von 5 Schritten markiert')).toBeInTheDocument());

    first.unmount();
    renderGuide();
    expect(await screen.findByText('1 von 5 Schritten markiert')).toBeInTheDocument();
    expect(runtime.records['tenant-a:member-a']?.completed_steps).toContain('profile');
  });

  it('wechselt die Anzeige mandantensicher ohne fremde Fortschritte zu übernehmen', async () => {
    runtime.records['tenant-a:member-a'] = { focus: 'governance', completed_steps: ['profile', 'focus'] };
    const view = renderGuide();
    expect(await screen.findByText('2 von 5 Schritten markiert')).toBeInTheDocument();

    runtime.tenantId = 'tenant-b';
    view.rerender(<MemoryRouter><WorkspaceGuide /></MemoryRouter>);
    expect(await screen.findByText('Beta Agentur')).toBeInTheDocument();
    expect(await screen.findByText('0 von 4 Schritten markiert')).toBeInTheDocument();
    expect(screen.queryByText('2 von 5 Schritten markiert')).not.toBeInTheDocument();
    expect(screen.queryByText('Team einladen')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Governance & Audit/i }));
    await waitFor(() => expect(runtime.records['tenant-b:member-a']?.focus).toBe('governance'));
    expect(runtime.records['tenant-a:member-a']?.completed_steps).toEqual(['profile', 'focus']);
  });

  it('markiert bei fehlgeschlagenem Speichern keine Aufgabe als erledigt', async () => {
    runtime.failSave = true;
    renderGuide();
    await screen.findByText('Alpha GmbH');
    fireEvent.click(screen.getByRole('button', { name: /Voice-Agent/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Test: Speichern nicht möglich');
    expect(screen.getByText('0 von 5 Schritten markiert')).toBeInTheDocument();
    expect(runtime.saves).toHaveLength(0);
  });
});
