/**
 * Browser / Node client for the Governance Telemetry Ingestion API.
 *
 *   POST /functions/v1/governance-ingest
 *   Authorization: Bearer rsd_gov_<token>
 *
 * Same shape on both runtimes: relies on the global `fetch`. No
 * external deps so this module can be imported into the future
 * browser-extension build without bundler concerns.
 *
 * Field names mirror the API payload (snake_case) rather than the
 * dashboard's camelCase domain model — the API is the wire contract
 * and the domain model is a UI projection.
 */

export type IngestEventSource =
  | "website_scanner"
  | "browser_extension"
  | "sdk"
  | "api"
  | "github"
  | "ci_cd"
  | "manual"
  | "agent_runtime";

export type IngestRiskLevel = "info" | "low" | "medium" | "high" | "critical";

export type IngestPolicyAction =
  | "allow"
  | "log"
  | "warn"
  | "block"
  | "require_approval";

export type IngestEvidenceType =
  | "screenshot"
  | "har"
  | "json"
  | "log"
  | "pdf"
  | "hash"
  | "policy_snapshot"
  | "approval"
  | "pull_request";

export interface IngestEvent {
  asset_id?: string;
  policy_id?: string;
  event_type: string;
  event_source: IngestEventSource;
  title: string;
  summary?: string;
  risk_level?: IngestRiskLevel;
  actor_email?: string;
  vendor?: string;
  model_name?: string;
  data_types?: string[];
  policy_action?: IngestPolicyAction;
  payload?: Record<string, unknown>;
}

export interface IngestEvidence {
  evidence_type: IngestEvidenceType;
  title: string;
  storage_path?: string;
  content_hash?: string;
  previous_hash?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestItem {
  event: IngestEvent;
  evidence?: IngestEvidence[];
}

export interface IngestClientOptions {
  /** Full URL to the deployed function, e.g. https://xyz.supabase.co/functions/v1/governance-ingest */
  url: string;
  /** API token in the form `rsd_gov_…` */
  token: string;
  /** Override fetch (useful in tests or non-browser runtimes). */
  fetch?: typeof fetch;
}

export interface PolicyDecision {
  event_id: string;
  policy_id: string;
  action: IngestPolicyAction;
}

export interface IngestResponseOk {
  ok: true;
  event_ids: string[];
  evidence_ids: string[];
  /**
   * One entry per event that the server-side Policy Engine matched.
   * The `action` value reflects the strictest matched policy
   * (block > require_approval > warn > log > allow) and is the
   * authoritative outcome — any `policy_id` / `policy_action` hint
   * the caller sent is overridden.
   */
  policy_decisions: PolicyDecision[];
}

export interface IngestResponseErr {
  ok: false;
  error: { code: string; message: string };
}

export type IngestResponse = IngestResponseOk | IngestResponseErr;

export class IngestClient {
  private readonly url: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: IngestClientOptions) {
    this.url = options.url;
    this.token = options.token;
    this.fetchImpl = options.fetch ?? fetch;
  }

  /** Send a single event with optional evidence. */
  async send(event: IngestEvent, evidence?: IngestEvidence[]): Promise<IngestResponse> {
    return this.post({ event, evidence });
  }

  /** Send a batch of up to 50 items. */
  async sendBatch(items: IngestItem[]): Promise<IngestResponse> {
    return this.post({ events: items });
  }

  private async post(body: Record<string, unknown>): Promise<IngestResponse> {
    const res = await this.fetchImpl(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    try {
      return (await res.json()) as IngestResponse;
    } catch {
      return {
        ok: false,
        error: { code: "INVALID_RESPONSE", message: `HTTP ${res.status}` },
      };
    }
  }
}
