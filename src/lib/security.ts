/**
 * Security helpers — Input sanitization, validation, RLS enforcement
 */

/**
 * Validate and sanitize website project name
 */
export function sanitizeProjectName(input: string): { value: string; error?: string } {
  const trimmed = input?.trim() ?? '';

  if (!trimmed) return { value: '', error: 'Project name required' };
  if (trimmed.length < 2) return { value: '', error: 'Name too short (min 2 chars)' };
  if (trimmed.length > 100) return { value: '', error: 'Name too long (max 100 chars)' };

  // Allow letters, numbers, spaces, hyphens, apostrophes
  if (!/^[a-zA-Z0-9\s\-']+$/.test(trimmed)) {
    return { value: '', error: 'Invalid characters in name' };
  }

  return { value: trimmed };
}

/**
 * Validate domain name format
 */
export function validateDomain(input: string): { value: string; error?: string } {
  const trimmed = input?.trim().toLowerCase() ?? '';

  if (!trimmed) return { value: '', error: 'Domain required' };

  // Domain regex: allows subdomains, TLDs, hyphens (not at start/end of label)
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

  if (!domainRegex.test(trimmed)) {
    return { value: '', error: 'Invalid domain format' };
  }

  if (trimmed.length > 253) {
    return { value: '', error: 'Domain too long (max 253 chars)' };
  }

  // Check label length (max 63 chars per label)
  if (trimmed.split('.').some((label) => label.length > 63)) {
    return { value: '', error: 'Domain label too long (max 63 chars)' };
  }

  return { value: trimmed };
}

/**
 * Validate email address
 */
export function validateEmail(input: string): { value: string; error?: string } {
  const trimmed = input?.trim().toLowerCase() ?? '';

  if (!trimmed) return { value: '', error: 'Email required' };

  // Simplified email regex (production should use more robust validation)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return { value: '', error: 'Invalid email format' };
  }

  if (trimmed.length > 254) {
    return { value: '', error: 'Email too long' };
  }

  return { value: trimmed };
}

/**
 * Sanitize HTML content (prevent XSS)
 */
export function sanitizeHTML(html: string): string {
  const div = document.createElement('div');
  div.textContent = html; // textContent automatically escapes HTML
  return div.innerHTML;
}

/**
 * Validate JSON structure
 */
export function validateJSON<T = unknown>(
  input: string,
  schema?: { type: string }
): { value: T | null; error?: string } {
  try {
    const parsed = JSON.parse(input) as T;
    return { value: parsed };
  } catch (error) {
    return { value: null, error: 'Invalid JSON' };
  }
}

/**
 * RLS Policy Validation Helpers
 * Ensures multi-tenant isolation in all queries
 */

interface QueryContext {
  userId: string;
  tenantId: string;
}

export function validateQueryContext(context: QueryContext): {
  valid: boolean;
  error?: string;
} {
  if (!context.userId) {
    return { valid: false, error: 'User ID required' };
  }

  if (!context.tenantId) {
    return { valid: false, error: 'Tenant ID required' };
  }

  // Validate format (should be UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(context.userId)) {
    return { valid: false, error: 'Invalid user ID format' };
  }

  if (!uuidRegex.test(context.tenantId)) {
    return { valid: false, error: 'Invalid tenant ID format' };
  }

  return { valid: true };
}

/**
 * Verify query includes tenant filter
 */
export function validateTenantFilter(query: string, tenantId: string): {
  valid: boolean;
  error?: string;
} {
  // Basic validation — checks if tenant_id appears in WHERE clause
  const lowerQuery = query.toLowerCase();

  if (!lowerQuery.includes('where')) {
    return { valid: false, error: 'Query missing WHERE clause' };
  }

  if (!lowerQuery.includes('tenant_id')) {
    return { valid: false, error: 'Query missing tenant_id filter' };
  }

  return { valid: true };
}

/**
 * Secrets validation
 * Ensures no secrets are exposed in logs or errors
 */
export function sanitizeForLogging(obj: any): any {
  if (!obj) return obj;

  const secretKeys = [
    'password',
    'secret',
    'token',
    'key',
    'auth',
    'api_key',
    'stripe_secret',
    'anthropic_key',
  ];

  if (typeof obj === 'object') {
    const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const key in sanitized) {
      if (secretKeys.some((sk) => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeForLogging(sanitized[key]);
      }
    }

    return sanitized;
  }

  return obj;
}
