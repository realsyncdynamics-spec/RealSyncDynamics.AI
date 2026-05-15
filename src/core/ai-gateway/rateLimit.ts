// Server-side IP+feature sliding-window rate-limit for ai-gateway.
// Pure functions only — no fetch, no Deno, no env. The Edge Function
// (Deno) imports the mirror at supabase/functions/_shared/aiGateway/
// rateLimit.ts. Tests live in test/core/ai-gateway/rateLimit.test.ts.
//
// ai-gateway is browser-facing with verify_jwt=false, called with the
// bundled anon key from at least three features (assistant_chip_quick_chat,
// audit_copilot_*, kodee_vps_advisor). Client-side abuse guards in those
// callers are trivially bypassable; this is the server-side backstop.

export interface RateLimitConfig {
  /** Max requests allowed in a 60-second rolling window. */
  perMinute: number;
  /** Max requests allowed in a 60-minute rolling window. */
  perHour: number;
}

export const DEFAULT_LIMITS: RateLimitConfig = { perMinute: 10, perHour: 100 };

/**
 * Per-feature overrides. Add an entry here when a feature's traffic
 * shape diverges noticeably from the default. Anything not listed
 * gets DEFAULT_LIMITS.
 */
export const FEATURE_LIMITS: Record<string, RateLimitConfig> = {
  assistant_chip_quick_chat:       { perMinute: 12, perHour: 120 },
  audit_copilot_fix_snippet:       { perMinute: 6,  perHour: 60  },
  audit_copilot_remediation_plan:  { perMinute: 3,  perHour: 20  },
  kodee_vps_advisor:               { perMinute: 6,  perHour: 50  },
  openai_compat:                   { perMinute: 8,  perHour: 80  },
  ai_act_classify:                 { perMinute: 4,  perHour: 30  },
};

export interface WindowState {
  count: number;
  resetAt: number;
}

export type RateLimitOutcome =
  | { ok: true }
  | { ok: false; scope: 'minute' | 'hour'; retryAfterMs: number };

export interface DecideRateLimitArgs {
  /** Caller key — typically `${ipHash}:${feature}`. */
  key: string;
  feature: string;
  now: number;
  minuteWindows: Map<string, WindowState>;
  hourWindows:   Map<string, WindowState>;
  /** Override for tests / config-driven changes. */
  limits?: RateLimitConfig;
}

export function decideRateLimit(args: DecideRateLimitArgs): RateLimitOutcome {
  const limits = args.limits
    ?? FEATURE_LIMITS[args.feature]
    ?? DEFAULT_LIMITS;

  // Always bump both windows — a minute-blocked caller still counts
  // against the hourly budget so we can't be ground down by a tight
  // retry loop at exactly perMinute+1 attempts per minute.
  const minute = bumpWindow(args.minuteWindows, args.key, args.now, 60_000);
  const hour   = bumpWindow(args.hourWindows,   args.key, args.now, 3_600_000);

  if (minute.count > limits.perMinute) {
    return {
      ok: false,
      scope: 'minute',
      retryAfterMs: Math.max(0, minute.resetAt - args.now),
    };
  }
  if (hour.count > limits.perHour) {
    return {
      ok: false,
      scope: 'hour',
      retryAfterMs: Math.max(0, hour.resetAt - args.now),
    };
  }
  return { ok: true };
}

function bumpWindow(
  store: Map<string, WindowState>,
  key: string,
  now: number,
  windowMs: number,
): WindowState {
  const existing = store.get(key);
  if (!existing || now >= existing.resetAt) {
    const fresh: WindowState = { count: 1, resetAt: now + windowMs };
    store.set(key, fresh);
    return fresh;
  }
  existing.count += 1;
  return existing;
}

/**
 * Extracts the originating client IP from the request — first hop of
 * `X-Forwarded-For` (the public-internet entry), falling back to
 * Cloudflare's `CF-Connecting-IP`, then a literal `'unknown'`.
 *
 * Deliberately returns a string (not Promise) so callers can compose
 * with their own hash step.
 */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const cf = headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  return 'unknown';
}
