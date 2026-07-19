/**
 * Social Orchestrator Persistence Client
 *
 * Production-ready Postgres-backed implementations of in-memory infrastructure classes.
 * Consumes social-orchestrator-persistence Edge Function.
 *
 * Usage:
 *   const dlq = new PostgresDLQ(supabaseClient);
 *   const entry = await dlq.enqueue(queueId, channel, errorCode, message);
 *   const metrics = new PostgresMetricsCollector(supabaseClient);
 *   await metrics.recordPublishEnd(queueId, true, 'success');
 *   const audit = new PostgresAuditLogger(supabaseClient);
 *   await audit.logPublishSucceeded(queueId, channel, externalId);
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SocialChannel } from './types';

interface DLQEntry {
  id: string;
  queue_entry_id: string;
  channel: SocialChannel;
  error_code: string;
  error_message?: string;
  retry_count: number;
  next_retry_at?: string;
  created_at: string;
}

interface MetricsSnapshot {
  channel: SocialChannel;
  total: number;
  succeeded: number;
  failed: number;
  errorRate: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
}

// ── Postgres-backed Dead Letter Queue ────────────────────────────────────────

export class PostgresDLQ {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async enqueue(
    queueEntryId: string,
    channel: SocialChannel,
    errorCode: string,
    errorMessage: string,
    retryCount: number = 0
  ): Promise<DLQEntry> {
    const response = await this.supabase.functions.invoke(
      'social-orchestrator-persistence',
      {
        body: {
          action: 'dlq:enqueue',
          payload: {
            queueEntryId,
            channel,
            errorCode,
            errorMessage,
            retryCount,
          },
        },
      }
    );

    if (response.error) throw response.error;
    return response.data.result as DLQEntry;
  }

  async list(channel?: SocialChannel, statusFilter?: 'pending' | 'ready_to_retry'): Promise<DLQEntry[]> {
    const response = await this.supabase.functions.invoke(
      'social-orchestrator-persistence',
      {
        body: {
          action: 'dlq:list',
          payload: { channel, statusFilter },
        },
      }
    );

    if (response.error) throw response.error;
    return response.data.result as DLQEntry[];
  }

  async retry(dlqId: string): Promise<DLQEntry> {
    const response = await this.supabase.functions.invoke(
      'social-orchestrator-persistence',
      {
        body: {
          action: 'dlq:retry',
          payload: { dlqId },
        },
      }
    );

    if (response.error) throw response.error;
    return response.data.result as DLQEntry;
  }

  async remove(dlqId: string): Promise<boolean> {
    const response = await this.supabase.functions.invoke(
      'social-orchestrator-persistence',
      {
        body: {
          action: 'dlq:remove',
          payload: { dlqId },
        },
      }
    );

    if (response.error) throw response.error;
    return response.data.result as boolean;
  }
}

// ── Postgres-backed Metrics Collector ────────────────────────────────────────

export class PostgresMetricsCollector {
  private supabase: SupabaseClient;
  private publishStartTimes: Map<string, number> = new Map();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  recordPublishStart(queueId: string): void {
    this.publishStartTimes.set(queueId, Date.now());
  }

  async recordPublishEnd(
    queueId: string,
    success: boolean,
    errorCode?: string,
    channel?: SocialChannel
  ): Promise<void> {
    const startTime = this.publishStartTimes.get(queueId);
    const latencyMs = startTime ? Date.now() - startTime : undefined;

    await this.supabase.functions.invoke('social-orchestrator-persistence', {
      body: {
        action: 'metrics:record',
        payload: {
          channel: channel || 'x.alert',
          queueId,
          status: success ? 'succeeded' : 'failed',
          latencyMs,
          errorCode,
        },
      },
    });

    this.publishStartTimes.delete(queueId);
  }

  async getMetrics(channel: SocialChannel, hoursBack: number = 24): Promise<MetricsSnapshot> {
    const response = await this.supabase.functions.invoke(
      'social-orchestrator-persistence',
      {
        body: {
          action: 'metrics:get',
          payload: { channel, hoursBack },
        },
      }
    );

    if (response.error) throw response.error;
    return response.data.result as MetricsSnapshot;
  }
}

// ── Postgres-backed Audit Logger ─────────────────────────────────────────────

export class PostgresAuditLogger {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async logPublishAttempted(queueId: string, channel: SocialChannel): Promise<void> {
    await this.supabase.functions.invoke('social-orchestrator-persistence', {
      body: {
        action: 'audit:log',
        payload: {
          event_type: 'publish_attempted',
          queue_id: queueId,
          channel,
          status: 'pending',
          metadata: { action: 'publish_attempt' },
        },
      },
    });
  }

  async logPublishSucceeded(queueId: string, channel: SocialChannel, externalId: string): Promise<void> {
    await this.supabase.functions.invoke('social-orchestrator-persistence', {
      body: {
        action: 'audit:log',
        payload: {
          event_type: 'publish_succeeded',
          queue_id: queueId,
          channel,
          status: 'published',
          metadata: { externalId },
        },
      },
    });
  }

  async logPublishFailed(
    queueId: string,
    channel: SocialChannel,
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    await this.supabase.functions.invoke('social-orchestrator-persistence', {
      body: {
        action: 'audit:log',
        payload: {
          event_type: 'publish_failed',
          queue_id: queueId,
          channel,
          status: 'failed',
          metadata: { errorCode, errorMessage },
        },
      },
    });
  }

  async logDlqEntryCreated(queueId: string, channel: SocialChannel, reason: string): Promise<void> {
    await this.supabase.functions.invoke('social-orchestrator-persistence', {
      body: {
        action: 'audit:log',
        payload: {
          event_type: 'dlq_entry_created',
          queue_id: queueId,
          channel,
          status: 'dlq',
          metadata: { reason },
        },
      },
    });
  }

  async getEntries(queueId: string): Promise<unknown[]> {
    const response = await this.supabase.functions.invoke(
      'social-orchestrator-persistence',
      {
        body: {
          action: 'audit:get',
          payload: { queueId },
        },
      }
    );

    if (response.error) throw response.error;
    return response.data.result as unknown[];
  }
}
