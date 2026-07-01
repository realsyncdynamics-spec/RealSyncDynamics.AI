/**
 * Provenance — Chain-of-Custody-Verifikation.
 *
 * Eine Custody-Kette ist eine geordnete Folge von Events pro Asset, jeweils
 * über prevHash mit dem Vorgänger verkettet (wie die runtime_events-Hash-Chain,
 * aber pro Asset statt pro Tenant). Manipulation an einem beliebigen Event
 * bricht die Kette ab diesem Punkt — das macht sie erkennbar.
 *
 * Pure, deterministisch, KEINE Side-Effects.
 */

import { claimHash, type ProvenanceClaim } from './canonicalClaim';

export interface CustodyEvent {
  seq: number;
  assetRef: string;
  contentSha256: string;
  issuer: string;
  action: ProvenanceClaim['action'];
  timestamp: string;
  prevHash: string | null;
  /** Der zum Zeitpunkt des Schreibens berechnete Hash dieses Events. */
  eventHash: string;
}

export type TamperEvidenceState = 'intact' | 'tampered' | 'unverifiable';

export interface CustodyVerification {
  state: TamperEvidenceState;
  /** seq des ersten Events, an dem die Kette bricht (null wenn intakt). */
  brokenAtSeq: number | null;
  /** Anzahl erfolgreich verketteter Events. */
  verifiedCount: number;
  /** Menschlich lesbarer Grund (für UI/Audit). */
  reason: string;
}

/**
 * Verifiziert eine Custody-Kette End-to-End.
 *
 * - `unverifiable`: leere Kette oder fehlende Hashes.
 * - `tampered`: rekomputierter Hash weicht ab ODER prevHash-Verkettung passt
 *   nicht zum vorherigen eventHash ODER seq nicht lückenlos aufsteigend.
 * - `intact`: alle Events rekomputierbar und lückenlos verkettet.
 */
export async function verifyCustodyChain(events: CustodyEvent[]): Promise<CustodyVerification> {
  if (events.length === 0) {
    return { state: 'unverifiable', brokenAtSeq: null, verifiedCount: 0, reason: 'Keine Custody-Events vorhanden.' };
  }

  const ordered = [...events].sort((a, b) => a.seq - b.seq);

  // Erstes Event muss prevHash === null haben (Kettenanfang).
  if (ordered[0].prevHash !== null) {
    return {
      state: 'tampered',
      brokenAtSeq: ordered[0].seq,
      verifiedCount: 0,
      reason: `Kettenanfang (seq ${ordered[0].seq}) hat einen prevHash, erwartet wurde null.`,
    };
  }

  let expectedPrev: string | null = null;
  let verified = 0;

  for (let i = 0; i < ordered.length; i++) {
    const ev = ordered[i];

    if (!ev.eventHash) {
      return { state: 'unverifiable', brokenAtSeq: ev.seq, verifiedCount: verified, reason: `Event seq ${ev.seq} hat keinen eventHash.` };
    }

    // seq lückenlos aufsteigend (erwartet: ordered[0].seq + i).
    if (ev.seq !== ordered[0].seq + i) {
      return { state: 'tampered', brokenAtSeq: ev.seq, verifiedCount: verified, reason: `seq-Lücke: erwartet ${ordered[0].seq + i}, gefunden ${ev.seq}.` };
    }

    // Verkettung: prevHash muss dem eventHash des Vorgängers entsprechen.
    if (normalize(ev.prevHash) !== normalize(expectedPrev)) {
      return { state: 'tampered', brokenAtSeq: ev.seq, verifiedCount: verified, reason: `prevHash von seq ${ev.seq} passt nicht zum vorherigen Event-Hash.` };
    }

    // Rekomputierten Hash gegen gespeicherten Hash prüfen.
    const recomputed = await claimHash({
      assetRef: ev.assetRef,
      contentSha256: ev.contentSha256,
      issuer: ev.issuer,
      action: ev.action,
      timestamp: ev.timestamp,
      prevHash: ev.prevHash,
    });

    if (normalize(recomputed) !== normalize(ev.eventHash)) {
      return { state: 'tampered', brokenAtSeq: ev.seq, verifiedCount: verified, reason: `Event seq ${ev.seq} wurde nach dem Signieren verändert (Hash-Mismatch).` };
    }

    expectedPrev = ev.eventHash;
    verified++;
  }

  return { state: 'intact', brokenAtSeq: null, verifiedCount: verified, reason: `${verified} Custody-Events lückenlos verifiziert.` };
}

function normalize(hex: string | null): string | null {
  return hex === null ? null : hex.trim().toLowerCase().replace(/^0x/, '');
}
