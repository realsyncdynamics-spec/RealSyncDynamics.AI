"""Planner-Agent: zerlegt den Nutzer-Prompt in ein Feature-Backlog.

Input  (task.input): prompt, description, risk_tier, required_gates, target_stack
Output (task.output): features (JSON-String), open_questions, compliance_notes

Der erste Knoten des Graphen und damit der einzige, der den Nutzerwunsch im
Original sieht. Alles Folgende arbeitet auf seinem Ergebnis.
"""

from __future__ import annotations

import json

from ..schemas import AgentResult, AgentTask, TaskGraph
from ..services.llm import complete_json
from .contracts import PlannerOutput

SYSTEM_PROMPT = """Du bist der Planner-Agent eines AI-App-Builders.
Zerlege die Nutzeranfrage in ein umsetzbares Feature-Backlog.
Beachte die Risikoklasse des Projekts: bei 'limited' ist ein sichtbarer
Transparenzhinweis Pflicht, bei 'high' zusätzlich Model Card und PII-Scan.
Antworte ausschließlich als JSON mit den Schlüsseln:
features[], open_questions[], compliance_notes[]."""


def _user_prompt(task: AgentTask) -> str:
    return (
        f"Projektbeschreibung: {task.input.get('description', '')}\n"
        f"Nutzeranfrage: {task.input.get('prompt', '')}\n"
        f"Ziel-Stack: {task.input.get('target_stack', 'nextjs_supabase')}\n"
        f"Rechtsraum: {task.input.get('jurisdiction', 'eu')}\n"
        f"Risikoklasse (EU AI Act): {task.input.get('risk_tier', 'minimal')}\n"
        f"Verpflichtende Gates: {task.input.get('required_gates', '')}\n\n"
        "Erzeuge das Feature-Backlog."
    )


async def run(task: AgentTask, graph: TaskGraph) -> AgentResult:
    risk_tier = task.input.get("risk_tier", "minimal")

    plan, response = await complete_json(
        system=SYSTEM_PROMPT,
        user=_user_prompt(task),
        model_cls=PlannerOutput,
        project_id=task.input.get("project_id", ""),
        # Der Modulschnitt und alle Folgeschritte hängen an diesem Ergebnis —
        # hier zu sparen verteuert jeden nachgelagerten Lauf.
        effort="high",
    )

    # Der Prüfpfad muss belegen können, dass die Risikoklasse berücksichtigt
    # wurde — auch wenn das Modell von sich aus nichts dazu geschrieben hat.
    notes = list(plan.compliance_notes)
    notes.append(f"Risikoklasse {risk_tier} — Gates: {task.input.get('required_gates', '')}")

    return AgentResult(
        output={
            "status": "ok",
            "features": json.dumps(
                [feature.model_dump() for feature in plan.features], ensure_ascii=False
            ),
            "open_questions": json.dumps(plan.open_questions, ensure_ascii=False),
            "compliance_notes": json.dumps(notes, ensure_ascii=False),
            "feature_count": str(len(plan.features)),
        },
        metrics=response.as_metrics(),
    )
