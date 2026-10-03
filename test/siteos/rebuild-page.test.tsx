import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from 'react-router-dom';
import { rebuildCase } from './rebuild-helpers';

/**
 * Rebuild-Seite (/app/siteos/rebuild): DISCOVER → ASSESS → REBUILD.
 *
 * Geprüft wird die Schnittstelle: Die Seite schickt nur Absichten (Adresse,
 * gewählte Richtung) mit dem Mandanten als zu prüfender Behauptung; sie
 * zeigt Positionierung, Bewertung mit Belegen und die Richtungen, und sie
 * übergibt nach der Auswahl an den Workspace. Die Antwort des Servers wird
 * aus denselben Fixtures erzeugt, die der Kern-Test benutzt.
 */

const api = { analyzeWebsite: vi.fn(), selectDirection: vi.fn(), loadRun: vi.fn() };
vi.mock('../../src/features/siteos/rebuild/rebuildApi', () => ({
  analyzeWebsite: (...a: unknown[]) => api.analyzeWebsite(...a),
  selectDirection: (...a: unknown[]) => api.selectDirection(...a),
  loadRun: (...a: unknown[]) => api.loadRun(...a),
}));
vi.mock('../../src/features/supabase/SupabaseAuthContext', () => ({ useSupabaseAuth: () => ({ isAuthenticated: true }) }));
vi.mock('../../src/core/access/TenantProvider', () => ({ useTenant: () => ({ activeTenantId: 'tenant-1', loading: false }) }));
vi.mock('../../src/components/preview/SandboxedPreviewFrame', () => ({ SandboxedPreviewFrame: () => null }));

const { default: RebuildPage } = await import('../../src/features/siteos/rebuild/RebuildPage');
const { buildDirection, canonicalHash } = await import('../../packages/siteos-core/src/index');

const RUN_ID = '11111111-2222-4333-8444-555555555555';
const SNAPSHOT_SHA = 'e'.repeat(64);

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}{loc.search}</div>;
}

function renderPage(entry: InitialEntry = '/app/siteos/rebuild') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/app/siteos/rebuild" element={<RebuildPage />} />
        <Route path="/app/siteos/rebuild/:runId" element={<RebuildPage />} />
        <Route path="/builder/:slug" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Antwort des Servers — Richtungen wie dort an den Lauf gebunden (`origin.rebuild`). */
async function analyzeResponse() {
  const c = await rebuildCase('handwerk');
  const derivedAt = '2026-09-29T10:00:00.000Z';
  const builds = c.builds.map((b) => buildDirection(c.snapshot, c.positioning, c.assessment, b.plan.key, { createdAt: derivedAt, run: { id: RUN_ID, snapshotSha256: SNAPSHOT_SHA } }));
  return {
    kind: 'ok' as const,
    data: {
      ok: true,
      run: { id: RUN_ID, engine_version: c.snapshot.engineVersion, derived_at: derivedAt, snapshot_sha256: SNAPSHOT_SHA, evidence_id: 'ev-123456789', evidence_hash: 'f'.repeat(64) },
      snapshot: c.snapshot,
      positioning: c.positioning,
      assessment: c.assessment,
      directions: await Promise.all(builds.map(async (b) => ({ plan: b.plan, report: b.report, blueprint: b.blueprint, blueprint_sha256: await canonicalHash(b.blueprint) }))),
    },
  };
}

/** Einstieg über einen Link mit Adresse: vorausgefüllt, gestartet per Klick. */
async function analyzeFromLink(search: string) {
  renderPage(`/app/siteos/rebuild${search}`);
  fireEvent.click(screen.getByRole('button', { name: /Analysieren/ }));
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
});

describe('Rebuild-Seite', () => {
  it('schickt nur die Adresse und den zu prüfenden Mandanten', async () => {
    api.analyzeWebsite.mockResolvedValue(await analyzeResponse());
    renderPage();
    fireEvent.change(screen.getByLabelText('Adresse Ihrer bestehenden Website'), { target: { value: 'mueller-haustechnik.example' } });
    fireEvent.click(screen.getByRole('button', { name: /Analysieren/ }));
    await waitFor(() => expect(api.analyzeWebsite).toHaveBeenCalledWith({ tenant_id: 'tenant-1', url: 'mueller-haustechnik.example' }));
    expect(Object.keys(api.analyzeWebsite.mock.calls[0][0]).sort()).toEqual(['tenant_id', 'url']);
  });

  it('startet über einen Link nicht von selbst — erst der Klick ruft ab', async () => {
    api.analyzeWebsite.mockResolvedValue(await analyzeResponse());
    renderPage('/app/siteos/rebuild?url=intern.example');
    expect(screen.getByLabelText('Adresse Ihrer bestehenden Website')).toHaveValue('intern.example');
    expect(screen.getByText(/Abgerufen wird erst nach Ihrem Klick/)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(api.analyzeWebsite).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Analysieren/ }));
    await waitFor(() => expect(api.analyzeWebsite).toHaveBeenCalledWith({ tenant_id: 'tenant-1', url: 'intern.example' }));
  });

  it('startet gleich, wenn die App selbst dorthin schickt (Navigationszustand)', async () => {
    api.analyzeWebsite.mockResolvedValue(await analyzeResponse());
    renderPage({ pathname: '/app/siteos/rebuild', search: '?url=mueller-haustechnik.example', state: { autostart: true } });
    await waitFor(() => expect(api.analyzeWebsite).toHaveBeenCalledTimes(1));
  });

  it('zeigt Positionierung, Bewertung mit Belegen und die Richtungen', async () => {
    api.analyzeWebsite.mockResolvedValue(await analyzeResponse());
    await analyzeFromLink('?url=mueller-haustechnik.example');
    await screen.findByRole('heading', { name: 'Richtungen' });
    expect(screen.getByText('Müller Haustechnik GmbH')).toBeInTheDocument();
    expect(screen.getByText('Leipzig')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bewertung' })).toBeInTheDocument();
    // Die Vorschauen leitet die Seite aus demselben Snapshot ab wie der Server.
    expect(await screen.findByLabelText('Richtung Clean Enterprise')).toBeInTheDocument();
    expect(screen.getByLabelText('Richtung Conversion Focus')).toBeInTheDocument();
    expect(screen.getByLabelText('Richtung Local Trust')).toBeInTheDocument();
    // Offenes wird offen genannt, nicht aufgefüllt.
    expect(screen.getAllByText('offen').length).toBeGreaterThan(0);
    // Vorschau und Server leiten gleich ab (mit Laufbindung) — keine Warnung.
    expect(screen.queryByText(/älteren Version des Rebuilds/)).not.toBeInTheDocument();
  });

  it('öffnet die Belege einer Aussage als Text', async () => {
    api.analyzeWebsite.mockResolvedValue(await analyzeResponse());
    await analyzeFromLink('?url=mueller-haustechnik.example');
    await screen.findByRole('heading', { name: 'Richtungen' });
    const befund = screen.getByText('Kein Viewport-Meta-Tag').closest('li') as HTMLElement;
    fireEvent.click(within(befund).getByRole('button', { name: /Beleg/ }));
    const drawer = await screen.findByRole('dialog', { name: /Belege: Kein Viewport-Meta-Tag/ });
    expect(within(drawer).getAllByText(/SHA-256/).length).toBeGreaterThan(0);
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('übernimmt eine Richtung serverseitig und übergibt an den Workspace', async () => {
    api.analyzeWebsite.mockResolvedValue(await analyzeResponse());
    api.selectDirection.mockResolvedValue({ kind: 'ok', data: { ok: true, slug: 'mueller-haustechnik-example', version: 1, blueprint_id: 'bp-1', unchanged: false, content_sha256: 'a'.repeat(64) } });
    await analyzeFromLink('?url=mueller-haustechnik.example&instruction=CTA%20st%C3%A4rker');
    const card = await screen.findByLabelText('Richtung Local Trust');
    const choose = within(card).getByRole('button', { name: /Diese Richtung übernehmen/ });
    await waitFor(() => expect(choose).toBeEnabled());
    fireEvent.click(choose);
    await waitFor(() => expect(api.selectDirection).toHaveBeenCalledWith({ tenant_id: 'tenant-1', run_id: RUN_ID, direction: 'local-trust' }));
    const location = await screen.findByTestId('location');
    expect(location.textContent).toContain('/builder/mueller-haustechnik-example?');
    expect(location.textContent).toContain('tab=refine');
    expect(location.textContent).toContain('instruction=CTA+st%C3%A4rker');
    // Der Lauf reist nicht als Parameter mit — der Workspace erfährt ihn vom Server.
    expect(location.textContent).not.toContain('rebuild=');
  });

  it('warnt, wenn Vorschau und angebotene Richtung nicht übereinstimmen, und sperrt die Übernahme', async () => {
    const response = await analyzeResponse();
    response.data.directions = response.data.directions.map((d) => ({ ...d, blueprint_sha256: '0'.repeat(64) }));
    api.analyzeWebsite.mockResolvedValue(response);
    await analyzeFromLink('?url=mueller-haustechnik.example');
    expect(await screen.findByText(/älteren Version des Rebuilds/)).toBeInTheDocument();
    const card = screen.getByLabelText('Richtung Local Trust');
    expect(within(card).getByRole('button', { name: /Diese Richtung übernehmen/ })).toBeDisabled();
  });

  it('zeigt die Fehlermeldung des Servers statt eines generischen Fehlers', async () => {
    api.analyzeWebsite.mockResolvedValue({ kind: 'error', status: 422, code: 'ROBOTS_DISALLOWED', message: 'Die robots.txt der Website schließt den Abruf aus. RealSync liest die Seite deshalb nicht.' });
    await analyzeFromLink('?url=gesperrt.example');
    expect(await screen.findByRole('alert')).toHaveTextContent('robots.txt der Website schließt den Abruf aus');
  });
});
