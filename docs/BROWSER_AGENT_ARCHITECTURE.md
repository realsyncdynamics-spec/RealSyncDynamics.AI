# Browser-Agent Architektur — Deep Dive

**Referenz**: Phase 2 Governance Layer (#899)  
**Datum**: 2026-08-03  
**Status**: Production-Ready (Phase A)

---

## Übersicht: 4-Schichten-Model

```
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Dashboard / CLI / API                                 │ │
│  │  (creates agent_tasks for browser-agent)               │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │ (creates task)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            Agent OS Substrate (Orchestrator)                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Orchestrator.run(task_id)                             │ │
│  │  ├─ Loads task from agent_tasks                        │ │
│  │  ├─ Looks up handler: 'browser-agent'                  │ │
│  │  ├─ Executes: await handler(ctx)                       │ │
│  │  └─ Stores result in agent_outputs + agent_events      │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │ (ctx: HandlerContext)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              Browser-Agent Handler                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Input: BrowserAgentTaskInput { url, tenant_id, ... }   │ │
│  │                                                          │ │
│  │  1. Validate input (url, tenant_id required)            │ │
│  │  2. Log: scan_start → browser-action-log Edge Fn        │ │
│  │  3. Call: scanner.scan(url, options)                    │ │
│  │  4. Compute: SHA256(result)                             │ │
│  │  5. Log: scan_complete → browser-action-log             │ │
│  │  6. Observe: ctx.observe(category='browser_scan', ...) │ │
│  │  7. Detect Violations → ctx.propose() [no auto-appr] │ │
│  │  8. Return: HandlerResult { content, evidence, ... }    │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │ (scanner client)
                       ├─→ playwright-scanner (HTTP POST /scan)
                       │
                       │ (logging)
                       ├─→ browser-action-log Edge Function
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│           Infrastructure Layer (Supabase + Services)         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Playwright-Scanner Microservice (Node + Chromium)       │ │
│  │  GET /health                                            │ │
│  │  POST /scan → { url, options } → ScanResult             │ │
│  │  Returns: cookies, trackers, forms, score, severity     │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ browser-action-log Edge Function (Deno)                 │ │
│  │  POST /{browser-action-log}                             │ │
│  │  Inserts → browser_actions table (with RLS)             │ │
│  │  Returns: { success: true, id: string }                 │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ PostgreSQL (Supabase)                                   │ │
│  │  ├─ browser_actions (observability log)                 │ │
│  │  ├─ agent_tasks (substrate)                             │ │
│  │  ├─ agent_outputs (substrate)                           │ │
│  │  ├─ agent_observations (substrate)                      │ │
│  │  ├─ agent_decisions (proposals, no auto-approval)      │ │
│  │  └─ agent_events (replay log, monotonic)                │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## Datenflusss: Eine echte Scan-Anfrage

### Szenario: User klickt "Audit Website"

**T+0s:** User startet Scan

```json
// Dashboard erstellt Task via GraphQL / API
POST /rest/v1/rpc/create_task
{
  "p_agent": "browser-agent",
  "p_task": "Audit https://example.com for DSGVO compliance",
  "p_input": {
    "url": "https://example.com",
    "tenant_id": "workspace_123",
    "scan_type": "audit"
  },
  "p_priority": "high"
}

// Supabase speichert in agent_tasks:
{
  id: "task_abc123",
  tenant_id: "workspace_123",
  agent: "browser-agent",
  status: "open",
  input: { url, tenant_id, scan_type },
  created_at: "2026-08-03T12:00:00Z"
}
```

**T+0.5s:** Agent OS Orchestrator wird getriggert (z.B. via n8n Cron oder Edge Function)

```typescript
const orchestrator = new Orchestrator();
orchestrator.registerAgent('browser-agent', await createBrowserAgentHandler({...}));

const result = await orchestrator.run('task_abc123');
// Orchestrator.run():
// 1. Lädt task_abc123 aus agent_tasks
// 2. Status: open → in_progress
// 3. Ruft handler auf: HandlerContext { task, store, observe, propose }
```

**T+0.6s:** Browser-Agent Handler startet

```typescript
// browser-agent/handler.ts

// 1. Validate
input = { url: 'https://example.com', tenant_id: 'workspace_123', scan_type: 'audit' }

// 2. Log: scan_start
await logBrowserAction({
  tenant_id: 'workspace_123',
  session_id: 'task_abc123',
  browser_action: 'scan_start',
  status: 'started',
  url: 'https://example.com',
  started_at: '2026-08-03T12:00:00.600Z',
  metadata: { scan_type: 'audit' }
})

// ↓ POST http://localhost:54321/functions/v1/browser-action-log
// ↓ browser-action-log Edge Function schreibt:
// {
//   id: 'log_xyz',
//   tenant_id: 'workspace_123',
//   browser_action: 'scan_start',
//   started_at: '2026-08-03T12:00:00.600Z',
//   created_at: '2026-08-03T12:00:00.601Z'
// } → browser_actions table
```

**T+1s–T+5s:** PlaywrightScanner führt headless Scan aus

```typescript
// browser-agent/scanner-client.ts
const result = await scanner.scan('https://example.com', { timeout: 30000 })

// POST http://scanner.realsyncdynamicsai.de/scan
// Authorization: Bearer $PLAYWRIGHT_SCANNER_SECRET
// {
//   "url": "https://example.com",
//   "options": { "timeout": 30000 }
// }

// Scanner Response (aus playwright-scanner):
{
  ok: true,
  url: 'https://example.com',
  meta: {
    duration_ms: 3500,
    redirect_chain: [],
    fetched_status: 200
  },
  cookies: [
    { name: '_ga', domain: 'example.com', category: 'tracking', third_party: false },
    { name: 'tracking_id', domain: 'cdn.example.com', category: 'tracking', third_party: true }
  ],
  trackers: [
    { id: 'ga', name: 'Google Analytics', category: 'analytics', loaded_before_consent: true },
    { id: 'fb_pixel', name: 'Facebook Pixel', category: 'advertising', loaded_before_consent: true }
  ],
  third_party_hosts: ['cdn.example.com', 'google-analytics.com', 'facebook.com'],
  network_requests_count: 245,
  score: 72,
  severity: 'high',
  summary: 'High-risk profile: 2 pre-consent trackers, 3rd-party analytics'
}
```

**T+5.2s:** Browser-Agent verarbeitet Result

```typescript
// Compute evidence hash
result.evidence_hash = await sha256(JSON.stringify(result))
// = "abc123def456... (64 hex chars)"

// Log: scan_complete
await logBrowserAction({
  tenant_id: 'workspace_123',
  session_id: 'task_abc123',
  browser_action: 'scan_complete',
  status: 'completed',
  url: 'https://example.com',
  started_at: '2026-08-03T12:00:00.600Z',
  completed_at: '2026-08-03T12:00:05.200Z',
  duration_ms: 4600,
  evidence_hash: 'abc123def456...',
  evidence_size_bytes: 4287,
  metadata: {
    risk_score: 3,
    systems_found: 0,
    trackers_found: 2
  }
})

// ↓ browser_actions table:
// {
//   id: 'log_xyz2',
//   tenant_id: 'workspace_123',
//   session_id: 'task_abc123',
//   browser_action: 'scan_complete',
//   status: 'completed',
//   evidence_hash: 'abc123def456...',
//   evidence_size_bytes: 4287,
//   duration_ms: 4600,
//   created_at: '2026-08-03T12:00:05.201Z'
// }
```

**T+5.3s:** Handler prüft auf Policy-Violations

```typescript
// Phase B: Policy Engine Integration
// Phase A: Nur simpler Risk-Score-Check

if (result.risk_score >= 4) {
  // Keine Policy Violations in Phase A, aber Handler würde proposeDecision()
  ctx.observe({
    category: 'governance_signal',
    severity: 'high',
    title: 'Policy violations detected',
    data: {
      violation_count: 2,
      violations: [
        {
          rule_id: 'rule_ga_no_dpa',
          policy_name: 'DSGVO § 6 (1)',
          severity: 'high',
          description: 'Google Analytics ohne Data Processing Agreement'
        },
        {
          rule_id: 'rule_fb_no_consent',
          policy_name: 'ePrivacy Directive',
          severity: 'high',
          description: 'Facebook Pixel loaded before consent'
        }
      ]
    }
  });

  // Hard Rule: KEIN auto-approval!
  ctx.propose({
    decision_title: 'Review 2 policy violations from browser scan',
    problem: 'Browser scan detected 2 governance rule violations at https://example.com',
    options: [
      { label: 'Review and remediate', ... },
      { label: 'Acknowledge risk and proceed', ... }
    ],
    recommendation: 'Review and remediate',
    risk_level: 'high',
    reversibility: 'reversible'
  });

  // ↓ agent_decisions table:
  // {
  //   id: 'dec_xyz',
  //   tenant_id: 'workspace_123',
  //   decision_title: 'Review 2 policy violations...',
  //   status: 'proposed',
  //   proposed_by: 'browser-agent',
  //   approved_by: null,  ← BLEIBT null bis Mensch approved
  //   created_at: '2026-08-03T12:00:05.300Z'
  // }
}
```

**T+5.4s:** Orchestrator speichert Handler-Output

```typescript
// HandlerResult von browser-agent:
{
  content: {
    url: 'https://example.com',
    scan_type: 'audit',
    systems_found: [],
    trackers_found: [
      { id: 'ga', name: 'Google Analytics', loaded_before_consent: true },
      { id: 'fb_pixel', name: 'Facebook Pixel', loaded_before_consent: true }
    ],
    risk_score: 3,
    policy_violations: [],  // Phase A: empty
    evidence_hash: 'abc123def456...'
  },
  self_confidence: 95,
  evidence: ['abc123def456...'],
  risk_dimensions: ['compliance', 'third_party_risk'],
  outcome: 'done'
}

// Orchestrator speichert in agent_outputs:
{
  id: 'out_xyz',
  tenant_id: 'workspace_123',
  task_id: 'task_abc123',
  agent: 'browser-agent',
  content: { ... },
  self_confidence: 95,
  evidence: ['abc123def456...'],
  risk_dimensions: ['compliance', 'third_party_risk'],
  produced_at: '2026-08-03T12:00:05.400Z'
}

// Orchestrator aktualisiert agent_tasks:
{
  id: 'task_abc123',
  status: 'done',  // open → in_progress → done
  output: { output_id: 'out_xyz', content: { ... } },
  completed_at: '2026-08-03T12:00:05.400Z'
}

// Und emittiert ag agent_events:
{
  id: 1234,  // BIGSERIAL
  tenant_id: 'workspace_123',
  event_type: 'task.completed',
  subject_type: 'task',
  subject_id: 'task_abc123',
  agent: 'browser-agent',
  payload: { outcome: 'done', evidence_count: 1 },
  created_at: '2026-08-03T12:00:05.400Z'
}
```

**T+5.5s:** Dashboard wird aktualisiert (via Supabase Realtime oder Webhook)

```
Dashboard erhält Event:
- Task Status: done ✅
- Risk Score: 3/5 (high)
- Trackers: 2 (pre-consent)
- Evidence Hash: abc123def456...
- Violations: Pending review (1 proposal)

User sieht:
┌─────────────────────────────────┐
│ Scan: https://example.com       │
├─────────────────────────────────┤
│ Status: ✅ Completed (4.6s)     │
│ Risk Level: 🟠 HIGH             │
│ Trackers Found: 2               │
│ Policies Violated: 2            │
│                                 │
│ [Review Violations] [Export]    │
└─────────────────────────────────┘
```

---

## Data Model: Entities & Relationships

### 1. Agent OS Substrate (7 Tabellen)

```sql
-- 1. agent_tasks (Queue)
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent TEXT NOT NULL,  -- 'browser-agent'
  task TEXT NOT NULL,
  input JSONB NOT NULL,  -- { url, scan_type, tenant_id, ... }
  output JSONB,  -- { output_id, content }
  status TEXT NOT NULL,  -- 'open' | 'in_progress' | 'done' | 'failed' | 'blocked'
  blocker_reason TEXT,
  priority TEXT,  -- 'low' | 'normal' | 'high' | 'critical'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 2. agent_outputs (Immutable)
CREATE TABLE agent_outputs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  agent TEXT NOT NULL,  -- 'browser-agent'
  content JSONB NOT NULL,  -- Scanner result, policy violations, etc.
  self_confidence INT,  -- 0-100
  evidence TEXT[] NOT NULL,  -- ['abc123def456...']
  risk_dimensions TEXT[] NOT NULL,  -- ['compliance', 'third_party_risk']
  produced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. agent_observations (Events)
CREATE TABLE agent_observations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent TEXT NOT NULL,  -- 'browser-agent'
  category TEXT NOT NULL,  -- 'browser_scan', 'governance_signal', 'error'
  severity TEXT NOT NULL,  -- 'info' | 'low' | 'medium' | 'high' | 'critical'
  title TEXT NOT NULL,
  detail TEXT,
  data JSONB NOT NULL,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. agent_decisions (Proposals, no auto-approval)
CREATE TABLE agent_decisions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  decision_title TEXT NOT NULL,
  problem TEXT NOT NULL,
  options JSONB NOT NULL,  -- [{ label, detail, pros, cons }]
  recommendation TEXT NOT NULL,
  reason TEXT NOT NULL,
  risk_level TEXT NOT NULL,  -- 'low' | 'medium' | 'high' | 'critical'
  reversibility TEXT NOT NULL,  -- 'reversible' | 'partially_reversible' | 'irreversible'
  status TEXT NOT NULL,  -- 'proposed' | 'approved' | 'rejected'
  proposed_by TEXT NOT NULL,  -- 'browser-agent'
  approved_by UUID,  -- ONLY set by explicit human action
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5-7. agent_memory, agent_inputs, agent_events
-- (siehe supabase/migrations/20260526000000_agent_os_substrate.sql)
```

### 2. Browser Observability (1 Tabelle)

```sql
CREATE TABLE browser_actions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,  -- task id
  browser_action TEXT NOT NULL,  -- 'scan_start' | 'scan_complete' | 'evidence_generate'
  status TEXT NOT NULL,  -- 'started' | 'completed' | 'failed' | 'blocked'
  url TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  evidence_hash TEXT,  -- SHA-256 hex (64 chars)
  evidence_size_bytes INT,
  error_message TEXT,
  error_code TEXT,
  metadata JSONB,  -- { scan_type, risk_score, systems_found, trackers_found }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices für schnelle Abfragen
CREATE INDEX idx_browser_actions_tenant_time 
  ON browser_actions (tenant_id, started_at DESC);
CREATE INDEX idx_browser_actions_evidence 
  ON browser_actions (evidence_hash) WHERE evidence_hash IS NOT NULL;
```

### 3. Relationships

```
                User (auth.users)
                      │
                      │
                      ▼
      Tenant (workspaces / customers)
        │
        ├─→ agent_tasks (N)
        │      │
        │      ├─→ agent_outputs (N)
        │      │      └─→ evidence[] (references browser_actions.evidence_hash)
        │      │
        │      └─→ agent_observations (N)
        │             └─→ data JSONB (e.g., violations)
        │
        ├─→ agent_decisions (N)
        │      └─→ approved_by FK to auth.users (NULL = waiting for approval)
        │
        └─→ browser_actions (N)
               └─→ evidence_hash (SHA-256 seed)
```

---

## Handler-Kontract: Ein TypScript-Beispiel

```typescript
// Types
interface HandlerContext {
  task: AgentTask;
  store: AgentOsStore;
  observe: (args: ObservationInput) => AgentObservation;
  propose: (args: DecisionProposalInput) => DecisionProposal;
}

interface HandlerResult {
  content: unknown;  // Frei wählbar (z.B. ScanResult)
  self_confidence?: number;  // 0-100
  evidence?: string[];  // Evidence hashes
  risk_dimensions?: string[];  // Risk tags
  outcome?: 'done' | 'blocked' | 'failed';
  reason?: string;  // For blocked/failed
}

// Browser-Agent Handler
export async function handleBrowserTask(ctx: HandlerContext): Promise<HandlerResult> {
  const input = ctx.task.input as BrowserAgentTaskInput;
  const sessionId = ctx.task.id;

  try {
    // 1. Validate & Log
    await logBrowserAction({ browser_action: 'scan_start', ... });

    // 2. Scan
    const result = await scanner.scan(input.url);

    // 3. Hash & Log Complete
    const hash = await sha256(JSON.stringify(result));
    await logBrowserAction({ browser_action: 'scan_complete', evidence_hash: hash, ... });

    // 4. Observe
    ctx.observe({
      category: 'browser_scan',
      severity: riskLevelToSeverity(result.risk_score),
      title: '...',
      data: { risk_score, trackers_count, ... }
    });

    // 5. Propose (if violations, never auto-approve)
    if (result.policy_violations.length > 0) {
      ctx.propose({
        decision_title: '...',
        problem: '...',
        options: [...],
        recommendation: '...',
        risk_level: '...',
        reversibility: 'reversible'
        // status: 'proposed' — stays proposed until human approves
      });
    }

    // 6. Return
    return {
      content: { url, trackers_found, risk_score, ... },
      self_confidence: 95,
      evidence: [hash],
      outcome: 'done'
    };
  } catch (err) {
    // Fail with audit trail (logged above)
    return { outcome: 'failed', reason: err.message };
  }
}
```

---

## Sequenz-Diagramm: Fehlerhafte Scan

```
User                 Dashboard                Orchestrator          Handler           Scanner       Logger
│                        │                         │                  │                │             │
├─ "Scan example.com"──→ │                         │                  │                │             │
│                        │                         │                  │                │             │
│                        ├─ Create Task ────────→ │                  │                │             │
│                        │ (status: open)         │                  │                │             │
│                        │                        │                  │                │             │
│                        │                        ├─ run(task) ──────→ │                │             │
│                        │                        │                  │                │             │
│                        │                        │                  ├─ validate ─────→ ✓            │
│                        │                        │                  │                │             │
│                        │                        │                  ├─ log scan_start ────────────→ │
│                        │                        │                  │                │             ├─ Insert browser_action
│                        │                        │                  │                │             │
│                        │                        │                  ├─ scan(url) ──→ │             │
│                        │                        │                  │              (Chromium      │
│                        │                        │                  │               crashed)      │
│                        │                        │                  │               ✗ TIMEOUT    │
│                        │                        │                  │                │             │
│                        │                        │                  ├─ log scan_failed ──────────→ │
│                        │                        │                  │ (error: TIMEOUT)            │
│                        │                        │                  │                │             ├─ Insert browser_action
│                        │                        │                  │                │             │   (status: failed)
│                        │                        │                  │                │             │
│                        │                        │←─ task: failed ────│                │             │
│                        │                        │ (blocker_reason)   │                │             │
│                        │                        │                    │                │             │
│                        │←─ Task Failed ─────────│                    │                │             │
│                        │ (Error Details)        │                    │                │             │
│                        │                        │                    │                │             │
│ ◄─ Error Message ──────│                        │                    │                │             │
│   (retry later)        │                        │                    │                │             │
```

---

## Sicherheits-Invarianten (Hard Rules)

### 1. Multi-Tenancy Isolation

- Jeder Datensatz hat `tenant_id`
- RLS Policies prüfen: `WHERE tenant_id = auth.uid().tenant_id`
- Browser-Agent liest `input.tenant_id` von Task (nicht vom User!)
- Logging speichert same `tenant_id` → Queries sind tenant-safe

```sql
-- RLS Beispiel
ALTER TABLE browser_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON browser_actions
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid())
  );
```

### 2. No Auto-Approval of Decisions

- `ctx.propose()` → `status: 'proposed'`
- RLS Policy verhindert Agent-Updates auf `status: 'approved'`
- Nur expliziter `UPDATE agent_decisions SET approved_by = user_id, status = 'approved'` durch:
  - Admin-Interface
  - Governance-Engine (später)
  - Nicht: Browser-Agent

```sql
-- RLS für Decisions
CREATE POLICY only_humans_approve ON agent_decisions
  FOR UPDATE USING (
    proposed_by != 'browser-agent'  -- Agents können nicht eigen approvals ändern
    OR status != 'proposed'           -- Nur wenn status nicht 'proposed'
  );
```

### 3. Immutable Evidence Chain

- `browser_actions` mit `evidence_hash` (SHA-256)
- Hash wird aus Scan-Ergebnis berechnet (nicht vom Handler)
- Falls Hash manipuliert: `SELECT * FROM browser_actions WHERE evidence_hash NOT IN (...valid hashes...)`
- Phase B: Hash-Chain mit Kryptographie

```typescript
// Nicht manipulierbar (Handler hat keinen Key zum Signieren)
const result = await scanner.scan(url);
const hash = await sha256(JSON.stringify(result));  // Nur Digestion, keine Signatur
// hash wird in evidence_hash gespeichert
// Später: Ed25519-Signatur mit Tenant-Key statt nur Hash
```

---

## Performance Charakteristiken

### Latency Breakdown (typisches Scan)

| Phase | Duration | Notes |
|-------|----------|-------|
| Task Creation | <50ms | GraphQL insert |
| Orchestrator.run() | <10ms | Load + lookup |
| Handler Init | <100ms | Client setup |
| Scanner.scan() | 2-5s | Headless Chromium |
| SHA-256 | <10ms | In-process |
| Logging | <500ms | HTTP POST × 2 |
| Data Serialization | <100ms | JSON + RLS |
| **Total** | **~3-6s** | P50 |

### Concurrency Model

- Playwright-Scanner: 10 concurrent (docker-compose limit)
- Orchestrator: Single-threaded (Phase A), scalable Phase B via NATS
- RLS Queries: Fast (indices on tenant_id + time)
- browser_actions Inserts: Batched via browser-action-log

### Scaling

```
Per Scanner Instance:
  - Throughput: 10 concurrent scans × (6s avg) = 10 scans / 60s = 0.17/sec
  - For 10 scans/sec: need 60 concurrent capacity = 6 instances

With Redis Rate-Limiting (Phase B):
  - Distributed queue + worker pool
  - Horizontal scaling: add more scanner instances
  - Backpressure: 429 when queue > threshold
```

---

## Testing Strategie

### Unit Tests
- Scanner Client: Mock HTTP responses
- Handler: Mock orchestrator store
- Types: Type safety checks

### Integration Tests
- Full workflow: Task → Scanner → Logger (mocked)
- Multi-tenant isolation
- Error paths

### E2E Tests (nach Deployment)
- Real playwright-scanner + Supabase
- Real edge function deployment
- RLS policy validation
- Evidence hash integrity

---

## Zusammenfassung

```
Browser-Agent ist ein Handler der Agent OS Orchestrator.

├─ Input: BrowserAgentTaskInput (URL + tenant_id)
├─ Process: Scanner → Log → Observe → Propose (no auto-approve)
└─ Output: BrowserScanResult + Evidence Hash

├─ Speichert in: browser_actions (logging)
│                agent_outputs (result)
│                agent_observations (events)
│                agent_decisions (proposals, no auto-approval)
│
└─ Erzeugt: agent_events (replay tape)

Sicherheits-Invarianten:
  ✓ Multi-tenancy via tenant_id + RLS
  ✓ Evidence hash (SHA-256) für Integrität
  ✓ Keine Auto-Approval von Policy-Violations
  ✓ Graceful error handling mit audit trail

Phase A (Now):      Risk-scoring + simple violation detection
Phase B (4-6 weeks): Policy engine + consent timing + scheduled scans
```
