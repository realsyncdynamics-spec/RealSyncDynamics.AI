"""Aufbau und Speicherung des Multi-Agent-Task-Graphen.

Der Graph ist bewusst deterministisch: Planner -> Architect -> Coder -> DevOps
-> Governance. Erst die Governance-Task quittiert den Build gegen das
CI/CD-Gate; sie hängt an allen produzierenden Tasks.

TODO(Persistenz): `_GRAPHS` gegen Supabase-Tabelle `enterprise_agent_runs`
tauschen, damit Läufe Neustarts überleben.
"""

from __future__ import annotations

from typing import Dict, Optional

from ..schemas import AgentTask, BuildSpec, GovernanceContext, TaskGraph

# project_id -> TaskGraph
_GRAPHS: Dict[str, TaskGraph] = {}


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
        status="pending",
        depends_on=[],
    )
    architect = AgentTask(
        id="task_architect",
        agent_type="architect",
        input={**common_input},
        status="pending",
        depends_on=[planner.id],
    )
    coder = AgentTask(
        id="task_coder",
        agent_type="coder",
        input={**common_input},
        status="pending",
        depends_on=[architect.id],
    )
    devops = AgentTask(
        id="task_devops",
        agent_type="devops",
        input={**common_input},
        status="pending",
        depends_on=[coder.id],
    )
    governance = AgentTask(
        id="task_governance",
        agent_type="governance",
        input={**common_input},
        status="pending",
        depends_on=[devops.id],
    )

    graph = TaskGraph(
        project_id=project.project_id,
        tasks=[planner, architect, coder, devops, governance],
    )

    # "unacceptable" (Art. 5 AI Act): gar nicht erst bauen — alle
    # produzierenden Tasks werden sofort blockiert.
    if project.risk_tier == "unacceptable":
        for task in graph.tasks:
            if task.agent_type != "governance":
                task.status = "blocked"
                task.output = {"reason": "Verbotene Praktik nach Art. 5 EU AI Act"}

    _GRAPHS[project.project_id] = graph
    return graph


async def get_graph(project_id: str) -> Optional[TaskGraph]:
    return _GRAPHS.get(project_id)


def save_graph(graph: TaskGraph) -> None:
    _GRAPHS[graph.project_id] = graph


def reset() -> None:
    """Nur für Tests."""
    _GRAPHS.clear()
