// Client-Wrapper um die `provenance` Edge-Function (register / append / verify).
//
// Die Function macht Signatur + Custody-Kette + Trust-Score serverseitig; der
// Client formt die Requests und kann die zurückgegebene Kette mit demselben
// reinen Kern (src/lib/provenance) UNABHÄNGIG re-verifizieren — d.h. der Nutzer
// muss dem Server nicht blind vertrauen.

import { getSupabase } from '../../lib/supabase';
import type { TrustOutput } from '../../types/models';

export interface CustodyEntry {
  seq: number;
  action: 'registered' | 'updated' | 'licensed' | 'audited';
  actor: string;
  timestamp: string;
  event_hash: string;
  signed: boolean;
}

export interface VerifyResponse {
  ok: true;
  asset_ref: string;
  tamper_state: 'intact' | 'tampered' | 'unverifiable';
  broken_at_seq: number | null;
  trust: TrustOutput;
  custody: CustodyEntry[];
  evidence_components: {
    metadataIntegrity: boolean;
    ownershipConsistency: boolean;
    provenanceContinuity: boolean;
  };
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
