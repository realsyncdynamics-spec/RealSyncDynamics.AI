# Distribution Architecture — Social Orchestrator Publishing

## Overview

Production-ready Publisher architecture for the Social Orchestrator with:

- **Retry logic**: Exponential backoff for transient failures
- **Audit logging**: Each publish attempt logged for compliance
- **Dead Letter Queue**: Failed entries captured for manual review
- **Multi-channel support**: LinkedIn, WordPress, Ghost, Webhook, Email (and more)
- **Error handling**: Channel-specific error codes for analytics
- **Extensibility**: Base class for custom publishers

## Architecture

```
SocialOrchestrator
├── generate(event)
│   └── SocialPost[]
├── queue.enqueue(posts[])
│   └── QueueEntry[] (status: auto|pending)
├── queue.approve(queueId) [human review]
│   └── QueueEntry (status: approved)
├── queue.publish(queueId)
│   └── Publisher.publish(post)
│       ├── BasePublisher (retry logic, audit)
│       ├── LinkedInPublisher
│       ├── WebhookPublisher
│       ├── EmailPublisher
│       └── ...
└── PublishResult
    ├── ok: true
    │   ├── externalId (for analytics correlation)
    │   └── postedAt
    └── ok: false
        └── error { code, message }
```

## Publisher Implementations

### LinkedInPublisher

**Channels**: `linkedin.enterprise`, `linkedin.legal`

```typescript
const publisher = new LinkedInPublisher();
publisher.publish(post); // OAuth 2.0 via LinkedIn API v2
```

**Configuration**:
- Access token in Supabase Vault: `linkedin_access_token`
- Person URN for author profile (parameterizable per tenant)
- Character limit: ~1500 (excluding hashtag block)

**API**: `POST https://api.linkedin.com/v2/ugcPosts`

**Error codes**:
- `LINKEDIN_401_UNAUTHORIZED`: Token invalid/expired
- `LINKEDIN_429_RATE_LIMIT`: Rate limit hit
- `LINKEDIN_403_FORBIDDEN`: Account not authorized
- `NO_TOKEN`: Token not configured

### WordPressPublisher

**Channel**: `wordpress.blog` (TODO)

**Status**: Placeholder implementation pending follow-up PR.

**Configuration**:
- Site URL: `https://example.com`
- REST API token in Vault: `wordpress_api_token`

**API**: `POST https://example.com/wp-json/wp/v2/posts`

### GhostPublisher

**Channel**: `ghost.blog` (TODO)

**Status**: Placeholder implementation pending follow-up PR.

**Configuration**:
- Admin URL: `https://ghost.example.com`
- Admin API key in Vault: `ghost_admin_api_key`

**API**: `POST https://ghost.example.com/ghost/api/v3/admin/posts/`

### WebhookPublisher

**Channel**: `webhook.custom` (TODO)

Generic HTTP POST for custom integrations (n8n, Zapier, internal systems).

```typescript
const webhook = new WebhookPublisher('https://n8n.example.com/webhook/social-post');
await publisher.publish(post);
```

**Request body**:
```json
{
  "channel": "linkedin.enterprise",
  "body": "Post text with #hashtags",
  "hashtags": ["hashtags"],
  "timestamp": "2026-06-26T10:00:00Z"
}
```

### EmailPublisher

**Channel**: `email.newsletter` (TODO)

Send posts as email newsletters for compliance-focused audiences.

```typescript
const emailer = new EmailPublisher(['dpo@company.de', 'compliance@company.de']);
await emailer.publish(post);
```

**Configuration**:
- To addresses: configurable per tenant
- From address: `noreply@realsync.ai` (customizable)
- Email provider: SendGrid, AWS SES, etc. (TODO: integrate)

## Retry Mechanism

All publishers inherit from `BasePublisher` with automatic exponential backoff:

```typescript
// Default: 3 attempts, 1s → 2s → 4s delays
publisher.maxRetries = 3;
publisher.retryDelayMs = 1000;

await publisher.retryWithBackoff(
  async () => {
    // Call external API
  },
  (attempt, error) => {
    console.warn(`Attempt ${attempt} failed: ${error.message}`);
  }
);
```

**Transient errors** (automatically retried):
- HTTP 429 (rate limit)
- HTTP 500-503 (server errors)
- Network timeouts

**Permanent errors** (no retry):
- HTTP 401/403 (auth/permission)
- HTTP 400 (malformed request)
- `BLOCKED` posts (policy rejection)

## Dead Letter Queue

**Status**: Pending implementation (follow-up PR).

**Purpose**: Capture failed publishing attempts for manual review and debugging.

**Future schema**:
```sql
CREATE TABLE distribution_dlq (
  id              uuid primary key,
  queue_entry_id  uuid references queue_entries(id),
  channel         text,
  error_code      text,
  error_message   text,
  retry_count     integer,
  next_retry_at   timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz
);
```

**Triggers**:
- After 3 failed retry attempts, entry moves to DLQ
- Operator can review failed post and decide to:
  - Retry manually
  - Edit and republish
  - Discard (with audit log)
  - Escalate (notify compliance officer)

## Audit Logging

All publish attempts logged to `runtime_events` for governance compliance.

**Events**:

| Event Type | Trigger | Metadata |
|------------|---------|----------|
| `publish_attempted` | `publisher.publish()` called | channel, post_id, actor_id |
| `publish_succeeded` | API returned `ok: true` | external_id, duration_ms |
| `publish_failed` | API returned error or exhausted retries | error_code, retry_count |
| `dlq_entry_created` | Entry moved to DLQ | reason, permanent? |

**Example log entry**:
```json
{
  "timestamp": "2026-06-26T10:05:30Z",
  "event": "publish_attempted",
  "channel": "linkedin.enterprise",
  "post_id": "sp_1234",
  "actor_id": "user_789",
  "duration_ms": 1200,
  "external_id": "urn:li:share:123456"
}
```

## Error Handling

### Channel-Specific Error Codes

Each channel returns structured error codes for analytics:

**LinkedIn**:
- `LINKEDIN_401_UNAUTHORIZED`
- `LINKEDIN_429_RATE_LIMIT`
- `LINKEDIN_403_FORBIDDEN`
- `LINKEDIN_API_ERROR`

**Webhook**:
- `WEBHOOK_TIMEOUT`
- `WEBHOOK_HTTP_5XX`
- `WEBHOOK_ERROR`

**Email**:
- `SMTP_AUTH_FAILED`
- `INVALID_RECIPIENT`
- `NO_RECIPIENTS`

### Error Metrics

**Future**: Track error trends per channel:
- Error rate (%), trending over 24h/7d
- Retry success rate (how many fail → succeed?)
- Mean time to resolution (MTTR) for each channel

## Queue Status & Metrics

**Status**: Pending implementation (follow-up PR).

**Metrics to expose**:

```typescript
interface QueueMetrics {
  total: number;
  byStatus: {
    pending: number;
    approved: number;
    published: number;
    failed: number;
    dlq: number;
  };
  byChannel: {
    [channel]: {
      attempted: number;
      succeeded: number;
      failed: number;
      avgDurationMs: number;
    };
  };
  errorBreakdown: {
    [errorCode]: number; // e.g., RATE_LIMIT: 5
  };
}
```

## Extending for New Channels

To add a new publisher:

1. Extend `BasePublisher`
2. Implement `publish(post): Promise<PublishResult>`
3. Use `retryWithBackoff()` for transient failures
4. Log attempts via `logPublishAttempt()`
5. Return structured `PublishResult`

```typescript
export class MyPublisher extends BasePublisher {
  public readonly channel: SocialChannel = 'my.channel';

  async publish(post: SocialPost): Promise<PublishResult> {
    this.logPublishAttempt(post, 'started');

    try {
      const result = await this.retryWithBackoff(async () => {
        // Call external API
        return apiResponse;
      });

      this.logPublishAttempt(post, 'success', { externalId: result.id });
      return {
        ok: true,
        channel: this.channel,
        externalId: result.id,
        postedAt: new Date().toISOString(),
      };
    } catch (err) {
      this.logPublishAttempt(post, 'failed', { error: err.message });
      return {
        ok: false,
        channel: this.channel,
        error: { code: 'ERROR_CODE', message: err.message },
      };
    }
  }
}
```

## Future Roadmap

- [ ] **Persistence**: Move queue to Postgres/Redis for durability
- [ ] **Dead Letter Queue**: Implement DLQ table and review workflow
- [ ] **Analytics Dashboard**: Queue depth, error rates, latency charts
- [ ] **Advanced Retry**: Circuit breaker pattern for failing channels
- [ ] **Scheduled Publishing**: Queue entry with `publishAt` timestamp
- [ ] **Preview Generation**: Screenshot/thumbnail for visual validation
- [ ] **A/B Testing**: Multiple variants per post, analytics correlation
- [ ] **Multi-tenant Isolation**: Separate queue instances per tenant
