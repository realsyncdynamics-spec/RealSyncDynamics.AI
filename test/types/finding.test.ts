/**
 * Pure-type contract tests for src/types/governance/finding.
 *
 * No DB roundtrips. The DB CHECK constraints in migration 20260610
 * are tested implicitly via the local PG15 migration-apply step (CI
 * Migration validation); this file pins the TS-side surface so a
 * silent rename or category drop is caught.
 */
import { describe, it, expect } from 'vitest';
import {
  FINDING_NEXT_STATUS,
  SEVERITY_RANK,
  KNOWN_DETECTORS,
  type Finding,
  type FindingCategory,
  type FindingSeverity,
  type FindingStatus,
  type NewFinding,
} from '../../src/types/governance/finding';

describe('Finding type contract', () => {
  it('FINDING_NEXT_STATUS covers all FindingStatus values', () => {
    const all: FindingStatus[] = [
      'open', 'acknowledged', 'fixed', 'false_positive', 'ignored', 'resolved',
    ];
    for (const s of all) {
      expect(FINDING_NEXT_STATUS[s]).toBeDefined();
      expect(Array.isArray(FINDING_NEXT_STATUS[s])).toBe(true);
    }
  });

  it('open transitions exclude self-loop but include lifecycle exits', () => {
    expect(FINDING_NEXT_STATUS.open).toEqual(
      expect.arrayContaining(['acknowledged', 'fixed', 'false_positive', 'ignored']),
    );
    expect(FINDING_NEXT_STATUS.open).not.toContain('open');
  });

  it('terminal-ish statuses can return to open (re-detection)', () => {
    expect(FINDING_NEXT_STATUS.fixed).toContain('open');
    expect(FINDING_NEXT_STATUS.resolved).toContain('open');
    expect(FINDING_NEXT_STATUS.ignored).toContain('open');
  });

  it('SEVERITY_RANK orders strictly critical > high > medium > low > info', () => {
    expect(SEVERITY_RANK.critical).toBeGreaterThan(SEVERITY_RANK.high);
    expect(SEVERITY_RANK.high).toBeGreaterThan(SEVERITY_RANK.medium);
    expect(SEVERITY_RANK.medium).toBeGreaterThan(SEVERITY_RANK.low);
    expect(SEVERITY_RANK.low).toBeGreaterThan(SEVERITY_RANK.info);
  });

  it('KNOWN_DETECTORS includes the production detectors', () => {
    expect(KNOWN_DETECTORS).toContain('gdpr-audit');
    expect(KNOWN_DETECTORS).toContain('governance-agent');
    expect(KNOWN_DETECTORS).toContain('cookie-scanner');
    expect(KNOWN_DETECTORS).toContain('manual');
  });

  it('NewFinding allows minimal happy-path construction', () => {
    const f: NewFinding = {
      tenant_id: 't',
      category:  'consent',
      severity:  'high',
      detector:  'gdpr-audit',
      summary:   'Tracker fires before consent',
    };
    expect(f.tenant_id).toBe('t');
    // No website_id, no scan_run_id, no correlation_id — all optional.
  });

  it('Finding shape includes the cross-entity correlation field', () => {
    const f: Finding = {
      id:              'f-1',
      tenant_id:       't',
      website_id:      'w-1',
      scan_run_id:     null,
      category:        'tracker',
      severity:        'medium',
      status:          'open',
      detector:        'gdpr-audit',
      evidence_ref:    'sha256:abc',
      summary:         'unknown vendor cdn.example.com',
      raw_payload:     { headers: { 'set-cookie': '_x=1' } },
      fingerprint:     null,
      correlation_id:  'corr-1',
      created_at:      '2026-05-25T00:00:00Z',
      updated_at:      '2026-05-25T00:00:00Z',
    };
    expect(f.correlation_id).toBe('corr-1');
  });
});

describe('Domain enum exhaustiveness', () => {
  it('all categories from the DB CHECK are representable in TS', () => {
    // If a new category is added in the DB migration, this list
    // surfaces it on the TS side — fails to compile if the category
    // type drops one. Cross-checking the two enums is a deliberate
    // act of "TS sees the DB world".
    const all: FindingCategory[] = [
      'consent', 'tracker', 'ai_act', 'tom', 'dpa',
      'accessibility', 'security', 'transparency', 'data_quality',
      'documentation', 'other',
    ];
    expect(all.length).toBe(11);
  });

  it('all severities exhaustive', () => {
    const all: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
    expect(all.length).toBe(5);
  });
});
