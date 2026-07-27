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

> **Status: Entwurf, nicht implementiert.** Alles in diesem Abschnitt ist
> Zielbild für Phase 4, keine aktuelle Funktionalität. Erst relevant, wenn
> mehrere produktive Applications denselben Memory-Scope brauchen und sich
> Skills gegenseitig aufrufen sollen. Bis dahin: Skill → Skill innerhalb
> desselben Workflows reicht (§4). Diese Sektion existiert, damit Phase 4
> ein Plan ist, kein Vakuum — nicht als Erlaubnis, sie vorzuziehen (siehe
> Designprinzip 6, "Keine Feature-Flut").

### 5.1 Warum eine Organisationsform statt einem Alleskönner-Agenten

Ein einzelner, immer mächtigerer Agent ist keine Architektur, sondern ein
Wette auf ein bestimmtes Modell. Phase 4 verfolgt stattdessen eine
Unternehmensstruktur aus spezialisierten Rollen — analog zu Planner /
Executor / Critic aus der bisherigen Kurzfassung, nur konkretisiert:

- **Rolle ≠ Fähigkeit.** Eine Rolle (Teamleiter, Director, AGI Manager)
  beschreibt Verantwortung und Berichtslinie. Eine Fähigkeit (LLM, Agent,
  Multi-Agent) beschreibt, womit die Rolle aktuell besetzt ist. Das
  Organigramm bleibt stabil, auch wenn sich die Fähigkeit hinter einer
  Rolle ändert oder verbessert.
- **Jede Rolle bekommt genau die Skills, die ihr Verantwortungsbereich
  braucht** — keine globalen Tool-Berechtigungen. Deckt sich 1:1 mit CPS
  (`spec/runtime/capability-permission-standard.md`), das dieses Prinzip
  bereits für einzelne Agenten formalisiert.
- **Information verdichtet sich nach oben, sie stapelt sich nicht.** Jede
  Ebene fasst die Berichte der Ebene darunter zusammen, statt sie
  durchzureichen. Der AGI Manager entscheidet auf Basis aggregierter
  Kennzahlen, nie auf Basis von Rohberichten aller Einzelagenten.

### 5.2 Hierarchie → bestehende Runtime-Konzepte

Die Hierarchie ist **konzeptionell** — eine Organisationsansicht über
bestehende und geplante Runtime-Konzepte, keine neue Ausführungsschicht.
Jede Ebene bildet direkt auf ein bestehendes oder bereits geplantes Konzept
ab; es entsteht keine zweite Laufzeit neben Runtime Core / Workflow Engine.

```
  CEO                     Mandat, keine Runtime-Rolle
    │
  AGI Manager              Orchestrator-Rolle — liest AGGREGIERTE
    │                       runtime_events / Workflow-Ergebnisse,
    │                       trifft Freigabe-Entscheidungen auf
    │                       Director-Ebene (Phase 4: Planner)
    │
  Directors                 Fachbereichs-Rollen (Governance, Security,
    │                       Compliance, Platform, Customer Success,
    │                       Intelligence) — je ein AgentDefinition-
    │                       Bündel mit eigenem skill_ids-Scope
    │
  Team Leads                aggregieren mehrere Executions/Events zu
    │                       einem Team-Bericht (Rollup, kein Rohdaten-
    │                       Durchreichen) — Phase 4: Critic-Rolle
    │
  Spezialisierte Agenten    heutige AgentDefinition (Skills + Policies
    │                       + Memory-Scope + Permissions je Tenant)
    │
  Skills                    heutige SkillManifest + Handler (§3.1)
    │
  Runtime Executor          heutiger Executor (§3.1) — UNVERÄNDERT:
                            Permission-Check → Approval-Gate-Check →
                            Handler-Call → Event-Emit → Persist Execution
```

Konsequenz: **Die Ausführung bleibt beim bestehenden Runtime Executor.**
Die Hierarchie darüber ist eine Sicht auf `AgentDefinition`-Gruppierungen,
Report-Rollups über `runtime_events` und Eskalationsregeln über
`runtime_approval_gates` — keine der oberen vier Ebenen bekommt eine
eigene Execution-Engine, eigenen Event-Bus oder eigene Approval-Tabelle.

### 5.3 Reporting-Kette

Jede Ebene liefert **maximal 10 Stichpunkte** pro Berichtszyklus und fasst
die Berichte der Ebene darunter zusammen, statt sie weiterzureichen:

```
Agent            → Team Lead     : täglich, ≤10 Punkte, roh aus runtime_events
Team Lead        → Director      : täglich/wöchentlich, ≤10 Punkte, Team-Rollup
Director         → AGI Manager   : wöchentlich + sofort bei severity=high/critical
AGI Manager      → CEO           : wöchentlich, Kennzahlen, keine Rohberichte
```

Diese Berichte sind **Ableitungen aus `runtime_events`**, keine eigene
Tabelle. Ein Rollup ist eine Abfrage (`name`, `severity`, `occurred_at`
gruppiert nach `agent_id`/`skill_id` über ein Zeitfenster), kein
persistenter Report-Datensatz. Sollte sich zeigen, dass Rollups zu teuer
oder zu verlustreich als Live-Query sind, ist eine materialisierte
Sicht (`runtime_events` → Aggregat) der additive nächste Schritt — keine
neue Quelltabelle.

### 5.4 Memory-Strategie

Phase 4 führt **keinen dritten Memory-Store** ein. Es nutzt die zwei
Stores aus §3.3:

- **Working Memory** bleibt exekutionsgebunden — eine Team-Lead- oder
  Director-Rolle liest nichts, was nicht über eine `runtime_execution`
  ihrer unterstellten Agenten sichtbar wurde.
- **Knowledge Store** ist, wo Phase 4 etwas Neues braucht: ein
  `kind: 'org_relation'`-Eintrag für Beziehungen, die über eine einzelne
  Execution hinaus gültig bleiben (siehe 5.5). Das bleibt eine Erweiterung
  des bestehenden Knowledge-Store-Vertrags (§3.3), keine neue Memory-Art.

### 5.5 Knowledge-Graph-Vision (innerhalb des bestehenden Knowledge Store)

Die im ursprünglichen Organisationsentwurf vorgeschlagene Wissensbasis
("Komponente → gehört zu → Team", "Fehler → behoben durch → Commit") ist
in Phase 4 **kein neues Tabellenpaar**, sondern ein `kind: 'org_relation'`
im bestehenden Knowledge Store: Knoten sind Pointer auf existierende
Entitäten (`runtime_executions.id`, ein Skill-Id, ein Git-Commit-SHA, eine
`ai_evidence_events`-Zeile), Kanten sind typisierte, zeitlich gültige
Beziehungen (`belongs_to`, `fixed_by`, `escalated_to`). Der Graph ist eine
**Navigationsschicht über bestehende Evidenz**, nie eine Zweitschrift der
Evidence Chain (ECS) — sicherheits- und compliance-relevante Fakten bleiben
ausschließlich in der Hash-Chain (`ai_evidence_events` /
`spec/runtime/evidence-chain.md`) verbindlich.

### 5.6 Browser Agent X07 — Rolle

X07 besetzt in der zukünftigen Hierarchie die Blatt-Ebene eines
"Platform"-Zweigs unter dem Platform Director. Sein Verantwortungsbereich
bleibt so eng wie heute umgesetzt (siehe
`docs/architecture/browser-agent-x07.md`): Chromium, DOM, Konsole,
Netzwerk, UI-Regressionen. Er beobachtet, er remediiert nicht. Schon heute
läuft er als regulärer Runtime-Core-Skill
(`src/core/runtime/skills/browser-monitoring.ts`) — Phase 4 ändert daran
nichts, sie gibt ihm nur einen Platz im Organigramm und einen Team Lead,
der seine Befunde zusammen mit anderen Platform-Agenten zu einem
Director-Report verdichtet.

### 5.7 AGI-Manager-Verantwortlichkeiten

Der AGI Manager ist der Name einer **Rolle**, kein Versprechen einer
bestimmten Modellfähigkeit (siehe Designprinzip 7, "Kein
Marketing-Overclaim"). Seine Zuständigkeiten, sobald Phase 4 beginnt:

- liest ausschließlich Director-Rollups (§5.3), nie Rohberichte einzelner
  Agenten — Kompression ist nicht optional.
- trifft Freigabe-/Ablehnungs-Entscheidungen für Eskalationen, die einen
  bestehenden `runtime_approval_gates`-Eintrag bereits ausgelöst haben —
  er ersetzt HRP (`spec/runtime/human-review-protocol.md`) nicht, er ist
  ein weiterer, informierter Entscheider *innerhalb* des HRP-Gates.
- entscheidet nie ohne strukturierten Bericht (kein Freitext-Chat als
  Entscheidungsgrundlage).
- besitzt keine eigene Skill-Ausführung — jede von ihm ausgelöste Aktion
  läuft durch den bestehenden Executor wie jede andere.

### 5.8 Bewusst offene Fragen für Phase 4

- Wie werden `AgentDefinition`-Gruppen (Team, Director) tatsächlich
  modelliert — ein Tag auf `AgentDefinition.memory_scope`, oder eine
  eigene, minimale Zuordnungstabelle? Beides ist additiv möglich; die
  Entscheidung wird erst mit dem ersten echten Mehr-Team-Anwendungsfall
  getroffen, nicht vorab.
- Wie verhält sich diese Hierarchie zur bereits bestehenden
  `spec/runtime/`-Spezifikationssuite (ACS/CPS/HRP/EVC/EM/OC) und zu
  `apps/agent-runtime/`? Diese Sektion beschreibt eine Organisationssicht
  *über* der Runtime; sie ersetzt keinen der zehn Standards. Eine formale
  Zuordnung (z. B. "Director = mehrere ACS-Agent-Contracts unter einem
  gemeinsamen `owner`") steht noch aus.
- Ab welcher Team-Anzahl lohnt sich eine materialisierte Rollup-Sicht
  gegenüber einer Live-Query über `runtime_events` (§5.3)?

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
- `src/core/runtime/skills/browser-monitoring.ts` ist der erste Skill, der
  direkt gegen `SkillRegistry`/`HandlerRegistry` registriert wird, ohne
  über `src/lib/skills/registry.ts` zu laufen — jenes Registry ist für
  chat-getriggerte LLM-Skills (Router + Prompt-Guardrails), Browser Agent
  X07 wird dagegen programmatisch/zeitgesteuert ausgeführt. Siehe
  `docs/architecture/browser-agent-x07.md`.

---

*Letzte Aktualisierung: Juli 2026 — Status: Entwurf, Phase 0/1 (§5 Phase 4
konkretisiert, nicht implementiert — siehe §5-Header).*
