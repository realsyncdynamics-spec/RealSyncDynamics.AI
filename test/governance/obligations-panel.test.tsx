/**
 * „Ihre Pflichten heute" im Command Center.
 *
 * Zwei Dinge müssen halten:
 *   1. Jede Pflicht entsteht nur aus einer Angabe des Mandanten. Ohne Angabe
 *      keine Pflicht, und „keine KI" ergibt eine leere Liste.
 *   2. „Quelle nicht lesbar" darf nie wie „keine Angaben" aussehen. Sonst
 *      bekäme ein Mandant mit gespeichertem Setup die Schnellauswahl und
 *      könnte sein Setup überschreiben.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  notify: vi.fn(),
  signals: vi.fn(),
  progress: vi.fn(),
  setDone: vi.fn(),
}));

vi.mock('../../src/features/governance/dashboard/obligationProgress', async (orig) => {
  const actual = await orig<typeof import('../../src/features/governance/dashboard/obligationProgress')>();
  return {
    ...actual,
    loadObligationSignals: mocks.signals,
    loadObligationProgress: mocks.progress,
    setObligationDone: mocks.setDone,
  };
});

vi.mock('../../src/features/activation/activationApi', async (orig) => {
  const actual = await orig<typeof import('../../src/features/activation/activationApi')>();
  return {
    ...actual,
    loadGovernanceActivation: mocks.load,
    saveGovernanceActivation: mocks.save,
  };
});

vi.mock('../../src/features/governance/tenantDataEvents', () => ({
  notifyTenantDataChanged: mocks.notify,
}));

import {
  countByKind,
  deriveObligations,
  joinLabels,
} from '../../src/features/governance/dashboard/obligationsFromSetup';
import { ObligationsPanel } from '../../src/features/governance/dashboard/ObligationsPanel';
import { createEmptyAiSetup } from '../../src/features/activation/aiSetupCatalog';
import {
  obligationStatus,
  type ObligationSignals,
} from '../../src/features/governance/dashboard/obligationProgress';

const ids = (list: { id: string }[]) => list.map((o) => o.id);

const SIGNALS_EMPTY: ObligationSignals = {
  aiSystems: { ok: true, value: 0 },
  vendors: { ok: true, value: [] },
  dpias: { ok: true, value: { total: 0, open: 0 } },
};


describe('deriveObligations', () => {
  it('ohne Angaben oder mit „keine KI" gibt es keine Pflicht', () => {
    expect(deriveObligations({ aiSystems: [], botsAgents: [], dataClasses: [] })).toEqual([]);
    expect(
      deriveObligations({ aiSystems: ['none'], botsAgents: ['none'], dataClasses: ['customer'] }),
    ).toEqual([]);
  });

  it('jeder KI-Einsatz löst KI-Kompetenz und Inventar aus, sonst nichts', () => {
    const list = deriveObligations({ aiSystems: ['local'], botsAgents: [], dataClasses: [] });
    expect(ids(list)).toEqual(['ai_literacy', 'ai_inventory']);
    expect(list[0].basis).toBe('Art. 4 KI-VO');
  });

  it('Cloud-Anbieter mit Personendaten → AVV/Drittland und VVT, Auslöser genannt', () => {
    const list = deriveObligations({
      aiSystems: ['openai'], botsAgents: [], dataClasses: ['customer'],
    });
    expect(ids(list)).toEqual(['ai_literacy', 'ai_inventory', 'processor_contract', 'records_of_processing']);
    const avv = list.find((o) => o.id === 'processor_contract')!;
    expect(avv.because).toContain('OpenAI');
    expect(avv.because).toContain('Kundendaten');
  });

  it('lokales Modell mit Personendaten → VVT, aber kein AVV', () => {
    const list = deriveObligations({ aiSystems: ['local'], botsAgents: [], dataClasses: ['crm'] });
    expect(ids(list)).toContain('records_of_processing');
    expect(ids(list)).not.toContain('processor_contract');
  });

  it('Website-Chat → Transparenzpflicht nach Art. 50', () => {
    const list = deriveObligations({ aiSystems: [], botsAgents: ['website_chat'], dataClasses: [] });
    expect(ids(list)).toContain('ai_transparency');
    expect(list.find((o) => o.id === 'ai_transparency')!.basis).toContain('Art. 50');
  });

  it('Gesundheitsdaten → DSFA, Mitarbeiterdaten → Hochrisiko-Prüfpunkt', () => {
    const list = deriveObligations({
      aiSystems: ['openai'], botsAgents: [], dataClasses: ['health', 'employee'],
    });
    expect(ids(list)).toContain('dpia_health');
    const hr = list.find((o) => o.id === 'hr_high_risk_check')!;
    expect(hr.kind).toBe('check');
  });

  it('Bots ohne Freigabe nach außen → Prüfpunkt menschliche Aufsicht', () => {
    const base = { aiSystems: [], botsAgents: ['support_agent'], dataClasses: [] };
    expect(ids(deriveObligations({
      ...base, approvals: { autoCommunicate: 'with_approval', triggerTransactions: 'no' },
    }))).not.toContain('human_oversight');
    expect(ids(deriveObligations({
      ...base, approvals: { autoCommunicate: 'yes', triggerTransactions: 'no' },
    }))).toContain('human_oversight');
  });

  it('zählt Pflichten und Prüfpunkte getrennt', () => {
    const list = deriveObligations({
      aiSystems: ['openai'], botsAgents: [], dataClasses: ['employee'],
    });
    expect(countByKind(list)).toEqual({ duties: 4, checks: 1 });
  });

  it('joinLabels kürzt Klammerzusätze und verbindet mit „und"', () => {
    expect(joinLabels(['openai', 'microsoft_copilot', 'google'])).toBe('OpenAI, Microsoft Copilot und Google');
  });
});

function renderPanel() {
  return render(
    <MemoryRouter>
      <ObligationsPanel activeTenantId="t-1" reloadKey={0} />
    </MemoryRouter>,
  );
}

function record(aiSetup?: ReturnType<typeof createEmptyAiSetup>) {
  return {
    tenantId: 't-1',
    organization: {
      company: 'Muster GmbH', entities: '', locations: '', businessUnits: '',
      teamStructure: '', responsibilities: '', roles: '',
      ...(aiSetup ? { aiSetup } : {}),
    },
    scopes: ['dsgvo'],
    status: 'org_saved' as const,
    updatedAt: null,
  };
}

describe('ObligationsPanel', () => {
  beforeEach(() => {
    cleanup();
    mocks.load.mockReset();
    mocks.save.mockReset();
    mocks.notify.mockReset();
    mocks.signals.mockReset();
    mocks.progress.mockReset();
    mocks.setDone.mockReset();
    mocks.signals.mockResolvedValue(SIGNALS_EMPTY);
    mocks.progress.mockResolvedValue({});
  });

  it('Fehler beim Lesen → Hinweis, keine Schnellauswahl', async () => {
    mocks.load.mockRejectedValue(new Error('rls'));
    renderPanel();
    expect(await screen.findByText(/nicht lesbar/)).toBeTruthy();
    expect(screen.queryByText(/Angaben speichern/)).toBeNull();
  });

  it('ohne Angaben → Schnellauswahl; Klick zeigt Vorschau; Speichern behält Bestand', async () => {
    mocks.load.mockResolvedValue(record());
    mocks.save.mockResolvedValue(undefined);
    renderPanel();
    const saveBtn = await screen.findByRole('button', { name: /Angaben speichern/ });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'OpenAI (ChatGPT, API)' }));
    expect(screen.getByText(/Vorschau/)).toBeTruthy();
    expect(screen.getByText(/KI-Kompetenz/)).toBeTruthy();

    fireEvent.click(saveBtn);
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const arg = mocks.save.mock.calls[0][0];
    expect(arg.tenantId).toBe('t-1');
    expect(arg.organization.company).toBe('Muster GmbH');
    expect(arg.scopes).toEqual(['dsgvo']);
    expect(arg.status).toBe('org_saved');
    expect(arg.organization.aiSetup.aiSystems).toEqual(['openai']);
    // konservative Freigabe-Vorbelegung bleibt erhalten
    expect(arg.organization.aiSetup.approvals.triggerTransactions).toBe('no');
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith('t-1'));
    expect(await screen.findByText(/aus Ihren Angaben/)).toBeTruthy();
  });

  it('Speicherfehler wird angezeigt, Auswahl bleibt', async () => {
    mocks.load.mockResolvedValue(null);
    mocks.save.mockRejectedValue(new Error('permission denied'));
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Website-Chat' }));
    fireEvent.click(screen.getByRole('button', { name: /Angaben speichern/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Website-Chat' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('„keine KI" gespeichert → ehrlicher Hinweis, keine Pflichten', async () => {
    mocks.load.mockResolvedValue(record({
      ...createEmptyAiSetup(), aiSystems: ['none'], botsAgents: ['none'],
    }));
    renderPanel();
    expect(await screen.findByText(/keine KI im Einsatz/)).toBeTruthy();
    expect(screen.queryByTestId('obligations-list')).toBeNull();
  });

  it('Fortschritt: automatisch erkannt + von Hand abhaken', async () => {
    mocks.load.mockResolvedValue(record({
      ...createEmptyAiSetup(), aiSystems: ['openai'], botsAgents: [], dataClasses: [],
    }));
    mocks.signals.mockResolvedValue({ ...SIGNALS_EMPTY, aiSystems: { ok: true, value: 2 } });
    mocks.setDone.mockResolvedValue({ ai_literacy: { doneAt: '2026-10-15T10:00:00.000Z' } });
    renderPanel();
    expect(await screen.findByText('1 von 2 erledigt')).toBeTruthy();
    expect(screen.getByTestId('obligation-status-ai_inventory').textContent).toContain('2 KI-Systeme');
    // Inventar ist automatisch erkannt → kein Haken; nur KI-Kompetenz ist abhakbar
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(1);
    fireEvent.click(boxes[0]);
    await waitFor(() => expect(mocks.setDone).toHaveBeenCalledWith('t-1', 'ai_literacy', true));
    expect(await screen.findByText('2 von 2 erledigt')).toBeTruthy();
    expect(screen.getByTestId('obligation-status-ai_literacy').textContent).toContain('15.10.2026');
  });

  it('während ein Haken speichert, sind alle Haken gesperrt', async () => {
    mocks.load.mockResolvedValue(record({
      ...createEmptyAiSetup(), aiSystems: ['local'], botsAgents: ['website_chat'], dataClasses: [],
    }));
    let release: (v: unknown) => void = () => {};
    mocks.setDone.mockReturnValue(new Promise((r) => { release = r; }));
    renderPanel();
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2));
    await waitFor(() =>
      expect((screen.getAllByRole('checkbox')[0] as HTMLInputElement).disabled).toBe(false));
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => {
      for (const box of screen.getAllByRole('checkbox')) {
        expect((box as HTMLInputElement).disabled).toBe(true);
      }
    });
    release({ ai_literacy: { doneAt: '2026-10-23T09:00:00.000Z' } });
    await waitFor(() =>
      expect((screen.getAllByRole('checkbox')[1] as HTMLInputElement).disabled).toBe(false));
  });

  it('PDF-Export erst, wenn alle Quellen geladen sind', async () => {
    mocks.load.mockResolvedValue(record({
      ...createEmptyAiSetup(), aiSystems: ['local'], botsAgents: [], dataClasses: [],
    }));
    let resolveSignals: (v: unknown) => void = () => {};
    mocks.signals.mockReturnValue(new Promise((r) => { resolveSignals = r; }));
    renderPanel();
    const btn = await screen.findByRole('button', { name: /Als PDF/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    resolveSignals(SIGNALS_EMPTY);
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
  });

  it('Fortschritt nicht lesbar → kein Haken möglich, Status „nicht lesbar"', async () => {
    mocks.load.mockResolvedValue(record({
      ...createEmptyAiSetup(), aiSystems: ['local'], botsAgents: [], dataClasses: [],
    }));
    mocks.progress.mockRejectedValue(new Error('rls'));
    renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId('obligation-status-ai_literacy').textContent).toContain('nicht lesbar'));
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  });

  it('gespeicherte Angaben → Pflichtenliste mit Zählung und Links', async () => {
    mocks.load.mockResolvedValue(record({
      ...createEmptyAiSetup(), aiSystems: ['openai'], botsAgents: ['website_chat'], dataClasses: ['customer'],
    }));
    renderPanel();
    expect(await screen.findByText(/5 Pflichten/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Anbieter erfassen/ }).getAttribute('href')).toBe('/app/vendors');
    expect(screen.queryByRole('button', { name: /Angaben speichern/ })).toBeNull();
  });
});


describe('obligationStatus', () => {
  const avv = deriveObligations({
    aiSystems: ['openai', 'microsoft_copilot'], botsAgents: [], dataClasses: ['customer'],
  }).find((o) => o.id === 'processor_contract')!;
  const ext = ['openai', 'microsoft_copilot'];

  it('AVV: Anbieter fehlt / AVV fehlt / alles da', () => {
    expect(avv.id).toBe('processor_contract');
    expect(obligationStatus(avv, SIGNALS_EMPTY, {}, ext).state).toBe('open');

    const partial = obligationStatus(avv, {
      ...SIGNALS_EMPTY,
      vendors: { ok: true, value: [
        { name: 'OpenAI Ireland Ltd.', legal_name: null, dpa_status: 'signed' },
        { name: 'Microsoft 365', legal_name: null, dpa_status: 'requested' },
      ] },
    }, {}, ext);
    expect(partial.state).toBe('partial');
    expect(partial.detail).toContain('AVV fehlt: Microsoft');

    const done = obligationStatus(avv, {
      ...SIGNALS_EMPTY,
      vendors: { ok: true, value: [
        { name: 'ChatGPT', legal_name: 'OpenAI OpCo', dpa_status: 'signed' },
        { name: 'Azure', legal_name: null, dpa_status: 'not_required' },
      ] },
    }, {}, ext);
    expect(done.state).toBe('done');
  });

  it('Quelle fehlgeschlagen → unknown, nie offen oder erledigt', () => {
    expect(obligationStatus(avv, { ...SIGNALS_EMPTY, vendors: { ok: false } }, {}, ext).state)
      .toBe('unknown');
  });

  it('DSFA: keine / in Bearbeitung / abgeschlossen', () => {
    const dpia = deriveObligations({ aiSystems: ['local'], botsAgents: [], dataClasses: ['health'] })
      .find((o) => o.id === 'dpia_health')!;
    const at = (total: number, open: number) =>
      obligationStatus(dpia, { ...SIGNALS_EMPTY, dpias: { ok: true, value: { total, open } } }, {}, []).state;
    expect(at(0, 0)).toBe('open');
    expect(at(2, 1)).toBe('partial');
    expect(at(2, 0)).toBe('done');
  });

  it('manuelle Pflicht: markiert / offen / Fortschritt nicht lesbar', () => {
    const [lit] = deriveObligations({ aiSystems: ['local'], botsAgents: [], dataClasses: [] });
    expect(obligationStatus(lit, null, { ai_literacy: { doneAt: '2026-10-01T08:00:00Z' } }, []).state).toBe('done');
    expect(obligationStatus(lit, null, {}, []).state).toBe('open');
    expect(obligationStatus(lit, null, null, []).state).toBe('unknown');
  });
});
