# platform/ — AI-App-Builder + Governance-Backend

Erster Monorepo-Draft: ein App-Builder-Orchestrator mit Multi-Agent-Task-Graph,
der **nicht ohne Governance-Freigabe baut**, und ein Governance-Backend nach
Vorbild von RealSyncDynamicsAI (EU AI Act / DSGVO, CI/CD-Gate, Runtime-Telemetrie).

Der Ordner ist in sich geschlossen: `cd platform && docker compose up --build`.
Er lässt sich unverändert in ein eigenes Repo kopieren (dann wird `platform/`
zum Repo-Root).

## Services

| Service                | Port | Traefik-Host        | Zweck |
|------------------------|------|---------------------|-------|
| `builder_orchestrator` | 8001 | `builder.localhost` | BuildSpec → Task-Graph → Agenten |
| `governance_backend`   | 8002 | `rsd.localhost`     | Registry, Risiko-Einstufung, CI/CD-Gate, Telemetrie |
| `nextjs_frontend`      | 3000 | `app.localhost`     | Builder-Stub + Governance-Cockpit-Stub |
| `supabase_db`          | 5432 | –                   | Postgres 16 (Zielschema, noch ungenutzt) |
| `traefik`              | 80   | `:8080` Dashboard   | Reverse Proxy |

## Ablauf

```
BuildSpec ──▶ builder_orchestrator
                 │ 1. register_project ──▶ governance_backend
                 │                          risk_evaluator → risk_tier + required_gates
                 │ 2. task_graph.build_graph(spec, project)
                 │ 3. agent_runner.run_graph  (Scheduler, nebenläufig)
                 ▼
       planner ─▶ architect ─┬─▶ coder:auth ─┐
                             ├─▶ coder:data ─┼─▶ devops ─▶ governance
                             └─▶ coder:ui   ─┘
                                              │
                        /api/v1/governance/gate-check
                        gate_engine → approved | warning | blocked
                        blocked ⇒ kein Deployment ⇒ keine Aktivierung
```

Die Coder-Ebene steht zur Bauzeit noch nicht fest — der Modulschnitt kommt aus
dem Architect-Ergebnis. Die Tasks werden zur Laufzeit **zwischen Spawner und
dessen Abhängige** eingehängt (`TaskGraph.insert_spawned`), wodurch DevOps
automatisch zum Fan-in über alle Module wird, ohne die Modulzahl vorab zu kennen.

Drei Stellen sind bewusst Fail-Closed:

- Ist das Governance-Backend nicht erreichbar, antwortet `create-spec` mit
  `502` — es entsteht kein Graph ohne Risiko-Einstufung.
- Ist ein Projekt als `unacceptable` eingestuft (Art. 5 EU AI Act), werden alle
  produzierenden Tasks sofort blockiert und das Gate blockiert jeden Build.
- Blockiert das Gate, scheitert der DevOps-Task; die Governance-Task ist sein
  Nachfolger und wird mitblockiert — ein blockierter Build kann im Inventar
  also gar nicht als produktiv erscheinen. Abgesichert durch
  `test_blockiertes_gate_loest_keine_aktivierung_aus`.

## Orchestrierung

| Eigenschaft | Umsetzung |
|---|---|
| Nebenläufigkeit | `asyncio.Semaphore`, Limit über `BUILDER_MAX_CONCURRENCY` (Default 4) |
| Kein Doppel-Dispatch | In-Flight-Register je Projekt, Refcount über parallele Scheduler |
| Retries | pro Task `max_attempts`, exponentielles Backoff (`BUILDER_RETRY_BASE_SECONDS`) |
| Nicht wiederholbar | Exceptions mit `retryable = False` (z.B. ein blockiertes Gate) |
| Timeout | pro Task `timeout_seconds`, Überschreitung ⇒ `failed` |
| Idempotenz | deterministischer `build_hash` + Entscheidungs-Cache — ein Retry erzeugt keinen zweiten Gate-Eintrag |
| Fehler-Propagierung | `propagate_block` blockiert alle (auch indirekten) Nachfolger |
| Abbruch | `POST /api/v1/builder/cancel` — graceful: laufende Tasks enden regulär, nichts Neues wird eingeplant |
| Prüfpfad | jeder Agentenlauf inkl. Fehlversuchen in `services/audit_log.py` |
| Tracing | Span je Task, Kontext reist als Carrier auf der Task über die Queue-Grenze |
| Fortschritt | `GET /api/v1/builder/events` (SSE) statt Polling |

## Start

```bash
cp .env.example .env
docker compose up --build
```

Danach:

- http://app.localhost — Frontend
- http://builder.localhost/docs — OpenAPI des Orchestrators
- http://rsd.localhost/docs — OpenAPI des Governance-Backends
- http://localhost:8080 — Traefik-Dashboard

`*.localhost` löst auf den meisten Systemen automatisch auf `127.0.0.1` auf.
Falls nicht, in `/etc/hosts` ergänzen. Alternativ direkt über die gemappten
Ports `:8001`, `:8002`, `:3000`.

## Smoke-Test ohne Frontend

```bash
# 1. Projekt registrieren (high risk: Gesundheitsdaten)
curl -s localhost:8002/api/v1/governance/register-project \
  -H 'content-type: application/json' \
  -d '{"project_name":"Triage","description":"Symptom-Checker",
       "data_types":["health"],"data_subjects":["patients"],
       "models":["claude-3-5-sonnet"],"llm_provider":"anthropic"}'
# => {"project_id":"prj_…","risk_tier":"high","required_gates":[…]}

# 2. Gate-Check ohne Model Card => blocked
curl -s localhost:8002/api/v1/governance/gate-check \
  -H 'content-type: application/json' \
  -d '{"project_id":"prj_…","build_hash":"sha256:abc","artifacts":
       {"tests_passed":true,"audit_logging_active":true,"model_card_included":false,
        "transparency_notice_enabled":true,"pii_scan_passed":true}}'
# => {"status":"blocked","severity":"high",…}

# 3. Build über den Orchestrator
curl -s localhost:8001/api/v1/builder/create-spec \
  -H 'content-type: application/json' \
  -d '{"project_name":"Portal","description":"Kundenportal","prompt":"Baue ein Kundenportal",
       "data_types":["email"],"data_subjects":["customers"],"models":["claude-3-5-sonnet"],
       "llm_provider":"anthropic","target_stack":"nextjs_supabase"}'
```

## Tests

```bash
cd governance_backend && pip install -r requirements.txt && pytest
cd builder_orchestrator && pip install -r requirements.txt && pytest
```

Abgedeckt: Risiko-Einstufung (alle vier Klassen, Drittland-Regel),
Gate-Engine (approved/warning/blocked, unbekanntes Projekt, Art.-5-Hard-Stop),
Graph-Aufbau und dynamische Expansion, Zyklusprüfung mit Rückbau,
Fehler-Propagierung, Retries/Timeout/Cancellation, kein Doppel-Dispatch,
Idempotenz des Gate-Aufrufs und der Nachweis, dass ein blockiertes Gate keine
Aktivierung auslöst.

## Risiko-Einstufung (Regelwerk)

| Regel | Ergebnis |
|-------|----------|
| Verbotene Praktik (Social Scoring, Emotionserkennung am Arbeitsplatz, …) | `unacceptable` |
| Sensible Datenart (Biometrie, Gesundheit, Strafregister, …) oder Annex-III-Domäne | `high` |
| Schutzbedürftige Betroffene + personenbezogene Daten | `high` |
| Generatives Modell / LLM-Provider oder personenbezogene Daten | `limited` |
| sonst | `minimal` |

Gate-Katalog je Klasse in `governance_backend/app/services/risk_evaluator.py`
(`GATES_BY_TIER`). Härte der Gates (blockierend vs. warnend) in
`gate_engine.py` (`BLOCKING_TIERS`, `ALWAYS_BLOCKING`).

## Was noch fehlt (TODO-Marker im Code)

- **LLM-Integration**: `builder_orchestrator/app/agents/*.py` sind Stubs mit
  fertigen System-Prompts und Output-Verträgen. Der Architect liefert einen
  festen Platzhalter-Modulschnitt (`auth`, `data`, `ui`), damit der Fan-out im
  Graph real ist und nicht nur theoretisch.
- **Persistenz**: In-Memory, aber hinter `GraphRepository` — der Umstieg auf
  Postgres ist eine zweite Implementierung, kein Umbau. Zielschema in
  `governance_backend/migrations/0001_init.sql` und als Skizze in
  `services/repository.py`.
- **Queue**: Der Scheduler läuft als `asyncio.Task` im selben Prozess. Die
  Queue-Grenze ist vorbereitet (Trace-Carrier auf der Task), aber noch nicht
  gezogen.
- **Hartes Cancel**: Ein laufender Agentenaufruf wird nicht abgeschossen.
- **Alarmierung**: Regionswechsel EU→Nicht-EU wird erkannt und geloggt, aber
  erzeugt noch keinen Incident (`telemetry_handler._handle_region_change`).
- **TLS**: Traefik läuft HTTP-only; ACME-Resolver fehlt.
- **Frontend**: zwei Stub-Seiten ohne Auth und ohne Design-System.
