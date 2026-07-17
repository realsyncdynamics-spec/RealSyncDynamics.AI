/**
 * Server-side rate limiter service for Edge Functions
 * Uses Supabase for distributed state
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

interface RateLimitConfig {
  operation: string;
  tokensPerMinute: number;
  maxBurst: number;
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  'website-operations-agent': {
    operation: 'website-generation',
    tokensPerMinute: 10,
    maxBurst: 20,
  },
  'cloudflare-deployer': {
    operation: 'cloudflare-deployment',
    tokensPerMinute: 5,
    maxBurst: 10,
  },
  'website-domain-manager': {
    operation: 'domain-management',
    tokensPerMinute: 15,
    maxBurst: 30,
  },
  'website-maintenance-agent': {
    operation: 'maintenance-scan',
    tokensPerMinute: 20,
    maxBurst: 40,
  },
};

export async function checkRateLimit(
  userId: string,
  tenantId: string,
  functionName: string
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}> {
  const config = RATE_LIMIT_CONFIGS[functionName];
  if (!config) {
    // If no config, allow (fail open)
    return { allowed: true, remaining: -1, resetAt: Date.now() + 60000 };
  }

  const key = `${tenantId}:${config.operation}`;
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window

  try {
    // Get or create rate limit record
    const { data: record } = await admin
      .from('_rate_limits')
      .select('tokens, last_refill')
      .eq('key', key)
      .single();

    let tokens = config.maxBurst;
    let lastRefill = now;

    if (record) {
      // Refill tokens based on elapsed time
      const elapsed = (now - record.last_refill) / 1000 / 60; // Convert to minutes
      tokens = Math.min(
        config.maxBurst,
        record.tokens + (elapsed * config.tokensPerMinute)
      );
      lastRefill = record.last_refill;
    }

    // Check if request allowed
    const allowed = tokens >= 1;
    const remaining = Math.floor(tokens);

    if (allowed) {
      tokens -= 1;
      lastRefill = now;

      // Update tokens in database
      await admin
        .from('_rate_limits')
        .upsert(
          { key, tokens: tokens.toString(), last_refill: lastRefill },
          { onConflict: 'key' }
        );
    }

    const resetAt = now + 60000;
    const retryAfter = allowed ? undefined : Math.ceil((1 - tokens) / config.tokensPerMinute * 60);

    return { allowed, remaining, resetAt, retryAfter };
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);
    // Fail open on error
    return { allowed: true, remaining: -1, resetAt: Date.now() + 60000 };
  }
}

/**
 * Middleware wrapper for rate limiting
 */
export function withRateLimit(functionName: string) {
  return async (
    userId: string,
    tenantId: string
  ): Promise<{
    allowed: boolean;
    response?: Response;
  }> => {
    const limit = await checkRateLimit(userId, tenantId, functionName);

    if (!limit.allowed) {
      const response = new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: limit.retryAfter,
          resetAt: limit.resetAt,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': limit.retryAfter?.toString() || '60',
            'X-RateLimit-Reset': limit.resetAt.toString(),
          },
        }
      );

      return { allowed: false, response };
    }

    return { allowed: true };
  };
}
