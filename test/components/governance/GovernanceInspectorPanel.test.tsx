/**
 * Unit-Tests für GovernanceInspectorPanel.
 *
 * Abgedeckte Szenarien:
 *   Shell (Drawer)  — Sichtbarkeit, Backdrop, ESC, X-Button
 *   Event-Inspector — Titel, Risiko, Summary, Metadata, Payload-Toggle, Evidence, Copy-ID
 *   Asset-Inspector — Name, Score, verknüpfte Ereignisse, Wechsel zu Event, Archivieren
 *   Policy-Inspector — Name, Severity, Status-Toggle, Condition-Toggle
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  GovernanceInspectorPanel,
  type InspectorSelection,
} from '../../../src/features/governance/GovernanceInspectorPanel';
import type {
  DbGovernanceEvent,
  DbGovernanceAsset,
  DbGovernancePolicy,
  DbGovernanceEvidence,
} from '../../../src/features/governance/governanceApi';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/features/governance/governanceApi', () => ({
  fetchEvidenceForEvent: vi.fn().mockResolvedValue([]),
  fetchEventsForAsset:   vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../src/features/governance/resourcesApi', () => ({
  archiveAsset:  vi.fn().mockResolvedValue(undefined),
  togglePolicy:  vi.fn().mockResolvedValue(undefined),
}));

import {
  fetchEvidenceForEvent,
  fetchEventsForAsset,
} from '../../../src/features/governance/governanceApi';
import { archiveAsset, togglePolicy } from '../../../src/features/governance/resourcesApi';

// ---------------------------------------------------------------------------
// Clipboard mock
// ---------------------------------------------------------------------------

const mockWriteText = vi.fn().mockResolvedValue(undefined);

beforeAll(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value:        { writeText: mockWriteText },
    configurable: true,
    writable:     true,
  });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildEvent(overrides: Partial<DbGovernanceEvent> = {}): DbGovernanceEvent {
  return {
    id:            'evt-test-1',
    tenant_id:     'tenant-1',
    asset_id:      null,
    policy_id:     null,
    event_type:    'data_transfer',
    event_source:  'sdk',
    title:         'Test-Ereignis',
    summary:       null,
    risk_level:    'medium',
    actor_email:   null,
    vendor:        null,
    model_name:    null,
    data_types:    [],
    policy_action: null,
    payload:       {},
    created_at:    '2026-06-05T10:00:00Z',
    ...overrides,
  };
}

function buildAsset(overrides: Partial<DbGovernanceAsset> = {}): DbGovernanceAsset {
  return {
    id:          'ast-test-1',
    tenant_id:   'tenant-1',
    asset_type:  'ai_system',
    name:        'Test-Asset',
    description: null,
    owner_email: null,
    vendor:      null,
    system_url:  null,
    data_types:  [],
    risk_score:  45,
    ai_act_class:'limited',
    status:      'active',
    metadata:    {},
    created_at:  '2026-06-01T08:00:00Z',
    updated_at:  '2026-06-05T10:00:00Z',
    ...overrides,
  };
}

function buildPolicy(overrides: Partial<DbGovernancePolicy> = {}): DbGovernancePolicy {
  return {
    id:          'pol-test-1',
    tenant_id:   'tenant-1',
    name:        'Test-Policy',
    description: null,
    policy_type: 'model_usage',
    severity:    'medium',
    action:      'warn',
    condition:   {},
    enabled:     true,
    created_at:  '2026-06-01T08:00:00Z',
    updated_at:  '2026-06-05T10:00:00Z',
    ...overrides,
  };
}

function buildEvidence(overrides: Partial<DbGovernanceEvidence> = {}): DbGovernanceEvidence {
  return {
    id:            'evi-test-1',
    tenant_id:     'tenant-1',
    event_id:      'evt-test-1',
    asset_id:      null,
    evidence_type: 'json',
    title:         'Nachweis-Dokument',
    storage_path:  null,
    content_hash:  'abc123def456',
    previous_hash: null,
    metadata:      {},
    created_at:    '2026-06-05T10:01:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Render-Hilfsfunktion
// ---------------------------------------------------------------------------

type Callbacks = {
  onClose?:  ReturnType<typeof vi.fn>;
  onChange?: ReturnType<typeof vi.fn>;
  onSelect?: ReturnType<typeof vi.fn>;
};

function renderPanel(selection: InspectorSelection | null, cbs: Callbacks = {}) {
  const onClose  = cbs.onClose  ?? vi.fn();
  const onChange = cbs.onChange ?? vi.fn();
  const onSelect = cbs.onSelect ?? vi.fn();

  const result = render(
    <MemoryRouter>
      <GovernanceInspectorPanel
        selection={selection}
        onClose={onClose as () => void}
        onChange={onChange as () => void}
        onSelect={onSelect as (s: InspectorSelection) => void}
      />
    </MemoryRouter>,
  );

  return { ...result, onClose, onChange, onSelect };
}

// ---------------------------------------------------------------------------
// 1 — Shell: Sichtbarkeit und Animationsklassen
// ---------------------------------------------------------------------------

describe('GovernanceInspectorPanel — Shell', () => {
  beforeEach(() => {
    vi.mocked(fetchEvidenceForEvent).mockResolvedValue([]);
    vi.mocked(fetchEventsForAsset).mockResolvedValue([]);
  });

  it('01 — Panel ist per translate-x-full verborgen wenn selection null', () => {
    renderPanel(null);
    const panel = screen.getByTestId('inspector-panel');
    expect(panel.className).toContain('translate-x-full');
    expect(panel.className).not.toContain('translate-x-0');
  });

  it('02 — Panel ist sichtbar (translate-x-0) wenn selection gesetzt', async () => {
    await act(async () => { renderPanel({ type: 'event', item: buildEvent() }); });
    const panel = screen.getByTestId('inspector-panel');
    expect(panel.className).toContain('translate-x-0');
    expect(panel.className).not.toContain('translate-x-full');
  });

  it('03 — Backdrop erscheint nur wenn Panel offen ist', async () => {
    const { rerender } = renderPanel(null);
    expect(screen.queryByTestId('inspector-backdrop')).not.toBeInTheDocument();

    await act(async () => {
      rerender(
        <MemoryRouter>
          <GovernanceInspectorPanel
            selection={{ type: 'event', item: buildEvent() }}
            onClose={vi.fn()} onChange={vi.fn()} onSelect={vi.fn()}
          />
        </MemoryRouter>,
      );
    });
    expect(screen.getByTestId('inspector-backdrop')).toBeInTheDocument();
  });

  it('04 — X-Button ruft onClose auf', async () => {
    const { onClose } = renderPanel({ type: 'event', item: buildEvent() });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /inspector schließen/i })); });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('05 — ESC-Taste ruft onClose auf wenn Panel offen', async () => {
    const { onClose } = renderPanel({ type: 'event', item: buildEvent() });
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }); });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('06 — ESC hat keinen Effekt wenn Panel geschlossen', () => {
    const { onClose } = renderPanel(null);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('07 — Backdrop-Klick ruft onClose auf', async () => {
    const { onClose } = renderPanel({ type: 'event', item: buildEvent() });
    await act(async () => { fireEvent.click(screen.getByTestId('inspector-backdrop')); });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('08 — Header-Label zeigt korrekten Typ je nach Selection', () => {
    const { rerender } = renderPanel({ type: 'event', item: buildEvent() });
    expect(screen.getByText(/ereignis · inspector/i)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <GovernanceInspectorPanel
          selection={{ type: 'asset', item: buildAsset() }}
          onClose={vi.fn()} onChange={vi.fn()} onSelect={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/asset · inspector/i)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <GovernanceInspectorPanel
          selection={{ type: 'policy', item: buildPolicy() }}
          onClose={vi.fn()} onChange={vi.fn()} onSelect={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/policy · inspector/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2 — Event-Inspector
// ---------------------------------------------------------------------------

describe('GovernanceInspectorPanel — Event-Inspector', () => {
  beforeEach(() => {
    vi.mocked(fetchEvidenceForEvent).mockResolvedValue([]);
    vi.mocked(fetchEventsForAsset).mockResolvedValue([]);
    mockWriteText.mockClear();
  });

  it('09 — zeigt Ereignis-Titel in der h2-Überschrift', async () => {
    renderPanel({ type: 'event', item: buildEvent({ title: 'GDPR-Verstoß erkannt' }) });
    expect(await screen.findByRole('heading', { name: /GDPR-Verstoß erkannt/i })).toBeInTheDocument();
  });

  it('10 — zeigt Risikostufe als Badge', async () => {
    renderPanel({ type: 'event', item: buildEvent({ risk_level: 'high' }) });
    await screen.findByRole('heading');
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('11 — zeigt Zusammenfassung wenn vorhanden', async () => {
    renderPanel({
      type: 'event',
      item: buildEvent({ summary: 'Personenbezogene Daten wurden weitergeleitet.' }),
    });
    expect(await screen.findByText(/personenbezogene daten/i)).toBeInTheDocument();
  });

  it('12 — zeigt Event-Typ und Event-Quelle in Metadaten', async () => {
    renderPanel({
      type: 'event',
      item: buildEvent({ event_type: 'model_call', event_source: 'agent_runtime' }),
    });
    await screen.findByRole('heading');
    expect(screen.getByText('model_call')).toBeInTheDocument();
    expect(screen.getByText('agent_runtime')).toBeInTheDocument();
  });

  it('13 — Payload-Toggle blendet JSON ein und aus', async () => {
    const event = buildEvent({ payload: { secretKey: 'secretValue' } });
    renderPanel({ type: 'event', item: event });
    await screen.findByRole('heading');

    // Payload initial versteckt
    expect(screen.queryByTestId('payload-json')).not.toBeInTheDocument();

    // Klick auf "Anzeigen"
    fireEvent.click(screen.getByTestId('payload-toggle'));
    expect(screen.getByTestId('payload-json')).toBeInTheDocument();
    expect(screen.getByTestId('payload-json').textContent).toContain('secretKey');

    // Klick auf "Ausblenden"
    fireEvent.click(screen.getByTestId('payload-toggle'));
    expect(screen.queryByTestId('payload-json')).not.toBeInTheDocument();
  });

  it('14 — lädt Evidence und zeigt Einträge', async () => {
    vi.mocked(fetchEvidenceForEvent).mockResolvedValueOnce([
      buildEvidence({ title: 'Einwilligungs-Nachweis', evidence_type: 'json' }),
    ]);
    renderPanel({ type: 'event', item: buildEvent() });
    expect(await screen.findByText('Einwilligungs-Nachweis')).toBeInTheDocument();
    expect(screen.getByText('json')).toBeInTheDocument();
  });

  it('15 — Copy-Button kopiert Ereignis-ID in die Zwischenablage', async () => {
    const event = buildEvent({ id: 'evt-copy-target-id' });
    renderPanel({ type: 'event', item: event });
    await screen.findByRole('heading');

    fireEvent.click(screen.getByRole('button', { name: /ereignis-id kopieren/i }));
    expect(mockWriteText).toHaveBeenCalledWith('evt-copy-target-id');
  });
});

// ---------------------------------------------------------------------------
// 3 — Asset-Inspector
// ---------------------------------------------------------------------------

describe('GovernanceInspectorPanel — Asset-Inspector', () => {
  beforeEach(() => {
    vi.mocked(fetchEvidenceForEvent).mockResolvedValue([]);
    vi.mocked(fetchEventsForAsset).mockResolvedValue([]);
    vi.mocked(archiveAsset).mockResolvedValue(undefined);
    mockWriteText.mockClear();
  });

  it('16 — zeigt Asset-Name in der h2-Überschrift', async () => {
    renderPanel({ type: 'asset', item: buildAsset({ name: 'Mein KI-System' }) });
    expect(await screen.findByRole('heading', { name: /mein ki-system/i })).toBeInTheDocument();
  });

  it('17 — zeigt Risk-Score-Badge', async () => {
    renderPanel({ type: 'asset', item: buildAsset({ risk_score: 72 }) });
    await screen.findByRole('heading');
    expect(screen.getByText('72/100')).toBeInTheDocument();
  });

  it('18 — lädt und zeigt verknüpfte Ereignisse', async () => {
    vi.mocked(fetchEventsForAsset).mockResolvedValueOnce([
      buildEvent({ title: 'Verknüpftes Ereignis Alpha' }),
    ]);
    renderPanel({ type: 'asset', item: buildAsset() });
    expect(await screen.findByText('Verknüpftes Ereignis Alpha')).toBeInTheDocument();
  });

  it('19 — Klick auf verknüpftes Ereignis ruft onSelect auf', async () => {
    const linkedEvent = buildEvent({ id: 'evt-linked', title: 'Link-Ereignis' });
    vi.mocked(fetchEventsForAsset).mockResolvedValueOnce([linkedEvent]);
    const { onSelect } = renderPanel({ type: 'asset', item: buildAsset() });

    const btn = await screen.findByTestId('linked-event-btn');
    fireEvent.click(btn);

    expect(onSelect).toHaveBeenCalledWith({ type: 'event', item: linkedEvent });
  });

  it('20 — Archivieren-Button ruft archiveAsset auf nach Bestätigung', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const asset = buildAsset({ id: 'ast-archive-me', status: 'active' });
    renderPanel({ type: 'asset', item: asset });
    await screen.findByRole('heading');

    fireEvent.click(screen.getByRole('button', { name: /asset archivieren/i }));

    await waitFor(() => {
      expect(vi.mocked(archiveAsset)).toHaveBeenCalledWith('ast-archive-me');
    });

    vi.restoreAllMocks();
  });

  it('21 — Copy-Button kopiert Asset-ID in die Zwischenablage', async () => {
    const asset = buildAsset({ id: 'ast-copy-target-id' });
    renderPanel({ type: 'asset', item: asset });
    await screen.findByRole('heading');

    fireEvent.click(screen.getByRole('button', { name: /asset-id kopieren/i }));
    expect(mockWriteText).toHaveBeenCalledWith('ast-copy-target-id');
  });
});

// ---------------------------------------------------------------------------
// 4 — Policy-Inspector
// ---------------------------------------------------------------------------

describe('GovernanceInspectorPanel — Policy-Inspector', () => {
  beforeEach(() => {
    vi.mocked(fetchEvidenceForEvent).mockResolvedValue([]);
    vi.mocked(fetchEventsForAsset).mockResolvedValue([]);
    vi.mocked(togglePolicy).mockResolvedValue(undefined);
  });

  it('22 — zeigt Policy-Name in der h2-Überschrift', async () => {
    renderPanel({ type: 'policy', item: buildPolicy({ name: 'Meine Datentransfer-Policy' }) });
    expect(await screen.findByRole('heading', { name: /meine datentransfer-policy/i })).toBeInTheDocument();
  });

  it('23 — zeigt Severity-Badge', async () => {
    renderPanel({ type: 'policy', item: buildPolicy({ severity: 'critical' }) });
    await screen.findByRole('heading');
    // Severity erscheint sowohl als Badge als auch im Metadaten-Grid
    const badges = screen.getAllByText('critical');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('24 — zeigt aktiven Status-Indikator', async () => {
    renderPanel({ type: 'policy', item: buildPolicy({ enabled: true }) });
    await screen.findByRole('heading');
    expect(screen.getByText(/● Aktiv/)).toBeInTheDocument();
  });

  it('25 — zeigt pausierten Status-Indikator', async () => {
    renderPanel({ type: 'policy', item: buildPolicy({ enabled: false }) });
    await screen.findByRole('heading');
    expect(screen.getByText(/○ Pausiert/)).toBeInTheDocument();
  });

  it('26 — Toggle-Button ruft togglePolicy mit invertiertem Status auf (aktiv → pausiert)', async () => {
    const policy = buildPolicy({ id: 'pol-toggle-1', enabled: true });
    renderPanel({ type: 'policy', item: policy });
    await screen.findByRole('heading');

    fireEvent.click(screen.getByTestId('policy-toggle-btn'));

    await waitFor(() => {
      expect(vi.mocked(togglePolicy)).toHaveBeenCalledWith('pol-toggle-1', false);
    });
  });

  it('27 — Toggle-Button ruft togglePolicy mit invertiertem Status auf (pausiert → aktiv)', async () => {
    const policy = buildPolicy({ id: 'pol-toggle-2', enabled: false });
    renderPanel({ type: 'policy', item: policy });
    await screen.findByRole('heading');

    fireEvent.click(screen.getByTestId('policy-toggle-btn'));

    await waitFor(() => {
      expect(vi.mocked(togglePolicy)).toHaveBeenCalledWith('pol-toggle-2', true);
    });
  });

  it('28 — Condition-Toggle blendet JSON ein und aus', async () => {
    const policy = buildPolicy({ condition: { field: 'model', operator: 'eq', value: 'gpt-4' } });
    renderPanel({ type: 'policy', item: policy });
    await screen.findByRole('heading');

    expect(screen.queryByTestId('condition-json')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('condition-toggle'));
    expect(screen.getByTestId('condition-json')).toBeInTheDocument();
    expect(screen.getByTestId('condition-json').textContent).toContain('gpt-4');

    fireEvent.click(screen.getByTestId('condition-toggle'));
    expect(screen.queryByTestId('condition-json')).not.toBeInTheDocument();
  });
});
