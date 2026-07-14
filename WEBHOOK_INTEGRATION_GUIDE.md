# Webhook Integration Guide

## Overview

RealSyncDynamics now supports **real-time webhooks** for event-driven integrations with CI/CD pipelines, automation platforms (n8n, Zapier), and custom services.

## Architecture

```
Event Trigger (audit.completed, risk.detected, etc.)
  ↓
webhook-deliver function (dispatches to subscribed endpoints)
  ↓
webhook_subscriptions (filtered by event_key + tenant_id)
  ↓
POST to customer's webhook URL (with HMAC signature)
  ↓
webhook_deliveries log (append-only, immutable audit trail)
  ↓
Failed delivery? → webhook-retry-cron (5-min intervals, exponential backoff)
```

## Supported Events

| Event Key | Trigger | Payload |
|-----------|---------|---------|
| `audit.completed` | Domain audit finishes | `{audit_id, domain, findings[], risk_score}` |
| `risk.detected` | Compliance risk found | `{risk_id, severity, title}` |
| `incident.created` | New incident reported | `{incident_id, type, description}` |
| `sub_processor.changed` | Vendor status changed | `{vendor_id, name, change_type}` |
| `dpia.completed` | DPIA assessment done | `{dpia_id, result}` |
| `policy.violation` | Policy rule broken | `{policy_id, violation_type, severity}` |
| `agent.completed` | AI agent task done | `{agent_id, run_id, status}` |

## Setup Instructions

### 1. Create Webhook Subscription (API)

```bash
curl -X POST https://your-realsync-instance/api/v1/webhooks \
  -H "Authorization: Bearer <tenant_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "event_key": "audit.completed",
    "url": "https://your-service.com/webhooks/audit",
    "secret": "whsec_1234567890abcdef",
    "headers": {
      "Authorization": "Bearer your-service-token"
    },
    "max_retries": 3,
    "rate_limit_per_hour": 100
  }'
```

**Response:**
```json
{
  "id": "sub_xyz123",
  "tenant_id": "...",
  "event_key": "audit.completed",
  "url": "https://your-service.com/webhooks/audit",
  "enabled": true,
  "created_at": "2026-07-05T12:00:00Z"
}
```

### 2. Receive Webhook POST

Your endpoint receives:

```json
{
  "event_key": "audit.completed",
  "event_id": "audit_abc123",
  "timestamp": "2026-07-05T12:05:30Z",
  "audit_id": "audit_abc123",
  "domain": "example.com",
  "findings": [
    {
      "type": "cookie_without_consent",
      "severity": "high",
      "element": "Google Analytics"
    }
  ],
  "risk_score": 0.75
}
```

### 3. Verify Signature (Security)

Every webhook includes an `X-Webhook-Signature` header with HMAC-SHA256:

```
X-Webhook-Signature: sha256=abcd1234...

Signature = HMAC-SHA256(secret, payload_json)
```

**Verification (Node.js example):**
```typescript
import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// In your webhook handler:
const rawPayload = request.rawBody;  // raw request body as string
const signature = request.headers['x-webhook-signature'];
const secret = process.env.WEBHOOK_SECRET;

if (!verifyWebhook(rawPayload, signature, secret)) {
  return response.status(401).json({ error: 'Invalid signature' });
}
```

### 4. Respond with 2xx Status

Webhooks are considered successful if you return HTTP 200-299:

```typescript
// ✅ Success (will NOT retry)
response.status(200).json({ received: true });

// ❌ Failure (will RETRY with exponential backoff)
response.status(500).json({ error: 'Processing failed' });

// ⏱️ Timeout (> 10 seconds will be treated as failed)
// Webhook posts have a 10-second timeout
```

### 5. List Subscriptions (Dashboard)

```bash
curl -X GET https://your-realsync-instance/api/v1/webhooks \
  -H "Authorization: Bearer <tenant_api_key>"
```

### 6. Delete Subscription

```bash
curl -X DELETE https://your-realsync-instance/api/v1/webhooks/sub_xyz123 \
  -H "Authorization: Bearer <tenant_api_key>"
```

## Integration Examples

### n8n Automation

1. Create n8n webhook endpoint
2. Subscribe RealSync webhook to n8n's URL
3. When audit completes → n8n receives event → triggers workflow
4. Example: Update Slack channel, create JIRA ticket, send email

```
RealSync audit.completed
  ↓ (webhook)
n8n webhook trigger
  ↓
Switch on risk_score
  ├→ if > 0.8 → Create JIRA issue "Critical compliance risk"
  ├→ if > 0.5 → Post to #compliance Slack channel
  └→ Send email to compliance@company.com
```

### GitHub CI/CD

Subscribe to `policy.violation` events:

```yaml
# Your GitHub Actions receives webhook as environment variable
on:
  repository_dispatch:
    types: [webhook]

jobs:
  handle-compliance-violation:
    runs-on: ubuntu-latest
    steps:
      - name: Check Policy Violation
        if: github.event.client_payload.severity == 'critical'
        run: |
          # Block PR merge or notify maintainers
          echo "Compliance violation detected!"
          exit 1
```

### Zapier Integration

1. Use Zapier's Webhook trigger
2. Subscribe RealSync to Zapier's webhook URL
3. Configure Zapier action (e.g., create Asana task, update Google Sheets)

## Retry Policy

Failed deliveries are **automatically retried** with exponential backoff:

| Attempt | Wait Time | Total Delay |
|---------|-----------|-------------|
| 1 (initial) | immediate | 0s |
| 2 (retry) | 5 seconds | 5s |
| 3 (retry) | 25 seconds | 30s |
| 4 (retry) | 125 seconds | 155s |

**Max retries:** Configurable per subscription (default: 3)

After max retries, delivery is marked as `failed` permanently. No further retries.

## Monitoring & Observability

### Check Delivery Status

```bash
curl -X GET https://your-realsync-instance/api/v1/webhooks/deliveries \
  -H "Authorization: Bearer <tenant_api_key>" \
  -d 'limit=50&status=failed'
```

**Columns:**
- `status`: `delivered`, `failed`, `rate_limited`, `pending`
- `status_code`: HTTP response code
- `response_body`: First 1000 chars of response
- `error_message`: Why delivery failed
- `attempt_number`: Which retry attempt this was
- `next_retry_at`: When next retry is scheduled

### Metrics to Monitor

```sql
-- Delivery success rate (should be > 95%)
SELECT
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM webhook_deliveries
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Failed deliveries by subscription
SELECT
  sub.event_key,
  COUNT(*) as failures,
  MAX(d.created_at) as latest_failure
FROM webhook_deliveries d
JOIN webhook_subscriptions sub ON d.subscription_id = sub.id
WHERE d.status = 'failed'
  AND d.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY sub.event_key
ORDER BY failures DESC;

-- Rate limiting issues
SELECT
  sub.url,
  COUNT(*) as rate_limited_count
FROM webhook_deliveries d
JOIN webhook_subscriptions sub ON d.subscription_id = sub.id
WHERE d.status = 'rate_limited'
  AND d.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY sub.url;
```

## Deployment Checklist

- [ ] Apply migration: `supabase db push`
- [ ] Deploy functions:
  - `supabase functions deploy webhook-deliver`
  - `supabase functions deploy webhook-retry-cron`
- [ ] Set cron schedule for webhook-retry-cron: `*/5 * * * *` (every 5 minutes)
- [ ] Document event payloads in dashboard/API docs
- [ ] Test with curl to your own webhook endpoint
- [ ] Monitor delivery success rate first 24 hours

## Debugging Tips

### "Webhook not delivering"

1. Check subscription exists: `SELECT * FROM webhook_subscriptions WHERE event_key = '...'`
2. Check delivery logs: `SELECT * FROM webhook_deliveries ORDER BY created_at DESC LIMIT 10`
3. Verify endpoint is reachable: `curl -v https://your-endpoint.com/webhook`
4. Check rate limit: `SELECT COUNT(*) FROM webhook_deliveries WHERE subscription_id = '...' AND created_at >= NOW() - INTERVAL '1 hour'`
5. Look for network timeouts (> 10s)

### "Retries not happening"

1. Verify cron job is enabled: `supabase functions list | grep webhook-retry`
2. Check cron schedule in dashboard (should be `*/5 * * * *`)
3. Check for `max_retries` exceeded: `SELECT * FROM webhook_deliveries WHERE next_retry_at IS NULL AND status = 'failed'`
4. Monitor logs: `supabase functions logs webhook-retry-cron`

## Security Considerations

1. **Always verify signatures** — use constant-time comparison to prevent timing attacks
2. **Store secrets in Vault** — Recommend moving `webhook_subscriptions.secret` to Supabase Vault in production
3. **Use HTTPS** — All webhook URLs must be HTTPS (no HTTP)
4. **Rate limiting** — Default 100/hour prevents accidental DoS
5. **Audit trail** — All deliveries logged (immutable) for compliance
6. **RLS policies** — Only admins/owners can create subscriptions

## API Reference

### POST /webhooks (Create Subscription)

```
Authorization: Bearer <tenant_api_key>

{
  "event_key": "audit.completed",
  "url": "https://...",
  "secret": "whsec_...",
  "headers": {...},
  "max_retries": 3,
  "rate_limit_per_hour": 100
}
```

### GET /webhooks (List Subscriptions)

```
Authorization: Bearer <tenant_api_key>
```

Returns array of subscriptions for this tenant.

### GET /webhooks/deliveries (List Deliveries)

```
Authorization: Bearer <tenant_api_key>

Query params:
  - subscription_id: filter by subscription
  - status: 'delivered', 'failed', 'pending'
  - limit: 1-100
  - offset: pagination
```

### DELETE /webhooks/{id} (Delete Subscription)

```
Authorization: Bearer <tenant_api_key>
```

---

**Last Updated:** 2026-07-05  
**Deployment Status:** Ready for Beta  
**Success Target:** > 95% delivery rate, < 30s average latency
