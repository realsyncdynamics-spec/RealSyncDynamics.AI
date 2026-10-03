import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { buildDeploymentArtifact, canonicalHash, compareBackend, planNextSteps, type SiteBlueprint } from '../../packages/siteos-core/src/index';
import { rebuildCase } from './rebuild-helpers';

/**
 * Workspace-Panels des Rebuild-Workflows: Überarbeiten (REFINE),
 * Veröffentlichen (PUBLISH) und nächste Schritte (AUTOMATE/GOVERN).
 *
 * Geprüft wird, was die Oberfläche schickt (nur Absichten auf den
 * gespeicherten Stand), und dass sie ehrlich zeigt, was der Server
 * festgestellt hat — keine Verbindung, die er nicht kennt, kein GO ohne
 * bestandene Bewertung, kein Verzicht ohne Begründung.
 */

const api = { rebuildStatus: vi.fn(), refineRebuild: vi.fn(), waiveBackend: vi.fn(), exportPublish: vi.fn() };
vi.mock('../../src/features/siteos/rebuild/rebuildApi', () => ({
  rebuildStatus: (...a: unknown[]) => api.rebuildStatus(...a),
  refineRebuild: (...a: unknown[]) => api.refineRebuild(...a),
  waiveBackend: (...a: unknown[]) => api.waiveBackend(...a),
  exportPublish: (...a: unknown[]) => api.exportPublish(...a),
}));
vi.mock('../../src/features/siteos/siteOsApi', () => ({
  evaluatePublish: vi.fn(),
  approvePublish: vi.fn(),
  errorMessage: (e: { message?: string }) => e.message ?? 'Fehler',
}));

const { RefinePanel, PublishPanel, NextStepsPanel } = await import('../../src/features/siteos/rebuild/WorkspaceRebuildPanels');

async function storedImport() {
  const { builds } = await rebuildCase('handwerk');
  const blueprint = builds[0].blueprint;
  const sha = await canonicalHash(blueprint);
  return {
    blueprint,
    sha,
    row: { id: 'bp-1', version: 1, blueprint, content_sha256: sha, prev_hash: null, status: 'draft' as const, origin_source: 'import' as const, origin_model: null, created_at: '2026-09-29T10:00:00.000Z' },
  };
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
});

describe('Überarbeiten (REFINE)', () => {
  it('schickt die gewählten Regeln auf den gespeicherten Stand und zeigt jede Änderung', async () => {
    const { row, sha, blueprint } = await storedImport();
    const onRevised = vi.fn();
    api.refineRebuild.mockResolvedValue({
      kind: 'ok',
      data: {
        ok: true, understood: true, unchanged: false, blueprint_id: 'bp-2', version: 2, content_sha256: 'b'.repeat(64), blueprint,
        intents: ['cta-staerker'], changes: [{ code: 'intent.cta.band', summary: 'Aufforderungsband nach dem Angebot ergänzt.', complianceNote: null }],
        notes: [], refusals: [],
      },
    });
    render(<RefinePanel tenantId="tenant-1" stored={row} dirty={false} onRevised={onRevised} log={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'CTA stärker' }));
    expect(screen.getByRole('button', { name: 'CTA stärker' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Anwenden/ }));
    await waitFor(() => expect(api.refineRebuild).toHaveBeenCalledWith({
      tenant_id: 'tenant-1', slug: blueprint.slug, base_sha256: sha, intents: ['cta-staerker'], instruction: undefined,
    }));
    expect(await screen.findByText('Aufforderungsband nach dem Angebot ergänzt.')).toBeInTheDocument();
    // Die neue Zeile geht mit — Bewertung und Export beziehen sich auf sie.
    expect(onRevised).toHaveBeenCalledWith({ blueprint_id: 'bp-2', version: 2, content_sha256: 'b'.repeat(64), blueprint });
  });

  it('sagt „nicht verstanden", statt eine unveränderte Seite als Ergebnis zu zeigen', async () => {
    const { row } = await storedImport();
    api.refineRebuild.mockResolvedValue({ kind: 'ok', data: { ok: true, understood: false, changes: [], notes: [], refusals: [] } });
    const onRevised = vi.fn();
    render(<RefinePanel tenantId="tenant-1" stored={row} dirty={false} onRevised={onRevised} log={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Oder in eigenen Worten'), { target: { value: 'Mach irgendwas Schönes' } });
    fireEvent.click(screen.getByRole('button', { name: /Anwenden/ }));
    expect(await screen.findByText(/Nicht verstanden — nichts geändert/)).toBeInTheDocument();
    expect(onRevised).not.toHaveBeenCalled();
  });

  it('überarbeitet keine ungespeicherte Fassung', async () => {
    const { row } = await storedImport();
    render(<RefinePanel tenantId="tenant-1" stored={row} dirty onRevised={() => undefined} log={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Seriöser' }));
    expect(screen.getByRole('button', { name: /Anwenden/ })).toBeDisabled();
    expect(screen.getByText(/Erst speichern/)).toBeInTheDocument();
  });
});

describe('Veröffentlichen (PUBLISH)', () => {
  async function status(overrides: Record<string, unknown> = {}) {
    const { snapshot } = await rebuildCase('handwerk');
    const { blueprint, sha } = await storedImport();
    return {
      ok: true, blueprint_id: 'bp-1', version: 1, content_sha256: sha, origin_source: 'import', run_id: 'run-1', base_url: null,
      artifact: { sha256: 'c'.repeat(64), total_bytes: 1000, files: [] },
      backend: compareBackend(snapshot, blueprint as SiteBlueprint),
      checklist: { items: [{ key: 'form.target', group: 'formular', title: 'Formularziel', status: 'blocker', detail: 'Ohne Ziel.' }], blockers: 1, todos: 0 },
      next_steps: [],
      evaluation: null,
      ...overrides,
    };
  }

  function statusHook(data: unknown) {
    return { status: data as never, loading: false, error: '', reload: vi.fn() };
  }

  it('verlangt für einen Verzicht eine Begründung und schickt sie mit dem Lauf', async () => {
    const { row } = await storedImport();
    const data = await status();
    api.waiveBackend.mockResolvedValue({ kind: 'ok', data: { ok: true, waivers: [], backend: data.backend } });
    render(
      <MemoryRouter>
        <PublishPanel tenantId="tenant-1" stored={row} dirty={false} runId="11111111-2222-4333-8444-555555555555" baseUrl="" onBaseUrl={() => undefined} status={statusHook(data)} log={() => undefined} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Bewusst verzichten …' })[0]);
    const submit = screen.getByRole('button', { name: 'Verzicht belegen' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Begründung \(wird mit Ihrem Namen belegt\)/), { target: { value: 'Anfragen laufen künftig nur telefonisch.' } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(api.waiveBackend).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant-1', run_id: '11111111-2222-4333-8444-555555555555', reason: 'Anfragen laufen künftig nur telefonisch.', revoke: false,
    })));
  });

  it('sperrt das GO bei sperrenden Punkten der Checkliste — auch mit bestandener Bewertung', async () => {
    const { row } = await storedImport();
    const data = await status({ evaluation: { id: 'ev-1', status: 'passed', publishable: true, blockers: [], warnings: [], artifact_sha256: 'c'.repeat(64), human_approval_required: false, evaluated_at: '2026-09-29T10:00:00.000Z', approved_by: null, current: true } });
    render(
      <MemoryRouter>
        <PublishPanel tenantId="tenant-1" stored={row} dirty={false} runId={null} baseUrl="" onBaseUrl={() => undefined} status={statusHook(data)} log={() => undefined} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText(/Vorschau auf Desktop und Mobil geprüft/));
    expect(screen.getByRole('button', { name: /GO — veröffentlichen und exportieren/ })).toBeDisabled();
    expect(screen.getByText('Die Checkliste hat sperrende Punkte.')).toBeInTheDocument();
  });

  async function readyToGo() {
    const { row, blueprint } = await storedImport();
    const artifact = await buildDeploymentArtifact(blueprint as SiteBlueprint, { presentation: 'showcase' });
    const data = await status({
      // Die Zeile des Servers (derselbe Stand) — nicht eine veraltete lokale.
      blueprint_id: 'bp-server',
      checklist: { items: [], blockers: 0, todos: 0 },
      evaluation: { id: 'ev-1', status: 'passed', publishable: true, blockers: [], warnings: [], artifact_sha256: artifact.artifactSha256, human_approval_required: false, evaluated_at: '2026-09-29T10:00:00.000Z', approved_by: null, current: true },
    });
    const manifest = {
      format: 'realsync-siteos-export/1', slug: blueprint.slug, version: 1, blueprint_sha256: artifact.blueprintSha256, artifact_sha256: artifact.artifactSha256,
      evaluation_id: 'ev-2', evidence_id: 'evid-1', base_url: null, go_by: 'u-1', go_at: '2026-09-29T10:05:00.000Z',
      files: artifact.files.map((f) => ({ path: f.path, sha256: f.sha256, bytes: f.bytes })),
    };
    const files = artifact.files.map((f) => ({ path: f.path, content: f.content, sha256: f.sha256, bytes: f.bytes }));
    return { row, data, manifest, files };
  }

  it('prüft das empfangene Bündel vor dem ZIP — ein veränderter Inhalt wird nicht exportiert', async () => {
    const { row, data, manifest, files } = await readyToGo();
    const tampered = files.map((f, i) => (i === 0 ? { ...f, content: `${f.content}<script>alert(1)</script>` } : f));
    api.exportPublish.mockResolvedValue({ kind: 'ok', data: { ok: true, manifest, files: tampered } });
    const createObjectURL = vi.fn(() => 'blob:zip');
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    render(
      <MemoryRouter>
        <PublishPanel tenantId="tenant-1" stored={row} dirty={false} runId="run-1" baseUrl="" onBaseUrl={() => undefined} status={statusHook(data)} log={() => undefined} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText(/Vorschau auf Desktop und Mobil geprüft/));
    fireEvent.click(screen.getByRole('button', { name: /GO — veröffentlichen und exportieren/ }));
    expect(await screen.findByText(/stimmt nicht mit dem geprüften überein/)).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
    // GO auf die Zeile des Servers, nicht auf eine veraltete lokale Kennung.
    expect(api.exportPublish).toHaveBeenCalledWith(expect.objectContaining({ blueprint_id: 'bp-server', confirm_go: true, confirm_preview: true }));
  });

  it('exportiert ein unverändertes Bündel', async () => {
    const { row, data, manifest, files } = await readyToGo();
    api.exportPublish.mockResolvedValue({ kind: 'ok', data: { ok: true, manifest, files } });
    const createObjectURL = vi.fn(() => 'blob:zip');
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    render(
      <MemoryRouter>
        <PublishPanel tenantId="tenant-1" stored={row} dirty={false} runId="run-1" baseUrl="" onBaseUrl={() => undefined} status={statusHook(data)} log={() => undefined} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText(/Vorschau auf Desktop und Mobil geprüft/));
    fireEvent.click(screen.getByRole('button', { name: /GO — veröffentlichen und exportieren/ }));
    expect(await screen.findByText(`${manifest.slug}-v1.zip exportiert.`)).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('nennt eine fehlende Bindung an die Analyse, statt einen leeren Vergleich zu zeigen', async () => {
    const { row } = await storedImport();
    const data = await status({ backend: null, run_id: null, binding_problem: 'Diese Site wurde ohne Rebuild-Analyse übernommen — es gibt keinen Vergleich mit der Ausgangsseite.' });
    render(
      <MemoryRouter>
        <PublishPanel tenantId="tenant-1" stored={row} dirty={false} runId={null} baseUrl="" onBaseUrl={() => undefined} status={statusHook(data)} log={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/ohne Rebuild-Analyse übernommen/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bewusst verzichten …' })).not.toBeInTheDocument();
  });
});

describe('Nächste Schritte (AUTOMATE / GOVERN)', () => {
  it('zeigt den Verbindungsstand der Registratur und die Freigabepflicht', async () => {
    const { snapshot, builds } = await rebuildCase('steuer');
    const steps = planNextSteps({ blueprint: builds[0].blueprint, snapshot, connectors: [{ systemType: 'crm', status: 'connected', displayName: 'HubSpot' }] });
    render(
      <MemoryRouter>
        <NextStepsPanel status={{ status: { next_steps: steps } as never, loading: false, error: '', reload: vi.fn() }} />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('Freigabe erforderlich')).toHaveLength(steps.length);
    expect(screen.getAllByText('verbunden: HubSpot').length).toBeGreaterThan(0);
    expect(screen.getAllByText('nicht verbunden').length).toBeGreaterThan(0);
    expect(screen.getByText(/Hier wird nichts automatisch eingerichtet/)).toBeInTheDocument();
  });
});
