import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Sichert den Einstieg in die Website-Transformation ohne Query-Parameter ab.
 *
 * Die Landing-CTA „Präsenz & App bauen" verlinkt ohne `?url=` auf
 * `/unified-entry/transformation`. Vorher startete die Seite trotzdem sofort
 * den Vollbild-Ladebalken, während `build()` mangels URL still abbrach — der
 * Nutzer stand dauerhaft vor „Ihre neue Website wird gebaut", ohne je seine
 * Domain eingeben zu können. Seit der Korrektur fragt die Seite zuerst nach
 * der Domain und beginnt den Aufbau erst danach.
 */
const invoke = vi.fn();
vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke: (...args: unknown[]) => invoke(...args) } }),
}));

const buildSite = vi.fn();
vi.mock('../../src/features/siteos/siteOsApi', () => ({
  buildSite: (...args: unknown[]) => buildSite(...args),
  errorMessage: () => 'Fehler',
}));

vi.mock('../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({ activeTenantId: 'tenant-1', loading: false }),
}));

vi.mock('../../src/features/supabase/SupabaseAuthContext', () => ({
  useSupabaseAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('../../src/components/landing/EdgeFunctionAvailabilityNotice', () => ({
  allEdgeFunctionsAvailable: () => true,
  EdgeFunctionAvailabilityNotice: () => null,
}));

vi.mock('../../src/features/billing/checkout', () => ({
  createSiteOsCheckoutSession: vi.fn(),
}));

vi.mock('../../src/components/preview/SandboxedPreviewFrame', () => ({
  SandboxedPreviewFrame: () => null,
}));

const { default: PreviewSelectionPage } = await import('../../src/unified-entry/pages/PreviewSelectionPage');

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/unified-entry/transformation']}>
      <PreviewSelectionPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  invoke.mockReset();
  buildSite.mockReset();
  // Der Aufbau bleibt absichtlich offen: die Tests pruefen den Einstieg,
  // nicht das Rendering eines fertigen Blueprints.
  invoke.mockReturnValue(new Promise(() => {}));
  buildSite.mockReturnValue(new Promise(() => {}));
});

describe('Transformation ohne url-Parameter', () => {
  it('fragt zuerst nach der Domain statt einen endlosen Ladebalken zu zeigen', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Welche Website sollen wir neu bauen\?/ })).toBeInTheDocument();
    expect(screen.queryByText('Ihre neue Website wird gebaut')).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('startet den Aufbau nach der Eingabe mit ergänztem Schema', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Adresse Ihrer bestehenden Website'), { target: { value: 'ihre-firma.de' } });
    fireEvent.click(screen.getByRole('button', { name: /Website bauen/ }));

    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(invoke).toHaveBeenCalledWith('siteos/discover', {
      body: { tenant_id: 'tenant-1', url: 'https://ihre-firma.de/' },
    });
    expect(screen.getByText('Ihre neue Website wird gebaut')).toBeInTheDocument();
  });

  it('baut ohne brauchbare Domain nicht und erklärt warum', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Website bauen/ }));
    expect(screen.getByText('Bitte geben Sie die Adresse Ihrer bestehenden Website ein.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Adresse Ihrer bestehenden Website'), { target: { value: 'nur-ein-wort' } });
    fireEvent.click(screen.getByRole('button', { name: /Website bauen/ }));
    expect(screen.getByText('Bitte eine vollständige Domain angeben, z. B. ihre-firma.de.')).toBeInTheDocument();

    expect(invoke).not.toHaveBeenCalled();
  });
});
