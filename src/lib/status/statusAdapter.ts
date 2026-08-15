// Status Adapter — die einzige Stelle, an der Kennzahlen für die Oberfläche
// zusammengeführt werden (docs/architecture/target-architecture.md §3.1).
//
// Die tragende Regel dieses Moduls:
//
//     Fehlender oder nicht abfragbarer Wert  →  null  →  Anzeige "—"
//     Gemessene Null                         →  0     →  Anzeige "0"
//
// Beides als 0 zu führen ist der Fehler, den dieses Modul beseitigt: eine
// leere Tabelle und eine fehlgeschlagene Abfrage sehen im Dashboard sonst
// identisch aus — und beide sehen aus wie ein Messwert.
//
// Es wird bewusst KEIN neuer Endpunkt eingeführt. Der Adapter liest die
// vorhandenen tenant-gefilterten Tabellen und den vorhandenen /health-
// Endpunkt.
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from '../supabaseUrl';

/** `null` bedeutet ausdrücklich „nicht belegbar", nicht „null Stück". */
export type MetricValue = number | null;

export interface TenantStatus {
  /** Aus compliance_score_history (jüngster Eintrag). */
  compliancePercent: MetricValue;
  /** Aus risk_dashboard_summary. Ohne Zeile: null. */
  totalRisks: MetricValue;
  criticalRisks: MetricValue;
  openRemediations: MetricValue;
  /** Direkte Zählungen — die fachlich richtigen Quellen. */
  aiSystems: MetricValue;
  evidenceItems: MetricValue;
  websites: MetricValue;
  /** Teilscores derselben Zeile — eine Abfrage, keine zweite Runde. */
  scoreDetail: ScoreDetail | null;
}

export interface ScoreDetail {
  trend_direction: 'improving' | 'stable' | 'declining' | null;
  score_gdpr: MetricValue;
  score_nis2: MetricValue;
  score_ai_act: MetricValue;
}

export const EMPTY_TENANT_STATUS: TenantStatus = {
  compliancePercent: null,
  totalRisks: null,
  criticalRisks: null,
  openRemediations: null,
  aiSystems: null,
  evidenceItems: null,
  websites: null,
  scoreDetail: null,
};

/**
 * Formatiert eine Kennzahl für die Anzeige. Ein nicht belegbarer Wert wird
 * zu "—" — niemals zu 0, "n/a" oder einem Platzhalter, der wie eine Messung
 * aussieht.
 */
export function formatMetric(value: MetricValue, suffix = ''): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value}${suffix}`;
}

/**
 * Zählt Zeilen einer tenant-gefilterten Tabelle.
 *
 * Ein Fehler (fehlende Tabelle, RLS-Verweigerung, Netzproblem) liefert
 * `null`, nicht 0. Genau hier entstünde sonst die stille Falschaussage:
 * eine nie angewendete Migration meldet PGRST205 und würde als „0 Systeme"
 * im Dashboard landen.
 */
async function countRows(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
): Promise<MetricValue> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  if (error) return null;
  return count ?? null;
}

/** Lädt den Kennzahlen-Stand eines Tenants. Jede Quelle scheitert einzeln. */
export async function loadTenantStatus(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<TenantStatus> {
  const [score, risks, aiSystems, evidenceItems, websites] = await Promise.all([
    supabase
      .from('compliance_score_history')
      .select('score_overall, trend_direction, score_gdpr, score_nis2, score_ai_act')
      .eq('tenant_id', tenantId)
      .order('recorded_at', { ascending: false })
      .limit(1),
    supabase
      .from('risk_dashboard_summary')
      .select('critical_risks_count, high_risks_count, medium_risks_count, low_risks_count, overdue_remediations')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    countRows(supabase, 'ai_systems', tenantId),
    countRows(supabase, 'evidence_items', tenantId),
    countRows(supabase, 'websites', tenantId),
  ]);

  const scoreRow = score.error ? null : score.data?.[0] ?? null;
  const riskRow = risks.error ? null : risks.data ?? null;

  const totalRisks = riskRow
    ? (riskRow.critical_risks_count ?? 0)
      + (riskRow.high_risks_count ?? 0)
      + (riskRow.medium_risks_count ?? 0)
      + (riskRow.low_risks_count ?? 0)
    : null;

  return {
    compliancePercent: scoreRow?.score_overall != null ? Math.round(scoreRow.score_overall) : null,
    totalRisks,
    criticalRisks: riskRow?.critical_risks_count ?? null,
    openRemediations: riskRow?.overdue_remediations ?? null,
    aiSystems,
    evidenceItems,
    websites,
    scoreDetail: scoreRow
      ? {
        trend_direction: scoreRow.trend_direction ?? null,
        score_gdpr: scoreRow.score_gdpr ?? null,
        score_nis2: scoreRow.score_nis2 ?? null,
        score_ai_act: scoreRow.score_ai_act ?? null,
      }
      : null,
  };
}

/** Baustein-Status, wie ihn der /health-Endpunkt liefert. */
export type ComponentStatus = 'ok' | 'degraded' | 'down' | 'unknown';

export interface PlatformHealth {
  overall: 'ok' | 'degraded' | 'down' | 'unknown';
  components: Array<{ key: string; status: ComponentStatus }>;
}

const HEALTH_COMPONENT_ORDER = ['database', 'ai_gateway', 'automation', 'bot_layer', 'evidence'] as const;

/**
 * Liest den vorhandenen /health-Endpunkt (verify_jwt=false).
 *
 * Ist er nicht erreichbar, ist das Ergebnis `unknown` — nicht `down`. Wir
 * wissen dann nichts über die Plattform, nur etwas über den eigenen Abruf.
 */
export async function loadPlatformHealth(signal?: AbortSignal): Promise<PlatformHealth> {
  try {
    const response = await fetch(`${getSupabaseUrl()}/functions/v1/health`, { signal });
    const body = await response.json() as {
      status?: PlatformHealth['overall'];
      checks?: Record<string, { status?: ComponentStatus }>;
    };
    return {
      overall: body.status ?? 'unknown',
      components: HEALTH_COMPONENT_ORDER.map((key) => ({
        key,
        status: body.checks?.[key]?.status ?? 'unknown',
      })),
    };
  } catch {
    return {
      overall: 'unknown',
      components: HEALTH_COMPONENT_ORDER.map((key) => ({ key, status: 'unknown' as const })),
    };
  }
}
