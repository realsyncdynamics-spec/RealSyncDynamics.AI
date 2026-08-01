"""Architect-Agent: leitet aus dem Backlog Datenmodell und Modulschnitt ab.

Input  (task.input): risk_tier, target_stack, jurisdiction (+ Planner-Output)
Output (task.output): schema_sql, modules, api_contract
Spawn:               je Modul eine Coder-Task

Dies ist die Stelle, an der der Graph seine Breite bekommt: Der Modulschnitt
steht erst nach diesem Lauf fest, deshalb werden die Coder-Tasks dynamisch
eingehängt statt zur Bauzeit geraten.

TODO(LLM): Claude-Aufruf mit dem Planner-Output als Kontext. Ergebnis muss
gültiges SQL für Supabase erzeugen — inklusive RLS-Policy je Tabelle.
"""

from __future__ import annotations

from typing import List

from ..schemas import AgentResult, AgentTask, TaskGraph
from ..services.task_graph import spawn_coder_tasks

SYSTEM_PROMPT = """Du bist der Architect-Agent.
Entwirf aus dem Feature-Backlog ein Postgres-Schema und einen Modulschnitt.
Pflicht: jede Tabelle mit personenbezogenen Daten bekommt RLS und tenant_id.
Antworte als JSON: schema_sql, modules[], api_contract[]."""

# Platzhalter-Modulschnitt, solange kein LLM antwortet. Bewusst mehr als eins,
# damit der Fan-out im Graph real ist und nicht nur theoretisch existiert.
STUB_MODULES = ["auth", "data", "ui"]


async def run(task: AgentTask, graph: TaskGraph) -> AgentResult:
    # TODO(LLM): echten Modellaufruf einsetzen; `modules` aus der Antwort lesen.
    modules: List[str] = list(STUB_MODULES)

    # Coder-Tasks einhängen. Der DevOps-Task hängt danach an allen davon
    # (siehe TaskGraph.insert_spawned) — Fan-in ohne Vorabwissen.
    spawned = spawn_coder_tasks(graph, task.id, modules)

    return AgentResult(
        output={
            "status": "stub",
            "schema_sql": "-- TODO: generiertes Schema (RLS-pflichtig)",
            "modules": ",".join(modules),
            "api_contract": "[]",
            "target_stack": task.input.get("target_stack", "nextjs_supabase"),
        },
        # Bereits eingehängt; die Liste bleibt leer, damit der Runner sie nicht
        # ein zweites Mal einfügt.
        spawn=[],
        metrics={"model": "stub", "spawned_tasks": str(len(spawned))},
    )
