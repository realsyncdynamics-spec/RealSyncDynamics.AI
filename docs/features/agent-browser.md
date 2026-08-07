# Agent Browser — Autonomous Web Browsing with Governance

## Overview

Agent Browser enables AI agents to autonomously browse the web, perform actions (navigate, click, extract data), and submit forms — all under strict governance control with complete audit trails and evidence collection.

**Key Features:**
- ✅ Policy-driven access control (which agents can browse which URLs)
- ✅ Action whitelisting (navigate, click, extract, submit, screenshot)
- ✅ Complete audit trail (every action logged to `agent_browser_actions`)
- ✅ Evidence collection (screenshots, HAR logs, custody chains with C2PA)
- ✅ Multi-tenant isolation (RLS on all tables)
- ✅ Cost tracking (integrated with `ai_tool_runs` for billing)
- ✅ Real-time monitoring dashboard

## Architecture

### Database Schema

**Tables:**
- `agent_browser_sessions` — top-level session record with policy enforcement status
- `agent_browser_actions` — fine-grained audit trail of each action (navigate, click, etc.)
- `agent_browser_policies` — governance rules (which agents can browse where, what actions allowed)

**Views:**
- `agent_browser_sessions_with_context` — enriched session view with policy + action counts

**Integration Points:**
- `ai_tool_runs` — cost/quota tracking, agent billing
- `browser_actions` — shared browser action event logging
- `evidence_vault` — persistent evidence storage (screenshots, HAR, C2PA signatures)
- `ai_policies` — linked for governance enforcement

### Flow

```
Agent Request (POST /functions/v1/agent-browser)
  ↓
Policy Check (agent identity → allowed domains → action whitelist)
  ├─ PASS → Continue
  └─ FAIL → Block, log incident, return 403
  ↓
Create Session (agent_browser_sessions)
  ↓
Execute Actions (navigate, click, extract, …)
  ├─ Per-action: Log to agent_browser_actions
  ├─ Per-action: Capture screenshot (if policy requires)
  ├─ Per-action: Extract evidence (hash for audit trail)
  └─ Update session counters
  ↓
Evidence Ingestion
  ├─ Store screenshots in evidence_vault (with SHA-256 hash)
  ├─ Store HAR log (HTTP Archive) in evidence_vault
  └─ Sign custody chain with C2PA (if enabled)
  ↓
Audit Log (ai_tool_runs for billing, browser_actions for user-level tracking)
  ↓
Return Response with session_id + action results
```

## API Reference

### POST /functions/v1/agent-browser

**Request:**
```json
{
  "tenant_id": "uuid",
  "agent_id": "hermes-01",
  "agent_run_id": "uuid",
  "initial_url": "https://example.com",
  "actions": [
    { "type": "navigate", "target": "https://example.com/page" },
    { "type": "take_screenshot" },
    { "type": "extract_data", "target": "#results" },
    { "type": "click", "target": "button.submit" }
  ],
  "policy_override": false
}
```

**Response (200 Success):**
```json
{
  "session_id": "session-key-xxx",
  "status": "success",
  "initial_url": "https://example.com",
  "final_url": "https://example.com/page",
  "actions_completed": 4,
  "actions_blocked": 0,
  "total_duration_ms": 5432,
  "evidence_items": 4,
  "results": [
    {
      "action_type": "navigate",
      "status": "success",
      "duration_ms": 1200,
      "page_state": {
        "url": "https://example.com/page",
        "title": "Example Page"
      }
    },
    …
  ],
  "policy_check": {
    "passed": true
  }
}
```

**Response (403 Blocked):**
```json
{
  "session_id": "session-key-xxx",
  "status": "blocked",
  "initial_url": "https://malicious.com",
  "actions_completed": 0,
  "actions_blocked": 4,
  "total_duration_ms": 123,
  "evidence_items": 0,
  "results": [],
  "policy_check": {
    "passed": false,
    "reason": "Domain blocked by policy"
  }
}
```

## Policy Management

### Creating a Policy

A policy controls which agents can browse which URLs and perform which actions.

**Example:**
```sql
INSERT INTO public.agent_browser_policies (
  tenant_id,
  name,
  description,
  applies_to_agents,
  allowed_domains,
  blocked_domains,
  allowed_actions,
  require_approval,
  screenshot_every_action,
  max_concurrent_sessions,
  max_session_duration_seconds
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Hermes Standard Policy',
  'Standard policy for Hermes agent',
  ARRAY['hermes-*'],
  ARRAY['example.com', 'api.*.example.com'],
  ARRAY['malicious.com', 'blocked.com'],
  ARRAY['navigate', 'click', 'extract_data', 'take_screenshot'],
  false,
  true,
  5,
  600
);
```

**Policy Fields:**
- `applies_to_agents` — agent ID patterns (supports wildcards)
- `allowed_domains` — whitelist of domains (empty = no restriction)
- `blocked_domains` — explicit blocklist
- `allowed_actions` — action types permitted (navigate, click, fill_form, submit_form, extract_data, take_screenshot, wait_for_element, scroll, get_page_title, get_text_content, evaluate_script)
- `require_approval` — manual approval needed before browsing
- `screenshot_every_action` — capture screenshot after each action
- `capture_har` — capture HAR logs for network audit
- `max_concurrent_sessions` — concurrent limit per agent
- `max_session_duration_seconds` — session timeout

### React Component: AgentBrowserPolicyManager

```tsx
import { AgentBrowserPolicyManager } from '@/components/governance-os/AgentBrowserPolicyManager';

export function MyComponent() {
  return <AgentBrowserPolicyManager />;
}
```

## Monitoring

### React Component: AgentBrowserMonitor

Real-time dashboard showing active, completed, and blocked agent browser sessions.

```tsx
import { AgentBrowserMonitor } from '@/components/governance-os/AgentBrowserMonitor';

export function MyDashboard() {
  return <AgentBrowserMonitor />;
}
```

**Displays:**
- Active sessions with real-time progress
- Blocked sessions (policy violations)
- Completed sessions with evidence counts
- Session metadata (URL, agent ID, action count, duration)

### React Hook: useAgentBrowser

```tsx
import { useAgentBrowser } from '@/hooks/useAgentBrowser';
import type { BrowserAction } from '@/types/agent-browser';

function MyComponent() {
  const { loading, error, sessionId, initiateBrowserSession } = useAgentBrowser();

  const handleStartBrowsing = async () => {
    const actions: BrowserAction[] = [
      { type: 'navigate', target: 'https://example.com' },
      { type: 'take_screenshot' },
      { type: 'extract_data', target: '#results' },
    ];

    const result = await initiateBrowserSession(
      'hermes-01',
      'https://example.com',
      actions,
      'agent-run-id-123'
    );

    if (result) {
      console.log(`Session ${result.session_id} completed with ${result.actions_completed} actions`);
    }
  };

  return <button onClick={handleStartBrowsing}>Start Browsing</button>;
}
```

## Evidence & Audit Trail

Every action generates evidence stored in `evidence_vault`:

1. **Session-Level Evidence**
   - Session metadata (agent, URL, duration)
   - Policy check result
   - Total action count + blocked count

2. **Action-Level Evidence**
   - Action type + target + status
   - Screenshot hash (SHA-256)
   - Page state (URL, title, text preview)
   - Extracted data (if applicable)
   - Duration

3. **Custody Chain**
   - Agent identity + timestamp
   - SHA-256 hash chain (previous action → current action)
   - C2PA signature (if enabled in policy)
   - Notarization timestamp

## Integration with Playwright-Scanner

Agent Browser can integrate with the `playwright-scanner` microservice for deep compliance audits:

```typescript
import { createBrowserExecutor } from '@/lib/agent-browser/executor';

const executor = createBrowserExecutor({
  playwrightScannerUrl: 'http://playwright-scanner:3000',
  playwrightScannerSecret: 'xxx',
});

// Scan a URL for trackers, cookies, storage, network requests
const scanResult = await executor.scanUrl('https://example.com');
```

This is useful for agents that need to audit third-party tracking, cookie consent, or data collection.

## Governance Checklist

Agent Browser supports these EU AI Act + GDPR compliance checkpoints:

- ✅ **Identity** — agent identity captured in all audit logs
- ✅ **Transparency** — actions logged in real-time, queryable
- ✅ **Consent** — policy enforcement (agent cannot act outside policy)
- ✅ **Custody** — evidence chain with C2PA signatures
- ✅ **Rectification** — session data queryable by timestamp/agent/URL
- ✅ **Deletion** — evidence retention policies can be enforced via policy

## Deployment Checklist

- ✅ Migration `20260803000000_agent_browser_sessions.sql` deployed
- ✅ Edge Function `agent-browser/index.ts` deployed
- ✅ Playwright-scanner service running (or mock HTTP responses)
- ✅ RLS policies enabled on `agent_browser_*` tables
- ✅ Dashboard components registered in `governance-os/`
- ✅ Policy templates created for each agent type

## Known Limitations

1. **Browser Actions are Placeholders** — currently logged to DB but not actually executed. Production integration requires:
   - Playwright-based browser pool
   - Screenshot capture + storage
   - HAR log collection
   - Cookie/storage extraction

2. **No Consent Simulation** — assumes agents see pages as anonymous users (no cookies). Pre/post-consent audit separation comes in Phase 2.

3. **No Manual Approval Workflow** — `require_approval` field exists but UI/Webhook flow not yet built.

4. **Session Concurrency** — limit is enforced in policy but not at runtime. Requires Redis-backed queue in production.

## Future Enhancements

- **Phase 2 (Q4 2026)**
  - Real Playwright browser pool with screenshot capture
  - HAR log collection + storage
  - Manual approval workflow for sensitive agents
  - Consent simulation (track pre/post-consent actions separately)

- **Phase 3 (2027)**
  - Agent-to-agent message passing (orchestrated multi-step workflows)
  - Conditional branching (if-then-else based on page content)
  - Form auto-fill templates (stored securely in vault)
  - Visual testing (screenshot comparison against baseline)

## References

- **Migration:** `supabase/migrations/20260803000000_agent_browser_sessions.sql`
- **Edge Function:** `supabase/functions/agent-browser/index.ts`
- **Types:** `src/types/agent-browser.ts`
- **Hook:** `src/hooks/useAgentBrowser.ts`
- **Components:**
  - `src/components/governance-os/AgentBrowserMonitor.tsx`
  - `src/components/governance-os/AgentBrowserPolicyManager.tsx`
- **Utilities:** `src/lib/agent-browser/executor.ts`
- **Playwright-Scanner:** `services/playwright-scanner/README.md`
