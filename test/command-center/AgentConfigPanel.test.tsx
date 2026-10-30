import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { AgentConfigPanel } from '../../src/features/command-center/AgentConfigPanel';

const rpcMock = vi.fn(async (..._a: unknown[]) => ({ data: {}, error: null as null | { message: string } }));
const insertMock = vi.fn(async (_row: unknown) => ({ error: null as null | { message: string } }));
let rows: unknown[] = [];

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    from: () => {
      const c: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'order']) c[m] = () => c;
      c.limit = () => Promise.resolve({ data: rows, error: null });
      c.insert = (row: unknown) => insertMock(row);
      return c;
    },
    rpc: (...a: unknown[]) => rpcMock(...a),
  }),
}));
vi.mock('../../src/core/access/TenantProvider', () => ({ useTenant: () => ({ activeTenantId: 't1', tenants: [] }) }));

const row = (v: number, status: string, config: Record<string, unknown>) => ({
  id: `v${v}`, agent_ref: 'grok:github-bot', section: 'details', version: v, config, status,
  change_note: v === 2 ? 'Rolle geschärft' : null, created_at: '2026-10-30T08:00:00Z', activated_at: null,
});

beforeEach(() => { rows = []; rpcMock.mockClear(); insertMock.mockClear(); });

const renderPanel = () => render(<AgentConfigPanel agentRef="grok:github-bot" agentName="GitHub Bot" onClose={() => {}} />);

describe('AgentConfigPanel', () => {
  it('ohne Soll: UNBEKANNT statt erfundener Werte; drei Bereiche', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText(/keine \(Soll nicht hinterlegt\)/)).toBeTruthy());
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Details', 'Bibliothek', 'Computer']);
    expect(screen.getAllByText('UNBEKANNT').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: 'Computer' }));
    expect(screen.getByText(/Ist-Status Terminal\/Browser: UNBEKANNT/)).toBeTruthy();
  });

  it('zeigt aktive Version und Entwurf mit Diff; Aktivierung erst nach Bestätigung', async () => {
    rows = [row(2, 'draft', { role: 'Lead' }), row(1, 'active', { role: 'Reviewer' })];
    renderPanel();
    await waitFor(() => expect(screen.getByText('Aktive Version: v1')).toBeTruthy());
    expect(screen.getByText('Reviewer')).toBeTruthy();
    expect(screen.getByText(/Geänderte Felder: Rolle/)).toBeTruthy();
    const btn = screen.getByRole('button', { name: 'Entwurf v2 aktivieren' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /aktiviere Entwurf v2/ }));
    fireEvent.click(btn);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('activate_agent_config_version', { p_id: 'v2', p_confirm: true }));
  });

  it('Entwurf: Validierung blockiert Secrets, gültiger Entwurf wird als draft-Insert gesendet', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByRole('tabpanel')).toBeTruthy());
    const ta = screen.getByLabelText('Entwurf JSON');
    fireEvent.change(ta, { target: { value: '{"system_prompt":"ghp_abcdef"}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Als Entwurf speichern' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Secret/));
    expect(insertMock).not.toHaveBeenCalled();
    fireEvent.change(ta, { target: { value: '{"role":"Reviewer","capabilities":["pr-review"]}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Als Entwurf speichern' }));
    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(insertMock.mock.calls[0]![0]).toEqual({
      tenant_id: 't1', agent_ref: 'grok:github-bot', section: 'details',
      config: { role: 'Reviewer', capabilities: ['pr-review'] }, change_note: null,
    });
  });

  it('axe: keine Verstöße', async () => {
    rows = [row(1, 'active', { role: 'Reviewer' })];
    const { container } = renderPanel();
    await waitFor(() => expect(screen.getByText('Aktive Version: v1')).toBeTruthy());
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });
});
