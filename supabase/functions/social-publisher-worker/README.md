# Social Publisher Worker

Async distribution queue processor for the Social Orchestrator. Runs as a Supabase Edge Function to claim jobs atomically and publish via channel-specific adapters.

## Architecture

```
┌─────────────────────────────────────────────────┐
│ Orchestrator (in SPA)                           │
│  - Processes RuntimeEvents → SocialPosts        │
│  - Enqueues to distribution_queue_entries (DB)  │
└──────────────────┬──────────────────────────────┘
                   │
         ┌─────────▼──────────┐
         │ LISTEN/NOTIFY      │
         │ distribution_queue_ready
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────────────────────┐
         │ Publisher Worker (this function)   │
         │  - Polls queue for next job        │
         │  - Claims atomically (FOR UPDATE)  │
         │  - Publishes via adapter          │
         │  - Updates status or moves to DLQ │
         └─────────┬──────────────────────────┘
                   │
         ┌─────────▼──────────────────────────┐
         │ Channel Adapters                   │
         │  - LinkedIn (OAuth 2.0)            │
         │  - WordPress (REST API)            │
         │  - Ghost (Admin API)               │
         │  - Webhook (HTTP POST)             │
         │  - Email (SendGrid)                │
         └────────────────────────────────────┘
```

## Deployment

```bash
# Deploy this function
supabase functions deploy social-publisher-worker

# Or with environment variables
supabase functions deploy social-publisher-worker --env-file .env.local
```

## Environment Variables

### LinkedIn
Tokens come from `social_channel_connections` (sealed with `secretBox`, one row per tenant and account). The worker opens the seal for `job.tenant_id` and the queue channel (`linkedin.enterprise` / `linkedin.legal` → provider `linkedin`). The author URN is `account_external_id` on that row (`urn:li:person:…` or `urn:li:organization:…`). The orchestrator writes that id into `post_data.account_external_id` when it enqueues the job. If several connected accounts exist and the job names none, publishing fails instead of guessing.

The worker does **not** fall back to `LINKEDIN_ACCESS_TOKEN`. A platform token has no author URN.

`SOCIAL_PUBLISHER_LINKEDIN_ENABLED` defaults to off. Any value other than exactly `on` skips the LinkedIn channels: the worker does not claim those jobs, does not open a seal, and does not call LinkedIn. If `publishLinkedIn` is still reached, the job is not executed (`LinkedIn publishing disabled; job not executed`). Turn the flag on only after OAuth and a real author URN are in place.

Publish call, when the flag is `on`: `POST https://api.linkedin.com/rest/posts` with `LinkedIn-Version: 202610` and `X-Restli-Protocol-Version: 2.0.0`. `202610` is the latest version named on the LinkedIn versioning page as of 2026-11-13; a November 2026 release was not listed there. The post id is the `x-restli-id` response header.

The queue job has no image bytes. The Images API is not called. `facebook` is in development and is not a queue channel.

### WordPress
- `WORDPRESS_URL` — Site URL (e.g., https://example.com)
- `WORDPRESS_API_TOKEN` — Bearer token for REST API

### Ghost
- `GHOST_URL` — Ghost admin URL
- `GHOST_ADMIN_API_KEY` — Ghost Admin API key

### Webhook
- `WEBHOOK_URL` — Custom webhook endpoint

### Email
- `EMAIL_SERVICE` — `sendgrid` or `mailgun`
- `EMAIL_FROM_ADDRESS` — Sender address
- `SENDGRID_API_KEY` — SendGrid API key
- `EMAIL_RECIPIENTS` — Comma-separated list of recipients

## How It Works

### Job Claim (Atomic)

```sql
-- Called via RPC to atomically claim the next job
SELECT distribution_queue_claim_next(channel)

-- Uses: FOR UPDATE SKIP LOCKED to prevent duplicate processing
```

### Publish Flow

1. Claim job from queue (status → 'approved')
2. Call channel-specific publisher
3. On success: `distribution_queue_mark_published(job_id, external_id)`
4. On failure: `distribution_queue_mark_failed(job_id, error)` → triggers retry/DLQ

### Retry Strategy

Failed jobs are scheduled for retry with exponential backoff (2^attempts seconds).
After max_attempts, they move to Dead Letter Queue (distribution_dlq).

## Channels Supported

| Channel | Adapter | Status |
|---------|---------|--------|
| `linkedin.enterprise` | LinkedIn Posts API | Adapter (kein nachgewiesener Live-Publish) |
| `linkedin.legal` | LinkedIn Posts API | Adapter (kein nachgewiesener Live-Publish) |
| `wordpress.blog` | WordPress REST | ✅ Implemented |
| `ghost.blog` | Ghost Admin API | ✅ Implemented |
| `webhook.custom` | HTTP POST | ✅ Implemented |
| `email.newsletter` | SendGrid | ✅ Implemented |
| `instagram.reel` | Meta Graph API | ⏳ TODO |
| `tiktok.fast` | TikTok API | ⏳ TODO |
| `x.alert` | X API v2 | ⏳ TODO |

## Invocation

### Via Webhook (recommended for production)

```bash
curl -X POST https://<project>.functions.supabase.co/social-publisher-worker \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Via Cron Job (Supabase Database Webhooks)

Configure a webhook to call this function every 30 seconds:

```sql
-- In Supabase dashboard: Database Webhooks
INSERT INTO public.webhooks (...)
  VALUES (
    'social-publisher-worker',
    'https://<project>.functions.supabase.co/social-publisher-worker',
    'POST',
    NOW() + interval '30 seconds'
  );
```

### Via LISTEN/NOTIFY (real-time)

The function can be invoked in response to `distribution_queue_ready` LISTEN/NOTIFY events.
Wire this up in a separate realtime listener (e.g., in an app backend).

## Monitoring

### Logs

View logs via Supabase dashboard or:

```bash
supabase functions list
supabase functions logs social-publisher-worker
```

### Audit Trail

Query the audit log:

```sql
SELECT * FROM public.distribution_audit_log
WHERE event_type IN ('publish_success', 'publish_failed')
ORDER BY created_at DESC
LIMIT 50;
```

### Dead Letter Queue

Inspect failed entries:

```sql
SELECT * FROM public.distribution_dlq
ORDER BY failed_at DESC
LIMIT 20;
```

## Error Handling

- **No token configured** → fails immediately, no retry
- **Network error** → retried with exponential backoff
- **Publisher API error** → fails immediately or retried depending on status code
- **Max retries exceeded** → entry moved to DLQ for manual review

## Future Work

- [ ] Implement Instagram Reel publisher
- [ ] Implement TikTok Fast publisher
- [ ] Implement X (Twitter) publisher
- [ ] Add circuit breaker for failing channels
- [ ] Implement batching for LinkedIn, WordPress
- [ ] Add metrics/telemetry (published count, error rate)
- [ ] Implement webhook signature validation
