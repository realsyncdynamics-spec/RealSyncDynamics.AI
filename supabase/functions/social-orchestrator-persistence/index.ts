/**
 * Social Orchestrator Persistence Layer
 *
 * Supabase Edge Function providing Postgres-backed implementations of:
 * - DeadLetterQueue (DLQ)
 * - QueueMetricsCollector
 * - AuditLogger
 *
 * Coordinates with distributionQueue.ts in-memory implementations.
 * For production: call these endpoints from Edge Functions that handle publishing.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface DLQEntry {
  id: string;
  queue_entry_id: string;
  channel: string;
  error_code: string;
  error_message?: string;
  retry_count: number;
  next_retry_at?: string;
}

interface PublishingMetric {
  channel: string;
  queue_id: string;
  status: "started" | "succeeded" | "failed";
  latency_ms?: number;
  error_code?: string;
}

interface AuditLogEntry {
  event_type: string;
  queue_id: string;
  channel: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

// ── DLQ Operations ──────────────────────────────────────────────────────────

async function enqueueDLQEntry(
  queueEntryId: string,
  channel: string,
  errorCode: string,
  errorMessage: string,
  retryCount: number = 0
): Promise<DLQEntry> {
  const nextRetryAt = calculateNextRetryTime(retryCount);

  const { data, error } = await supabase
    .from("social_dlq_entries")
    .insert({
      queue_entry_id: queueEntryId,
      channel,
      error_code: errorCode,
      error_message: errorMessage,
      retry_count: retryCount,
      next_retry_at: nextRetryAt,
    })
    .select()
    .single();

  if (error) throw new Error(`DLQ enqueue failed: ${error.message}`);
  return data as DLQEntry;
}

async function listDLQEntries(
  channel?: string,
  statusFilter?: "pending" | "ready_to_retry"
): Promise<DLQEntry[]> {
  let query = supabase.from("social_dlq_entries").select("*");

  if (channel) {
    query = query.eq("channel", channel);
  }

  if (statusFilter === "ready_to_retry") {
    query = query.lte("next_retry_at", new Date().toISOString());
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw new Error(`DLQ list failed: ${error.message}`);
  return (data || []) as DLQEntry[];
}

async function retryDLQEntry(dlqId: string): Promise<DLQEntry> {
  const { data: entry, error: fetchError } = await supabase
    .from("social_dlq_entries")
    .select("*")
    .eq("id", dlqId)
    .single();

  if (fetchError) throw new Error(`Failed to fetch DLQ entry: ${fetchError.message}`);

  const newRetryCount = (entry.retry_count || 0) + 1;
  const nextRetryAt = calculateNextRetryTime(newRetryCount);

  const { data, error } = await supabase
    .from("social_dlq_entries")
    .update({
      retry_count: newRetryCount,
      next_retry_at: nextRetryAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dlqId)
    .select()
    .single();

  if (error) throw new Error(`DLQ retry update failed: ${error.message}`);
  return data as DLQEntry;
}

async function removeDLQEntry(dlqId: string): Promise<boolean> {
  const { error } = await supabase
    .from("social_dlq_entries")
    .delete()
    .eq("id", dlqId);

  if (error) throw new Error(`DLQ remove failed: ${error.message}`);
  return true;
}

// ── Metrics Collection ──────────────────────────────────────────────────────

async function recordPublishingMetric(
  channel: string,
  queueId: string,
  status: "started" | "succeeded" | "failed",
  latencyMs?: number,
  errorCode?: string
): Promise<void> {
  const { error } = await supabase.from("social_publishing_metrics").insert({
    channel,
    queue_id: queueId,
    status,
    latency_ms: latencyMs,
    error_code: errorCode,
  });

  if (error) throw new Error(`Metrics recording failed: ${error.message}`);
}

async function getPublishingMetrics(channel: string, hoursBack: number = 24) {
  const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("social_publishing_metrics")
    .select("*")
    .eq("channel", channel)
    .gte("created_at", cutoffTime.toISOString())
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Metrics fetch failed: ${error.message}`);

  const metrics = data || [];
  const succeeded = metrics.filter((m) => m.status === "succeeded").length;
  const failed = metrics.filter((m) => m.status === "failed").length;
  const latencies = metrics
    .filter((m) => m.latency_ms !== null)
    .map((m) => m.latency_ms);

  return {
    channel,
    total: metrics.length,
    succeeded,
    failed,
    errorRate: metrics.length > 0 ? (failed / metrics.length) * 100 : 0,
    avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b) / latencies.length : 0,
    minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
    maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
  };
}

// ── Audit Logging ───────────────────────────────────────────────────────────

async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  const { error } = await supabase.from("social_audit_log").insert({
    event_type: entry.event_type,
    queue_id: entry.queue_id,
    channel: entry.channel,
    status: entry.status,
    metadata: entry.metadata || {},
  });

  if (error) throw new Error(`Audit logging failed: ${error.message}`);
}

async function getAuditLog(queueId: string) {
  const { data, error } = await supabase
    .from("social_audit_log")
    .select("*")
    .eq("queue_id", queueId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Audit log fetch failed: ${error.message}`);
  return data || [];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function calculateNextRetryTime(retryCount: number): string {
  // Exponential backoff: 60s, 120s, 240s, 480s, 960s (max 16min)
  const baseDelay = 60 * 1000; // 60 seconds
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), 960 * 1000);
  return new Date(Date.now() + delay).toISOString();
}

// ── HTTP Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    const { action, payload } = await req.json();

    let result;

    switch (action) {
      case "dlq:enqueue":
        result = await enqueueDLQEntry(
          payload.queueEntryId,
          payload.channel,
          payload.errorCode,
          payload.errorMessage,
          payload.retryCount
        );
        break;

      case "dlq:list":
        result = await listDLQEntries(payload.channel, payload.statusFilter);
        break;

      case "dlq:retry":
        result = await retryDLQEntry(payload.dlqId);
        break;

      case "dlq:remove":
        result = await removeDLQEntry(payload.dlqId);
        break;

      case "metrics:record":
        await recordPublishingMetric(
          payload.channel,
          payload.queueId,
          payload.status,
          payload.latencyMs,
          payload.errorCode
        );
        result = { ok: true };
        break;

      case "metrics:get":
        result = await getPublishingMetrics(payload.channel, payload.hoursBack);
        break;

      case "audit:log":
        await logAuditEvent(payload);
        result = { ok: true };
        break;

      case "audit:get":
        result = await getAuditLog(payload.queueId);
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
