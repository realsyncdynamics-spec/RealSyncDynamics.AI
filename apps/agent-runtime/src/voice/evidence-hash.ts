/**
 * Evidenz-Hash-Kette für Voice (PR 4).
 *
 * GENESIS_HASH ist byte-gleich zum Contract
 * (packages/agent-runtime-contracts/src/index.ts). Docker-Build kopiert nur
 * apps/agent-runtime — deshalb lokaler Spiegel + Paritätstest.
 */

import { createHash, randomUUID } from 'node:crypto';

/** Contract GENESIS_HASH — 64 Nullen. */
export const VOICE_GENESIS_HASH =
  '0000000000000000000000000000000000000000000000000000000000000000';

export type VoiceEvidenceKind =
  | 'session.start'
  | 'session.end'
  | 'disclosure.played'
  | 'consent.granted'
  | 'consent.revoked'
  | 'turn.user'
  | 'turn.assistant'
  | 'tool.request'
  | 'policy.decision'
  | 'confirmation.received'
  | 'tool.result'
  | 'verification.result'
  | 'provider.error'
  | 'kill.engaged'
  | 'rate.limited';

export interface VoiceEvidenceRecord {
  id: string;
  tenantId: string;
  sessionId: string;
  seq: number;
  kind: VoiceEvidenceKind;
  toolRequestId: string | null;
  /** Nur Metadaten/Referenzen — keine Argumentwerte/Transkripte. */
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
  createdAt: string;
}

/** Kanonische Serialisierung für die Hash-Berechnung (stabile Key-Reihenfolge). */
export function serializeEvidenceForHash(input: {
  sessionId: string;
  tenantId: string;
  seq: number;
  kind: VoiceEvidenceKind;
  toolRequestId: string | null;
  payload: Record<string, unknown>;
  prevHash: string;
  createdAt: string;
}): string {
  return JSON.stringify({
    createdAt: input.createdAt,
    kind: input.kind,
    payload: sortKeys(input.payload),
    prevHash: input.prevHash,
    seq: input.seq,
    sessionId: input.sessionId,
    tenantId: input.tenantId,
    toolRequestId: input.toolRequestId,
  });
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function computeEvidenceHash(input: {
  sessionId: string;
  tenantId: string;
  seq: number;
  kind: VoiceEvidenceKind;
  toolRequestId: string | null;
  payload: Record<string, unknown>;
  prevHash: string;
  createdAt: string;
}): string {
  return sha256Hex(serializeEvidenceForHash(input));
}

export function appendEvidenceLink(params: {
  tenantId: string;
  sessionId: string;
  seq: number;
  kind: VoiceEvidenceKind;
  toolRequestId?: string | null;
  payload?: Record<string, unknown>;
  prevHash: string;
  createdAt?: string;
}): VoiceEvidenceRecord {
  const createdAt = params.createdAt ?? new Date().toISOString();
  const toolRequestId = params.toolRequestId ?? null;
  const payload = params.payload ?? {};
  const hash = computeEvidenceHash({
    sessionId: params.sessionId,
    tenantId: params.tenantId,
    seq: params.seq,
    kind: params.kind,
    toolRequestId,
    payload,
    prevHash: params.prevHash,
    createdAt,
  });
  return {
    id: randomUUID(),
    tenantId: params.tenantId,
    sessionId: params.sessionId,
    seq: params.seq,
    kind: params.kind,
    toolRequestId,
    payload,
    prevHash: params.prevHash,
    hash,
    createdAt,
  };
}

function sortKeys(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = value[key];
  }
  return out;
}
