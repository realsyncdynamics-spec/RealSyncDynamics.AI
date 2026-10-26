// Voice-Agent je Mandant — gemeinsame Regeln für stripe-webhook (einreihen)
// und provision-voice-agent (umsetzen). Tabelle: public.tenant_voice_agents
// (Migration 20261026151700).
//
// Rechte-Quelle ist ausschließlich `tenant_entitlements()`: `bots.voice`
// entscheidet, ob ein Agent laufen soll, `limit.bot_voice_minutes_monthly`
// bestimmt das Tageslimit beim Provider. Kein Stripe-Price wird hier gelesen.
//
// Ohne Supabase-/Deno-Import, damit Vitest die Regeln prüfen kann.

export type VoiceDesiredState = 'active' | 'suspended';
export type VoiceAgentStatus = 'pending' | 'provisioning' | 'active' | 'suspended' | 'failed';

export const VOICE_ENTITLEMENT = 'bots.voice';
export const VOICE_MINUTES_ENTITLEMENT = 'limit.bot_voice_minutes_monthly';

/** Nach so vielen Fehlversuchen wartet die Zeile auf das nächste Abo-Ereignis. */
export const MAX_PROVISION_ATTEMPTS = 5;
/** Eine Zeile in 'provisioning', die länger hängt, darf neu beansprucht werden. */
export const STALE_CLAIM_MS = 10 * 60 * 1000;
/**
 * Annahme für das Tageslimit: mittlere Gesprächsdauer in Minuten. Das
 * Provider-Limit zählt Gespräche pro Tag, das Entitlement Minuten pro Monat.
 */
export const DEFAULT_AVG_CALL_MINUTES = 3;

export interface EntitlementLike {
  key: string;
  value: number;
}

export interface VoiceEntitlements {
  voice: boolean;
  /** null = unbegrenzt (-1) oder nicht Teil des Plans. */
  monthlyMinutes: number | null;
}

export function readVoiceEntitlements(rows: readonly EntitlementLike[]): VoiceEntitlements {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const voiceValue = byKey.get(VOICE_ENTITLEMENT);
  const minutes = byKey.get(VOICE_MINUTES_ENTITLEMENT);
  return {
    voice: voiceValue === -1 || (typeof voiceValue === 'number' && voiceValue > 0),
    monthlyMinutes: typeof minutes === 'number' && minutes >= 0 ? minutes : null,
  };
}

export function desiredStateFor(ent: VoiceEntitlements): VoiceDesiredState {
  return ent.voice ? 'active' : 'suspended';
}

/**
 * Gespräche pro Tag beim Provider. null = kein Limit setzen (unbegrenzt).
 * Abgerundet, damit das Monatskontingent eher geschont als überzogen wird;
 * mindestens 1, sonst wäre ein bezahlter Agent stumm.
 */
export function dailyCallLimit(
  monthlyMinutes: number | null,
  avgCallMinutes: number = DEFAULT_AVG_CALL_MINUTES,
): number | null {
  if (monthlyMinutes === null) return null;
  const avg = Number.isFinite(avgCallMinutes) && avgCallMinutes > 0 ? avgCallMinutes : DEFAULT_AVG_CALL_MINUTES;
  return Math.max(1, Math.floor(monthlyMinutes / 30 / avg));
}

export interface ExistingVoiceAgent {
  desired_state: VoiceDesiredState;
  status: VoiceAgentStatus;
  /** Zuletzt angewandte Konfiguration (monthly_minutes, avg_call_minutes, daily_limit …). */
  config_snapshot?: Record<string, unknown> | null;
}

export type EnqueuePlan =
  | { action: 'none' }
  | { action: 'insert'; desired: VoiceDesiredState }
  | { action: 'update'; desired: VoiceDesiredState };

/**
 * Was der Webhook nach einem Abo-Ereignis tun soll. Nur echte Zustands-
 * wechsel, gescheiterte Zeilen und ein geändertes Minutenkontingent eines
 * aktiven Agenten lösen Arbeit aus — ein monatliches
 * `customer.subscription.updated` ohne Änderung provisioniert nichts neu.
 */
export function planEnqueue(existing: ExistingVoiceAgent | null, ent: VoiceEntitlements): EnqueuePlan {
  const desired = desiredStateFor(ent);
  if (!existing) {
    return desired === 'active' ? { action: 'insert', desired } : { action: 'none' };
  }
  if (existing.desired_state !== desired) return { action: 'update', desired };
  if (existing.status === 'failed') return { action: 'update', desired };
  if (existing.status === 'active' && minutesChanged(existing.config_snapshot, ent.monthlyMinutes)) {
    return { action: 'update', desired };
  }
  return { action: 'none' };
}

function minutesChanged(snapshot: Record<string, unknown> | null | undefined, monthlyMinutes: number | null): boolean {
  const applied = snapshot?.monthly_minutes;
  return (applied === undefined ? null : applied) !== monthlyMinutes;
}

/**
 * Reconcile einer abgeschlossenen Zeile (active / suspended): passt der
 * umgesetzte Zustand noch zu den Entitlements? Fängt ab, was ohne Stripe-
 * Ereignis passiert — abgelaufene oder widerrufene Grants, geänderte Minuten,
 * eine geänderte Gesprächsdauer-Annahme (VOICE_AVG_CALL_MINUTES).
 */
export function settledRowIsStale(
  row: { status: VoiceAgentStatus; config_snapshot?: Record<string, unknown> | null },
  ent: VoiceEntitlements,
  avgCallMinutes: number,
): boolean {
  const desired = desiredStateFor(ent);
  if (row.status === 'active' && desired === 'suspended') return true;
  if (row.status === 'suspended' && desired === 'active') return true;
  if (row.status === 'active') {
    if (minutesChanged(row.config_snapshot, ent.monthlyMinutes)) return true;
    const applied = row.config_snapshot?.daily_limit;
    return (applied === undefined ? null : applied) !== dailyCallLimit(ent.monthlyMinutes, avgCallMinutes);
  }
  return false;
}

/**
 * Obergrenze der Aufbewahrung beim Provider — die abgenommene Vorlage steht
 * auf 7 Tagen. Ein Kundenagent darf nicht länger aufbewahren als abgenommen.
 */
export const MAX_RETENTION_DAYS = 7;

/** Ausschnitt aus GET /v1/convai/agents/{id} → platform_settings. */
export interface AgentPlatformSettings {
  auth?: { enable_auth?: boolean; require_origin_header?: boolean; allowlist?: unknown[] };
  privacy?: {
    record_voice?: boolean;
    retention_days?: number;
    delete_audio?: boolean;
    delete_transcript_and_pii?: boolean;
    zero_retention_mode?: boolean;
    conversation_history_redaction?: { enabled?: boolean };
  };
  call_limits?: { daily_limit?: number; agent_concurrency_limit?: number; bursting_enabled?: boolean };
}

/**
 * Read-back nach der Bereitstellung, fail-closed: Was hier verletzt ist, darf
 * nicht live gehen — egal ob die Vorlage abgedriftet ist oder der PATCH
 * etwas zurückgesetzt hat. Leere Liste = in Ordnung.
 */
export function agentGuaranteeViolations(s: AgentPlatformSettings, expectedDailyLimit: number | null): string[] {
  const v: string[] = [];
  if (s.auth?.enable_auth !== true) v.push('auth.enable_auth is not true');
  if (s.privacy?.record_voice !== false) v.push('privacy.record_voice is not false');
  const days = s.privacy?.retention_days;
  if (typeof days !== 'number' || days < 1 || days > MAX_RETENTION_DAYS) {
    v.push(`privacy.retention_days=${String(days)} outside 1..${MAX_RETENTION_DAYS}`);
  }
  if (expectedDailyLimit !== null && s.call_limits?.daily_limit !== expectedDailyLimit) {
    v.push(`call_limits.daily_limit=${String(s.call_limits?.daily_limit)} expected ${expectedDailyLimit}`);
  }
  return v;
}

/** Belegbare Einstellungen für die Evidenz (keine Secrets, keine Allowlist-Inhalte). */
export function settingsForEvidence(s: AgentPlatformSettings): Record<string, unknown> {
  return {
    auth_enabled: s.auth?.enable_auth ?? null,
    require_origin_header: s.auth?.require_origin_header ?? null,
    record_voice: s.privacy?.record_voice ?? null,
    retention_days: s.privacy?.retention_days ?? null,
    delete_audio: s.privacy?.delete_audio ?? null,
    delete_transcript_and_pii: s.privacy?.delete_transcript_and_pii ?? null,
    zero_retention_mode: s.privacy?.zero_retention_mode ?? null,
    pii_redaction_enabled: s.privacy?.conversation_history_redaction?.enabled ?? null,
    daily_limit: s.call_limits?.daily_limit ?? null,
    agent_concurrency_limit: s.call_limits?.agent_concurrency_limit ?? null,
  };
}

/** Anzeigename beim Provider: auffindbar und dem Mandanten zuordenbar. */
export function agentName(tenantId: string, tenantName: string | null): string {
  const label = (tenantName ?? '').replace(/\s+/g, ' ').trim() || 'Mandant';
  return `RealSync Voice · ${label}`.slice(0, 90) + ` · ${tenantId.slice(0, 8)}`;
}

/** Fehlertext für last_error: kurz, ohne Bearer-/API-Key-Fragmente. */
export function safeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/(xi-api-key|authorization)\s*[:=]\s*(?:bearer\s+)?\S+/gi, '$1: [redacted]')
    .replace(/\bbearer\s+(?!\[redacted\])\S+/gi, 'Bearer [redacted]')
    .replace(/sk_[A-Za-z0-9]{8,}/g, '[redacted]')
    .slice(0, 500);
}
