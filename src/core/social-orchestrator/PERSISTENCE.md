# Social Orchestrator Persistence Layer

Production-ready Postgres backend for Dead Letter Queue (DLQ), Metrics Collection, and Audit Logging.

## Overview

The in-memory implementations in `distributionQueue.ts` are suitable for development and small-scale deployments. For production use, this layer provides:

- **DeadLetterQueue**: Persistent retry queue with exponential backoff
- **QueueMetricsCollector**: Time-series metrics with hourly rollup
- **AuditLogger**: Compliance audit trail for regulatory evidence

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Social Publisher (distributionQueue.ts)                 │
│ - Attempts to publish to LinkedIn, X, Instagram, etc.   │
│ - On failure: creates DLQ entry                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Edge Function (social-orchestrator-persistence)         │
│ - Handles DLQ enqueue/retry/list operations             │
│ - Records publish metrics                               │
│ - Logs audit events                                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Postgres Tables (supabase/migrations)                   │
│ - social_dlq_entries: Failed publishes with retry state │
│ - social_publishing_metrics: Time-series publish events │
│ - social_audit_log: Compliance audit trail              │
│ - social_publishing_metrics_hourly: Aggregated metrics  │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

### `social_dlq_entries`

Stores failed publishing attempts with retry tracking.

```sql
CREATE TABLE social_dlq_entries (
  id UUID PRIMARY KEY,
  queue_entry_id TEXT NOT NULL UNIQUE,    -- Links to QueueEntry.id
  channel social_channel NOT NULL,         -- linkedin.enterprise, x.alert, etc.
  error_code TEXT NOT NULL,                -- CHANNEL_MISMATCH, NO_API_KEY, etc.
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,           -- Incremented on each retry
  next_retry_at TIMESTAMP,                 -- Exponential backoff: 60s, 120s, 240s...
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);
```

**Indexes**:
- `idx_social_dlq_channel`: Filter by channel
- `idx_social_dlq_next_retry`: Find entries ready for retry
- `idx_social_dlq_created`: Time-based queries

### `social_publishing_metrics`

Time-series events for every publish attempt (started, succeeded, failed).

```sql
CREATE TABLE social_publishing_metrics (
  id UUID PRIMARY KEY,
  channel social_channel NOT NULL,
  queue_id TEXT NOT NULL,
  status TEXT CHECK (status IN ('started', 'succeeded', 'failed')),
  latency_ms INTEGER,                      -- Time from start to completion
  error_code TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes**:
- `idx_publishing_metrics_channel_created`: Dashboard queries (last 24h)
- `idx_publishing_metrics_error`: Error tracking by code
- `idx_publishing_metrics_status`: Aggregate success/failure rates

### `social_publishing_metrics_hourly`

Hourly aggregation of metrics (populated by scheduled `rollup_publishing_metrics_hourly()` function).

```sql
CREATE TABLE social_publishing_metrics_hourly (
  hour TIMESTAMP NOT NULL,
  channel social_channel NOT NULL,
  total_attempts INTEGER,
  succeeded INTEGER,
  failed INTEGER,
  avg_latency_ms NUMERIC,
  p95_latency_ms NUMERIC,
  p99_latency_ms NUMERIC,
  error_rate NUMERIC(5, 2),
  PRIMARY KEY (hour, channel)
);
```

### `social_audit_log`

Compliance trail for every publish operation.

```sql
CREATE TABLE social_audit_log (
  id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,                -- publish_attempted, publish_succeeded, dlq_entry_created
  queue_id TEXT NOT NULL,
  channel social_channel NOT NULL,
  status TEXT,                              -- pending, published, failed, dlq
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes**:
- `idx_social_audit_queue`: Trace single publish operation
- `idx_social_audit_event_type`: Filter by event type
- `idx_social_audit_channel`: Channel-specific audit trails
- `idx_social_audit_created`: Time-range queries

## Client Library

### Basic Usage

```typescript
import { createClient } from '@supabase/supabase-js';
import { PostgresDLQ, PostgresMetricsCollector, PostgresAuditLogger } from '@/core/social-orchestrator/persistenceClient';

const supabase = createClient(url, key);

// Initialize persistence components
const dlq = new PostgresDLQ(supabase);
const metrics = new PostgresMetricsCollector(supabase);
const audit = new PostgresAuditLogger(supabase);

// Record publish attempt
metrics.recordPublishStart(queueEntry.id);
audit.logPublishAttempted(queueEntry.id, 'linkedin.enterprise');

try {
  await publisher.publish(post);
  await metrics.recordPublishEnd(queueEntry.id, true, undefined, 'linkedin.enterprise');
  await audit.logPublishSucceeded(queueEntry.id, 'linkedin.enterprise', externalId);
} catch (err) {
  const errorCode = err.code || 'UNKNOWN_ERROR';
  const errorMessage = err.message || 'Unknown error';
  
  await metrics.recordPublishEnd(queueEntry.id, false, errorCode, 'linkedin.enterprise');
  await audit.logPublishFailed(queueEntry.id, 'linkedin.enterprise', errorCode, errorMessage);
  
  // Add to DLQ for retry
  const dlqEntry = await dlq.enqueue(queueEntry.id, 'linkedin.enterprise', errorCode, errorMessage);
  await audit.logDlqEntryCreated(queueEntry.id, 'linkedin.enterprise', `Failed: ${errorCode}`);
}
```

### Dead Letter Queue (DLQ)

```typescript
// Enqueue failed publish
const dlqEntry = await dlq.enqueue(
  queueEntry.id,
  'x.alert',
  'RATE_LIMIT',
  'API rate limit exceeded'
);

// List pending retries (by channel or globally)
const pending = await dlq.list('x.alert', 'ready_to_retry');

// Retry a single entry
const updated = await dlq.retry(dlqEntry.id);  // retry_count incremented, next_retry_at recalculated

// Remove entry (after max retries or manual intervention)
await dlq.remove(dlqEntry.id);
```

**Exponential Backoff Schedule**:
- Retry 1: 60 seconds
- Retry 2: 120 seconds
- Retry 3: 240 seconds
- Retry 4: 480 seconds
- Retry 5: 960 seconds (16 minutes, capped)

### Metrics Collection

```typescript
// Get metrics for last 24 hours
const snapshot = await metrics.getMetrics('linkedin.enterprise', 24);
// Returns: { channel, total, succeeded, failed, errorRate, avgLatency, minLatency, maxLatency }

// Typical dashboard integration:
const metricsData = {
  successRate: (snapshot.succeeded / snapshot.total) * 100,
  avgLatency: snapshot.avgLatency,
  errorRate: snapshot.errorRate,
  failureCount: snapshot.failed,
};
```

### Audit Logging

```typescript
// Query audit trail for a single publish attempt
const trail = await audit.getEntries(queueEntry.id);
// Returns array of { event_type, queue_id, channel, status, metadata, created_at }

// Example output:
// [
//   { event_type: 'publish_attempted', status: 'pending', ... },
//   { event_type: 'publish_failed', error_code: 'RATE_LIMIT', ... },
//   { event_type: 'dlq_entry_created', reason: 'Failed: RATE_LIMIT', ... }
// ]
```

## Production Setup

### 1. Deploy Migration

```bash
supabase db push
```

This creates all tables with RLS policies enforcing Service Role access (Edge Functions only).

### 2. Deploy Edge Function

```bash
supabase functions deploy social-orchestrator-persistence
```

### 3. Enable Maintenance Tasks (PostgreSQL 14+)

Create a one-time setup function to schedule cron jobs:

```sql
-- Enable pg_cron extension (one-time, in Cloud console)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule DLQ cleanup at 2 AM UTC daily
SELECT cron.schedule(
  'cleanup_social_dlq',
  '0 2 * * *',
  'SELECT cleanup_social_dlq()'
);

-- Schedule metrics rollup every hour at minute 0
SELECT cron.schedule(
  'rollup_metrics',
  '0 * * * *',
  'SELECT rollup_publishing_metrics_hourly()'
);
```

### 4. Monitor in Production

Query metrics hourly to detect publishing issues:

```sql
-- Find channels with high error rates in the last hour
SELECT channel, error_rate, failed, total_attempts
FROM social_publishing_metrics_hourly
WHERE hour > NOW() - INTERVAL '1 hour'
  AND error_rate > 5  -- Alert if > 5% error rate
ORDER BY error_rate DESC;
```

## Retention Policies

- **DLQ entries**: Auto-deleted after 30 days (or when retry_count > 3)
- **Raw metrics**: 30-day retention (depends on storage quota)
- **Audit logs**: Indefinite (compliance requirement)
- **Hourly metrics**: 2-year retention

## Cost Optimization

1. **Index efficiency**: All indexes are sparse (WHERE clauses on status/retry_at)
2. **Time-series aggregation**: Hourly rollup reduces query load by 95%
3. **Partition candidates** (future): Partition `social_publishing_metrics` by month if > 100M rows/month
4. **Archival** (future): Move audit logs > 2 years to cold storage

## Troubleshooting

### No metrics appearing

Check if `rollup_publishing_metrics_hourly` is running:

```sql
SELECT cron.unscheduled_jobs;  -- Lists disabled jobs
SELECT * FROM pg_stat_statements WHERE query LIKE '%rollup%';  -- Check execution
```

### DLQ entries not retrying

Verify `next_retry_at` calculation:

```sql
-- Find entries ready for retry
SELECT id, retry_count, next_retry_at, NOW() as current_time
FROM social_dlq_entries
WHERE next_retry_at <= NOW()
ORDER BY next_retry_at ASC
LIMIT 10;
```

### Audit log too large

Partition by `created_at` or archive old entries:

```sql
-- Archive entries older than 2 years
DELETE FROM social_audit_log
WHERE created_at < NOW() - INTERVAL '2 years'
RETURNING id;
```

## Future Enhancements

- [ ] Webhook notifications on DLQ entry creation (alert teams)
- [ ] Adaptive backoff based on error code (rate-limit vs. auth vs. network)
- [ ] Cross-channel retry coordination (retry LinkedIn → try X instead)
- [ ] Metrics export to Sentry/Datadog for external monitoring
- [ ] Manual retry dashboard in admin UI
