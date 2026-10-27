/**
 * Enforcement (Handoff v2 §9) — die Oberfläche verspricht kein Verdikt, das
 * die Durchsetzbarkeits-Klasse technisch nicht hergibt, und speichert
 * einlösbare Verdikte persistent über `update_policy`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ENFORCEMENT_CLASSES } from '@/shared/enforcement-classes';

vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => ({ activeTenantId: 'tenant-1', tenants: [], loading: false }),
}));

function policy(id: string, name: string, action: string, condition: Record<string, unknown>) {
  return {
    id,
    tenant_id: 'tenant-1',
    name,
    description: null,
    policy_type: 'ai_act',
    severity: 'high',
    action,
    condition,
    enabled: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };
}

const mocks = vi.hoisted(() => ({
  fetchTenantPolicies: vi.fn(),
  updatePolicy: vi.fn(),
  createPolicy: vi.fn(),
  listActivations: vi.fn(),
  setPackActive: vi.fn(),
}));

vi.mock('@/src/features/governance/governanceApi', () => ({
  fetchTenantPolicies: mocks.fetchTenantPolicies,
}));

vi.mock('@/src/features/governance/resourcesApi', () => ({
  updatePolicy: mocks.updatePolicy,
  createPolicy: mocks.createPolicy,
}));

vi.mock('@/src/features/policy-packs/policyPacksApi', () => ({
  listActivations: mocks.listActivations,
  setPackActive: mocks.setPackActive,
}));

import { EnforcementPanel } from '@/src/features/governance/handoff/EnforcementPanel';
import { resetLangForTests } from '@/src/i18n/useLang';

function rowOf(name: string): HTMLElement {
  const row = screen.getAllByTestId('policy-row').find((r) => r.textContent?.includes(name));
  if (!row) throw new Error(`Zeile ${name} fehlt`);
  return row;
}

function verdictButton(row: HTMLElement, verdict: string): HTMLElement {
  return within(row).getByRole('button', { name: verdict });
}

describe('EnforcementPanel — Verdikt-Ehrlichkeit & persistentes Speichern', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetLangForTests();
    vi.clearAllMocks();
    mocks.fetchTenantPolicies.mockResolvedValue([
      policy('p-a', 'Gateway-Policy', 'warn', { system_type: 'ai_gateway' }),
      policy('p-c', 'M365-Policy', 'warn', { system_type: 'microsoft365' }),
      policy('p-d', 'Browser-Policy', 'block', { system_type: 'browser_direct' }),
      policy('p-x', 'Ohne Systemtyp', 'log', {}),
    ]);
    mocks.updatePolicy.mockResolvedValue({ ok: true });
    mocks.createPolicy.mockResolvedValue({ ok: true });
    mocks.listActivations.mockResolvedValue(new Set(['dsgvo-essentials']));
    mocks.setPackActive.mockResolvedValue({ kind: 'ok', data: { ok: true } });
  });

  async function renderPanel() {
    render(
      <MemoryRouter>
        <EnforcementPanel />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByTestId('policy-row')).toHaveLength(4));
  }

  it('markiert genau die Verdikte als nicht einlösbar, die die Klasse nicht hergibt', async () => {
    await renderPanel();
    for (const [name, klasse] of [
      ['Gateway-Policy', 'A'],
      ['M365-Policy', 'C'],
      ['Browser-Policy', 'D'],
      ['Ohne Systemtyp', 'C'],
    ] as const) {
      const row = rowOf(name);
      expect(row).toHaveAttribute('data-class', klasse);
      for (const v of ['allow', 'log_only', 'warn', 'block', 'require_approval', 'react'] as const) {
        const honest = (ENFORCEMENT_CLASSES[klasse].verdikte as readonly string[]).includes(v);
        const btn = verdictButton(row, v);
        expect(btn.getAttribute('aria-disabled'), `${name}/${v}`).toBe(String(!honest));
        expect(btn.className.includes('rs-verdict--dishonest'), `${name}/${v}`).toBe(!honest);
      }
    }
  });

  it('lehnt block für Klasse C ab: Toast, kein Speichern', async () => {
    await renderPanel();
    const row = rowOf('M365-Policy');
    fireEvent.click(verdictButton(row, 'block'));
    expect(screen.getByRole('alert')).toHaveTextContent('„block" ist für Klasse C nicht einlösbar');
    expect(verdictButton(row, 'block')).toHaveAttribute('aria-pressed', 'false');
    expect(verdictButton(row, 'warn')).toHaveAttribute('aria-pressed', 'true');
    expect(mocks.updatePolicy).not.toHaveBeenCalled();
  });

  it('speichert ein einlösbares Verdikt persistent über updatePolicy ohne Draft-Hinweis', async () => {
    await renderPanel();
    const row = rowOf('Gateway-Policy');
    fireEvent.click(verdictButton(row, 'block'));
    await waitFor(() =>
      expect(mocks.updatePolicy).toHaveBeenCalledWith({
        policy_id: 'p-a',
        action: 'block',
      }),
    );
    expect(verdictButton(row, 'block')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('draft-unsaved')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('zählt Policies je Klasse aus echten Zeilen und zeigt die Fußnote', async () => {
    await renderPanel();
    expect(screen.getByTestId('stat-policies')).toHaveTextContent('4');
    expect(screen.getByTestId('stat-blocking')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-observing')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-paper')).toHaveTextContent('1');
    expect(screen.getByTestId('enforce-foot')).toHaveTextContent('Die Klasse wird abgeleitet, nie eingegeben');
  });

  it('weist ein gespeichertes, nicht einlösbares Verdikt aus (D + block)', async () => {
    await renderPanel();
    expect(rowOf('Browser-Policy')).toHaveTextContent('Gespeichertes Verdikt „block" ist für Klasse D nicht einlösbar');
  });

  it('bietet bei leerem Zustand den Synchronisieren-Button zum Anlegen der Pack-Policies an', async () => {
    mocks.fetchTenantPolicies.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <EnforcementPanel />
      </MemoryRouter>,
    );
    const syncBtn = await screen.findByTestId('sync-pack-policies-btn');
    expect(syncBtn).toHaveTextContent('Pack-Policies synchronisieren');
    fireEvent.click(syncBtn);
    await waitFor(() =>
      expect(mocks.setPackActive).toHaveBeenCalledWith({
        tenant_id: 'tenant-1',
        pack_id: 'dsgvo-essentials',
        active: true,
      }),
    );
  });
});
