# Agent OS — interne Architekturreferenz

> **Internes Dokument.** Begriffe wie "Agent OS" oder "KI-Betriebssystem" sind
> ausschließlich intern zu verwenden. Solange Runtime, Permissions und
> Observability nicht produktiv abgesichert sind, wird der Begriff in
> Marketing, Website, Pitch oder Sales **nicht** öffentlich verwendet. Außen
> bleibt die Positionierung: "Automated Digital Compliance Infrastructure".

Dieses Dokument beschreibt die Ziel-Architektur, in die der bestehende
Compliance-SaaS schrittweise eingebettet wird. Es ist eine Referenz, keine
Implementierungs-Checkliste. Phasen und Zeitachsen stehen in
`docs/architecture/roadmap.md`.

---

## 1. Designprinzipien

1. **Runtime first.** Eine Funktion ist erst dann ein "Skill", wenn sie über
   die Runtime mit definierten Inputs, Permissions, Auditing und Approval
   Gates läuft. Direktaufrufe von Edge Functions ohne Runtime sind weiterhin
   erlaubt, gelten aber nicht als Agent-OS-Bestandteil.
2. **Tenant-Isolation ist nicht verhandelbar.** Jede Execution, jedes Event,
   jeder Memory-Eintrag ist `tenant_id`-skopiert. RLS bleibt aktiv.
3. **Permissions sind explizit.** Skills deklarieren benötigte Capabilities
   (`read:audit`, `write:remediation`, `network:external`,
   `pii:process`, …). Ohne Deklaration kein Zugriff.
4. **Human-in-the-Loop ist Standard, nicht Ausnahme.** Risikobehaftete
   Aktionen (`risk_level >= 'medium'`) erfordern einen Approval Gate.
5. **Beobachtbarkeit ist Pflicht.** Jeder Lauf erzeugt mindestens eine
   `runtime_execution`-Zeile plus strukturierte Events. Keine "silent fires".
6. **Keine Feature-Flut.** Eine Schicht wird erst eingeführt, wenn die
   darunterliegende stabil ist und mindestens ein Application-Use-Case sie
   verlangt.
7. **Kein Marketing-Overclaim.** "Multi-Agent-Orchestration" wird nicht
   beworben, solange nur Single-Skill-Executions laufen.

---

## 2. Schichten

```
┌────────────────────────────────────────────────────────────────────┐
│  Applications Layer                                                │
│  Website Audit · Shopify Compliance · AI-Act Governance ·          │
│  Support Triage · Marketing Analytics · Sales / Outreach           │
├────────────────────────────────────────────────────────────────────┤
│  Developer Platform (Phase 5)                                      │
│  Public API · TS-SDK · CLI · Skill-Manifest-Marketplace            │
├────────────────────────────────────────────────────────────────────┤
│  Multi-Agent Orchestration (Phase 4, später)                       │
│  Planner / Executor / Critic · Agent-to-Agent-Calls                │
├────────────────────────────────────────────────────────────────────┤
│  Workflow Engine (Phase 2)                                         │
│  Queue · Scheduled Triggers · Retries · State Machine              │
├────────────────────────────────────────────────────────────────────┤
│  Runtime Core (Phase 1)                                            │
│  Skill Registry · Executor · Approval Gates                        │
├──────────────┬──────────────┬───────────────┬──────────────────────┤
│  Events      │  Memory      │  Permissions  │  Observability       │
│  Pub/Sub     │  Context +   │  Capabilities │  Traces · Logs ·     │
│  Audit Bus   │  Knowledge   │  + RBAC + RLS │  Metrics · Audit     │
├──────────────┴──────────────┴───────────────┴──────────────────────┤
│  Infrastructure                                                    │
│  Supabase Postgres (EU) · Edge Functions · Worker · Storage        │
└────────────────────────────────────────────────────────────────────┘
```

Schichten sind **stabil von unten nach oben**. Keine Schicht darf eine
darüberliegende importieren.

---

## 3. Schicht-Details

### 3.1 Runtime Core

Verantwortlich für die Ausführung eines einzelnen Skills.

Begriffe:

- **Skill** — eine deklarativ beschriebene Operation (Manifest + Handler).
  Beispiel: `audit.cookie_scan`, `shopify.consent_inject`,
  `ai_act.classify_system`.
- **Agent** — eine Konfiguration aus Skills + Policies + Memory-Scope +
  Permissions, die für einen Tenant aktiv ist. Ein Agent ist **kein**
  LLM-Prompt — der LLM-Call ist nur ein möglicher Skill.
- **Execution** — ein konkreter Lauf eines Skills durch einen Agent.

Komponenten:

- `SkillRegistry` — in-memory Registry, lädt Skill-Manifeste, validiert sie
  beim Boot. Quelle der Wahrheit im Repo: `src/core/runtime/registry.ts`.
- `Executor` — orchestriert: Permission-Check → Approval-Gate-Check →
  Handler-Call → Event-Emit → Persist Execution. Keine Business-Logik im
  Executor.
- `AgentValidator` — prüft Agent-Definitionen beim Laden (Schema, Skill-IDs
  existieren, beanspruchte Permissions sind im Tenant-Plan freigeschaltet).

Nicht-Ziele für Phase 1: Parallel-Calls, Streaming, Sub-Agents. Bewusst.

### 3.2 Events

Strukturierter Pub/Sub-Bus für Runtime-Ereignisse:

- `execution.started`, `execution.completed`, `execution.failed`
- `approval.requested`, `approval.granted`, `approval.denied`
- `permission.denied`
- `memory.written`, `memory.read` (nur Pointer, keine Payloads)

Persistente Spur: `runtime_events`. In Phase 1 ist der Bus synchron in
Postgres. Ein dedizierter Broker (Redis-Stream / NATS) wird erst
eingeführt, wenn echte Asynchronität gebraucht wird.

### 3.3 Memory

Zwei klar getrennte Stores:

- **Working Memory** — kurzlebig, an eine Execution gebunden, lebt nicht
  länger als der Lauf + Approval-Wartezeit. Implementierung: Postgres-Tabelle
  mit TTL-Sweep (analog `workflow_runs_sweeper`).
- **Knowledge Store** — langlebig, tenant-isoliert, durchsuchbar.
  Beispiele: Audit-Historie, Tracker-Findings, Remediation-Decisions. Vektor-
  Indizes optional, nicht in Phase 1.

Memory ist **keine** generische Key-Value-Tüte. Jeder Schreibzugriff
deklariert `kind` (`audit_finding`, `remediation_decision`, `evidence`, …)
und `pii_class`.

### 3.4 Permissions

Drei Ebenen, additiv:

1. **Postgres RLS** — physische Isolation pro `tenant_id`. Bleibt
   unverändert.
2. **RBAC** — Rollen `owner`, `admin`, `member`, `dsb`, `viewer`. Bleibt im
   bestehenden `src/core/access` verankert.
3. **Capabilities** — feingranular pro Skill. Werden im Skill-Manifest
   deklariert und beim Executor durchgesetzt. Beispiele:
   - `read:tenant.audit`
   - `write:tenant.remediation`
   - `network:external`
   - `pii:process`
   - `consent:write`

Capabilities entscheiden auch, ob ein Skill ohne Approval Gate laufen darf
(`auto_approve: true` ist nur bei rein lesenden, nicht-PII-Capabilities
zulässig).

### 3.5 Observability

- **Execution Trace** — ein Datensatz pro Lauf in `runtime_executions` mit
  Status, Dauer, Input-Hash, Output-Hash, Permission-Pfad.
- **Audit Log** — vollständige `runtime_events`-Spur, append-only, dient
  als Beweismittel im Compliance-Sinn (passt zur Evidence-Vault-Strategie
  aus `ROADMAP.md`).
- **Metriken** — Latenz pro Skill, Failure-Rate, Approval-Rate. Wird in
  Phase 1 nur aggregiert in `runtime_executions` abgefragt, kein
  separater Metrik-Stack.
- **Existierender Sentry-Integration bleibt für UI-Fehler.** Runtime nutzt
  Sentry nicht als Audit-Trail.

---

## 4. Workflow Engine (Phase 2)

Kommt **nach** stabiler Runtime. Komponenten:

- **Queue** — durable, tenant-isoliert. Erste Implementierung über
  `pg_cron` + Postgres-Queue (analog zur Phase-1-Architektur des
  Produkts). Redis erst, wenn Durchsatz es erzwingt.
- **Scheduled Triggers** — Cron-Ausdruck pro Workflow, tenant-skopiert.
- **Retries** — Exponential Backoff mit deklarativem `retry_policy` im
  Workflow-Manifest. Kein blindes Retry für nicht-idempotente Skills.
- **State Machine** — explizite Zustände `pending → running →
  awaiting_approval → completed | failed | cancelled`. Übergänge nur
  durch den Executor, niemals direkt.

Workflows referenzieren Skills, halten aber keine Skill-Logik selbst. Ein
Workflow ist ein Plan, kein Code.

---

## 5. Multi-Agent Orchestration (Phase 4)

Erst relevant, wenn mehrere produktive Applications denselben Memory-Scope
brauchen und sich Skills gegenseitig aufrufen sollen. Bis dahin:
Skill → Skill innerhalb desselben Workflows reicht.

Zukünftige Rollen: Planner, Executor, Critic. Keine vorgezogene
Implementierung.

---

## 6. Developer Platform (Phase 5)

Erst sinnvoll, wenn die internen Applications die Runtime-Schnittstelle
nicht mehr ändern. Bestandteile:

- **Public API** — REST + signierte Webhooks, versioniert
  (`/v1/runtime/...`). Stabilitätsgarantie minimal 12 Monate.
- **TypeScript SDK** — generiert aus OpenAPI, mit Typsicherheit für
  Skill-Inputs/-Outputs.
- **CLI** — `realsync skills list|push|validate`, `realsync runs tail`,
  `realsync approvals pending`.
- **Skill Manifest Marketplace** — kuratierte Skills (intern + Partner),
  signiert, mit Capability-Audit. Kein offener Plugin-Store ohne Review.

---

## 7. Applications Layer

Jede Application ist eine Komposition aus Skills + Workflows + UI. Die
Application enthält keine Runtime-Logik.

| Application | Primäre Skills (geplant) | Memory-Kind | Approval-Bedarf |
|---|---|---|---|
| **Website Audit** | `audit.cookie_scan`, `audit.consent_timing`, `audit.report_pdf` | `audit_finding` | nein (read-only) |
| **Shopify Compliance** | `shopify.scan`, `shopify.consent_inject`, `shopify.script_block` | `remediation_decision` | ja (jede Schreib-Aktion) |
| **AI-Act Governance** | `ai_act.classify_system`, `ai_act.disclosure_check`, `ai_act.inventory_sync` | `governance_record` | ja (Klassifikations-Override) |
| **Support Triage** | `support.classify_ticket`, `support.suggest_reply`, `support.escalate` | `support_case` | ja (Outbound-Reply) |
| **Marketing Analytics** | `marketing.fetch_metrics`, `marketing.detect_anomaly`, `marketing.report` | `metric_snapshot` | nein |
| **Sales / Outreach** | `sales.enrich_lead`, `sales.draft_outreach`, `sales.send_outreach` | `lead_state` | ja (`send_outreach`) |

Die Tabelle ist Plan, nicht Implementierungsstand. Aktuell existiert auf
Skill-Ebene noch nichts — die heutigen Edge Functions sind Vor-Runtime und
werden in Phase 1/2 schrittweise hinter Manifeste gestellt.

---

## 8. Was bewusst _nicht_ Teil dieser Architektur ist

- Eigener LLM-Trainings-Stack.
- Generische "Agentic AI"-Plattform mit beliebigen Tools out of the box.
- Offener Plugin-Marketplace ohne Capability-Review.
- Synchronous-only Workflow-Calls über Tenant-Grenzen.
- Cross-Tenant-Memory (auch nicht "anonymisiert").

---

## 9. Verhältnis zum bestehenden Code

- `src/core/ai-gateway` bleibt der LLM-Provider-Adapter und wird in Phase 1
  als ein Skill-Capability-Provider verfügbar gemacht (`llm:invoke`), nicht
  als globaler Direktzugriff.
- `src/core/access` bleibt RBAC-Quelle, wird vom Permissions-Layer gelesen.
- `src/core/usage` bleibt für Metering. Runtime-Executions schreiben dort
  zusätzlich Verbrauchspunkte (`runtime.execution`-Meter).
- Bestehende Edge Functions (z. B. `gdpr-audit`, `cookie-scan`) werden
  **nicht** sofort migriert. Sie laufen weiter. Eine Migration findet erst
  statt, wenn eine Application sie über die Runtime aufruft.

---

*Letzte Aktualisierung: Mai 2026 — Status: Entwurf, Phase 0.*
