// Pure helpers for the audit-telemetry dashboard.
//
// All functions are deterministic and side-effect-free so they're trivially
// testable. The React view at /dashboard/audit and the test suite both consume
// these.

export type RiskLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface RiskTone {
  bg: string;
  border: string;
  text: string;
  label: string;
}

const RISK_TONES: Record<RiskLevel, RiskTone> = {
  info:     { bg: 'bg-slate-950/40',  border: 'border-slate-800',   text: 'text-slate-300',   label: 'Info'     },
  low:      { bg: 'bg-emerald-950/30', border: 'border-emerald-900', text: 'text-emerald-300', label: 'Low'      },
  medium:   { bg: 'bg-amber-950/30',   border: 'border-amber-900',   text: 'text-amber-300',   label: 'Medium'   },
  high:     { bg: 'bg-orange-950/30',  border: 'border-orange-900',  text: 'text-orange-300',  label: 'High'     },
  critical: { bg: 'bg-rose-950/40',    border: 'border-rose-900',    text: 'text-rose-300',    label: 'Critical' },
};

export function riskTone(level: string | null | undefined): RiskTone {
  if (level && level in RISK_TONES) return RISK_TONES[level as RiskLevel];
  return RISK_TONES.info;
}

// Roll up an action like "asset.create" / "policy.disable" into a coarse
// bucket for filter chips. Unknown verbs land in "other".
export function actionBucket(action: string | null | undefined): 'create' | 'update' | 'delete' | 'enable' | 'disable' | 'approve' | 'reject' | 'other' {
  if (!action) return 'other';
  const verb = action.toLowerCase().split('.').pop() ?? '';
  if (verb === 'create' || verb === 'upsert' || verb === 'insert') return 'create';
  if (verb === 'update' || verb === 'edit' || verb === 'patch') return 'update';
  if (verb === 'delete' || verb === 'remove' || verb === 'archive') return 'delete';
  if (verb === 'enable' || verb === 'activate' || verb === 'resume') return 'enable';
  if (verb === 'disable' || verb === 'pause' || verb === 'suspend') return 'disable';
  if (verb === 'approve' || verb === 'accept') return 'approve';
  if (verb === 'reject' || verb === 'deny') return 'reject';
  return 'other';
}

// "vor 3 Min." style for recent timestamps, ISO date for older ones.
export function relativeTime(iso: string, nowMs = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const diff = nowMs - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `vor ${hr} Std.`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `vor ${days}d`;
  return new Date(t).toLocaleString('de-DE');
}

export interface WebhookHealth {
  total: number;
  by_type: Array<{ type: string; count: number }>;
  by_hour: Array<{ hour_iso: string; count: number }>;
  oldest: string | null;
  newest: string | null;
}

export interface WebhookEventRow {
  id: string;
  type: string;
  processed_at: string;
}

export function summarizeWebhookEvents(rows: readonly WebhookEventRow[]): WebhookHealth {
  if (rows.length === 0) {
    return { total: 0, by_type: [], by_hour: [], oldest: null, newest: null };
  }
  const typeCounts = new Map<string, number>();
  const hourCounts = new Map<string, number>();
  let oldest: number = Number.POSITIVE_INFINITY;
  let newest: number = Number.NEGATIVE_INFINITY;

  for (const r of rows) {
    typeCounts.set(r.type, (typeCounts.get(r.type) ?? 0) + 1);
    const ts = Date.parse(r.processed_at);
    if (Number.isFinite(ts)) {
      if (ts < oldest) oldest = ts;
      if (ts > newest) newest = ts;
      const hour = new Date(ts);
      hour.setUTCMinutes(0, 0, 0);
      const key = hour.toISOString();
      hourCounts.set(key, (hourCounts.get(key) ?? 0) + 1);
    }
  }

  return {
    total: rows.length,
    by_type: [...typeCounts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    by_hour: [...hourCounts.entries()]
      .map(([hour_iso, count]) => ({ hour_iso, count }))
      .sort((a, b) => a.hour_iso.localeCompare(b.hour_iso)),
    oldest: Number.isFinite(oldest) ? new Date(oldest).toISOString() : null,
    newest: Number.isFinite(newest) ? new Date(newest).toISOString() : null,
  };
}

export interface GovernanceEventRow {
  id: string;
  risk_level: string;
  event_type: string;
}

export interface RiskBreakdown {
  total: number;
  by_risk: Record<RiskLevel, number>;
  by_event_type: Array<{ event_type: string; count: number }>;
}

export function summarizeGovernanceEvents(rows: readonly GovernanceEventRow[]): RiskBreakdown {
  const by_risk: Record<RiskLevel, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  const typeCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.risk_level in by_risk) {
      by_risk[r.risk_level as RiskLevel] += 1;
    }
    typeCounts.set(r.event_type, (typeCounts.get(r.event_type) ?? 0) + 1);
  }
  return {
    total: rows.length,
    by_risk,
    by_event_type: [...typeCounts.entries()]
      .map(([event_type, count]) => ({ event_type, count }))
      .sort((a, b) => b.count - a.count),
  };
}
