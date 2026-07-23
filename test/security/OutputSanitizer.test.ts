import { describe, it, expect } from 'vitest';
import { OutputSanitizer } from '../../src/security/OutputSanitizer';

describe('OutputSanitizer', () => {
  describe('sanitizeHTML', () => {
    it('removes script tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script>';
      const result = OutputSanitizer.sanitize(input, { context: 'html' });
      expect(result.sanitized).not.toContain('script');
      expect(result.modified).toBe(true);
    });

    it('removes event handlers', () => {
      const input = '<img src="x" onerror="alert(\'xss\')">';
      const result = OutputSanitizer.sanitize(input, { context: 'html' });
      expect(result.sanitized).not.toContain('onerror');
      expect(result.modified).toBe(true);
    });

    it('removes iframe tags', () => {
      const input = '<p>Content</p><iframe src="evil.com"></iframe>';
      const result = OutputSanitizer.sanitize(input, { context: 'html' });
      expect(result.sanitized).not.toContain('iframe');
      expect(result.modified).toBe(true);
    });

    it('allows safe HTML', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = OutputSanitizer.sanitize(input, { context: 'html' });
      expect(result.sanitized).toBe(input);
      expect(result.modified).toBe(false);
    });

    it('removes HTML comments', () => {
      const input = '<p>Text</p><!-- Secret comment -->';
      const result = OutputSanitizer.sanitize(input, {
        context: 'html',
        stripComments: true
      });
      expect(result.sanitized).not.toContain('Secret comment');
      expect(result.modified).toBe(true);
    });
  });

  describe('sanitizeJSON', () => {
    it('redacts sensitive fields', () => {
      const input = {
        name: 'John',
        password: 'secret123',
        apiKey: 'key-12345'
      };
      const result = OutputSanitizer.sanitize(input, { context: 'json' });
      const sanitized = result.sanitized as any;
      expect(sanitized.name).toBe('John');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(result.modified).toBe(true);
    });

    it('prevents prototype pollution', () => {
      const input = {
        __proto__: { admin: true },
        constructor: { isAdmin: true },
        name: 'John'
      };
      const result = OutputSanitizer.sanitize(input, { context: 'json' });
      const sanitized = result.sanitized as any;
      expect(sanitized.__proto__).toBeUndefined();
      expect(sanitized.constructor).toBeUndefined();
      expect(result.modified).toBe(true);
    });

    it('sanitizes nested objects', () => {
      const input = {
        user: {
          name: 'John',
          token: 'secret-token'
        }
      };
      const result = OutputSanitizer.sanitize(input, { context: 'json' });
      const sanitized = result.sanitized as any;
      expect(sanitized.user.name).toBe('John');
      expect(sanitized.user.token).toBe('[REDACTED]');
    });

    it('sanitizes arrays', () => {
      const input = {
        items: [
          { password: 'secret1' },
          { password: 'secret2' }
        ]
      };
      const result = OutputSanitizer.sanitize(input, { context: 'json' });
      const sanitized = result.sanitized as any;
      expect(sanitized.items[0].password).toBe('[REDACTED]');
      expect(sanitized.items[1].password).toBe('[REDACTED]');
    });

    it('prevents deep recursion', () => {
      let nested: any = { value: 'deep' };
      for (let i = 0; i < 15; i++) {
        nested = { nested };
      }
      const result = OutputSanitizer.sanitize(nested, { context: 'json', maxDepth: 10 });
      expect(result.modified).toBe(true);
    });
  });

  describe('sanitizeText', () => {
    it('escapes HTML entities', () => {
      const input = '<script>alert("xss")</script>';
      const result = OutputSanitizer.sanitize(input, { context: 'text' });
      expect(result.sanitized).toContain('&lt;');
      expect(result.sanitized).toContain('&gt;');
      expect(result.modified).toBe(true);
    });

    it('escapes quotes', () => {
      const input = '"Hello" & \'World\'';
      const result = OutputSanitizer.sanitize(input, { context: 'text' });
      expect(result.sanitized).toContain('&quot;');
      expect(result.sanitized).toContain('&#39;');
      expect(result.sanitized).toContain('&amp;');
    });

    it('handles safe text', () => {
      const input = 'Hello World';
      const result = OutputSanitizer.sanitize(input, { context: 'text' });
      expect(result.sanitized).toBe('Hello World');
      expect(result.modified).toBe(false);
    });
  });

  describe('sanitizeURL', () => {
    it('allows safe HTTPS URLs', () => {
      const input = 'https://example.com/path';
      const result = OutputSanitizer.sanitize(input, { context: 'url' });
      expect(result.sanitized).toBe(input);
      expect(result.modified).toBe(false);
    });

    it('allows safe HTTP URLs', () => {
      const input = 'http://example.com/path';
      const result = OutputSanitizer.sanitize(input, { context: 'url' });
      expect(result.sanitized).toBe(input);
      expect(result.modified).toBe(false);
    });

    it('blocks javascript: URIs', () => {
      const input = 'javascript:alert("xss")';
      const result = OutputSanitizer.sanitize(input, { context: 'url' });
      expect(result.sanitized).toBe('');
      expect(result.modified).toBe(true);
    });

    it('blocks data: URIs', () => {
      const input = 'data:text/html,<script>alert("xss")</script>';
      const result = OutputSanitizer.sanitize(input, { context: 'url' });
      expect(result.sanitized).toBe('');
      expect(result.modified).toBe(true);
    });

    it('blocks vbscript: URIs', () => {
      const input = 'vbscript:msgbox("xss")';
      const result = OutputSanitizer.sanitize(input, { context: 'url' });
      expect(result.sanitized).toBe('');
      expect(result.modified).toBe(true);
    });

    it('detects obfuscated javascript URIs', () => {
      const input = 'java%73cript:alert("xss")';
      const result = OutputSanitizer.sanitize(input, { context: 'url' });
      expect(result.sanitized).toBe('');
      expect(result.modified).toBe(true);
    });
  });

  describe('escapeHtml', () => {
    it('escapes dangerous characters', () => {
      const result = OutputSanitizer.escapeHtml('<script>alert("xss")</script>');
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });
  });

  describe('escapeSql', () => {
    it('escapes single quotes for SQL', () => {
      const result = OutputSanitizer.escapeSql("O'Reilly");
      expect(result).toBe("O''Reilly");
    });
  });

  describe('edge cases', () => {
    it('handles null and undefined', () => {
      const resultNull = OutputSanitizer.sanitize(null, { context: 'json' });
      expect(resultNull.sanitized).toBeNull();

      const resultUndefined = OutputSanitizer.sanitize(undefined, { context: 'json' });
      expect(resultUndefined.sanitized).toBeUndefined();
    });

    it('handles empty strings', () => {
      const result = OutputSanitizer.sanitize('', { context: 'text' });
      expect(result.sanitized).toBe('');
    });

    it('handles mixed types', () => {
      const input = {
        name: 'John',
        age: 30,
        active: true,
        roles: ['admin', 'user']
      };
      const result = OutputSanitizer.sanitize(input, { context: 'json' });
      const sanitized = result.sanitized as any;
      expect(sanitized.name).toBe('John');
      expect(sanitized.age).toBe(30);
      expect(sanitized.active).toBe(true);
      expect(Array.isArray(sanitized.roles)).toBe(true);
    });
  });
});
