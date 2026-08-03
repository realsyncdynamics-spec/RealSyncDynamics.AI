"""Coder-Agent: generiert den Anwendungscode eines Moduls.

Input  (task.input): module, target_stack, risk_tier (+ Architect-Output)
Output (task.output): files (JSON), tests (JSON), notes

Läuft je Modul einmal — die Tasks entstehen dynamisch im Architect-Schritt und
laufen parallel bis zur Nebenläufigkeitsgrenze des Schedulers.

Die generierten Dateien wandern auf Platte (`services/workspace.py`), nicht in
den Task-Output. Zwei Gründe: Der Output landet in einer JSONB-Spalte, die ein
Modul mit vielen Dateien sprengt — und der DevOps-Schritt kann nur messen, was
an einem Pfad liegt. Im Output bleibt das Manifest: welche Dateien entstanden
sind. Genau das gehört in den Prüfpfad.

Jedes Modul schreibt in ein eigenes Unterverzeichnis, deshalb kommen sich die
parallel laufenden Coder-Tasks nicht in die Quere.
"""

from __future__ import annotations

import json

from ..schemas import AgentResult, AgentTask, TaskGraph
from ..services import workspace
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
        project_id=task.input.get("project_id", ""),
        # Ein Modul ist ein abgegrenzter Auftrag mit fertigem Schema und
        # API-Vertrag — die Architekturarbeit ist hier schon getan.
        effort="medium",
    )

    # Auf Platte schreiben. `write_module` wirft bei einem Pfad, der das
    # Projektverzeichnis verlässt — der Task scheitert dann nicht wiederholbar,
    # und der Befund steht im Prüfpfad. Das ist gewollt: Ein Pfad aus einer
    # Modellantwort darf nirgendwo anders landen.
    project_id = task.input["project_id"]
    dateien = workspace.write_module(
        project_id, module, [(datei.path, datei.content) for datei in ergebnis.files]
    )
    tests = workspace.write_module(
        project_id, f"{module}/__tests__", [(datei.path, datei.content) for datei in ergebnis.tests]
    )

    return AgentResult(
        output={
            "status": "ok",
            "module": module,
            # Manifest statt Inhalt: Was zählt, ist welche Dateien entstanden
            # sind — der Inhalt liegt im Workspace.
            "files": json.dumps(dateien, ensure_ascii=False),
            "tests": json.dumps(tests, ensure_ascii=False),
            "notes": json.dumps(ergebnis.notes, ensure_ascii=False),
            "file_count": str(len(dateien)),
        },
        metrics={**response.as_metrics(), "module": module},
    )
