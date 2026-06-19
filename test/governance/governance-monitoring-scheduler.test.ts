import { describe, it, expect } from 'vitest';

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
