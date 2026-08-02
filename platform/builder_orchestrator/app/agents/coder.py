"""Coder-Agent: generiert den Anwendungscode eines Moduls.

Input  (task.input): module, target_stack, risk_tier (+ Architect-Output)
Output (task.output): files (JSON), tests (JSON), notes

Läuft je Modul einmal — die Tasks entstehen dynamisch im Architect-Schritt und
laufen parallel bis zur Nebenläufigkeitsgrenze des Schedulers.

TODO(Workspace): Ergebnisse in ein Volume schreiben statt im Task-Output zu
halten. Der Output landet in einer JSONB-Spalte; ein Modul mit vielen Dateien
sprengt das irgendwann, und der DevOps-Schritt braucht ohnehin Dateien auf
Platte, um wirklich zu bauen.
"""

from __future__ import annotations

import json

from ..schemas import AgentResult, AgentTask, TaskGraph
from ..services.llm import complete_json
from .contracts import CoderOutput

SYSTEM_PROMPT = """Du bist der Coder-Agent.
Generiere lauffähigen Code für das angegebene Modul und den Ziel-Stack.
Bei Risikoklasse 'limited' oder höher: sichtbarer KI-Transparenzhinweis im UI
und Audit-Logging aller Modellaufrufe sind verpflichtend.
Antworte als JSON: files[], tests[], notes[]."""


def _user_prompt(task: AgentTask, graph: TaskGraph) -> str:
    architect_task = graph.by_id("task_architect")
    architect_output = architect_task.output if architect_task and architect_task.output else {}

    return (
        f"Modul: {task.input.get('module', 'unbekannt')}\n"
        f"Ziel-Stack: {task.input.get('target_stack', 'nextjs_supabase')}\n"
        f"Risikoklasse (EU AI Act): {task.input.get('risk_tier', 'minimal')}\n"
        f"Verpflichtende Gates: {task.input.get('required_gates', '')}\n\n"
        f"Datenbankschema:\n{architect_output.get('schema_sql', '')}\n\n"
        f"API-Vertrag:\n{architect_output.get('api_contract', '[]')}\n\n"
        "Generiere ausschließlich die Dateien dieses Moduls."
    )


async def run(task: AgentTask, graph: TaskGraph) -> AgentResult:
    module = task.input.get("module", "unbekannt")

    ergebnis, response = await complete_json(
        system=SYSTEM_PROMPT,
        user=_user_prompt(task, graph),
        model_cls=CoderOutput,
        # Ein Modul ist ein abgegrenzter Auftrag mit fertigem Schema und
        # API-Vertrag — die Architekturarbeit ist hier schon getan.
        effort="medium",
    )

    return AgentResult(
        output={
            "status": "ok",
            "module": module,
            "files": json.dumps(
                [datei.model_dump() for datei in ergebnis.files], ensure_ascii=False
            ),
            "tests": json.dumps(
                [datei.model_dump() for datei in ergebnis.tests], ensure_ascii=False
            ),
            "notes": json.dumps(ergebnis.notes, ensure_ascii=False),
            "file_count": str(len(ergebnis.files)),
        },
        metrics={**response.as_metrics(), "module": module},
    )
