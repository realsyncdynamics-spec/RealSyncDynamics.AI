"""Coder-Agent: generiert den Anwendungscode eines Moduls.

Input  (task.input): module, target_stack, risk_tier (+ Architect-Output)
Output (task.output): files (JSON: pfad -> inhalt), tests, notes

Läuft je Modul einmal — die Tasks entstehen dynamisch im Architect-Schritt und
laufen parallel bis zur Nebenläufigkeitsgrenze des Schedulers.

TODO(LLM): Generierung in mehreren Runden (Datei für Datei), Ergebnisse in
einem Workspace-Volume ablegen statt im Task-Output zu halten.
TODO(Compliance): Bei risk_tier != 'minimal' muss der generierte Code den
Transparenzhinweis und Audit-Logging enthalten — sonst blockiert das Gate.
"""

from __future__ import annotations

from ..schemas import AgentResult, AgentTask, TaskGraph

SYSTEM_PROMPT = """Du bist der Coder-Agent.
Generiere lauffähigen Code für das angegebene Modul und den Ziel-Stack.
Bei Risikoklasse 'limited' oder höher: sichtbarer KI-Transparenzhinweis im UI
und Audit-Logging aller Modellaufrufe sind verpflichtend.
Antworte als JSON: files{}, tests{}, notes[]."""


async def run(task: AgentTask, graph: TaskGraph) -> AgentResult:
    module = task.input.get("module", "unbekannt")

    # TODO(LLM): echten Modellaufruf einsetzen.
    return AgentResult(
        output={
            "status": "stub",
            "module": module,
            "files": "{}",
            "tests": "{}",
            "notes": f"Code-Generierung für Modul '{module}' noch nicht implementiert.",
        },
        metrics={"model": "stub", "module": module},
    )
