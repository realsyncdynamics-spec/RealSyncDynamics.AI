"""Planner-Agent: zerlegt den Nutzer-Prompt in ein Feature-Backlog.

Input  (task.input): prompt, description, risk_tier, required_gates, target_stack
Output (task.output): features (JSON-String), open_questions, compliance_notes

TODO(LLM): Prompt-Template unten an einen Claude-Aufruf hängen und die Antwort
über `validate_json_output` gegen ein Schema prüfen. Provider-Auswahl über ENV
(EU-lokal: Ollama als Fallback).
"""

from __future__ import annotations

from ..schemas import AgentResult, AgentTask, TaskGraph

SYSTEM_PROMPT = """Du bist der Planner-Agent eines AI-App-Builders.
Zerlege die Nutzeranfrage in ein umsetzbares Feature-Backlog.
Beachte die Risikoklasse des Projekts: bei 'limited' ist ein sichtbarer
Transparenzhinweis Pflicht, bei 'high' zusätzlich Model Card und PII-Scan.
Antworte ausschließlich als JSON mit den Schlüsseln:
features[], open_questions[], compliance_notes[]."""


async def run(task: AgentTask, graph: TaskGraph) -> AgentResult:
    prompt = task.input.get("prompt", "")
    risk_tier = task.input.get("risk_tier", "minimal")

    # TODO(LLM): Ersetzen durch echten Modellaufruf:
    #   raw = await llm.complete(system=SYSTEM_PROMPT, user=prompt, ...)
    #   data = validate_json_output(raw, PlannerOutput)   # mit Repair-Versuch
    return AgentResult(
        output={
            "status": "stub",
            "features": "[]",
            "open_questions": "[]",
            "compliance_notes": f"Risikoklasse {risk_tier} — Gates: {task.input.get('required_gates', '')}",
            "echo_prompt": prompt[:200],
        },
        metrics={"model": "stub", "tokens_in": "0", "tokens_out": "0"},
    )
