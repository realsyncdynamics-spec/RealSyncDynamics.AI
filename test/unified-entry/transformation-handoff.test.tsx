import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { buildSiteFromPrompt, canonicalHash, getIndustryPreset, parseBrief } from '../../packages/siteos-core/src/index';

/**
 * Der Einstieg (`/unified-entry/transformation`) fragt „Was möchtest du
 * bauen?" und endet im App Builder Workspace — ein Builder, nicht zwei.
 *
 * Geprüft wird die Übergabe an den Server und an den Workspace: dass die
 * Beschreibung unverändert als Prompt geht (kein Brief, kein Blueprint aus
 * dem Browser), dass die Seite vorher sagt, was der Kern daraus ableitet —
 * mit denselben Funktionen, die der Server benutzt —, und dass der URL-Pfad
 * für Audit-Handoff, WowPreview und den Workspace-Neubau erhalten bleibt.
 */
const invoke = vi.fn();
vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke: (...args: unknown[]) => invoke(...args) } }),
}));
const buildSite = vi.fn();
vi.mock('../../src/features/siteos/siteOsApi', () => ({
  buildSite: (...args: unknown[]) => buildSite(...args),
  errorMessage: (e: { message?: string }) => e.message ?? 'Fehler',
}));
vi.mock('../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({ activeTenantId: 'tenant-1', loading: false }),
}));
vi.mock('../../src/features/supabase/SupabaseAuthContext', () => ({
  useSupabaseAuth: () => ({ isAuthenticated: true }),
}));
let available = true;
vi.mock('../../src/components/landing/EdgeFunctionAvailabilityNotice', () => ({
  allEdgeFunctionsAvailable: () => available,
  EdgeFunctionAvailabilityNotice: () => null,
}));

const { default: PreviewSelectionPage, recognizeDescription } = await import('../../src/unified-entry/pages/PreviewSelectionPage');

const EXAMPLE = 'Erstelle mir eine moderne Website für einen Sanitärbetrieb mit Startseite, Leistungen, Über uns, Kontakt und Terminbuchung';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}{loc.search}</div>;
}

function renderAt(search: string) {
  window.history.replaceState({}, '', `/unified-entry/transformation${search}`);
  return render(
    <MemoryRouter initialEntries={[`/unified-entry/transformation${search}`]}>
      <Routes>
        <Route path="/unified-entry/transformation" element={<PreviewSelectionPage />} />
        <Route path="/builder/:slug" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

let sampleSlug = '';
beforeEach(async () => {
  invoke.mockReset(); buildSite.mockReset(); available = true;
  invoke.mockResolvedValue({ data: { source_url: 'https://ihre-firma.de/', title: 'Ihre Firma', description: null, h1: null, services: ['Beratung'], visible_text: '' }, error: null });
  const { blueprint } = await buildSiteFromPrompt('Erstelle eine Website für einen Zahnarzt in Hamburg.', { locale: 'de', model: 'test-model', createdAt: '2026-09-06T00:00:00.000Z' });
  sampleSlug = blueprint.slug;
  buildSite.mockResolvedValue({ kind: 'ok', data: { ok: true, unchanged: false, blueprint, content_sha256: await canonicalHash(blueprint), version: 1, slug: blueprint.slug, findings: [], scores: {} } });
});

describe('Einstieg — „Was möchtest du bauen?"', () => {
  it('beginnt ohne Parameter mit der Frage, nicht mit der Adressabfrage, und baut nichts von selbst', () => {
    renderAt('');
    expect(screen.getByRole('heading', { name: 'Was möchtest du bauen?' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Adresse Ihrer bestehenden Website')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /App bauen/ })).toBeDisabled();
    expect(buildSite).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('schickt die Beschreibung unverändert als Prompt — ohne Discover, ohne Anreicherung — und leitet in den Workspace ohne Quelle', async () => {
    renderAt('');
    fireEvent.change(screen.getByLabelText('Was möchtest du bauen?'), { target: { value: `  ${EXAMPLE}  ` } });
    fireEvent.click(screen.getByRole('button', { name: /App bauen/ }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(`/builder/${sampleSlug}`));
    expect(buildSite).toHaveBeenCalledTimes(1);
    expect(buildSite.mock.calls[0][0]).toEqual({ tenant_id: 'tenant-1', prompt: EXAMPLE, locale: 'de' });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('sagt vor dem Bau, was der Kern ableitet — mit denselben Funktionen wie der Server', () => {
    renderAt('');
    fireEvent.change(screen.getByLabelText('Was möchtest du bauen?'), { target: { value: EXAMPLE } });
    const box = within(screen.getByTestId('recognition'));
    const brief = parseBrief(EXAMPLE, 'de');
    expect(brief.industry).toBe('handwerk');
    expect(box.getByText(getIndustryPreset('handwerk').label)).toBeInTheDocument();
    expect(box.getByText('nicht genannt')).toBeInTheDocument();
    // Der Seitenplan der Branche, nicht die Wunschliste: „Über uns" und
    // „Kontakt" sind hier keine Seiten, sondern Bausteine — und das steht da.
    expect(box.getByText(/Startseite · Leistungen · Referenzen · Anfrage/)).toBeInTheDocument();
    expect(box.getByText(/Terminbuchung · Über-uns-Bereich/)).toBeInTheDocument();
    expect(box.getByText(/ohne Sprachmodell/)).toBeInTheDocument();
    expect(box.getByText(/Was nicht erkannt wird, wird nicht erfunden/)).toBeInTheDocument();
  });

  it('nennt eine nicht erkannte Branche als nicht erkannt, statt eine zu raten', () => {
    renderAt('');
    fireEvent.change(screen.getByLabelText('Was möchtest du bauen?'), { target: { value: 'Ich brauche irgendwas Schönes' } });
    expect(within(screen.getByTestId('recognition')).getByText(/Nicht sicher erkannt/)).toBeInTheDocument();
    expect(recognizeDescription('Ich brauche irgendwas Schönes')?.confident).toBe(false);
    expect(recognizeDescription('kurz')).toBeNull();
  });

  it('zeigt einen Fehlschlag als Fehlschlag und bleibt auf der Seite', async () => {
    buildSite.mockResolvedValue({ kind: 'error', message: 'Der Dienst hat den Bau abgelehnt.' });
    renderAt('');
    fireEvent.change(screen.getByLabelText('Was möchtest du bauen?'), { target: { value: EXAMPLE } });
    fireEvent.click(screen.getByRole('button', { name: /App bauen/ }));
    await waitFor(() => expect(screen.getByText(/den Bau abgelehnt/)).toBeInTheDocument());
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /App bauen/ })).toBeEnabled();
  });

  it('sperrt den Bau, solange die Function nicht verfügbar ist', () => {
    available = false;
    renderAt('');
    fireEvent.change(screen.getByLabelText('Was möchtest du bauen?'), { target: { value: EXAMPLE } });
    expect(screen.getByRole('button', { name: /App bauen/ })).toBeDisabled();
  });

  it('hält den URL-Pfad als zweiten Weg erreichbar', async () => {
    renderAt('');
    fireEvent.click(screen.getByRole('button', { name: /Bestehende Website neu bauen/ }));
    expect(screen.getByRole('heading', { name: 'Welche Website sollen wir neu bauen?' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Adresse Ihrer bestehenden Website'), { target: { value: 'ihre-firma.de' } });
    fireEvent.click(screen.getByRole('button', { name: /Website neu bauen/ }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(`/builder/${sampleSlug}?source=https%3A%2F%2Fihre-firma.de%2F`));
    expect(invoke).toHaveBeenCalledWith('siteos/discover', { body: { tenant_id: 'tenant-1', url: 'https://ihre-firma.de/' } });
    const args = buildSite.mock.calls[0][0] as { prompt: string; enrichment?: unknown };
    expect(args.prompt).toContain('Ausgangswebsite: https://ihre-firma.de/.');
    expect(args.enrichment).toBeDefined();
  });
});

describe('Erstbau → Workspace (bestehende Aufrufer mit ?url=)', () => {
  it('leitet nach dem Erstbau in den Workspace der neuen Site, mit der Quelle als Parameter', async () => {
    renderAt('?url=https%3A%2F%2Fihre-firma.de%2F');
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(`/builder/${sampleSlug}?source=https%3A%2F%2Fihre-firma.de%2F`));
    expect(buildSite).toHaveBeenCalledTimes(1);
  });

  it('nimmt eine Anweisung aus dem Workspace in den Erstbau auf', async () => {
    renderAt('?url=https%3A%2F%2Fihre-firma.de%2F&instruction=Hero+hochwertiger');
    await waitFor(() => expect(buildSite).toHaveBeenCalledTimes(1));
    const args = buildSite.mock.calls[0][0] as { prompt: string };
    expect(args.prompt).toContain('Zusätzliche Kundenanweisung: Hero hochwertiger');
  });

  it('reicht die Design-Vorlage der WowPreview (?variant=) an den Workspace durch', async () => {
    renderAt('?domain=ihre-firma.de&variant=bento-bold');
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(`/builder/${sampleSlug}?source=https%3A%2F%2Fihre-firma.de%2F&variant=bento-bold`));
  });
});
