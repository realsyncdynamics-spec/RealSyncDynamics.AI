/**
 * Distributed Circuit Breaker service for Edge Functions
 * Tracks failure rates and prevents cascading failures
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;    // Failures before open
  successThreshold: number;    // Successes to close from half-open
  timeout: number;             // Timeout in ms before half-open
}

const CIRCUIT_BREAKER_CONFIGS: Record<string, CircuitBreakerConfig> = {
  'cloudflare-api': {
    name: 'cloudflare-api',
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute
  },
  'anthropic-api': {
    name: 'anthropic-api',
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 120000, // 2 minutes
  },
  'database': {
    name: 'database',
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 30000, // 30 seconds
  },
};

/**
 * Record operation result and check circuit breaker state
 */
export async function recordOperation(
  circuitName: string,
  success: boolean
): Promise<{
  state: CircuitState;
  shouldAllow: boolean;
  failureCount: number;
  lastStateChange: number;
}> {
  const config = CIRCUIT_BREAKER_CONFIGS[circuitName];
  if (!config) {
    return {
      state: 'closed',
      shouldAllow: true,
      failureCount: 0,
      lastStateChange: Date.now(),
    };
  }

  const now = Date.now();

  try {
    // Get current circuit state
    let record = await admin
      .from('_circuit_breakers')
      .select('*')
      .eq('name', circuitName)
      .single();

    let state: CircuitState = 'closed';
    let failureCount = 0;
    let successCount = 0;
    let lastStateChange = now;
    let lastFailureTime = now;

    if (record.data) {
      state = record.data.state as CircuitState;
      failureCount = record.data.failure_count || 0;
      successCount = record.data.success_count || 0;
      lastStateChange = record.data.last_state_change || now;
      lastFailureTime = record.data.last_failure_time || now;
    }

    // State machine logic
    if (state === 'open') {
      // Check if should transition to half-open
      if (now - lastFailureTime > config.timeout) {
        state = 'half-open';
        failureCount = 0;
        successCount = 0;
        lastStateChange = now;
      } else {
        // Still open, reject request
        return {
          state,
          shouldAllow: false,
          failureCount,
          lastStateChange,
        };
      }
    }

    // Update based on operation result
    if (success) {
      if (state === 'half-open') {
        successCount++;
        if (successCount >= config.successThreshold) {
          // Close circuit
          state = 'closed';
          failureCount = 0;
          lastStateChange = now;
        }
      } else if (state === 'closed') {
        failureCount = 0;
      }
    } else {
      failureCount++;
      lastFailureTime = now;

      if (failureCount >= config.failureThreshold) {
        // Open circuit
        state = 'open';
        lastStateChange = now;
      }
    }

    // Update database
    await admin
      .from('_circuit_breakers')
      .upsert(
        {
          name: circuitName,
          state,
          failure_count: failureCount,
          success_count: successCount,
          last_state_change: lastStateChange,
          last_failure_time: lastFailureTime,
        },
        { onConflict: 'name' }
      );

    return {
      state,
      shouldAllow: state !== 'open',
      failureCount,
      lastStateChange,
    };
  } catch (error) {
    console.error('[CircuitBreaker] Error recording operation:', error);
    // Fail open on error
    return {
      state: 'closed',
      shouldAllow: true,
      failureCount: 0,
      lastStateChange: now,
    };
  }
}

/**
 * Get current circuit state
 */
export async function getCircuitState(circuitName: string): Promise<{
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastStateChange: number;
}> {
  try {
    const { data: record } = await admin
      .from('_circuit_breakers')
      .select('*')
      .eq('name', circuitName)
      .single();

    if (!record) {
      return {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        lastStateChange: Date.now(),
      };
    }

    return {
      state: record.state as CircuitState,
      failureCount: record.failure_count || 0,
      successCount: record.success_count || 0,
      lastStateChange: record.last_state_change || Date.now(),
    };
  } catch (error) {
    console.error('[CircuitBreaker] Error getting state:', error);
    return {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      lastStateChange: Date.now(),
    };
  }
}

/**
 * Reset circuit breaker (for manual recovery)
 */
export async function resetCircuit(circuitName: string): Promise<void> {
  await admin
    .from('_circuit_breakers')
    .update({
      state: 'closed',
      failure_count: 0,
      success_count: 0,
      last_state_change: Date.now(),
    })
    .eq('name', circuitName);
}
