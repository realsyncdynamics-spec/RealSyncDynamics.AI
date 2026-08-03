import { describe, it, expect } from 'vitest';
import { buildEvidenceExportReportHtml } from '../../../src/features/evidence-vault/exportReportHtml';
import type { EvidenceExportBundle, EvidenceExportEvent } from '../../../src/features/evidence-vault/evidenceVaultApi';

function makeEvent(overrides: Partial<EvidenceExportEvent> = {}): EvidenceExportEvent {
  return {
    id: 'evt-1',
    ai_system_id: null,
    policy_id: null,
    event_type: 'agent_action',
    event_summary: 'Something happened',
    risk_level: 'medium',
    evidence: {},
    created_at: '2026-01-01T00:00:00Z',
    chain_index: 1,
    prev_hash: null,
    event_hash: 'a'.repeat(64),
    signature: 'b'.repeat(128),
    ...overrides,
  };
}

function makeBundle(overrides: Partial<EvidenceExportBundle> = {}): EvidenceExportBundle {
  return {
    tenant_id: 'tenant-1',
    exported_at: '2026-08-02T00:00:00Z',
    range: { from: '2026-05-01T00:00:00Z', to: '2026-08-02T00:00:00Z' },
    count: 1,
    redaction: { policy: 'always', hits_total: 2, hits_by_category: { email: 2 }, note: 'redacted' },
    events: [makeEvent()],
    tip: { chain_index: 1, event_hash: 'a'.repeat(64), signature: 'b'.repeat(128) },
    verifier: {
      algorithm: 'sha256-chain + hmac-sha256',
      hash_payload: 'SHA256(...)',
      signature_payload: 'HMAC-SHA256(...)',
      instructions: ['Step one', 'Step two'],
      key_handover: 'out-of-band',
    },
    ...overrides,
  };
}

describe('buildEvidenceExportReportHtml', () => {
  it('produces a valid HTML document shell', () => {
    const html = buildEvidenceExportReportHtml(makeBundle());
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('</html>');
  });

  it('includes tenant id, event count, and date range', () => {
    const bundle = makeBundle({ tenant_id: 'tenant-abc', count: 5 });
    const html = buildEvidenceExportReportHtml(bundle);
    expect(html).toContain('tenant-abc');
    expect(html).toContain('5 Event(s)');
  });

  it('renders one row per event with its chain_index and truncated hash', () => {
    const bundle = makeBundle({
      events: [
        makeEvent({ chain_index: 1, event_hash: 'a'.repeat(64) }),
        makeEvent({ chain_index: 2, event_hash: 'c'.repeat(64) }),
      ],
    });
    const html = buildEvidenceExportReportHtml(bundle);
    expect(html).toContain('aaaaaaaaaaaaaaaa');
    expect(html).toContain('cccccccccccccccc');
  });

  it('shows an empty-state message when there are no events', () => {
    const html = buildEvidenceExportReportHtml(makeBundle({ events: [] }));
    expect(html).toContain('Keine Events im gewählten Zeitraum.');
  });

  it('includes the chain tip when present', () => {
    const bundle = makeBundle({ tip: { chain_index: 7, event_hash: 'd'.repeat(64), signature: 'e'.repeat(128) } });
    const html = buildEvidenceExportReportHtml(bundle);
    expect(html).toContain('chain_index: <b>7</b>');
    expect(html).toContain('d'.repeat(64));
  });

  it('omits the chain-tip section when tip is null', () => {
    const html = buildEvidenceExportReportHtml(makeBundle({ tip: null }));
    expect(html).not.toContain('Chain-Tip');
  });

  it('renders every verifier instruction step', () => {
    const bundle = makeBundle({ verifier: { algorithm: 'x', hash_payload: '', signature_payload: '', instructions: ['A first step', 'A second step'], key_handover: '' } });
    const html = buildEvidenceExportReportHtml(bundle);
    expect(html).toContain('A first step');
    expect(html).toContain('A second step');
  });

  it('HTML-escapes event_type to prevent injection from bundle content', () => {
    const bundle = makeBundle({ events: [makeEvent({ event_type: '<script>alert(1)</script>' })] });
    const html = buildEvidenceExportReportHtml(bundle);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('HTML-escapes the tenant id', () => {
    const bundle = makeBundle({ tenant_id: '"><img src=x onerror=alert(1)>' });
    const html = buildEvidenceExportReportHtml(bundle);
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });
});
