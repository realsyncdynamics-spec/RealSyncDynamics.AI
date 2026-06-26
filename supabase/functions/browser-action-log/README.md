# browser-action-log

Logs browser-based governance actions (preview loads, scans, evidence generation) to `browser_actions` table for complete audit trail support.

## Endpoint

```
POST /functions/v1/browser-action-log
```

## Request

```json
{
  "tenantId": "uuid",
  "actorId": "uuid (optional)",
  "sessionId": "session-id (required)",
  "workflowId": "uuid (optional)",
  "runId": "uuid (optional)",
  "toolName": "governance-preview (optional)",
  "browserAction": "preview_load | preview_error | reload | scan_start | scan_complete | evidence_generate | open_external",
  "status": "started | completed | failed | blocked",
  "url": "https://example.com (optional)",
  "httpStatus": 200,
  "startedAt": "ISO-8601 (optional)",
  "completedAt": "ISO-8601 (optional)",
  "durationMs": 1234,
  "evidenceHash": "sha256-hash (optional)",
  "evidenceSizeBytes": 4096,
  "errorMessage": "error text (optional)",
  "errorCode": "ERROR_CODE (optional)",
  "browserUserAgent": "Mozilla/5.0... (optional)",
  "clientIp": "192.168.1.1 (optional)",
  "metadata": { "key": "value" }
}
```

## Response

**Success (201)**:
```json
{
  "success": true,
  "id": "uuid"
}
```

**Error (400–500)**:
```json
{
  "error": "error description",
  "details": "additional info"
}
```

## Usage

From React components via `EmbeddedBrowserCanvas`:

```tsx
import { EmbeddedBrowserCanvas } from './EmbeddedBrowserCanvas';

<EmbeddedBrowserCanvas
  url="https://example.com"
  workflowId="wf_123"
  onClose={() => {}}
  onScan={(url) => {}}
/>
```

The component automatically logs:
- `preview_load` when iframe loads
- `preview_error` when CSP/X-Frame blocks load
- `scan_start` when user clicks "Scan starten"
- `evidence_generate` when user clicks "Evidence erzeugen"
- `open_external` when user opens in new tab

## Requirements

- `SUPABASE_URL` environment variable (Supabase project URL)
- `SUPABASE_SERVICE_ROLE_KEY` environment variable (service role key with `browser_actions` INSERT permission)

## Database

Stores to `browser_actions` table with RLS enabled:
- Tenant-scoped (RLS via `is_tenant_member()`)
- Service role can INSERT
- Regular users can SELECT their tenant's events
- Append-only audit trail

See: `supabase/migrations/20260526000000_browser_actions_observability.sql`

## Error Handling

- Missing required fields → 400 Bad Request
- Supabase insert error → 500 Internal Server Error
- Missing config → 500 with warning

Client should:
- Retry on 500 (transient server error)
- Skip on 400 (malformed request, log client-side)
- NOT retry on auth errors (fix configuration)
