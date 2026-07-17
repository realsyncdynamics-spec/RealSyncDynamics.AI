/**
 * Circuit Breaker Pattern — Protect against cascading failures
 * Transitions: Closed → Open → Half-Open → Closed
 */

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerConfig {
  failureThreshold: number;     // Failures before open
  successThreshold: number;     // Successes to close from half-open
  timeout: number;              // Timeout in ms before half-open
  name?: string;
  onStateChange?: (state: CircuitState) => void;
}

export class CircuitBreaker<T> {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;

  constructor(
    private fn: () => Promise<T>,
    private config: CircuitBreakerConfig
  ) {}

  async call(): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailureTime || 0) > this.config.timeout) {
        this.setState('half-open');
      } else {
        throw new Error(
          `Circuit breaker open for ${this.config.name || 'unknown'}`
        );
      }
    }

    try {
      const result = await this.fn();

      if (this.state === 'half-open') {
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.reset();
        }
      } else if (this.state === 'closed') {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.config.failureThreshold) {
        this.setState('open');
      }

      throw error;
    }
  }

  private setState(newState: CircuitState): void {
    if (newState !== this.state) {
      this.state = newState;
      console.log(`[CircuitBreaker] ${this.config.name || 'unknown'}: ${this.state}`);
      this.config.onStateChange?.(newState);
    }
  }

  reset(): void {
    this.setState('closed');
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  getState(): CircuitState {
    return this.state;
  }
}

/**
 * Retry helper with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
  }
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < options.maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i < options.maxRetries - 1) {
        const delay = Math.min(
          options.baseDelay * Math.pow(2, i) + Math.random() * 1000,
          options.maxDelay
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error('Retry exhausted');
}

/**
 * Graceful degradation wrapper
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallbackFn: () => Promise<T> | T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.warn('[withFallback] Primary failed, using fallback:', error);
    return await Promise.resolve(fallbackFn());
  }
}
