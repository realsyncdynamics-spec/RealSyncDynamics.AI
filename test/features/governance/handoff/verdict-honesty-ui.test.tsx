/**
 * Enforcement (Handoff v2 §9) — die Oberfläche verspricht kein Verdikt, das
 * die Durchsetzbarkeits-Klasse technisch nicht hergibt.
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

vi.mock('@/src/features/governance/governanceApi', () => ({
  fetchTenantPolicies: vi.fn(async () => [
    policy('p-a', 'Gateway-Policy', 'warn', { system_type: 'ai_gateway' }),
    policy('p-c', 'M365-Policy', 'warn', { system_type: 'microsoft365' }),
    policy('p-d', 'Browser-Policy', 'block', { system_type: 'browser_direct' }),
    policy('p-x', 'Ohne Systemtyp', 'log', {}),
  ]),
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

describe('EnforcementPanel — Verdikt-Ehrlichkeit', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetLangForTests();
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

  it('lehnt block für Klasse C ab: Toast, keine Änderung, kein Entwurf', async () => {
    await renderPanel();
    const row = rowOf('M365-Policy');
    fireEvent.click(verdictButton(row, 'block'));
    expect(screen.getByRole('alert')).toHaveTextContent('„block" ist für Klasse C nicht einlösbar');
    expect(verdictButton(row, 'block')).toHaveAttribute('aria-pressed', 'false');
    expect(verdictButton(row, 'warn')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('draft-unsaved')).not.toBeInTheDocument();
  });

  it('übernimmt ein einlösbares Verdikt nur lokal und sagt das', async () => {
    await renderPanel();
    const row = rowOf('Gateway-Policy');
    fireEvent.click(verdictButton(row, 'block'));
    expect(verdictButton(row, 'block')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('draft-unsaved')).toHaveTextContent('Entwurf · nicht gespeichert');
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
});
