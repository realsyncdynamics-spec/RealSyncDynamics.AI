/**
 * Provenance-Kern — kanonische Claims, Chain-of-Custody-Verifikation und
 * Trust-Score. Pure, deterministisch, wiederverwendbar in Frontend (Client-
 * seitige Re-Verifikation) und Edge-Function (Deno). Siehe die einzelnen
 * Module für Details.
 */

export {
  canonicalClaimBytes,
  claimHash,
  sha256Hex,
  sha256HexOfString,
  type ProvenanceClaim,
} from './canonicalClaim';

export {
  verifyCustodyChain,
  type CustodyEvent,
  type CustodyVerification,
  type TamperEvidenceState,
} from './custody';

export {
  computeTrustOutput,
  trustBand,
  type TrustScoreInput,
} from './trustScore';
