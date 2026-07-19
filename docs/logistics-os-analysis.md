# RealSync Logistics OS — Architektur-Analyse & Integrationsplan

**Datum:** 2026-07-19  
**Status:** Phase 1 Abgeschlossen — Bereit für Phase 2 (Database Schema)  
**Autor:** Claude AI Systems Architect  

---

## 1. EXECUTIVE SUMMARY

Das RealSync Logistics OS wird als neues **Governance-Native Modul** in die bestehende RealSyncDynamics AI Plattform integriert. Es wird NICHT als separates Produkt entwickelt, sondern nutzt alle bestehenden:

- **Governance Runtime** (Sentinel-Loop, SLO-Tracking)
- **Evidence Layer** (Hash-Chain, Compliance-Hold)
- **Policy Engine** (Deklarative Regeln, Versionierung)
- **AI Agent Infrastruktur** (Claude 3.5 Sonnet + Anthropic SDK)
- **Auth & Multi-Tenancy** (RLS-hardened Supabase)
- **Analytics & Monitoring** (Sentry, Realtime Subscriptions)

Das Modul wird direkt in die bestehende Architektur integriert — keine neuen Cloud-Abhängigkeiten, keine Monorepo-Erweiterungen nötig.

---

## 2. BESTEHENDE ARCHITEKTUR

### 2.1 Frontend-Struktur (src/)

```
src/
├── pages/                 # 104 öffentliche + geschützte Seiten
│   ├── MainLanding.tsx   # ✅ DESIGN-LOCKED
│   ├── Governance*.tsx   # Runtime, Docs, Score, Browser, Onboarding
│   ├── Audit*.tsx        # Landing, Results, Share
│   └── ...103 weitere
│
├── features/              # 42 Auth-gated Feature-Module
│   ├── governance/       # Governance Runtime Dashboard
│   ├── audit/            # Audit Module (95% complete)
│   ├── evidence-vault/   # Evidence Storage & Retrieval
│   ├── analytics/        # Governance Analytics
│   ├── billing/          # Stripe Integration
│   ├── integrations/     # Connectors (Shopify, Salesforce, etc)
│   └── ...37 weitere
│
├── components/            # Shared UI Components (Hard-Edge Industrial Design)
├── config/               # Single Source of Truth
│   ├── pricing.ts       # PUBLIC_PRICING_TIERS
│   ├── seo.ts           # Metadata
│   └── ...
│
├── lib/                  # Utilities
│   ├── sdk/             # Supabase Client
│   ├── auth/            # Authentication Hooks
│   ├── api/             # API Integration
│   └── ...
│
├── core/                # Core Providers
│   ├── TenantProvider   # Workspace Context
│   ├── AuthProvider     # Session Management
│   └── ...
│
├── runtime/             # Agent Integration
│   ├── agents/          # Agent Definitions
│   └── telemetry/       # Event Tracking
│
└── types/               # TypeScript Definitions
```

**Key Points:**
- ✅ 100+ Pages bereits implementiert
- ✅ Hard-Edge Industrial UI (Obsidian #0A0A0B, Titanium #E2E2E2, Security-Blue #0052FF)
- ✅ Lazy-loading für Protected Routes
- ✅ Centralized Config Pattern (Single Source of Truth)

---

### 2.2 Backend-Struktur

#### Edge Functions (supabase/functions/ — 164 Funktionen)

**Governance Core (10 Functions):**
```
governance-agent           # Main orchestrator for governance decisions
governance-approvals       # Approval workflow engine
governance-dpias          # Data Protection Impact Assessment
governance-dsr            # Data Subject Request handler
governance-ingest         # Evidence ingestion
governance-incidents      # Incident dispatch & response
governance-connectors     # External data connectors
governance-vendors        # Third-party vendor management
governance-keys           # Cryptographic key operations
governance-risk-score     # Risk calculation engine
```

**Evidence & Provenance (3 Functions):**
```
evidence-vault            # CRUD for evidence storage
evidence-export           # PDF/JSON export with verification
provenance                # C2PA Ed25519 signing & custody capture
```

**Policy Engine (1 Function):**
```
policy-packs             # Auto-recommendation by tenant industry
```

**Runtime & Automation (20+ Functions):**
```
agent-os-runner          # Agent execution loop
governance-monitoring-scheduler
audit-monitor-cron       # Weekly audit rechecks
automation-trigger       # n8n webhook handler
webhook                  # Generic webhook delivery
```

**Deployment (165 total functions):**
- All Edge Functions run in **Deno V8** runtime
- **Service-Role Keys ONLY** in Edge Functions (never in client)
- Deployment: automatic on push to main branch
- Local testing: `supabase functions serve`

#### Backend Services (services/)

```
services/
├── realsync-runtime-core/       # Core orchestration service
├── realsync-evidence-runtime/   # Evidence processing engine
├── openclaw-agent/              # OpenAI-compatible agent bridge
└── playwright-scanner/          # Headless browser scanning
```

---

### 2.3 Database-Architektur (Supabase PostgreSQL 16)

**25 RLS-Protected Tables:**

#### Registry Tables
```sql
ai_systems          -- Registered AI models, agents
tenants             -- Workspace isolation
profiles            -- User profiles
```

#### Governance Core
```sql
ai_policies         -- Policy definitions (versioned)
policy_packs        -- Industry-specific policy bundles
governance_controls -- Control mappings
governance_approvals -- Approval workflow state
governance_webhooks -- Webhook subscriptions
governance_incidents -- Incident records
```

#### Evidence Stream
```sql
ai_evidence_events  -- Immutable evidence log
audit_jobs          -- Audit execution state
audit_evidence      -- Audit-specific evidence
evidence_retention  -- Compliance hold metadata
```

#### Integration & Operations
```sql
workflow_runs       -- n8n workflow executions
ai_tool_runs        -- Audit-logged API calls
connectors          -- Integration configurations
vendors             -- Third-party management
dpias               -- DPIA storage
dsr_tracker         -- Data Subject Request tracking
incidents           -- Operational incidents
operations_inventory -- Asset registry
enterprise_agent_runs -- Agent execution history
```

**RLS-Policy Pattern:**
```sql
-- Tenant isolation on all app tables
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON public.table_name
  FOR ALL
  USING (tenant_id = auth.uid() → tenants.id)
  WITH CHECK (tenant_id = auth.uid() → tenants.id);

-- Service-Role bypass in Edge Functions
-- Client-side queries are automatically filtered
```

---

### 2.4 AI & Agent Infrastruktur

**Multi-Model Support:**
```typescript
// From CLAUDE.md
- Anthropic SDK 0.32.1 → Claude 3.5 Sonnet (PRIMARY)
- Google GenAI 1.29.0 → Gemini (SECONDARY)
- OpenAI 4.77.0 → GPT-4 (FALLBACK)
- Ollama gemma3:4b + qwen3 (EU-LOCAL, OFFLINE)
```

**Current Agents:**
1. **governance-agent** — Core decision-making & recommendations
2. **governance-connectors** — External data integration
3. **governance-incidents** — Incident response & escalation
4. **audit-monitor-cron** — Scheduled compliance checks
5. Custom agents in `src/runtime/agents/`

**Agent Pattern:**
```typescript
// Workflow: Input → AI Recommendation → Policy Validation → Evidence Logging
1. Input: Order data, constraints, context
2. Agent Processing: Claude evaluates options
3. Policy Engine Validation: Constraints checked
4. Human Override Gate: Optional manual intervention
5. Evidence Logging: Decision + reasoning recorded
6. Execution: Action taken
```

---

### 2.5 Auth & Multi-Tenancy

**Authentication Flow:**
```
1. Public sign-up → Supabase Auth (Email/Password or OAuth)
2. Session storage → localStorage (validated on app load)
3. Protected routes → ProtectedRoute or RequireAal2 wrapper
4. Service-Role operations → Edge Functions ONLY
```

**Multi-Tenant Isolation:**
```typescript
// Hooks
useAuth()      → { id, email, tenantId }
useTenant()    → { id, name, plan, members }

// Context Providers
<TenantProvider>        -- Wraps protected routes
<AuthProvider>          -- Session + user context
<DemoModeProvider>      -- Demo workspace support

// Data Access
All queries automatically filtered by tenant_id via RLS
No manual WHERE tenant_id checks needed (policy enforced)
```

---

### 2.6 Governance Runtime

**Sentinel-Loop Pattern:**
```typescript
Loop Interval: Configurable (default 5 minutes)
1. Fetch pending decisions
2. Evaluate against current policies
3. Calculate SLO adherence
4. Auto-escalate if threshold breached
5. Log evidence
6. Dispatch notifications
```

**SLO Tracking:**
```
- Critical decisions: < 1 hour
- Standard decisions: < 4 hours
- Routine compliance checks: < 24 hours
```

---

### 2.7 Evidence Layer

**Evidence Event Structure:**
```typescript
interface EvidenceEvent {
  id: UUID
  tenant_id: UUID
  event_type: 'decision' | 'audit' | 'approval' | 'compliance_check'
  entity_id: string        // The record this event relates to
  actor_id: UUID          // User or Agent ID
  model_version: string   // AI model used (e.g., claude-3.5-sonnet)
  policy_version: string  // Policy bundle version
  input_hash: string      // SHA-256 of inputs (immutable)
  output_hash: string     // SHA-256 of decision
  reasoning: JSONB        // Full reasoning trail
  timestamp: TIMESTAMP    // ISO 8601
  verified_at?: TIMESTAMP // C2PA verification timestamp
  custodian_chain: UUID[] // Chain of custody
}
```

**Hash Chain Verification:**
```
Evidence immutability via PostgreSQL IMMUTABLE UNIQUE CONSTRAINT
Previous hash → included in next event's reasoning
External verification via C2PA manifest
```

---

### 2.8 Policy Engine

**Policy Structure:**
```typescript
interface Policy {
  id: UUID
  tenant_id: UUID
  name: string
  version: number
  policy_type: 'compliance' | 'operational' | 'custom'
  rules: Rule[]
  created_at: TIMESTAMP
  created_by: UUID
  change_reason: string
}

interface Rule {
  name: string
  condition: string         // e.g., "driving_hours > 12"
  action: 'reject' | 'warn' | 'score_penalty'
  severity: 'critical' | 'high' | 'medium' | 'low'
}
```

**Deklarative Rule Evaluation:**
```typescript
// Engine evaluates rules in order
// First matching rule determines action
// All evaluations logged as evidence
```

---

## 3. LOGISTICS OS INTEGRATIONSPUNKTE

### 3.1 Routing Through Governance Runtime

```
┌─────────────────────┐
│  Logistics Input    │
│  (Orders, Vehicles) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│   Governance Runtime Sentinel Loop      │
│  (Existing infrastructure)              │
└──────────┬──────────────────────────────┘
           │
           ├─▶ Order Intelligence Agent
           ├─▶ Routing Optimization Agent
           ├─▶ ETA Prediction Agent
           ├─▶ Risk Assessment Agent
           ├─▶ Dispatch Decision Agent
           │
           ▼
┌─────────────────────────────────────────┐
│   Policy Engine Validation              │
│  (Constraint checking)                  │
│  - Vehicle capacity                     │
│  - Driver time regulations              │
│  - SLA requirements                     │
│  - CO2 budgets                          │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│   Human Override Opportunity            │
│  (UI component)                         │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│   Evidence Logging                      │
│  (Hash chain + C2PA signing)            │
│  - Decision ID                          │
│  - Agent reasoning                      │
│  - Policy evaluation                    │
│  - Human override (if any)              │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│   Execution & Monitoring                │
│  (Route dispatch, ETA tracking)         │
└─────────────────────────────────────────┘
```

---

### 3.2 Database Schema Integration

**New Tables (additive only):**
```sql
-- Logistics core
logistics_orders            -- Order records (tenant_id RLS)
logistics_routes            -- Optimized routes
logistics_vehicles          -- Vehicle registry
logistics_constraints       -- Deklarative constraint rules
logistics_decisions         -- Routing decisions with reasoning
logistics_decision_variants -- Alternative routes considered

-- Monitoring & Analytics
logistics_events            -- Real-time tracking events
logistics_eta_predictions   -- ETA model performance
logistics_overrides         -- Human interventions logged

-- Risk & Compliance
logistics_risk_assessments  -- Risk scores per decision
logistics_compliance_violations -- SLA/regulatory breaches
```

**All tables inherit:**
- ✅ RLS enforcement (tenant_id filtering)
- ✅ Audit logging (ai_tool_runs)
- ✅ C2PA integration
- ✅ Immutable evidence chain

---

### 3.3 API Integration

**New Endpoints (REST via Edge Functions):**
```
POST   /api/logistics/orders
       Create order for optimization

POST   /api/logistics/routes/optimize
       Trigger routing algorithm

GET    /api/logistics/routes/{id}
       Fetch route with decision reasoning

GET    /api/logistics/decisions/{id}
       View decision + alternatives + constraints

POST   /api/logistics/routes/{id}/override
       Human override (logged as evidence)

GET    /api/logistics/audit/{id}
       Full evidence trail for decision

GET    /api/logistics/analytics
       KPIs: SLA compliance, CO2 impact, cost
```

**Integration with Existing APIs:**
```
- Evidence API (evidence-vault)     → Auto-log all decisions
- Policy API (policy-packs)         → Evaluate constraints
- Analytics API (governance-analytics) → KPI calculation
- Webhook API (governance-webhooks) → Send notifications
- AI invoke (ai-invoke)             → Agent calling
```

---

### 3.4 Agent Integration

**New Agents (via governance-agent orchestrator):**

```typescript
// Route decision flow
class RoutingAgent extends GovernanceAgent {
  async recommend(orders, vehicles, constraints) {
    // 1. Fetch current policies
    const policies = await this.policyEngine.get();
    
    // 2. Call OR-Tools solver
    const routes = await this.solve(orders, vehicles);
    
    // 3. Score each route
    const scored = await this.evaluateAgainstPolicies(routes, policies);
    
    // 4. Return recommendation with alternatives
    return {
      primary: scored[0],
      alternatives: scored.slice(1, 4),
      reasoning: this.explainDecision(scored[0])
    };
  }
}
```

**Agents will use:**
- ✅ Claude 3.5 Sonnet (primary reasoning)
- ✅ Local Ollama (for fast scoring/classification)
- ✅ Existing evidence infrastructure (auto-logging)
- ✅ Policy engine (constraint evaluation)

---

### 3.5 UI Integration

**New Routes (under /app/logistics):**
```
/app/logistics/dashboard        # Overview, KPIs
/app/logistics/orders           # Order management
/app/logistics/routes           # Route optimization UI
/app/logistics/routes/{id}      # Route detail + explainability
/app/logistics/decisions        # Decision history
/app/logistics/decisions/{id}   # Single decision with full audit
/app/logistics/overrides        # Human overrides log
/app/logistics/compliance       # SLA/regulatory compliance
```

**Component Structure:**
```
src/features/logistics/
├── components/
│   ├── OrderForm.tsx            # Input orders
│   ├── RouteCard.tsx            # Single route display
│   ├── ExplainabilityPanel.tsx  # Decision reasoning
│   ├── ConstraintsList.tsx      # Violated/satisfied constraints
│   ├── AlternativeRoutes.tsx    # Comparison view
│   └── AuditTrail.tsx           # Evidence chain display
│
├── hooks/
│   ├── useLogisticsOrders.ts
│   ├── useRouteOptimization.ts
│   ├── useLogisticsDecisions.ts
│   └── useLogisticsAudit.ts
│
├── pages/
│   ├── LogisticsDashboard.tsx
│   ├── OrdersPage.tsx
│   ├── RoutesPage.tsx
│   ├── DecisionDetailPage.tsx
│   └── CompliancePage.tsx
│
└── utils/
    ├── routeParser.ts           # Format route data
    ├── constraintFormatter.ts   # Display constraints
    └── auditDisplay.ts          # Format evidence
```

---

## 4. TECHNOLOGIESTACK

### 4.1 Stack-Komposition

| Layer | Technology | Version | Integration |
|-------|-----------|---------|-------------|
| **Frontend** | Vite + React | 6.2.0 + 19.0.0 | Bestehend ✅ |
| **Routing** | react-router-dom | 7.17.0 | Bestehend ✅ |
| **UI Framework** | Tailwind CSS | 4.1.14 | Bestehend ✅ |
| **Language** | TypeScript | 5.8.2 | Bestehend ✅ |
| **Backend** | Supabase Cloud | Latest | Bestehend ✅ |
| **Database** | PostgreSQL | 16 | Bestehend ✅ |
| **Edge Functions** | Deno V8 | Latest | Bestehend ✅ |
| **AI Provider** | Anthropic SDK | 0.32.1 | Bestehend ✅ |
| **Optimization** | OR-Tools or OSRM | TBD | 🆕 NEW |
| **Testing** | Vitest + Playwright | Latest | Bestehend ✅ |
| **Monitoring** | Sentry | 8.55.2 | Bestehend ✅ |

### 4.2 New Dependencies (Minimal)

```json
{
  "dependencies": {
    "@google/or-tools": "^9.8.0"       // Vehicle Routing Problem solver
    "graphhopper": "^1.0.0"              // Distance matrix calculation
    // Optional: osmnx for local routing (lightweight)
  }
}
```

**Rationale:**
- OR-Tools is industry-standard VRP solver
- No new cloud dependencies (runs in Edge Functions)
- Fallback to OSRM (open-source) if needed

---

## 5. DATA GOVERNANCE & EU AI ACT

### 5.1 Risk Classification

**Logistics OS is "HIGH RISK" under EU AI Act:**
- Makes autonomous operational decisions (route dispatch)
- Affects business operations & logistics costs
- Potential impact on workers (driver assignments)
- Requires human oversight loop

**Mitigations:**
```
✅ All decisions logged with full reasoning (evidence layer)
✅ Human override capability before execution
✅ Constraint-based guardrails (no unrestricted optimization)
✅ Audit trail immutable (C2PA + hash chain)
✅ Model versioning & performance tracking
✅ Automated SLA monitoring & escalation
✅ Data quality checks on inputs
✅ Bias detection in routing patterns
```

### 5.2 Data Quality Requirements

```typescript
interface DataQualityCheck {
  // Order validation
  order_completeness: boolean    // All required fields present
  location_validity: boolean     // Coordinates within service area
  time_window_feasibility: boolean
  
  // Vehicle validation
  capacity_consistency: boolean  // Matches declared specs
  location_tracking: boolean     // GPS signal present
  
  // External data
  weather_data_freshness: boolean // < 1 hour old
  traffic_data_availability: boolean
  
  // Logging
  quality_score: number // 0-100
  flagged_for_review: boolean
}
```

---

## 6. INTEGRATIONSPUNKTE (DETAIL)

### 6.1 Governance Runtime

**Reuse existing:**
```typescript
// From agent-os-runner
1. Loop management (configurable interval)
2. Policy evaluation engine
3. Approval workflow
4. Incident dispatch
5. Evidence collection
6. Sentry integration

// Logistics will:
1. Add new agent types (Routing, ETA, Risk)
2. Use same policy evaluation
3. Use same approval gates
4. Use same evidence logging
```

---

### 6.2 Evidence Layer

**Existing infrastructure:**
```typescript
// From evidence-vault Edge Function
1. Immutable event storage
2. Hash chain verification
3. Custody tracking
4. PDF/JSON export
5. Compliance hold enforcement

// Logistics will:
1. Create evidence_type = "logistics_decision"
2. Store full decision reasoning as JSONB
3. Include alternatives considered
4. Include constraint violations
5. Link to routes & orders
```

---

### 6.3 Policy Engine

**Existing infrastructure:**
```typescript
// From policy-packs Edge Function
1. Versioned policy storage
2. Rule evaluation engine
3. Industry-specific bundles
4. Automatic recommendations

// Logistics will:
1. Add logistics-specific policy pack
2. Define routing rules (e.g., max hours/day)
3. Define environmental rules (e.g., CO2 limit)
4. Define SLA rules (e.g., delivery window)
```

---

### 6.4 Analytics Integration

**Existing infrastructure:**
```typescript
// From governance-analytics
1. Event aggregation
2. KPI calculation
3. Real-time dashboards
4. Export capabilities

// Logistics will:
1. New KPI metrics (SLA compliance %, CO2 impact, cost)
2. Route performance analytics
3. Agent accuracy tracking
4. Decision outcome analysis
```

---

## 7. IMPLEMENTIERUNGS-ROADMAP

### Phase 1: Analysis ✅
- [x] Repository structure mapping
- [x] Existing architecture analysis
- [x] Integration point identification
- [x] Risk assessment
- [x] Tech stack evaluation

### Phase 2: Database Schema 📋
- [ ] Create 8 new tables (logistics_orders, routes, vehicles, etc.)
- [ ] Add RLS policies
- [ ] Create indexes for performance
- [ ] Migration testing
- [ ] Rollback plan

### Phase 3: Order Management 📋
- [ ] Order ingestion API
- [ ] Order validation
- [ ] Data quality checks
- [ ] Integration with governance runtime

### Phase 4: Constraint Engine 📋
- [ ] Policy pack for logistics
- [ ] Rule definitions (driver time, capacity, SLA, CO2)
- [ ] Rule evaluation logic
- [ ] Testing & validation

### Phase 5: Routing Optimization 📋
- [ ] OR-Tools integration
- [ ] Vehicle Routing Problem solver
- [ ] Route scoring
- [ ] Alternative generation

### Phase 6: Evidence Integration 📋
- [ ] Decision logging
- [ ] Evidence event creation
- [ ] Hash chain verification
- [ ] Audit trail formatting

### Phase 7: Dashboard & UI 📋
- [ ] Route visualization
- [ ] Decision explainability panel
- [ ] Human override interface
- [ ] Analytics dashboard

### Phase 8: Testing & QA 📋
- [ ] Unit tests (constraints, routing, policies)
- [ ] Integration tests (end-to-end flows)
- [ ] E2E tests (user workflows)
- [ ] Performance testing
- [ ] Security review

---

## 8. ARCHITEKTURENTSCHEIDUNGEN

### AD-001: Use Existing Governance Runtime
**Decision:** Routing decisions flow through governance-agent orchestrator  
**Rationale:**
- Leverages existing SLO tracking, policy evaluation, evidence logging
- Reduces code duplication
- Ensures compliance with audit requirements
- Enables reuse of agent infrastructure

**Implication:**
- All routing decisions are high-risk (require human oversight gate)
- All decisions logged with full reasoning
- Decisions versioned with policy & model versions

---

### AD-002: OR-Tools for VRP Solving
**Decision:** Use Google OR-Tools for Vehicle Routing Problem  
**Rationale:**
- Industry standard (Fedex, UPS use it)
- Open source + well-documented
- Can run in Edge Functions
- Supports complex constraints (time windows, vehicle types)

**Implication:**
- Dependency on @google/or-tools library
- Solver runs server-side (not in browser)
- Solution quality > 90% optimal in < 30 seconds

---

### AD-003: Immutable Evidence Chain
**Decision:** All routing decisions logged immutably, with hash chain  
**Rationale:**
- EU AI Act requirement for high-risk decisions
- Enables audit trail verification
- Supports regulatory compliance investigations
- C2PA signing capability built-in

**Implication:**
- No retroactive decision modification
- Human overrides also logged as events
- Performance impact negligible (single INSERT per decision)

---

### AD-004: Constraint-Based Guardrails
**Decision:** All optimizations subject to policy-defined constraints  
**Rationale:**
- Prevents harmful optimizations (e.g., unsafe routing)
- Ensures human-understandable decision rationale
- Meets EU AI Act "human oversight" requirement
- Enables rule auditing

**Implication:**
- Optimizer returns "best solution that satisfies all constraints"
- No unconstrained optimization allowed
- Policies must be defined before optimization

---

### AD-005: Minimal New Dependencies
**Decision:** Reuse existing infrastructure where possible  
**Rationale:**
- Reduces maintenance burden
- Improves compatibility
- Leverages battle-tested code
- Faster implementation

**Implication:**
- Only adding @google/or-tools + optional OSRM
- No new cloud services needed
- No new monitoring/alerting required (reuse Sentry)

---

## 9. RISIKEN & MITIGATIONEN

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **VRP Solving Performance** | HIGH | Cache solver results; use approximate algorithms for real-time; test with production-scale datasets |
| **AI Model Hallucination in Reasoning** | HIGH | Use only Claude 3.5 Sonnet (production-grade); validate reasoning against facts; log confidence scores |
| **Constraint Violation** | HIGH | Pre-validation of constraints; policy audit trail; automated SLA monitoring |
| **Data Quality Issues** | MEDIUM | Validation checks on all inputs; flag low-quality decisions; require human review |
| **RLS Bypass** | CRITICAL | Standard Supabase hardening; no Service-Role in client; regular security audit |
| **Agent Cost Overrun** | MEDIUM | Rate limiting per tenant; token budget tracking; cost allocation per decision |
| **Geographic Data Accuracy** | MEDIUM | Use OpenStreetMap + local caching; regular freshness checks; fallback providers |
| **SLA Tracking Drift** | MEDIUM | Automated monitoring loop; escalation alerts; periodic reconciliation |

---

## 10. TECHNISCHE ABHÄNGIGKEITEN

### 10.1 Bestehende Infrastruktur (KEINE ÄNDERUNGEN)

```
✅ Supabase PostgreSQL 16 (tables, RLS, indexes)
✅ Edge Functions Deno V8 (serverless execution)
✅ Anthropic SDK (Claude 3.5 Sonnet)
✅ React 19 + Vite (frontend)
✅ Tailwind CSS 4.1.14 (styling)
✅ Sentry 8.55.2 (monitoring)
✅ Vitest + Playwright (testing)
✅ n8n (workflow automation)
```

### 10.2 Neue Abhängigkeiten (MINIMAL)

```
OR-Tools:        @google/or-tools
                 Purpose: Vehicle Routing Problem solver
                 Size: ~15MB
                 Runtime: Edge Function compatible

Distance Matrix: OpenStreetMap OSRM (optional, local-runnable)
                 Purpose: Routing costs calculation
                 Fallback: Google Maps API (with cost tracking)
```

### 10.3 Keine neuen Cloud-Services benötigt

```
✅ Solves in PostgreSQL/Edge Function
✅ No external ML services needed
✅ No new databases needed
✅ No new message queues needed
✅ Monitoring via existing Sentry
✅ Analytics via existing governance-analytics
```

---

## 11. NEXT STEPS

### Unmittelbar (Today)
- [x] Phase 1: Architecture Analysis ✅
- [ ] Approval: Technical steering committee
- [ ] Branch Creation: claude/logistics-os-architecture-9jjce7

### Nächste Woche
- [ ] Phase 2: Database Schema (migrations)
- [ ] Phase 3: Order Management API
- [ ] Phase 4: Constraint Engine

### Testing & Validation
- Unit test coverage: Target 95%
- Integration tests: Full order → route → decision flow
- E2E tests: Dashboard workflow
- Performance tests: Solver on 1000-order dataset

### Deployment
- Local testing: `npm run dev` + Supabase emulator
- Staging: GitHub Actions to staging environment
- Production: Coordinated release with main platform
- Rollback: Database migration rollback + function revert

---

## 12. GENEHMIGUNGEN & SIGN-OFF

**Status:** Phase 1 Analysis Complete — Awaiting Approval  
**Prepared by:** Claude AI Systems Architect  
**Date:** 2026-07-19  
**Next Review:** After Phase 2 Database Schema  

### Checklist for Phase 2 Approval
- [ ] Technical architecture reviewed
- [ ] Integration points validated
- [ ] Risk assessment accepted
- [ ] Database schema designed
- [ ] Testing strategy approved
- [ ] Security review completed

---

## Anhang A: Glossar

| Term | Definition |
|------|-----------|
| **Logistics OS** | Governance-native routing optimization module |
| **Order** | Delivery request with location, time window, weight |
| **Route** | Ordered list of stops for a vehicle |
| **Decision** | AI recommendation for order → route assignment |
| **Override** | Human intervention in automated routing |
| **Evidence** | Immutable log entry for decision rationale |
| **Constraint** | Policy rule that must be satisfied (e.g., vehicle capacity) |
| **SLO** | Service Level Objective (e.g., 95% on-time delivery) |
| **VRP** | Vehicle Routing Problem (mathematical optimization) |

---

## Anhang B: Referenzen

- CLAUDE.md (Project documentation)
- ARCHITECTURE.md (System overview)
- AGENTS.md (Agent framework)
- EU AI Act Compliance (GOVERNANCE_AGENT_OPTIMIZATION.md)
- Evidence Layer (C2PA_PROVENANCE_INTEGRATION.md)
- Policy Engine (Policy-Packs documentation)

---

**END OF ANALYSIS DOCUMENT**
