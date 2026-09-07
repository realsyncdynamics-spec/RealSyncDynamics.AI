import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { analyzeBlueprint, buildSiteFromPrompt, canonicalHash, type SiteBlueprint } from '../../packages/siteos-core/src/index';
import { pageToPuckData, type PuckPageData } from '../../src/features/siteos/editor/blueprintPuckAdapter';

/**
 * Der App Builder Workspace (`/builder/:slug`), Phase 2 PR A — die Shell.
 *
 * Geprüft wird die Schnittstelle zum Server und die Wahrheit der Kopfzeile:
 * Was geladen wird, was beim Speichern geschickt wird, und dass „gespeichert"
 * nur dasteht, wenn der Server eine Version angelegt hat. Puck selbst ist
 * durch einen Stellvertreter ersetzt, der dieselben Props bedient.
 */
const api = {
  loadLatestBlueprint: vi.fn(),
  editSite: vi.fn(),
  evaluatePublish: vi.fn(),
  listBlueprintChain: vi.fn(),
  listEvaluations: vi.fn(),
  listCustodyEvents: vi.fn(),
  listAgentRuns: vi.fn(),
};
vi.mock('../../src/features/siteos/siteOsApi', () => ({
  loadLatestBlueprint: (...a: unknown[]) => api.loadLatestBlueprint(...a),
  editSite: (...a: unknown[]) => api.editSite(...a),
  evaluatePublish: (...a: unknown[]) => api.evaluatePublish(...a),
  listBlueprintChain: (...a: unknown[]) => api.listBlueprintChain(...a),
  listEvaluations: (...a: unknown[]) => api.listEvaluations(...a),
  listCustodyEvents: (...a: unknown[]) => api.listCustodyEvents(...a),
  listAgentRuns: (...a: unknown[]) => api.listAgentRuns(...a),
  errorMessage: (e: { message?: string }) => e.message ?? 'Fehler',
}));

let authenticated = true;
vi.mock('../../src/features/supabase/SupabaseAuthContext', () => ({
  useSupabaseAuth: () => ({ isAuthenticated: authenticated }),
}));
vi.mock('../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({ activeTenantId: 'tenant-1', loading: false }),
}));
vi.mock('../../src/features/billing/checkout', () => ({ createSiteOsCheckoutSession: vi.fn() }));
const previewFrame = vi.fn();
vi.mock('../../src/components/preview/SandboxedPreviewFrame', () => ({
  SandboxedPreviewFrame: (props: { html: string }) => { previewFrame(props); return null; },
}));

// Stellvertreter für Puck: rendert die Rahmen-Props des Workspace und bietet
// einen Knopf, der eine bearbeitete Seite meldet — wie Puck über `onChange`.
let editorProps: Record<string, unknown> | null = null;
vi.mock('../../src/features/siteos/editor/SiteOsBlockEditor', () => ({
  default: (props: Record<string, unknown>) => {
    editorProps = props;
    const stored = props.storedBlueprint as SiteBlueprint;
    const change = props.onPageDataChange as (path: string, data: PuckPageData) => void;
    const renderLeft = props.renderLeft as (parts: { outline: React.ReactNode; components: React.ReactNode }) => React.ReactNode;
    return (
      <div data-testid="editor" data-revision={String(props.revision)} data-page={String(props.pagePath)} data-pane={String(props.mobilePane)}>
        <div data-testid="left">{renderLeft({ outline: <div>stub:outline</div>, components: <div>stub:components</div> })}</div>
        <button onClick={() => {
          const data = pageToPuckData(stored.pages[0]);
          const hero = data.content.find((c) => c.type === 'hero')!;
          hero.props = { ...hero.props, headline: 'Praxis Dr. Muster' };
          change('/', data);
        }}>stub:edit-hero</button>
        {props.canvasHeader as React.ReactNode}
        <div data-testid="right">{props.asideRight as React.ReactNode}</div>
      </div>
    );
  },
}));

const { default: AppBuilderWorkspacePage } = await import('../../src/features/siteos/workspace/AppBuilderWorkspacePage');

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}{loc.search}</div>;
}

async function sample() {
  const { blueprint } = await buildSiteFromPrompt('Erstelle eine Website für einen Zahnarzt in Hamburg.', {
    locale: 'de', model: 'test-model', createdAt: '2026-09-06T00:00:00.000Z',
  });
  return { blueprint, sha256: await canonicalHash(blueprint) };
}

function storedRow(blueprint: SiteBlueprint, sha256: string, version = 1) {
  return {
    id: `bp-${version}`, version, blueprint, content_sha256: sha256, prev_hash: null,
    status: 'draft', origin_source: 'ai-builder', origin_model: 'test-model', created_at: '2026-09-06T00:00:00.000Z',
  };
}

function renderWorkspace(slug: string, search = '') {
  return render(
    <MemoryRouter initialEntries={[`/builder/${slug}${search}`]}>
      <Routes>
        <Route path="/builder/:slug" element={<AppBuilderWorkspacePage />} />
        <Route path="/welcome" element={<LocationProbe />} />
        <Route path="/unified-entry/transformation" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  previewFrame.mockReset();
  editorProps = null;
  authenticated = true;
  window.history.replaceState({}, '', '/builder/x');
  api.listBlueprintChain.mockResolvedValue([]);
  api.listEvaluations.mockResolvedValue([]);
  api.listCustodyEvents.mockResolvedValue([]);
  api.listAgentRuns.mockResolvedValue([]);
});

describe('App Builder Workspace — Laden', () => {
  it('lädt die jüngste Version des Slugs im eigenen Mandanten und setzt den Editor darauf', async () => {
    const { blueprint, sha256 } = await sample();
    api.loadLatestBlueprint.mockResolvedValue(storedRow(blueprint, sha256));
    renderWorkspace(blueprint.slug);
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());
    expect(api.loadLatestBlueprint).toHaveBeenCalledWith('tenant-1', blueprint.slug);
    expect(editorProps?.storedBlueprint).toBe(blueprint);
    expect(screen.getByTestId('save-state').getAttribute('data-state')).toBe('saved');
    expect(screen.getByText(`Gespeichert · v1`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Speichern$/ })).toBeDisabled();
    // Die Seitenliste kommt aus dem Blueprint, nicht aus einer festen Liste.
    const nav = within(screen.getByTestId('left'));
    for (const page of blueprint.pages) {
      expect(nav.getByRole('button', { name: new RegExp(page.path === '/' ? 'Startseite' : page.title) })).toBeInTheDocument();
    }
  });

  it('meldet ein fehlendes Projekt als NOT_FOUND statt eine leere Shell zu zeigen', async () => {
    api.loadLatestBlueprint.mockResolvedValue(null);
    renderWorkspace('gibt-es-nicht');
    await waitFor(() => expect(screen.getByText('Projekt nicht gefunden')).toBeInTheDocument());
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
    expect(api.editSite).not.toHaveBeenCalled();
  });

  it('schickt nicht angemeldete Nutzer nach /welcome mit Rücksprung', async () => {
    authenticated = false;
    renderWorkspace('praxis');
    await waitFor(() => expect(screen.getByTestId('location').textContent).toMatch(/^\/welcome\?next=/));
    expect(api.loadLatestBlueprint).not.toHaveBeenCalled();
  });
});

describe('App Builder Workspace — Speichern', () => {
  it('schickt beim Speichern nur die Bearbeitung mit base_sha256 und zeigt danach die neue Version', async () => {
    const { blueprint, sha256 } = await sample();
    api.loadLatestBlueprint.mockResolvedValue(storedRow(blueprint, sha256));
    api.editSite.mockResolvedValue({
      kind: 'ok',
      data: { ok: true, unchanged: false, blueprint_id: 'bp-2', slug: blueprint.slug, version: 2, content_sha256: 'b'.repeat(64), prev_hash: sha256, blueprint, findings: [], scores: {}, changes: [{ code: 'block.edited', path: '/', blockId: 'root--hero--1', kind: 'hero', summary: 'Hero bearbeitet.', complianceNote: null }], rejected: [] },
    });
    renderWorkspace(blueprint.slug);
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());

    fireEvent.click(screen.getByText('stub:edit-hero'));
    await waitFor(() => expect(screen.getByTestId('save-state').getAttribute('data-state')).toBe('unsaved'));
    // Prüfen ist gesperrt, solange die gespeicherte Version nicht die gezeigte ist.
    expect(screen.getByRole('button', { name: /Prüfen/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /^Speichern$/ }));
    await waitFor(() => expect(api.editSite).toHaveBeenCalledTimes(1));
    const call = api.editSite.mock.calls[0][0] as { tenant_id: string; slug: string; base_sha256: string; edits: { path: string; blocks: { kind: string; content?: Record<string, unknown> }[] }[] };
    expect(call).toMatchObject({ tenant_id: 'tenant-1', slug: blueprint.slug, base_sha256: sha256 });
    const hero = call.edits[0].blocks.find((b) => b.kind === 'hero')!;
    expect(hero.content).toEqual({ headline: 'Praxis Dr. Muster' });
    for (const block of call.edits[0].blocks) {
      expect(block).not.toHaveProperty('aiGenerated');
      expect(block).not.toHaveProperty('processesPersonalData');
    }

    await waitFor(() => expect(screen.getByText('Gespeichert · v2')).toBeInTheDocument());
    expect(screen.getByTestId('editor').getAttribute('data-revision')).toBe('2');
    // Nach dem Speichern verfällt eine frühere Gate-Bewertung; Prüfen ist wieder möglich.
    expect(screen.getByRole('button', { name: /Prüfen/ })).toBeEnabled();
  });

  it('zeigt einen Fehlschlag als Fehlschlag und behält die Bearbeitung', async () => {
    const { blueprint, sha256 } = await sample();
    api.loadLatestBlueprint.mockResolvedValue(storedRow(blueprint, sha256));
    api.editSite.mockResolvedValue({ kind: 'conflict', message: 'Der Entwurf wurde inzwischen an anderer Stelle geändert.' });
    renderWorkspace(blueprint.slug);
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());
    fireEvent.click(screen.getByText('stub:edit-hero'));
    await waitFor(() => expect(screen.getByTestId('save-state').getAttribute('data-state')).toBe('unsaved'));
    fireEvent.click(screen.getByRole('button', { name: /^Speichern$/ }));
    await waitFor(() => expect(screen.getByTestId('save-state').getAttribute('data-state')).toBe('failed'));
    expect(screen.getByText(/an anderer Stelle geändert/)).toBeInTheDocument();
    const local = editorProps?.localBlueprint as SiteBlueprint;
    expect(local.pages[0].blocks.find((b) => b.kind === 'hero')?.content.headline).toBe('Praxis Dr. Muster');
  });

  it('behauptet nichts, wenn der Server keine Version angelegt hat', async () => {
    const { blueprint, sha256 } = await sample();
    api.loadLatestBlueprint.mockResolvedValue(storedRow(blueprint, sha256));
    api.editSite.mockResolvedValue({ kind: 'ok', data: { ok: true, unchanged: true, slug: blueprint.slug, version: 1, content_sha256: sha256, blueprint, findings: [], scores: {}, changes: [], rejected: [] } });
    renderWorkspace(blueprint.slug);
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());
    fireEvent.click(screen.getByText('stub:edit-hero'));
    await waitFor(() => expect(screen.getByTestId('save-state').getAttribute('data-state')).toBe('unsaved'));
    fireEvent.click(screen.getByRole('button', { name: /^Speichern$/ }));
    await waitFor(() => expect(api.editSite).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('tab', { name: 'Konsole' }));
    await waitFor(() => expect(screen.getByText(/keine neue Version angelegt/)).toBeInTheDocument());
    expect(screen.queryByText('Gespeichert · v2')).not.toBeInTheDocument();
  });
});

describe('App Builder Workspace — Prüfung, Vorschau, Leisten', () => {
  it('listet die Befunde der statischen Analyse der lokalen Fassung — keine erfundenen', async () => {
    const { blueprint, sha256 } = await sample();
    api.loadLatestBlueprint.mockResolvedValue(storedRow(blueprint, sha256));
    renderWorkspace(blueprint.slug);
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());
    const expected = analyzeBlueprint(blueprint);
    const tab = screen.getByRole('tab', { name: expected.length > 0 ? `Probleme (${expected.length})` : 'Probleme' });
    fireEvent.click(tab);
    for (const finding of expected.slice(0, 3)) {
      expect(screen.getAllByText(finding.code, { exact: false }).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/Noch keine Bewertung/)).toBeInTheDocument();
  });

  it('bewertet auf „Prüfen" die gespeicherte Version über das Publish Gate und zeigt das Ergebnis unverändert', async () => {
    const { blueprint, sha256 } = await sample();
    api.loadLatestBlueprint.mockResolvedValue(storedRow(blueprint, sha256));
    api.evaluatePublish.mockResolvedValue({ kind: 'ok', data: { ok: true, evaluation: {
      status: 'blocked', evidence_complete: true, backend_preservation: 'preserve_all', policy_compliant: false,
      human_approval_required: false, publishable: false, evaluated_at: '2026-09-07T10:00:00.000Z', evaluation_id: 'eval-1234-abcd',
      artifact_sha256: 'c'.repeat(64), blockers: ['Impressum fehlt.'], warnings: [],
    } } });
    renderWorkspace(blueprint.slug);
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Prüfen/ }));
    await waitFor(() => expect(api.evaluatePublish).toHaveBeenCalledWith({ tenant_id: 'tenant-1', blueprint_id: 'bp-1', base_url: undefined }));
    await waitFor(() => expect(screen.getByText('Impressum fehlt.')).toBeInTheDocument());
    expect(screen.getByText(/Nicht veröffentlichbar \(blocked\)/)).toBeInTheDocument();
  });

  it('hält den Veröffentlichen-Knopf gesperrt und sagt warum', async () => {
    const { blueprint, sha256 } = await sample();
    api.loadLatestBlueprint.mockResolvedValue(storedRow(blueprint, sha256));
    renderWorkspace(blueprint.slug);
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());
    const publish = screen.getByRole('button', { name: /Veröffentlichen/ });
    expect(publish).toBeDisabled();
    expect(publish.getAttribute('title')).toMatch(/nicht verdrahtet/);
  });

  it('zeigt in der Vorschau das echte Dokument der lokalen Fassung', async () => {
    const { blueprint, sha256 } = await sample();
    api.loadLatestBlueprint.mockResolvedValue(storedRow(blueprint, sha256));
    renderWorkspace(blueprint.slug);
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());
    fireEvent.click(screen.getByText('stub:edit-hero'));
    fireEvent.click(screen.getAllByRole('button', { name: /Vorschau/ })[0]);
    await waitFor(() => expect(previewFrame).toHaveBeenCalled());
    const html = previewFrame.mock.calls.at(-1)?.[0].html as string;
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Praxis Dr. Muster');
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
  });

  it('bietet unterhalb von lg eine Bereichswahl und reicht sie an den Editor durch', async () => {
    const { blueprint, sha256 } = await sample();
    api.loadLatestBlueprint.mockResolvedValue(storedRow(blueprint, sha256));
    renderWorkspace(blueprint.slug);
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());
    const tabs = screen.getByRole('tablist', { name: 'Bereich' });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Projekt', 'Editor', 'Assistent', 'Prüfung']);
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Assistent' }));
    await waitFor(() => expect(screen.getByTestId('editor').getAttribute('data-pane')).toBe('right'));
  });

  it('führt den KI-Neubau über den Erstbau — mit Quelle und Anweisung, ohne LLM-Anbindung hier', async () => {
    const { blueprint, sha256 } = await sample();
    api.loadLatestBlueprint.mockResolvedValue(storedRow(blueprint, sha256));
    renderWorkspace(blueprint.slug, '?source=https%3A%2F%2Fihre-firma.de%2F');
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Anweisung an die KI'), { target: { value: 'Hero hochwertiger' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mit KI neu bauen' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/unified-entry/transformation?url=https%3A%2F%2Fihre-firma.de%2F&instruction=Hero%20hochwertiger'));
  });

  it('sperrt den KI-Neubau ohne bekannte Quelle, statt eine zu raten', async () => {
    const { blueprint, sha256 } = await sample();
    api.loadLatestBlueprint.mockResolvedValue(storedRow(blueprint, sha256));
    renderWorkspace(blueprint.slug);
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());
    expect(screen.getByLabelText('Anweisung an die KI')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mit KI neu bauen' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Website fertig umsetzen/ })).not.toBeInTheDocument();
  });
});
