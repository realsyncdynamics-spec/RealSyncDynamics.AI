/**
 * WP4 — OS-Kachelreihe auf `/app/dashboard`.
 *
 * Jede Kachel hat drei Zustände, und zwei davon werden in der Praxis
 * verwechselt: „Quelle nicht lesbar" und „Mandant hat nichts". Genau diese
 * Verwechslung ist der Grund für diese Tests — eine 0 darf nie aus einem
 * Fehler entstehen, und ein Teilfehler darf die übrigen Kacheln nicht leeren.
 *
 * Geprüft wird je Kachel: Daten · leer · Fehler.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state: {
    aiSystems: { count: number | null; error: { message: string } | null };
    approvals: { count: number | null; error: { message: string } | null };
    activation: { data: Record<string, unknown> | null; error: { message: string } | null };
  } = {
    aiSystems: { count: 0, error: null },
    approvals: { count: 0, error: null },
    activation: { data: null, error: null },
  };

  const client = {
    from: (table: string) => {
      if (table === 'ai_systems') {
        return {
          select: () => ({
            eq: async () => ({ count: state.aiSystems.count, error: state.aiSystems.error }),
          }),
        };
      }
      if (table === 'governance_approvals') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ count: state.approvals.count, error: state.approvals.error }),
            }),
          }),
        };
      }
      if (table === 'governance_activations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.activation.data,
                error: state.activation.error,
              }),
            }),
          }),
        };
      }
      throw new Error(`unerwartete Tabelle: ${table}`);
    },
  };
  return { state, client };
});

vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => mocks.client,
  isSupabaseConfigured: () => true,
}));

import {
  countAiSystems,
  evidenceTileFrom,
  highRiskAssetsCountable,
  loadOsControlStripData,
  loadTenantAgents,
  riskTileFrom,
  EVIDENCE_SOURCES,
  RISK_INDEX_SOURCES,
} from '../../src/features/governance/dashboard/osControlStripData';
import type { CockpitData } from '../../src/features/governance/cockpit/cockpitData';
import {
  computeEvidenceHealth,
  computeRiskIndex,
} from '../../src/features/governance/dashboard/complianceStatus';

/**
 * Minimale Cockpit-Daten — die Kachel-Ableitungen lesen nur diese Felder.
 *
 * Die Vorgaben stehen bewusst als Destructuring-Defaults und NICHT als `??`:
 * `??` behandelt ein ausdrücklich übergebenes `null` wie „nicht angegeben",
 * `cockpit({ riskScore: null })` hätte also 34 geliefert und den Fall
 * „nicht gemessen" nie geprüft. Genau daran ist dieser Test zuerst
 * fehlgeschlagen. Destructuring-Defaults greifen nur bei `undefined`, lassen
 * `null` stehen — und `0` ebenso.
 */
function cockpit({
  partialFailures = [],
  riskScore = 34,
  highRiskAssets = 1,
  evidencePercent = 72,
  evidenceTotal = 25,
  evidenceHashed = 18,
}: {
  partialFailures?: string[];
  riskScore?: number | null;
  highRiskAssets?: number;
  evidencePercent?: number | null;
  evidenceTotal?: number;
  evidenceHashed?: number;
} = {}): CockpitData {
  return {
    partialFailures,
    riskIndex: {
      score: riskScore,
      assetCount: 3,
      highRiskAssets,
      avgAssetRisk: 40,
      newRisks24h: 0,
      level: 'medium',
      label: 'mittel',
    },
    evidenceHealth: {
      percent: evidencePercent,
      hashedCount: evidenceHashed,
      totalCount: evidenceTotal,
      newEvidence24h: 0,
      failedScans: 0,
      level: 'medium',
      label: 'mittel',
    },
  } as unknown as CockpitData;
}

beforeEach(() => {
  mocks.state.aiSystems = { count: 0, error: null };
  mocks.state.approvals = { count: 0, error: null };
  mocks.state.activation = { data: null, error: null };
});

describe('Kachel KI-Inventar — eigener Zähler, kein Demo-Fallback', () => {
  it('leere Tabelle ergibt 0', async () => {
    mocks.state.aiSystems = { count: 0, error: null };
    await expect(countAiSystems('t1')).resolves.toBe(0);
  });

  it('Daten ergeben die echte Anzahl', async () => {
    mocks.state.aiSystems = { count: 7, error: null };
    await expect(countAiSystems('t1')).resolves.toBe(7);
  });

  it('RLS-/Netzfehler wirft — niemals 0', async () => {
    mocks.state.aiSystems = { count: null, error: { message: 'permission denied' } };
    await expect(countAiSystems('t1')).rejects.toThrow('permission denied');
  });

  it('count null ohne Fehler ist 0 (head-Abfrage ohne Treffer)', async () => {
    mocks.state.aiSystems = { count: null, error: null };
    await expect(countAiSystems('t1')).resolves.toBe(0);
  });
});

describe('Kachel Bots & Agenten — aus aiSetup des Mandanten, nicht aus dem Katalog', () => {
  it('ohne Activation-Zeile: nicht eingerichtet', async () => {
    mocks.state.activation = { data: null, error: null };
    await expect(loadTenantAgents('t1')).resolves.toEqual({
      configured: false, count: 0, declaredNone: false,
    });
  });

  it('Zeile ohne aiSetup: nicht eingerichtet (nicht „0 Agenten")', async () => {
    mocks.state.activation = {
      data: { tenant_id: 't1', organization: { company: 'ACME' }, scopes: [], status: 'org_saved' },
      error: null,
    };
    const result = await loadTenantAgents('t1');
    expect(result.configured).toBe(false);
  });

  it('ausdrücklich „keine Bots geplant" ist eingerichtet mit 0', async () => {
    mocks.state.activation = {
      data: {
        tenant_id: 't1',
        organization: {
          company: 'ACME',
          aiSetup: {
            responsibleRole: 'gf', aiSystems: ['openai'], botsAgents: ['none'], dataClasses: [],
            approvals: {
              autoCommunicate: 'with_approval', readCustomerData: 'with_approval',
              triggerTransactions: 'no', logEveryAgentAction: true, humanApprovalFor: [],
            },
          },
        },
        scopes: [], status: 'activated',
      },
      error: null,
    };
    await expect(loadTenantAgents('t1')).resolves.toEqual({
      configured: true, count: 0, declaredNone: true,
    });
  });

  it('erfasste Agenten werden gezählt, „none" zählt nicht mit', async () => {
    mocks.state.activation = {
      data: {
        tenant_id: 't1',
        organization: {
          company: 'ACME',
          aiSetup: {
            responsibleRole: 'gf', aiSystems: ['openai'],
            botsAgents: ['website_chat', 'voice'], dataClasses: [],
            approvals: {
              autoCommunicate: 'with_approval', readCustomerData: 'with_approval',
              triggerTransactions: 'no', logEveryAgentAction: true, humanApprovalFor: [],
            },
          },
        },
        scopes: [], status: 'activated',
      },
      error: null,
    };
    await expect(loadTenantAgents('t1')).resolves.toEqual({
      configured: true, count: 2, declaredNone: false,
    });
  });

  it('Lesefehler wirft statt „nicht eingerichtet" zu behaupten', async () => {
    mocks.state.activation = { data: null, error: { message: 'rls blocked' } };
    await expect(loadTenantAgents('t1')).rejects.toThrow('rls blocked');
  });
});

describe('Ein Teilfehler leert die anderen Kacheln nicht', () => {
  it('KI-Inventar fehlerhaft, Freigaben und Agenten bleiben nutzbar', async () => {
    mocks.state.aiSystems = { count: null, error: { message: 'boom' } };
    mocks.state.approvals = { count: 3, error: null };
    mocks.state.activation = { data: null, error: null };

    const result = await loadOsControlStripData('t1');
    expect(result.aiSystems).toEqual({ kind: 'error', message: 'boom' });
    expect(result.pendingApprovals).toEqual({ kind: 'value', value: 3 });
    expect(result.tenantAgents.kind).toBe('value');
  });

  it('alle drei Quellen gesund', async () => {
    mocks.state.aiSystems = { count: 4, error: null };
    mocks.state.approvals = { count: 0, error: null };

    const result = await loadOsControlStripData('t1');
    expect(result.aiSystems).toEqual({ kind: 'value', value: 4 });
    // 0 offene Freigaben ist ein Wert, kein Fehler — die Kachel textet daraus
    // „Keine Freigaben offen".
    expect(result.pendingApprovals).toEqual({ kind: 'value', value: 0 });
  });

  it('loadOsControlStripData wirft selbst nicht', async () => {
    mocks.state.aiSystems = { count: null, error: { message: 'a' } };
    mocks.state.approvals = { count: null, error: { message: 'b' } };
    mocks.state.activation = { data: null, error: { message: 'c' } };
    await expect(loadOsControlStripData('t1')).resolves.toMatchObject({
      aiSystems: { kind: 'error' },
      pendingApprovals: { kind: 'error' },
      tenantAgents: { kind: 'error' },
    });
  });
});

describe('Kachel Residualrisiko — Index, keine Anzahl', () => {
  it('Daten ergeben den Index', () => {
    expect(riskTileFrom(cockpit({ riskScore: 34 }), false, null)).toEqual({
      kind: 'value',
      value: expect.objectContaining({ score: 34 }),
    });
  });

  it('kein Messwert bleibt ein Wert mit score null, kein Fehler', () => {
    const tile = riskTileFrom(cockpit({ riskScore: null }), false, null);
    expect(tile.kind).toBe('value');
    if (tile.kind === 'value') expect(tile.value.score).toBeNull();
  });

  it('Ladezustand, solange die Cockpit-Daten fehlen', () => {
    expect(riskTileFrom(null, true, null).kind).toBe('loading');
    expect(riskTileFrom(null, false, null).kind).toBe('loading');
  });

  it('Cockpit-Fehler schlägt auf die Kachel durch', () => {
    expect(riskTileFrom(null, false, 'rpc kaputt')).toEqual({
      kind: 'error', message: 'rpc kaputt',
    });
  });

  it.each([...RISK_INDEX_SOURCES])(
    'fehlender Teillader %s macht den Index zum Fehler, nicht zu 0',
    (source) => {
      const tile = riskTileFrom(cockpit({ partialFailures: [`${source}: timeout`] }), false, null);
      expect(tile.kind).toBe('error');
    },
  );

  it('ein fremder Teilfehler stört den Index nicht', () => {
    const tile = riskTileFrom(cockpit({ partialFailures: ['vendors: timeout'] }), false, null);
    expect(tile.kind).toBe('value');
  });

  it('Anzahl hochriskanter Assets nur bei intaktem Asset-Lader', () => {
    expect(highRiskAssetsCountable(cockpit())).toBe(true);
    expect(highRiskAssetsCountable(cockpit({ partialFailures: ['assets: timeout'] }))).toBe(false);
    expect(highRiskAssetsCountable(null)).toBe(false);
  });
});

describe('Kachel Evidence-Status', () => {
  it('Daten ergeben Abdeckung und Hash-Zahlen', () => {
    const tile = evidenceTileFrom(cockpit({ evidencePercent: 72 }), false, null);
    expect(tile).toEqual({
      kind: 'value',
      value: expect.objectContaining({ percent: 72, hashedCount: 18, totalCount: 25 }),
    });
  });

  it('fehlende Abdeckung ist ein Wert mit percent null, kein Fehler', () => {
    // Dieser Fall war durch den `??`-Fehler im Fixture nicht prüfbar.
    const tile = evidenceTileFrom(cockpit({ evidencePercent: null }), false, null);
    expect(tile.kind).toBe('value');
    if (tile.kind === 'value') expect(tile.value.percent).toBeNull();
  });

  it('leerer Nachweisspeicher ist ein Wert mit totalCount 0', () => {
    const tile = evidenceTileFrom(cockpit({ evidenceTotal: 0, evidenceHashed: 0 }), false, null);
    expect(tile.kind).toBe('value');
    if (tile.kind === 'value') expect(tile.value.totalCount).toBe(0);
  });

  it.each([...EVIDENCE_SOURCES])(
    'fehlender Teillader %s macht den Nachweisstand zum Fehler',
    (source) => {
      const tile = evidenceTileFrom(cockpit({ partialFailures: [`${source}: timeout`] }), false, null);
      expect(tile.kind).toBe('error');
    },
  );

  it('Cockpit-Fehler schlägt durch', () => {
    expect(evidenceTileFrom(null, false, 'kaputt').kind).toBe('error');
  });
});

describe('Abnahme: frischer Mandant ohne Daten', () => {
  it('Residualrisiko ist keine 0, sondern „nicht erfasst" — aus computeRiskIndex selbst', () => {
    const index = computeRiskIndex({
      assetScores: [], newRisks24h: 0, openIncidents: 0, dsrOverdue: 0,
    });
    expect(index.score).toBeNull();
    expect(index.label).toBe('Kein Residualrisiko erfasst');

    // Die Kachel gibt genau das durch: ein Wert mit score null, kein Fehler,
    // keine 0. Der angezeigte Text ist index.label.
    const tile = riskTileFrom(
      { partialFailures: [], riskIndex: index } as unknown as CockpitData, false, null,
    );
    expect(tile.kind).toBe('value');
    if (tile.kind === 'value') expect(tile.value.score).toBeNull();
  });

  it('Evidence-Status ohne Nachweise liefert totalCount 0 — Empty State, keine Abdeckung', () => {
    const health = computeEvidenceHealth({
      coveragePercent: null, totalCount: 0, hashedCount: 0,
      latestEvidenceAt: null, newEvidence24h: 0, failedScans: 0,
    });
    expect(health.totalCount).toBe(0);

    const tile = evidenceTileFrom(
      { partialFailures: [], evidenceHealth: health } as unknown as CockpitData, false, null,
    );
    expect(tile.kind).toBe('value');
    if (tile.kind === 'value') expect(tile.value.totalCount).toBe(0);
  });

  it('leeres KI-Inventar und keine Freigaben sind Werte, keine Fehler', async () => {
    mocks.state.aiSystems = { count: 0, error: null };
    mocks.state.approvals = { count: 0, error: null };
    mocks.state.activation = { data: null, error: null };

    const result = await loadOsControlStripData('t1');
    expect(result.aiSystems).toEqual({ kind: 'value', value: 0 });
    expect(result.pendingApprovals).toEqual({ kind: 'value', value: 0 });
    expect(result.tenantAgents).toEqual({
      kind: 'value', value: { configured: false, count: 0, declaredNone: false },
    });
  });
});

/**
 * Befund von CodeRabbit auf #1733, bestätigt: der Lade-Effekt der Kachelreihe
 * hing nur an `reloadKey`, nicht an `dataVersion`. Folge: nach einem
 * Mandanten-Datenereignis (z. B. eine anderswo aufgelöste Freigabe) lud das
 * Dashboard die Cockpit-Daten neu, die drei eigenen Zähler der Reihe aber
 * nicht — die Kachel „Wartende Freigaben" blieb auf der alten Zahl stehen.
 *
 * Die Effekt-Abhängigkeiten sind ohne Renderer nicht beobachtbar, deshalb hier
 * dieselbe Quelltext-Ratsche wie in `count-helpers-throw.test.ts`.
 */
describe('Kachelreihe lädt bei Mandanten-Datenänderungen neu', () => {
  const strip = readFileSync('src/features/governance/dashboard/OsControlStrip.tsx', 'utf8');
  const dashboard = readFileSync(
    'src/features/governance/dashboard/CommandCenterDashboard.tsx', 'utf8',
  );

  it('der Lade-Effekt hängt an activeTenantId, reloadKey UND dataVersion', () => {
    expect(strip).toContain('}, [activeTenantId, reloadKey, dataVersion]);');
  });

  it('das Dashboard gibt dataVersion auch durch', () => {
    expect(dashboard).toMatch(/<OsControlStrip[\s\S]*?dataVersion=\{dataVersion\}[\s\S]*?\/>/);
  });

  it('die drei Geschwister-Effekte im Dashboard hängen weiterhin an dataVersion', () => {
    // Wenn diese Zahl sinkt, ist eine der bestehenden Quellen entkoppelt worden
    // und zeigt veraltete Werte — dann gehört das geprüft, nicht angepasst.
    const matches = dashboard.match(/\}, \[activeTenantId, reloadKey, dataVersion\]\);/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});

/**
 * Zweiter Befund von CodeRabbit auf #1733, ebenfalls bestätigt: beim
 * Mandantenwechsel rendert React einmal mit dem neuen `activeTenantId`, aber
 * noch mit den alten Werten — `setData(null)` und `setSources(EMPTY_SOURCES)`
 * stehen beide IM Effekt und laufen erst nach diesem Render. Die Reihe zeigte
 * in genau diesem Frame die Zahlen des vorigen Mandanten unter dem neuen.
 *
 * Auf einer Governance-Fläche ist das keine Kosmetik, sondern eine falsch
 * zugeordnete Zahl. Zwei Vorkehrungen, beide am Einhängepunkt.
 */
describe('Mandantenwechsel zeigt keine Zahlen des vorigen Mandanten', () => {
  const dashboard = readFileSync(
    'src/features/governance/dashboard/CommandCenterDashboard.tsx', 'utf8',
  );

  it('die Reihe wird beim Wechsel über key neu aufgebaut', () => {
    expect(dashboard).toContain("key={activeTenantId ?? 'no-tenant'}");
  });

  it('data wird nur durchgegeben, solange es zum aktiven Mandanten gehört', () => {
    expect(dashboard).toContain('data={dataTenantId === activeTenantId ? data : null}');
  });

  it('dataTenantId wird beim Laden gesetzt und beim Wechsel geleert', () => {
    // Gesetzt erst NACH erfolgreichem Laden, zusammen mit den Daten.
    expect(dashboard).toContain('setData(next); setDataTenantId(activeTenantId);');
    // Und vor jedem neuen Laden sowie ohne Mandanten geleert: zwei Stellen.
    const cleared = dashboard.match(/setDataTenantId\(null\);/g) ?? [];
    expect(cleared.length).toBe(2);
  });
});
