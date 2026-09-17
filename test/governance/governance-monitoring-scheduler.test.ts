import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildGovernanceEventRow,
  buildSourceSelection,
  parseSchedulerRequestBody,
  scanDurationMs,
} from '../../supabase/functions/_shared/governanceMonitoringScheduler';

// ── nextScanAt — Intervall-Berechnung ─────────────────────────────────────
// Spiegelt die Logik aus supabase/functions/governance-monitoring-scheduler/index.ts

function nextScanAt(frequency: string): Date {
  const now = Date.now();
  const ms = ({
    hourly:  3_600_000,
    daily:   86_400_000,
    weekly:  604_800_000,
    monthly: 2_592_000_000,
  } as Record<string, number>)[frequency] ?? 86_400_000;
  return new Date(now + ms);
}

describe('nextScanAt — Scan-Intervalle', () => {
  it('hourly = ~1 Stunde in der Zukunft', () => {
    const t = nextScanAt('hourly');
    const diff = t.getTime() - Date.now();
    expect(diff).toBeGreaterThan(3_590_000);
    expect(diff).toBeLessThan(3_610_000);
  });

  it('daily = ~24 Stunden in der Zukunft', () => {
    const t = nextScanAt('daily');
    const diff = t.getTime() - Date.now();
    expect(diff).toBeGreaterThan(86_390_000);
    expect(diff).toBeLessThan(86_410_000);
  });

  it('weekly = ~7 Tage in der Zukunft', () => {
    const t = nextScanAt('weekly');
    const diff = t.getTime() - Date.now();
    expect(diff).toBeGreaterThan(604_790_000);
    expect(diff).toBeLessThan(604_810_000);
  });

  it('monthly = ~30 Tage in der Zukunft', () => {
    const t = nextScanAt('monthly');
    const diff = t.getTime() - Date.now();
    expect(diff).toBeGreaterThan(2_591_990_000);
    expect(diff).toBeLessThan(2_592_010_000);
  });

  it('unbekannte Frequenz fällt auf daily zurück', () => {
    const t = nextScanAt('unknown');
    const diff = t.getTime() - Date.now();
    expect(diff).toBeGreaterThan(86_390_000);
    expect(diff).toBeLessThan(86_410_000);
  });
});

// ── Score-Delta Berechnung ────────────────────────────────────────────────

describe('Score-Delta und Alert-Schwere', () => {
  function computeSeverity(scoreDelta: number | null): 'critical' | 'high' | null {
    if (scoreDelta === null || scoreDelta <= 10) return null;
    return scoreDelta > 30 ? 'critical' : 'high';
  }

  it('kein Delta → kein Alert', () => {
    expect(computeSeverity(null)).toBeNull();
  });

  it('Delta <= 10 → kein Alert', () => {
    expect(computeSeverity(5)).toBeNull();
    expect(computeSeverity(10)).toBeNull();
  });

  it('Delta 11–30 → high Alert', () => {
    expect(computeSeverity(11)).toBe('high');
    expect(computeSeverity(30)).toBe('high');
  });

  it('Delta > 30 → critical Alert', () => {
    expect(computeSeverity(31)).toBe('critical');
    expect(computeSeverity(100)).toBe('critical');
  });
});

// ── Score-Extraktion aus Scan-Response ───────────────────────────────────

describe('Score aus ScanResponse', () => {
  function extractScore(result: { risk_score?: number; score?: number }): number | null {
    return result.risk_score ?? result.score ?? null;
  }

  it('risk_score hat Vorrang vor score', () => {
    expect(extractScore({ risk_score: 80, score: 60 })).toBe(80);
  });

  it('score als Fallback wenn risk_score fehlt', () => {
    expect(extractScore({ score: 70 })).toBe(70);
  });

  it('null wenn beide fehlen', () => {
    expect(extractScore({})).toBeNull();
  });
});

// ── Source-Status-Transitions ─────────────────────────────────────────────

describe('Monitoring Source Status nach Scan', () => {
  type Status = 'active' | 'error' | 'pending' | 'paused';

  function statusAfterScan(hasError: boolean): Status {
    return hasError ? 'error' : 'active';
  }

  it('erfolgreicher Scan → active', () => {
    expect(statusAfterScan(false)).toBe('active');
  });

  it('fehlgeschlagener Scan → error', () => {
    expect(statusAfterScan(true)).toBe('error');
  });
});

// ── Kritische Issues Filter ───────────────────────────────────────────────

describe('Kritische Issues aus Scan-Ergebnis', () => {
  type Issue = { risk: string; issue: string };

  function filterCriticalIssues(issues: Issue[]): Issue[] {
    return issues.filter((i) => i.risk === 'high' || i.risk === 'critical').slice(0, 5);
  }

  it('filtert nur high + critical', () => {
    const issues: Issue[] = [
      { risk: 'low', issue: 'Cookie ohne SameSite' },
      { risk: 'high', issue: 'Tracking ohne Einwilligung' },
      { risk: 'critical', issue: 'DSGVO-Verletzung' },
      { risk: 'medium', issue: 'Veraltetes Zertifikat' },
    ];
    const result = filterCriticalIssues(issues);
    expect(result.length).toBe(2);
    expect(result.every((i) => i.risk === 'high' || i.risk === 'critical')).toBe(true);
  });

  it('maximal 5 kritische Issues werden gemeldet', () => {
    const issues: Issue[] = Array.from({ length: 10 }, (_, i) => ({
      risk: 'critical',
      issue: `Issue ${i}`,
    }));
    expect(filterCriticalIssues(issues).length).toBe(5);
  });

  it('leere Liste → keine Alerts', () => {
    expect(filterCriticalIssues([])).toHaveLength(0);
  });
});

describe('Auth — Cron darf nur mit CRON_GOVERNANCE_MONITORING_KEY ticken', () => {
  it('weist Aufrufe ohne passenden Bearer mit 401 ab (fail-closed)', () => {
    const src = readFileSync(
      'supabase/functions/governance-monitoring-scheduler/index.ts',
      'utf8',
    );
    expect(src).toContain('CRON_GOVERNANCE_MONITORING_KEY');
    expect(src).toContain("error: 'cron only'");
    expect(src).toMatch(/!CRON_KEY\s*\|\|/);
    expect(src).toMatch(/jsonResponse\(\{ error: 'cron only' \}, 401\)/);
    expect(src).not.toMatch(
      /authHeader\s*!==\s*`Bearer \$\{SERVICE_KEY\}`/,
    );
  });
});

describe('Scheduler-Filter und Prüfpfad', () => {
  it('rejects malformed JSON instead of falling back to a full run', () => {
    expect(() => parseSchedulerRequestBody('{"source_id":')).toThrow(/invalid|Unexpected/i);
    expect(parseSchedulerRequestBody('   ')).toEqual({});
    const src = readFileSync(
      'supabase/functions/governance-monitoring-scheduler/index.ts',
      'utf8',
    );
    expect(src).toContain("return jsonResponse({ error: 'invalid json' }, 400);");
  });

  it('beachtet frequency_filter für den stündlichen Cron-Lauf', () => {
    const out = buildSourceSelection({ frequency_filter: 'hourly' }, '2026-09-17T00:00:00.000Z');
    expect(out).toMatchObject({
      limit: 50,
      source_id: null,
      dueBefore: '2026-09-17T00:00:00.000Z',
      frequency_filter: 'hourly',
    });
    expect(out.statuses).toEqual(['active']);
  });

  it('unterstützt source_id für gezielte Rechecks statt Vollscan', () => {
    const out = buildSourceSelection({ source_id: 'src-1', frequency_filter: 'hourly' }, '2026-09-17T00:00:00.000Z');
    expect(out).toEqual({
      limit: 1,
      source_id: 'src-1',
      statuses: ['active', 'error'],
      dueBefore: null,
      frequency_filter: 'hourly',
    });
  });

  it('schreibt Governance-Events mit gültigem event_source und verlinktem Asset', () => {
    expect(buildGovernanceEventRow({
      tenantId: 'tenant-1',
      sourceId: 'source-7',
      assetId: 'asset-9',
      eventType: 'SCAN_COMPLETED',
      payload: { duration_ms: 123, score: 88 },
    })).toEqual({
      tenant_id: 'tenant-1',
      event_type: 'SCAN_COMPLETED',
      event_source: 'agent_runtime',
      risk_level: 'low',
      payload: { source_id: 'source-7', duration_ms: 123, score: 88 },
      asset_id: 'asset-9',
    });
  });

  it('erfasst pro Scan duration_ms für Metriken und Reporting', () => {
    expect(scanDurationMs(1_000, 1_123)).toBe(123);
    expect(scanDurationMs(5_000, 4_900)).toBe(0);
  });
});
