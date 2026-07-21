# Agent Runtime Platform – BESTANDSANALYSE (Phase 1 Audit)

**Status:** ✅ Audit abgeschlossen  
**Datum:** 2026-07-20  
**Validiert durch:** Claude Code  
**Nächster Schritt:** PHASE 2 – Agent Runtime Core Optimierung

---

## Executive Summary

RealSyncDynamics AI verfügt **bereits über eine substanzielle Agent Runtime-Infrastruktur** mit:
- ✅ Kern-Datenbank-Schema (runtime_executions, runtime_approval_gates, runtime_events)
- ✅ Edge Functions für Governance-Agenten (10+ spezialisierte Functions)
- ✅ Policy Engine & Registry MVP (in `apps/agent-runtime/`)
- ✅ Multi-Tenancy & RLS Isolation
- ✅ Audit-Trail & Compliance-Logging
- ⚠️ **Aber: Unvollständige Integrationen, fehlende Spezifikationen**

**Empfehlung:** Nicht neu bauen, sondern **bestehende Infrastruktur konsolidieren, dokumentieren und erweitern**.

---

## 1. DATENBANK-INFRASTRUKTUR

### Status: 🟢 Vorhanden, gut strukturiert

#### Tabellen
| Tabelle | Status | Beschreibung |
|---------|--------|-------------|
| `runtime_executions` | ✅ | Skill-Ausführungen, Idempotency-Keys, Hashing |
| `runtime_approval_gates` | ✅ | Human-in-the-Loop Checkpoints (low/medium/high/critical) |
| `runtime_events` | ✅ | Append-only Audit-Log (revoked update/delete) |
| `agent_sessions` | ✅ | Konversations-Historie (governance-agent) |
| `agent_runs` | ✅ | Token-Kosten, Traces pro Turn |
| `enterprise_agent_runs` | ✅ | Batch-Agenten für Website-Monitoring |

#### RLS-Policies
- ✅ Strict tenant-scoped access via `is_tenant_member()`
- ✅ Approval gates inherit parent execution's tenant scope
- ✅ Events append-only (no update/delete für non-superuser)

**Befund:** Solid Foundation. RLS ist hart und konsistent.

---

## 2. EDGE FUNCTIONS – AGENT ÖKOSYSTEM

### Status: 🟢 Produktiv, aber fragmentiert

#### Governance-Kern (10 Functions)
| Function | Status | Zweck |
|----------|--------|-------|
| `governance-agent` | 🟢 | Hauptkonversations-Interface (Anthropic, Tool-Use Loop) |
| `governance-ingest` | 🟢 | Event-Ingestion von externen Systemen |
| `governance-approvals` | 🟡 | Approval Queue (Workflow reife zu prüfen) |
| `governance-dpias` | 🟢 | DPIA-Workflow |
| `governance-dsr` | 🟢 | DSR (GDPR Art. 15, 17) |
| `governance-incidents` | 🟡 | Incident Management (alpha) |
| `governance-vendors` | 🟢 | Sub-Processor Inventory |
| `governance-keys` | 🟢 | API Key Management & Rotation |
| `governance-webhooks` | 🟢 | Webhook-Dispatch zu externen Services |
| `governance-connectors` | 🟡 | Cloud Connector Registry (incomplete) |

**Befund:** governance-agent ist reif. Andere Functions sind isoliert; bessere Orchestrierung nötig.

#### Spezialisierte Agenten (4 Functions)
| Function | Status | Zweck |
|----------|--------|-------|
| `agent-os-runner` | 🟡 | Zentrale Executor (referenziert apps/agent-runtime) |
| `enterprise-ai-os-agents-list` | 🟡 | Agent Registry API |
| `enterprise-ai-os-agents-run` | 🟡 | Batch-Ausführung (für Website-Monitoring) |
| `agent-scheduler` | 🟡 | Cron-Integration |

**Befund:** Parallel-Implementierung zu apps/agent-runtime. Rationalisierung nötig.

#### Website-spezifische Agenten (2 Functions)
| Function | Status | Zweck |
|----------|--------|-------|
| `website-operations-agent` | 🟡 | Betriebsaufgaben (Logs, Metriken) |
| `website-maintenance-agent` | 🟡 | Wartungs-Workflow |

**Befund:** Domain-spezifisch; können als Templates dienen.

---

## 3. APP-LEVEL RUNTIME (`apps/agent-runtime/`)

### Status: 🟡 MVP (0.1.0), Production-Ready Architektur

#### Komponenten
| Komponente | Status | Bedeutung |
|------------|--------|----------|
| Gateway (Express) | ✅ | Auth, Body-Validation, Rate-Limiting |
| Policy Engine | ✅ | Task-Type & Tool Authorization Rules |
| Agent Registry | ✅ | Agent Metadata (name, type, status, version) |
| Audit Log | ✅ | Stdout-Events (strukturiert, PII-clean) |

#### Endpoints
```
GET    /health              → public (liveness)
GET    /agents              → Bearer Token (registered agents list)
POST   /run-agent           → Bearer Token + Policy Check
```

#### Security
- ✅ Fail-Fast wenn `AGENT_RUNTIME_API_TOKEN` fehlt
- ✅ Body-Limit 256 kB
- ✅ No tokens/bodies in audit events
- ✅ Unprivilegierter Container-User

**Befund:** Gutes MVP; fehlen aber:
- [ ] Verbindung zu Supabase (Persistierung der Audit-Logs)
- [ ] Tool-Execution (OpenClaw, Ollama, n8n noch nicht wired)
- [ ] Rate-Limiting & Quota-Enforcement
- [ ] Frontend-Anbindung (UI für Agent-Builder)

---

## 4. DATENMODELLE & SCHEMAS

### Status: 🟡 Teilweise definiert, Spezifikationen fehlen

#### Vorhandene Typisierung

**In `src/runtime/types.ts`:**
```
AgentSession, AgentRun, RuntimeEvent, ...
```

**In `apps/agent-runtime/src/types.ts`:**
```
AgentDefinition, PolicyRule, AuditEvent, ...
```

**Befund:** Zwei parallel getypte Systeme. Single Source of Truth nötig.

#### Fehlende Spezifikationen (laut docs/runtime-status-matrix.md)
| Spezifikation | Status | Zweck |
|---------------|--------|-------|
| Agent Contract Spec (ACS) | 🔴 | Agent-Identität, Goals, Tools, Permissions |
| Event Schema Standard (ESS) | 🔴 | Event-Format Canonical (alle Agenten) |
| Runtime Contract Spec (RCS) | 🔴 | Runtime-Execution Lifecycle (pending→running→approved→done) |

---

## 5. LLM-PROVIDER & AI-GATEWAY

### Status: 🟢 Anthropic Live, Fallbacks konfiguriert

#### governance-agent
- **Primär:** Anthropic SDK (claude-sonnet-4-6)
- **Fallback:** Ollama (gemma3:4b) EU-lokal
- **Env-Vars:** `AGENT_LLM_PROVIDER`, `AGENT_LLM_MODEL`, `AGENT_ANON_LLM_MODEL`
- **Token-Budgets:** 
  - Haiku: 1200 tokens/turn
  - Sonnet: 1500 tokens/turn
  - Anon: 1024 tokens/turn (public mode)

#### Token Metering
- ✅ Quotas pro Tenant (checkTenantQuota)
- ✅ Anon-Quotas separat (checkAnonQuota)
- ✅ Cost Recording in `agent_runs` Tabelle

**Befund:** Solid. Kostenoptimierung für Public-Pfade vorhanden.

---

## 6. MEMORY-SYSTEM

### Status: 🟡 Basis vorhanden, Vektoren fehlen

#### Kurzzeitgedächtnis
- ✅ agent_sessions (Supabase)
- ✅ MAX_HISTORY_TURNS = 20 (configurable)
- ✅ Session-Reset-Unterstützung

#### Langzeitgedächtnis
- ⚠️ `pgvector` Extension erwähnt, aber **nicht implementiert**
- ⚠️ Embeddings: Keine Vektorspeicherung in Migrations vorhanden
- ⚠️ RAG-Infrastruktur: Fehlt

**Befund:** Memory ist heute rein regelbasiert. Vector Search wäre Phase 3-Feature.

---

## 7. GOVERNANCE-LAYER & COMPLIANCE

### Status: 🟢 Audit-Trail vorhanden, Policies teilweise

#### Audit-Logging
- ✅ governance_admin_audit_log (every tool call)
- ✅ agent_runs (per-turn traces + token costs)
- ✅ runtime_events (append-only)
- ✅ Evidence Vault (hashed records, C2PA-ready)

#### Policy Engine
- ✅ Task-Type Restrictions (task in ['scan', 'analysis', 'report', ...])
- ✅ Tool Authorization (requestedTool gegen Agent-Whitelist)
- ✅ Risk Levels (low, medium, high, critical)
- ⚠️ **Aber:** Policy-Engine nur im apps/agent-runtime MVP, nicht in Edge Functions wired

#### Approvals
- ✅ approval_gates Table
- ✅ governance-approvals Edge Function
- ⚠️ **Aber:** Workflow-Reife unklar

**Befund:** Audit ist solid. Policy-Enforcement ist MVP-Status.

---

## 8. DEPLOYMENT & ORCHESTRIERUNG

### Status: 🟡 Mehrere Infrastrukturen, nicht konsolidiert

#### Hostinger VPS
- ✅ Docker / Docker Compose
- ✅ PM2 + systemd
- ✅ Ollama lokal (gemma3:4b, qwen3)
- ✅ n8n Workflows (existieren, keine Docs)
- ⚠️ agent-runtime Service **nicht deployed** (nur lokal dev-fähig)

#### Supabase Cloud
- ✅ PostgreSQL 16 (eu-central)
- ✅ Edge Functions V8 (103 Functions)
- ✅ Realtime Subscriptions
- ✅ Auth (JWT, RBAC)

#### docker-compose.yml
- ⚠️ agent-runtime nicht in Compose
- ⚠️ n8n Setup unklar
- ⚠️ Ollama <-> agent-runtime Netzwerk-Routing nicht dokumentiert

**Befund:** VPS-Stack existiert, aber Agent-Runtime ist isoliert. Integration nötig.

---

## 9. TOOLS & SKILL-SYSTEM

### Status: 🟡 Governance-Tools existieren, API-Tool-Katalog unvollständig

#### Governance-Tools (in `_shared/agent-tools.ts`)
```
governance_resource_inventory()      → Ressourcen-Übersicht
governance_run_dpia()                → DPIA-Workflow
governance_run_dsr()                 → DSR-Workflow
governance_check_vendor()            → Vendor-Lookup
governance_create_incident()         → Incident-Dispatch
governance_scan_compliance()         → Regel-Engine Scan
...
```

#### Tool-Dispatch Architektur
```
governance-agent (tool-use loop)
  ↓
dispatchTool()
  ↓
governance-* Edge Functions
```

**Befund:** Pattern ist gut. Aber:
- [ ] Tool-Registry ist hardcoded in _shared/agent-tools.ts (sollte aus DB kommen)
- [ ] Tool-Schemas sind nicht standardisiert (Zod vs. Typescript Typen gemischt)
- [ ] Tool-Permissions sind nicht explicit (implizit pro Agent)
- [ ] Tool-Versions-Management fehlt

---

## 10. TESTING & MONITORING

### Status: 🟡 Unit-Tests vorhanden, Integrationstests fragmentiert

#### Unit-Tests
- ✅ test/agents/ (Agent-spezifische Tests)
- ✅ test/runtime/ (Runtime Core Tests)
- ⚠️ Aber: Supabase Mocking unvollständig

#### E2E-Tests
- ✅ Playwright Tests existieren (25 passed, 3 skipped)
- ⚠️ Aber: Keine governance-agent End-to-End Tests
- ⚠️ Aber: Keine Policy-Engine-Enforcement Tests

#### Monitoring
- ✅ Sentry 8.55.2 (Error-Aggregation)
- ⚠️ Aber: governance-agent Traces nicht vollständig instrumentiert
- ⚠️ Aber: Keine Agent-Performance-Dashboards

**Befund:** Gute Basis; Integration mit Agent-Runtime braucht Attention.

---

## 11. MULTI-TENANCY & SICHERHEIT

### Status: 🟢 RLS hardened, aber Tenant-Context nicht überall konsistent

#### Multi-Tenancy
- ✅ tenant_id auf allen App-Tables
- ✅ RLS-Policies konsistent (`is_tenant_member()` Helper)
- ✅ Tenant-Isolation in governance-agent
- ✅ auth.uid() → tenant lookup via service_role Key

#### Service-Role Keys
- ✅ Ausschließlich in Edge Functions
- ✅ Niemals in Client-Code
- ✅ Vault-Rotation existiert

#### Secrets Management
- ✅ anthropic_api_key in Vault
- ✅ AGENT_RUNTIME_API_TOKEN env-var
- ⚠️ Aber: Key-Rotation für AGENT_RUNTIME_API_TOKEN nicht dokumentiert

**Befund:** Solid Security Posture. Ein paar Lücken in Doku.

---

## 12. ARCHITEKTUR-DIAGRAMME UND ABHÄNGIGKEITEN

### Aktueller State
```
┌─────────────────────────────────────────────────────┐
│              Frontend (React + Vite)                │
│  /governance/*, /audit/*, /settings/, etc.         │
└──────────────────────┬──────────────────────────────┘
                       │ (Supabase Auth)
        ┌──────────────┴──────────────┐
        │                             │
    ┌───▼─────────────────────┐  ┌───▼─────────────────────┐
    │  Edge Functions (103)   │  │  apps/agent-runtime     │
    │  (Supabase)             │  │  (Node.js, Port 8787)   │
    │                         │  │  ⚠️ Not wired           │
    │ • governance-agent      │  │  • Policy Engine        │
    │ • governance-ingest     │  │  • Agent Registry       │
    │ • governance-approvals  │  │  • Audit Log (stdout)   │
    │ • governance-dpia       │  │                         │
    │ • governance-dsr        │  └─────────────────────────┘
    │ • ...10 more            │
    └───┬─────────────────────┘
        │
        ├─→ Supabase PostgreSQL (eu-central)
        │   • runtime_executions
        │   • runtime_approval_gates
        │   • runtime_events
        │   • agent_sessions
        │   • agent_runs
        │   + 20 more tables
        │
        ├─→ Anthropic SDK (claude-sonnet-4-6)
        │   Fallback: Ollama (Hostinger)
        │
        ├─→ Vault (anthropic_api_key)
        │
        └─→ Sub-Services
            • n8n Workflows (Hostinger)
            • Ollama (Hostinger, EU-lokal)
            • Stripe (Metered Billing)
            • Sentry (Error Aggregation)
```

**Befund:** Unvollständige Integration. Zwei Executor-Pfade konkurrieren.

---

## 13. VERSIONING & RELEASE-PROZESS

### Status: 🟡 Basis vorhanden, Agent-Versioning fehlt

#### Package Versioning
- ✅ apps/agent-runtime: 0.1.0 (npm semver)
- ✅ supabase/ Functions: Implicit via git commit
- ⚠️ Agent-Versioning: Nicht standardisiert
  - Welche agent_id? ("website-drift-agent" hardcoded?)
  - Wie unterscheiden sich Agent-Versionen?
  - Backwards-Compatibility für Tools?

#### Release Process
- ✅ GitHub Actions (CI/CD, CLOUDFLARE_DOMAIN_FIX.md erwähnt)
- ✅ Supabase DB-Migrations sind versioniert
- ⚠️ Aber: Agent Runtime Release-Prozess nicht dokumentiert

**Befund:** Infra ist da, aber Agent-spezifische Release-Prozeduren fehlen.

---

## 14. DOCUMENTATION & SPECS

### Status: 🔴 Fragmentiert, keine authoritative Docs

| Dokument | Status | Qualität |
|----------|--------|----------|
| docs/runtime-status-matrix.md | ✅ | Exzellent (Single Source of Truth) |
| ARCHITECTURE.md | 🟡 | Veraltet (V1.0 Copilot-bezogen) |
| C2PA_PROVENANCE_INTEGRATION.md | ✅ | Gut (Ed25519, Custody-Capture) |
| AI_TOKEN_METERING_SETUP.md | ✅ | Gut (Token-Budgets) |
| AGENTS.md | 🟡 | Veraltet (Persona-Definition, nicht Architektur) |
| apps/agent-runtime/README.md | ✅ | Gut (Endpoints, Env-Vars, Beispiele) |
| **Agent Contract Spec (ACS)** | 🔴 | **FEHLT** |
| **Event Schema Standard (ESS)** | 🔴 | **FEHLT** |
| **Runtime Contract Spec (RCS)** | 🔴 | **FEHLT** |

**Befund:** Critical Gap. Ohne ACS/ESS/RCS können neue Agenten nicht formell spezifiziert werden.

---

## 15. KONFIGURATION & ENV-VARS

### Status: 🟡 Verstreut, dokumentiert aber nicht konsolidiert

#### Governance-Agent Env-Vars (supabase/functions/governance-agent/)
```
AGENT_LLM_PROVIDER           (default: anthropic)
AGENT_LLM_MODEL              (default: claude-sonnet-4-6)
AGENT_ANON_LLM_MODEL         (default: AGENT_LLM_MODEL)
AGENT_MAX_TOKENS_HAIKU       (default: 1200)
AGENT_MAX_TOKENS_SONNET      (default: 1500)
AGENT_MAX_TOKENS_PER_TURN    (default: 1500)
AGENT_ALLOW_US_ROUTING       (no default; blocks US-routing wenn nicht set)
```

#### Agent-Runtime Env-Vars (apps/agent-runtime/)
```
NODE_ENV                     (default: development)
PORT                         (default: 8787)
AGENT_RUNTIME_API_TOKEN      (REQUIRED in production)
OLLAMA_URL                   (default: http://ollama:11434)
OPENCLAW_URL                 (default: http://openclaw:3000)
N8N_URL                      (default: http://n8n:5678)
```

#### Fehlende Doku
- [ ] Master .env.example für alle Agent-Services
- [ ] Configuration Schema (Zod oder JSON Schema)
- [ ] Runtime Defaults vs. Override Precedence

**Befund:** Dezentralisiert. Needs consolidation für einfaches Deployment.

---

## ZUSAMMENFASSUNG DER BEFUNDE

### ✅ VORHANDEN (Core Infrastruktur)
1. Datenbank-Schema (runtime_executions, approval_gates, events)
2. Edge Functions für Governance-Agenten (10+)
3. Policy Engine MVP (apps/agent-runtime/)
4. Multi-Tenancy & RLS (hardened)
5. Audit-Trail & Compliance-Logging
6. LLM-Provider Integration (Anthropic + Ollama)
7. Token Metering & Quotas
8. Approval Gates (human-in-the-loop)
9. C2PA Provenance Integration
10. Multi-Tenant Isolation (auth.uid() → tenant_id)

### ⚠️ UNVOLLSTÄNDIG (Mid-Stage)
1. agent-runtime Service nicht deployed/integrated
2. Policy-Engine nur im MVP, nicht in Edge Functions wired
3. Tool-Registry hardcoded (sollte aus DB kommen)
4. Memory-System ohne Vektoren (pgvector nicht implementiert)
5. Approval-Workflow Reife unklar
6. Rate-Limiting nicht konsistent
7. Frontend-Anbindung zu apps/agent-runtime fehlt
8. Doku: Mehrere alte Versionen konkurrieren

### 🔴 FEHLT (Spezifikationen)
1. **Agent Contract Specification (ACS)** — formal Agent-Identität, Goals, Permissions
2. **Event Schema Standard (ESS)** — canonical Event-Format für alle Agenten
3. **Runtime Contract Specification (RCS)** — Execution Lifecycle, State Transitions
4. **Agent Builder UI** — Benutzeroberfläche zum Erstellen/Verwalten von Agenten
5. **Tool-Builder Interface** — standardisierte Tool-Definition und Versionierung
6. **Governance Spec v1.0** — Evidence Hash-Chain Formal Spec, Replay-Engine

---

## EMPFEHLUNGEN FÜR PHASE 2 – 8

### PHASE 2 – Agent Runtime Core Konsolidierung
**Zielprozesse:**
1. Merge `apps/agent-runtime` mit Edge Functions (single execution path)
2. Schreib ACS / ESS / RCS Spezifikationen
3. Erstelle Agent Registry Schema (in Supabase, nicht hardcoded)
4. Rationalisiere Policy Engine (Policy-as-Code, z.B. OPA)

### PHASE 3 – Agent Builder UI
1. Dashboard für Agent-Verwaltung (`/app/agents/`)
2. Drab-&-Drop Skill-Assembly
3. Tool-Permission Management
4. Agent-Test-Console (REPL)

### PHASE 4 – Tool System
1. Standard Tool-Definition Schema
2. Tool-Registry (Dynamic loading)
3. Tool-Versioning & Breaking Change Management
4. Tool-Tests & Compatibility Matrix

### PHASE 5 – Memory System (Advanced)
1. pgvector Extension enablement
2. Embedding-Service Integration
3. RAG-Infrastruktur (retrieval-augmented generation)
4. Knowledge Base Management UI

### PHASE 6 – Policy Engine (Production)
1. OPA-Integration (Policy-as-Code)
2. Dynamic Policy Loading
3. Policy-Versioning & Audit Trail
4. Policy-Builder UI

### PHASE 7 – Deployment & Orchestrierung
1. docker-compose.yml Update (agent-runtime + wiring)
2. PM2 Ecosystem Config
3. Health Checks & Restart Logic
4. Logging Aggregation (ELK Stack?)

### PHASE 8 – Testing & Monitoring
1. Comprehensive Integration Tests
2. E2E Tests für Agent Lifecycle
3. Performance Dashboards (Prometheus + Grafana)
4. Compliance Audit Reports

---

## KRITISCHE NÄCHSTE SCHRITTE (Blocking Issues)

1. **Entscheidung:** Merge `apps/agent-runtime` mit Edge Functions oder keep separate?
   - **Pro Merge:** Einheitlicher Execution Path, einfacheres Deployment
   - **Pro Separate:** Bessere Separation of Concerns, Independent Scaling
   
2. **Spezifikationen:** ACS / ESS / RCS müssen VOR Skalierung geschrieben sein
   - Blocking for: Agent Builder, Tool Registry, Multi-Agent Orchestrierung

3. **Tool-Registry:** Muss aus hardcoded _shared/agent-tools.ts in DB-backed Registry
   - Blocking for: Dynamic Skill-Loading, Agent-Marketplace

4. **Agent-Runtime Deployment:** Service nicht produktiv wired
   - Blocking for: Policy-Enforcement, Approval-Gate Testing

---

## Ausblick: Agent-Marketplace & Multi-Agent Orchestrierung

Sobald ACS/ESS/RCS definiert sind, wird folgende Architektur möglich:

```
Agent Marketplace (Phase 9)
  ├─ Public Agent Gallery (templates)
  ├─ Custom Agent Builder
  ├─ Agent Versioning & Rollback
  ├─ Tool-Dependency Resolution
  └─ Agent Composition (multi-agent workflows)

Multi-Agent Orchestration (Phase 10)
  ├─ Agent Selection (routing via intent)
  ├─ Context Passing (memory sharing)
  ├─ Conflict Resolution
  └─ Orchestrator Agent (delegator)
```

---

## Audit-Signoff

| Aspekt | Befund |
|--------|--------|
| **Datenbank-Integrität** | ✅ Solid, RLS-hardened |
| **Code-Qualität** | 🟡 Gut lokal, Integrations-Gaps |
| **Deployment-Readiness** | 🟡 Components existieren, wiring incomplete |
| **Dokumentation** | 🔴 Fragmentiert, Spezifikationen fehlen |
| **Sicherheit** | ✅ Best Practices vorhanden |
| **Compliance-Readiness** | 🟢 Audit-Trail, RLS, Evidence Vault ready |
| **Scalability** | 🟡 Architecture supports scale, aber Policies brauchen Optimization |

**Gesamtbewertung:** 🟡 **Production-Ready Core, aber Integration & Specs nötig vor Skalierung**

---

**Nächste Aktion:** Übergabe an PHASE 2 – Agent Runtime Core Konsolidierung.
