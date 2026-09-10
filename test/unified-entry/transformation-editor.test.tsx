import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { buildSiteFromPrompt, canonicalHash, type SiteBlueprint } from '../../packages/siteos-core/src/index';
import { pageToPuckData, type PuckPageData } from '../../src/features/siteos/editor/blueprintPuckAdapter';

/**
 * Der Block-Editor auf `/unified-entry/transformation`: Was die Seite an den
 * Server schickt, wenn jemand speichert — und was nicht.
 *
 * Der Editor selbst (Puck) ist hier durch einen Stellvertreter ersetzt, der
 * dieselbe Schnittstelle bedient: Er meldet Puck-Daten für eine Seite. Ob
 * Puck rendert, prüft der Browser (siehe PR); ob die Seite daraus die
 * richtige Anfrage macht, prüft dieser Test.
 */
const invoke = vi.fn();
vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke: (...args: unknown[]) => invoke(...args) } }),
}));

const buildSite = vi.fn();
const editSite = vi.fn();
vi.mock('../../src/features/siteos/siteOsApi', () => ({
  buildSite: (...args: unknown[]) => buildSite(...args),
  editSite: (...args: unknown[]) => editSite(...args),
  errorMessage: (e: { message?: string }) => e.message ?? 'Fehler',
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

const previewFrame = vi.fn();
vi.mock('../../src/components/preview/SandboxedPreviewFrame', () => ({
  SandboxedPreviewFrame: (props: { html: string }) => { previewFrame(props); return null; },
}));

// Stellvertreter für den Editor: zeigt die Props und bietet einen Knopf, der
// eine bearbeitete Seite meldet — genau wie Puck es über `onChange` täte.
let lastEditorProps: Record<string, unknown> | null = null;
vi.mock('../../src/features/siteos/editor/SiteOsBlockEditor', () => ({
  default: (props: Record<string, unknown>) => {
    lastEditorProps = props;
    const stored = props.storedBlueprint as SiteBlueprint;
    const change = props.onPageDataChange as (path: string, data: PuckPageData) => void;
    return (
      <div>
        <div data-testid="editor" data-revision={String(props.revision)} data-page={String(props.pagePath)} />
        <button onClick={() => {
          const data = pageToPuckData(stored.pages[0]);
          const hero = data.content.find((c) => c.type === 'hero')!;
          hero.props = { ...hero.props, headline: 'Praxis Dr. Muster' };
          change('/', data);
        }}>stub:edit-hero</button>
        {props.asideRight as React.ReactNode}
        {props.canvasHeader as React.ReactNode}
      </div>
    );
  },
}));

const { default: PreviewSelectionPage } = await import('../../src/unified-entry/pages/PreviewSelectionPage');

async function sample() {
  const { blueprint } = await buildSiteFromPrompt('Erstelle eine Website für einen Zahnarzt in Hamburg.', {
    locale: 'de', model: 'test-model', createdAt: '2026-09-06T00:00:00.000Z',
  });
  return { blueprint, sha256: await canonicalHash(blueprint) };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/unified-entry/transformation?url=https%3A%2F%2Fihre-firma.de%2F']}>
      <PreviewSelectionPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  invoke.mockReset();
  buildSite.mockReset();
  editSite.mockReset();
  previewFrame.mockReset();
  lastEditorProps = null;
  window.history.replaceState({}, '', '/unified-entry/transformation?url=https%3A%2F%2Fihre-firma.de%2F');
  invoke.mockResolvedValue({ data: { source_url: 'https://ihre-firma.de/', title: 'Ihre Firma', description: null, h1: null, services: ['Beratung'], visible_text: '' }, error: null });
});

describe('Block-Editor auf der Transformation', () => {
  it('lädt den Editor mit dem gespeicherten Stand und schickt beim Speichern nur die Bearbeitung', async () => {
    const { blueprint, sha256 } = await sample();
    buildSite.mockResolvedValue({ kind: 'ok', data: { ok: true, unchanged: false, blueprint, content_sha256: sha256, version: 1, slug: blueprint.slug, findings: [], scores: {} } });
    editSite.mockImplementation(async (args: { edits: unknown[] }) => ({
      kind: 'ok',
      data: { ok: true, unchanged: false, blueprint, content_sha256: 'b'.repeat(64), version: 2, slug: blueprint.slug, findings: [], scores: {}, changes: [{ code: 'block.edited', path: '/', blockId: 'root--hero--1', kind: 'hero', summary: 'Hero bearbeitet.', complianceNote: 'Der Block gilt jetzt als redaktionell, nicht mehr als KI-generiert.' }], rejected: [], edits: args.edits },
    }));

    renderPage();
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());
    expect(lastEditorProps?.storedBlueprint).toBe(blueprint);
    expect(screen.getByText('Version 1 gespeichert')).toBeInTheDocument();

    // Ohne Änderung ist Speichern gesperrt.
    const saveButtons = screen.getAllByRole('button', { name: /Speichern/ });
    for (const button of saveButtons) expect(button).toBeDisabled();

    fireEvent.click(screen.getByText('stub:edit-hero'));
    await waitFor(() => expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument());
    // Die lokale Fassung trägt die Änderung — aus derselben Logik wie der Server.
    const local = lastEditorProps?.localBlueprint as SiteBlueprint;
    expect(local.pages[0].blocks.find((b) => b.kind === 'hero')?.content.headline).toBe('Praxis Dr. Muster');

    fireEvent.click(screen.getAllByRole('button', { name: /Speichern/ })[0]);
    await waitFor(() => expect(editSite).toHaveBeenCalledTimes(1));
    const call = editSite.mock.calls[0][0] as { tenant_id: string; slug: string; base_sha256: string; edits: { path: string; blocks: { id?: string; kind: string; content?: Record<string, unknown> }[] }[] };
    expect(call.tenant_id).toBe('tenant-1');
    expect(call.slug).toBe(blueprint.slug);
    expect(call.base_sha256).toBe(sha256);
    expect(call.edits).toHaveLength(1);
    expect(call.edits[0].path).toBe('/');
    // Nur das geänderte Feld — kein Blueprint, keine Merkmale.
    const hero = call.edits[0].blocks.find((b) => b.kind === 'hero')!;
    expect(hero.content).toEqual({ headline: 'Praxis Dr. Muster' });
    for (const block of call.edits[0].blocks) {
      expect(block).not.toHaveProperty('aiGenerated');
      expect(block).not.toHaveProperty('processesPersonalData');
    }

    await waitFor(() => expect(screen.getByText(/Version 2 gespeichert und geprüft/)).toBeInTheDocument());
    expect(screen.getByText('Hero bearbeitet.')).toBeInTheDocument();
    expect(screen.getByText(/nicht mehr als KI-generiert/)).toBeInTheDocument();
    // Der Editor wurde auf den neuen Stand aufgesetzt.
    expect(screen.getByTestId('editor').getAttribute('data-revision')).toBe('2');
  });

  it('zeigt in der Vorschau das echte Dokument der lokalen Fassung', async () => {
    const { blueprint, sha256 } = await sample();
    buildSite.mockResolvedValue({ kind: 'ok', data: { ok: true, unchanged: false, blueprint, content_sha256: sha256, version: 1, slug: blueprint.slug, findings: [], scores: {} } });

    renderPage();
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());
    fireEvent.click(screen.getByText('stub:edit-hero'));
    fireEvent.click(screen.getByRole('button', { name: /Vorschau/ }));

    await waitFor(() => expect(previewFrame).toHaveBeenCalled());
    const html = previewFrame.mock.calls.at(-1)?.[0].html as string;
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Praxis Dr. Muster');
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
  });

  it('meldet einen überholten Stand statt ihn zu überschreiben', async () => {
    const { blueprint, sha256 } = await sample();
    buildSite.mockResolvedValue({ kind: 'ok', data: { ok: true, unchanged: false, blueprint, content_sha256: sha256, version: 1, slug: blueprint.slug, findings: [], scores: {} } });
    editSite.mockResolvedValue({ kind: 'conflict', message: 'Der Entwurf wurde inzwischen an anderer Stelle geändert. Bitte neu laden und die Änderung wiederholen.' });

    renderPage();
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());
    fireEvent.click(screen.getByText('stub:edit-hero'));
    await waitFor(() => expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /Speichern/ })[0]);

    await waitFor(() => expect(screen.getByText(/inzwischen an anderer Stelle geändert/)).toBeInTheDocument());
    // Die Bearbeitung bleibt erhalten — der Nutzer entscheidet, nicht die Seite.
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument();
  });
});
