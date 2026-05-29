/**
 * EvidenceRef wire-format roundtrip + parser tolerance tests.
 *
 * Pinning the parse/format contract: callers store evidence_ref as a
 * string, consumers parse it back. Roundtrip equality MUST hold for
 * every valid kind; malformed input MUST land in the `opaque` bucket
 * without throwing.
 */
import { describe, it, expect } from 'vitest';
import {
  formatEvidenceRef,
  parseEvidenceRef,
  evidenceRefLabel,
  type EvidenceRef,
} from '../../src/types/governance/evidence';

describe('formatEvidenceRef + parseEvidenceRef roundtrip', () => {
  const cases: EvidenceRef[] = [
    { kind: 'url',           url: 'https://example.com/cookie-banner' },
    { kind: 'sha256',        hash: 'a'.repeat(64) },
    { kind: 'storage',       bucket: 'audit-evidence', path: 'tenant-x/scan-y/screenshot.png' },
    { kind: 'runtime-event', eventId: '11111111-2222-3333-4444-555555555555' },
    { kind: 'inline' },
  ];

  for (const ref of cases) {
    it(`roundtrips kind=${ref.kind}`, () => {
      const wire = formatEvidenceRef(ref);
      const parsed = parseEvidenceRef(wire);
      expect(parsed).toEqual(ref);
    });
  }
});

describe('parseEvidenceRef tolerance', () => {
  it('returns null for null / undefined / empty', () => {
    expect(parseEvidenceRef(null)).toBeNull();
    expect(parseEvidenceRef(undefined)).toBeNull();
    expect(parseEvidenceRef('')).toBeNull();
  });

  it('falls back to opaque for unknown prefix', () => {
    const out = parseEvidenceRef('weird://anything');
    expect(out).toEqual({ kind: 'opaque', raw: 'weird://anything' });
  });

  it('rejects malformed sha256 (wrong length, non-hex)', () => {
    expect(parseEvidenceRef('sha256:short')).toEqual({ kind: 'opaque', raw: 'sha256:short' });
    expect(parseEvidenceRef('sha256:' + 'g'.repeat(64))).toEqual({ kind: 'opaque', raw: 'sha256:' + 'g'.repeat(64) });
  });

  it('rejects url: without http(s):// prefix', () => {
    expect(parseEvidenceRef('url:ftp://x')).toEqual({ kind: 'opaque', raw: 'url:ftp://x' });
  });

  it('rejects malformed runtime-event: ref', () => {
    expect(parseEvidenceRef('runtime-event:not-a-uuid'))
      .toEqual({ kind: 'opaque', raw: 'runtime-event:not-a-uuid' });
  });

  it('rejects storage:// without bucket+path separator', () => {
    expect(parseEvidenceRef('storage://just-bucket'))
      .toEqual({ kind: 'opaque', raw: 'storage://just-bucket' });
  });

  it('lowercases sha256 hex on parse', () => {
    const upper = 'A'.repeat(64);
    const parsed = parseEvidenceRef(`sha256:${upper}`);
    expect(parsed).toEqual({ kind: 'sha256', hash: 'a'.repeat(64) });
  });

  it('lowercases sha256 hex on format', () => {
    const wire = formatEvidenceRef({ kind: 'sha256', hash: 'F'.repeat(64) });
    expect(wire).toBe(`sha256:${'f'.repeat(64)}`);
  });

  it('strips leading slash from storage path on format', () => {
    const wire = formatEvidenceRef({ kind: 'storage', bucket: 'b', path: '/nested/file.png' });
    expect(wire).toBe('storage://b/nested/file.png');
  });
});

describe('evidenceRefLabel', () => {
  it('host-only for URL', () => {
    const label = evidenceRefLabel({ kind: 'url', url: 'https://example.com/long/path/screenshot.png' });
    expect(label).toBe('URL · example.com');
  });

  it('truncated hash for sha256', () => {
    const label = evidenceRefLabel({ kind: 'sha256', hash: 'abc123def456' + 'x'.repeat(52) });
    expect(label).toMatch(/^Hash · abc123def456…$/);
  });

  it('falls back to raw for malformed URL', () => {
    const label = evidenceRefLabel({ kind: 'url', url: 'not-a-url' });
    expect(label).toBe('URL · not-a-url');
  });

  it('truncates long opaque refs to 60 chars + ellipsis', () => {
    const label = evidenceRefLabel({ kind: 'opaque', raw: 'x'.repeat(200) });
    expect(label.length).toBe(58);
    expect(label).toMatch(/…$/);
  });
});
