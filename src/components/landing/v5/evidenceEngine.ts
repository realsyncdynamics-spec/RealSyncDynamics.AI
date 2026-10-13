/**
 * Evidence Engine — Canvas stage + real SHA-256 chain via WebCrypto.
 * Live adapter: window.RealSyncEvidence.push({ system, verdict, rule, message, ts })
 */

export type Verdict = 'allow' | 'warn' | 'block' | 'require_approval';

export interface EvidenceEvent {
  system: string;
  verdict: Verdict;
  rule: string;
  message: string;
  ts: number;
}

export interface ChainBlock {
  index: number;
  event: EvidenceEvent;
  hash: string;
  prev: string;
}

const GENESIS = '0'.repeat(64);

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class EvidenceEngineCore {
  private chain: ChainBlock[] = [];
  private listeners = new Set<() => void>();

  async push(event: EvidenceEvent): Promise<ChainBlock> {
    const prev = this.chain.length ? this.chain[this.chain.length - 1].hash : GENESIS;
    const payload = JSON.stringify({ ...event, prev });
    const hash = await sha256(payload);
    const block: ChainBlock = {
      index: this.chain.length,
      event,
      hash,
      prev,
    };
    this.chain.push(block);
    this.notify();
    return block;
  }

  getChain(): readonly ChainBlock[] {
    return this.chain;
  }

  async verify(): Promise<boolean> {
    let prev = GENESIS;
    for (const block of this.chain) {
      if (block.prev !== prev) return false;
      const payload = JSON.stringify({ ...block.event, prev: block.prev });
      const expected = await sha256(payload);
      if (expected !== block.hash) return false;
      prev = block.hash;
    }
    return true;
  }

  /** Simulate tampering of the last block for demo. */
  async tamperLast(): Promise<void> {
    if (!this.chain.length) return;
    const last = this.chain[this.chain.length - 1];
    last.event.message += ' [TAMPERED]';
    // Hash is intentionally not recomputed — verification will fail.
    this.notify();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }
}

export const evidenceEngine = new EvidenceEngineCore();

// Live adapter
declare global {
  interface Window {
    RealSyncEvidence?: {
      push: (event: EvidenceEvent) => Promise<ChainBlock>;
    };
  }
}

if (typeof window !== 'undefined') {
  window.RealSyncEvidence = {
    push: (event) => evidenceEngine.push(event),
  };
}
