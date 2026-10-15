/**
 * Lead-Trichter für die interne Lead-Verwaltung (`/app/leads`, `/admin/leads`).
 *
 * Gelesen wird ausschliesslich über die RPCs `admin_funnel_leads` und
 * `admin_funnel_kpis` (Migration 20261015120000). Beide prüfen die
 * Plattform-Rolle in der Datenbank (`is_platform_operator()`); die Prüfung
 * im Browser ist nur Anzeige-Logik, keine Sicherung.
 */
import { getSupabase } from '../../lib/supabase';

export const FUNNEL_FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'new', label: 'Neu' },
  { id: 'scan_started', label: 'Scan gestartet' },
  { id: 'scan_completed', label: 'Scan abgeschlossen' },
  { id: 'pilot_started', label: 'Pilot begonnen' },
  { id: 'customer', label: 'Kunde geworden' },
] as const;

export type FunnelFilterId = typeof FUNNEL_FILTERS[number]['id'];
export type ConversionStage = Exclude<FunnelFilterId, 'all'>;

export interface FunnelLeadRow {
  id: string;
  domain: string | null;
  email: string;
  company: string | null;
  source: string | null;
  created_at: string;
  last_activity_at: string;
  funnel_stage: string | null;
  scan_status: 'none' | 'running' | 'failed' | 'completed';
  audit_id: string | null;
  registered: boolean;
  pilot_status: string;
  conversion_stage: ConversionStage;
  marketing_consent: boolean;
  submission_count: number;
}

export interface FunnelKpis {
  window_days: number;
  leads_total: number;
  leads_by_source: Record<string, number>;
  scans_started: number;
  scans_completed: number;
  scan_completion_rate: number | null;
  pilots: number;
  customers: number;
  lead_to_pilot_rate: number | null;
  pilot_to_customer_rate: number | null;
}

export const SOURCE_LABELS: Record<string, string> = {
  landing: 'Landingpage',
  governance_scan: 'Governance-Scan',
  pricing: 'Pricing',
  agency: 'Agentur',
  voice_agent: 'Voice-Agent',
  siteos_builder: 'SiteOS-Builder',
};

export const SCAN_STATUS_LABELS: Record<FunnelLeadRow['scan_status'], string> = {
  none: '—',
  running: 'läuft / abgebrochen',
  failed: 'fehlgeschlagen',
  completed: 'abgeschlossen',
};

export const PILOT_STATUS_LABELS: Record<string, string> = {
  none: '—',
  free: 'Free',
  pilot: 'Pilot läuft',
  paid: 'bezahlt',
  past_due: 'überfällig',
  canceled: 'gekündigt',
};

export const CONVERSION_LABELS: Record<ConversionStage, string> = {
  new: 'Neu',
  scan_started: 'Scan gestartet',
  scan_completed: 'Scan abgeschlossen',
  pilot_started: 'Pilot begonnen',
  customer: 'Kunde',
};

/** Quote als Prozent. `null` (Nenner 0) bleibt sichtbar „—“, nie „0 %“. */
export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return '—';
  return `${(rate * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
}

export async function loadFunnelLeads(filter: FunnelFilterId, limit = 300): Promise<FunnelLeadRow[]> {
  const { data, error } = await getSupabase().rpc('admin_funnel_leads', {
    p_stage: filter === 'all' ? null : filter,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as FunnelLeadRow[];
}

export async function loadFunnelKpis(days = 90): Promise<FunnelKpis> {
  const { data, error } = await getSupabase().rpc('admin_funnel_kpis', { p_days: days });
  if (error) throw new Error(error.message);
  return data as FunnelKpis;
}
