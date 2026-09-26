/**
 * P0-1 — ehrlicher Governance-Score in loadCockpitData / Prüfer-Mappe-Hash.
 *
 * Fälle (Brief RSD Dashboard + Backend-Entscheid 25.09.2026):
 *   - kein KPI-Snapshot           ⇒ insufficient_data, score null
 *   - leerer Mandant              ⇒ insufficient_data, score null (nicht 100)
 *   - RPC-Fehler                  ⇒ fetchLatestKpiSnapshot wirft, Status unreliable,
 *                                   Eintrag in partialFailures (kein stilles null)
 *   - Normalfall                  ⇒ ok mit Zahl
 *   - Hash                        ⇒ score_status immer, score nur bei ok
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../../src/lib/supabase', () => ({ getSupabase: () => ({ rpc }) }));

const api = vi.hoisted(() => ({
  countOpenIncidents: vi.fn(),
  fetchTenantIncidents: vi.fn(),
  countOpenDpias: vi.fn(),
  listDpias: vi.fn(),
  countOpenDsrs: vi.fn(),
  fetchTenantDsrs: vi.fn(),
  countPendingApprovals: vi.fn(),
  countVendorsNoDpa: vi.fn(),
  countTenantEvidence: vi.fn(),
  countTenantEvidenceHashed: vi.fn(),
  fetchTenantAssets: vi.fn(),
  fetchTenantEvents: vi.fn(),
  countTenantControlMappings: vi.fn(),
  fetchTenantFindingEvents: vi.fn(),
  fetchTenantEvidence: vi.fn(),
  listScanRuns: vi.fn(),
}));
vi.mock('../../src/features/governance/incidentsApi', () => ({
  countOpenIncidents: api.countOpenIncidents, fetchTenantIncidents: api.fetchTenantIncidents,
}));
vi.mock('../../src/features/governance/dpiasApi', () => ({ countOpenDpias: api.countOpenDpias, listDpias: api.listDpias }));
vi.mock('../../src/features/governance/dsrApi', () => ({ countOpenDsrs: api.countOpenDsrs, fetchTenantDsrs: api.fetchTenantDsrs }));
vi.mock('../../src/features/governance/approvalsApi', () => ({ countPendingApprovals: api.countPendingApprovals }));
vi.mock('../../src/features/governance/vendorsApi', () => ({ countVendorsNoDpa: api.countVendorsNoDpa }));
vi.mock('../../src/features/governance/governanceApi', () => ({
  countTenantEvidence: api.countTenantEvidence,
  countTenantEvidenceHashed: api.countTenantEvidenceHashed,
  fetchTenantAssets: api.fetchTenantAssets,
  fetchTenantEvents: api.fetchTenantEvents,
  countTenantControlMappings: api.countTenantControlMappings,
  fetchTenantFindingEvents: api.fetchTenantFindingEvents,
  fetchTenantEvidence: api.fetchTenantEvidence,
}));
vi.mock('../../src/features/governance/scans/scansApi', () => ({ listScanRuns: api.listScanRuns }));

import {
  cockpitIntegrityHash,
  cockpitIntegrityPayload,
  fetchLatestKpiSnapshot,
  loadCockpitData,
} from '../../src/features/governance/cockpit/cockpitData';

const SNAPSHOT = {
  captured_date: '2026-09-24',
  policies_enabled_percent: 50,
  assets_with_evidence_percent: 50,
  assets_with_mappings_percent: 40,
};

function websiteAsset(id: string) {
  return { id, asset_type: 'website', risk_score: 20, name: id, ai_act_class: 'unknown' };
}
function aiAsset(id: string) {
  return { id, asset_type: 'ai_system', risk_score: 30, name: id, ai_act_class: 'limited' };
}

/** Owner-Mandant wie im Inventar: 2 Website-Assets, 0 KI-Systeme, 0 Mappings, 0 offene Posten. */
function emptyTenant() {
  api.countOpenIncidents.mockResolvedValue(0);
  api.fetchTenantIncidents.mockResolvedValue([]);
  api.countOpenDpias.mockResolvedValue(0);
  api.listDpias.mockResolvedValue({ ok: true, dpias: [] });
  api.countOpenDsrs.mockResolvedValue({ total: 0, overdue: 0 });
  api.fetchTenantDsrs.mockResolvedValue([]);
  api.countPendingApprovals.mockResolvedValue(0);
  api.countVendorsNoDpa.mockResolvedValue(0);
  api.countTenantEvidence.mockResolvedValue(1);
  api.countTenantEvidenceHashed.mockResolvedValue(1);
  api.fetchTenantAssets.mockResolvedValue([websiteAsset('w1'), websiteAsset('w2')]);
  api.fetchTenantEvents.mockResolvedValue([]);
  api.countTenantControlMappings.mockResolvedValue(0);
  api.fetchTenantFindingEvents.mockResolvedValue([]);
  api.fetchTenantEvidence.mockResolvedValue([]);
  api.listScanRuns.mockResolvedValue([]);
}

function rpcReturns(latest: { data: unknown; error: unknown }) {
  rpc.mockImplementation((name: string) => {
    if (name === 'governance_kpi_latest_snapshot') return Promise.resolve(latest);
    if (name === 'governance_kpi_range') return Promise.resolve({ data: [], error: null });
    if (name === 'governance_24h_summary') return Promise.resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  emptyTenant();
});

describe('fetchLatestKpiSnapshot', () => {
  it('wirft bei RPC-Fehler statt null zurückzugeben', async () => {
    rpcReturns({ data: null, error: { message: 'permission denied for function' } });
    await expect(fetchLatestKpiSnapshot('t1')).rejects.toThrow('permission denied for function');
  });

  it('liefert null nur, wenn kein Snapshot existiert', async () => {
    rpcReturns({ data: [], error: null });
    await expect(fetchLatestKpiSnapshot('t1')).resolves.toBeNull();
  });

  it('liefert die jüngste Zeile', async () => {
    rpcReturns({ data: [SNAPSHOT], error: null });
    await expect(fetchLatestKpiSnapshot('t1')).resolves.toEqual(SNAPSHOT);
  });
});

describe('loadCockpitData — Score-Status', () => {
  it('kein Snapshot ⇒ insufficient_data, score null', async () => {
    api.fetchTenantAssets.mockResolvedValue([aiAsset('a1')]);
    rpcReturns({ data: [], error: null });
    const d = await loadCockpitData('t1');
    expect(d.scoreStatus).toBe('insufficient_data');
    expect(d.score).toBeNull();
    expect(d.partialFailures).toEqual([]);
  });

  it('leerer Mandant (0 KI-Systeme, 0 Mappings) ⇒ insufficient_data, score null — nicht 100', async () => {
    rpcReturns({ data: [SNAPSHOT], error: null });
    const d = await loadCockpitData('t1');
    expect(d.scoreBasis).toEqual({ aiSystems: 0, controlMappings: 0 });
    expect(d.scoreStatus).toBe('insufficient_data');
    expect(d.score).toBeNull();
  });

  it('RPC-Fehler ⇒ unreliable, score null, sichtbar in partialFailures', async () => {
    api.fetchTenantAssets.mockResolvedValue([aiAsset('a1')]);
    rpcReturns({ data: null, error: { message: 'rpc down' } });
    const d = await loadCockpitData('t1');
    expect(d.scoreStatus).toBe('unreliable');
    expect(d.score).toBeNull();
    expect(d.partialFailures).toContain('kpi: rpc down');
  });

  it('Mapping-Zähler fehlgeschlagen ⇒ unreliable (nicht als 0 gelesen)', async () => {
    api.countTenantControlMappings.mockRejectedValue(new Error('RLS'));
    rpcReturns({ data: [SNAPSHOT], error: null });
    const d = await loadCockpitData('t1');
    expect(d.scoreStatus).toBe('unreliable');
    expect(d.scoreBasis.controlMappings).toBeNull();
    expect(d.partialFailures).toContain('control-mappings: RLS');
  });

  it('Normalfall ⇒ ok mit Zahl', async () => {
    api.fetchTenantAssets.mockResolvedValue([aiAsset('a1'), websiteAsset('w1')]);
    api.countTenantControlMappings.mockResolvedValue(3);
    api.countOpenIncidents.mockResolvedValue(1);
    rpcReturns({ data: [SNAPSHOT], error: null });
    const d = await loadCockpitData('t1');
    expect(d.scoreStatus).toBe('ok');
    // penalty 90, posture 50 → 0.6·90 + 0.4·50 = 74
    expect(d.score).toBe(74);
  });
});

describe('cockpitIntegrityHash / Payload', () => {
  it('hasht score_status immer und keinen Score bei status ≠ ok', async () => {
    rpcReturns({ data: [], error: null });
    const d = await loadCockpitData('t1');
    const payload = cockpitIntegrityPayload(d, '2026-09-25');
    expect(payload.score_status).toBe('insufficient_data');
    expect(payload.score).toBeNull();
  });

  it('setzt score auch dann auf null, wenn ein Aufrufer fälschlich eine Zahl mitgibt', async () => {
    rpcReturns({ data: [], error: null });
    const d = await loadCockpitData('t1');
    const forged = { ...d, score: 100 };
    expect(cockpitIntegrityPayload(forged, '2026-09-25').score).toBeNull();
    expect(await cockpitIntegrityHash(forged, '2026-09-25')).toBe(await cockpitIntegrityHash(d, '2026-09-25'));
  });

  it('nimmt den Score bei ok in den Hash auf, und der Status verändert den Hash', async () => {
    api.fetchTenantAssets.mockResolvedValue([aiAsset('a1')]);
    rpcReturns({ data: [SNAPSHOT], error: null });
    const ok = await loadCockpitData('t1');
    expect(cockpitIntegrityPayload(ok, '2026-09-25')).toMatchObject({ score_status: 'ok', score: ok.score });
    const insufficient = { ...ok, scoreStatus: 'insufficient_data' as const, score: null };
    expect(await cockpitIntegrityHash(ok, '2026-09-25')).not.toBe(await cockpitIntegrityHash(insufficient, '2026-09-25'));
    expect(await cockpitIntegrityHash(ok, '2026-09-25')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('loadCockpitData — Dashboard-Signale (Addendum)', () => {
  const NOW = Date.parse('2026-09-25T12:00:00Z');
  function finding(id: string, level: string, createdAt: string, extra: Record<string, unknown> = {}) {
    return {
      id, tenant_id: 't1', asset_id: null, policy_id: null, event_type: 'email_auth_finding',
      event_source: 'website_scanner', title: 'DMARC fehlt', summary: null, risk_level: level,
      actor_email: null, vendor: null, model_name: null, data_types: [], policy_action: null,
      payload: {}, created_at: createdAt, ...extra,
    };
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('Live-Stand: 68/0-Assets ⇒ 1 erhöhtes Asset, Befund offen, Evidence „Zu wenig Daten“, kein Scan', async () => {
    rpcReturns({ data: [], error: null });
    api.fetchTenantAssets.mockResolvedValue([
      { ...websiteAsset('w1'), risk_score: 68, name: 'realsyncdynamicsai.de' },
      { ...websiteAsset('w2'), risk_score: 0 },
    ]);
    api.fetchTenantFindingEvents.mockResolvedValue([finding('f1', 'medium', '2026-06-27T23:02:04Z')]);
    api.fetchTenantEvidence.mockResolvedValue([{ id: 'e1', created_at: '2026-06-27T23:02:04Z' }]);
    const d = await loadCockpitData('t1');

    expect(d.riskIndex.highRiskAssets).toBe(1);
    expect(d.riskDistribution.find((b) => b.id === 'high')?.count).toBe(1);
    expect(d.signals?.elevatedAssets?.map((a) => a.name)).toEqual(['realsyncdynamicsai.de']);
    expect(d.signals?.findings).toHaveLength(1);
    expect(d.signals?.findings?.[0].resolvedAt).toBeNull();
    expect(d.evidenceHealth.percent).toBeNull();
    expect(d.evidenceHealth.label).toBe('Zu wenig Daten');
    // Scanner-/Seed-Event ist kein Audit-Lauf: lastScanAt nur aus scan_runs.
    expect(d.signals?.lastScanAt).toBeNull();
    expect(d.partialFailures).toEqual([]);
  });

  it('paart email_auth_resolved per payload.resolves_event_id ⇒ Befund behoben, Stream zeigt „behoben“', async () => {
    rpcReturns({ data: [], error: null });
    const resolvedEvent = finding('r1', 'info', '2026-09-20T08:00:00Z', {
      event_type: 'email_auth_resolved', payload: { resolves_event_id: 'f1' },
    });
    api.fetchTenantFindingEvents.mockResolvedValue([resolvedEvent, finding('f1', 'medium', '2026-06-27T23:02:04Z')]);
    api.fetchTenantEvents.mockResolvedValue([resolvedEvent, finding('f1', 'medium', '2026-06-27T23:02:04Z')]);
    const d = await loadCockpitData('t1');

    expect(d.signals?.findings).toHaveLength(1);
    expect(d.signals?.findings?.[0].resolvedAt).toBe('2026-09-20T08:00:00Z');
    const old = d.recentEvents.find((e) => e.id === 'f1');
    expect(old?.resolvedAt).toBe('2026-09-20T08:00:00Z');
    expect(d.recentEvents.find((e) => e.id === 'r1')?.resolvesEventId).toBe('f1');
  });

  it('realer Payload (e6b3c8dd): altes DMARC-Event behoben am checked_at, manuell bestätigt, nicht offen', async () => {
    rpcReturns({ data: [], error: null });
    const old = finding('e712035d-0ea0-4d83-8a9a-ca071202910d', 'medium', '2026-06-27T23:02:04.319787+00:00', {
      asset_id: '1838591e-7e42-46b6-a371-19341e9f922c',
    });
    const resolve = finding('33762763-3d6a-4482-b53d-662f15c0c7d9', 'info', '2026-09-25T21:05:10.474336+00:00', {
      event_type: 'email_auth_resolved',
      asset_id: '1838591e-7e42-46b6-a371-19341e9f922c',
      payload: {
        resolves_event_id: 'e712035d-0ea0-4d83-8a9a-ca071202910d', check: 'dmarc', domain: 'realsyncdynamicsai.de',
        previous_state: { dmarc: 'absent', checked_at: '2026-06-28' },
        current_state: { dmarc: 'present', policy: 'quarantine' },
        checked_at: '2026-09-25T21:04:48Z', evidence_id: '58bca6e1-010f-4a84-807f-41b727c80699',
        finding_id: null, scanner_version: 'manual-2026-09-25', source: 'manual_owner_approved',
      },
    });
    api.fetchTenantFindingEvents.mockResolvedValue([resolve, old]);
    api.fetchTenantEvents.mockResolvedValue([resolve, old]);
    const d = await loadCockpitData('t1');
    const oldEvent = d.recentEvents.find((e) => e.id === old.id);
    expect(oldEvent?.resolvedAt).toBe('2026-09-25T21:04:48Z');
    expect(oldEvent?.resolvedManually).toBe(true);
    const resolveEvent = d.recentEvents.find((e) => e.id === resolve.id);
    expect(resolveEvent?.resolvedAt).toBeNull();
    expect(resolveEvent?.resolvesEventId).toBe(old.id);
    expect(d.signals?.findings?.map((f) => [f.id, f.resolvedAt])).toEqual([[old.id, '2026-09-25T21:04:48Z']]);
  });

  it('lastScanAt kommt aus scan_runs', async () => {
    rpcReturns({ data: [], error: null });
    api.listScanRuns.mockResolvedValue([{ id: 's1', created_at: '2026-09-01T10:00:00Z' }]);
    const d = await loadCockpitData('t1');
    expect(d.signals?.lastScanAt).toBe('2026-09-01T10:00:00Z');
  });

  it('Befund-Lader fehlgeschlagen ⇒ findings null + partialFailure (kein stilles „Nichts offen“)', async () => {
    rpcReturns({ data: [], error: null });
    api.fetchTenantFindingEvents.mockRejectedValue(new Error('rls'));
    const d = await loadCockpitData('t1');
    expect(d.signals?.findings).toBeNull();
    expect(d.partialFailures.some((f) => f.startsWith('findings:'))).toBe(true);
  });
});
