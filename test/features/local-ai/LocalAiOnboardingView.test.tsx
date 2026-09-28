/**
 * LocalAiOnboardingView — Render- und Flow-Test mit gestubbtem fetch.
 * Prüft Status je Schritt, sichtbare Fehlercodes und die Gates
 * (Rolle → Test → Aktivieren → Loop).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const tenantState = {
  activeTenantId: 'tenant-1' as string | null,
  tenants: [{ tenantId: 'tenant-1' }] as Array<{ tenantId: string }>,
  loading: false,
};

vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => tenantState,
}));

vi.mock('@/src/lib/supabase', () => ({
  isSupabaseConfigured: () => false,
  getSupabase: () => {
    throw new Error('not configured');
  },
}));

import { LocalAiOnboardingView } from '@/src/features/local-ai/LocalAiOnboardingView';
import { runHealthCheck } from '@/src/features/local-ai/healthLoop';

const GOOD_OUTPUT = JSON.stringify({
  risk_level: 'high',
  risks: [{ area: 'DSGVO', description: 'Automatisierte Absage ohne menschliche Prüfung.' }],
  recommendation: 'Menschliche Prüfung einführen.',
  source: null,
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stepStatus(title: string): string | null {
  const heading = screen.getByRole('heading', { name: new RegExp(title) });
  const section = heading.closest('section')!;
  return section.querySelector('header [data-status]')?.getAttribute('data-status') ?? null;
}

describe('LocalAiOnboardingView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    tenantState.activeTenantId = 'tenant-1';
    tenantState.tenants = [{ tenantId: 'tenant-1' }];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders all six steps as pending and locks later steps', () => {
    render(<LocalAiOnboardingView />);
    expect(screen.getByText('Lokale KI vorbereiten')).toBeInTheDocument();
    expect(screen.getByText('Verbindung prüfen')).toBeInTheDocument();
    expect(screen.getByText('Modellrolle wählen')).toBeInTheDocument();
    expect(screen.getByText('Governance-Testlauf')).toBeInTheDocument();
    expect(screen.getByText('Lokales Profil speichern')).toBeInTheDocument();
    expect(screen.getByText('Dauer-Loop (lokaler Healthcheck)')).toBeInTheDocument();
    expect(screen.getByText('Nicht geprüft')).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://127.0.0.1:11434')).toBeInTheDocument();
    expect(screen.getByText('Erst nach erfolgreicher Verbindung verfügbar.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lokale KI aktivieren/ })).not.toBeInTheDocument();
  });

  it('shows the error code when the runtime is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<LocalAiOnboardingView />);
    fireEvent.click(screen.getByRole('button', { name: /Verbindung testen/ }));
    expect(await screen.findByText('RUNTIME_UNREACHABLE')).toBeInTheDocument();
    expect(screen.getByText('Fehlt')).toBeInTheDocument();
    expect(stepStatus('Verbindung prüfen')).toBe('failed');
  });

  it('runs the full flow: connect → role → governance test → activate', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/api/tags')) return json({ models: [{ name: 'granite4.2:8b' }] });
      if (url.endsWith('/api/chat')) return json({ message: { content: GOOD_OUTPUT } });
      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<LocalAiOnboardingView />);

    fireEvent.click(screen.getByRole('button', { name: /Verbindung testen/ }));
    await waitFor(() => expect(stepStatus('Verbindung prüfen')).toBe('success'));
    expect(screen.getByText('Installiert')).toBeInTheDocument();

    // Dauer-Agent ist vor dem Basistest gesperrt
    expect(screen.getByRole('radio', { name: /Dauer-Agent/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /Governance Agent/ }));
    await waitFor(() => expect(stepStatus('Modellrolle wählen')).toBe('success'));

    fireEvent.click(screen.getByRole('button', { name: /Governance-Test ausführen/ }));
    await waitFor(() => expect(stepStatus('Governance-Testlauf')).toBe('success'));
    expect(screen.getByTestId('la-raw-output').textContent).toBe(GOOD_OUTPUT);
    expect(screen.getByText('source ist null — nichts erfunden.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Dauer-Agent/ })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Lokale KI aktivieren/ }));
    await waitFor(() => expect(stepStatus('Lokales Profil speichern')).toBe('success'));
    const stored = JSON.parse(window.localStorage.getItem('realsync.localAi.profile.v1:tenant-1')!);
    expect(stored).toMatchObject({ model: 'granite4.2:8b', role: 'governance', enabled: true, scope: 'device_local' });
    expect(stored).not.toHaveProperty('tenant_id');

    // Loop ist aktivierbar, startet aber nicht von selbst
    expect(screen.getByRole('button', { name: /Loop starten/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('button', { name: /Loop starten/ })).not.toBeDisabled();
  });

  it('fails the governance test when the model invents a source', async () => {
    const fabricated = JSON.stringify({ ...JSON.parse(GOOD_OUTPUT), source: { title: 'Leitfaden 2025' } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/api/tags') ? json({ models: [{ name: 'granite4.2:8b' }] }) : json({ message: { content: fabricated } }),
      ),
    );
    render(<LocalAiOnboardingView />);
    fireEvent.click(screen.getByRole('button', { name: /Verbindung testen/ }));
    await waitFor(() => expect(stepStatus('Verbindung prüfen')).toBe('success'));
    fireEvent.click(screen.getByRole('radio', { name: /Governance Agent/ }));
    fireEvent.click(screen.getByRole('button', { name: /Governance-Test ausführen/ }));
    await waitFor(() => expect(stepStatus('Governance-Testlauf')).toBe('failed'));
    expect(screen.getByText(/erfundener Beleg/)).toBeInTheDocument();
    // Profil-Schritt bleibt gesperrt — kein Aktivieren ohne bestandenen Test
    expect(screen.queryByRole('button', { name: /Lokale KI aktivieren/ })).not.toBeInTheDocument();
  });

  it('ignores an unverified tenant id and blocks saving', () => {
    tenantState.activeTenantId = 'tenant-from-storage';
    tenantState.tenants = [{ tenantId: 'tenant-1' }];
    render(<LocalAiOnboardingView />);
    expect(screen.getByText(/Kein verifizierter Mandant aktiv/)).toBeInTheDocument();
  });

  it('switches between dark and light mode with the same structure', () => {
    render(<LocalAiOnboardingView />);
    const root = screen.getByTestId('local-ai-onboarding');
    expect(root).toHaveAttribute('data-theme', 'dark');
    fireEvent.click(screen.getByRole('button', { name: /Hell/ }));
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6);
  });
});

describe('runHealthCheck', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports model reachability and latency from a real probe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ models: [{ name: 'granite4.2:8b' }] })));
    const snap = await runHealthCheck('http://127.0.0.1:11434', 'granite4.2:8b');
    expect(snap).toMatchObject({ runtimeReachable: true, modelReachable: true, errorCode: null });
    expect(typeof snap.latencyMs).toBe('number');
  });

  it('flags a missing model and an unreachable runtime', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ models: [{ name: 'other' }] })));
    expect(await runHealthCheck('http://127.0.0.1:11434', 'granite4.2:8b')).toMatchObject({
      runtimeReachable: true,
      modelReachable: false,
      errorCode: 'MODEL_NOT_INSTALLED',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await runHealthCheck('http://127.0.0.1:11434', 'granite4.2:8b')).toMatchObject({
      runtimeReachable: false,
      latencyMs: null,
    });
  });
});
