import { describe, expect, it } from 'vitest';
import {
  governanceHandoffHref,
  normalizeWebsiteSource,
  voiceHandoffHref,
  websiteHandoffHref,
} from '../../src/features/siteos/scanHandoff';

describe('audit / SiteOS / Voice / Governance handoff', () => {
  it('normalizes public domains and preserves existing https URLs', () => {
    expect(normalizeWebsiteSource('example.de')).toBe('https://example.de/');
    expect(normalizeWebsiteSource('https://example.de/contact#x')).toBe('https://example.de/contact');
    expect(normalizeWebsiteSource('http://example.de')).toBe('http://example.de/');
  });

  it('refuses non-web schemes, credentials, localhost, private IP and ports', () => {
    for (const input of [
      '', ' javascript:alert(1)', 'ftp://example.de', 'https://user:pass@example.de',
      'http://localhost', 'https://internal.local', 'http://127.0.0.1',
      'https://example.de:8080', '//example.de', 'not a domain',
    ]) {
      expect(normalizeWebsiteSource(input), input).toBeNull();
    }
  });

  it('passes only the public URL and scan identifier to the canonical SiteOS route', () => {
    const href = websiteHandoffHref('example.de', 'audit-123');
    const [path, query] = href.split('?');
    expect(path).toBe('/handwerk-website');
    const params = new URLSearchParams(query);
    expect(params.get('source_url')).toBe('https://example.de/');
    expect(params.get('audit_id')).toBe('audit-123');
    expect(params.get('source')).toBe('post_scan');
    expect(href).not.toContain('findings');
  });

  it('avoids claiming that invalid inputs are valid scan domains', () => {
    expect(websiteHandoffHref('http://localhost')).toBe('/handwerk-website');
  });

  it('routes yes through voice setup while preserving an optional governance continuation', () => {
    const voice = new URLSearchParams(voiceHandoffHref('https://example.de/', 'audit-123').split('?')[1]);
    expect(voice.get('source')).toBe('website_transformation');
    expect(voice.get('domain')).toBe('example.de');
    expect(voice.get('audit_id')).toBe('audit-123');

    const governance = governanceHandoffHref('audit-123');
    const params = new URLSearchParams(governance.split('?')[1]);
    expect(governance.split('?')[0]).toBe('/welcome');
    expect(params.get('next')).toBe('/app/activation?audit_id=audit-123');
  });

  it('allows skipping Voice even when no audit identifier is available', () => {
    const params = new URLSearchParams(governanceHandoffHref().split('?')[1]);
    expect(params.get('next')).toBe('/app/activation');
  });
});
