// Nachweise · gekettetes Protokoll jeder Entscheidung und Ausführung.
//
// Festlegung 5: Jeder Eintrag trägt policy_id + policy_version. Inhalte
// werden vor dem Schreiben reduziert (redact.ts) — der Nachweis belegt, WAS
// geprüft und ausgeführt wurde, ohne gelesene Inhalte zu kopieren.

import { canonicalJson, sha256Hex } from './crypto.ts';

export interface EvidenceRecord {
  kind: 'decision' | 'approval' | 'execution' | 'session';
  tenant_id: string;
  session_id: string;
  actor_id: string;
  policy_id: string;
  policy_version: string;
  [key: string]: unknown;
}

export interface EvidenceEntry {
  seq: number;
  at: string;
  prev_hash: string | null;
  hash: string;
  record: EvidenceRecord;
}

export interface EvidenceSink {
  append(entry: EvidenceEntry): Promise<void>;
}

export class MemoryEvidenceSink implements EvidenceSink {
  entries: EvidenceEntry[] = [];
  async append(entry: EvidenceEntry): Promise<void> {
    this.entries.push(entry);
  }
}

async function entryHash(seq: number, at: string, prev: string | null, record: EvidenceRecord): Promise<string> {
  return sha256Hex(canonicalJson({ seq, at, prev_hash: prev, record }));
}

export class EvidenceLog {
  #sink: EvidenceSink;
  #now: () => Date;
  #seq = 0;
  #head: string | null = null;

  constructor(sink: EvidenceSink, now: () => Date = () => new Date()) {
    this.#sink = sink;
    this.#now = now;
  }

  get head(): string | null {
    return this.#head;
  }

  /** Schreibt erst in die Senke, dann rückt der Kopf vor (kein Kopf ohne Eintrag). */
  async append(record: EvidenceRecord): Promise<EvidenceEntry> {
    if (!record.policy_id || !record.policy_version) throw new Error('evidence: policy_id/policy_version fehlt');
    const seq = this.#seq + 1;
    const at = this.#now().toISOString();
    const hash = await entryHash(seq, at, this.#head, record);
    const entry: EvidenceEntry = { seq, at, prev_hash: this.#head, hash, record };
    await this.#sink.append(entry);
    this.#seq = seq;
    this.#head = hash;
    return entry;
  }
}

export interface ChainCheck {
  ok: boolean;
  checked: number;
  issues: Array<{ seq: number; issue: 'hash_mismatch' | 'broken_link' | 'sequence_gap' | 'missing_policy_version' }>;
}

export async function verifyEvidence(entries: EvidenceEntry[]): Promise<ChainCheck> {
  const issues: ChainCheck['issues'] = [];
  let prev: string | null = null;
  for (const [i, e] of entries.entries()) {
    if (e.seq !== i + 1) issues.push({ seq: e.seq, issue: 'sequence_gap' });
    if (e.prev_hash !== prev) issues.push({ seq: e.seq, issue: 'broken_link' });
    if (!e.record?.policy_version) issues.push({ seq: e.seq, issue: 'missing_policy_version' });
    if ((await entryHash(e.seq, e.at, e.prev_hash, e.record)) !== e.hash) issues.push({ seq: e.seq, issue: 'hash_mismatch' });
    prev = e.hash;
  }
  return { ok: issues.length === 0, checked: entries.length, issues };
}
