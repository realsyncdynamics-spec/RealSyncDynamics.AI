/**
 * Vertragstests für den Status Adapter.
 *
 * Der einzige Punkt, um den es hier geht: der Unterschied zwischen
 * „gemessene Null" und „nicht belegbar". Beides als 0 darzustellen ist die
 * Falschaussage, die dieser Adapter verhindert
 * (docs/architecture/target-architecture.md §3.1).
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  EMPTY_TENANT_STATUS,
  formatMetric,
  loadTenantStatus,
} from '../../src/lib/status/statusAdapter';

const TENANT = '11111111-1111-1111-1111-111111111111';

type TableResult = { data?: unknown; count?: number | null; error?: { message: string } | null };

/**
 * Minimaler Supabase-Stub. Bildet nur die im Adapter benutzte Kette ab:
 * from().select().eq() → thenable, plus order().limit() und maybeSingle().
 */
function stubClient(tables: Record<string, TableResult>): SupabaseClient {
  const from = (table: string) => {
    const result = tables[table] ?? { error: { message: `unstubbed table ${table}` } };
    const payload = {
      data: result.data ?? null,
      count: result.count ?? null,
      error: result.error ?? null,
    };
    const chain = {
      eq: () => chain,
      order: () => chain,
      limit: () => Promise.resolve(payload),
      maybeSingle: () => Promise.resolve(payload),
      then: (resolve: (value: typeof payload) => unknown) => Promise.resolve(payload).then(resolve),
    };
    return { select: () => chain };
  };
  return { from } as unknown as SupabaseClient;
}

describe('formatMetric', () => {
  it('zeigt "—" für einen nicht belegbaren Wert', () => {
    expect(formatMetric(null)).toBe('—');
    expect(formatMetric(null, '%')).toBe('—');
  });

  it('zeigt eine gemessene Null als 0 — nicht als "—"', () => {
    expect(formatMetric(0)).toBe('0');
    expect(formatMetric(0, '%')).toBe('0%');
  });

  it('hängt das Suffix nur an echte Werte an', () => {
    expect(formatMetric(87, '%')).toBe('87%');
  });

  it('behandelt NaN wie einen fehlenden Wert', () => {
    expect(formatMetric(Number.NaN)).toBe('—');
  });
});

describe('loadTenantStatus', () => {
  it('liefert 0 für eine leere Tabelle und null für eine fehlgeschlagene Abfrage', async () => {
    const client = stubClient({
      compliance_score_history: { data: [] },
      risk_dashboard_summary: { data: null },
      ai_systems: { count: 0 },                                        // leer, aber messbar
      evidence_items: { error: { message: 'PGRST205: not found' } },   // nicht messbar
      websites: { count: 3 },
    });

    const status = await loadTenantStatus(client, TENANT);

    expect(status.aiSystems).toBe(0);
    expect(status.evidenceItems).toBeNull();
    expect(status.websites).toBe(3);
  });

  it('meldet null statt 0, wenn kein Compliance-Score existiert', async () => {
    const client = stubClient({
      compliance_score_history: { data: [] },
      risk_dashboard_summary: { data: null },
      ai_systems: { count: 0 },
      evidence_items: { count: 0 },
      websites: { count: 0 },
    });

    const status = await loadTenantStatus(client, TENANT);

    expect(status.compliancePercent).toBeNull();
    expect(status.scoreDetail).toBeNull();
  });

  it('rundet den Score und übernimmt die Teilscores aus derselben Zeile', async () => {
    const client = stubClient({
      compliance_score_history: {
        data: [{ score_overall: 86.6, trend_direction: 'declining', score_gdpr: 90, score_nis2: null, score_ai_act: 72 }],
      },
      risk_dashboard_summary: { data: null },
      ai_systems: { count: 4 },
      evidence_items: { count: 12 },
      websites: { count: 1 },
    });

    const status = await loadTenantStatus(client, TENANT);

    expect(status.compliancePercent).toBe(87);
    expect(status.scoreDetail?.trend_direction).toBe('declining');
    expect(status.scoreDetail?.score_nis2).toBeNull();
  });

  it('summiert Risiken nur, wenn eine Zeile existiert — sonst null', async () => {
    const withRow = stubClient({
      compliance_score_history: { data: [] },
      risk_dashboard_summary: { data: { critical_risks_count: 2, high_risks_count: 1, medium_risks_count: 0, low_risks_count: 4, overdue_remediations: 3 } },
      ai_systems: { count: 0 },
      evidence_items: { count: 0 },
      websites: { count: 0 },
    });
    const withoutRow = stubClient({
      compliance_score_history: { data: [] },
      risk_dashboard_summary: { data: null },
      ai_systems: { count: 0 },
      evidence_items: { count: 0 },
      websites: { count: 0 },
    });

    expect((await loadTenantStatus(withRow, TENANT)).totalRisks).toBe(7);
    expect((await loadTenantStatus(withRow, TENANT)).openRemediations).toBe(3);
    // Ohne Zeile ist der Wert unbekannt — nicht „keine Risiken".
    expect((await loadTenantStatus(withoutRow, TENANT)).totalRisks).toBeNull();
    expect((await loadTenantStatus(withoutRow, TENANT)).openRemediations).toBeNull();
  });

  it('EMPTY_TENANT_STATUS enthält ausschliesslich null — kein Wert wird vorgetäuscht', () => {
    for (const value of Object.values(EMPTY_TENANT_STATUS)) {
      expect(value).toBeNull();
    }
  });
});
