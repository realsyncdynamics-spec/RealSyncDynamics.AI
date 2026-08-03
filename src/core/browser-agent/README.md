# Browser-Agent

Autonomous browser navigation + governance enforcement.

Integrates playwright-scanner (headless Chromium) with the Agent OS substrate.
Discovers AI systems, vendors, and trackers. Logs all actions to the evidence chain.

**Hard Rules (§11, CLAUDE.md)**
- Never auto-approve policy violations — proposals stay `proposed` until human decision
- All browser actions logged with SHA-256 evidence hash
- Graceful failure with full audit trail
- Multi-tenant isolation via `tenant_id` + RLS

---

## Architecture

```
Browser-Agent (Handler)
  ↓
  ├─→ PlaywrightScannerClient (POST /scan)
  │      ↓
  │      playwright-scanner microservice
  │
  ├─→ BrowserActionLogClient (log)
  │      ↓
  │      browser-action-log Edge Function → browser_actions table
  │
  └─→ Agent OS Store (observe, propose)
         ↓
         agent_observations, agent_decisions
```

---

## Task Contract

### Input (`agent_tasks.input`)

```typescript
{
  url: string,                    // https://example.com
  tenant_id: UUID,                // workspace owner
  scan_type: 'audit' | 'discovery' | 'policy_check',
  timeout_ms?: number,            // default 30000
  waitFor?: string,               // CSS selector to wait for
  user_agent?: string,            // custom User-Agent
}
```

### Output (`agent_outputs.content`)

```typescript
{
  url: string,
  scan_type: string,
  systems_found: [{
    name: string,
    category: 'ai_model' | 'tracking' | 'vendor' | 'unknown',
    risk_level: 'critical' | 'high' | 'medium' | 'low',
  }],
  trackers_found: [{
    id: string,
    name: string,
    category: 'essential' | 'tracking' | 'unknown',
    pattern_matched: string,
    loaded_before_consent: boolean,
  }],
  risk_score: 0 | 1 | 2 | 3 | 4 | 5,
  policy_violations: [{
    rule_id: string,
    policy_name: string,
    severity: 'info' | 'low' | 'medium' | 'high' | 'critical',
    description: string,
  }],
  evidence_hash: string,  // SHA-256
}
```

---

## Registration & Usage

### In an Edge Function (e.g., `agent-os-runner`)

```typescript
import { Orchestrator } from '@/src/core/agent-os/orchestrator';
import { createBrowserAgentHandler } from '@/src/core/browser-agent/handler';

const orchestrator = new Orchestrator();

// Register at startup
orchestrator.registerAgent(
  'browser-agent',
  await createBrowserAgentHandler({
    scannerBaseUrl: Deno.env.get('PLAYWRIGHT_SCANNER_URL'),
    scannerApiKey: Deno.env.get('PLAYWRIGHT_SCANNER_SECRET'),
    browserActionLogUrl: Deno.env.get('BROWSER_ACTION_LOG_URL'),
    browserActionLogApiKey: Deno.env.get('BROWSER_ACTION_LOG_API_KEY'),
  })
);

// Create a task
const task = orchestrator.store.createTask({
  tenant_id: 'tenant_abc',
  agent: 'browser-agent',
  task: 'Scan website for compliance gaps',
  input: {
    url: 'https://example.com',
    tenant_id: 'tenant_abc',
    scan_type: 'audit',
    timeout_ms: 30000,
  },
  priority: 'high',
});

// Execute
const result = await orchestrator.run(task.id);
```

### Environment Variables

Required in Edge Function / Service env:

```
PLAYWRIGHT_SCANNER_URL=https://scanner.realsyncdynamics.ai
PLAYWRIGHT_SCANNER_SECRET=...
BROWSER_ACTION_LOG_URL=https://api.realsyncdynamics.ai/functions/v1/browser-action-log
BROWSER_ACTION_LOG_API_KEY=...
```

---

## Observable Behavior

### Events Emitted

- `agent_observations` (via `ctx.observe()`):
  - `category: 'browser_scan'` — scan completion summary
  - `category: 'governance_signal'` — policy violations detected
  - `category: 'error'` — scan failure with error code

- `browser_actions` (via Edge Function):
  - `browser_action: 'scan_start'` — scan initiated
  - `browser_action: 'scan_complete'` — scan succeeded
  - Status: `'started' | 'completed' | 'failed'`

- `agent_decisions` (via `ctx.propose()`):
  - If policy violations detected → `status: 'proposed'` (awaits human approval)
  - Never auto-approved

### Observability

All browser actions logged with:
- SHA-256 evidence hash
- Duration (start/complete timestamps)
- Risk score + violation counts
- Client IP, User-Agent
- Error details (on failure)

Query browser scan history:

```sql
select * from browser_actions
  where tenant_id = 'tenant_abc'
  and browser_action in ('scan_start', 'scan_complete')
  order by started_at desc
  limit 50;
```

---

## Error Handling

### Scanner Errors (from playwright-scanner)

| Code | Meaning | Handler Response |
|------|---------|------------------|
| `UNAUTHORIZED` | Invalid API key | `failed` + observe error |
| `RATE_LIMITED` | Too many concurrent scans | `blocked` + retry hint |
| `INVALID_URL` | Malformed URL | `failed` + validation error |
| `SCAN_FAILED` | Browser crash or timeout | `failed` + error details |
| `TIMEOUT` | Exceeded `timeout_ms` | `blocked` + timeout reason |

### Handler Outcomes

- `done`: Scan succeeded, result in `content`
- `failed`: Scanner error or invalid input → full audit trail logged
- `blocked`: Rate limited → task can be retried later

---

## Files

```
src/core/browser-agent/
├── README.md                  (this file)
├── types.ts                   (input/output contracts)
├── scanner-client.ts          (playwright-scanner API client)
├── handler.ts                 (Agent OS handler)
└── policy-engine.ts           (Phase B: governance rule enforcement)

test/core/browser-agent/
└── browser-agent.test.ts      (unit tests)
```

---

## Phase A vs Phase B

### Phase A (Now)
- ✅ Handler scaffolding + scanner integration
- ✅ Logging to browser_actions + event chain
- ✅ Policy violation proposals (no auto-approval)
- ✅ Error handling + audit trail
- ✅ Multi-tenant isolation

### Phase B (Future)
- Policy engine: map `policy_packs` → violations
- Consent-timing simulation: pre vs post-consent tracker detection
- Multi-page crawl mode (sitemaps, internal links)
- Scheduled scanning (cron via n8n)
- Prometheus metrics export (active scans, error rates, latency)

---

## Safety Rules

**§11 — No Auto-Approval**

When policy violations are detected, the handler calls:

```typescript
ctx.propose({
  agent_role: 'governance_engine',
  decision_type: 'policy_violation_review',
  title: `Review ${violations.length} policy violations…`,
  // ...
});
```

The proposal remains `status: 'proposed'` until:
1. A human reviews the violations, **AND**
2. Calls `resolveDecision(id, 'approved', user_id)`

The Postgres RLS policy enforces this — no agent can transition a proposal to `approved`.

**§1 — Multi-Tenancy**

Every browser action carries `tenant_id`. The handler:
- Reads from `input.tenant_id` (task input)
- Logs to `browser_actions` with same `tenant_id`
- Uses RLS to ensure isolation

---

## Testing

```bash
npm test -- src/core/browser-agent/
```

Test coverage:
- Scanner client HTTP mocking
- Handler orchestration (observe, propose, error paths)
- Evidence hash computation
- Policy violation proposal logic
- Tenant isolation
