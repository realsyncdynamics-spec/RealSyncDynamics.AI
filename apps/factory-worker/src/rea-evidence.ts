import { createHash } from 'node:crypto';

export interface ReaEvidenceReceipt {
  readonly origin: 'rea-static-js-cli';
  readonly sha256: string;
  readonly bytes: number;
  readonly result: Record<string, unknown>;
  readonly limitations: readonly string[];
}

/** REA results are untrusted data, never instructions or authorization. */
export function parseReaCliEvidence(stdout: string): ReaEvidenceReceipt {
  const bytes = Buffer.byteLength(stdout, 'utf8');
  if (bytes === 0 || bytes > 2_097_152) throw new Error('factory_evidence_size_invalid');
  let data: unknown;
  try { data = JSON.parse(stdout); }
  catch { throw new Error('factory_evidence_not_json'); }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('factory_evidence_not_object');
  }
  return {
    origin: 'rea-static-js-cli',
    sha256: createHash('sha256').update(stdout, 'utf8').digest('hex'),
    bytes,
    result: data as Record<string, unknown>,
    limitations: [
      'Untrusted REA output; findings require independent validation.',
      'Local static-JavaScript inspection does not establish live behavior.',
      'Hash proves receipt integrity only, not source accuracy.',
    ],
  };
}
