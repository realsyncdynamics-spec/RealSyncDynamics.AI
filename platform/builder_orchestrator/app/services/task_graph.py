"""Aufbau und Speicherung des Multi-Agent-Task-Graphen.

Der Graph ist ein DAG, kein starrer Strang: Planner → Architect → (Coder je
Modul) → DevOps → Governance. Die Coder-Ebene entsteht erst zur Laufzeit, weil
der Modulschnitt aus dem Architect-Ergebnis kommt (siehe
`TaskGraph.insert_spawned`).

Die Governance-Task ist immer der letzte Knoten und nie überspringbar — sie
trägt den Gate-Check gegen das Governance-Backend.
"""

from __future__ import annotations

from typing import List, Optional

from ..schemas import AgentTask, BuildSpec, GovernanceContext, TaskGraph
from .repository import get_repository

# Tasks mit Außenwirkung brauchen mehr Zeit und weniger Versuche als
# LLM-Aufrufe: ein Deployment ist teuer und darf nicht blind wiederholt werden.
DEVOPS_MAX_ATTEMPTS = 2
DEVOPS_TIMEOUT_SECONDS = 600.0
AGENT_TIMEOUT_SECONDS = 180.0


def build_graph(spec: BuildSpec, project: GovernanceContext) -> TaskGraph:
    """Erzeugt den Task-Graphen für eine BuildSpec.

    Die Risikoklasse wandert als Input in jede Task — die Agenten müssen
    wissen, unter welchem Compliance-Regime sie generieren (z.B. verpflichtender
    Transparenzhinweis bei `limited`, Model Card bei `high`).
    """
    common_input = {
        "project_id": project.project_id,
        "risk_tier": project.risk_tier,
        "required_gates": ",".join(project.required_gates),
        "target_stack": spec.target_stack,
        "jurisdiction": spec.jurisdiction or "eu",
    }

    planner = AgentTask(
        id="task_planner",
        agent_type="planner",
        input={**common_input, "prompt": spec.prompt, "description": spec.description},
        depends_on=[],
        timeout_seconds=AGENT_TIMEOUT_SECONDS,
    )
    architect = AgentTask(
        id="task_architect",
        agent_type="architect",
        input={**common_input},
        depends_on=[planner.id],
        timeout_seconds=AGENT_TIMEOUT_SECONDS,
    )
    # DevOps hängt zunächst direkt am Architect. Sobald der Architect seine
    # Coder-Tasks spawnt, werden sie hier automatisch dazwischengehängt —
    # DevOps wird damit zum Fan-in über alle Module.
    devops = AgentTask(
        id="task_devops",
        agent_type="devops",
        input={**common_input},
        depends_on=[architect.id],
        max_attempts=DEVOPS_MAX_ATTEMPTS,
        timeout_seconds=DEVOPS_TIMEOUT_SECONDS,
        idempotency_key=f"{project.project_id}:deploy",
        # Außenwirkung: baut und deployt — nicht mitten im Lauf abschießen.
        interruptible=False,
    )
    governance = AgentTask(
        id="task_governance",
        agent_type="governance",
        input={**common_input},
        depends_on=[devops.id],
        max_attempts=1,
        idempotency_key=f"{project.project_id}:activate",
        # Außenwirkung: aktiviert im Inventar und meldet Telemetrie.
        interruptible=False,
    )

    graph = TaskGraph(
        project_id=project.project_id,
        tasks=[planner, architect, devops, governance],
    )

    # "unacceptable" (Art. 5 AI Act): gar nicht erst bauen — alle
    # produzierenden Tasks werden sofort blockiert. Die Governance-Task bleibt
    # bestehen, damit der Befund im Prüfpfad landet.
    if project.risk_tier == "unacceptable":
        for task in graph.tasks:
            if task.agent_type != "governance":
                task.status = "blocked"
                task.output = {"reason": "Verbotene Praktik nach Art. 5 EU AI Act"}

    return graph


def build_coder_tasks(graph: TaskGraph, spawner_id: str, modules: List[str]) -> List[AgentTask]:
    """Baut je Modul eine Coder-Task — **ohne** sie einzuhängen.

    Der Architect gibt sie über `AgentResult.spawn` zurück; einhängen und
    persistieren macht der Scheduler. Würde der Agent selbst einhängen, hätte
    der Scheduler keine Gelegenheit, die neuen Zeilen zu schreiben.
    """
    spawner = graph.by_id(spawner_id)
    base_input = dict(spawner.input) if spawner else {}

    return [
        AgentTask(
            id=f"task_coder:{module}",
            agent_type="coder",
            input={**base_input, "module": module},
            depends_on=[spawner_id],
            timeout_seconds=AGENT_TIMEOUT_SECONDS,
        )
        for module in modules
    ]


def spawn_coder_tasks(graph: TaskGraph, spawner_id: str, modules: List[str]) -> List[AgentTask]:
    """Baut die Coder-Tasks und hängt sie direkt ein (für Tests und Skripte)."""
    return graph.insert_spawned(spawner_id, build_coder_tasks(graph, spawner_id, modules))


async def get_graph(project_id: str) -> Optional[TaskGraph]:
    return await get_repository().get(project_id)


async def save_graph(graph: TaskGraph) -> None:
    """Schreibt den kompletten Graphen (Anlage, Expansion)."""
    await get_repository().save(graph)


async def save_task(project_id: str, task: AgentTask) -> None:
    """Schreibt genau eine Task — der Normalfall im Scheduler.

    Wichtig gegenüber `save_graph`: Zwei nebenläufige Tasks würden sich beim
    Zurückschreiben des ganzen Graphen gegenseitig überschreiben.
    """
    await get_repository().save_task(project_id, task)


async def save_tasks(project_id: str, tasks: List[AgentTask]) -> None:
    await get_repository().save_tasks(project_id, tasks)


async def set_cancelled(project_id: str, cancelled: bool = True) -> None:
    await get_repository().set_cancelled(project_id, cancelled)


def reset() -> None:
    """Nur für Tests — leert den prozesslokalen Speicher."""
    repository = get_repository()
    if hasattr(repository, "reset"):
        repository.reset()  # type: ignore[attr-defined]
