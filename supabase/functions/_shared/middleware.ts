/**
 * Shared middleware for Edge Functions — Error handling, rate limiting, logging
 */

/**
 * Retry mit exponentiellem Backoff.
 *
 * Frueher aus `src/lib/circuit-breaker` importiert — der Pfad zeigte ins
 * Vite-Frontend und existierte von hier aus gar nicht, wodurch jede Function
 * mit diesem Import beim Bundling scheiterte. Edge Functions laufen in Deno
 * und duerfen keinen Frontend-Code ziehen; die Funktion steht deshalb hier.
 *
 * Verhalten ist bewusst identisch zur Frontend-Variante: bei maxRetries=3 wird
 * dreimal versucht und nur zwischen den Versuchen gewartet.
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  // maxDelay ist optional, weil withRetry() unten nur maxRetries und baseDelay
  // durchreicht.
  options: { maxRetries: number; baseDelay: number; maxDelay?: number } = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
  },
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
          options.maxDelay ?? 30000,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error('Retry exhausted');
}

interface MiddlewareContext {
  userId: string;
  tenantId: string;
  functionName: string;
  requestId: string;
}

interface MiddlewareResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Error response formatter
 */
export function errorResponse(
  status: number,
  error: Error | string,
  context?: Partial<MiddlewareContext>
): MiddlewareResponse {
  const message = typeof error === 'string' ? error : error.message;
  const requestId = context?.requestId || 'unknown';

  console.error(`[Error] ${context?.functionName || 'unknown'} (${requestId}): ${message}`);

  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
    },
    body: {
      error: message,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Success response formatter
 */
export function successResponse(data: unknown, context?: Partial<MiddlewareContext>): MiddlewareResponse {
  const requestId = context?.requestId || 'unknown';

  return {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
    },
    body: {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Rate limit response
 */
export function rateLimitResponse(retryAfter: number, context?: Partial<MiddlewareContext>): MiddlewareResponse {
  const requestId = context?.requestId || 'unknown';

  return {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': retryAfter.toString(),
      'X-Request-ID': requestId,
    },
    body: {
      error: 'Rate limit exceeded',
      retryAfter,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Validate authorization header
 */
export function validateAuth(req: Request): { valid: boolean; token?: string; error?: string } {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer') {
    return { valid: false, error: 'Invalid Authorization scheme' };
  }

  if (!token) {
    return { valid: false, error: 'Missing Bearer token' };
  }

  return { valid: true, token };
}

/**
 * Extract and validate request context
 */
export function extractContext(req: Request): { context: MiddlewareContext; error?: string } {
  const authHeader = req.headers.get('Authorization');
  const userId = req.headers.get('X-User-ID');
  const tenantId = req.headers.get('X-Tenant-ID');
  const functionName = req.headers.get('X-Function-Name') || 'unknown';
  const requestId = req.headers.get('X-Request-ID') || generateRequestId();

  if (!userId || !tenantId) {
    return {
      context: {} as MiddlewareContext,
      error: 'Missing required headers (X-User-ID, X-Tenant-ID)',
    };
  }

  return {
    context: {
      userId,
      tenantId,
      functionName,
      requestId,
    },
  };
}

/**
 * Wrap handler with error handling and logging
 */
export function withErrorHandling(
  handler: (req: Request, context: MiddlewareContext) => Promise<MiddlewareResponse>
) {
  return async (req: Request): Promise<Response> => {
    const requestId = req.headers.get('X-Request-ID') || generateRequestId();

    try {
      const { context, error: contextError } = extractContext(req);

      if (contextError) {
        const errorResp = errorResponse(400, contextError, { requestId });
        return new Response(JSON.stringify(errorResp.body), {
          status: errorResp.status,
          headers: errorResp.headers,
        });
      }

      const result = await handler(req, context);

      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: result.headers,
      });
    } catch (error) {
      const errorResp = errorResponse(500, error as Error, { requestId });

      return new Response(JSON.stringify(errorResp.body), {
        status: errorResp.status,
        headers: errorResp.headers,
      });
    }
  };
}

/**
 * Wrap handler with retry logic
 */
export function withRetry(
  handler: () => Promise<any>,
  options = { maxRetries: 3, baseDelay: 1000 }
) {
  return retryWithBackoff(handler, options);
}

/**
 * Generate request ID for tracing
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log operation with context
 */
export function logOperation(
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: Partial<MiddlewareContext>,
  meta?: unknown
): void {
  const timestamp = new Date().toISOString();
  const requestId = context?.requestId || 'unknown';
  const functionName = context?.functionName || 'unknown';

  const logMessage = `[${level.toUpperCase()}] [${timestamp}] [${functionName}] [${requestId}] ${message}`;

  if (meta) {
    console.log(logMessage, meta);
  } else {
    console.log(logMessage);
  }
}
