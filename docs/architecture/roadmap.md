# Agent OS — Roadmap (intern)

> Ergänzt, **ersetzt nicht**, die produktorientierte `ROADMAP.md`. Letztere
> bleibt für Sales/Marketing maßgeblich.
>
> Diese Roadmap beschreibt die technische Reifung der Runtime-Architektur
> aus `docs/architecture/agent-os.md`. Phasen sind sequenziell, nicht
> parallel.

## Leitplanken

- Eine Phase gilt erst als abgeschlossen, wenn (a) die definierten Schichten
  in Production benutzt werden, (b) Audit-Trail vollständig ist, (c)
  Permissions durchgesetzt sind.
- Keine öffentliche Vermarktung als "KI-Betriebssystem" oder
  "Multi-Agent-Plattform" vor Phase 4.
- Jede Phase darf bestehende Edge Functions weiterhin laufen lassen. Nur
  was über die Runtime _muss_, wird migriert.

---

## Phase 0 — Foundations (jetzt)

**Ziel:** Klare Schichten, Typen, Validatoren. Noch kein Production-Wiring.

- [x] `docs/architecture/agent-os.md` — Architekturdokument
- [x] `docs/architecture/roadmap.md` — diese Datei
- [x] `src/core/runtime/` — Typdefinitionen für Skill, Agent, Execution,
      ApprovalGate, RuntimeEvent
- [x] `SkillRegistry` (in-memory) + `AgentValidator`
- [x] Permissions-, Memory-, Event-, Observability-Interfaces (nur
      Verträge, keine Implementierungen)
- [x] Supabase-Migration für `runtime_executions`, `runtime_approval_gates`,
      `runtime_events` (Schema + RLS, kein Cron)
- [x] Unit-Tests für AgentValidator

**Exit-Kriterium:** `npm run lint` und `npm run test` grün, Migration
applied in Staging.

---

## Phase 1 — Runtime + Permissions + Observability MVP

**Ziel:** Ein realer Skill (Read-only, kleinster Scope) läuft Ende-zu-Ende
über die Runtime, inkl. Audit-Trail.

- [ ] Executor mit synchroner Ausführung
- [ ] Capability-Enforcement gegen Skill-Manifest
- [ ] Approval-Gate-Persistenz + minimales Admin-UI für Pending Gates
- [ ] `runtime.execution`-Meter in `usage`-Layer eingebunden
- [ ] Ein produktiver Skill: `audit.cookie_scan.runtime` (Wrapper um
      bestehende Edge Function, ohne Logik-Duplikation)
- [ ] E2E-Test über Playwright: Skill triggern → Execution-Zeile prüfen →
      Audit-Trail vollständig

**Nicht in Phase 1:** Workflows, Scheduler, Retries, Memory-Knowledge-Store,
Multi-Skill-Chains.

**Exit-Kriterium:** Ein Tenant kann den Skill aufrufen, Execution + Events
sind nachvollziehbar, Capability-Verletzung führt zu sauberem Reject mit
Audit-Eintrag.

---

## Phase 2 — Workflow Engine

**Ziel:** Mehrere Skills kettbar, idempotent, mit Retries und Schedules.

- [ ] **Queue** — durable, Postgres-basiert, tenant-isoliert
- [ ] **Scheduled Triggers** — Cron pro Workflow, tenant-skopiert
- [ ] **Retries** — deklarative `retry_policy` (max_attempts, backoff_ms,
      retryable_errors). Nicht-idempotente Skills explizit markiert,
      kein Auto-Retry.
- [ ] **State Machine** — Zustände `pending → running →
      awaiting_approval → completed | failed | cancelled`, Transitionen
      nur über den Executor.
- [ ] Workflow-Manifest-Schema (Skill-Referenzen, Inputs/Mappings,
      Approval-Gates auf Workflow-Ebene)
- [ ] Erste Workflows: `audit.weekly_rescan`, `shopify.consent_rollout`

**Exit-Kriterium:** Ein Workflow mit ≥3 Skills läuft scheduled, mit
mindestens einem Approval-Gate dazwischen, ohne manuelle Eingriffe.

---

## Phase 3 — Memory & Events stabilisieren

**Ziel:** Working Memory + Knowledge Store sauber getrennt, Event-Bus
asynchron lauffähig.

- [ ] Working Memory mit TTL-Sweep
- [ ] Knowledge Store mit `kind`/`pii_class`-Pflichtfeldern
- [ ] Tenant-skopierte Vektor-Suche optional (pgvector), aber kein
      Default
- [ ] Event-Bus asynchron (LISTEN/NOTIFY oder Outbox-Pattern), idempotent
- [ ] Replay-Werkzeug für Audits

**Exit-Kriterium:** Zwei Applications teilen sich Knowledge tenant-isoliert
und können nach einem Crash Events replayen.

---

## Phase 4 — Multi-Agent Orchestration

**Ziel:** Mehrere Agents koexistieren pro Tenant, können sich gegenseitig
aufrufen, ohne dass Permissions oder Memory leaken.

- [ ] Planner/Executor/Critic-Rollen als opt-in
- [ ] Agent-to-Agent-Calls über die Runtime, nicht direkt
- [ ] Permission-Vererbung explizit (kein "ambient" trust)
- [ ] Konfliktlösung bei parallelen Writes auf denselben Memory-Eintrag

**Exit-Kriterium:** Ein Triage-Agent ruft einen Audit-Agent auf und die
Capabilities des aufgerufenen Agents sind eine echte Teilmenge dessen, was
der aufrufende Agent halten darf.

---

## Phase 5 — Developer Platform

**Ziel:** Externe Entwickler können kuratierte Skills veröffentlichen und
Workflows scripten. Keine offene Plugin-Welt — Review-pflichtig.

- [ ] **Public API** — `/v1/runtime/skills`, `/v1/runtime/executions`,
      `/v1/runtime/workflows`, `/v1/runtime/approvals`. Versioniert,
      OpenAPI-spec.
- [ ] **TypeScript SDK** — generiert aus OpenAPI; Typsicherheit für
      Skill-Inputs/-Outputs.
- [ ] **CLI** — `realsync skills validate|push`, `realsync runs tail`,
      `realsync approvals pending|decide`.
- [ ] **Skill-Manifest-Marketplace** — signierte Manifests,
      Capability-Audit, Veröffentlichungs-Workflow. Kein freier
      Self-Service ohne Review.
- [ ] Rate-Limits + Quotas an `usage`-Layer angebunden

**Exit-Kriterium:** Ein externer Partner kann einen Skill einreichen,
Review durchlaufen, und Tenants können ihn aktivieren — ohne dass interner
Code geändert werden muss.

---

## Bewusst _keine_ Phase

- "Marketplace launchen" als Marketingphase → erst wenn Phase 5 technisch
  steht.
- "AGI/Autonomy" oder "Agents replace humans"-Narrativ.
- Eigener LLM-Trainingsstack.

---

*Letzte Aktualisierung: Mai 2026 — Status: Phase 0 in Arbeit.*
