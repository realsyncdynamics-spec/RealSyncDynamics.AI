/**
 * Resilient handler wrapper for Edge Functions
 * Integrates: circuit breaker, rate limiting, error monitoring, retry logic
 */

import { recordOperation, getCircuitState } from './circuit-breaker-service.ts';
import { checkRateLimit } from './rate-limiter-service.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

interface ResilientOptions {
  functionName: string;
  circuitName: string;
  maxRetries?: number;
  retryDelayMs?: number;
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Execute handler with full resilience: circuit breaker, rate limiting, retry, monitoring
 */
export async function executeResilient<T>(
  handler: () => Promise<T>,
  userId: string,
  tenantId: string,
  options: ResilientOptions
): Promise<{
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  retried?: number;
}> {
  const startTime = Date.now();
  let retryCount = 0;
  const maxRetries = options.maxRetries ?? 3;

  try {
    // 1. Check rate limit
    const rateLimitCheck = await checkRateLimit(userId, tenantId, options.functionName);
    if (!rateLimitCheck.allowed) {
      const durationMs = Date.now() - startTime;

      // Log to metrics
      await logMetric(
        options.functionName,
        false,
        durationMs,
        'Rate limit exceeded',
        'RATE_LIMITED',
        userId,
        tenantId
      );

      return {
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED',
      };
    }

    // 2. Check circuit breaker
    const circuitState = await getCircuitState(options.circuitName);
    if (circuitState.state === 'open') {
      const durationMs = Date.now() - startTime;

      await logMetric(
        options.functionName,
        false,
        durationMs,
        `Circuit breaker open for ${options.circuitName}`,
        'CIRCUIT_OPEN',
        userId,
        tenantId
      );

      return {
        success: false,
        error: `Service temporarily unavailable (${options.circuitName})`,
        code: 'CIRCUIT_OPEN',
      };
    }

    // 3. Execute with retry logic
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await handler();

        // 4. Record success to circuit breaker
        await recordOperation(options.circuitName, true);

        const durationMs = Date.now() - startTime;

        // 5. Log success metric
        await logMetric(
          options.functionName,
          true,
          durationMs,
          undefined,
          undefined,
          userId,
          tenantId
        );

        return {
          success: true,
          data: result,
          retried: retryCount,
        };
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        const shouldRetry = options.shouldRetry?.(lastError) ?? isRetryableError(lastError);

        if (i < maxRetries - 1 && shouldRetry) {
          // Exponential backoff
          const delayMs = (options.retryDelayMs ?? 1000) * Math.pow(2, i);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        break;
      }
    }

    // All retries exhausted
    const durationMs = Date.now() - startTime;

    // Record failure to circuit breaker
    await recordOperation(options.circuitName, false);

    // Log failure metric
    await logMetric(
      options.functionName,
      false,
      durationMs,
      lastError?.message || 'Unknown error',
      'OPERATION_FAILED',
      userId,
      tenantId,
      { retryCount }
    );

    return {
      success: false,
      error: lastError?.message || 'Operation failed',
      code: 'OPERATION_FAILED',
      retried: retryCount,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    await logMetric(
      options.functionName,
      false,
      durationMs,
      error instanceof Error ? error.message : String(error),
      'INTERNAL_ERROR',
      userId,
      tenantId
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Log operation metric to database
 */
async function logMetric(
  operationName: string,
  success: boolean,
  durationMs: number,
  errorMessage?: string,
  errorCode?: string,
  userId?: string,
  tenantId?: string,
  context?: any
): Promise<void> {
  try {
    await admin.from('_operation_metrics').insert({
      operation_name: operationName,
      success,
      duration_ms: durationMs,
      error_message: errorMessage,
      request_id: undefined, // Would be from context
      user_id: userId,
      tenant_id: tenantId,
      context,
    });
  } catch (error) {
    // Fail silently to avoid cascading failures
    console.error('[logMetric] Failed to log metric:', error);
  }
}

/**
 * Determine if error is retryable
 */
function isRetryableError(error: Error): boolean {
  const retryableErrors = [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'timeout',
    '429', // Rate limit
    '503', // Service unavailable
    '504', // Gateway timeout
  ];

  const errorStr = `${error.message} ${error.name}`.toLowerCase();

  return retryableErrors.some((e) => errorStr.includes(e.toLowerCase()));
}
