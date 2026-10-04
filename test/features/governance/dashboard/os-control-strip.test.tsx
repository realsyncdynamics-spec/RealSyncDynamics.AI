/**
 * WP4 — OS-Kachelreihe im Command Center: je Kachel Empty / Fehler / Daten,
 * Mandantenfilter auf activeTenantId, kein Demo-Fallback, Fehler einer Quelle
 * blockiert die anderen nicht.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CockpitData } from '../../../../src/features/governance/cockpit/cockpitData';
import type { GovernanceActivationRecord } from '../../../../src/features/activation/activationApi';
import { createEmptyAiSetup } from '../../../../src/features/activation/aiSetupCatalog';
import type { LoadState } from '../../../../src/features/governance/handoff/useTenantLoad';

const db = vi.hoisted(() => ({
  aiSystems: { count: 0 as number | null, error: null as { message: string } | null },
  eqCalls: [] as Array<{ table: string; column: string; value: unknown }>,
}));

vi.mock('../../../../src/lib/supabase', async (orig) => {
  const actual = await orig<typeof import('../../../../src/lib/supabase')>();
  return {
    ...actual,
    isSupabaseConfigured: () => true,
    getSupabase: () => ({
      from: (table: string) => ({
        select: () => ({
          eq: (column: string, value: unknown) => {
            db.eqCalls.push({ table, column, value });
            return Promise.resolve({ count: db.aiSystems.count, error: db.aiSystems.error });
          },
        }),
      }),
    }),
  };
});

const activation = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../../../../src/features/activation/activationApi', async (orig) => {
  const actual = await orig<typeof import('../../../../src/features/activation/activationApi')>();
  return { ...actual, loadGovernanceActivation: activation.load };
});

const inventory = vi.hoisted(() => ({ count: vi.fn() }));
vi.mock('../../../../src/features/governance/aiActRiskInventoryApi', async (orig) => {
  const actual = await orig<typeof import('../../../../src/features/governance/aiActRiskInventoryApi')>();
  return { ...actual, countRiskInventory: inventory.count };
});

import { OsControlStrip } from '../../../../src/features/governance/dashboard/OsControlStrip';
import {
  agentsTile,
  approvalsTile,
  countTenantAiSystems,
  evidenceTile,
  inventoryTile,
  loadOsControlSources,
  riskTile,
  type OsControlSources,
} from '../../../../src/features/governance/dashboard/osControlSources';

function cockpit(overrides: Partial<CockpitData> = {}): CockpitData {
  return {
    counts: { incidents: 0, dpias: 0, dsr: { total: 0, overdue: 0 }, approvals: 0, vendorsNoDpa: 0 },
    posture: null,
    score: null,
    scoreStatus: 'insufficient_data',
    scoreBasis: { aiSystems: 0, controlMappings: 0 },
    readiness: null,
    readinessTrend: null,
    actions: [],
    lastUpdated: null,
    evidenceHealth: {
      percent: null, hashedCount: 0, totalCount: 0, newEvidence24h: 0, failedScans: 0,
      level: 'unknown', label: 'Keine Evidence',
    },
    riskIndex: {
      score: null, assetCount: 0, highRiskAssets: 0, avgAssetRisk: null, newRisks24h: 0,
      level: 'unknown', label: 'Keine Daten',
    },
    openMeasures: { total: 0 } as CockpitData['openMeasures'],
    summary24h: null,
    recentEvents: [],
    riskDistribution: [],
    assetFlows: [],
    partialFailures: [],
    ...overrides,
  };
}

function activationRecord(botsAgents: string[] | null): GovernanceActivationRecord {
  const organization = {
    company: 'Acme', entities: '', locations: '', businessUnits: '', teamStructure: '', responsibilities: '', roles: '',
    ...(botsAgents ? { aiSetup: { ...createEmptyAiSetup(), botsAgents } } : {}),
  };
  return { tenantId: 't1', organization, scopes: [], status: 'org_saved', updatedAt: null };
}

function ready(overrides: Partial<OsControlSources> = {}): LoadState<OsControlSources> {
  return {
    status: 'ready',
    data: { aiSystems: 0, activation: null, riskInventory: { total: 0, high_risk: 0 }, failures: [], ...overrides },
  };
}

const ok = (data: CockpitData) => ({ data, loading: false, error: null });

beforeEach(() => {
  db.aiSystems = { count: 0, error: null };
  db.eqCalls = [];
  activation.load.mockReset();
  inventory.count.mockReset();
});

describe('countTenantAiSystems', () => {
  it('filtert auf den aktiven Mandanten und liefert 0 als leer', async () => {
    await expect(countTenantAiSystems('t1')).resolves.toBe(0);
    expect(db.eqCalls).toEqual([{ table: 'ai_systems', column: 'tenant_id', value: 't1' }]);
  });

  it('wirft bei Fehler statt 0 oder Demo-Daten zu liefern', async () => {
    db.aiSystems = { count: null, error: { message: 'permission denied' } };
    await expect(countTenantAiSystems('t1')).rejects.toThrow('permission denied');
  });
});

describe('loadOsControlSources', () => {
  it('ein Quellenfehler lässt die anderen Quellen stehen (allSettled)', async () => {
    db.aiSystems = { count: null, error: { message: 'boom' } };
    activation.load.mockResolvedValue(activationRecord(['website_chat']));
    inventory.count.mockResolvedValue({ total: 3, high_risk: 1 });
    const sources = await loadOsControlSources('t1');
    expect(sources.aiSystems).toBeNull();
    expect(sources.failures).toEqual(['ai-systems: boom']);
    expect(sources.activation?.organization.aiSetup?.botsAgents).toEqual(['website_chat']);
    expect(sources.riskInventory).toEqual({ total: 3, high_risk: 1 });
    expect(activation.load).toHaveBeenCalledWith('t1');
    expect(inventory.count).toHaveBeenCalledWith('t1');
  });

  it('countRiskInventory = null wird als Fehler geführt, nicht als leer', async () => {
    activation.load.mockResolvedValue(null);
    inventory.count.mockResolvedValue(null);
    const sources = await loadOsControlSources('t1');
    expect(sources.riskInventory).toBeNull();
    expect(sources.failures.some((f) => f.startsWith('risk-inventory:'))).toBe(true);
  });
});

describe('Kachel KI-Inventar', () => {
  it('Empty: 0 Systeme ⇒ Empty State mit Link /app/activation', () => {
    const tile = inventoryTile(ready({ aiSystems: 0 }));
    expect(tile.state).toEqual({ kind: 'empty', message: 'Noch keine KI-Systeme erfasst' });
    expect(tile.to).toBe('/app/activation');
  });
  it('Fehler: Quelle abgelehnt ⇒ Fehlerzustand, keine 0', () => {
    const tile = inventoryTile(ready({ aiSystems: null, failures: ['ai-systems: boom'] }));
    expect(tile.state.kind).toBe('error');
  });
  it('Daten: echte Anzahl aus ai_systems', () => {
    const tile = inventoryTile(ready({ aiSystems: 4 }));
    expect(tile.state).toMatchObject({ kind: 'data', value: 4 });
    expect(tile.to).toBe('/app/ai-systems');
  });
});

describe('Kachel Bots/Agenten', () => {
  it('Empty: kein AI-OS-Setup ⇒ Empty State mit Link /app/activation', () => {
    const tile = agentsTile(ready({ activation: null }));
    expect(tile.state.kind).toBe('empty');
    expect(tile.to).toBe('/app/activation');
  });
  it('Empty: „none“ ⇒ keine Bots geplant, keine Zahl', () => {
    const tile = agentsTile(ready({ activation: activationRecord(['none']) }));
    expect(tile.state).toEqual({ kind: 'empty', message: 'Laut AI-OS-Setup keine Bots oder Agenten geplant' });
  });
  it('Fehler: Activation nicht ladbar', () => {
    const tile = agentsTile(ready({ activation: null, failures: ['activation: boom'] }));
    expect(tile.state.kind).toBe('error');
  });
  it('Daten: Anzahl aus aiSetup.botsAgents; Katalog nur als separater Link', () => {
    const tile = agentsTile(ready({ activation: activationRecord(['website_chat', 'support_agent', 'voice']) }));
    expect(tile.state).toMatchObject({ kind: 'data', value: 3, detail: 'Website-Chat, Voice-Agent / Telefon +1' });
    expect(tile.extraLink).toEqual({ label: 'Verfügbare Agenten', to: '/app/ai-systems/agents' });
  });
});

describe('Kachel Residualrisiko', () => {
  it('Empty: kein Index ⇒ kein Wert', () => {
    const tile = riskTile(ok(cockpit()), ready());
    expect(tile.label).toBe('Residualrisiko (Index 0–100)');
    expect(tile.state.kind).toBe('empty');
    expect(tile.facts).toEqual(['AI-Act-Inventar: keine Einträge']);
  });
  it('Fehler: Teilquelle des Index abgelehnt ⇒ Fehlerzustand', () => {
    const tile = riskTile(ok(cockpit({ partialFailures: ['assets: boom'] })), ready());
    expect(tile.state.kind).toBe('error');
  });
  it('Fehler: Cockpit komplett abgelehnt', () => {
    expect(riskTile({ data: null, loading: false, error: 'network' }, ready()).state.kind).toBe('error');
  });
  it('Daten: Index als /100, Anzahl nur aus ai_act_risk_inventory', () => {
    const data = cockpit({ riskIndex: { ...cockpit().riskIndex, score: 42, label: 'Mittel' } });
    const tile = riskTile(ok(data), ready({ riskInventory: { total: 5, high_risk: 2 } }));
    expect(tile.state).toMatchObject({ kind: 'data', value: 42, unit: '/100' });
    expect(tile.facts).toEqual(['AI-Act-Inventar: 2 von 5 Einträgen hoch/verboten']);
  });
  it('Inventar-Fehler betrifft nur die Zusatzzeile, nicht den Index', () => {
    const data = cockpit({ riskIndex: { ...cockpit().riskIndex, score: 10, label: 'Gering' } });
    const tile = riskTile(ok(data), ready({ riskInventory: null, failures: ['risk-inventory: x'] }));
    expect(tile.state.kind).toBe('data');
    expect(tile.facts).toEqual(['AI-Act-Inventar nicht ladbar']);
  });
});

describe('Kachel Wartende Freigaben', () => {
  it('Empty: „Keine Freigaben offen“, nicht „0 %“', () => {
    const tile = approvalsTile(ok(cockpit()));
    expect(tile.state).toEqual({ kind: 'empty', message: 'Keine Freigaben offen' });
  });
  it('Fehler: approvals-Zähler abgelehnt ⇒ Fehlerzustand statt 0', () => {
    const tile = approvalsTile(ok(cockpit({ partialFailures: ['approvals: boom'] })));
    expect(tile.state.kind).toBe('error');
  });
  it('Daten: Anzahl pending', () => {
    const data = cockpit({ counts: { ...cockpit().counts, approvals: 3 } });
    expect(approvalsTile(ok(data)).state).toMatchObject({ kind: 'data', value: 3 });
  });
});

describe('Kachel Evidence-Status', () => {
  it('Empty: keine Nachweise', () => {
    expect(evidenceTile(ok(cockpit())).state).toEqual({ kind: 'empty', message: 'Noch keine Nachweise' });
  });
  it('Fehler: evidence-total abgelehnt', () => {
    expect(evidenceTile(ok(cockpit({ partialFailures: ['evidence-total: boom'] }))).state.kind).toBe('error');
  });
  it('Daten: Prozent aus evidenceHealth plus gehashte Anzahl', () => {
    const data = cockpit({
      evidenceHealth: { ...cockpit().evidenceHealth, percent: 80, totalCount: 10, hashedCount: 9, label: 'Gut' },
    });
    const tile = evidenceTile(ok(data));
    expect(tile.state).toMatchObject({ kind: 'data', value: 80, unit: '%', detail: 'Gut' });
    expect(tile.facts).toEqual(['9 von 10 Nachweisen gehasht']);
  });
});

describe('OsControlStrip (Render)', () => {
  function renderStrip(props: Partial<Parameters<typeof OsControlStrip>[0]> = {}) {
    return render(
      <MemoryRouter>
        <OsControlStrip activeTenantId="t1" data={cockpit()} {...props} />
      </MemoryRouter>,
    );
  }

  it('frischer Mandant ohne Daten ⇒ fünf ehrliche Empty States', async () => {
    activation.load.mockResolvedValue(null);
    inventory.count.mockResolvedValue({ total: 0, high_risk: 0 });
    renderStrip();
    expect(screen.getByText('Command Center')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('os-tile-inventory-empty')).toBeInTheDocument());
    for (const id of ['inventory', 'agents', 'risk', 'approvals', 'evidence']) {
      expect(screen.getByTestId(`os-tile-${id}-empty`)).toBeInTheDocument();
      expect(screen.queryByTestId(`os-tile-${id}-value`)).toBeNull();
    }
    expect(screen.getByTestId('os-tile-inventory-link')).toHaveAttribute('href', '/app/activation');
    expect(screen.getByTestId('os-tile-agents-link')).toHaveAttribute('href', '/app/activation');
    expect(screen.getByTestId('os-tile-agents-extra-link')).toHaveAttribute('href', '/app/ai-systems/agents');
    expect(screen.getByTestId('os-tile-approvals').textContent).toContain('Keine Freigaben offen');
    expect(screen.getByTestId('os-control-strip').textContent).not.toMatch(/0\s*%/);
  });

  it('ai_systems-Fehler blockiert die anderen Kacheln nicht', async () => {
    db.aiSystems = { count: null, error: { message: 'boom' } };
    activation.load.mockResolvedValue(activationRecord(['website_chat']));
    inventory.count.mockResolvedValue({ total: 2, high_risk: 1 });
    const data = cockpit({ counts: { ...cockpit().counts, approvals: 2 } });
    renderStrip({ data });
    await waitFor(() => expect(screen.getByTestId('os-tile-inventory-error')).toBeInTheDocument());
    expect(screen.getByTestId('os-tile-agents-value').textContent).toBe('1');
    expect(screen.getByTestId('os-tile-approvals-value').textContent).toBe('2');
  });

  it('ohne Mandant ⇒ nichts rendern, keine Abfrage', () => {
    const { container } = renderStrip({ activeTenantId: null });
    expect(container.textContent).toBe('');
    expect(activation.load).not.toHaveBeenCalled();
  });
});
