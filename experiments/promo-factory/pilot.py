"""RealSync Promotion Factory: read-only planning pilot.

No APIs, side effects or model costs unless explicitly requested.
"""
from __future__ import annotations

import argparse
import json
import os

AGENT_ROLES = {
    "market_research": "Analysiert Zielgruppe, Bedürfnisse, Wettbewerb und belegbare Recherchefragen.",
    "creative_director": "Entwirft Skript, Storyboard und einen konsistenten Markenauftritt.",
    "growth_analyst": "Plant Lead-Funnel, Metriken, Qualitätssicherung und risikoarme Experimente.",
}

PILOT_TASK = (
    "Plane eine kostengünstige Kampagne für den RealSync KI-Telefonassistenten "
    "für Handwerksbetriebe. Erstelle Zielgruppenannahmen, Video-Storyboard, "
    "Landingpage-Konzept, Lead-Funnel, Messgrößen und Kostenfragen. "
    "Kennzeichne Annahmen. Keine Veröffentlichung, keine Kontaktaufnahme, "
    "keine kostenpflichtige Produktion und keine Änderung an Produktionssystemen."
)


def preview() -> dict:
    """Deterministic preview; no inference, network, secrets or IO writes."""
    return {
        "status": "planning_only",
        "product": "KI-Bots / Telefonassistent",
        "agents": list(AGENT_ROLES),
        "task": PILOT_TASK,
        "external_actions": "disabled",
        "model_calls": 0,
        "approvals_required": [
            "provider_costs", "publications", "outbound_contact",
            "deployments", "database_migrations",
        ],
    }


def build_director():
    """Create tool-less planning agents; not a production execution engine."""
    from smolagents import InferenceClientModel, ToolCallingAgent

    model = InferenceClientModel()
    agents = [
        ToolCallingAgent(
            tools=[],
            model=model,
            name=name,
            description=description,
            max_steps=3,
        )
        for name, description in AGENT_ROLES.items()
    ]
    return ToolCallingAgent(
        tools=[],
        model=model,
        managed_agents=agents,
        name="promo_director",
        description="Koordiniert ausschließlich die interne Kampagnenplanung.",
        max_steps=5,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-model", action="store_true",
                        help="Explicitly allow a possibly paid inference call.")
    args = parser.parse_args()

    if not args.run_model:
        print(json.dumps(preview(), ensure_ascii=False, indent=2))
        return

    if os.environ.get("PROMO_MODEL_APPROVED") != "1":
        parser.error("Modellaufruf gesperrt: PROMO_MODEL_APPROVED=1 fehlt.")
    director = build_director()
    print(director.run(PILOT_TASK))


if __name__ == "__main__":
    main()
