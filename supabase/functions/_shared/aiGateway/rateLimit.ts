// Deno mirror of src/core/ai-gateway/rateLimit.ts. Keep in sync.

export interface RateLimitConfig {
  perMinute: number;
  perHour: number;
}

export const DEFAULT_LIMITS: RateLimitConfig = { perMinute: 10, perHour: 100 };

export const FEATURE_LIMITS: Record<string, RateLimitConfig> = {
  assistant_chip_quick_chat:       { perMinute: 12, perHour: 120 },
  audit_copilot_fix_snippet:       { perMinute: 6,  perHour: 60  },
  audit_copilot_remediation_plan:  { perMinute: 3,  perHour: 20  },
  kodee_vps_advisor:               { perMinute: 6,  perHour: 50  },
  openai_compat:                   { perMinute: 8,  perHour: 80  },
};

export interface WindowState {
  count: number;
  resetAt: number;
}

export type RateLimitOutcome =
  | { ok: true }
  | { ok: false; scope: 'minute' | 'hour'; retryAfterMs: number };

export interface DecideRateLimitArgs {
  key: string;
  feature: string;
  now: number;
  minuteWindows: Map<string, WindowState>;
  hourWindows:   Map<string, WindowState>;
  limits?: RateLimitConfig;
}

export function decideRateLimit(args: DecideRateLimitArgs): RateLimitOutcome {
  const limits = args.limits
    ?? FEATURE_LIMITS[args.feature]
    ?? DEFAULT_LIMITS;

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
