/**
 * Output Sanitizer — Prevents XSS, injection attacks, and information leakage.
 * Sanitizes HTML, JSON, and plain text outputs.
 */

export interface SanitizationOptions {
  context?: 'html' | 'json' | 'text' | 'url';
  allowedTags?: string[];
  stripScripts?: boolean;
  stripEvents?: boolean;
  stripComments?: boolean;
  maxDepth?: number;
}

export interface SanitizationResult {
  sanitized: unknown;
  modified: boolean;
}

/**
 * Core sanitizer preventing XSS and injection attacks.
 */
export class OutputSanitizer {
  // Dangerous HTML tags that can execute code
  private static readonly DANGEROUS_TAGS = new Set([
    'script', 'iframe', 'object', 'embed', 'applet', 'form',
    'input', 'button', 'textarea', 'link', 'meta', 'style'
  ]);

  // Event handlers that can execute code
  private static readonly DANGEROUS_EVENTS = new Set([
    'onload', 'onerror', 'onmouseover', 'onclick', 'onchange',
    'onfocus', 'onblur', 'onsubmit', 'onkeydown', 'onkeyup',
    'ondblclick', 'onmouseenter', 'onmouseleave'
  ]);

  /**
   * Sanitize output based on context.
   */
  static sanitize(
    value: unknown,
    options: SanitizationOptions = {}
  ): SanitizationResult {
    const { context = 'json', maxDepth = 10 } = options;

    try {
      switch (context) {
        case 'html':
          return this.sanitizeHTML(String(value), options);
        case 'json':
          return this.sanitizeJSON(value, options, 0, maxDepth);
        case 'text':
          return this.sanitizeText(String(value), options);
        case 'url':
          return this.sanitizeURL(String(value), options);
        default:
          return { sanitized: value, modified: false };
      }
    } catch (error) {
      console.error('Sanitization error:', error);
      return { sanitized: value, modified: false };
    }
  }

  /**
   * Sanitize HTML content.
   */
  private static sanitizeHTML(
    html: string,
    options: SanitizationOptions
  ): SanitizationResult {
    let modified = false;

    // Remove scripts entirely
    if (options.stripScripts !== false) {
      const scriptFree = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      if (scriptFree !== html) {
        modified = true;
      }
      html = scriptFree;
    }

    // Remove event handlers
    if (options.stripEvents !== false) {
      for (const event of this.DANGEROUS_EVENTS) {
        const eventPattern = new RegExp(`\\s${event}\\s*=\\s*"[^"]*"`, 'gi');
        const eventFree = html.replace(eventPattern, '');
        if (eventFree !== html) {
          modified = true;
        }
        html = eventFree;
      }
    }

    // Remove HTML comments if requested
    if (options.stripComments) {
      const commentFree = html.replace(/<!--[\s\S]*?-->/g, '');
      if (commentFree !== html) {
        modified = true;
      }
      html = commentFree;
    }

    // Remove dangerous tags
    for (const tag of this.DANGEROUS_TAGS) {
      const tagPattern = new RegExp(`<${tag}\\b[^>]*(?:>|$)[^<]*(?:</${tag}\\s*>|$)`, 'gi');
      const tagFree = html.replace(tagPattern, '');
      if (tagFree !== html) {
        modified = true;
      }
      html = tagFree;
    }

    return { sanitized: html, modified };
  }

  /**
   * Sanitize JSON output (remove sensitive keys, prevent prototype pollution).
   */
  private static sanitizeJSON(
    value: unknown,
    options: SanitizationOptions,
    depth: number,
    maxDepth: number
  ): SanitizationResult {
    let modified = false;

    // Prevent deep recursion
    if (depth > maxDepth) {
      return { sanitized: '[Depth exceeded]', modified: true };
    }

    if (value === null || value === undefined) {
      return { sanitized: value, modified: false };
    }

    if (typeof value !== 'object') {
      return { sanitized: value, modified: false };
    }

    if (Array.isArray(value)) {
      const sanitized: unknown[] = [];
      for (const item of value) {
        const result = this.sanitizeJSON(item, options, depth + 1, maxDepth);
        sanitized.push(result.sanitized);
        if (result.modified) {
          modified = true;
        }
      }
      return { sanitized, modified };
    }

    // Object
    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = new Set([
      'password', 'secret', 'token', 'apiKey', 'api_key',
      'privateKey', 'private_key', 'secretKey', 'secret_key',
      'authorization', 'cookie', 'session', 'refresh_token'
    ]);

    for (const [key, val] of Object.entries(value)) {
      // Skip prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        modified = true;
        continue;
      }

      // Redact sensitive keys
      if (sensitiveKeys.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
        modified = true;
      } else {
        const result = this.sanitizeJSON(val, options, depth + 1, maxDepth);
        sanitized[key] = result.sanitized;
        if (result.modified) {
          modified = true;
        }
      }
    }

    return { sanitized, modified };
  }

  /**
   * Sanitize plain text (escape special characters).
   */
  private static sanitizeText(
    text: string,
    _options: SanitizationOptions
  ): SanitizationResult {
    let modified = false;

    const htmlEscaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    if (htmlEscaped !== text) {
      modified = true;
    }

    return { sanitized: htmlEscaped, modified };
  }

  /**
   * Sanitize URL to prevent javascript: and data: URIs.
   */
  private static sanitizeURL(
    url: string,
    _options: SanitizationOptions
  ): SanitizationResult {
    let modified = false;

    // Block javascript: and data: URIs
    if (/^(javascript|data|vbscript):/i.test(url)) {
      return { sanitized: '', modified: true };
    }

    // Only allow http and https
    if (!/^https?:\/\//i.test(url)) {
      return { sanitized: '', modified: true };
    }

    // Decode to detect obfuscation
    let decoded = url;
    try {
      decoded = decodeURIComponent(url);
    } catch {
      // Invalid encoding, keep original
    }

    if (/^(javascript|data|vbscript):/i.test(decoded)) {
      return { sanitized: '', modified: true };
    }

    return { sanitized: url, modified };
  }

  /**
   * Escape HTML entities for safe display.
   */
  static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, (c) => map[c] || c);
  }

  /**
   * Sanitize for SQL context (basic protection, use parameterized queries).
   */
  static escapeSql(value: string): string {
    return value.replace(/'/g, "''");
  }
}
