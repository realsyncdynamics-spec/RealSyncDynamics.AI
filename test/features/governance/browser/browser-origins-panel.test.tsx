/**
 * Domain-Freigaben der Browser-Runtime (Folge-PR zu PR B).
 *
 * - Lesesicht rechnet wie browser-execute (Produktion, aktiv, enforce, Sperre schlägt Freigabe).
 * - Hinzufügen/Entfernen schickt die vollständige verwaltete Liste an set_browser_origins.
 * - Ungültige Eingaben werden vor dem Senden abgelehnt.
 * - Ohne owner/admin keine Bedienelemente; Lesefehler wird ehrlich angezeigt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { summarizeOriginPolicies, originSaveErrorMessage } from '@/src/features/governance/browser/originAllowlist';

const MB = 'browser_origins_ui';
const api = vi.hoisted(() => ({ fetchTenantPolicies: vi.fn(), setBrowserOrigins: vi.fn() }));

vi.mock('@/src/features/governance/governanceApi', () => ({ fetchTenantPolicies: api.fetchTenantPolicies }));
vi.mock('@/src/features/governance/resourcesApi', () => ({ setBrowserOrigins: api.setBrowserOrigins }));

import { BrowserOriginsPanel } from '@/src/features/governance/browser/BrowserOriginsPanel';

const row = (id: string, action: string, origins: string[], extra: Record<string, unknown> = {}) => ({
  id, tenant_id: 't1', policy_type: 'data_transfer', action, enabled: true, mode: 'enforce', environment: 'production',
  created_at: `2026-11-0${id.length}T00:00:00Z`, condition: { scope: 'browser_origin', origins, ...extra },
});

describe('summarizeOriginPolicies', () => {
  it('trennt verwaltete und andere Regeln und rechnet wie der Server', () => {
    const v = summarizeOriginPolicies([
      row('m', 'allow', ['https://a.de', 'https://b.de'], { managed_by: MB }),
      row('mb', 'block', ['https://b.de'], { managed_by: MB }),
      row('pack', 'allow', ['https://pack.de']),
      row('obs', 'allow', ['https://obs.de'], { managed_by: 'x' }),
      { ...row('stg', 'allow', ['https://stg.de']), environment: 'staging' },
      { ...row('off', 'allow', ['https://off.de']), enabled: false },
      { ...row('observe', 'allow', ['https://observe.de']), mode: 'observe' },
      { ...row('other', 'allow', ['https://x.de']), policy_type: 'gdpr' },
      { ...row('noscope', 'allow', []), condition: { foo: 1 } },
    ]);
    expect(v.managedAllow).toEqual(['https://a.de', 'https://b.de']);
    expect(v.managedBlock).toEqual(['https://b.de']);
    expect(v.otherAllow).toEqual(['https://obs.de', 'https://pack.de']);
    expect(v.otherBlock).toEqual([]);
    expect(v.effective).toEqual(['https://a.de', 'https://obs.de', 'https://pack.de']);
  });

  it('leer → keine Freigabe', () => {
    expect(summarizeOriginPolicies([]).effective).toEqual([]);
  });

  it('Fehlertexte', () => {
    expect(originSaveErrorMessage({ code: 'FORBIDDEN' })).toContain('Owner oder Admin');
    expect(originSaveErrorMessage({ code: 'INVALID_ORIGINS', details: [{ input: 'http://x.de', reason: 'nur https ist erlaubt' }] }))
      .toContain('http://x.de');
  });
});

describe('BrowserOriginsPanel', () => {
  beforeEach(() => {
    api.fetchTenantPolicies.mockReset();
    api.setBrowserOrigins.mockReset();
  });

  it('zeigt „gesperrt“, wenn nichts freigegeben ist', async () => {
    api.fetchTenantPolicies.mockResolvedValue([]);
    render(<BrowserOriginsPanel tenantId="t1" canEdit />);
    expect(await screen.findByTestId('browser-origins-status')).toHaveTextContent('KEINE FREIGABE');
  });

  it('Hinzufügen schickt die vollständige, normalisierte Liste', async () => {
    api.fetchTenantPolicies.mockResolvedValueOnce([row('m', 'allow', ['https://a.de'], { managed_by: MB })]);
    api.fetchTenantPolicies.mockResolvedValueOnce([row('m', 'allow', ['https://a.de', 'https://neu.de'], { managed_by: MB })]);
    api.setBrowserOrigins.mockResolvedValue({ ok: true });
    render(<BrowserOriginsPanel tenantId="t1" canEdit />);
    const allow = await screen.findByTestId('browser-origins-allow');
    fireEvent.change(within(allow).getByLabelText('Domain freigeben'), { target: { value: 'Neu.de' } });
    fireEvent.click(within(allow).getByRole('button', { name: 'Freigeben' }));
    await waitFor(() => expect(api.setBrowserOrigins).toHaveBeenCalledWith('t1', 'allow', ['https://a.de', 'https://neu.de']));
    expect(await screen.findByTestId('browser-origins-message')).toHaveTextContent('https://neu.de freigegeben');
    expect(await screen.findByText('https://neu.de')).toBeInTheDocument();
  });

  it('ungültige Eingabe wird nicht gesendet', async () => {
    api.fetchTenantPolicies.mockResolvedValue([]);
    render(<BrowserOriginsPanel tenantId="t1" canEdit />);
    const allow = await screen.findByTestId('browser-origins-allow');
    fireEvent.change(within(allow).getByLabelText('Domain freigeben'), { target: { value: 'http://unsicher.de' } });
    fireEvent.click(within(allow).getByRole('button', { name: 'Freigeben' }));
    expect(await screen.findByTestId('browser-origins-message')).toHaveTextContent('nur https');
    expect(api.setBrowserOrigins).not.toHaveBeenCalled();
  });

  it('Entfernen schickt die Liste ohne die Domain', async () => {
    api.fetchTenantPolicies.mockResolvedValue([row('m', 'allow', ['https://a.de', 'https://b.de'], { managed_by: MB })]);
    api.setBrowserOrigins.mockResolvedValue({ ok: true });
    render(<BrowserOriginsPanel tenantId="t1" canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Freigabe für https://a.de entfernen' }));
    await waitFor(() => expect(api.setBrowserOrigins).toHaveBeenCalledWith('t1', 'allow', ['https://b.de']));
  });

  it('Serverfehler wird angezeigt, Liste bleibt', async () => {
    api.fetchTenantPolicies.mockResolvedValue([]);
    api.setBrowserOrigins.mockResolvedValue({ ok: false, error: { code: 'FORBIDDEN', message: 'must be owner or admin' } });
    render(<BrowserOriginsPanel tenantId="t1" canEdit />);
    const block = await screen.findByTestId('browser-origins-block');
    fireEvent.change(within(block).getByLabelText('Domain sperren'), { target: { value: 'boese.de' } });
    fireEvent.click(within(block).getByRole('button', { name: 'Sperren' }));
    expect(await screen.findByTestId('browser-origins-message')).toHaveTextContent('Nur Owner oder Admin');
    expect(api.setBrowserOrigins).toHaveBeenCalledWith('t1', 'block', ['https://boese.de']);
  });

  it('ohne Schreibrecht: keine Eingabe, kein Entfernen, Hinweis', async () => {
    api.fetchTenantPolicies.mockResolvedValue([row('m', 'allow', ['https://a.de'], { managed_by: MB })]);
    render(<BrowserOriginsPanel tenantId="t1" canEdit={false} currentOrigin="https://neu.de" />);
    expect(await screen.findByText('https://a.de')).toBeInTheDocument();
    expect(screen.queryByLabelText('Domain freigeben')).toBeNull();
    expect(screen.queryByRole('button', { name: /entfernen/ })).toBeNull();
    expect(screen.queryByTestId('browser-origins-suggest')).toBeNull();
    expect(screen.getByText('Nur Owner oder Admin können Freigaben ändern.')).toBeInTheDocument();
  });

  it('schlägt die aktuelle Seite vor und gibt sie frei', async () => {
    api.fetchTenantPolicies.mockResolvedValue([]);
    api.setBrowserOrigins.mockResolvedValue({ ok: true });
    render(<BrowserOriginsPanel tenantId="t1" canEdit currentOrigin="https://kunde.de" />);
    fireEvent.click(await screen.findByTestId('browser-origins-suggest'));
    await waitFor(() => expect(api.setBrowserOrigins).toHaveBeenCalledWith('t1', 'allow', ['https://kunde.de']));
  });

  it('Lesefehler: ehrlicher Hinweis, keine Bedienung', async () => {
    api.fetchTenantPolicies.mockRejectedValue(new Error('rls'));
    render(<BrowserOriginsPanel tenantId="t1" canEdit />);
    expect(await screen.findByRole('alert')).toHaveTextContent('konnten nicht geladen werden');
    expect(screen.queryByLabelText('Domain freigeben')).toBeNull();
  });

  it('ohne Mandant: nichts', () => {
    const { container } = render(<BrowserOriginsPanel tenantId={null} canEdit />);
    expect(container).toBeEmptyDOMElement();
    expect(api.fetchTenantPolicies).not.toHaveBeenCalled();
  });
});
