// P4-impl-2 — Cost-Writer in LLM-Provider-Wrappern
// (docs/architecture/runtime-kernel-rfc.md §P4 + §6 P4-impl-2)
//
// Schreibt pro abgeschlossenem AI-Call genau eine Zeile in
// `tenant_cost_ledger` pro nicht-leerem Token-Bucket (llm_input,
// llm_output). amount_usd ist eine GENERATED-Spalte (units *
// unit_price_usd) — die Caller-Seite setzt sie nicht.
//
// Attribution-CHECK aus dem Schema verlangt mindestens eins von
// agent_ref / flow_ref / trace_id. Diese Funktion validiert das
// vorab, damit eine fehlerhafte Konfiguration nicht erst als
// DB-Constraint-Violation auftaucht. Simulierte Entries (Replay)
// brauchen zusätzlich `replayRunId`, sonst greift
// `cost_ledger_sim_has_run`.

type AdminClient = {
  from(table: string): {
    insert(rows: unknown[]): Promise<{ data: unknown; error: { message: string } | null }>;
  };
};

export interface CostAttribution {
  tenantId: string;
  agentRef?: string | null;
  flowRef?: string | null;
  traceId?: string | null;
  correlationId?: string | null;
}

export interface LlmCostArgs extends CostAttribution {
  inputTokens: number;
  outputTokens: number;
  /** USD pro 1_000_000 Input-Tokens (z.B. 3.0 für Claude Sonnet). */
  inputPricePerMillionUsd: number;
  /** USD pro 1_000_000 Output-Tokens. */
  outputPricePerMillionUsd: number;
  vendor?: string | null;
  modelRef?: string | null;
  isSimulated?: boolean;
  replayRunId?: string | null;
  rawMetadata?: Record<string, unknown>;
}

export interface LedgerRow {
  tenant_id: string;
  agent_ref: string | null;
  flow_ref: string | null;
  trace_id: string | null;
  correlation_id: string | null;
  cost_kind: 'llm_input' | 'llm_output';
  units: number;
  unit_price_usd: number;
  vendor: string | null;
  model_ref: string | null;
  is_simulated: boolean;
  replay_run_id: string | null;
  raw_metadata: Record<string, unknown>;
}

export function buildLlmLedgerRows(args: LlmCostArgs): LedgerRow[] {
  if (!args.agentRef && !args.flowRef && !args.traceId) {
    throw new Error(
      'cost-writer: attribution required — set at least one of agentRef, flowRef, traceId'
    );
  }
  if (args.isSimulated && !args.replayRunId) {
    throw new Error('cost-writer: simulated entries require replayRunId');
  }
  if (args.inputTokens < 0 || args.outputTokens < 0) {
    throw new Error('cost-writer: token counts must be non-negative');
  }

  const base = {
    tenant_id: args.tenantId,
    agent_ref: args.agentRef ?? null,
    flow_ref: args.flowRef ?? null,
    trace_id: args.traceId ?? null,
    correlation_id: args.correlationId ?? null,
    vendor: args.vendor ?? null,
    model_ref: args.modelRef ?? null,
    is_simulated: args.isSimulated ?? false,
    replay_run_id: args.replayRunId ?? null,
    raw_metadata: args.rawMetadata ?? {},
  };

  const rows: LedgerRow[] = [];
  if (args.inputTokens > 0) {
    rows.push({
      ...base,
      cost_kind: 'llm_input',
      units: args.inputTokens,
      unit_price_usd: args.inputPricePerMillionUsd / 1_000_000,
    });
  }
  if (args.outputTokens > 0) {
    rows.push({
      ...base,
      cost_kind: 'llm_output',
      units: args.outputTokens,
      unit_price_usd: args.outputPricePerMillionUsd / 1_000_000,
    });
  }
  return rows;
}

export async function writeLlmCostEntries(
  admin: AdminClient,
  args: LlmCostArgs
): Promise<{ inserted: number }> {
  const rows = buildLlmLedgerRows(args);
  if (rows.length === 0) return { inserted: 0 };
  const { error } = await admin.from('tenant_cost_ledger').insert(rows);
  if (error) throw new Error(`cost-writer insert failed: ${error.message}`);
  return { inserted: rows.length };
}
