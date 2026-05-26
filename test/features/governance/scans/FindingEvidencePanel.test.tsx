/**
 * Contract tests for FindingEvidencePanel — surfaces confidence /
 * evidence_level / verification_status + raw_payload disclosure
 * for a single Finding.
 *
 * Structural-only (no JSDOM event simulation) — we render React tree
 * and walk it for substance. Toggle behavior is covered by manual
 * tap-target verification in /governance/scans/:id.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { FindingEvidencePanel } from '../../../../src/features/governance/scans/FindingEvidencePanel';
import type { Finding } from '../../../../src/types/governance/finding';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id:                  'f-1',
    tenant_id:           't-1',
    website_id:          'w-1',
    scan_run_id:         's-1',
    category:            'tracker',
    severity:            'high',
    status:              'open',
    detector:            'gdpr-audit',
    evidence_ref:        'url:https://shop.example.de/ga.js',
    summary:             'Google Analytics lädt vor Consent.',
    raw_payload:         { request_url: 'https://www.google-analytics.com/g/collect', before_consent: true },
    confidence_score:    0.87,
    evidence_level:      'observed',
    verification_status: 'unverified',
    correlation_id:      'corr-1',
    created_at:          '2026-05-25T15:00:00Z',
    updated_at:          '2026-05-25T15:00:00Z',
    ...overrides,
  };
}

function rendered(opts: { finding: Finding; defaultOpen?: boolean } = { finding: makeFinding() }) {
  const result = render(<FindingEvidencePanel finding={opts.finding} defaultOpen={opts.defaultOpen} />);
  return result.container.textContent ?? '';
}

describe('FindingEvidencePanel', () => {
  it('renders the confidence percentage', () => {
    expect(rendered()).toContain('87%');
  });

  it('renders the German evidence_level label', () => {
    expect(rendered()).toContain('beobachtet');
  });

  it('renders the German verification_status label', () => {
    expect(rendered()).toContain('unverifiziert');
  });

  it('renders observed | inferred | reported | unverifiable labels correctly', () => {
    expect(rendered({ finding: makeFinding({ evidence_level: 'observed' }) })).toContain('beobachtet');
    expect(rendered({ finding: makeFinding({ evidence_level: 'inferred' }) })).toContain('inferiert');
    expect(rendered({ finding: makeFinding({ evidence_level: 'reported' }) })).toContain('gemeldet');
    expect(rendered({ finding: makeFinding({ evidence_level: 'unverifiable' }) })).toContain('nicht verifizierbar');
  });

  it('renders all four verification_status labels correctly', () => {
    expect(rendered({ finding: makeFinding({ verification_status: 'verified' }) })).toContain('verifiziert');
    expect(rendered({ finding: makeFinding({ verification_status: 'partial' }) })).toContain('teilweise');
    expect(rendered({ finding: makeFinding({ verification_status: 'unverified' }) })).toContain('unverifiziert');
    expect(rendered({ finding: makeFinding({ verification_status: 'disputed' }) })).toContain('bestritten');
  });

  it('rounds confidence to integer percent', () => {
    expect(rendered({ finding: makeFinding({ confidence_score: 0.715 }) })).toContain('72%');
    expect(rendered({ finding: makeFinding({ confidence_score: 0.5 }) })).toContain('50%');
    expect(rendered({ finding: makeFinding({ confidence_score: 1.0 }) })).toContain('100%');
  });

  it('shows the "Evidence anzeigen" disclosure trigger', () => {
    expect(rendered()).toContain('Evidence anzeigen');
  });

  it('with defaultOpen=true, exposes raw_payload as formatted JSON', () => {
    const text = rendered({ finding: makeFinding(), defaultOpen: true });
    expect(text).toContain('google-analytics.com');
    expect(text).toContain('before_consent');
    expect(text).toContain('true');
  });

  it('with defaultOpen=true, surfaces the URL-evidence label', () => {
    expect(rendered({ finding: makeFinding(), defaultOpen: true })).toContain('shop.example.de');
  });

  it('with defaultOpen=true, handles missing evidence_ref gracefully', () => {
    expect(rendered({
      finding: makeFinding({ evidence_ref: null, raw_payload: null }),
      defaultOpen: true,
    })).toContain('Kein strukturierter Beleg');
  });

  it('always closes with the anti-legal-advice reminder when open', () => {
    expect(rendered({ finding: makeFinding(), defaultOpen: true }))
      .toMatch(/Rechtsbeistand|Datenschutzbeauftragte/i);
  });

  it('renders for all three confidence tiers without throwing', () => {
    expect(() => rendered({ finding: makeFinding({ confidence_score: 0.95 }) })).not.toThrow();
    expect(() => rendered({ finding: makeFinding({ confidence_score: 0.60 }) })).not.toThrow();
    expect(() => rendered({ finding: makeFinding({ confidence_score: 0.30 }) })).not.toThrow();
  });
});
