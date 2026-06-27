// Datenzugriff für den Security Signal Integration Layer.
// Liest tenant-scoped aus security_signals + governance_risk_links (RLS).

import { getSupabase } from '../../../lib/supabase';

export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SignalStatus =
  | 'open' | 'acknowledged' | 'in_review' | 'accepted' | 'resolved' | 'false_positive';

export interface SecuritySignalRow {
  id: string;
  tenant_id: string;
  source_id: string | null;
  provider: string;
  external_id: string;
  event_type: string | null;
  severity: SignalSeverity;
  title: string;
  description: string | null;
  asset_ref: string | null;
  raw_payload: Record<string, unknown>;
  normalized_payload: Record<string, unknown>;
  status: SignalStatus;
  first_seen_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiskLinkRow {
  id: string;
  signal_id: string;
  risk_id: string | null;
  framework: string | null;
  control_ref: string | null;
  mapping_reason: string | null;
  created_at: string;
}

/** Lädt die neuesten Security-Signale eines Tenants. */
export async function fetchSecuritySignals(
  tenantId: string,
  limit = 200,
): Promise<SecuritySignalRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('security_signals')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as SecuritySignalRow[]) ?? [];
}

/** Lädt die Governance-/Control-Verknüpfungen zu einem Signal. */
export async function fetchRiskLinks(signalId: string): Promise<RiskLinkRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('governance_risk_links')
    .select('id, signal_id, risk_id, framework, control_ref, mapping_reason, created_at')
    .eq('signal_id', signalId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as RiskLinkRow[]) ?? [];
}

/** Setzt den Status eines Signals (z.B. „accepted", „in_review"). */
export async function updateSignalStatus(
  signalId: string,
  status: SignalStatus,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('security_signals')
    .update({ status })
    .eq('id', signalId);
  if (error) throw new Error(error.message);
}
