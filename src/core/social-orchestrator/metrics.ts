/**
 * Observability metrics for the social orchestrator.
 *
 * Tracks:
 *   - Queue operations (enqueue, approve, reject, publish)
 *   - Publisher performance per channel (success/failure, latency)
 *   - Retry and DLQ statistics
 *   - Volume metrics (throughput, queue depth)
 *
 * Can be sent to Sentry, DataDog, CloudWatch, or similar.
 * Call recordMetric() at key points in the orchestrator flow.
 */

import type { SocialChannel, QueueStatus } from './types';

// ── Metric types ───────────────────────────────────────────────────

export interface PublishMetric {
  channel: SocialChannel;
  status: 'success' | 'failure' | 'retry' | 'dlq';
  latencyMs: number;
  tenantId?: string;
  errorCode?: string;
  errorMessage?: string;
  externalId?: string;
  timestamp: string;
}

export interface QueueMetric {
  operation: 'enqueue' | 'approve' | 'reject' | 'publish';
  channel?: SocialChannel;
  status?: QueueStatus;
  tenantId?: string;
  queueDepth?: number;
  latencyMs?: number;
  timestamp: string;
}

export interface VolumeMetric {
  metric: 'queue_size' | 'published_count' | 'failed_count' | 'dlq_size' | 'throughput';
  value: number;
  tenantId?: string;
  channel?: SocialChannel;
  period: 'minute' | 'hour' | 'day';
  timestamp: string;
}

export interface AggregatedMetrics {
  period: string;
  startTime: string;
  endTime: string;
  channels: ChannelMetrics[];
  overall: OverallMetrics;
}

export interface ChannelMetrics {
  channel: SocialChannel;
  published: number;
  failed: number;
  retried: number;
  dlq: number;
  avgLatencyMs: number;
  successRate: number;
  pendingCount: number;
}

export interface OverallMetrics {
  totalPublished: number;
  totalFailed: number;
  totalRetried: number;
  totalDLQ: number;
  avgLatencyMs: number;
  successRate: number;
  totalQueued: number;
  totalProcessing: number;
}

// ── In-memory metrics buffer ───────────────────────────────────────

interface MetricsBuffer {
  publishMetrics: PublishMetric[];
  queueMetrics: QueueMetric[];
  volumeMetrics: VolumeMetric[];
  maxSize: number;
}

let metricsBuffer: MetricsBuffer = {
  publishMetrics: [],
  queueMetrics: [],
  volumeMetrics: [],
  maxSize: 1000,
};

// ── Reporters (extensible) ────────────────────────────────────────

type MetricsReporter = (metric: PublishMetric | QueueMetric | VolumeMetric) => void;

const reporters: MetricsReporter[] = [
  // Default console reporter (development)
  (metric) => {
    if (Deno?.env?.get?.('DEBUG_METRICS') === 'true') {
      console.log('[metrics]', JSON.stringify(metric));
    }
  },
];

/**
 * Add a custom metrics reporter (e.g., for Sentry, DataDog, CloudWatch).
 */
export function addMetricsReporter(reporter: MetricsReporter): void {
  reporters.push(reporter);
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Record a publish attempt (success, failure, retry, or DLQ).
 */
export function recordPublishMetric(metric: PublishMetric): void {
  // Add to buffer
  metricsBuffer.publishMetrics.push(metric);
  if (metricsBuffer.publishMetrics.length > metricsBuffer.maxSize) {
    metricsBuffer.publishMetrics.shift();
  }

  // Report to all reporters
  reporters.forEach(r => {
    try {
      r(metric);
    } catch (err) {
      console.error('[metrics] Reporter failed:', err);
    }
  });
}

/**
 * Record a queue operation (enqueue, approve, reject, publish).
 */
export function recordQueueMetric(metric: QueueMetric): void {
  metricsBuffer.queueMetrics.push(metric);
  if (metricsBuffer.queueMetrics.length > metricsBuffer.maxSize) {
    metricsBuffer.queueMetrics.shift();
  }

  reporters.forEach(r => {
    try {
      r(metric);
    } catch (err) {
      console.error('[metrics] Reporter failed:', err);
    }
  });
}

/**
 * Record volume metrics (queue size, counts, throughput).
 */
export function recordVolumeMetric(metric: VolumeMetric): void {
  metricsBuffer.volumeMetrics.push(metric);
  if (metricsBuffer.volumeMetrics.length > metricsBuffer.maxSize) {
    metricsBuffer.volumeMetrics.shift();
  }

  reporters.forEach(r => {
    try {
      r(metric);
    } catch (err) {
      console.error('[metrics] Reporter failed:', err);
    }
  });
}

// ── Aggregation for dashboards ────────────────────────────────────

/**
 * Get aggregated metrics for all channels over the last N minutes.
 */
export function getAggregatedMetrics(minutesBack: number = 60): AggregatedMetrics {
  const now = new Date();
  const cutoff = new Date(now.getTime() - minutesBack * 60 * 1000);

  const recentPublish = metricsBuffer.publishMetrics.filter(m => new Date(m.timestamp) >= cutoff);

  const channels = new Map<SocialChannel, ChannelMetrics>();

  // Initialize all channels
  const allChannels: SocialChannel[] = [
    'linkedin.enterprise',
    'linkedin.legal',
    'instagram.reel',
    'tiktok.fast',
    'x.alert',
    'wordpress.blog',
    'ghost.blog',
    'webhook.custom',
    'email.newsletter',
  ];

  for (const ch of allChannels) {
    channels.set(ch, {
      channel: ch,
      published: 0,
      failed: 0,
      retried: 0,
      dlq: 0,
      avgLatencyMs: 0,
      successRate: 0,
      pendingCount: 0,
    });
  }

  // Aggregate per channel
  let totalLatency = 0;
  let totalLatencyCount = 0;

  for (const metric of recentPublish) {
    const ch = channels.get(metric.channel)!;

    switch (metric.status) {
      case 'success':
        ch.published += 1;
        totalLatency += metric.latencyMs;
        totalLatencyCount += 1;
        break;
      case 'failure':
        ch.failed += 1;
        totalLatency += metric.latencyMs;
        totalLatencyCount += 1;
        break;
      case 'retry':
        ch.retried += 1;
        break;
      case 'dlq':
        ch.dlq += 1;
        break;
    }
  }

  // Calculate success rates and avg latency per channel
  const channelMetrics: ChannelMetrics[] = [];

  for (const ch of channels.values()) {
    const total = ch.published + ch.failed;
    ch.successRate = total > 0 ? (ch.published / total) * 100 : 0;
    channelMetrics.push(ch);
  }

  // Overall metrics
  const overall: OverallMetrics = {
    totalPublished: channelMetrics.reduce((sum, ch) => sum + ch.published, 0),
    totalFailed: channelMetrics.reduce((sum, ch) => sum + ch.failed, 0),
    totalRetried: channelMetrics.reduce((sum, ch) => sum + ch.retried, 0),
    totalDLQ: channelMetrics.reduce((sum, ch) => sum + ch.dlq, 0),
    avgLatencyMs: totalLatencyCount > 0 ? Math.round(totalLatency / totalLatencyCount) : 0,
    successRate: 0,
    totalQueued: 0,
    totalProcessing: 0,
  };

  const overallTotal = overall.totalPublished + overall.totalFailed;
  overall.successRate = overallTotal > 0 ? (overall.totalPublished / overallTotal) * 100 : 0;

  return {
    period: `${minutesBack}m`,
    startTime: cutoff.toISOString(),
    endTime: now.toISOString(),
    channels: channelMetrics,
    overall,
  };
}

/**
 * Get channel-specific metrics.
 */
export function getChannelMetrics(channel: SocialChannel, minutesBack: number = 60): ChannelMetrics | null {
  const agg = getAggregatedMetrics(minutesBack);
  return agg.channels.find(ch => ch.channel === channel) ?? null;
}

/**
 * Clear the in-memory buffer (useful for testing).
 */
export function clearMetricsBuffer(): void {
  metricsBuffer = {
    publishMetrics: [],
    queueMetrics: [],
    volumeMetrics: [],
    maxSize: 1000,
  };
}

/**
 * Get raw buffer for debugging.
 */
export function getMetricsBuffer(): MetricsBuffer {
  return {
    ...metricsBuffer,
    publishMetrics: [...metricsBuffer.publishMetrics],
    queueMetrics: [...metricsBuffer.queueMetrics],
    volumeMetrics: [...metricsBuffer.volumeMetrics],
  };
}

// ── Sentry integration (optional) ────────────────────────────────

/**
 * Send metrics to Sentry as breadcrumbs + tags.
 * Enable with: addMetricsReporter(createSentryReporter())
 */
export function createSentryReporter(): MetricsReporter {
  return (metric) => {
    try {
      const Sentry = (globalThis as any).Sentry;
      if (!Sentry) return;

      if ('channel' in metric && 'status' in metric) {
        // PublishMetric
        const pubMetric = metric as PublishMetric;
        Sentry.captureMessage('Social publish', {
          level: pubMetric.status === 'success' ? 'info' : 'warning',
          contexts: {
            publish: {
              channel: pubMetric.channel,
              status: pubMetric.status,
              latencyMs: pubMetric.latencyMs,
              errorCode: pubMetric.errorCode,
            },
          },
          tags: {
            'social.channel': pubMetric.channel,
            'social.status': pubMetric.status,
          },
        });
      }
    } catch (err) {
      console.error('[metrics:sentry] Failed to send to Sentry:', err);
    }
  };
}

// ── CloudWatch integration (optional) ────────────────────────────

/**
 * Send metrics to AWS CloudWatch.
 * Enable with: addMetricsReporter(createCloudWatchReporter())
 */
export function createCloudWatchReporter(
  namespace: string = 'RealSync/SocialOrchestrator'
): MetricsReporter {
  return (metric) => {
    try {
      // AWS CloudWatch would be called here
      // This is a placeholder for demonstration
      if ('channel' in metric && 'status' in metric) {
        const pubMetric = metric as PublishMetric;
        console.log(
          `[cloudwatch] PutMetricData: ${namespace} - ${pubMetric.channel}:${pubMetric.status} = ${pubMetric.latencyMs}ms`
        );
      }
    } catch (err) {
      console.error('[metrics:cloudwatch] Failed to send metric:', err);
    }
  };
}

// ── DataDog integration (optional) ────────────────────────────────

/**
 * Send metrics to DataDog.
 * Enable with: addMetricsReporter(createDataDogReporter())
 */
export function createDataDogReporter(
  apiKey: string = Deno?.env?.get?.('DATADOG_API_KEY') || ''
): MetricsReporter {
  return (metric) => {
    try {
      if ('channel' in metric && 'status' in metric) {
        const pubMetric = metric as PublishMetric;
        // DataDog API call would go here
        console.log(
          `[datadog] Metric: social.publish.${pubMetric.status} = 1 @${pubMetric.timestamp} #channel:${pubMetric.channel}`
        );
      }
    } catch (err) {
      console.error('[metrics:datadog] Failed to send metric:', err);
    }
  };
}
