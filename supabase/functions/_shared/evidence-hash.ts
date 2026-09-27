// Content hash convention for public.governance_evidence rows.
//
// Until 2026-09-25 nothing in the code base or the DB defined how
// governance_evidence.content_hash is computed (governance-ingest passes
// caller-supplied values through; the seeded row e8d9b511 is not
// reproducible). The first defined link is the owner-approved manual resolve
// evidence 58bca6e1-010f-4a84-807f-41b727c80699, and this helper implements
// exactly that convention so every automated writer chains the same way:
//
//   metadata.snapshot   = plain JSON object with everything the hash covers,
//                         including `previous_hash` (the chain link) and the
//                         raw observations (e.g. DNS records)
//   metadata.hash_method = EVIDENCE_HASH_METHOD
//   content_hash        = sha256_hex( utf8( RFC8785_JCS(metadata.snapshot) ) )
//   previous_hash       = content_hash of the tenant's latest evidence row,
//                         read at write time (null for a tenant's first link)
//
// JCS (RFC 8785, cf. spec/runtime/evidence-chain.md §3): object keys sorted by
// UTF-16 code units, no insignificant whitespace, ES6 number/string
// serialisation — which is exactly what JSON.stringify produces for leaves.
// Verification: recompute canonicalJson(metadata.snapshot), hash it, compare
// with content_hash, and compare snapshot.previous_hash with the predecessor.
//
// No Deno / jsr imports: vitest-importable. Pinned by
// test/edge/evidence-hash.test.ts against the live manual row.

import { sha256Hex } from './hash.ts';

export const EVIDENCE_HASH_METHOD = 'sha256_hex(utf8(RFC8785_JCS(metadata.snapshot)))';

/** RFC 8785 canonical JSON for JSON-compatible values (undefined keys are dropped). */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonicalJson: non-finite number');
    return JSON.stringify(value);
  }
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Default sort compares UTF-16 code units — the order RFC 8785 requires.
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
  }
  throw new Error(`canonicalJson: unsupported type ${typeof value}`);
}

/** content_hash for a governance_evidence row whose metadata.snapshot is `snapshot`. */
export function evidenceContentHash(snapshot: Record<string, unknown>): Promise<string> {
  return sha256Hex(canonicalJson(snapshot));
}
