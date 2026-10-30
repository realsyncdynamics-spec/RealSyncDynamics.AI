/**
 * M8 — Monitoring, Sicherheit, Kosten (lesend). Zahlen stammen ausschließlich aus
 * cc_cost_by_source_v / cc_critical_events_v / cc_audit_feed_v / cc_platform_health().
 */
export interface CostRow { source: string; month: string; metric: string; basis: string; cost_usd: number | string | null; tokens: number | string | null; entries: number | string; last_at: string | null }
export interface CriticalEvent { at: string; kind: string; severity: 'high' | 'medium' | 'low'; category: 'health' | 'security' | 'coordination'; subject_id: string; message: string }
export interface AuditRow { at: string; source: string; event: string; subject_type: string; subject_id: string; actor: string | null }
export interface PlatformHealthRow { function_name: string; last_status: string | null; last_executed_at: string | null; failures_24h: number | string; runs_24h: number | string }

export const SOURCE_LABEL: Record<string, string> = {
  tenant_cost_ledger: 'Kosten-Ledger (kanonisch)', agent_runs: 'Agentenläufe', token_usage: 'Token-Nutzung',
};
export const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
export const SEVERITY_LABEL = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' } as const;
export const CATEGORY_LABEL = { health: 'Health', security: 'Sicherheit', coordination: 'Koordination' } as const;

export function sortEvents(ev: ReadonlyArray<CriticalEvent>): CriticalEvent[] {
  return [...ev].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || Date.parse(b.at) - Date.parse(a.at));
}

/** Formatiert Geld ehrlich: fehlender Wert → UNBEKANNT (nicht 0). */
export function formatUsd(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return 'UNBEKANNT';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 'UNBEKANNT';
  return `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 4 : 2 })} USD`;
}
export function formatCount(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return 'UNBEKANNT';
  const n = Number(v); return Number.isFinite(n) ? Math.round(n).toLocaleString('de-DE') : 'UNBEKANNT';
}

export function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
}
