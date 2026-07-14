import { describe, it, expect } from 'vitest';
import {
  normalizeSecuritySignal,
  resolveProvider,
  mapSeverity,
} from '../../../src/lib/securitySignals/normalizeSecuritySignal';

describe('mapSeverity', () => {
  it('maps canonical strings', () => {
    expect(mapSeverity('critical')).toBe('critical');
    expect(mapSeverity('HIGH')).toBe('high');
    expect(mapSeverity('Medium')).toBe('medium');
    expect(mapSeverity('low')).toBe('low');
    expect(mapSeverity('info')).toBe('info');
  });

  it('maps aliases and provider-specific values', () => {
    expect(mapSeverity('p1')).toBe('critical');
    expect(mapSeverity('block')).toBe('critical');
    expect(mapSeverity('error')).toBe('high');
    expect(mapSeverity('warning')).toBe('medium');
    expect(mapSeverity('notice')).toBe('low');
    expect(mapSeverity('allow')).toBe('info');
  });

  it('maps numeric scores (CVSS-like and 0..1)', () => {
    expect(mapSeverity(9.8)).toBe('critical');
    expect(mapSeverity(7.5)).toBe('high');
    expect(mapSeverity(5)).toBe('medium');
    expect(mapSeverity(0.95)).toBe('critical');
    expect(mapSeverity(0)).toBe('info');
  });

  it('defaults empty to info and unknown non-empty to medium', () => {
    expect(mapSeverity('')).toBe('info');
    expect(mapSeverity(null)).toBe('info');
    expect(mapSeverity(undefined)).toBe('info');
    expect(mapSeverity('weird-value')).toBe('medium');
  });
});

describe('resolveProvider', () => {
  it('honours an explicit hint', () => {
    expect(resolveProvider('blacklens', {})).toBe('blacklens');
    expect(resolveProvider('CloudFlare', {})).toBe('cloudflare');
    expect(resolveProvider('splunk', {})).toBe('siem');
  });

  it('falls back to payload field then heuristics', () => {
    expect(resolveProvider(undefined, { provider: 'github' })).toBe('github');
    expect(resolveProvider(undefined, { ray_id: 'abc' })).toBe('cloudflare');
    expect(resolveProvider(undefined, { alert: { number: 1 } })).toBe('github');
    expect(resolveProvider(undefined, { finding_id: 'x' })).toBe('blacklens');
    expect(resolveProvider(undefined, {})).toBe('generic');
  });
});

describe('normalizeSecuritySignal — blacklens', () => {
  const payload = {
    provider: 'blacklens',
    finding_id: 'bl-demo-001',
    severity: 'critical',
    title: 'Publicly exposed admin interface',
    description: 'Admin panel exposed on public internet.',
    asset: 'https://realsyncdynamicsai.de/admin',
    first_seen: '2026-06-26T08:00:00Z',
    last_seen: '2026-06-26T08:05:00Z',
  };

  it('extracts the canonical fields', () => {
    const s = normalizeSecuritySignal(payload);
    expect(s.provider).toBe('blacklens');
    expect(s.externalId).toBe('bl-demo-001');
    expect(s.severity).toBe('critical');
    expect(s.title).toBe('Publicly exposed admin interface');
    expect(s.assetRef).toBe('https://realsyncdynamicsai.de/admin');
    expect(s.firstSeenAt).toBe('2026-06-26T08:00:00.000Z');
    expect(s.lastSeenAt).toBe('2026-06-26T08:05:00.000Z');
    expect(s.rawPayload).toEqual(payload);
    expect(s.normalizedPayload.external_id).toBe('bl-demo-001');
  });

  it('maps flexible field aliases (id/risk/domain/details)', () => {
    const s = normalizeSecuritySignal({
      id: 'alt-id', risk: 'high', name: 'Weak TLS', details: 'TLS 1.0 enabled', domain: 'example.com',
    }, 'blacklens');
    expect(s.externalId).toBe('alt-id');
    expect(s.severity).toBe('high');
    expect(s.title).toBe('Weak TLS');
    expect(s.description).toBe('TLS 1.0 enabled');
    expect(s.assetRef).toBe('example.com');
  });
});

describe('normalizeSecuritySignal — cloudflare', () => {
  it('maps WAF/firewall events', () => {
    const s = normalizeSecuritySignal({
      ray_id: '7d3f0000abcd', action: 'block', clientRequestHTTPHost: 'app.example.com',
      ruleMessage: 'SQLi attempt', datetime: '2026-06-26T09:00:00Z',
    }, 'cloudflare');
    expect(s.provider).toBe('cloudflare');
    expect(s.externalId).toBe('7d3f0000abcd');
    expect(s.severity).toBe('critical'); // action 'block' → critical
    expect(s.assetRef).toBe('app.example.com');
    expect(s.title).toBe('SQLi attempt');
  });
});

describe('normalizeSecuritySignal — github', () => {
  it('maps code-scanning alert webhooks (nested alert/rule/repository)', () => {
    const s = normalizeSecuritySignal({
      action: 'created',
      alert: { number: 42, rule: { security_severity_level: 'high', description: 'Hardcoded secret' }, created_at: '2026-06-26T07:00:00Z' },
      repository: { full_name: 'realsync/app' },
    }, 'github');
    expect(s.provider).toBe('github');
    expect(s.externalId).toBe('42');
    expect(s.severity).toBe('high');
    expect(s.title).toBe('Hardcoded secret');
    expect(s.assetRef).toBe('realsync/app');
    expect(s.firstSeenAt).toBe('2026-06-26T07:00:00.000Z');
  });
});

describe('normalizeSecuritySignal — generic + edge cases', () => {
  it('handles unknown providers via generic mapper', () => {
    const s = normalizeSecuritySignal({ external_id: 'x1', severity: 'medium', title: 'Something', resource: 'srv-01' });
    expect(s.provider).toBe('generic');
    expect(s.externalId).toBe('x1');
    expect(s.assetRef).toBe('srv-01');
  });

  it('derives a stable id when none is supplied', () => {
    const p = { severity: 'low', title: 'No id here' };
    const a = normalizeSecuritySignal(p, 'generic');
    const b = normalizeSecuritySignal({ ...p }, 'generic');
    expect(a.externalId).toBe(b.externalId);
    expect(a.externalId.length).toBeGreaterThan(0);
  });

  it('parses unix-second timestamps', () => {
    const s = normalizeSecuritySignal({ id: 'u1', timestamp: 1782000000, title: 'ts test' }, 'siem');
    expect(s.firstSeenAt).toBe(new Date(1782000000 * 1000).toISOString());
  });

  it('never throws on non-object input', () => {
    const s = normalizeSecuritySignal('not-an-object', 'generic');
    expect(s.provider).toBe('generic');
    expect(s.title).toBe('generic signal');
  });
});
