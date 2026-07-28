"""Architect-Agent: leitet aus dem Backlog Datenmodell und Modulschnitt ab.

Input  (task.input): risk_tier, target_stack, jurisdiction (+ Planner-Output)
Output (task.output): schema_sql, modules, api_contract

TODO(LLM): Claude-Aufruf mit dem Planner-Output als Kontext. Ergebnis muss
gültiges SQL für Supabase erzeugen — inklusive RLS-Policy je Tabelle.
"""

from __future__ import annotations

from typing import Dict

from ..schemas import AgentTask

SYSTEM_PROMPT = """Du bist der Architect-Agent.
Entwirf aus dem Feature-Backlog ein Postgres-Schema und einen Modulschnitt.
Pflicht: jede Tabelle mit personenbezogenen Daten bekommt RLS und tenant_id.
Antworte als JSON: schema_sql, modules[], api_contract[]."""


async def run(task: AgentTask) -> Dict[str, str]:
    # TODO(LLM): echten Modellaufruf einsetzen.
    return {
        "status": "stub",
        "schema_sql": "-- TODO: generiertes Schema (RLS-pflichtig)",
        "modules": "[]",
        "api_contract": "[]",
        "target_stack": task.input.get("target_stack", "nextjs_supabase"),
    }
