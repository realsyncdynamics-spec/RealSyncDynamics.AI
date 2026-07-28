"""Ausführung der Agent-Tasks.

Aktuell ein Stub: Tasks werden in den Status `running` versetzt, aber noch
nicht ausgeführt. Die Dispatch-Tabelle unten ist der Anker für die spätere
LLM-Integration — jeder Agent liefert `dict[str, str]` als Output zurück, der
als Input in die Folge-Tasks fließt.

TODO(Queue): Ausführung in eine echte Queue (Redis/RQ, Celery oder
Supabase-Cron) auslagern; hier bleibt nur das Enqueue.
TODO(LLM): `run_task` echte Agenten aufrufen lassen und Ergebnisse
in `ai_tool_runs` protokollieren (Prüfpfad-Pflicht).
"""

from __future__ import annotations

import logging
from typing import Awaitable, Callable, Dict

from ..agents import architect, coder, devops, planner
from ..schemas import AgentTask, TaskGraph
from . import task_graph

logger = logging.getLogger(__name__)

# agent_type -> Handler. Signatur: (AgentTask) -> dict[str, str]
AGENT_DISPATCH: Dict[str, Callable[[AgentTask], Awaitable[Dict[str, str]]]] = {
    "planner": planner.run,
    "architect": architect.run,
    "coder": coder.run,
    "devops": devops.run,
}


async def enqueue_initial_tasks(graph: TaskGraph) -> TaskGraph:
    """Startet alle Tasks ohne offene Abhängigkeiten (i.d.R. der Planner)."""
    if all(t.status == "blocked" for t in graph.tasks if t.agent_type != "governance"):
        logger.warning("Graph %s ist blockiert — kein Task wird gestartet.", graph.project_id)
        task_graph.save_graph(graph)
        return graph

    for task in graph.ready_tasks():
        task.status = "running"
        logger.info("Task %s (%s) gestartet", task.id, task.agent_type)
        # TODO: hier statt Statuswechsel den Worker anstoßen:
        #   await queue.enqueue(run_task, graph.project_id, task.id)

    task_graph.save_graph(graph)
    return graph


async def run_task(project_id: str, task_id: str) -> AgentTask:
    """Führt eine einzelne Task aus und schaltet den Graphen weiter.

    Wird derzeit von keinem Scheduler aufgerufen — dient als Referenz für die
    Worker-Implementierung.
    """
    graph = await task_graph.get_graph(project_id)
    if graph is None:
        raise KeyError(project_id)

    task = graph.by_id(task_id)
    if task is None:
        raise KeyError(task_id)

    handler = AGENT_DISPATCH.get(task.agent_type)
    if handler is None:
        # Governance-Task läuft nicht über einen LLM-Agenten, sondern über den
        # Gate-Check gegen das Governance-Backend (siehe clients/rsd_client.py).
        task.status = "pending"
        task_graph.save_graph(graph)
        return task

    task.status = "running"
    try:
        task.output = await handler(task)
        task.status = "completed"
    except Exception as exc:  # pragma: no cover - Stub-Pfad
        logger.exception("Task %s fehlgeschlagen", task_id)
        task.status = "failed"
        task.output = {"error": str(exc)}

    # Folge-Tasks freischalten.
    for follower in graph.ready_tasks():
        follower.status = "running"

    task_graph.save_graph(graph)
    return task
