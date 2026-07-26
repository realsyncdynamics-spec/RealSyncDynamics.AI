# Agent Contract Specification (ACS) v1.0

**Single Source of Truth** für die formale Definition von KI-Agenten in RealSyncDynamics.AI.

**Status:** 🟡 DRAFT  
**Version:** 1.0-beta  
**Last Updated:** 2026-07-20  
**Author:** Claude Code (PHASE 2 Audit)  
**Scope:** Governance Agents, Enterprise Agents, Automation Agents

---

## 1. Überblick

Ein **Agent Contract** ist eine formale, versionierte Spezifikation, die definiert:
- **Was** ein Agent tut (Ziele, Skills)
- **Wer** ihn nutzen darf (Berechtigungen, Tenant-Scope)
- **Wie** er arbeitet (Execution Model, Approval Gates)
- **Welche Kosten** entstehen (Token Budget, Metering)
- **Welche Garantien** er gibt (Determinism, Audit Trail)

Ein Agent ohne Contract ist **nicht produktiv**.

---

## 2. Agent Contract – Formale Struktur

```typescript
// Canonical ACS Structure (TypeScript/JSON-serializable)

interface AgentContract {
  // Identity & Versioning
  id: string;                           // agent-id-slug (immutable)
  version: string;                      // semver (major.minor.patch)
  name: string;                         // Human-readable name
  description: string;                  // Purpose & scope
  
  // Ownership & Classification
  owner_tenant_id?: string;             // null = platform-owned
  agent_type: 'governance' | 'automation' | 'enterprise' | 'custom';
  status: 'draft' | 'active' | 'deprecated' | 'retired';
  
  // Goals & Capabilities
  goals: AgentGoal[];                   // Primary objectives (ordered by priority)
  capabilities: AgentCapability[];      // What this agent can do (skills)
  
  // Execution Model
  execution_model: {
    mode: 'synchronous' | 'asynchronous';
    max_iterations: number;             // Default: 8 (prevent runaway loops)
    max_tokens_per_turn: number;        // LLM output cap
    max_execution_time_seconds: number; // Timeout
    deterministic: boolean;             // True = same input → same output
  };
  
  // Authorization & Scope
  permissions: AgentPermission[];       // What APIs/tools this agent can call
  tenant_scope: 'single' | 'multi' | 'platform';  // Isolation level
  required_approval_gates: ApprovalGateRule[];    // Human-in-the-loop rules
  
  // Cost & Metering
  cost_model: {
    llm_provider: 'anthropic' | 'ollama' | 'mistral' | 'google';
    llm_model_id: string;               // e.g., 'claude-sonnet-4-6'
    cost_per_token_input: number;       // USD per 1M tokens
    cost_per_token_output: number;      // USD per 1M tokens
    estimated_cost_per_run: number;     // Historical average
    monthly_budget?: number;            // Tenant quota (null = unlimited)
  };
  
  // Compliance & Audit
  compliance: {
    audit_required: boolean;
    evidence_retention_days: number;    // How long to keep logs
    pii_handling: 'strict' | 'masked' | 'allowed';
    determinism_validated: boolean;
    external_audit?: string;            // e.g., "SOC2", "ISO27001"
  };
  
  // Tool Dependencies
  required_tools: ToolDependency[];     // Which tools this agent needs
  
  // Metadata
  tags: string[];                       // For discovery & filtering
  created_at: string;                   // ISO 8601
  created_by: string;                   // user_id
  deprecated_at?: string;               // If deprecated
  deprecation_message?: string;
}

interface AgentGoal {
  id: string;                           // goal-slug
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  success_metric?: string;              // How to measure success
}

interface AgentCapability {
  id: string;                           // capability-slug (e.g., "audit-scan")
  name: string;
  description: string;
  required_tools: string[];             // Tool IDs (references ToolDependency)
  tags: string[];
}

interface AgentPermission {
  resource: string;                     // 'database' | 'api' | 'webhook' | 'file'
  action: 'read' | 'write' | 'delete' | 'execute';
  scope: string;                        // e.g., 'tenant_data', 'governance_rules', 'audit_logs'
  conditions?: Record<string, unknown>; // e.g., { "tenant_id": "$(tenant_id)" }
}

interface ApprovalGateRule {
  trigger: string;                      // e.g., 'production_change', 'data_access'
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  approvers: string[];                  // role slugs: 'admin', 'compliance_officer', etc.
  timeout_minutes: number;
  auto_reject_if_expired: boolean;
}

interface ToolDependency {
  tool_id: string;                      // Canonical tool identifier
  version: string;                      // Minimum version required (semver)
  required: boolean;                    // true = must be available, false = optional fallback
}
```

---

## 3. Contract Registry & Persistence

### Database Schema
```sql
-- Contracts sind versioniert & immutable
create table public.agent_contracts (
  id              text primary key,     -- agent-id-slug
  version         text not null,        -- semver
  contract_json   jsonb not null,       -- Full ACS as JSONB
  owner_tenant_id uuid references public.tenants(id),
  status          text not null check (status in ('draft', 'active', 'deprecated', 'retired')),
  
  -- Audit
  created_at      timestamptz default now(),
  created_by      uuid references auth.users(id),
  published_at    timestamptz,          -- null until 'active'
  deprecated_at   timestamptz,
  
  unique(id, version)
);

-- Query active contracts by type
create index agent_contracts_type_status_idx 
  on public.agent_contracts (contract_json->>'agent_type', status)
  where status = 'active';

-- RLS: Platform-owned agents (no tenant) visible to all; tenant-owned agents only to tenant members
alter table public.agent_contracts enable row level security;

create policy agent_contracts_select on public.agent_contracts
  for select
  using (
    owner_tenant_id is null                    -- Platform agent
    or public.is_tenant_member(owner_tenant_id) -- Tenant member
  );
```

### API Endpoints
```
GET  /functions/v1/agent-contracts?type=governance&status=active
     → List active governance contracts

GET  /functions/v1/agent-contracts/{agent-id}/{version}
     → Fetch specific contract version

POST /functions/v1/agent-contracts
     → Submit new contract (draft) — requires admin

PATCH /functions/v1/agent-contracts/{agent-id}/{version}
     → Update contract (only drafts) — requires owner

POST /functions/v1/agent-contracts/{agent-id}/{version}/publish
     → Publish contract from draft → active
```

---

## 4. Contract Lifecycle

```
┌─────────┐
│  DRAFT  │  Initial state, can be edited freely
└────┬────┘
     │
     │ publish() [admin approval]
     ▼
┌─────────────────────────────────────────┐
│            ACTIVE                       │
│ • Live for agent execution              │
│ • Immutable (contract.json is locked)   │
│ • Used for tool dispatch, approvals     │
│ • Telemetry tagged with version         │
└────┬────────────────────────────────────┘
     │
     │ deprecate() [plan → migrate users]
     ▼
┌──────────────┐
│  DEPRECATED  │  Still runs, but flagged for migration
│              │  (Sunset deadline set)
└────┬─────────┘
     │
     │ [deadline reached] retire()
     ▼
┌─────────┐
│ RETIRED │  No longer executable, archived
└─────────┘
```

### Versioning Rules
- **Major version** (X.0.0): Breaking changes (new required tools, new approval gates, capability removals)
- **Minor version** (0.X.0): Non-breaking enhancements (new capabilities, new optional tools, capability additions)
- **Patch version** (0.0.X): Bug fixes, metadata updates (description, tags)

**Backwards Compatibility Promise:**
- Active contracts are immutable
- If you need to change an active contract, publish a new minor/major version
- Old versions remain queryable for audit

---

## 5. Validation & Certification

### Contract Validation Rules
Every published contract must pass:

1. **Schema Validation** (Zod/JSON Schema)
   - All required fields present
   - Types match specification
   - No extra fields (strict mode)

2. **Tool Dependency Resolution**
   - All referenced tools exist in Tool Registry
   - Versions are available
   - No circular dependencies

3. **Permission Closure**
   - Every tool in `capabilities` has matching `permissions`
   - No orphaned permissions
   - Scope is well-defined (not wildcard)

4. **Approval Gate Validity**
   - All approver roles exist in tenant RBAC
   - Timeout is reasonable (1 min – 7 days)

5. **Cost Model Sanity**
   - LLM model exists & is available to tenant
   - Cost per token is positive
   - Monthly budget (if set) exceeds estimated cost per run

6. **Determinism Attestation** (if `deterministic: true`)
   - Agent code uses only deterministic tools
   - No randomness, no real-time clock
   - No external API calls with non-deterministic response
   - Must pass determinism test suite (see §8)

### Validation Endpoints
```
POST /functions/v1/agent-contracts/validate
     Body: { contract: AgentContract }
     Response: { valid: boolean, errors: ValidationError[] }

POST /functions/v1/agent-contracts/{agent-id}/{version}/certify
     → Mark as determinism-certified (requires test suite pass)
```

---

## 6. Runtime Contract Binding

When an agent is **executed**, the runtime must:

1. **Resolve Contract**
   ```typescript
   const contract = await fetchContract(agentId, versionHint?);
   // versionHint: 'latest-active' (default), 'latest', or explicit '1.2.3'
   ```

2. **Verify Tenant Access**
   ```typescript
   if (contract.owner_tenant_id && contract.owner_tenant_id !== userTenantId) {
     throw new AccessDeniedError('Agent not available in your tenant');
   }
   ```

3. **Check Quotas**
   ```typescript
   const monthlySpent = await getAgentSpendThisMonth(agentId, tenantId);
   if (monthlySpent + contract.cost_model.estimated_cost_per_run > contract.cost_model.monthly_budget) {
     throw new QuotaExceededError('Monthly budget exhausted');
   }
   ```

4. **Enforce Approval Gates** (if any triggered)
   ```typescript
   const gate = contract.required_approval_gates.find(g => g.trigger === 'production_change');
   if (gate) {
     await createApprovalRequest({
       agent_id: agentId,
       risk_level: gate.risk_level,
       approvers: gate.approvers,
       timeout: gate.timeout_minutes,
     });
   }
   ```

5. **Scope Tool Access**
   ```typescript
   const allowedTools = contract.capabilities.flatMap(c => c.required_tools);
   // Tool dispatch rejects any tool not in allowedTools
   ```

6. **Tag Telemetry**
   ```typescript
   const trace = {
     agent_id: contract.id,
     agent_version: contract.version,
     tenant_id: tenantId,
     cost_estimated: contract.cost_model.estimated_cost_per_run,
     deterministic: contract.execution_model.deterministic,
     // ... other fields
   };
   ```

---

## 7. Existing Agents – Contract Mapping

### governance-agent
```typescript
const governanceAgentContract: AgentContract = {
  id: 'governance-agent',
  version: '1.0.0',
  name: 'Governance Agent',
  description: 'Conversational compliance assistant (DSGVO, EU AI Act)',
  owner_tenant_id: null,
  agent_type: 'governance',
  status: 'active',
  
  goals: [
    {
      id: 'policy-scan',
      title: 'Policy Compliance Scanning',
      description: 'Detect compliance risks (DSGVO, AI-Act)',
      priority: 'critical',
    },
    {
      id: 'remediation',
      title: 'Remediation Suggestions',
      description: 'Suggest fixes for detected risks',
      priority: 'high',
    },
  ],
  
  capabilities: [
    {
      id: 'dpia-run',
      name: 'Run DPIA',
      description: 'Initiate Data Protection Impact Assessment',
      required_tools: ['governance_run_dpia'],
    },
    {
      id: 'vendor-check',
      name: 'Vendor Lookup',
      description: 'Query vendor / sub-processor inventory',
      required_tools: ['governance_check_vendor'],
    },
    // ... more
  ],
  
  execution_model: {
    mode: 'synchronous',
    max_iterations: 8,
    max_tokens_per_turn: 1500,
    max_execution_time_seconds: 60,
    deterministic: false,
  },
  
  permissions: [
    { resource: 'database', action: 'read', scope: 'tenant_data' },
    { resource: 'database', action: 'write', scope: 'governance_events' },
    { resource: 'api', action: 'execute', scope: 'governance_tools' },
  ],
  
  tenant_scope: 'multi',
  required_approval_gates: [],
  
  cost_model: {
    llm_provider: 'anthropic',
    llm_model_id: 'claude-sonnet-4-6',
    cost_per_token_input: 0.003,
    cost_per_token_output: 0.015,
    estimated_cost_per_run: 0.05,
    monthly_budget: null,
  },
  
  compliance: {
    audit_required: true,
    evidence_retention_days: 2555, // 7 years
    pii_handling: 'masked',
    determinism_validated: false,
  },
  
  required_tools: [
    { tool_id: 'governance_resource_inventory', version: '>=1.0.0', required: true },
    { tool_id: 'governance_run_dpia', version: '>=1.0.0', required: true },
    // ... more
  ],
  
  tags: ['compliance', 'dsgvo', 'ai-act', 'governance'],
  created_at: '2026-06-15T00:00:00Z',
  created_by: 'claude-system',
};
```

### agent-os-runner
```typescript
const agentOsRunnerContract: AgentContract = {
  id: 'agent-os-runner',
  version: '0.1.0',
  name: 'Agent OS Runner (MVP)',
  description: 'Centralized executor for registered agents (Policy + Registry)',
  owner_tenant_id: null,
  agent_type: 'automation',
  status: 'active',
  
  goals: [
    {
      id: 'execute-agents',
      title: 'Execute Agents',
      description: 'Run registered agents with policy enforcement',
      priority: 'critical',
    },
  ],
  
  capabilities: [
    {
      id: 'run-governance-agent',
      name: 'Run Governance Agent',
      required_tools: ['governance_agent'],
    },
    // ... more
  ],
  
  execution_model: {
    mode: 'asynchronous',
    max_iterations: 1,     // No chaining
    max_tokens_per_turn: 256,
    max_execution_time_seconds: 30,
    deterministic: true,   // Only dispatches, no inference
  },
  
  permissions: [
    { resource: 'api', action: 'execute', scope: 'agent_dispatch' },
    { resource: 'database', action: 'read', scope: 'agent_registry' },
    { resource: 'database', action: 'write', scope: 'agent_runs' },
  ],
  
  tenant_scope: 'multi',
  required_approval_gates: [
    {
      trigger: 'production_change',
      risk_level: 'high',
      approvers: ['admin'],
      timeout_minutes: 60,
      auto_reject_if_expired: true,
    },
  ],
  
  cost_model: {
    llm_provider: 'anthropic',
    llm_model_id: 'claude-haiku-4-5',
    cost_per_token_input: 0.00008,
    cost_per_token_output: 0.0004,
    estimated_cost_per_run: 0.001,
    monthly_budget: null,
  },
  
  compliance: {
    audit_required: true,
    evidence_retention_days: 2555,
    pii_handling: 'strict',
    determinism_validated: true,
  },
  
  required_tools: [
    { tool_id: 'governance_agent', version: '>=1.0.0', required: false },
    { tool_id: 'enterprise_ai_os_agents_list', version: '>=1.0.0', required: true },
  ],
  
  tags: ['automation', 'runtime', 'executor'],
  created_at: '2026-06-16T00:00:00Z',
  created_by: 'claude-system',
};
```

---

## 8. Determinism Validation & Certification

### What is Deterministic?
An agent is **deterministic** if: **same input → same output, every time** (across runs, versions, time zones).

**Deterministic agents:**
- ✅ Governance-agent with frozen rule engine (no ML)
- ✅ agent-os-runner (pure dispatch logic)
- ✅ Policy evaluation (Rego/OPA rules)

**Non-deterministic agents:**
- ❌ Agents using LLM inference (always has probability)
- ❌ Agents calling real-time APIs (weather, stock prices)
- ❌ Agents with non-deterministic RNG

### Determinism Test Suite
```typescript
interface DeterminismTest {
  agent_id: string;
  version: string;
  test_inputs: InputVariant[];  // Same logical input, multiple forms
  expected_output: unknown;     // Canonical output
  tolerance: {
    exact_match: boolean;       // true = byte-for-byte, false = semantic equiv
    semantic_validator?: (output: unknown) => boolean;
  };
  passed: boolean;
  evidence_hash: string;        // SHA256 of test run
}
```

When publishing a contract with `deterministic: true`:
1. Run full determinism test suite
2. Record test results in `audit_determinism_tests` table
3. Generate evidence hash (signed with C2PA)
4. Tag contract as "determinism-certified"

---

## 9. Migration Path: Existing Agents → Contracts

### Step 1: Audit Existing Agents
Inventory all agents (governance-agent, enterprise-ai-os-agents-run, etc.) and map to ACS.

### Step 2: Draft Contracts
Create `draft` contracts for each agent (from current state).

### Step 3: Validation & Testing
- Pass schema validation
- Resolve tool dependencies
- Run determinism tests (if applicable)

### Step 4: Publishing
Move contracts from `draft` → `active` (one per agent).

### Step 5: Runtime Integration
Update `apps/agent-runtime` & Edge Functions to resolve & bind contracts.

**Timeline:** Phases 2–3 (2-3 weeks)

---

## 10. Integration with Existing Systems

### With apps/agent-runtime
```typescript
// Gateway receives run request
const runRequest = {
  tenant_id: '...',
  agent_id: 'governance-agent',
  input: { ... }
};

// Resolve contract
const contract = await fetchContract(runRequest.agent_id);

// Policy Engine uses contract
const decision = await policyEngine.evaluate({
  agent_contract: contract,
  requested_action: 'run',
  tenant_id: runRequest.tenant_id,
});

if (decision.approved) {
  // Execute agent with contract-scoped permissions
  await executeAgent(contract, runRequest);
}
```

### With Edge Functions (governance-agent)
```typescript
// Edge Function receives chat request
export async function handler(req: Request) {
  const body = await req.json();
  
  // Resolve contract (cached)
  const contract = await getAgentContract('governance-agent');
  
  // Check compliance
  if (!contract.status === 'active') {
    return new Response('Agent retired', { status: 410 });
  }
  
  // Enforce max iterations
  const maxIterations = contract.execution_model.max_iterations;
  
  // Tag telemetry
  const trace = {
    agent_id: contract.id,
    agent_version: contract.version,
    // ...
  };
  
  // Run tool-use loop with contract-scoped permissions
  return runAgentLoop(contract, body, trace);
}
```

### With Evidence Vault
Every agent run is tagged with contract version:
```sql
select
  agent_run_id,
  agent_id,
  agent_contract_version,  -- NEW
  input_hash,
  output_hash,
  created_at
from public.agent_runs
where agent_id = 'governance-agent'
  and agent_contract_version = '1.0.0';
```

---

## 11. FAQ & Gotchas

### Q: What if I need to run an old agent version?
**A:** Query the contract registry with explicit version:
```
GET /agent-contracts/governance-agent/1.0.0
```
The runtime will bind to that exact version. Audit trail will record it.

### Q: Can I override a contract at runtime?
**A:** **No.** Contracts are immutable once published. If you need different behavior:
1. Create a new minor/major version
2. Publish it
3. Update callers to reference new version

This ensures audit trail integrity.

### Q: What if my agent uses multiple LLMs?
**A:** Define the primary LLM in `cost_model`. For fallbacks, document in `description` or create separate capability sections.

### Q: How do I deprecate an agent?
**A:** 
1. Set `status: 'deprecated'` on current version
2. Set `deprecated_at: ISO8601` + `deprecation_message`
3. Publish a new version with `agent_type: 'deprecated'` (optional)
4. Give users 30–90 days notice
5. Retire (set `status: 'retired'`) after sunset

### Q: Does every agent need a contract?
**A:** **Yes, in production.** Non-contracted agents can run in `development` mode only.

---

## 12. Governance Spec Roadmap

| Document | Status | Phase |
|----------|--------|-------|
| Agent Contract Spec (ACS) | 🟡 DRAFT | 2 |
| Event Schema Standard (ESS) | 🔴 PENDING | 2 |
| Runtime Contract Spec (RCS) | 🔴 PENDING | 2 |
| Tool Definition Schema (TDS) | 🔴 PENDING | 4 |
| Approval Gate Lifecycle | 🔴 PENDING | 6 |
| Evidence Hash-Chain Formal | 🔴 PENDING | 8 |

---

## Sign-Off

| Aspect | Status |
|--------|--------|
| **Formalism** | ✅ Typed, versionable, immutable |
| **Backwards Compat** | ✅ Semver + graceful deprecation |
| **Audit Trail** | ✅ Contract version tagged on every run |
| **Compliance** | ✅ Determinism attestation, PII handling |
| **Integration** | 🟡 Ready for Phase 2 implementation |

**Next:** Implement ACS in Supabase schema + apps/agent-runtime + Edge Functions.
