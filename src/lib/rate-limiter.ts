/**
 * Token Bucket Rate Limiter — Fair and efficient rate limiting
 * Supports burst capacity and gradual token refill
 */

interface RateLimitConfig {
  tokensPerSecond: number;   // Refill rate
  maxBurst: number;          // Maximum burst size
  windowMs?: number;         // Time window for counting (analytics)
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export class RateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      ...config,
      windowMs: config.windowMs || 60000,
    };
  }

  check(key: string, tokensRequested: number = 1): RateLimitResult {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.config.maxBurst, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      this.config.maxBurst,
      bucket.tokens + elapsedSeconds * this.config.tokensPerSecond
    );
    bucket.lastRefill = now;

    // Check if request is allowed
    const allowed = bucket.tokens >= tokensRequested;
    const remaining = Math.floor(bucket.tokens);

    if (allowed) {
      bucket.tokens -= tokensRequested;
    }

    const resetAt = now + (this.config.windowMs / 1000) * 1000;
    const retryAfter = allowed
      ? undefined
      : Math.ceil((tokensRequested - bucket.tokens) / this.config.tokensPerSecond);

    return { allowed, remaining, resetAt, retryAfter };
  }

  async allow(key: string, tokensRequested: number = 1): Promise<boolean> {
    return this.check(key, tokensRequested).allowed;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  resetAll(): void {
    this.buckets.clear();
  }

  getStats(key: string) {
    const bucket = this.buckets.get(key);
    return {
      tokens: bucket?.tokens || 0,
      lastRefill: bucket?.lastRefill || 0,
    };
  }
}

/**
 * Distributed rate limiter for multi-instance deployments
 * Uses Supabase as distributed cache (fallback: in-memory)
 */
export class DistributedRateLimiter {
  private localCache: RateLimiter;

  constructor(private config: RateLimitConfig, private supabaseUrl?: string) {
    this.localCache = new RateLimiter(config);
  }

  async check(
    key: string,
    tokensRequested: number = 1
  ): Promise<RateLimitResult> {
    // For now, use local cache. In production, integrate with Supabase
    return this.localCache.check(key, tokensRequested);
  }

  async allow(key: string, tokensRequested: number = 1): Promise<boolean> {
    return (await this.check(key, tokensRequested)).allowed;
  }
}

/**
 * Rate limit middleware for Edge Functions
 */
export function createEdgeFunctionMiddleware(limits: Record<string, RateLimitConfig>) {
  const limiters = new Map(
    Object.entries(limits).map(([name, config]) => [name, new RateLimiter(config)])
  );

  return (functionName: string) => {
    const limiter = limiters.get(functionName);
    if (!limiter) throw new Error(`No rate limit config for ${functionName}`);

    return async (userId: string): Promise<RateLimitResult> => {
      return limiter.check(userId);
    };
  };
}
