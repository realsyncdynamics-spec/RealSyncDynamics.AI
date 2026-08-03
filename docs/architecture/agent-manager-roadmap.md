# Agenten- & Manager-Infrastruktur — Roadmap

> **Internes Dokument.** Ergänzt `docs/architecture/agent-os.md` (Ziel-Architektur
> Runtime/Skills) und `docs/architecture/roadmap.md` (Runtime-Core-Phasen). Dieses
> Dokument beschreibt den **Ist-Zustand der Agenten-Landschaft** und die Roadmap
> zu einer **zentralen Manager-Schicht**, die die heute fragmentierten
> Agent-Subsysteme koordiniert. Kein Marketing-Dokument — Begriffe wie
> "Agent OS" / "Manager" bleiben intern (siehe Sprach-Leitlinie in
> `docs/runtime-status-matrix.md`).

**Stand:** 2026-07-28 · **Owner:** Produkt-/Runtime-Lead · **Bezug:** Phase 2
Production-Ready (siehe `CLAUDE.md`)

---

## 1. Warum dieses Dokument

Die Plattform hat über mehrere Ausbaustufen hinweg **vier unabhängige
Agenten-Subsysteme** angesammelt, jedes mit eigenem Scheduler, eigener
Run-Tabelle und eigener Fehlerbehandlung. Es gibt bislang **keine zentrale
Manager-Instanz**, die:

- weiß, welche Agenten in welchem Tenant aktiv sind,
- Health/SLO über alle Subsysteme hinweg sichtbar macht,
- Approval-Gates einheitlich routet,
- Kosten/Budget (LLM-Spend) subsystemübergreifend deckelt,
- bei Ausfall eines Subsystems eskaliert statt still zu scheitern.

Dieses Dokument macht die Fragmentierung explizit und definiert die Phasen,
um sie in eine gemeinsame Manager-Schicht zu überführen — additiv, ohne die
bestehenden Subsysteme zu brechen.

---

## 2. Ist-Zustand: vier parallele Agenten-Subsysteme

| # | Subsystem | Orchestrator | Run-/State-Tabellen | Agenten-Scope | Status |
|---|---|---|---|---|---|
| A | **Legacy Table-Scheduler** (`agent-scheduler`) | pg_cron → Edge Function, iteriert `agents` (enabled + Zeitfenster) | `agents` (aus `20260705180000_autonomous_agents_core.sql`); `agent_runs`/`agent_tasks` **wollte** dieselbe Migration ebenfalls anlegen, s. u. | 3 Typen: `governance`, `remediation`, `monitoring` — generische Compliance-Gap-Analyse | 🔴 vermutlich defekt — Schema-Kollision, s. u. (nicht 🟡, siehe Beleg) |
| B | **Agent OS Runtime (Phase B)** (`agent-os-runner`) | pg_cron (`hourly`/`daily`) → ein Runner, dispatcht an `deadlineSentinelRunner`, `monitoringSloRunner`, `governanceBriefRunner` | `agent_observations`, `agent_events`, `governance_alerts` (aus `20260526000000_agent_os_substrate.sql`) | Deadline-Sentinel (deterministisch), Monitoring-SLO (deterministisch), Hermes Governance-Brief (LLM, nur daily) | 🟢 deterministische Teile produktiv, LLM-Brief separat markiert |
| C | **Enterprise AI-OS Agents** (`enterprise-ai-os-agents-run`) | On-demand über Edge Function, kein eigener Cron | `enterprise_agent_runs` (aus `20260513400000_enterprise_agent_runs.sql`, erweitert `20260720110000_enterprise_agents_runs.sql`) | 7-Agenten-Registry: Discovery, Risk Classification, Policy Enforcement, Audit, Feedback Intelligence, Remediation, Workflow (`_shared/enterprise-ai-os-agents.ts`) | 🟢 Logik produktiv, `autonomyLevel` pro Agent deklariert, aber **kein** gemeinsamer Approval-Gate-Mechanismus mit B |
| D | **Growth-/Compliance-Agenten-Stack** | **n8n** auf Hostinger-VPS (SQLite für Workflow-Definitionen) | Supabase bleibt Datenwahrheit (`scan_runs`, `findings`, `workflow_runs`) | 5 Rollen: Growth Intelligence, Compliance Audit, Sales Conversion, Finance, DevOps Monitoring (`docs/growth-agent-stack.md`) | 🔴 Workflows **inaktiv** (Templates importiert, kein Echtbetrieb) |
| — | **Governance Agent** (`governance-agent`) | On-demand, kein Cron | `agent_sessions`, `agent_runs` (Chat-Turns) | Konversationeller Compliance-Assistent, tool-use-loop über `agent-tools.ts` | 🟢 produktiv — **und** faktischer Eigentümer des `agent_runs`-Schemas, s. u. |

**Konkreter Beleg der Fragmentierung — kein friedliches Nebeneinander,
sondern ein stiller Migrations-Konflikt:** `agent_runs` und `agent_tasks`
werden in **drei** Migrationen adressiert, chronologisch:

1. `20260516100000_governance_agent.sql` (16.05.) legt `agent_runs` **zuerst**
   an — Schema für Chat-Turns (`session_id`, `actor_user_id` NOT NULL,
   `user_message` NOT NULL, `llm_provider` NOT NULL, `llm_model` NOT NULL, …).
2. `20260526000000_agent_os_substrate.sql` (26.05.) legt `agent_tasks` und
   `agent_events` **zuerst** an — Schema für die Agent-OS-Task-Queue
   (`agent`, `task`, `priority`, `status`, `input`, `output`, …).
3. `20260705180000_autonomous_agents_core.sql` (05.07., Subsystem A) versucht
   **dieselben drei Tabellennamen** erneut anzulegen, aber jeweils in einem
   `DO $$ … IF NOT EXISTS (SELECT … information_schema.tables …) …$$`-Block.
   Da `agent_runs`/`agent_tasks`/`agent_events` zu diesem Zeitpunkt bereits
   existieren, sind diese Blöcke **No-ops** — Subsystem A's eigenes Schema
   wird nie angelegt. Nur `agents` selbst ist migrationsseitig kollisionsfrei.

**Praktische Konsequenz:** `agent-scheduler/index.ts` schreibt in
`executeAgent()` u. a. `agent_id`, `triggered_by`, `status`, `input_params`
nach `agent_runs` — Spalten, die im tatsächlich lebenden Schema (Governance-
Agent-Chat-Log) nicht existieren, während dessen eigene `NOT NULL`-Spalten
(`actor_user_id`, `user_message`, `llm_provider`, `llm_model`) fehlen.
Dasselbe Muster trifft `executeRemediationAgent()`s Insert nach `agent_tasks`
gegen das Agent-OS-Substrate-Schema. Beide Inserts sollten bei jedem Lauf mit
einem Postgres-Fehler abbrechen — geprüft wurde dies nicht per Live-Query
(kein DB-Zugriff aus diesem Review heraus), sondern rein migrationsseitig
über Spaltenvergleich; eine Verifikation gegen die echte Staging-DB steht
noch aus. Bis dahin gilt Status A als **vermutlich defekt, nicht als
aktiv** — dieser Fund ist selbst das beste Argument für M0: eine Registry
hätte "Subsystem A: 0 erfolgreiche Läufe" sofort sichtbar gemacht, statt
dass es sich hinter drei getrennten Migrationen versteckt.

**Konsequenz für Beobachtbarkeit:** Um heute den Zustand *aller* Agenten
eines Tenants zu sehen, müssen vier verschiedene Tabellen-Gruppen und ein
externes n8n-Interface geprüft werden. Es gibt keine einzelne Abfrage,
kein einzelnes Dashboard.

---

## 3. Ziel: Manager-Schicht (additiv, kein Rewrite)

Die Manager-Schicht ist **kein** fünftes Agenten-System. Sie liest/schreibt
gegen die bestehenden Subsysteme A–D und fügt eine dünne Koordinationsebene
hinzu:

```
┌──────────────────────────────────────────────────────────────────┐
│  Manager-Schicht (neu)                                            │
│  Registry · Unified Run-Ledger (View) · Health/SLO · Budget-Cap ·  │
│  Approval-Routing · Eskalation                                    │
├───────────┬───────────┬────────────────┬──────────────┬───────────┤
│ A         │ B         │ C              │ D            │ Gov-Agent │
│ Legacy    │ Agent OS  │ Enterprise     │ n8n Growth-  │ Chat-     │
│ Scheduler │ Runtime   │ AI-OS Agents   │ Stack        │ Agent     │
└───────────┴───────────┴────────────────┴──────────────┴───────────┘
```

Prinzipien (analog `docs/architecture/agent-os.md` §1):

1. **Kein Subsystem wird sofort migriert.** Der Manager liest zunächst nur
   (Read-Layer), bevor er irgendetwas steuert.
2. **Tenant-Isolation bleibt** — die Registry selbst ist `tenant_id`-skopiert
   und RLS-geschützt wie jede andere Tabelle.
3. **Ein Eskalationspfad statt vier.** Fehler aus A–D landen in derselben
   `governance_alerts`-Senke, die B bereits benutzt.
4. **Kein Overclaim.** Solange der Manager nur beobachtet und nicht steuert,
   heißt er intern "Agent Registry / Observability Layer", nicht "Multi-Agent
   Manager".

---

## 4. Roadmap-Phasen

### M0 — Registry & Unified Read-Layer (Read-only)

**Ziel:** Ein Ort, an dem sichtbar ist, welche Agenten (A–D) pro Tenant
existieren und wann sie zuletzt liefen — ohne ein bestehendes Subsystem
anzufassen.

- [ ] **Vorab-Klärung Subsystem A:** gegen Staging verifizieren, ob
      `agent-scheduler`s Inserts nach `agent_runs`/`agent_tasks` tatsächlich
      fehlschlagen (siehe Schema-Kollision, Abschnitt 2). Falls ja: A
      entweder auf ein eigenes, kollisionsfreies Tabellenpräfix umziehen
      (`legacy_agent_runs`/`legacy_agent_tasks`) oder — falls A ungenutzt
      ist — bewusst als inaktiv/retired markieren, **bevor** A in die
      Unified-View aufgenommen wird. Ein Union über eine Tabelle, die A gar
      nicht wie erwartet beschreibt, würde falsche Daten zeigen.
- [ ] `agent_registry`-View (oder Tabelle mit manuellem Seed): pro Agent
      `subsystem` (`legacy_scheduler` \| `agent_os_runtime` \|
      `enterprise_ai_os` \| `growth_stack` \| `governance_chat`),
      `agent_key`, `tenant_id`, `status`.
- [ ] SQL-View `agent_runs_unified` — `UNION ALL` über `agent_runs`
      (A, **erst nach obiger Klärung** — bis dahin schreibt A faktisch in
      den Governance-Agent-Chat-Log oder gar nicht),
      `agent_observations`/`agent_events` (B), `enterprise_agent_runs` (C).
      n8n (D) bleibt vorerst außen vor (kein direkter DB-Zugriff aus n8n auf
      Run-Ebene) und wird über `workflow_runs` gespiegelt, das D bereits
      schreibt.
- [ ] Read-only Admin-Seite `/app/agents` (oder Erweiterung von
      `GovernanceRuntime*`): Liste aller Agenten mit letztem Lauf, Status,
      Fehlerquote der letzten 24h.
- [ ] Keine Schreiblogik, kein Steuerungs-Endpoint.

**Exit-Kriterium:** Ein Tenant-Admin sieht auf einer Seite alle vier
Subsysteme mit letztem Lauf-Zeitstempel und Erfolgs-/Fehlerquote.

### M1 — Health/SLO + Eskalation

**Ziel:** Ausfälle in A, C, D werden **nicht mehr still verschluckt**,
sondern landen im selben Alert-Kanal wie B (`governance_alerts`, bereits
sichtbar unter `/app/alerts`).

- [ ] `monitoringSloRunner` (existiert bereits für B, siehe
      `_shared/agents/monitoringSloRunner.ts`) auf A und C erweitern: prüft
      "kein erfolgreicher Lauf seit X" pro registriertem Agent.
- [ ] n8n-Healthcheck (D, Workflow "stündlich" in `growth-agent-stack.md`)
      schreibt bei Fehler einen `governance_alerts`-Eintrag statt nur
      n8n-intern zu loggen.
- [ ] Fehlerquote pro Subsystem als Metrik in `runtime_executions`/
      `agent_runs_unified` aggregierbar (kein separater Metrik-Stack, siehe
      `agent-os.md` §3.5).

**Exit-Kriterium:** Ein Ausfall des Legacy-Schedulers (A) oder eines
n8n-Workflows (D) erzeugt denselben Alert-Typ wie ein Ausfall im Agent-OS-
Runtime (B), sichtbar am selben Ort.

### M2 — Budget-/Cost-Cap subsystemübergreifend

**Ziel:** LLM-Spend über alle Agenten hinweg gegen dasselbe Tenant-Budget
gedeckelt — heute prüft nur der Governance-Agent-Chat gegen
`_shared/llm-quota.ts`; Hermes-Brief (B) und Enterprise-Agents (C) haben
noch keinen gemeinsamen Cap.

- [ ] `llm-quota.ts`-Check als gemeinsamer Capability-Provider (`llm:invoke`,
      siehe `agent-os.md` §9) auch für `governanceBriefRunner` (B) und für
      LLM-nutzende Enterprise-Agents (C, aktuell alle Enterprise-Agents
      regelbasiert — sobald einer LLM nutzt, muss er hier einhaken).
- [ ] Quota-Verbrauch pro Subsystem in `agent_runs_unified` sichtbar
      (welcher Agent hat wie viel vom Monats-Budget verbraucht).

**Exit-Kriterium:** Ein Tenant kann sein LLM-Monatsbudget nicht durch
Kombination aus Chat + Hermes-Brief + Enterprise-Agents überschreiten.

### M3 — Approval-Routing vereinheitlichen

**Ziel:** Alle Aktionen mit `humanApprovalRequired: true` (siehe
`enterpriseAgents`-Registry, C) und alle risikobehafteten Runtime-Skills
(Phase 1, `agent-os.md` §3.4) landen in **derselben** Approval-Queue
(`governance-approvals`), nicht in getrennten Freigabe-UIs.

- [ ] Enterprise-Agents (C), die `status: 'requires_approval'` zurückgeben
      (Risk Classification, Feedback Intelligence, Remediation, Workflow),
      schreiben einen `governance_approvals`-Eintrag statt nur im
      Response-Payload zu stehen.
- [ ] Runtime-Approval-Gates (Phase 1 aus `docs/architecture/roadmap.md`)
      nutzen dieselbe Tabelle/UI wie C — kein zweites Freigabe-Postfach.
- [ ] Outreach-Gate (D, `_shared/outreach-gate.ts`) bleibt hart getrennt
      (Rechtsgrundlage-Check vor Approval, nicht danach) — wird **nicht**
      in die generische Approval-Queue verschoben, nur das Ergebnis
      (freigegeben/geblockt) wird gespiegelt.

**Exit-Kriterium:** Ein Admin arbeitet Approvals aus A–D über eine einzige
Queue ab, unabhängig davon, welches Subsystem sie erzeugt hat.

### M4 — Konsolidierung / Migrationsentscheidung

**Ziel:** Datenbasierte Entscheidung, ob A (Legacy-Scheduler) in B (Agent OS
Runtime) aufgeht, oder als eigenständiges, aber jetzt überwachtes Subsystem
bestehen bleibt.

- [ ] Auswertung aus M0–M3: Nutzungsvolumen, Fehlerquote, Tenant-Abdeckung
      pro Subsystem.
- [ ] Migrationsplan **nur** falls A signifikant genutzt wird UND
      Funktionslücke zu B besteht (aktuell: A deckt generische
      `compliance_gaps`-Analyse ab, die B nicht hat — vor Migration prüfen,
      ob dieser Anwendungsfall noch gebraucht wird oder inzwischen durch C
      abgedeckt ist).
- [ ] n8n (D) bleibt bewusst **außerhalb** einer Runtime-Migration —
      Workflow-Orchestrierung auf VPS-Ebene ist kein Kandidat für die
      Postgres-Runtime, bleibt aber an M1/M2 angebunden.

**Exit-Kriterium:** Für jedes Subsystem A–D existiert eine bewusste
Entscheidung — "bleibt eigenständig, aber überwacht" oder "wird migriert" —
keine unbeobachteten Alt-Systeme mehr.

---

## 5. Bewusst _keine_ Phase

- Ein fünftes, neues Agenten-Framework, das A–D ersetzt.
- Echtzeit-Steuerung (Manager pausiert/startet Agenten aktiv) vor M3 —
  vorher ist der Manager reiner Beobachter.
- n8n durch eine In-Repo-Workflow-Engine ersetzen, solange Phase 2
  (`docs/architecture/roadmap.md`) der Runtime-Core-Roadmap nicht produktiv
  Workflows fährt.
- Öffentliche Kommunikation als "Multi-Agent-Manager" oder "autonome
  Agenten-Flotte" (siehe Sprach-Leitlinie, `docs/runtime-status-matrix.md`)
  — bis M3 abgeschlossen ist, bleibt das Thema rein intern.

---

## 6. Referenzen

- `docs/architecture/agent-os.md` — Ziel-Architektur Runtime/Skills (Phase
  0–5, Skill-Ebene)
- `docs/architecture/roadmap.md` — Runtime-Core-Roadmap (Phasen 0–5)
- `docs/growth-agent-stack.md` — n8n-Orchestrator, Subsystem D im Detail
- `docs/runtime-status-matrix.md` — Reifegrad-Wahrheit für externe
  Kommunikation; "Agent Runtime"-Zeile referenziert diese Roadmap
- `supabase/functions/_shared/enterprise-ai-os-agents.ts` — Subsystem-C-Registry
- `supabase/functions/agent-os-runner/index.ts` — Subsystem-B-Runner
- `supabase/functions/agent-scheduler/index.ts` — Subsystem-A-Runner, mutmaßlich
  von der Schema-Kollision betroffen (Abschnitt 2)
- `supabase/migrations/20260516100000_governance_agent.sql`,
  `20260526000000_agent_os_substrate.sql`,
  `20260705180000_autonomous_agents_core.sql` — chronologischer Beleg der
  `agent_runs`/`agent_tasks`/`agent_events`-Migrationskollision (Abschnitt 2)

---

*Letzte Aktualisierung: 2026-07-29 — Status: M0 in Planung, kein Subsystem
migriert. Offener Punkt: Live-Verifikation der `agent_runs`/`agent_tasks`-
Schema-Kollision für Subsystem A gegen Staging (siehe Abschnitt 2) steht
noch aus.*
