/**
 * Tests the pure-function fingerprint helper. Locks the formula so
 * any change to inputs / normalization is a deliberate decision —
 * the DB-side backfill in migration 20260612000000 uses the same
 * recipe and any drift between them silently breaks dedup.
 */
import { describe, it, expect } from 'vitest';
import { computeFindingFingerprint } from '../../../src/lib/governance/findingFingerprint';

describe('computeFindingFingerprint', () => {
  it('returns a 64-char lowercase hex string', async () => {
    const fp = await computeFindingFingerprint({
      detector:     'gdpr-audit',
      website_id:   'w-1',
      category:     'consent',
      evidence_ref: 'url:https://example.com/',
    });
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', async () => {
    const input = {
      detector:     'gdpr-audit',
      website_id:   'w-1',
      category:     'consent',
      evidence_ref: 'url:https://example.com/',
    };
    const a = await computeFindingFingerprint(input);
    const b = await computeFindingFingerprint(input);
    expect(a).toBe(b);
  });

  it('treats detector and category as case-insensitive', async () => {
    const lower = await computeFindingFingerprint({
      detector: 'gdpr-audit',  category: 'consent',
      website_id: 'w-1', evidence_ref: 'x',
    });
    const upper = await computeFindingFingerprint({
      detector: 'GDPR-AUDIT', category: 'CONSENT',
      website_id: 'w-1', evidence_ref: 'x',
    });
    expect(lower).toBe(upper);
  });

  it('treats evidence_ref as case-insensitive and trimmed', async () => {
    const a = await computeFindingFingerprint({
      detector: 'd', category: 'consent', website_id: null,
      evidence_ref: '  url:https://Example.COM/  ',
    });
    const b = await computeFindingFingerprint({
      detector: 'd', category: 'consent', website_id: null,
      evidence_ref: 'url:https://example.com/',
    });
    expect(a).toBe(b);
  });

  it('produces different hashes for different detectors', async () => {
    const a = await computeFindingFingerprint({
      detector: 'gdpr-audit',       category: 'consent',
      website_id: 'w-1', evidence_ref: 'x',
    });
    const b = await computeFindingFingerprint({
      detector: 'governance-agent', category: 'consent',
      website_id: 'w-1', evidence_ref: 'x',
    });
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different websites', async () => {
    const a = await computeFindingFingerprint({
      detector: 'd', category: 'consent',
      website_id: 'w-1', evidence_ref: 'x',
    });
    const b = await computeFindingFingerprint({
      detector: 'd', category: 'consent',
      website_id: 'w-2', evidence_ref: 'x',
    });
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different categories', async () => {
    const a = await computeFindingFingerprint({
      detector: 'd', category: 'consent',
      website_id: null, evidence_ref: 'x',
    });
    const b = await computeFindingFingerprint({
      detector: 'd', category: 'tracker',
      website_id: null, evidence_ref: 'x',
    });
    expect(a).not.toBe(b);
  });

  it('treats null/undefined/empty website_id and evidence_ref as equivalent', async () => {
    const nullRef = await computeFindingFingerprint({
      detector: 'd', category: 'consent', website_id: null, evidence_ref: null,
    });
    const emptyRef = await computeFindingFingerprint({
      detector: 'd', category: 'consent', website_id: '', evidence_ref: '',
    });
    const undefinedRef = await computeFindingFingerprint({
      detector: 'd', category: 'consent',
    });
    expect(nullRef).toBe(emptyRef);
    expect(nullRef).toBe(undefinedRef);
  });

  it('locks the formula via a regression snapshot', async () => {
    // sha256_hex of:
    //   "gdpr-audit|w-1|consent|url:https://example.com/"
    // The SQL backfill in migration 20260612000000_findings_fingerprint.sql
    // MUST produce the same value for the same input. If this snapshot
    // changes, the migration must be updated to match (and existing rows
    // re-backfilled).
    const actual = await computeFindingFingerprint({
      detector: 'gdpr-audit', website_id: 'w-1', category: 'consent',
      evidence_ref: 'url:https://example.com/',
    });
    expect(actual).toMatchInlineSnapshot(
      `"b4aa81fee08d5082558d52a819eb79e0aa4c23fdbed1e0142570353201574c9b"`,
    );
  });
});
