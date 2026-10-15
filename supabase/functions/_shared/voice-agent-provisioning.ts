// Voice-Agent je Mandant — gemeinsame Regeln für stripe-webhook (einreihen)
// und provision-voice-agent (umsetzen). Tabelle: public.tenant_voice_agents
// (Migration 20261015090000).
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
}

export type EnqueuePlan =
  | { action: 'none' }
  | { action: 'insert'; desired: VoiceDesiredState }
  | { action: 'update'; desired: VoiceDesiredState };

/**
 * Was der Webhook nach einem Abo-Ereignis tun soll. Nur echte Zustands-
 * wechsel (und gescheiterte Zeilen) lösen Arbeit aus — ein monatliches
 * `customer.subscription.updated` provisioniert nichts neu.
 */
export function planEnqueue(existing: ExistingVoiceAgent | null, desired: VoiceDesiredState): EnqueuePlan {
  if (!existing) {
    return desired === 'active' ? { action: 'insert', desired } : { action: 'none' };
  }
  if (existing.desired_state !== desired) return { action: 'update', desired };
  if (existing.status === 'failed') return { action: 'update', desired };
  return { action: 'none' };
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
