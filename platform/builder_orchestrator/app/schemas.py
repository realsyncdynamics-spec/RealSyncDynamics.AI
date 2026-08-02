"""Pydantic-v2-Schemas des Builder-Orchestrators."""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from .validators import Description, Jurisdiction, ProjectId, ProjectName, Prompt, TargetStack


class BuildSpec(BaseModel):
    """Eingabe des Nutzers: was gebaut werden soll und mit welchen Daten."""

    project_name: ProjectName
    description: Description
    prompt: Prompt
    data_types: List[str] = Field(default_factory=list)
    data_subjects: List[str] = Field(default_factory=list)
    models: List[str] = Field(default_factory=list)
    llm_provider: Optional[str] = None
    jurisdiction: Jurisdiction = "eu"
    target_stack: TargetStack = "nextjs_supabase"


TaskStatus = Literal["pending", "running", "completed", "failed", "blocked"]

# Abgeleiteter Gesamtstatus eines Graphen. Bewusst nicht gespeichert, sondern
# aus den Tasks berechnet (siehe TaskGraph.overall_status) — ein zweiter
# Speicherort würde divergieren.
GraphStatus = Literal["pending", "running", "completed", "failed", "blocked"]

AgentType = Literal["planner", "architect", "coder", "devops", "governance"]


class GraphCycleError(ValueError):
    """Das Einhängen gespawnter Tasks hätte einen Zyklus erzeugt."""


class AgentTask(BaseModel):
    id: str
    agent_type: str  # siehe AgentType
    input: Dict[str, str] = Field(default_factory=dict)
    output: Optional[Dict[str, str]] = None
    status: TaskStatus = "pending"
    depends_on: List[str] = Field(default_factory=list)

    # --- Ausführungssteuerung ---
    attempt: int = 0
    max_attempts: int = 3
    timeout_seconds: float = 120.0

    # Kennzeichnet Tasks mit Außenwirkung (Deployment, Gate-Eintrag). Ein Retry
    # muss hier denselben Idempotenz-Schlüssel wiederverwenden, sonst entstehen
    # doppelte Einträge im Prüfpfad.
    idempotency_key: Optional[str] = None

    # Darf ein Abbruch diesen Task mitten im Lauf abschießen?
    #
    # Für einen LLM-Aufruf: ja — jede weitere Sekunde kostet Geld, und das
    # Ergebnis wird ohnehin verworfen. Für einen Task mit Außenwirkung: nein —
    # ein halb ausgerolltes Deployment oder ein angefangener Gate-Eintrag ist
    # schlimmer als ein paar Sekunden Wartezeit. Deshalb hängt die Härte des
    # Abbruchs am Task, nicht am Abbruchbefehl.
    interruptible: bool = True

    # Trace-Kontext, der die Queue-Grenze überlebt (W3C traceparent).
    otel_carrier: Dict[str, str] = Field(default_factory=dict)

    def is_terminal(self) -> bool:
        return self.status in ("completed", "failed", "blocked")


class AgentResult(BaseModel):
    """Rückgabe eines Agenten-Handlers.

    `spawn` erlaubt dynamische Expansion: Ein Agent, der erst zur Laufzeit
    weiß, wie viele Folge-Tasks nötig sind (z.B. der Architect, der den
    Modulschnitt festlegt), hängt sie hierüber in den Graphen ein.
    """

    output: Dict[str, str] = Field(default_factory=dict)
    spawn: List[AgentTask] = Field(default_factory=list)
    metrics: Dict[str, str] = Field(default_factory=dict)

    # Bewusst **kein** `retryable`-Feld: Ein Handler, der zurückkehrt, hat
    # Erfolg gehabt — da gibt es nichts zu wiederholen. Wiederholbarkeit
    # gehört an den Fehlerfall, und der wird geworfen: Der Scheduler liest
    # `retryable` am Exception-Objekt (siehe `_run_task`). Ein Feld hier hätte
    # nie eine Leseseite gehabt und genau das vorgetäuscht.


class TaskGraph(BaseModel):
    project_id: ProjectId
    tasks: List[AgentTask]

    # Wird von der Cancel-Route gesetzt; der Scheduler bricht daraufhin ab.
    cancelled: bool = False

    # --- Lookup ---

    def by_id(self, task_id: str) -> Optional[AgentTask]:
        return next((t for t in self.tasks if t.id == task_id), None)

    def ready_tasks(self) -> List[AgentTask]:
        """Tasks, deren Vorgänger alle abgeschlossen sind."""
        done = {t.id for t in self.tasks if t.status == "completed"}
        return [
            t for t in self.tasks if t.status == "pending" and set(t.depends_on).issubset(done)
        ]

    def dependents_of(self, task_id: str) -> List[AgentTask]:
        return [t for t in self.tasks if task_id in t.depends_on]

    # --- Zustand ---

    def overall_status(self) -> GraphStatus:
        """Gesamtstatus, aus den Tasks abgeleitet."""
        statuses = {t.status for t in self.tasks}
        if statuses == {"pending"}:
            return "pending"
        if "running" in statuses:
            return "running"
        if "failed" in statuses:
            return "failed"
        if "blocked" in statuses:
            # Blockiert nur, wenn nichts mehr laufen kann.
            return "blocked" if not self.ready_tasks() else "running"
        if statuses == {"completed"}:
            return "completed"
        return "running"

    def is_terminal(self) -> bool:
        """True, wenn kein Task mehr laufen kann."""
        if any(t.status == "running" for t in self.tasks):
            return False
        return not self.ready_tasks()

    # --- Mutation ---

    def topological_order(self) -> List[str]:
        """Task-IDs in Abhängigkeitsreihenfolge. Wirft bei einem Zyklus."""
        remaining = {t.id: set(t.depends_on) & {x.id for x in self.tasks} for t in self.tasks}
        order: List[str] = []
        while remaining:
            free = sorted(tid for tid, deps in remaining.items() if not deps)
            if not free:
                raise GraphCycleError(f"Zyklus im Graph {self.project_id}: {sorted(remaining)}")
            for tid in free:
                order.append(tid)
                del remaining[tid]
            for deps in remaining.values():
                deps.difference_update(free)
        return order

    def insert_spawned(self, spawner_id: str, new_tasks: List[AgentTask]) -> List[AgentTask]:
        """Hängt zur Laufzeit erzeugte Tasks zwischen Spawner und dessen Abhängige.

        Beispiel: Der Architect legt den Modulschnitt fest und spawnt je Modul
        eine Coder-Task. Der DevOps-Task hing bis dahin direkt am Architect und
        bekommt die Coder-Tasks automatisch als zusätzliche Vorgänger — der
        Fan-in stimmt, ohne dass die Modulzahl vorab bekannt sein muss.
        """
        if not new_tasks:
            return []

        existing_ids = {t.id for t in self.tasks}
        for task in new_tasks:
            if task.id in existing_ids:
                raise ValueError(f"Task-ID {task.id} existiert bereits")
            if not task.depends_on:
                task.depends_on = [spawner_id]

        # Bestehende Abhängige des Spawners ermitteln, bevor die neuen dazukommen.
        dependents = [t for t in self.dependents_of(spawner_id) if t.id not in {n.id for n in new_tasks}]

        self.tasks.extend(new_tasks)

        for dependent in dependents:
            for task in new_tasks:
                if task.id not in dependent.depends_on:
                    dependent.depends_on.append(task.id)

        # Zyklusprüfung erst nach dem Einhängen — wirft, bevor etwas läuft.
        try:
            self.topological_order()
        except GraphCycleError:
            # Rückbau, damit der Graph konsistent bleibt.
            new_ids = {n.id for n in new_tasks}
            self.tasks = [t for t in self.tasks if t.id not in new_ids]
            for dependent in dependents:
                dependent.depends_on = [d for d in dependent.depends_on if d not in new_ids]
            raise

        return new_tasks

    def propagate_block(self, task_id: str, reason: str) -> List[AgentTask]:
        """Blockiert alle (auch indirekten) Nachfolger eines gescheiterten Tasks.

        Ohne das bleibt der Graph nach einem `failed` still stehen: die
        Nachfolger warten auf ein `completed`, das nie kommt.
        """
        blocked: List[AgentTask] = []
        frontier = [task_id]
        seen = {task_id}

        while frontier:
            current = frontier.pop()
            for dependent in self.dependents_of(current):
                if dependent.id in seen or dependent.is_terminal():
                    continue
                seen.add(dependent.id)
                dependent.status = "blocked"
                dependent.output = {"reason": reason, "blocked_by": current}
                blocked.append(dependent)
                frontier.append(dependent.id)

        return blocked


class GovernanceContext(BaseModel):
    """Antwort des Governance-Backends, angereichert an den Graph."""

    project_id: str
    risk_tier: str
    required_gates: List[str] = Field(default_factory=list)


class CancelRequest(BaseModel):
    project_id: ProjectId
