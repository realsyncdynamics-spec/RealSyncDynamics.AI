"""Coder-Agent: generiert den Anwendungscode aus dem Architektur-Entwurf.

Input  (task.input): target_stack, risk_tier (+ Architect-Output)
Output (task.output): files (JSON: pfad -> inhalt), tests, notes

TODO(LLM): Generierung in mehreren Runden (Datei für Datei), Ergebnisse in
einem Workspace-Volume ablegen statt im Task-Output zu halten.
TODO(Compliance): Bei risk_tier != 'minimal' muss der generierte Code den
Transparenzhinweis und Audit-Logging enthalten — sonst blockiert das Gate.
"""

from __future__ import annotations

from typing import Dict

from ..schemas import AgentTask

SYSTEM_PROMPT = """Du bist der Coder-Agent.
Generiere lauffähigen Code für den angegebenen Ziel-Stack.
Bei Risikoklasse 'limited' oder höher: sichtbarer KI-Transparenzhinweis im UI
und Audit-Logging aller Modellaufrufe sind verpflichtend.
Antworte als JSON: files{}, tests{}, notes[]."""


async def run(task: AgentTask) -> Dict[str, str]:
    # TODO(LLM): echten Modellaufruf einsetzen.
    return {
        "status": "stub",
        "files": "{}",
        "tests": "{}",
        "notes": "Code-Generierung noch nicht implementiert.",
    }
