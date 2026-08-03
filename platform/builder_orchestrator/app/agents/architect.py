"""Architect-Agent: leitet aus dem Backlog Datenmodell und Modulschnitt ab.

Input  (task.input): risk_tier, target_stack, jurisdiction (+ Planner-Output)
Output (task.output): schema_sql, modules, api_contract
Spawn:               je Modul eine Coder-Task

Dies ist die Stelle, an der der Graph seine Breite bekommt: Der Modulschnitt
steht erst nach diesem Lauf fest, deshalb werden die Coder-Tasks dynamisch
eingehängt statt zur Bauzeit geraten.

Damit ist es auch die Stelle, an der eine Modellantwort unmittelbar Struktur
erzeugt. `sanitize_modules` (siehe contracts.py) normalisiert die Namen, bevor
sie in Task-IDs wandern, und deckelt den Fan-out.
"""

from __future__ import annotations

import json
import logging
from typing import List

from ..schemas import AgentResult, AgentTask, TaskGraph
from ..services.llm import complete_json
from ..services.task_graph import build_coder_tasks
from .contracts import ArchitectOutput, sanitize_modules

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Du bist der Architect-Agent.
Entwirf aus dem Feature-Backlog ein Postgres-Schema und einen Modulschnitt.
Pflicht: jede Tabelle mit personenbezogenen Daten bekommt RLS und tenant_id.
Modulnamen kurz und kleingeschrieben (z.B. auth, billing, ui).
Antworte als JSON: schema_sql, modules[], api_contract[]."""

# Modulschnitt, wenn die Antwort keinen brauchbaren liefert (z.B. weil ohne
# API-Key der Stub-Provider antwortet). Bewusst mehr als eins, damit der
# Fan-out im Graph real ist und nicht nur theoretisch existiert.
FALLBACK_MODULES = ["auth", "data", "ui"]


def _user_prompt(task: AgentTask, graph: TaskGraph) -> str:
    planner_task = graph.by_id("task_planner")
    planner_output = planner_task.output if planner_task and planner_task.output else {}

    return (
        f"Ziel-Stack: {task.input.get('target_stack', 'nextjs_supabase')}\n"
        f"Rechtsraum: {task.input.get('jurisdiction', 'eu')}\n"
        f"Risikoklasse (EU AI Act): {task.input.get('risk_tier', 'minimal')}\n"
        f"Verpflichtende Gates: {task.input.get('required_gates', '')}\n\n"
        f"Feature-Backlog:\n{planner_output.get('features', '[]')}\n\n"
        f"Offene Fragen:\n{planner_output.get('open_questions', '[]')}\n\n"
        f"Compliance-Auflagen:\n{planner_output.get('compliance_notes', '[]')}\n\n"
        "Entwirf Schema und Modulschnitt."
    )


async def run(task: AgentTask, graph: TaskGraph) -> AgentResult:
    entwurf, response = await complete_json(
        system=SYSTEM_PROMPT,
        user=_user_prompt(task, graph),
        model_cls=ArchitectOutput,
        project_id=task.input.get("project_id", ""),
        effort="high",
    )

    modules: List[str] = sanitize_modules(entwurf.modules)
    if not modules:
        logger.warning(
            "Architect für %s ohne brauchbaren Modulschnitt — Fallback %s",
            task.input.get("project_id", "?"),
            FALLBACK_MODULES,
        )
        modules = list(FALLBACK_MODULES)

    # Nur bauen, nicht einhängen: Der Scheduler hängt sie ein und schreibt sie
    # in einem Zug. Der DevOps-Task hängt danach an allen davon
    # (siehe TaskGraph.insert_spawned) — Fan-in ohne Vorabwissen.
    coder_tasks = build_coder_tasks(graph, task.id, modules)

    return AgentResult(
        output={
            "status": "ok",
            "schema_sql": entwurf.schema_sql,
            "modules": ",".join(modules),
            "api_contract": json.dumps(
                [endpoint.model_dump() for endpoint in entwurf.api_contract], ensure_ascii=False
            ),
            "target_stack": task.input.get("target_stack", "nextjs_supabase"),
        },
        spawn=coder_tasks,
        metrics={**response.as_metrics(), "spawned_tasks": str(len(coder_tasks))},
    )
