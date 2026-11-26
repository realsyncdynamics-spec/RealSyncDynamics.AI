// Rate-Limit für appointment-book. Nutzt die bestehende RPC bot_rate_hit
// (Migration 20261027120000), eigene Buckets `appt:*`, getrennt von bot-chat.
// Bewusst hier statt in _shared/bot-budget.ts, damit eine Änderung nur
// appointment-book neu ausliefert.

export interface RpcAdmin {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export type RateDecision = { allowed: true } | { allowed: false; scope: 'ip' | 'ip_bot' | 'bot' | 'unavailable' };

export const APPOINTMENT_RATE_LIMITS = {
  /** Je Quelle (IP-Hash) über alle Bots. */
  perIp: { windowSeconds: 600, max: 5 },
  /** Je Quelle und Bot. */
  perIpBot: { windowSeconds: 600, max: 3 },
  /** Je Bot über alle Quellen. */
  perBot: { windowSeconds: 3600, max: 60 },
} as const;

async function hit(admin: RpcAdmin, key: string, windowSeconds: number, max: number): Promise<boolean | null> {
  const { data, error } = await admin.rpc('bot_rate_hit', {
    p_bucket_key: key, p_window_seconds: windowSeconds, p_max: max,
  });
  if (error) {
    console.error(JSON.stringify({ level: 'warn', scope: 'appointment_rate_hit_failed', error: error.message }));
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as { allowed?: boolean } | null;
  return Boolean(row?.allowed);
}

/** Vor jedem Bot-Lookup. Fail-closed. */
export async function checkAppointmentIpRateLimit(admin: RpcAdmin, ipHash: string): Promise<RateDecision> {
  const l = APPOINTMENT_RATE_LIMITS.perIp;
  const ok = await hit(admin, `appt:ip:${ipHash}`, l.windowSeconds, l.max);
  if (ok === null) return { allowed: false, scope: 'unavailable' };
  return ok ? { allowed: true } : { allowed: false, scope: 'ip' };
}

export async function checkAppointmentBotRateLimit(admin: RpcAdmin, ipHash: string, botId: string): Promise<RateDecision> {
  const a = APPOINTMENT_RATE_LIMITS.perIpBot;
  const okIpBot = await hit(admin, `appt:ipbot:${ipHash}:${botId}`, a.windowSeconds, a.max);
  if (okIpBot === null) return { allowed: false, scope: 'unavailable' };
  if (!okIpBot) return { allowed: false, scope: 'ip_bot' };
  const b = APPOINTMENT_RATE_LIMITS.perBot;
  const okBot = await hit(admin, `appt:bot:${botId}`, b.windowSeconds, b.max);
  if (okBot === null) return { allowed: false, scope: 'unavailable' };
  return okBot ? { allowed: true } : { allowed: false, scope: 'bot' };
}
