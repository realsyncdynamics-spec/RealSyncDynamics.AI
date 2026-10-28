// Budget, Telefon-Kontingent und Rate-Limit für die öffentlichen Bot-Kanäle
// (bot-chat, bot-voice-webhook, whatsapp-webhook).
//
// Backend: Migration 20261027120000_bot_usage_budget_hardening.sql.
// Die Datenbank entscheidet atomar (Advisory-Lock je Mandant + Ressource);
// dieses Modul ruft nur die RPCs auf und übersetzt die Ergebnisse.
//
// Regeln
//   * Vor jedem KI-Aufruf: Höchstbetrag reservieren (Eingabe-Obergrenze +
//     Ausgabelimit des Tools). Ablehnung → kein KI-Aufruf.
//   * Erfolg → mit dem gemessenen Verbrauch abrechnen ('measured').
//   * Fehler → nur freigeben, wenn die Anfrage nachweislich nie an den
//     Anbieter ging. Sonst zum Höchstbetrag als 'estimated' anrechnen.
//   * Schlägt das Abrechnen selbst fehl, bleibt die Reservierung offen und
//     der Aufräumjob rechnet sie nach Ablauf als 'estimated' ab.
//
// Ohne Deno-/jsr-Imports, damit Vitest das Modul laden kann (gleiche Technik
// wie _shared/bots.ts).

export interface RpcAdmin {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/** Wird von runAiTool (opts.budget) aufgerufen. */
export interface AiBudgetGuard {
  /** Reserviert maxUsd. Wirft BotBudgetError bei Ablehnung. Liefert null, wenn nichts zu reservieren ist. */
  reserve(maxUsd: number): Promise<string | null>;
  /** Gemessener Verbrauch nach erfolgreichem Aufruf. Wirft nie. */
  settleMeasured(reservationId: string, actualUsd: number, evidence: Record<string, unknown>): Promise<void>;
  /** Unklarer Verbrauch → Höchstbetrag als 'estimated'. Wirft nie. */
  settleUnknown(reservationId: string, evidence: Record<string, unknown>): Promise<void>;
  /** Nachweislich kein Verbrauch → Freigabe ohne Ledger-Eintrag. Wirft nie. */
  release(reservationId: string, reason: string): Promise<void>;
}

// Gründe aus bot_ai_budget_reserve / bot_voice_call_reserve
// (Migrationen 20261027120000, 20261027140000 und 20261028100000).
//   cost_budget  Eurodeckel (KI + Telefonie + Fixkosten) des Monats erreicht
export type BudgetDenyReason =
  | 'daily_budget' | 'monthly_budget' | 'concurrency' | 'invalid'
  | 'channel_daily_budget' | 'channel_monthly_budget' | 'protected_reserve' | 'invalid_config'
  | 'cost_budget';

export class BotBudgetError extends Error {
  code = 'BOT_BUDGET_EXCEEDED' as const;
  status = 429;
  reason: BudgetDenyReason | 'unavailable';
  constructor(reason: BudgetDenyReason | 'unavailable') {
    super(reason === 'unavailable'
      ? 'bot budget check unavailable'
      : `bot budget exceeded (${reason})`);
    this.reason = reason;
  }
}

interface ReserveRow {
  decision: 'allow' | 'existing' | 'deny';
  reservation_id: string | null;
  reserved_amount: number | string | null;
  reason: string | null;
}

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  return (data as T) ?? null;
}

function logWarn(scope: string, fields: Record<string, unknown>): void {
  console.error(JSON.stringify({ level: 'warn', scope, ...fields }));
}

// ── KI ──────────────────────────────────────────────────────────────────

/**
 * Obergrenze der Eingabe-Tokens: UTF-8-Bytes. Gängige Tokenizer erzeugen
 * höchstens etwa ein Token je Byte; die bisherige Schätzung (Zeichen / 4)
 * kann den Verbrauch unterschätzen und taugt deshalb nicht als Höchstbetrag.
 */
export function inputTokenUpperBound(...parts: Array<string | null | undefined>): number {
  const enc = new TextEncoder();
  let bytes = 0;
  for (const p of parts) if (p) bytes += enc.encode(p).length;
  return bytes;
}

/**
 * Fehlercodes, bei denen die Anfrage nachweislich nie an den Anbieter
 * gesendet wurde (Prüfung vor dem HTTP-Aufruf in providers.ts).
 * Alles andere — Timeout, HTTP-Fehler, Abbruch — gilt als unklar.
 */
const NOT_SENT_CODES = new Set([
  'PROVIDER_NOT_CONFIGURED',
  'PROVIDER_UNSUPPORTED',
  'PROVIDER_NOT_IMPLEMENTED',
  'PROVIDER_UNPAID_TIER_BLOCKED',
]);

export function aiFailureWasNotSent(code: string | null | undefined): boolean {
  return Boolean(code && NOT_SENT_CODES.has(code));
}

export function createBotAiBudgetGuard(
  admin: RpcAdmin,
  ctx: {
    tenantId: string; botId: string | null; channel: string; requestRef?: string;
    /**
     * Zusatzangaben an der Reservierung, z. B. { call_ref } im Telefon:
     * Grundlage der Kostensicht je Gespräch (bot_voice_call_costs).
     * `channel` wird immer aus ctx gesetzt und lässt sich hier nicht ändern.
     */
    metadata?: Record<string, string>;
  },
): AiBudgetGuard {
  return {
    async reserve(maxUsd: number): Promise<string | null> {
      if (!(maxUsd > 0)) return null; // lokale Inferenz o. ä.: keine USD-Kosten
      const ref = ctx.requestRef ?? crypto.randomUUID();
      const { data, error } = await admin.rpc('bot_ai_budget_reserve', {
        p_tenant_id: ctx.tenantId,
        p_bot_id: ctx.botId,
        p_request_ref: `${ctx.channel}:${ref}`,
        p_max_usd: Number(maxUsd.toFixed(6)),
        p_metadata: { ...(ctx.metadata ?? {}), channel: ctx.channel },
      });
      // Fail-closed: Ohne Budgetprüfung kein KI-Aufruf.
      if (error) {
        logWarn('bot_budget_reserve_failed', { tenant_id: ctx.tenantId, error: error.message });
        throw new BotBudgetError('unavailable');
      }
      const row = firstRow<ReserveRow>(data);
      // Nur eine frisch angelegte Reservierung deckt diesen Aufruf. 'existing'
      // hieße: dieselbe Referenz läuft bereits — kein zweiter KI-Aufruf darauf.
      if (!row || row.decision !== 'allow' || !row.reservation_id) {
        throw new BotBudgetError((row?.reason as BudgetDenyReason) ?? 'invalid');
      }
      return row.reservation_id;
    },

    async settleMeasured(reservationId, actualUsd, evidence) {
      const { error } = await admin.rpc('bot_usage_settle', {
        p_reservation_id: reservationId,
        p_origin: 'measured',
        p_amount: Number(Math.max(0, actualUsd).toFixed(6)),
        p_event_key: null,
        p_evidence: evidence,
      });
      if (error) logWarn('bot_budget_settle_failed', { reservation_id: reservationId, error: error.message });
    },

    async settleUnknown(reservationId, evidence) {
      const { error } = await admin.rpc('bot_usage_settle', {
        p_reservation_id: reservationId,
        p_origin: 'estimated',
        p_amount: null,
        p_event_key: null,
        p_evidence: evidence,
      });
      if (error) logWarn('bot_budget_estimate_failed', { reservation_id: reservationId, error: error.message });
    },

    async release(reservationId, reason) {
      const { error } = await admin.rpc('bot_usage_release', {
        p_reservation_id: reservationId,
        p_reason: reason,
      });
      if (error) logWarn('bot_budget_release_failed', { reservation_id: reservationId, error: error.message });
    },
  };
}

// ── Telefon ─────────────────────────────────────────────────────────────

export type VoiceReservation =
  | { ok: true; reservationId: string; reservedSeconds: number; existing: boolean; status: string }
  | { ok: false; reason: BudgetDenyReason | 'no_plan_minutes' | 'unavailable' };

/**
 * Planlimit in Sekunden aus tenant_entitlements: -1 → null (laut Plan ohne
 * eigene Obergrenze), fehlend → 0 (kein Kontingent, fail-closed).
 *
 * null heißt NICHT unbegrenzt: bot_voice_call_reserve rechnet dann allein mit
 * bot_usage_limits.voice_seconds_monthly und lehnt ohne Mandantenwert mit
 * 'invalid_config' ab (Option A, Owner-Entscheidung 28.10.2026).
 */
export function planSecondsFromEntitlement(minutes: number | null | undefined): number | null {
  if (minutes === -1) return null;
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.floor(minutes) * 60;
}

export async function reserveVoiceCall(
  admin: RpcAdmin,
  args: {
    tenantId: string; botId: string; provider: 'twilio' | 'test'; callRef: string; planSeconds: number | null;
    /** Twilio-AccountSid aus dem signaturgeprüften Webhook; nötig, um den Anruf beim Anbieter zu beenden. */
    accountSid?: string | null;
  },
): Promise<VoiceReservation> {
  if (args.planSeconds === 0) return { ok: false, reason: 'no_plan_minutes' };
  const { data, error } = await admin.rpc('bot_voice_call_reserve', {
    p_tenant_id: args.tenantId,
    p_bot_id: args.botId,
    p_provider: args.provider,
    p_call_ref: args.callRef,
    p_plan_seconds_monthly: args.planSeconds,
    p_metadata: args.accountSid ? { account_sid: args.accountSid } : {},
  });
  if (error) {
    logWarn('bot_voice_reserve_failed', { tenant_id: args.tenantId, error: error.message });
    return { ok: false, reason: 'unavailable' };
  }
  const row = firstRow<ReserveRow>(data);
  if (!row || row.decision === 'deny' || !row.reservation_id) {
    return { ok: false, reason: (row?.reason as BudgetDenyReason) ?? 'invalid' };
  }
  return {
    ok: true,
    reservationId: row.reservation_id,
    reservedSeconds: Number(row.reserved_amount ?? 0),
    existing: row.decision === 'existing',
    // Bei 'existing' liefert die DB den Reservierungsstatus im Feld reason.
    status: row.decision === 'existing' ? String(row.reason ?? 'open') : 'open',
  };
}

/** Sicherheitsabstand: Ein neuer Gesprächsschritt beginnt nicht kurz vor Ablauf. */
export const VOICE_TURN_MARGIN_SECONDS = 30;

/**
 * Darf ein weiterer Gesprächsschritt beginnen? Die Grenze ist serverseitig:
 * Reservierungsbeginn + reservierte Sekunden − Sicherheitsabstand.
 */
export function voiceTurnAllowed(
  reservation: { createdAt: Date; reservedSeconds: number; status: string },
  now: Date,
  marginSeconds = VOICE_TURN_MARGIN_SECONDS,
): boolean {
  if (reservation.status !== 'open') return false;
  const deadline = reservation.createdAt.getTime() + (reservation.reservedSeconds - marginSeconds) * 1000;
  return now.getTime() < deadline;
}

/** Twilio-Endzustände eines Anrufs. Nur bei diesen wird abgerechnet. */
export const TWILIO_TERMINAL_STATUSES = new Set(['completed', 'busy', 'failed', 'no-answer', 'canceled']);

export async function settleVoiceCall(
  admin: RpcAdmin,
  args: { tenantId: string; provider: 'twilio' | 'test'; callRef: string; seconds: number; status: string },
): Promise<{ duplicate: boolean } | null> {
  const seconds = Number.isFinite(args.seconds) && args.seconds > 0 ? Math.floor(args.seconds) : 0;
  const { data, error } = await admin.rpc('bot_usage_settle_by_ref', {
    p_tenant_id: args.tenantId,
    p_resource: 'voice_seconds',
    p_provider: args.provider,
    p_external_ref: args.callRef,
    p_amount: seconds,
    // Idempotenz je Call-ID + Endereignis (Unique-Index in der DB).
    p_event_key: `${args.provider}:${args.callRef}:terminal`,
    p_evidence: { call_status: args.status, call_duration_seconds: seconds },
  });
  if (error) {
    logWarn('bot_voice_settle_failed', { tenant_id: args.tenantId, error: error.message });
    return null;
  }
  const row = firstRow<{ duplicate: boolean }>(data);
  return { duplicate: Boolean(row?.duplicate) };
}

// ── Rate-Limit (bot-chat) ───────────────────────────────────────────────

export const BOT_CHAT_RATE_LIMITS = {
  /** Je Quelle (IP-Hash) über alle Bots. */
  perIp: { windowSeconds: 60, max: 20 },
  /** Je Quelle und Bot. */
  perIpBot: { windowSeconds: 60, max: 10 },
  /** Je Bot über alle Quellen — Bremse gegen verteilte Last. */
  perBot: { windowSeconds: 60, max: 120 },
} as const;

/**
 * Client-IP aus den Proxy-Headern. cf-connecting-ip setzt Cloudflare und
 * ist vom Client nicht überschreibbar; x-forwarded-for nur als Rückfall.
 * Fehlt beides, landen alle solchen Anfragen in einem gemeinsamen Eimer.
 */
export function clientIpFromHeaders(headers: { get(name: string): string | null }): string {
  const cf = headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}

/** Tagesgebundener HMAC der IP — keine Klar-IP in der Datenbank. */
export async function hashClientIp(ip: string, secret: string, at: Date): Promise<string> {
  if (!secret) throw new Error('hashClientIp: empty secret');
  const day = at.toISOString().slice(0, 10);
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`bot-chat-rl|${day}|${ip}`));
  return Array.from(new Uint8Array(mac)).slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type RateDecision = { allowed: true } | { allowed: false; scope: 'ip' | 'ip_bot' | 'bot' | 'unavailable' };

async function hit(admin: RpcAdmin, key: string, windowSeconds: number, max: number): Promise<boolean | null> {
  const { data, error } = await admin.rpc('bot_rate_hit', {
    p_bucket_key: key, p_window_seconds: windowSeconds, p_max: max,
  });
  if (error) {
    logWarn('bot_rate_hit_failed', { error: error.message });
    return null;
  }
  const row = firstRow<{ allowed: boolean }>(data);
  return Boolean(row?.allowed);
}

/** Erst die IP (vor jedem DB-Lookup des Bots), dann IP+Bot und Bot. */
export async function checkIpRateLimit(admin: RpcAdmin, ipHash: string): Promise<RateDecision> {
  const l = BOT_CHAT_RATE_LIMITS.perIp;
  const ok = await hit(admin, `chat:ip:${ipHash}`, l.windowSeconds, l.max);
  if (ok === null) return { allowed: false, scope: 'unavailable' };
  return ok ? { allowed: true } : { allowed: false, scope: 'ip' };
}

export async function checkBotRateLimit(admin: RpcAdmin, ipHash: string, botId: string): Promise<RateDecision> {
  const a = BOT_CHAT_RATE_LIMITS.perIpBot;
  const okIpBot = await hit(admin, `chat:ipbot:${ipHash}:${botId}`, a.windowSeconds, a.max);
  if (okIpBot === null) return { allowed: false, scope: 'unavailable' };
  if (!okIpBot) return { allowed: false, scope: 'ip_bot' };
  const b = BOT_CHAT_RATE_LIMITS.perBot;
  const okBot = await hit(admin, `chat:bot:${botId}`, b.windowSeconds, b.max);
  if (okBot === null) return { allowed: false, scope: 'unavailable' };
  return okBot ? { allowed: true } : { allowed: false, scope: 'bot' };
}

/**
 * Origin-Prüfung als Zusatzhürde, ausdrücklich kein Zugriffsschutz (der
 * Header ist außerhalb von Browsern frei setzbar). Greift nur, wenn der Bot
 * eine Liste `config.allowed_origins` trägt.
 */
export function originAllowed(origin: string | null, config: Record<string, unknown> | null | undefined): boolean {
  const list = config?.allowed_origins;
  if (!Array.isArray(list) || list.length === 0) return true;
  if (!origin) return false;
  const normalized = origin.trim().toLowerCase().replace(/\/+$/, '');
  return list.some((o) => typeof o === 'string' && o.trim().toLowerCase().replace(/\/+$/, '') === normalized);
}
