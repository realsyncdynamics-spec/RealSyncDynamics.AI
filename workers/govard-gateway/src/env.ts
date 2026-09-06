/// <reference path="./cf.d.ts" />
import type { EvidenceSequencer } from "./evidence/sequencer";
import type { CommandWorkflowParams } from "./workflows/command-workflow";

/**
 * Worker-Bindings (wrangler.jsonc). Bewusst schmal:
 *  - DB              — D1: abfragbare Projektion + operative Tabellen
 *  - EVIDENCE        — Durable Object: einzige Instanz, die die Chain fortschreibt
 *  - EVIDENCE_BUCKET — R2: tägliche Seals des Chain-Heads
 *  - COMMAND_WORKFLOW — durable Ausführung freigegebener Commands
 *
 * Kein KV: Idempotenz liegt in D1 (muss transaktional mit Commands leben),
 * gecacht wird in v1 nichts.
 */
export interface Env {
  DB: D1Database;
  EVIDENCE: DurableObjectNamespace<EvidenceSequencer>;
  EVIDENCE_BUCKET: R2Bucket;
  COMMAND_WORKFLOW: Workflow<CommandWorkflowParams>;
  /** Kommagetrennte Origins für CORS (Approval Inbox im SPA). Leer = kein CORS. */
  ALLOWED_ORIGINS?: string;
}
