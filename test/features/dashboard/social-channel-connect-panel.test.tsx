/**
 * Social-Konten im Command Center: Metadaten, Platzhalter ohne OAuth,
 * Trennen nur über social-channel-connect. Keine Tokens im UI.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CockpitConnectorsStrip } from '../../../src/features/dashboard/widget-registry/CockpitConnectorsStrip';
import {
  SOCIAL_CHANNEL_META_COLUMNS,
  listSocialChannelConnections,
  toSocialChannelConnectionMeta,
} from '../../../src/features/dashboard/widget-registry/socialChannelConnectApi';
import {
  socialDisplayName,
  socialExpiryLabel,
  socialStatusLabel,
} from '../../../src/features/dashboard/widget-registry/socialChannelConnectModel';

const harness = vi.hoisted(() => {
  const state = {
    role: 'owner' as string,
    tenantId: 'tenant-1' as string | null,
    rows: [] as Array<Record<string, unknown>>,
    listError: null as { message: string } | null,
    hang: false,
    selects: [] as string[],
    invoke: vi.fn(async (_name: string, _options: { body: Record<string, unknown> }) => ({
      data: { ok: true },
      error: null as { message: string } | null,
    })),
  };
  return { state };
});

vi.mock('../../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: harness.state.tenantId,
    tenants: harness.state.tenantId
      ? [{ tenantId: harness.state.tenantId, role: harness.state.role, name: 'Acme' }]
      : [],
  }),
}));

vi.mock('../../../src/lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      if (table !== 'social_channel_connections') throw new Error(`unerwartete Tabelle ${table}`);
      const api = {
        select: (columns: string) => {
          harness.state.selects.push(columns);
          return api;
        },
        eq: () => api,
        order: () => {
          if (harness.state.hang) return new Promise(() => undefined);
          return Promise.resolve({
            data: harness.state.listError ? null : harness.state.rows,
            error: harness.state.listError,
          });
        },
      };
      return api;
    },
    functions: {
      invoke: (name: string, options: { body: Record<string, unknown> }) => harness.state.invoke(name, options),
    },
  }),
}));

import { SocialChannelConnectPanel } from '../../../src/features/dashboard/widget-registry/SocialChannelConnectPanel';

const LINKEDIN_ID = '11111111-1111-1111-1111-111111111111';

function linkedinRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LINKEDIN_ID,
    channel: 'linkedin',
    account_name: 'Werkstatt Nord',
    account_external_id: 'urn:li:organization:1',
    status: 'connected',
    token_expires_at: '2026-12-01T00:00:00.000Z',
    credentials_enc: 'v1:should-not-render',
    access_token: 'should-not-render-token',
    ...overrides,
  };
}

function renderPanel(props: Partial<Parameters<typeof SocialChannelConnectPanel>[0]> = {}) {
  return render(<SocialChannelConnectPanel reloadKey={0} {...props} />);
}

describe('social channel meta', () => {
  it('fragt keine Token-Spalten ab und verwirft mitgelieferte Siegel', () => {
    expect(SOCIAL_CHANNEL_META_COLUMNS.split(',').map((part) => part.trim())).toEqual([
      'id',
      'channel',
      'account_name',
      'account_external_id',
      'status',
      'token_expires_at',
    ]);
    const meta = toSocialChannelConnectionMeta(linkedinRow());
    expect(meta).toEqual({
      id: LINKEDIN_ID,
      channel: 'linkedin',
      account_name: 'Werkstatt Nord',
      account_external_id: 'urn:li:organization:1',
      status: 'connected',
      token_expires_at: '2026-12-01T00:00:00.000Z',
    });
    expect(JSON.stringify(meta)).not.toContain('should-not-render');
    expect(socialDisplayName(null)).toBe('Ohne Anzeigename');
    expect(socialStatusLabel('connected')).toBe('verbunden');
    expect(socialStatusLabel('nope')).toBe('unbekannt');
    expect(socialExpiryLabel(null)).toBe('kein Ablaufdatum');
    expect(socialExpiryLabel('kein-datum')).toBe('kein Ablaufdatum');
  });

  it('gibt Lade-Fehler ohne Servertext weiter', async () => {
    harness.state.listError = { message: 'access_token leaked from postgres' };
    await expect(listSocialChannelConnections('tenant-1')).rejects.toThrow(
      'Social-Konten konnten nicht geladen werden.',
    );
    harness.state.listError = null;
  });
});

describe('SocialChannelConnectPanel', () => {
  beforeEach(() => {
    harness.state.role = 'owner';
    harness.state.tenantId = 'tenant-1';
    harness.state.rows = [];
    harness.state.listError = null;
    harness.state.hang = false;
    harness.state.selects = [];
    harness.state.invoke.mockReset();
    harness.state.invoke.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it('zeigt Kanäle, lädt Metadaten und rendert keine Tokens', async () => {
    harness.state.rows = [linkedinRow()];
    renderPanel();
    const row = await screen.findByTestId(`social-connection-${LINKEDIN_ID}`);
    expect(row.textContent).toContain('LinkedIn');
    expect(row.textContent).toContain('Werkstatt Nord');
    expect(row.textContent).toContain('verbunden');
    expect(row.textContent).toContain('2026-12-01');
    expect(row.textContent).not.toContain('urn:li:organization:1');
    const panel = screen.getByTestId('social-channel-connect');
    expect(panel.textContent).not.toContain('should-not-render');
    expect(panel.textContent).not.toContain('access_token');
    expect(panel.textContent).not.toContain('credentials');
    expect(harness.state.selects[0]).toBe(SOCIAL_CHANNEL_META_COLUMNS);
    for (const id of ['x', 'instagram', 'tiktok', 'facebook']) {
      const channel = screen.getByTestId(`social-channel-${id}`);
      expect(channel.textContent).toContain('in Entwicklung');
      expect(within(channel).queryByRole('button')).toBeNull();
    }
    expect(screen.getByTestId('social-channel-linkedin').textContent).toContain('Platzhalter, OAuth fehlt');
  });

  it('startet für Verbinden und Rotieren keinen Aufruf', async () => {
    harness.state.rows = [linkedinRow()];
    renderPanel();
    await screen.findByTestId(`social-connection-${LINKEDIN_ID}`);
    fireEvent.click(screen.getByTestId('social-linkedin-connect'));
    expect(screen.getByTestId('social-oauth-placeholder').textContent).toContain('Platzhalter');
    expect(screen.getByTestId('social-oauth-placeholder').textContent).toContain('kein Token');
    fireEvent.click(screen.getByTestId(`social-connection-rotate-${LINKEDIN_ID}`));
    expect(screen.getByTestId('social-oauth-placeholder').textContent).toContain('Rotieren');
    expect(harness.state.invoke).not.toHaveBeenCalled();
    expect(screen.getByTestId('social-channel-connect').textContent).not.toContain('oauth/v2');
  });

  it('trennt über social-channel-connect ohne Credentials', async () => {
    harness.state.rows = [linkedinRow(), linkedinRow({
      id: '22222222-2222-2222-2222-222222222222',
      channel: 'facebook',
      account_name: 'Seite',
      account_external_id: 'page-1',
      status: 'connected',
    })];
    renderPanel();
    const facebook = await screen.findByTestId('social-connection-22222222-2222-2222-2222-222222222222');
    expect(within(facebook).queryByRole('button', { name: 'Rotieren' })).toBeNull();
    expect(within(facebook).getByRole('button', { name: 'Trennen' })).toBeTruthy();
    fireEvent.click(screen.getByTestId(`social-connection-disconnect-${LINKEDIN_ID}`));
    fireEvent.click(screen.getByTestId(`social-connection-disconnect-confirm-${LINKEDIN_ID}`));
    await waitFor(() => expect(harness.state.invoke).toHaveBeenCalledTimes(1));
    expect(harness.state.invoke).toHaveBeenCalledWith('social-channel-connect', {
      body: {
        op: 'remove',
        tenant_id: 'tenant-1',
        connection_id: LINKEDIN_ID,
      },
    });
    const body = harness.state.invoke.mock.calls[0][1].body;
    expect(body).not.toHaveProperty('credentials');
    expect(body).not.toHaveProperty('access_token');
  });

  it('bietet bei getrennten Konten kein Rotieren und kein Trennen', async () => {
    harness.state.rows = [linkedinRow({ status: 'revoked', token_expires_at: null })];
    renderPanel();
    const row = await screen.findByTestId(`social-connection-${LINKEDIN_ID}`);
    expect(row.textContent).toContain('getrennt');
    expect(row.textContent).toContain('kein Ablaufdatum');
    expect(within(row).queryByRole('button')).toBeNull();
  });

  it('zeigt Ladefehler mit Erneut laden und keinen Leerzustand', async () => {
    harness.state.listError = { message: 'relation missing' };
    const onRetry = vi.fn();
    renderPanel({ onRetry });
    const alert = await screen.findByTestId('social-channel-connect-error');
    expect(alert.textContent).toContain('Social-Konten konnten nicht geladen werden.');
    expect(alert.textContent).not.toContain('relation missing');
    expect(screen.queryByTestId('social-channel-connect-empty')).toBeNull();
    fireEvent.click(screen.getByTestId('social-channel-connect-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('lädt bei reloadKey neu', async () => {
    harness.state.rows = [];
    const view = renderPanel({ reloadKey: 0 });
    await screen.findByTestId('social-channel-connect-empty');
    const first = harness.state.selects.length;
    view.rerender(<SocialChannelConnectPanel reloadKey={1} />);
    await waitFor(() => expect(harness.state.selects.length).toBeGreaterThan(first));
  });

  it('sperrt Schreibaktionen ohne owner/admin', async () => {
    harness.state.role = 'editor';
    harness.state.rows = [linkedinRow()];
    renderPanel();
    await screen.findByTestId(`social-connection-${LINKEDIN_ID}`);
    expect(screen.getByTestId('social-channel-role-note').textContent).toContain('Inhabern und Admins');
    expect(screen.queryByTestId('social-linkedin-connect')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rotieren' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Trennen' })).toBeNull();
  });

  it('bleibt beim Hängen im Ladezustand', async () => {
    harness.state.hang = true;
    renderPanel();
    expect(await screen.findByTestId('social-channel-connect-loading')).toBeTruthy();
    expect(screen.queryByTestId('social-channel-connect-empty')).toBeNull();
  });

  it('meldet fehlgeschlagenes Trennen, ohne die Liste zu leeren', async () => {
    harness.state.rows = [linkedinRow()];
    harness.state.invoke.mockResolvedValue({ data: { ok: false }, error: null });
    renderPanel();
    await screen.findByTestId(`social-connection-${LINKEDIN_ID}`);
    fireEvent.click(screen.getByTestId(`social-connection-disconnect-${LINKEDIN_ID}`));
    fireEvent.click(screen.getByTestId(`social-connection-disconnect-confirm-${LINKEDIN_ID}`));
    expect(await screen.findByTestId('social-channel-action-error')).toHaveTextContent(
      'Trennen ist fehlgeschlagen.',
    );
    expect(screen.getByTestId(`social-connection-${LINKEDIN_ID}`)).toBeTruthy();
  });
});

describe('Platzierung und Quellgrenzen', () => {
  it('nimmt Social aus der deklarativen Checkliste', () => {
    render(<CockpitConnectorsStrip />);
    expect(screen.getByTestId('cockpit-connectors-strip').textContent).toContain('Konten verbinden');
    expect(document.querySelector('[data-connector-id="connector_social"]')).toBeNull();
    expect(document.querySelector('[data-connector-id="connector_google_calendar"]')).not.toBeNull();
    expect(document.querySelector('[data-connector-id="connector_gmail"]')).toBeNull();
  });

  it('hängt das Panel unter der Checkliste und schickt keine Tokens aus der Fläche', () => {
    const command = readFileSync('src/features/governance/dashboard/CommandCenterDashboard.tsx', 'utf8');
    const panel = readFileSync(
      'src/features/dashboard/widget-registry/SocialChannelConnectPanel.tsx',
      'utf8',
    );
    const api = readFileSync(
      'src/features/dashboard/widget-registry/socialChannelConnectApi.ts',
      'utf8',
    );
    expect(command.indexOf('<CockpitConnectorsStrip')).toBeLessThan(command.indexOf('<SocialChannelConnectPanel'));
    expect(command.indexOf('<SocialChannelConnectPanel')).toBeLessThan(command.indexOf('<HandoffOverview'));
    expect(command).toContain('reloadKey={reloadKey}');
    expect(command).toContain('onRetry={retry}');
    expect(panel).not.toContain('access_token');
    expect(panel).not.toContain('credentials_enc');
    expect(panel).not.toContain('oauth/v2');
    expect(panel).not.toContain("op: 'configure'");
    expect(panel).not.toContain("op: 'rotate'");
    expect(api).not.toContain("op: 'configure'");
    expect(api).not.toContain("op: 'rotate'");
    expect(api).toContain("op: 'remove'");
  });
});
