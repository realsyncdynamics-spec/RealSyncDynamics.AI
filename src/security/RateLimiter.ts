/**
 * Rate Limiter — Prevents API abuse using token bucket algorithm.
 * Supports per-endpoint, per-user, and global limits.
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // milliseconds
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

interface BucketState {
  tokens: number;
  lastRefill: number;
}

/**
 * In-memory token bucket rate limiter.
 */
export class RateLimiter {
  private buckets: Map<string, BucketState> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.startCleanup();
  }

  /**
   * Check if a request is allowed.
   */
  check(key: string): RateLimitResult {
    const fullKey = this.config.keyPrefix
      ? `${this.config.keyPrefix}:${key}`
      : key;

    const now = Date.now();
    let bucket = this.buckets.get(fullKey);

    if (!bucket) {
      bucket = {
        tokens: this.config.maxRequests,
        lastRefill: now
      };
      this.buckets.set(fullKey, bucket);
    }

    // Refill tokens based on time elapsed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd =
      (timePassed / this.config.windowMs) * this.config.maxRequests;

    bucket.tokens = Math.min(
      this.config.maxRequests,
      bucket.tokens + tokensToAdd
    );
    bucket.lastRefill = now;

    // Consume a token if available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetAt: new Date(now + this.config.windowMs)
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(now + this.config.windowMs)
    };
  }

  /**
   * Check and throw if rate limit exceeded.
   */
  checkOrThrow(key: string): RateLimitResult {
    const result = this.check(key);
    if (!result.allowed) {
      const error = new Error('Rate limit exceeded');
      (error as any).status = 429;
      (error as any).retryAfter = Math.ceil(
        (result.resetAt.getTime() - Date.now()) / 1000
      );
      throw error;
    }
    return result;
  }

  /**
   * Reset a bucket.
   */
  reset(key: string): void {
    const fullKey = this.config.keyPrefix
      ? `${this.config.keyPrefix}:${key}`
      : key;
    this.buckets.delete(fullKey);
  }

  /**
   * Clear all buckets.
   */
  clearAll(): void {
    this.buckets.clear();
  }

  /**
   * Start periodic cleanup of old buckets.
   */
  private startCleanup(): void {
    // Clean up buckets older than 10 windows
    this.cleanupInterval = setInterval(
      () => {
        const now = Date.now();
        const maxAge = this.config.windowMs * 10;

        for (const [key, bucket] of this.buckets.entries()) {
          if (now - bucket.lastRefill > maxAge) {
            this.buckets.delete(key);
          }
        }
      },
      this.config.windowMs
    );

    this.cleanupInterval.unref();
  }

  /**
   * Stop the cleanup interval.
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get statistics.
   */
  getStats(): { activeBuckets: number } {
    return { activeBuckets: this.buckets.size };
  }
}

/**
 * Endpoint-specific rate limiters.
 */
export class EndpointRateLimiter {
  private limiters: Map<string, RateLimiter> = new Map();

  /**
   * Add a rate limiter for an endpoint.
   */
  add(endpoint: string, config: RateLimitConfig): void {
    const limiter = new RateLimiter({ ...config, keyPrefix: endpoint });
    this.limiters.set(endpoint, limiter);
  }

  /**
   * Check a request against an endpoint's rate limit.
   */
  check(endpoint: string, key: string): RateLimitResult {
    const limiter = this.limiters.get(endpoint);
    if (!limiter) {
      return {
        allowed: true,
        remaining: -1,
        resetAt: new Date()
      };
    }
    return limiter.check(key);
  }

  /**
   * Clean up all limiters.
   */
  stopAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.stop();
    }
    this.limiters.clear();
  }
}

/**
 * Global rate limiters.
 */
export const endpointLimiters = new EndpointRateLimiter();
