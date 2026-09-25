import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../src/core/ai-gateway/gateway', () => ({ processAIGatewayRequest: vi.fn() }));
vi.mock('../../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({ activeTenantId: 'tenant-1', hasFeature: () => false }),
}));
vi.mock('../../../src/lib/supabase', () => ({ isSupabaseConfigured: () => false, getSupabase: () => ({}) }));
vi.mock('../../../src/features/kodee/ActionRunner', () => ({
  ActionRunner: () => null,
  formatActionResult: () => '',
}));
vi.mock('../../../src/features/kodee/connections/api', () => ({ listConnections: vi.fn(async () => []) }));

import { KodeeView, describeGatewayFailure } from '../../../src/features/kodee/KodeeView';
import { processAIGatewayRequest } from '../../../src/core/ai-gateway/gateway';

const mocked = vi.mocked(processAIGatewayRequest);

function start() {
  render(
    <MemoryRouter>
      <KodeeView />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText('VPS härten'));
}

beforeEach(() => {
  mocked.mockReset();
  // jsdom kennt Element.scrollTo nicht (KodeeView scrollt ans Ende).
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

describe('KodeeView — ehrliche Gateway-Fehler', () => {
  it('sendet den aktiven Workspace als tenantId', async () => {
    mocked.mockResolvedValue({ success: true, modelOutput: 'ok' });
    start();
    await waitFor(() => expect(mocked).toHaveBeenCalled());
    expect(mocked.mock.calls[0]![0]).toMatchObject({ feature: 'kodee_chat', tenantId: 'tenant-1' });
  });

  it('401: „Bitte erneut anmelden.“ mit Login-Link', async () => {
    mocked.mockResolvedValue({ success: false, error: 'UNAUTHORIZED: x', errorCode: 'UNAUTHORIZED', status: 401 });
    start();
    const box = await screen.findByTestId('kodee-error-unauthorized');
    expect(box).toHaveTextContent('Bitte erneut anmelden.');
    expect(screen.getByRole('link', { name: 'Zur Anmeldung' })).toHaveAttribute('href', '/welcome?next=%2Fkodee');
    expect(screen.queryByRole('button', { name: 'Wiederholen' })).toBeNull();
  });

  it('403 FORBIDDEN: „Kein Zugriff auf diesen Workspace.“', async () => {
    mocked.mockResolvedValue({ success: false, error: 'FORBIDDEN: x', errorCode: 'FORBIDDEN', status: 403 });
    start();
    expect(await screen.findByTestId('kodee-error-forbidden')).toHaveTextContent('Kein Zugriff auf diesen Workspace.');
  });

  it('429 mit Retry-After nennt die Sekunden und bietet Wiederholen', async () => {
    mocked.mockResolvedValueOnce({ success: false, error: 'RATE_LIMITED: x', errorCode: 'RATE_LIMITED', status: 429, retryAfter: 17 });
    mocked.mockResolvedValueOnce({ success: true, modelOutput: 'jetzt klappt es' });
    start();
    expect(await screen.findByTestId('kodee-error-rate_limited')).toHaveTextContent(
      'Zu viele Anfragen — bitte in 17 Sekunden erneut versuchen.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Wiederholen' }));
    await waitFor(() => expect(screen.getByText('jetzt klappt es')).toBeInTheDocument());
    expect(mocked).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('kodee-error-rate_limited')).toBeNull();
    // Die Nutzernachricht steht genau einmal im Verlauf.
    expect(screen.getAllByText(/Welche Schritte härten einen frischen Ubuntu-VPS ab/)).toHaveLength(1);
  });

  it('429 ohne Retry-After nennt keine erfundene Zahl', () => {
    expect(describeGatewayFailure({ success: false, errorCode: 'RATE_LIMITED', status: 429 }).text).toBe(
      'Zu viele Anfragen — bitte später erneut versuchen.',
    );
  });

  it('sonst neutraler Fehler mit Wiederholen, ohne Rohcode', async () => {
    mocked.mockResolvedValue({ success: false, error: 'UPSTREAM_UNAVAILABLE: provider down', errorCode: 'UPSTREAM_UNAVAILABLE', status: 502 });
    start();
    const box = await screen.findByTestId('kodee-error-generic');
    expect(box).toHaveTextContent('Die Anfrage konnte gerade nicht verarbeitet werden.');
    expect(box).not.toHaveTextContent('UPSTREAM_UNAVAILABLE');
    expect(screen.getByRole('button', { name: 'Wiederholen' })).toBeInTheDocument();
  });

  it('lokale Hinweise ohne Gateway-Code bleiben lesbar (z. B. Provider nicht verfügbar)', () => {
    expect(describeGatewayFailure({ success: false, error: 'Provider „gemini" ist im AI-Gateway nicht konfiguriert.' }).text).toContain('gemini');
  });
});
