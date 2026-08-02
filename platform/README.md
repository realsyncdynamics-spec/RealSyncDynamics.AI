# platform/ — AI-App-Builder + Governance-Backend

Monorepo: ein App-Builder-Orchestrator mit Multi-Agent-Task-Graph,
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
| `supabase_db`          | 5432 | –                   | Postgres 16 (Zustand beider Backends) |
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
| Abbruch | `POST /api/v1/builder/cancel` — unterbrechbare Tasks werden hart abgebrochen, Tasks mit Außenwirkung laufen zu Ende |
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

Die Persistenz-Tests brauchen eine echte Datenbank und werden ohne sie
übersprungen:

```bash
docker run -d --rm -p 5433:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres
cd governance_backend   && pytest    # 56 statt 42
cd ../builder_orchestrator && pytest # 122 statt 108
```

Abgedeckt: Risiko-Einstufung (alle vier Klassen, Drittland-Regel),
Gate-Engine (approved/warning/blocked, unbekanntes Projekt, Art.-5-Hard-Stop),
Graph-Aufbau und dynamische Expansion, Zyklusprüfung mit Rückbau,
Fehler-Propagierung, Retries/Timeout/Cancellation, kein Doppel-Dispatch,
Idempotenz des Gate-Aufrufs, der Nachweis, dass ein blockiertes Gate keine
Aktivierung auslöst, sowie Regions- und Modelldrift inklusive Dispatch-Fehlern.
Für die LLM-Anbindung: die Begrenzung der Reparaturschleife (über die Zahl der
Provider-Aufrufe nachgewiesen, nicht über das Endergebnis), die Auflösung
verschachtelter Schemata, die Normalisierung der Modulnamen, die
Providerauswahl — und, gegen einen lokalen Fake-Endpunkt, die tatsächliche
Form des Claude-Requests inklusive der Parameter, die auf diesem Modell einen
400 auslösen würden. Für Workspace und Build-Messung: jeder Pfad-Ausbruch
einzeln (inklusive Symlink), die Limits, die Stabilität des Build-Hashes über
Wiederholungen, jeder der fünf Nachweise in beiden Richtungen — und dass ein
hängender Testlauf samt Kindprozessen innerhalb der Zeitgrenze abgebrochen
wird (über die gemessene Dauer nachgewiesen, nicht über die Rückgabe). Für
Auth und Mandantentrennung: Tokenprüfung, dass ein Nutzer-Token einen
gefälschten `X-Tenant-Id`-Header nicht überstimmt, dass ein Service-Token ohne
Mandantenangabe abgewiesen wird, dass der Mandant den Wechsel in einen
Hintergrundtask überlebt — und die Isolation selbst, jeweils **doppelt**: gegen
den In-Memory-Speicher und gegen echtes Postgres, weil nur Letzteres die
SQL-WHERE-Klauseln überhaupt ausführt.
Gegen eine echte Datenbank zusätzlich: Wiederholbarkeit beider Migrationen,
dass Projekte, Gate-Ergebnisse, Befunde und `at_risk`-Markierungen einen
Reconnect überstehen, und dass nebenläufige Tasks sich nicht gegenseitig
überschreiben. Für die Zustellung: Wiederholung nach Ausfall, Aufgabe nach dem
Versuchslimit, Einhaltung des Backoffs und dass Zugestelltes nicht erneut
versucht wird.

## Abbruch

`POST /api/v1/builder/cancel` bricht einen Build ab. Die Härte hängt am Task,
nicht am Abbruchbefehl — `AgentTask.interruptible`:

| Task | `interruptible` | Verhalten beim Abbruch |
|---|---|---|
| Planner, Architect, Coder | `True` | wird sofort abgeschossen |
| DevOps, Governance | `False` | läuft zu Ende |

Der Grund für die Unterscheidung: Ein LLM-Aufruf kostet für jede weitere
Sekunde Geld, und sein Ergebnis will nach dem Abbruch niemand mehr. Ein
DevOps-Task deployt dagegen und schreibt den Gate-Eintrag — ein halb
ausgerollter Zustand ist schlimmer als ein paar Sekunden Wartezeit. In beiden
Fällen wird **nichts Neues mehr eingeplant**, und der Abbruch landet im
Prüfpfad.

## Persistenz

Beide Services halten ihren Zustand in Postgres: das Governance-Backend den
Compliance-Nachweis (Inventar, Gate-Ergebnisse, Befunde), der Orchestrator die
Task-Graphen. Ein Prüfpfad, der beim Deploy verdampft, ist keiner.

**Tasks liegen in eigenen Zeilen, nicht als JSONB-Blob am Graphen.** Das ist
keine Stilfrage: Der Scheduler führt Tasks nebenläufig aus, und jede lädt sich
den Graphen selbst. In-Memory ist das dieselbe Objektreferenz; mit einer
Datenbank bekommt jede Task eine Kopie. Würde jede den ganzen Graphen
zurückschreiben, überschriebe die zuletzt fertige die `completed`-Zustände der
anderen — der Scheduler fände sie wieder als `pending` vor und würde sie **ein
zweites Mal ausführen**. Der Endzustand verrät das nicht, deshalb zählt
`test_nebenlaeufige_tasks_verlieren_keine_status` die Aufrufe. Gegen die naive
Variante schlägt er an: `{'auth': 3, 'data': 2, 'ui': 1}` statt je einmal.

Die Umschaltung hängt allein an `DATABASE_URL`:

| `DATABASE_URL` | Speicher | `/health` meldet |
|---|---|---|
| gesetzt und erreichbar | Postgres | `"storage": "postgres"` |
| leer | prozesslokal | `"storage": "memory"` |
| gesetzt, aber nicht erreichbar | prozesslokal + Fehler im Log | `"storage": "memory"` |

Der dritte Fall ist Absicht: Ein kurzzeitig nicht erreichbarer Datenbankserver
soll die Annahme von Telemetrie nicht verhindern. Dass der Dienst dann ohne
dauerhaften Prüfpfad läuft, steht im Log und unter `/health` — es passiert
also nicht still.

Beide Services wenden ihre Migration beim Start selbst an. Sie sind **wiederholbar**
(RLS-Policies werden vorher verworfen und neu angelegt, weil `create policy`
kein `IF NOT EXISTS` kennt) — der `docker-entrypoint-initdb.d`-Hook wäre
unzuverlässig, weil er nur beim allerersten Start eines leeren Volumes läuft.

## Laufzeitüberwachung

Registrierung und Gate decken den Weg **in** die Produktion ab. Danach greift
die Telemetrie: Was zur Laufzeit passiert, muss zu dem passen, was bewertet
wurde. Zwei Regeln erzeugen heute einen nachverfolgbaren Befund statt einer
Logzeile:

| Befund | Auslöser | Schwere |
|---|---|---|
| `region_drift` | Verarbeitung verlässt die EU (Kap. V DSGVO, ohne TIA) | `critical` bei `high`-Risiko, sonst `high` |
| `model_drift` | Modellversion in Produktion war nie registriert | `high` bei `high`/`limited`, sonst `medium` |

Ein Befund legt einen Incident an, setzt das Projekt im Cockpit auf
`at_risk` und feuert den n8n-Webhook (`GOVERNANCE_WEBHOOK_URL`). Ist kein
Webhook konfiguriert oder nicht erreichbar, bleibt der Incident trotzdem
bestehen und ist über `GET /api/v1/governance/incidents` sichtbar — ein
Zustellungsproblem darf keinen Befund verschlucken.

**Gescheiterte Zustellungen werden wiederholt.** Eine Hintergrundschleife
(`GOVERNANCE_REDELIVERY_INTERVAL`, Default 60s) nimmt sich fällige Fälle mit
exponentiellem Backoff erneut vor; `POST /api/v1/governance/incidents/redeliver`
stößt dasselbe von Hand an. Nach `GOVERNANCE_DISPATCH_MAX_ATTEMPTS` Versuchen
(Default 5) steht der Befund auf `dispatch_status = 'exhausted'` — aufgeben
heißt nicht vergessen: Er bleibt bestehen und ist über den Filter auffindbar,
statt still zu verschwinden.

Modelldrift wird bei **jedem** Event geprüft, nicht nur bei einem eigenen
Event-Typ: Ein stillschweigend getauschtes Modell meldet sich nicht selbst an.
Der Vergleich ist präfixbasiert, damit `claude-3-5-sonnet-20241022` als
registriert gilt, wenn `claude-3-5-sonnet` gemeldet wurde — ein anderer
Modellstamm dagegen nicht.

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

## LLM-Anbindung der Agenten

Planner, Architect und Coder rufen ein echtes Modell auf
(`builder_orchestrator/app/services/llm.py`). Drei Provider hinter einem
Vertrag:

| Provider | Wann aktiv | Modell |
|---|---|---|
| `anthropic` | `ANTHROPIC_API_KEY` gesetzt | `claude-opus-5`, adaptives Thinking, `effort` je Agent |
| `ollama` | `OLLAMA_BASE_URL` gesetzt | EU-lokal auf eigener Hardware, ohne US-Anbieter |
| `stub` | sonst | deterministisch, ohne Netz — `docker compose up` läuft ohne Zugangsdaten |

`LLM_PROVIDER` überschreibt die Erkennung. Welcher Provider läuft, steht unter
`GET /health` — ein Stack, der versehentlich mit dem Stub produktiv geht, soll
das nicht verstecken.

**Warum das JSON zweimal abgesichert ist.** Der Modulschnitt des Architects
wird direkt zu Coder-Tasks; eine halb geparste Antwort würde also den Graphen
bauen. Deshalb:

1. **Structured Outputs** (`output_config.format`) bei Claude — das Schema
   kommt aus demselben Pydantic-Modell, gegen das anschließend validiert wird
   (`app/agents/contracts.py`). Verschachtelte Modelle werden vorher inline
   aufgelöst und alle Felder als Pflicht markiert (`build_schema`).
2. **Begrenzte Reparaturschleife** für Provider ohne diese Garantie: Der
   konkrete Validierungsfehler geht zurück ans Modell — aber nur
   `LLM_MAX_REPAIRS` mal (Default 1). Ein Modell, das die Form nach dem ersten
   Hinweis nicht trifft, trifft sie auch nach dem fünften nicht, und jede Runde
   kostet einen vollen Aufruf.

Modulnamen aus der Modellantwort gehen in Task-IDs ein und werden deshalb
normalisiert und gedeckelt (`sanitize_modules`, `MAX_MODULES = 12`) — sonst
bestimmt die Antwort, wie viele parallele Coder-Läufe ein Build auslöst.

Fehlerbilder tragen `retryable`, das der Scheduler ausliest: Ein Netzfehler
wird wiederholt, eine Ablehnung des Modells (`stop_reason == "refusal"`) und
ein dauerhaft verletztes Schema nicht. Modell, Provider, Tokens und die Zahl
der Reparaturrunden landen je Lauf im Prüfpfad.

## Workspace und Build-Messung

Die vom Coder generierten Dateien liegen auf Platte
(`builder_orchestrator/app/services/workspace.py`), nicht im Task-Output. Im
Output steht das Manifest — welche Dateien entstanden sind. Jedes Modul
bekommt ein eigenes Unterverzeichnis, deshalb schreiben die parallel laufenden
Coder-Tasks konfliktfrei.

**Die Pfade kommen aus einer Modellantwort.** Deshalb steht vor jedem Schreiben
eine Prüfung: relative Pfade, keine absoluten, und nach `Path.resolve()` muss
das Ziel unterhalb des Projektverzeichnisses liegen. Die Auflösung ist der
Punkt — eine Textprüfung auf `..` ginge an einem Symlink vorbei. Dazu
Obergrenzen für Dateizahl und -größe. Ein Verstoß ist ein Fehler, keine
Warnung: Der Coder-Task scheitert nicht wiederholbar, der Befund steht im
Prüfpfad.

Auf dieser Grundlage misst der DevOps-Schritt die fünf Nachweise, die das Gate
verlangt (`services/build_checks.py`), statt sie wie bisher fest auf `false` zu
setzen:

| Nachweis | Wie gemessen |
|---|---|
| `transparency_notice_enabled` | Marker im generierten Code (Art. 50 EU AI Act) |
| `audit_logging_active` | Aufruf einer Protokollierung im generierten Code |
| `model_card_included` | Datei `MODEL_CARD.md` im Projekt |
| `pii_scan_passed` | keine Treffer der PII-/Secret-Muster |
| `tests_passed` | Exit-Code von `BUILDER_TEST_COMMAND` — sonst nichts |

`tests_passed` hängt bewusst **nur** an einem echten Testlauf: Vorhandene
Testdateien beweisen nichts. Ohne konfiguriertes Kommando bleibt der Nachweis
aus und das Gate blockiert — für einen Build ohne Testnachweis ist das die
richtige Antwort. Der Testlauf bekommt eine eigene Prozessgruppe, damit ein
Timeout den ganzen Prozessbaum trifft; ein überlebender Worker würde die Pipe
offen halten und den Timeout wirkungslos machen.

Je Nachweis wird die Begründung mitgeführt (`check_reasons` im Task-Output),
damit im Prüfpfad nicht nur steht, *dass* etwas erfüllt war, sondern *warum*.
Der `build_hash` ist der Hash über Pfade und Inhalte aller Dateien — dadurch
trifft ein Retry denselben Hash und ruft das bereits entschiedene Gate nicht
erneut auf.

## Authentifizierung und Mandantentrennung

Jeder `/api/v1/**`-Endpoint verlangt ein Bearer-Token; `/health` bleibt offen.
**Der Token bestimmt den Mandanten** — ein Client kann ihn beweisen, nicht
wählen:

| Tokenart | Mandant | Wofür |
|---|---|---|
| Nutzer-Token (`BUILDER_AUTH_TOKENS` / `GOVERNANCE_AUTH_TOKENS`) | fest zugeordnet, `X-Tenant-Id` wird ignoriert | normale API-Aufrufe |
| Service-Token (`GOVERNANCE_SERVICE_TOKEN`) | darf einen Mandanten per `X-Tenant-Id` behaupten — und **muss** es, sonst 400 | Orchestrator → Governance-Backend |

Der Service-Token existiert, weil der Orchestrator das Governance-Backend im
Hintergrund aufruft, lange nachdem die HTTP-Anfrage beantwortet ist. Die
Alternative wäre, das Nutzer-Token bis dahin aufzubewahren — also fremde
Zugangsdaten zu speichern.

Innerhalb des Prozesses liegt der Mandant in einem `ContextVar`. Das ist der
Grund, warum der Hintergrund-Scheduler ihn überhaupt hat: `asyncio.create_task`
kopiert den Kontext, der Wert reist ohne zusätzlichen Parameter in den Build.
Ein eigener Test hält das fest, weil es sonst eine Annahme über asyncio wäre.

**Die Trennung greift jetzt beim Lesen.** Vorher wurde `tenant_id` zwar in jede
Zeile geschrieben, aber nie abgefragt — ein fremdes `project_id` lieferte den
fremden Graphen aus, und die RLS-Policies der Migration waren wirkungslos, weil
beide Dienste mit einer Datenbankrolle arbeiten. Gefiltert wird jetzt in beiden
Backends, auch im In-Memory-Speicher: Sonst prüfte ein Test die Trennung nur
mit Datenbank, und der Default-Betrieb ist In-Memory. Zusätzlich sind die
Upserts mandantengeschützt (`where … tenant_id = excluded.tenant_id`), sonst
wäre `on conflict do update` ein Schreibweg in fremde Zeilen.

**Eine Ausnahme, bewusst und dokumentiert:** Die Wiederzustellung gescheiterter
Incident-Webhooks (`_faellige_zustellungen`) liest mandantenübergreifend. Sie
läuft aus dem Lifespan, also ohne Request und ohne Mandantenkontext; mit Filter
würde sie stillschweigend nur die Befunde eines Mandanten wiederholen — und ein
verschluckter Befund ist genau das, was sie verhindern soll.

**Ohne konfigurierte Token ist Auth aus.** Dann gilt der Default-Mandant, und
`GET /health` meldet `"auth": "disabled"`. Damit bleibt `docker compose up`
ohne Konfiguration startbar, ohne dass ein versehentlich offener Dienst das
verstecken kann.

```bash
# Mit Auth starten
export BUILDER_AUTH_TOKENS=tok_kunde_a:11111111-1111-1111-1111-111111111111
export GOVERNANCE_AUTH_TOKENS=tok_kunde_a:11111111-1111-1111-1111-111111111111
export GOVERNANCE_SERVICE_TOKEN=tok_service_geheim
docker compose up --build

curl -H "Authorization: Bearer tok_kunde_a" http://builder.localhost/api/v1/builder/task-status?project_id=...
```

## Was noch fehlt (TODO-Marker im Code)

- **Nutzerverwaltung**: Token stehen in einer Umgebungsvariablen, es gibt
  keine Rotation, kein Ablaufdatum und keine Rollen. Für echten Betrieb gehört
  dort ein Identity-Provider hin (OIDC/JWT), nicht eine Liste.
- **Horizontale Skalierung**: Der Scheduler hält seinen Laufzeitzustand im
  Prozess (`_INFLIGHT`, `_HANDLES`), die Task-Zustände liegen in Postgres.
  Zwei Repliken würden denselben Graphen doppelt fahren — das löst erst die
  externe Queue.
- **Container laufen als root** (kein `USER` im Dockerfile).
- **Container-Build**: Der DevOps-Schritt misst den Workspace, baut aber kein
  Image. `build_hash` ist der Hash über die generierten Dateien, nicht ein
  Image-Digest.
- **Deployment**: Der Endpoint ist abgeleitet, es wird keine Traefik-Route
  ausgerollt.
- **PII-Scanner**: Die Muster in `build_checks.py` finden Offensichtliches
  (E-Mail, IBAN, Schlüssel, Klartextpasswörter), keine Namen in Fixtures.
- **Token-Budget**: Verbrauch steht im Prüfpfad, bremst aber nichts.
- **Queue**: Der Scheduler läuft als `asyncio.Task` im selben Prozess. Die
  Queue-Grenze ist vorbereitet (Trace-Carrier auf der Task), aber noch nicht
  gezogen.
- **Incident-Zustellung**: Ein fehlgeschlagener Webhook wird am Incident
  vermerkt, aber nicht erneut versucht (kein Retry-Cron).
- **TLS**: Traefik läuft HTTP-only; ACME-Resolver fehlt.
- **Frontend**: zwei Stub-Seiten ohne Auth und ohne Design-System.
