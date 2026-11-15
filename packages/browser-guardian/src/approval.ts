// Freigaben · an genau eine Aktion gebunden, einmal nutzbar, fest befristet.
//
// Lokales Gegenstück zu governance_approvals + reserve_browser_execution.
// Der Fingerprint ist ein HMAC (Schlüssel bleibt im Prozess) über Mandant,
// Sitzung, die vollständige Aktion, Ziel und Richtlinienversion. Ändert
// sich die Richtlinie zwischen Freigabe und Ausführung, passt die Freigabe
// nicht mehr — dann muss neu freigegeben werden.

import { APPROVAL_TTL_SECONDS } from './policy.ts';
import { canonicalJson, hmacHex, randomId } from './crypto.ts';
import type { GuardianContext, GuardianDecision, GuardianPolicy, ReviewKind } from './types.ts';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'consumed';

export interface ApprovalRecord {
  id: string;
  fingerprint: string;
  status: ApprovalStatus;
  review: ReviewKind;
  summary_de: string;
  requested_by: string;
  decided_by: string | null;
  created_at: number;
  expires_at: number;
}

export type ConsumeOutcome = 'consumed' | 'not_found' | 'not_approved' | 'expired' | 'mismatch' | 'already_used';

/** Wer entscheidet. Ein Modell oder Planer ist nie Entscheider. */
export interface Approver {
  kind: 'human';
  id: string;
}

export function effectiveTtlSeconds(policy: GuardianPolicy): number {
  const requested = policy.approval_ttl_seconds;
  if (typeof requested !== 'number' || !Number.isFinite(requested) || requested <= 0) return APPROVAL_TTL_SECONDS;
  return Math.min(Math.floor(requested), APPROVAL_TTL_SECONDS);
}

export async function actionFingerprint(
  key: CryptoKey,
  context: GuardianContext,
  action: unknown,
  decision: Pick<GuardianDecision, 'target_origin' | 'policy_id' | 'policy_version'>,
): Promise<string> {
  const material = canonicalJson({
    v: 1,
    tenant_id: context.tenant_id,
    session_id: context.session_id,
    action,
    target_origin: decision.target_origin,
    policy_id: decision.policy_id,
    policy_version: decision.policy_version,
  });
  return `guardian:v1:${await hmacHex(key, material)}`;
}

export class ApprovalLedger {
  #records = new Map<string, ApprovalRecord>();
  #now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.#now = now;
  }

  request(input: { fingerprint: string; review: ReviewKind; summary_de: string; requested_by: string; ttl_seconds: number }): ApprovalRecord {
    const created = this.#now();
    const ttl = Math.min(Math.max(1, Math.floor(input.ttl_seconds)), APPROVAL_TTL_SECONDS);
    const record: ApprovalRecord = {
      id: randomId(),
      fingerprint: input.fingerprint,
      status: 'pending',
      review: input.review,
      summary_de: input.summary_de,
      requested_by: input.requested_by,
      decided_by: null,
      created_at: created,
      expires_at: created + ttl * 1000,
    };
    this.#records.set(record.id, record);
    return { ...record };
  }

  get(id: string): ApprovalRecord | null {
    const r = this.#records.get(id);
    return r ? { ...r } : null;
  }

  #expireIfDue(r: ApprovalRecord): void {
    if ((r.status === 'pending' || r.status === 'approved') && this.#now() >= r.expires_at) r.status = 'expired';
  }

  decide(id: string, approver: Approver, approve: boolean): ApprovalRecord {
    const r = this.#records.get(id);
    if (!r) throw new Error('APPROVAL_NOT_FOUND');
    if (!approver || approver.kind !== 'human' || !approver.id) throw new Error('APPROVER_NOT_HUMAN');
    this.#expireIfDue(r);
    if (r.status !== 'pending') throw new Error(`APPROVAL_NOT_PENDING:${r.status}`);
    r.status = approve ? 'approved' : 'rejected';
    r.decided_by = approver.id;
    return { ...r };
  }

  /** Atomar im Prozess: prüfen und verbrauchen in einem Schritt. */
  consume(id: string, fingerprint: string): ConsumeOutcome {
    const r = this.#records.get(id);
    if (!r) return 'not_found';
    this.#expireIfDue(r);
    if (r.status === 'consumed') return 'already_used';
    if (r.status === 'expired') return 'expired';
    if (r.status !== 'approved') return 'not_approved';
    if (r.fingerprint !== fingerprint) return 'mismatch';
    r.status = 'consumed';
    return 'consumed';
  }
}
