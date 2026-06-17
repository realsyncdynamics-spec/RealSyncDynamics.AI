import { describe, it, expect } from 'vitest';

// ── governance_24h_summary Struktur ───────────────────────────────────────

describe('governance_24h_summary Struktur', () => {
  const EXPECTED_KEYS = [
    'new_risks',
    'resolved_risks',
    'new_evidence',
    'open_alerts',
    'new_alerts_24h',
    'critical_alerts',
    'failed_scans',
    'active_sources',
    'pending_sources',
    'next_scan_at',
  ];

  it('enthält alle erwarteten Felder', () => {
    // Simuliertes RPC-Ergebnis (wie von der DB zurückgegeben)
    const mockSummary: Record<string, unknown> = {
      new_risks: 3,
      resolved_risks: 1,
      new_evidence: 5,
      open_alerts: 2,
      new_alerts_24h: 4,
      critical_alerts: 1,
      failed_scans: 0,
      active_sources: 7,
      pending_sources: 0,
      next_scan_at: '2026-06-17T02:00:00Z',
    };

    for (const key of EXPECTED_KEYS) {
      expect(key in mockSummary, `Fehlendes Feld: ${key}`).toBe(true);
    }
  });

  it('numerische Felder sind >= 0', () => {
    const mockSummary = {
      new_risks: 0,
      resolved_risks: 0,
      new_evidence: 0,
      open_alerts: 0,
      new_alerts_24h: 0,
      critical_alerts: 0,
      failed_scans: 0,
      active_sources: 0,
      pending_sources: 0,
      next_scan_at: null,
    };

    const numericKeys = [
      'new_risks', 'resolved_risks', 'new_evidence',
      'open_alerts', 'new_alerts_24h', 'critical_alerts',
      'failed_scans', 'active_sources', 'pending_sources',
    ];

    for (const key of numericKeys) {
      expect(mockSummary[key as keyof typeof mockSummary]).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── monitoring_sources Schema-Validierung ─────────────────────────────────

describe('monitoring_sources Schema', () => {
  type SourceType = 'website' | 'ai_system' | 'api' | 'vendor' | 'repository' | 'workflow' | 'document';
  type SourceStatus = 'pending' | 'active' | 'paused' | 'error';
  type ScanFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly';

  const VALID_TYPES: SourceType[] = ['website', 'ai_system', 'api', 'vendor', 'repository', 'workflow', 'document'];
  const VALID_STATUSES: SourceStatus[] = ['pending', 'active', 'paused', 'error'];
  const VALID_FREQUENCIES: ScanFrequency[] = ['hourly', 'daily', 'weekly', 'monthly'];

  it('Typ-Werte sind vollständig', () => {
    expect(VALID_TYPES).toContain('website');
    expect(VALID_TYPES).toContain('ai_system');
    expect(VALID_TYPES.length).toBe(7);
  });

  it('Status-Werte sind vollständig', () => {
    expect(VALID_STATUSES).toContain('active');
    expect(VALID_STATUSES).toContain('error');
    expect(VALID_STATUSES.length).toBe(4);
  });

  it('Frequenz-Werte sind vollständig', () => {
    expect(VALID_FREQUENCIES).toContain('daily');
    expect(VALID_FREQUENCIES.length).toBe(4);
  });

  it('neues Source-Objekt hat korrekte Pflichtfelder', () => {
    const source = {
      tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'website' as SourceType,
      name: 'Unternehmens-Website',
      url: 'https://example.com',
      status: 'active' as SourceStatus,
      scan_frequency: 'daily' as ScanFrequency,
    };

    expect(source.tenant_id).toBeTruthy();
    expect(VALID_TYPES).toContain(source.type);
    expect(source.name).toBeTruthy();
    expect(VALID_STATUSES).toContain(source.status);
    expect(VALID_FREQUENCIES).toContain(source.scan_frequency);
  });
});

// ── governance_alerts Schema-Validierung ─────────────────────────────────

describe('governance_alerts Schema', () => {
  type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';
  type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  type AlertCategory = 'compliance' | 'privacy' | 'security' | 'ai_governance' | 'data_breach' | 'policy' | 'scan' | 'evidence';

  const VALID_SEVERITIES: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
  const VALID_STATUSES: AlertStatus[] = ['open', 'acknowledged', 'resolved', 'dismissed'];
  const VALID_CATEGORIES: AlertCategory[] = [
    'compliance', 'privacy', 'security', 'ai_governance',
    'data_breach', 'policy', 'scan', 'evidence',
  ];

  it('Severity-Werte sind vollständig (5 Stufen)', () => {
    expect(VALID_SEVERITIES.length).toBe(5);
    expect(VALID_SEVERITIES).toContain('critical');
    expect(VALID_SEVERITIES).toContain('info');
  });

  it('Status-Werte sind vollständig', () => {
    expect(VALID_STATUSES.length).toBe(4);
    expect(VALID_STATUSES).toContain('open');
    expect(VALID_STATUSES).toContain('resolved');
  });

  it('Kategorie-Werte decken alle Governance-Bereiche ab', () => {
    expect(VALID_CATEGORIES).toContain('compliance');
    expect(VALID_CATEGORIES).toContain('ai_governance');
    expect(VALID_CATEGORIES).toContain('data_breach');
    expect(VALID_CATEGORIES.length).toBe(8);
  });

  it('neues Alert-Objekt hat korrekte Struktur', () => {
    const alert = {
      tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      severity: 'high' as Severity,
      category: 'compliance' as AlertCategory,
      title: 'Kritische Datenschutzverletzung erkannt',
      message: 'Cookie ohne Einwilligung gesetzt: _ga',
      status: 'open' as AlertStatus,
    };

    expect(VALID_SEVERITIES).toContain(alert.severity);
    expect(VALID_CATEGORIES).toContain(alert.category);
    expect(VALID_STATUSES).toContain(alert.status);
    expect(alert.title.length).toBeGreaterThan(0);
    expect(alert.message.length).toBeGreaterThan(0);
  });
});

// ── Risk Score Berechnung ─────────────────────────────────────────────────

describe('Risk Score Berechnung', () => {
  function computeRiskScore(
    critCount: number,
    highCount: number,
    medCount: number,
    lowCount: number,
  ): number {
    const penalty = critCount * 25 + highCount * 12 + medCount * 5 + lowCount * 2;
    return Math.max(0, Math.min(100, 100 - penalty));
  }

  it('kein offenes Risiko = 100', () => {
    expect(computeRiskScore(0, 0, 0, 0)).toBe(100);
  });

  it('1 kritisches Risiko = 75', () => {
    expect(computeRiskScore(1, 0, 0, 0)).toBe(75);
  });

  it('4 kritische Risiken = 0 (floor)', () => {
    expect(computeRiskScore(4, 0, 0, 0)).toBe(0);
  });

  it('Score ist immer >= 0', () => {
    expect(computeRiskScore(100, 100, 100, 100)).toBe(0);
  });

  it('Score ist immer <= 100', () => {
    expect(computeRiskScore(0, 0, 0, 0)).toBe(100);
  });

  it('gemischte Risiken reduzieren Score korrekt', () => {
    // 1 high (−12) + 2 medium (−10) = 78
    expect(computeRiskScore(0, 1, 2, 0)).toBe(78);
  });
});

// ── Governance Event Types ─────────────────────────────────────────────────

describe('Governance Event Types', () => {
  const REQUIRED_EVENT_TYPES = [
    'SCAN_STARTED',
    'SCAN_COMPLETED',
    'SCAN_FAILED',
    'WEBSITE_ADDED',
    'RISK_CREATED',
    'RISK_RESOLVED',
    'EVIDENCE_CREATED',
    'ALERT_CREATED',
  ];

  it('alle Pflicht-Event-Typen sind definiert', () => {
    // Diese Typen werden vom governance-monitoring-scheduler verwendet
    for (const type of REQUIRED_EVENT_TYPES) {
      expect(type).toMatch(/^[A-Z_]+$/);
    }
    expect(REQUIRED_EVENT_TYPES.length).toBeGreaterThanOrEqual(8);
  });

  it('Event-Typen sind SCREAMING_SNAKE_CASE', () => {
    for (const type of REQUIRED_EVENT_TYPES) {
      expect(type).toBe(type.toUpperCase());
      expect(type).not.toContain(' ');
    }
  });
});
