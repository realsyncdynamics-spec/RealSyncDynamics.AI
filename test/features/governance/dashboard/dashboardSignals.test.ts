/**
 * Addendum P0 (RSD Dashboard, 25.09.2026): gemeinsame Schwellen, Evidence-
 * Frische, Aufmerksamkeit, Befund-Paarung, Mandanten-Anzeigename.
 */
import { describe, expect, it } from 'vitest';
import {
  daysSince,
  ELEVATED_RISK_THRESHOLD,
  elevatedAssetsOf,
  EVIDENCE_MIN_ENTRIES,
  EVIDENCE_STALE_DAYS,
  formatAgeDe,
  isFindingEventType,
  pairFindings,
  parseResolvePayload,
  resolutionIndex,
  resolvedLabel,
  RISK_THRESHOLDS,
  riskAttentionSignals,
  riskBucketFor,
  summarizeFindings,
  tenantDisplayName,
  type DashboardSignals,
} from '../../../../src/features/governance/dashboard/dashboardSignals';
import {
  computeEvidenceHealth,
  computeRiskDistribution,
  computeRiskIndex,
  HIGH_RISK_ASSET_THRESHOLD,
} from '../../../../src/features/governance/dashboard/complianceStatus';
import { collectCriticalFindings } from '../../../../src/features/governance/dashboard/ComplianceStatusDashboard';

const NOW = Date.parse('2026-09-25T12:00:00Z');
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

describe('Risiko-Schwellen — eine Quelle', () => {
  it('Buckets an den Grenzen', () => {
    expect(riskBucketFor(RISK_THRESHOLDS.critical)).toBe('critical');
    expect(riskBucketFor(RISK_THRESHOLDS.critical - 1)).toBe('high');
    expect(riskBucketFor(RISK_THRESHOLDS.high)).toBe('high');
    expect(riskBucketFor(RISK_THRESHOLDS.high - 1)).toBe('medium');
    expect(riskBucketFor(RISK_THRESHOLDS.medium)).toBe('medium');
    expect(riskBucketFor(RISK_THRESHOLDS.low)).toBe('low');
    expect(riskBucketFor(0)).toBe('passed');
  });

  it('Residualrisiko-Kachel und Risk Distribution klassifizieren identisch (Live: 68 / 0)', () => {
    const scores = [68, 0];
    const risk = computeRiskIndex({ assetScores: scores, newRisks24h: 0, openIncidents: 0, dsrOverdue: 0 });
    const dist = computeRiskDistribution(scores);
    const elevatedInDist = dist.filter((b) => b.id === 'high' || b.id === 'critical').reduce((n, b) => n + b.count, 0);
    expect(HIGH_RISK_ASSET_THRESHOLD).toBe(ELEVATED_RISK_THRESHOLD);
    expect(risk.highRiskAssets).toBe(elevatedInDist);
    expect(risk.highRiskAssets).toBe(1);
    // Mittelwert 34 → 20: Stufe „Gering“ ist der Mittelwert, nicht das Einzel-Asset.
    expect(risk.score).toBe(20);
    expect(risk.label).toBe('Gering');
  });

  it('erhöhte Assets = Bucket Hoch/Kritisch, absteigend', () => {
    const out = elevatedAssetsOf([
      { id: 'a', name: 'A', risk_score: 49 },
      { id: 'b', name: 'B', risk_score: 50 },
      { id: 'c', name: 'C', risk_score: 90 },
    ]);
    expect(out.map((a) => [a.id, a.bucket])).toEqual([['c', 'critical'], ['b', 'high']]);
  });
});

describe('Evidence-Frische', () => {
  const base = { coveragePercent: null, newEvidence24h: 0, failedScans: 0, now: NOW };

  it(`unter ${EVIDENCE_MIN_ENTRIES} Einträgen kein Wert, sondern „Zu wenig Daten“`, () => {
    const h = computeEvidenceHealth({ ...base, totalCount: 1, hashedCount: 1, latestEvidenceAt: iso(89) });
    expect(h.percent).toBeNull();
    expect(h.label).toBe('Zu wenig Daten');
    expect(h.freshness).toBe('insufficient');
    expect(h.latestAgeDays).toBe(89);
  });

  it(`älter als ${EVIDENCE_STALE_DAYS} Tage ⇒ „Veraltet“ statt „Prüfbar“, nie grün`, () => {
    const h = computeEvidenceHealth({ ...base, totalCount: 5, hashedCount: 5, latestEvidenceAt: iso(EVIDENCE_STALE_DAYS + 1) });
    expect(h.percent).toBe(100);
    expect(h.label).toBe('Veraltet');
    expect(h.freshness).toBe('stale');
    expect(h.level).toBe('medium');
  });

  it('genau an der Schwelle noch frisch', () => {
    const h = computeEvidenceHealth({ ...base, totalCount: 5, hashedCount: 5, latestEvidenceAt: iso(EVIDENCE_STALE_DAYS) });
    expect(h.label).toBe('Prüfbar');
    expect(h.freshness).toBe('fresh');
  });

  it('daysSince / formatAgeDe', () => {
    expect(daysSince(iso(89), NOW)).toBe(89);
    expect(daysSince(null, NOW)).toBeNull();
    expect(daysSince('kaputt', NOW)).toBeNull();
    expect(formatAgeDe(0)).toBe('heute');
    expect(formatAgeDe(1)).toBe('vor 1 Tag');
    expect(formatAgeDe(89)).toBe('vor 89 Tagen');
  });
});

function ev(id: string, type: string, createdAt: string, extra: Record<string, unknown> = {}) {
  return {
    id, event_type: type, created_at: createdAt, title: id, risk_level: 'medium' as const,
    event_source: 'website_scanner', asset_id: null, payload: {}, ...extra,
  };
}

describe('Befund-Paarung (append-only, payload.resolves_event_id)', () => {
  it('erkennt Befund-Events', () => {
    expect(isFindingEventType('email_auth_finding')).toBe(true);
    expect(isFindingEventType('finding')).toBe(true);
    expect(isFindingEventType('email_auth_resolved')).toBe(false);
  });

  it('*_resolved verweist auf das alte Event ⇒ behoben mit Datum', () => {
    const events = [
      ev('r1', 'email_auth_resolved', '2026-09-20T08:00:00Z', { payload: { resolves_event_id: 'f1' } }),
      ev('f1', 'email_auth_finding', '2026-06-27T23:02:04Z'),
      ev('f2', 'email_auth_finding', '2026-07-01T10:00:00Z'),
    ];
    const findings = pairFindings(events);
    expect(findings.map((f) => [f.id, f.resolvedAt])).toEqual([
      ['f1', '2026-09-20T08:00:00Z'],
      ['f2', null],
    ]);
    expect(summarizeFindings(findings).medium.map((f) => f.id)).toEqual(['f2']);
  });

  it('frühestes Behebungs-Event gewinnt; Events ohne resolves_event_id paaren nicht', () => {
    const idx = resolutionIndex([
      ev('r2', 'email_auth_resolved', '2026-09-22T08:00:00Z', { payload: { resolves_event_id: 'f1' } }),
      ev('r1', 'email_auth_resolved', '2026-09-20T08:00:00Z', { payload: { resolves_event_id: 'f1' } }),
      ev('r3', 'email_auth_resolved', '2026-09-21T08:00:00Z', { payload: {} }),
      ev('x', 'email_auth_finding', '2026-09-21T08:00:00Z', { payload: { resolves_event_id: 'f9' } }),
    ]);
    expect(idx.get('f1')?.resolvedAt).toBe('2026-09-20T08:00:00Z');
    expect(idx.get('f1')?.resolveEventId).toBe('r1');
    expect(idx.has('f9')).toBe(false);
    expect(idx.size).toBe(1);
  });
});

describe('„Braucht Aufmerksamkeit“', () => {
  const signals = (over: Partial<DashboardSignals> = {}): DashboardSignals => ({
    elevatedAssets: [], findings: [], lastScanAt: null, latestEvidenceAt: null, ...over,
  });

  it('erhöhtes Asset oder offener Befund ⇒ nie leer (kein „Nichts offen“)', () => {
    const out = riskAttentionSignals(signals({
      elevatedAssets: [{ id: 'w1', name: 'realsyncdynamicsai.de', score: 68, bucket: 'high' }],
      findings: pairFindings([ev('f1', 'email_auth_finding', iso(89))]),
    }), NOW);
    expect(out.map((s) => s.id)).toEqual(['risk-w1', 'finding-f1']);
    expect(out[0].reason).toBe('Risiko-Score 68 · Hoch (ab 50)');
    expect(out[1].reason).toBe('Scanner-Befund · mittel · vor 89 Tagen');
  });

  it('behobener Befund und niedrige Stufen zählen nicht', () => {
    const findings = pairFindings([
      ev('r1', 'email_auth_resolved', iso(5), { payload: { resolves_event_id: 'f1' } }),
      ev('f1', 'email_auth_finding', iso(89)),
      ev('f2', 'email_auth_finding', iso(3), { risk_level: 'low' }),
    ]);
    expect(riskAttentionSignals(signals({ findings }), NOW)).toEqual([]);
  });

  it('ohne Signale (Lader nicht gelaufen) keine Einträge', () => {
    expect(riskAttentionSignals(undefined)).toEqual([]);
  });
});

describe('„Kritische Befunde“', () => {
  it('zählt Pflichten, erhöhte Assets und hohe Scanner-Befunde; mittlere nur als Hinweis', () => {
    const { items, mediumHints } = collectCriticalFindings(
      [],
      {
        elevatedAssets: [{ id: 'w1', name: 'realsyncdynamicsai.de', score: 68, bucket: 'high' }],
        findings: pairFindings([
          ev('f1', 'email_auth_finding', iso(89)),
          ev('f3', 'tls_finding', iso(2), { risk_level: 'critical', title: 'TLS abgelaufen' }),
        ]),
        lastScanAt: null,
        latestEvidenceAt: null,
      },
      NOW,
    );
    expect(items.map((i) => [i.id, i.level])).toEqual([['risk-w1', 'high'], ['finding-f3', 'critical']]);
    expect(items[1].detail).toBe('Scanner-Befund · kritisch · vor 2 Tagen');
    expect(mediumHints).toEqual(['f1 · mittel · vor 89 Tagen']);
  });
});

describe('Mandanten-Anzeigename', () => {
  it('DE: „Workspace von …“ statt englischem Genitiv', () => {
    expect(tenantDisplayName("Realsyncdynamics's Workspace", 'de')).toBe('Workspace von Realsyncdynamics');
    expect(tenantDisplayName('Probe B’s Workspace', 'de')).toBe('Workspace von Probe B');
  });
  it('EN und eigene Namen bleiben unverändert', () => {
    expect(tenantDisplayName("Realsyncdynamics's Workspace", 'en')).toBe("Realsyncdynamics's Workspace");
    expect(tenantDisplayName('Acme GmbH', 'de')).toBe('Acme GmbH');
  });
});

/**
 * Echte Daten (Mandant e6b3c8dd, von Dominik freigegeben, 25.09.2026):
 * email_auth_resolved 33762763… behebt den DMARC-Befund e712035d… vom 28.06.
 * Payload exakt im verbindlichen Backend-Vertrag.
 */
describe('Behebung — realer Payload (email_auth_resolved, manual_owner_approved)', () => {
  const OLD_FINDING = {
    id: 'e712035d-0ea0-4d83-8a9a-ca071202910d',
    event_type: 'email_auth_finding',
    event_source: 'website_scanner',
    risk_level: 'medium' as const,
    asset_id: '1838591e-7e42-46b6-a371-19341e9f922c',
    title: 'E-Mail-Authentifizierung: DMARC fehlt',
    created_at: '2026-06-27T23:02:04.319787+00:00',
    payload: {
      spf: 'v=spf1 include:_spf.mail.hostinger.com ~all',
      dkim: 'not_detected_at_root',
      dmarc: 'absent',
      domain: 'realsyncdynamicsai.de',
      checked_at: '2026-06-28',
    },
  };
  const RESOLVE = {
    id: '33762763-3d6a-4482-b53d-662f15c0c7d9',
    event_type: 'email_auth_resolved',
    event_source: 'website_scanner',
    risk_level: 'info' as const,
    asset_id: '1838591e-7e42-46b6-a371-19341e9f922c',
    title: 'E-Mail-Authentifizierung: DMARC gesetzt',
    created_at: '2026-09-25T21:05:10.474336+00:00',
    payload: {
      resolves_event_id: 'e712035d-0ea0-4d83-8a9a-ca071202910d',
      check: 'dmarc',
      domain: 'realsyncdynamicsai.de',
      previous_state: { dmarc: 'absent', checked_at: '2026-06-28' },
      current_state: {
        pct: 100, rua: 'mailto:realsyncdynamics@gmail.com', aspf: 's', adkim: 's', dmarc: 'present',
        policy: 'quarantine',
        record: 'v=DMARC1; p=quarantine; rua=mailto:realsyncdynamics@gmail.com; pct=100; adkim=s; aspf=s',
      },
      checked_at: '2026-09-25T21:04:48Z',
      evidence_id: '58bca6e1-010f-4a84-807f-41b727c80699',
      finding_id: null,
      scanner_version: 'manual-2026-09-25',
      source: 'manual_owner_approved',
    },
  };
  const LIVE_NOW = Date.parse('2026-09-25T21:30:00Z');

  it('parst den Vertrag vollständig', () => {
    const p = parseResolvePayload(RESOLVE.payload);
    expect(p).toMatchObject({
      resolves_event_id: 'e712035d-0ea0-4d83-8a9a-ca071202910d',
      check: 'dmarc',
      domain: 'realsyncdynamicsai.de',
      checked_at: '2026-09-25T21:04:48Z',
      evidence_id: '58bca6e1-010f-4a84-807f-41b727c80699',
      finding_id: null,
      scanner_version: 'manual-2026-09-25',
      source: 'manual_owner_approved',
    });
    expect(p?.previous_state).toEqual({ dmarc: 'absent', checked_at: '2026-06-28' });
    expect(p?.current_state?.policy).toBe('quarantine');
  });

  it('altes Event: behoben am 25.09. (checked_at), manuell bestätigt', () => {
    const idx = resolutionIndex([RESOLVE, OLD_FINDING]);
    const r = idx.get(OLD_FINDING.id);
    expect(r?.resolvedAt).toBe('2026-09-25T21:04:48Z');
    expect(r?.manual).toBe(true);
    expect(r?.resolveEventId).toBe(RESOLVE.id);
    expect(r?.evidenceId).toBe('58bca6e1-010f-4a84-807f-41b727c80699');
    expect(resolvedLabel(r!.resolvedAt, r!.manual)).toBe('behoben am 25.09. · manuell bestätigt');
  });

  it('ohne checked_at ⇒ created_at des Behebungs-Events', () => {
    const noChecked = { ...RESOLVE, payload: { ...RESOLVE.payload, checked_at: null } };
    expect(resolutionIndex([noChecked]).get(OLD_FINDING.id)?.resolvedAt).toBe(RESOLVE.created_at);
    expect(resolvedLabel(RESOLVE.created_at)).toBe('behoben am 25.09.');
  });

  it('weder Aufmerksamkeit noch kritischer/mittlerer Befund — auch das Behebungs-Event selbst nicht', () => {
    const findings = pairFindings([RESOLVE, OLD_FINDING]);
    expect(findings).toHaveLength(1); // das Behebungs-Event ist kein Befund
    expect(findings[0].resolvedAt).toBe('2026-09-25T21:04:48Z');
    expect(findings[0].resolvedManually).toBe(true);
    const signals: DashboardSignals = { elevatedAssets: [], findings, lastScanAt: null, latestEvidenceAt: null };
    expect(riskAttentionSignals(signals, LIVE_NOW)).toEqual([]);
    const { items, mediumHints } = collectCriticalFindings([], signals, LIVE_NOW);
    expect(items).toEqual([]);
    expect(mediumHints).toEqual([]);
  });

  it('tolerant: Behebungs-Events ohne gültige resolves_event_id werden ignoriert', () => {
    const broken = [
      { ...RESOLVE, id: 'b1', payload: { ...RESOLVE.payload, resolves_event_id: '' } },
      { ...RESOLVE, id: 'b2', payload: { ...RESOLVE.payload, resolves_event_id: 42 } },
      { ...RESOLVE, id: 'b3', payload: null },
      { ...RESOLVE, id: 'b4', payload: 'kaputt' as unknown as Record<string, unknown> },
    ];
    expect(resolutionIndex(broken).size).toBe(0);
    expect(pairFindings([...broken, OLD_FINDING])[0].resolvedAt).toBeNull();
    expect(parseResolvePayload({ resolves_event_id: 'x', check: 'mx', source: 'robot', checked_at: 'nie' })).toMatchObject({
      resolves_event_id: 'x', check: null, source: null, checked_at: null,
    });
  });
});
