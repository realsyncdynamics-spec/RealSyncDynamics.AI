// Persistenz-API für Monitoring-Alert-Regeln (Tabelle monitoring_alert_rules).
// RLS schützt pro Tenant; daher direkte Tabellen-Queries via getSupabase().
import { getSupabase } from '../../../lib/supabase';

export interface AlertRule {
  id: string;
  rule_key: string;
  name: string;
  channels: string;
  active: boolean;
  is_custom: boolean;
  sort_order: number;
}

// Default-Regelvorlagen — werden beim ersten Laden eines Tenants ohne Regeln
// persistiert (seed-on-read). rule_key ist stabil, damit Defaults idempotent
// bleiben und nicht dupliziert werden.
export const DEFAULT_ALERT_RULES: Array<Omit<AlertRule, 'id'>> = [
  { rule_key: 'new_tracker',        name: 'Neuer Tracker erkannt',        channels: 'E-Mail + Dashboard', active: true,  is_custom: false, sort_order: 10 },
  { rule_key: 'pre_consent',        name: 'Pre-Consent Tracking',         channels: 'E-Mail + Dashboard', active: true,  is_custom: false, sort_order: 20 },
  { rule_key: 'risk_score_60',      name: 'Risk Score über 60',           channels: 'Dashboard',          active: true,  is_custom: false, sort_order: 30 },
  { rule_key: 'ai_undocumented',    name: 'KI-System ohne Dokumentation', channels: 'E-Mail',             active: true,  is_custom: false, sort_order: 40 },
  { rule_key: 'doc_expired',        name: 'Dokument abgelaufen',          channels: 'E-Mail',             active: false, is_custom: false, sort_order: 50 },
  { rule_key: 'transfer_no_scc',    name: 'Drittland-Transfer ohne SCC',  channels: 'E-Mail + Dashboard', active: true,  is_custom: false, sort_order: 60 },
  { rule_key: 'ssl_expiring',       name: 'SSL-Zertifikat < 30 Tage',     channels: 'Dashboard',          active: true,  is_custom: false, sort_order: 70 },
];

const COLUMNS = 'id,rule_key,name,channels,active,is_custom,sort_order';

/**
 * Lädt die Alert-Regeln eines Tenants. Existiert noch keine, werden die
 * Default-Vorlagen einmalig angelegt (seed-on-read) und zurückgegeben.
 */
export async function loadAlertRules(tenantId: string): Promise<AlertRule[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('monitoring_alert_rules')
    .select(COLUMNS)
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  if (data && data.length > 0) return data as AlertRule[];

  // Seed-on-read: Defaults anlegen. upsert mit ignoreDuplicates schützt vor
  // Races (zwei Tabs laden gleichzeitig).
  const seed = DEFAULT_ALERT_RULES.map((r) => ({ ...r, tenant_id: tenantId }));
  const { error: seedErr } = await sb
    .from('monitoring_alert_rules')
    .upsert(seed, { onConflict: 'tenant_id,rule_key', ignoreDuplicates: true });
  if (seedErr) throw new Error(seedErr.message);

  const { data: seeded, error: reloadErr } = await sb
    .from('monitoring_alert_rules')
    .select(COLUMNS)
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });
  if (reloadErr) throw new Error(reloadErr.message);
  return (seeded ?? []) as AlertRule[];
}

/** Schaltet eine Regel aktiv/inaktiv. */
export async function setAlertRuleActive(id: string, active: boolean): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('monitoring_alert_rules')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Legt eine eigene Regel an und gibt sie zurück. */
export async function addCustomAlertRule(
  tenantId: string,
  name: string,
  channels: string,
): Promise<AlertRule> {
  const sb = getSupabase();
  const rule_key = `custom_${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await sb
    .from('monitoring_alert_rules')
    .insert({ tenant_id: tenantId, rule_key, name, channels, active: true, is_custom: true, sort_order: 100 })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as AlertRule;
}

/** Entfernt eine (eigene) Regel. */
export async function deleteAlertRule(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('monitoring_alert_rules').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
