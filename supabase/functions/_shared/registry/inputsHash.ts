// inputs_hash eines Assessment-Snapshots.
//
// Gleiche Konvention wie governance_evidence.content_hash
// (_shared/evidence-hash.ts): sha256_hex(utf8(RFC8785_JCS(value))). Der Helper
// wird wiederverwendet statt nachgebaut, damit es genau EINE kanonische
// Serialisierung im Code gibt.

import { canonicalJson } from '../evidence-hash.ts';
import { sha256Hex } from '../hash.ts';

export const ASSESSMENT_INPUTS_HASH_METHOD = 'sha256_hex(utf8(RFC8785_JCS(inputs)))';

export function assessmentInputsHash(inputs: unknown): Promise<string> {
  return sha256Hex(canonicalJson(inputs));
}
