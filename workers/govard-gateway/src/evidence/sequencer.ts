/// <reference path="../cf.d.ts" />
import { DurableObject } from "cloudflare:workers";
import { canonicalJson, sha256Hex } from "../lib/hash";
import type { Env } from "../env";
import type { AppendResult, EvidenceInput, EvidenceRecord } from "../types";

interface ChainHead {
  sequence: number;
  hash: string;
}

const GENESIS = "GENESIS";
const seqKey = (n: number) => `event:${String(n).padStart(12, "0")}`;

/**
 * Eine Instanz pro Org: env.EVIDENCE.get(env.EVIDENCE.idFromName(orgId)).
 *
 * Das Input-Gate des Durable Object serialisiert konkurrierende append()-
 * Aufrufe — Lesen des Heads und Schreiben des Nachfolgers können sich nie
 * verschränken. Genau das beseitigt das Fork-Risiko, das ein
 * `SELECT ... ORDER BY created_at DESC LIMIT 1` gegen D1 hätte.
 *
 * Haltbarkeitsmodell:
 *   DO-Storage = Quelle der Wahrheit  (Head + Event in EINER Transaktion)
 *   D1         = abfragbare Projektion, idempotent, per Alarm nachgeholt
 * Ein fehlgeschlagener D1-Write hinterlässt deshalb nie eine Lücke in der Chain.
 */
export class EvidenceSequencer extends DurableObject<Env> {
  async append(input: EvidenceInput): Promise<AppendResult> {
    const head = (await this.ctx.storage.get<ChainHead>("head")) ?? {
      sequence: 0,
      hash: GENESIS,
    };

    const sequence = head.sequence + 1;
    const created_at = new Date().toISOString();

    // Genau diese Felder, kanonisch geordnet, deckt der Hash ab.
    const signed = {
      org_id: input.org_id,
      sequence,
      command_id: input.command_id,
      actor_id: input.actor_id,
      event_type: input.event_type,
      payload: input.payload,
      previous_hash: head.hash,
      created_at,
    };

    const event_hash = await sha256Hex(canonicalJson(signed));
    const record: EvidenceRecord = { id: crypto.randomUUID(), ...signed, event_hash };

    // Atomar: Event und neuer Head werden zusammen committet oder gar nicht.
    await this.ctx.storage.transaction(async (txn) => {
      await txn.put(seqKey(sequence), record);
      await txn.put("head", { sequence, hash: event_hash } satisfies ChainHead);
    });

    const projected = await this.project(record);
    if (!projected) {
      await this.ctx.storage.put("unprojected_from",
        (await this.ctx.storage.get<number>("unprojected_from")) ?? sequence);
      await this.ctx.storage.setAlarm(Date.now() + 10_000);
    }

    return { sequence, event_hash, previous_hash: head.hash, projected };
  }

  /** Idempotenter Spiegel nach D1, über das UNIQUE (org_id, sequence). */
  private async project(r: EvidenceRecord): Promise<boolean> {
    try {
      await this.env.DB.prepare(
        `INSERT OR IGNORE INTO evidence_events
           (id, org_id, sequence, command_id, actor_id, event_type,
            payload, previous_hash, event_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(r.id, r.org_id, r.sequence, r.command_id, r.actor_id, r.event_type,
              canonicalJson(r.payload), r.previous_hash, r.event_hash, r.created_at)
        .run();
      return true;
    } catch (err) {
      console.error("evidence projection failed", r.org_id, r.sequence, err);
      return false;
    }
  }

  /** Retry-Schleife für die D1-Projektion. Die Chain selbst ist bereits versiegelt. */
  async alarm(): Promise<void> {
    const from = await this.ctx.storage.get<number>("unprojected_from");
    const head = await this.ctx.storage.get<ChainHead>("head");
    if (from === undefined || !head) return;

    for (let s = from; s <= head.sequence; s++) {
      const record = await this.ctx.storage.get<EvidenceRecord>(seqKey(s));
      if (!record) continue;
      if (!(await this.project(record))) {
        await this.ctx.storage.put("unprojected_from", s);
        await this.ctx.storage.setAlarm(Date.now() + 60_000);
        return;
      }
    }
    await this.ctx.storage.delete("unprojected_from");
  }

  async head(): Promise<ChainHead> {
    return (await this.ctx.storage.get<ChainHead>("head")) ?? { sequence: 0, hash: GENESIS };
  }

  /**
   * Rechnet jeden Hash ab GENESIS nach. Das ist die Audit-Demo: entweder
   * { valid: true } — oder die exakte Sequenznummer, an der die Kette bricht.
   */
  async verify(): Promise<{ valid: boolean; checked: number; brokenAt?: number }> {
    const head = await this.head();
    let previous = GENESIS;

    for (let s = 1; s <= head.sequence; s++) {
      const r = await this.ctx.storage.get<EvidenceRecord>(seqKey(s));
      if (!r || r.previous_hash !== previous) return { valid: false, checked: s - 1, brokenAt: s };

      const { id: _id, event_hash, ...signed } = r;
      if ((await sha256Hex(canonicalJson(signed))) !== event_hash) {
        return { valid: false, checked: s - 1, brokenAt: s };
      }
      previous = event_hash;
    }
    return { valid: previous === head.hash, checked: head.sequence };
  }

  /**
   * Versiegelt den aktuellen Head nach R2. Läuft täglich per Cron. Ohne
   * externes Siegel beweist eine Chain, die man allein kontrolliert, wenig —
   * hier hakt später die bestehende CreatorSeal-Verankerung ein (anchor_ref).
   */
  async seal(orgId: string): Promise<{ sequence: number; head_hash: string; r2_key: string }> {
    const head = await this.head();
    const created_at = new Date().toISOString();
    const r2_key = `seals/${orgId}/${created_at}-${head.sequence}.json`;

    await this.env.EVIDENCE_BUCKET.put(
      r2_key,
      canonicalJson({ org_id: orgId, ...head, created_at }),
      { httpMetadata: { contentType: "application/json" } },
    );

    await this.env.DB.prepare(
      `INSERT OR IGNORE INTO evidence_seals
         (id, org_id, sequence, head_hash, r2_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(crypto.randomUUID(), orgId, head.sequence, head.hash, r2_key, created_at)
      .run();

    return { sequence: head.sequence, head_hash: head.hash, r2_key };
  }
}

/** Einziger Einstiegspunkt. Den Stub nirgendwo anders konstruieren. */
export function evidenceFor(env: Env, orgId: string) {
  return env.EVIDENCE.get(env.EVIDENCE.idFromName(orgId));
}
