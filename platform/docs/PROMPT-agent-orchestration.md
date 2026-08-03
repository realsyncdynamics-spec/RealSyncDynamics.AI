# Folge-Prompt: Agent-Orchestration vertiefen (`task_graph` + `agent_runner`)

Fokussierter Prompt für den nächsten Schritt nach dem Monorepo-Draft. Kopierbar
in Claude Code, im Verzeichnis `platform/`.

Der Prompt ist bewusst an den bestehenden Verträgen aufgehängt
(`builder_orchestrator/app/schemas.py`), damit die Ausarbeitung den vorhandenen
Code ersetzt statt ein zweites System daneben zu bauen.

---

## Prompt (zum Reinkopieren)

Du arbeitest im Monorepo unter `platform/`. Der Builder-Orchestrator hat bereits
einen funktionierenden, aber bewusst flachen Task-Graph. Deine Aufgabe ist es,
**ausschließlich die Orchestrierungsschicht** zu vertiefen —
`app/services/task_graph.py` und `app/services/agent_runner.py`. Die
FastAPI-Endpoints, das Governance-Backend und die Agenten-Stubs bleiben in ihrer
Rolle bestehen; Änderungen dort nur, wo die Orchestrierung sie erzwingt.

### Ausgangslage (nicht neu erfinden, sondern aufbauen)

Vorhandene Verträge in `builder_orchestrator/app/schemas.py`:

```python
TaskStatus = Literal["pending", "running", "completed", "failed", "blocked"]

class AgentTask(BaseModel):
    id: str
    agent_type: str            # planner | architect | coder | devops | governance
    input: Dict[str, str]
    output: Optional[Dict[str, str]]
    status: TaskStatus
    depends_on: List[str]

class TaskGraph(BaseModel):
    project_id: str
    tasks: List[AgentTask]
    def by_id(self, task_id) -> Optional[AgentTask]
    def ready_tasks(self) -> List[AgentTask]   # pending + alle Vorgänger completed
```

Aktueller Stand:

- `task_graph.build_graph` erzeugt eine **starre Kette** Planner → Architect →
  Coder → DevOps → Governance und legt sie in einem Modul-Dict `_GRAPHS` ab.
- `agent_runner.enqueue_initial_tasks` setzt nur `pending` → `running`.
- `agent_runner.run_task` existiert als Referenz, wird von niemandem aufgerufen.
- `AGENT_DISPATCH` mappt `agent_type` → Handler; der `governance`-Typ hat
  bewusst keinen Handler, weil er über `clients/rsd_client.gate_check` läuft.

### Was du bauen sollst

**1. Graph statt Kette.**
`build_graph` soll einen echten DAG erzeugen, in dem unabhängige Arbeit parallel
laufen kann. Konkret mindestens:

- Der Coder-Schritt fächert nach Modulen auf (`task_coder:<modul>`), abgeleitet
  aus dem Architect-Output. Da der Architect zur Graph-Bauzeit noch nicht
  gelaufen ist, brauchst du **dynamische Expansion**: eine Task darf zur Laufzeit
  Nachfolger-Tasks in den Graph einhängen. Definiere dafür einen expliziten
  Vertrag (z.B. `AgentResult.spawn: List[AgentTask]`) statt impliziter Mutation.
- Der DevOps-Schritt ist ein Fan-in: er hängt an allen Coder-Tasks.
- Die Governance-Task bleibt der letzte Knoten und ist nie überspringbar.

Ergänze `TaskGraph` um die dafür nötigen Helfer (Zyklusprüfung beim Einhängen,
topologische Sortierung, `terminal_state()`).

**2. Fehler- und Blockier-Propagierung.**
Heute bleibt bei einem `failed`-Task der Rest auf `pending` stehen — der Graph
hängt still. Implementiere:

- Nachfolger eines `failed`/`blocked` Tasks werden `blocked` mit einer
  nachvollziehbaren `output["reason"]` (welche Task, welcher Grund).
- Ein Graph hat einen abgeleiteten Gesamtstatus
  (`running` | `completed` | `failed` | `blocked`), berechnet aus den Tasks —
  nicht separat gespeichert, um Divergenz zu vermeiden.

**3. Retries, Timeouts, Idempotenz.**
- Pro Task konfigurierbare `max_attempts` und `attempt`-Zähler im Modell.
- Exponentielles Backoff zwischen Versuchen.
- Harte Zeitgrenze pro Task; Überschreitung ⇒ `failed` mit `reason="timeout"`.
- **Nicht wiederholbar** sind Tasks mit Außenwirkung: der DevOps-Task deployt und
  ruft das Gate. Führe einen Idempotenz-Schlüssel ein (z.B. `build_hash`), damit
  ein Retry keinen zweiten Gate-Eintrag und kein zweites Deployment erzeugt.

**4. Echte Ausführung statt Statuswechsel.**
`agent_runner` bekommt eine Scheduler-Schleife, die
`ready_tasks()` abarbeitet, mit begrenzter Nebenläufigkeit
(`asyncio.Semaphore`, Limit über ENV). Anforderungen:

- Ein Worker-Einstiegspunkt, der unabhängig vom HTTP-Request läuft
  (`asyncio.TaskGroup` im FastAPI-Lifespan reicht als erster Schritt; die
  Ablösung durch eine externe Queue soll ohne Umbau der Aufrufer möglich sein —
  halte die Queue hinter einem schmalen Interface).
- Cancellation: ein laufender Graph muss abbrechbar sein
  (`POST /api/v1/builder/cancel`), laufende Tasks werden `failed`
  mit `reason="cancelled"`.
- Kein Doppel-Dispatch: eine Task darf nie zweimal gleichzeitig laufen, auch
  nicht wenn die Schleife mehrfach angestoßen wird.

**5. Agenten-Vertrag schärfen.**
Heute geben Handler `Dict[str, str]` zurück. Ersetze das durch ein typisiertes
`AgentResult` (Pydantic) mit `output`, `spawn`, `metrics` (Tokens, Dauer,
Modell) und `retryable: bool`. Der LLM-Aufruf selbst bleibt Stub — aber der
Vertrag muss so stehen, dass die spätere Integration nur den Handler-Körper
füllt. Ergänze eine Validierungsschleife: wenn der Agent kein gültiges JSON nach
Schema liefert, ein begrenzter Repair-Versuch, danach `failed`.

**6. Prüfpfad (nicht optional).**
Jeder Agentenlauf wird protokolliert: `project_id`, `task_id`, `agent_type`,
`attempt`, Modell, Tokenverbrauch, Dauer, Ergebnisstatus. Zielbild ist die
Tabelle `ai_tool_runs` der Hauptplattform. Solange die Persistenz fehlt: ein
Modul `services/audit_log.py` mit demselben Interface, das vorerst in den
Ringpuffer schreibt — der Austausch gegen die DB darf keine Aufrufer berühren.

**7. Governance-Kopplung erhalten.**
Die Fail-Closed-Eigenschaften dürfen nicht verlorengehen — sie sind der Zweck
des Systems:

- Ohne erreichbares Governance-Backend entsteht kein Graph (heute `502`).
- Bei `risk_tier == "unacceptable"` läuft kein produzierender Task.
- Der DevOps-Task deployt nur nach `approved`/`warning` vom Gate.

Ergänze: nach erfolgreichem Deployment ruft die Governance-Task
`/api/v1/inventory/activate` und meldet ein Telemetrie-Event. Schreibe einen
Test, der beweist, dass ein `blocked`-Gate kein `activate` auslöst.

**8. Observability.**
Ein Span pro Task-Ausführung, Kind des Graph-Spans, mit `task_id`, `agent_type`,
`attempt`, `status`, `risk_tier`. Wichtig: der Trace-Kontext muss die
Queue-Grenze überleben — propagiere ihn explizit, statt dich auf den
ambienten Kontext zu verlassen.

**9. Statusabfrage.**
`GET /api/v1/builder/task-status` bleibt. Ergänze einen Stream
(`GET /api/v1/builder/events?project_id=…`, SSE), der Task-Übergänge live
ausgibt — das Frontend soll den Fortschritt zeigen können, ohne zu pollen.

### Randbedingungen

- Persistenz bleibt In-Memory, **aber** hinter einem Repository-Interface
  (`GraphRepository` mit `get`/`save`/`list`), damit der Umstieg auf Postgres
  eine Implementierung und keine Umbauaktion ist. Zielschema-Skizze ergänzen.
- Keine neuen Dependencies außer, wenn unvermeidbar — begründe jede.
- Kommentare auf Deutsch, Terminologie wie im Repo („Prüfpfad").
- Tests mit pytest unter `builder_orchestrator/tests/`. Mindestens abgedeckt:
  dynamische Expansion, Fan-in, Fehler-Propagierung auf Nachfolger, Retry mit
  Backoff, Timeout, Cancellation, kein Doppel-Dispatch, Idempotenz des
  DevOps-Tasks, `blocked`-Gate löst kein `activate` aus.
- Die bestehenden 7 Tests in `tests/test_task_graph.py` dürfen angepasst werden,
  wo sich Verträge bewusst ändern — aber jede Anpassung im Commit begründen.

### Vorgehen

Zeig mir zuerst **kurz** den geplanten Schnitt: welche Module neu entstehen,
welche Signaturen sich ändern, und wo du dynamische Expansion und Queue-Grenze
ansetzt. Danach implementieren, Tests grün fahren, Ergebnis mit tatsächlicher
Testausgabe berichten. Was du nicht umsetzt, benenne explizit — nicht
stillschweigend weglassen.

---

## Warum dieser Schnitt

Die vier Stellen, an denen der aktuelle Draft am schnellsten bricht, sobald echte
Agenten laufen:

1. **Starre Kette** — echter Code-Gen fächert nach Modulen auf; ohne dynamische
   Expansion presst man das in einen einzigen Coder-Task.
2. **Stiller Stillstand** — ein `failed` Task lässt den Graph hängen, ohne dass
   jemand es merkt.
3. **Retry ohne Idempotenz** — der DevOps-Task hat Außenwirkung (Gate-Eintrag,
   Deployment); ein naiver Retry erzeugt Duplikate im Prüfpfad.
4. **Kein Prüfpfad über Agentenläufe** — genau das, was die Plattform von ihren
   Kunden verlangt, fehlt im Builder selbst.
