/**
 * RealSyncDynamicsAI — AI Runtime Telemetry SDK (Stub).
 *
 * Kleine, abhaengigkeitsfreie TypeScript-Library zum Senden von
 * AI-Runtime-Events an das Governance-OS. Spaeter konsumiert von:
 *   - n8n-Custom-Nodes
 *   - eigenen Agents
 *   - OpenAI/Anthropic-Wrappern
 *   - Browser-Extension (Folge-PR)
 *
 * Backend: edge function `telemetry-ai-event` (siehe
 * supabase/functions/telemetry-ai-event/index.ts).
 *
 * Beispiel:
 *   const client = createTelemetryClient({
 *     endpoint: 'https://realsyncdynamicsai.de/api/telemetry/ai-event',
 *     tenantKey: process.env.RSD_TENANT_KEY!,
 *   });
 *
 *   await client.trackAiEvent({
 *     event_type: 'prompt_sent',
 *     vendor: 'openai',
 *     model: 'gpt-4.1',
 *     prompt_category: 'code_generation',
 *     data_class: 'internal',
 *     risk_level: 'low',
 *     prompt_tokens: 320,
 *     metadata: { project: 'reporting-pipeline' },
 *   });
 *
 * In dieser PR ist die Library Stub-Niveau: synchroner Single-Event-Call,
 * kein Buffering, kein Retry-Loop, kein Hash-Stripping. Folge-PRs
 * (Browser-Extension, Policy-Enforcement) erweitern sie um Batch + Retry +
 * HMAC-Signing.
 */

// ─── Types (1:1 spiegel der Edge-Function-Validation) ────────────────────────

export type AiEventType =
  | 'prompt_sent'
  | 'response_received'
  | 'agent_action'
  | 'file_upload'
  | 'tool_call'
  | 'session_start'
  | 'session_end';

export type AiPromptCategory =
  | 'code_generation'
  | 'content_generation'
  | 'classification'
  | 'summarization'
  | 'translation'
  | 'extraction'
  | 'agent_action'
  | 'analysis'
  | 'qa'
  | 'unknown';

export type AiDataClass =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'personal_data'
  | 'special_category'
  | 'unknown';

export type AiRiskLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type AiPolicyStatus =
  | 'allowed'
  | 'warned'
  | 'blocked'
  | 'requires_approval'
  | 'logged';

export interface AiTelemetryEvent {
  event_type: AiEventType;
  ai_system_id?: string;
  vendor?: string;
  model?: string;
  user_id?: string;
  team?: string;
  prompt_category?: AiPromptCategory;
  data_class?: AiDataClass;
  risk_level?: AiRiskLevel;
  policy_status?: AiPolicyStatus;
  policy_id?: string;
  prompt_tokens?: number;
  response_tokens?: number;
  latency_ms?: number;
  metadata?: Record<string, unknown>;
  /** ISO-8601. Default: now beim Server. */
  occurred_at?: string;
}

export interface TelemetryClientOptions {
  /** Vollstaendige URL der Edge-Function. */
  endpoint: string;
  /** Tenant-API-Key (Pflicht). In dieser PR: tenant uuid. */
  tenantKey: string;
  /** Custom fetch (z.B. fuer Node 18-, Service-Worker). Default: globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** Optional: Lebenszeit eines Requests vor Abort. Default: 5000ms. */
  timeoutMs?: number;
}

export interface TelemetryResult {
  ok: boolean;
  /** Server-seitige Event-ID bei Erfolg. */
  eventId?: string;
  /** Bei Fehlschlag: HTTP-Status + Code + Message. */
  error?: { status?: number; code?: string; message: string };
}

// ─── Client ──────────────────────────────────────────────────────────────────

export interface TelemetryClient {
  trackAiEvent(event: AiTelemetryEvent): Promise<TelemetryResult>;
}

export function createTelemetryClient(opts: TelemetryClientOptions): TelemetryClient {
  if (!opts.endpoint) throw new Error('createTelemetryClient: endpoint required');
  if (!opts.tenantKey) throw new Error('createTelemetryClient: tenantKey required');

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? 5_000;

  return {
    async trackAiEvent(event) {
      if (!event.event_type) {
        return { ok: false, error: { message: 'event_type required' } };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const resp = await fetchImpl(opts.endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-rsd-tenant-key': opts.tenantKey,
          },
          body: JSON.stringify(event),
          signal: controller.signal,
        });

        const text = await resp.text();
        let body: { ok?: boolean; event_id?: string; error?: { code?: string; message?: string } } = {};
        try {
          body = text ? JSON.parse(text) : {};
        } catch {
          // body bleibt leer; wir liefern den Status zurueck
        }

        if (!resp.ok || body.ok === false) {
          return {
            ok: false,
            error: {
              status: resp.status,
              code: body.error?.code,
              message: body.error?.message ?? `HTTP ${resp.status}`,
            },
          };
        }

        return { ok: true, eventId: body.event_id };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, error: { message } };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// ─── Convenience: Default-Singleton (optional, fuer einfache Use-Cases) ──────

let defaultClient: TelemetryClient | null = null;

/**
 * Initialisiert einen Default-Client. Danach kann man ohne expliziten
 * Client-Parameter via trackAiEvent() telemetrieren.
 */
export function configureDefaultTelemetryClient(opts: TelemetryClientOptions): void {
  defaultClient = createTelemetryClient(opts);
}

/**
 * Sendet ein Event ueber den Default-Client. Wirft falls noch nicht
 * configureDefaultTelemetryClient() aufgerufen wurde.
 */
export async function trackAiEvent(event: AiTelemetryEvent): Promise<TelemetryResult> {
  if (!defaultClient) {
    throw new Error(
      'trackAiEvent: call configureDefaultTelemetryClient() first or use createTelemetryClient().',
    );
  }
  return defaultClient.trackAiEvent(event);
}
