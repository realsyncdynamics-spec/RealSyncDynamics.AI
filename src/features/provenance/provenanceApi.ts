// Client-Wrapper um die `provenance` Edge-Function (register / append / verify).
//
// Die Function macht Signatur + Custody-Kette + Trust-Score serverseitig; der
// Client formt die Requests und kann die zurückgegebene Kette mit demselben
// reinen Kern (src/lib/provenance) UNABHÄNGIG re-verifizieren — d.h. der Nutzer
// muss dem Server nicht blind vertrauen.

import { getSupabase } from '../../lib/supabase';
import type { TrustOutput } from '../../types/models';
import { importEd25519PublicKeySpki, verifyEd25519 } from '../../lib/provenance/signature';
import type { ProvenanceBundle, BundleEvent } from '../../lib/provenance/verifyBundle';

export type SignatureAlg = 'ed25519' | 'hmac-sha256';

export interface CustodyEntry {
  seq: number;
  action: 'registered' | 'updated' | 'licensed' | 'audited';
  actor: string;
  timestamp: string;
  event_hash: string;
  signed: boolean;
  /** Rohe Ed25519/HMAC-Signatur (Hex) — nötig für unabhängige Client-Prüfung. */
  signature?: string | null;
  signature_alg?: SignatureAlg | null;
}

export interface VerifyResponse {
  ok: true;
  asset_ref: string;
  tamper_state: 'intact' | 'tampered' | 'unverifiable';
  broken_at_seq: number | null;
  trust: TrustOutput;
  custody: CustodyEntry[];
  signature?: {
    algorithm: SignatureAlg | null;
    externally_verifiable: boolean;
  };
  evidence_components: {
    metadataIntegrity: boolean;
    ownershipConsistency: boolean;
    provenanceContinuity: boolean;
  };
}

export interface PublicKeyResponse {
  ok: true;
  alg: 'ed25519' | null;
  key_id: string | null;
  public_key_spki_b64: string | null;
}

export interface RegisterResponse {
  ok: true;
  manifest_id: string;
  seq: number;
  event_hash: string;
  signed: boolean;
}

export type ProvenanceError =
  | { kind: 'forbidden' }
  | { kind: 'payment_required'; message: string }
  | { kind: 'conflict'; message: string }
  | { kind: 'not_found'; message: string }
  | { kind: 'error'; message: string };

export type ProvenanceResult<T> = { kind: 'ok'; data: T } | ProvenanceError;

function mapError(error: unknown): ProvenanceError {
  const status = (error as { context?: { status?: number } }).context?.status;
  const message = (error as { message?: string }).message ?? 'Netzwerkfehler';
  if (status === 403) return { kind: 'forbidden' };
  if (status === 402) return { kind: 'payment_required', message };
  if (status === 409) return { kind: 'conflict', message };
  if (status === 404) return { kind: 'not_found', message };
  return { kind: 'error', message };
}

async function invoke<T>(body: Record<string, unknown>): Promise<ProvenanceResult<T>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('provenance', { body });
  if (error) return mapError(error);
  return { kind: 'ok', data: data as T };
}

export function registerProvenance(args: {
  tenant_id: string;
  asset_ref: string;
  content_sha256: string;
  issuer?: string;
}): Promise<ProvenanceResult<RegisterResponse>> {
  return invoke<RegisterResponse>({ op: 'register', ...args });
}

export function appendProvenance(args: {
  tenant_id: string;
  asset_ref: string;
  content_sha256: string;
  action?: 'updated' | 'licensed' | 'audited';
  issuer?: string;
}): Promise<ProvenanceResult<RegisterResponse>> {
  return invoke<RegisterResponse>({ op: 'append', ...args });
}

export function verifyProvenance(args: {
  tenant_id: string;
  asset_ref: string;
  content_sha256?: string;
}): Promise<ProvenanceResult<VerifyResponse>> {
  return invoke<VerifyResponse>({ op: 'verify', ...args });
}

/** Öffentlicher Ed25519-Signaturschlüssel für die unabhängige Signaturprüfung. */
export function getProvenancePublicKey(): Promise<ProvenanceResult<PublicKeyResponse>> {
  return invoke<PublicKeyResponse>({ op: 'pubkey' });
}

export interface IndependentVerification {
  /** false, solange kein öffentlicher Ed25519-Schlüssel konfiguriert ist. */
  publicKeyAvailable: boolean;
  checkedCount: number;
  verifiedCount: number;
  /** seq-Nummern, deren Signatur mit dem öffentlichen Schlüssel NICHT passt. */
  failedSeqs: number[];
}

/**
 * Prüft die Ed25519-Signaturen einer Custody-Kette rein clientseitig gegen den
 * öffentlichen Schlüssel — ohne dem "signed: true"-Claim des Servers zu
 * vertrauen. Das ist der eigentliche Zweck der asymmetrischen Signatur: jeder
 * Dritte (Regulator, Kunde, externe Prüfstelle) kann dies ohne Tenant-Zugang
 * und ohne geteiltes Geheimnis nachvollziehen (getProvenancePublicKey() ist
 * öffentlich, kein Auth nötig).
 */
export async function independentlyVerifySignatures(
  custody: CustodyEntry[],
): Promise<IndependentVerification> {
  const signed = custody.filter((c) => c.signature_alg === 'ed25519' && c.signature);
  if (signed.length === 0) {
    return { publicKeyAvailable: false, checkedCount: 0, verifiedCount: 0, failedSeqs: [] };
  }

  const keyResult = await getProvenancePublicKey();
  if (keyResult.kind !== 'ok' || keyResult.data.alg !== 'ed25519' || !keyResult.data.public_key_spki_b64) {
    return { publicKeyAvailable: false, checkedCount: 0, verifiedCount: 0, failedSeqs: [] };
  }

  const publicKey = await importEd25519PublicKeySpki(keyResult.data.public_key_spki_b64);

  const failedSeqs: number[] = [];
  let verifiedCount = 0;
  for (const entry of signed) {
    const ok = await verifyEd25519(publicKey, entry.event_hash, entry.signature!);
    if (ok) verifiedCount++;
    else failedSeqs.push(entry.seq);
  }

  return { publicKeyAvailable: true, checkedCount: signed.length, verifiedCount, failedSeqs };
}

/**
 * Baut ein portables, OFFLINE prüfbares Herkunfts-Bündel (Custody-Kette + der
 * mitgelieferte öffentliche Schlüssel). Liest RLS-sicher direkt. Der Empfänger
 * prüft es ohne App-Zugang mit verifyBundle() — Schlüssel steckt im Bündel.
 */
export async function buildProvenanceBundle(tenantId: string, assetRef: string): Promise<ProvenanceResult<ProvenanceBundle>> {
  const sb = getSupabase();
  const { data: manifest, error: mErr } = await sb
    .from('provenance_manifests').select('id')
    .eq('tenant_id', tenantId).eq('asset_ref', assetRef).maybeSingle();
  if (mErr) return { kind: 'error', message: mErr.message };
  if (!manifest) return { kind: 'not_found', message: 'Kein Herkunftsnachweis für dieses Asset.' };

  const { data: events, error: eErr } = await sb
    .from('provenance_custody_events')
    .select('seq, action, actor, content_sha256, event_ts, prev_hash, event_hash, signature, signature_alg')
    .eq('manifest_id', (manifest as { id: string }).id)
    .order('seq', { ascending: true });
  if (eErr) return { kind: 'error', message: eErr.message };

  const pk = await getProvenancePublicKey();
  const publicKey = pk.kind === 'ok' && pk.data.alg === 'ed25519' && pk.data.public_key_spki_b64
    ? { alg: 'ed25519' as const, key_id: pk.data.key_id ?? 'rsd-ed25519-1', spki_b64: pk.data.public_key_spki_b64 }
    : null;

  return {
    kind: 'ok',
    data: {
      format: 'rsd-provenance-bundle',
      version: 1,
      asset_ref: assetRef,
      exported_at: new Date().toISOString(),
      public_key: publicKey,
      events: (events ?? []) as BundleEvent[],
    },
  };
}
