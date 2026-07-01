/**
 * Provenance — kanonische Claim-Serialisierung + Hashing.
 *
 * Pure, deterministisch, KEINE DB-/Netzwerk-Zugriffe. Analog zu
 * src/lib/governance/runtime-math.ts: dasselbe Input ⇒ exakt dieselben Bytes,
 * in TS (Frontend/Client) UND in der Edge-Function (Deno). Wenn diese
 * Serialisierung drift't, drift't die gesamte Provenance-Kette.
 *
 * Der "Claim" ist die signier- und hashbare Kern-Aussage eines
 * Herkunftsnachweises (C2PA-angelehntes Datenmodell, nicht COSE_Sign1):
 * Wer (issuer) bindet welchen Inhalt (contentSha256) zu welchem Asset
 * (assetRef) zu welchem Zeitpunkt, verkettet mit dem vorherigen Zustand
 * (prevHash) — das macht nachträgliche Manipulation erkennbar.
 */

export interface ProvenanceClaim {
  /** Asset-Referenz (tenant-eindeutig), z.B. "AST-2026-0007". */
  assetRef: string;
  /** SHA-256 des Inhalts-Bytes als Lowercase-Hex (64 Zeichen). */
  contentSha256: string;
  /** Herausgeber-Kennung (Tenant/Actor/Signing-Key-Subject). */
  issuer: string;
  /** Custody-Aktion, die diesen Claim erzeugt. */
  action: 'registered' | 'updated' | 'licensed' | 'audited';
  /** ISO-8601-UTC-Zeitstempel. */
  timestamp: string;
  /** Hash des vorherigen Custody-Events (Hex) oder null beim ersten Eintrag. */
  prevHash: string | null;
}

/**
 * Kanonische UTF-8-Bytes eines Claims. Schlüssel-Reihenfolge ist EXPLIZIT
 * festgelegt — niemals auf Objekt-Insert-Order vertrauen.
 */
export function canonicalClaimBytes(claim: ProvenanceClaim): Uint8Array {
  const ordered: Record<string, unknown> = {
    assetRef: claim.assetRef,
    contentSha256: normalizeHex(claim.contentSha256),
    issuer: claim.issuer,
    action: claim.action,
    timestamp: claim.timestamp,
    prevHash: claim.prevHash === null ? null : normalizeHex(claim.prevHash),
  };
  return new TextEncoder().encode(JSON.stringify(ordered));
}

/** SHA-256 über beliebige Bytes → Lowercase-Hex. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await getCrypto().subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return bufToHex(new Uint8Array(digest));
}

/** SHA-256 eines UTF-8-Strings → Lowercase-Hex. */
export function sha256HexOfString(input: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(input));
}

/**
 * Hash eines Custody-Events: sha256( canonicalClaimBytes(claim) ).
 * Der prevHash steckt bereits im Claim → daraus entsteht die Kette.
 */
export function claimHash(claim: ProvenanceClaim): Promise<string> {
  return sha256Hex(canonicalClaimBytes(claim));
}

// ── intern ──────────────────────────────────────────────────────────────────

function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase().replace(/^0x/, '');
}

function bufToHex(buf: Uint8Array): string {
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    out += buf[i].toString(16).padStart(2, '0');
  }
  return out;
}

function getCrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error('WebCrypto (crypto.subtle) ist in dieser Umgebung nicht verfügbar.');
  }
  return c;
}
