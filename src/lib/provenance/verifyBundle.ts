/**
 * Provenance — OFFLINE-Verifizierung eines exportierten Herkunfts-Bündels.
 *
 * Abgrenzung (bewusst KEINE Dopplung):
 *   - `independentlyVerifySignatures()` (provenanceApi) prüft eine LIVE-Kette
 *     gegen den öffentlichen Schlüssel VOM SERVER (pubkey-Op) — für den
 *     eingeloggten Nutzer.
 *   - `verifyBundle()` (hier) prüft eine EXPORTIERTE Datei gegen den in der
 *     Datei MITGELIEFERTEN Schlüssel — für Dritte OHNE App-Zugang, offline.
 *
 * Prüft vollständig: (1) Struktur/seq, (2) prev_hash-Verkettung, (3) event_hash
 * neu berechnet, (4) Ed25519-Signatur gegen den Bündel-Schlüssel. Reine
 * Primitive: `claimHash` + `verifyEd25519` — nichts neu implementiert.
 */

import { claimHash, type ProvenanceClaim } from './canonicalClaim';
import { verifyEd25519, importEd25519PublicKeySpki } from './signature';

export interface BundleEvent {
  seq: number;
  action: ProvenanceClaim['action'];
  actor: string;
  content_sha256: string;
  event_ts: string;
  prev_hash: string | null;
  event_hash: string;
  signature: string | null;
  signature_alg: 'ed25519' | 'hmac-sha256' | null;
}

export interface ProvenancePublicKey {
  alg: 'ed25519';
  key_id: string;
  spki_b64: string;
}

export interface ProvenanceBundle {
  format: 'rsd-provenance-bundle';
  version: 1;
  asset_ref: string;
  exported_at: string;
  public_key: ProvenancePublicKey | null;
  events: BundleEvent[];
}

export type BundleIssueKind =
  | 'hash_mismatch'
  | 'broken_link'
  | 'version_gap'
  | 'duplicate_version'
  | 'missing_genesis'
  | 'signature_invalid';

export interface BundleIssue {
  seq: number;
  kind: BundleIssueKind;
  detail: string;
}

export interface BundleReport {
  assetRef: string;
  count: number;
  chainIntact: boolean;
  signaturesVerified: number;
  signaturesUnverifiable: number;
  ok: boolean;
  issues: BundleIssue[];
}

function normalizeHex(h: string): string {
  return h.trim().toLowerCase().replace(/^0x/, '');
}

const HEX64 = /^[0-9a-f]{64}$/;

/** Verifiziert ein exportiertes Bündel vollständig offline (Schlüssel aus dem Bündel). */
export async function verifyBundle(bundle: ProvenanceBundle): Promise<BundleReport> {
  const assetRef = bundle.asset_ref;
  const events = [...(bundle.events ?? [])].sort((a, b) => a.seq - b.seq);
  const issues: BundleIssue[] = [];
  let signaturesVerified = 0;
  let signaturesUnverifiable = 0;

  let pubKey: CryptoKey | null = null;
  if (bundle.public_key?.spki_b64) {
    try { pubKey = await importEd25519PublicKeySpki(bundle.public_key.spki_b64); }
    catch { pubKey = null; }
  }

  let chainIntact = events.length > 0;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];

    // Struktur.
    if (ev.seq === events[i - 1]?.seq) {
      issues.push({ seq: ev.seq, kind: 'duplicate_version', detail: `seq ${ev.seq} kommt mehrfach vor.` });
      chainIntact = false;
    } else if (i === 0 && ev.seq !== 1) {
      issues.push({ seq: ev.seq, kind: 'missing_genesis', detail: `Kette beginnt bei seq ${ev.seq} statt 1.` });
      chainIntact = false;
    } else if (ev.seq !== i + 1) {
      issues.push({ seq: ev.seq, kind: 'version_gap', detail: `Erwartete seq ${i + 1}, gefunden ${ev.seq}.` });
      chainIntact = false;
    }

    // Verkettung.
    if (i === 0) {
      if (ev.prev_hash !== null) {
        issues.push({ seq: ev.seq, kind: 'broken_link', detail: 'Genesis-Event hat einen prev_hash.' });
        chainIntact = false;
      }
    } else if (normalizeHex(ev.prev_hash ?? '') !== normalizeHex(events[i - 1].event_hash)) {
      issues.push({ seq: ev.seq, kind: 'broken_link', detail: `prev_hash verweist nicht auf seq ${events[i - 1].seq}.` });
      chainIntact = false;
    }

    // Inhalt: event_hash neu berechnen.
    if (!HEX64.test(normalizeHex(ev.content_sha256))) {
      issues.push({ seq: ev.seq, kind: 'hash_mismatch', detail: 'content_sha256 ist kein gültiger Digest.' });
      chainIntact = false;
    } else {
      const claim: ProvenanceClaim = {
        assetRef, contentSha256: ev.content_sha256, issuer: ev.actor,
        action: ev.action, timestamp: ev.event_ts, prevHash: ev.prev_hash,
      };
      const recomputed = await claimHash(claim);
      if (normalizeHex(recomputed) !== normalizeHex(ev.event_hash)) {
        issues.push({ seq: ev.seq, kind: 'hash_mismatch', detail: 'Neu berechneter event_hash weicht ab — Event verändert.' });
        chainIntact = false;
      }
    }

    // Signatur (gegen den Bündel-Schlüssel; HMAC ist offline nicht prüfbar).
    if (ev.signature && ev.signature_alg === 'ed25519' && pubKey) {
      const valid = await verifyEd25519(pubKey, ev.event_hash, ev.signature);
      if (valid) signaturesVerified++;
      else issues.push({ seq: ev.seq, kind: 'signature_invalid', detail: 'Ed25519-Signatur ungültig.' });
    } else if (ev.signature) {
      signaturesUnverifiable++;
    }
  }

  return {
    assetRef,
    count: events.length,
    chainIntact,
    signaturesVerified,
    signaturesUnverifiable,
    ok: issues.length === 0,
    issues,
  };
}
