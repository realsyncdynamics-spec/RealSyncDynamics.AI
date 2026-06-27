# Runtime Observability — Browser Actions & Governance Logging

## Overview

Complete audit trail for all browser-based governance actions: preview loads, compliance scans, evidence generation. All events are:

- **Tenant-scoped**: RLS-protected via `tenant_id`
- **User-attributed**: Actor ID when available
- **Session-tracked**: Unique `session_id` per browser session
- **Evidence-correlated**: SHA-256 hashes for deduplication & audit
- **Workflow-linked**: Optional `workflow_id` and `run_id` for orchestration context

## Tables

### `browser_actions`

Each row represents one governance action (preview load, scan, evidence generation):

```sql
CREATE TABLE browser_actions (
  id                uuid primary key,
  tenant_id         uuid not null,        -- Tenant scope (RLS)
  actor_id          uuid,                 -- auth.users.id (nullable for system)
  session_id        text not null,        -- Browser session identifier
  
  -- Governance context
  workflow_id       uuid,                 -- Link to orchestration
  run_id            uuid,                 -- Link to workflow run
  tool_name         text,                 -- 'governance-preview', 'governance-scan', etc.
  
  -- Action metadata
  browser_action    text not null,        -- 'preview_load', 'scan_start', 'evidence_generate', etc.
  status            text not null,        -- 'started', 'completed', 'failed', 'blocked'
  
  url               text,                 -- Target URL being previewed/scanned
  http_status       integer,              -- HTTP status of the iframe load
  
  -- Timing (wall-clock, not CPU time)
  started_at        timestamptz,
  completed_at      timestamptz,
  duration_ms       integer,
  
  -- Evidence
  evidence_hash     text,                 -- SHA-256 of evidence payload
  evidence_size_bytes integer,
  
  -- Error handling
  error_message     text,
  error_code        text,
  
  -- Audit context
  browser_user_agent text,
  client_ip         text,
  
  -- Extensible
  metadata          jsonb,
  created_at        timestamptz
);
```

### `evidence_events`

Enhanced to include optional `browser_action_id` foreign key for correlation:

```sql
ALTER TABLE evidence_events
  ADD COLUMN browser_action_id uuid references browser_actions(id);
```

## Browser Action Types

| Action | Trigger | Status Values | Use Case |
|--------|---------|---------------|----------|
| `preview_load` | iframe loads successfully | `completed` | Page preview rendered |
| `preview_error` | iframe blocked by CSP/X-Frame-Options | `failed` | Evidence collection still possible |
| `reload` | User clicks reload button | `started` | Browser canvas reload |
| `scan_start` | User clicks "Scan starten" | `started` | Governance scan initiated |
| `scan_complete` | Scan returns results | `completed` | Results available |
| `evidence_generate` | User clicks "Evidence erzeugen" | `started` | Evidence collection requested |
| `open_external` | User opens link in new tab | `completed` | Direct browser navigation |

## Integration Points

### EmbeddedBrowserCanvas.tsx

The `EmbeddedBrowserCanvas` component automatically logs all actions via the `browser-action-log` Edge Function:

```tsx
<EmbeddedBrowserCanvas
  url="https://example.com"
  workflowId="wf_123"
  runId="run_456"
  toolName="governance-scan"
  onClose={() => {}}
  onScan={(url) => {}}
/>
```

Props:
- `workflowId` (optional): Link to `workflows.id` for orchestration context
- `runId` (optional): Link to `workflow_runs.id` for run-level context
- `toolName` (optional): Custom tool identifier (defaults to `governance-preview`)

### Edge Function: `browser-action-log`

POST endpoint at `/.well-known/functions/v1/browser-action-log`

Request body:
```json
{
  "tenantId": "uuid",
  "actorId": "uuid (optional)",
  "sessionId": "browser-session-id",
  "browserAction": "preview_load|preview_error|scan_start|...",
  "status": "started|completed|failed|blocked",
  "url": "https://example.com (optional)",
  "startedAt": "ISO-8601",
  "completedAt": "ISO-8601 (optional)",
  "durationMs": 1234,
  "errorMessage": "Error text (optional)",
  "metadata": { ... }
}
```

## Session Management

### Browser Session ID

Each browser gets a unique 12-hour session ID via `useBrowserSession()` hook:

```ts
import { useBrowserSession } from './lib/useBrowserSession';

function MyComponent() {
  const sessionId = useBrowserSession(); // e.g., "bs_1234567890_abc123"
  // All actions within this session share the same ID
}
```

- Stored in `localStorage` with timeout tracking
- Survives page reloads within 12 hours
- Supports GDPR: no PII, opaque to the user
- Enables session-level audit trail without requiring user login

## Audit Trail Queries

### All actions in a session

```sql
SELECT *
FROM browser_actions
WHERE session_id = $1
ORDER BY started_at;
```

### Actions by user

```sql
SELECT *
FROM browser_actions
WHERE tenant_id = $1 AND actor_id = $2
ORDER BY started_at DESC;
```

### Failed previews (CSP/X-Frame blocked)

```sql
SELECT *
FROM browser_actions
WHERE browser_action = 'preview_error' AND status = 'failed'
ORDER BY started_at DESC;
```

### Evidence with timing

```sql
SELECT ba.*, ee.created_at as evidence_logged_at
FROM browser_actions ba
LEFT JOIN evidence_events ee ON ee.browser_action_id = ba.id
WHERE ba.browser_action = 'evidence_generate'
ORDER BY ba.started_at DESC;
```

### RLS Policy

All queries are protected by tenant-scoped RLS:

```sql
CREATE POLICY "browser_actions tenant-read"
  ON browser_actions FOR SELECT
  USING (is_tenant_member(tenant_id));
```

Only authenticated users who are members of the tenant can read its events.

## Compliance Notes

### DSGVO (GDPR)

- ✅ No raw personal data in URLs (unless explicitly in query string from user)
- ✅ Session ID is opaque, not linkable without additional context
- ✅ Timing data is retained for audit only (12+ months, depending on plan)
- ✅ User has data export rights via GDPR-compliant exports

### EU AI Act

- ✅ Logs serve as evidence for audit trail compliance
- ✅ Timestamps enable forensic replay for AI decision traceability
- ✅ Evidence hashes support non-repudiation

## Future Enhancements

1. **Persistence**: Move from in-memory queue to distributed queue (BullMQ/Redis)
2. **Dead Letter Queue (DLQ)**: Capture failed logging attempts
3. **Analytics Dashboard**: Session heatmaps, error rate tracking
4. **Performance Analysis**: Identify slow preview loads, scan bottlenecks
5. **Evidence Correlation**: Automatic linking of browser actions to external audit events
