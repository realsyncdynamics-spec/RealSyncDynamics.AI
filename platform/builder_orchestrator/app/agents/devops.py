"""DevOps-Agent: prüft die Build-Artefakte, ruft das Gate und deployt.

Input  (task.input): project_id, risk_tier, required_gates (+ Coder-Outputs)
Output (task.output): build_hash, gate_status, endpoint, check_reasons, findings

Der Gate-Aufruf ist der Punkt, an dem der Builder die Governance nicht umgehen
kann: ohne `approved`/`warning` gibt es kein Deployment.

**Was sich gegenüber dem Stub geändert hat:** Die fünf Nachweise standen fest
auf `false`. Das war ehrlich, machte das Gate aber zur Formalie. Jetzt liegen
die generierten Dateien im Workspace, also werden sie gemessen
(`services/build_checks.py`) — inklusive der Begründung je Nachweis, damit im
Prüfpfad steht, *warum* etwas als erfüllt galt.

**Idempotenz** ist hier keine Kür. Der Task hat Außenwirkung — jeder
Gate-Aufruf erzeugt einen Eintrag im Prüfpfad, jedes Deployment kostet. Ein
Retry verwendet deshalb denselben `build_hash` (Hash über die Dateien im
Workspace, nicht über einen Zeitstempel) und ruft ein bereits entschiedenes
Gate nicht erneut auf.

TODO(Build): echten Container-Build ausführen und den Digest als build_hash
verwenden statt des Workspace-Hashes.
TODO(Deploy): Traefik-Route + Container ausrollen und den echten Endpoint
zurückgeben.
"""

from __future__ import annotations

import logging
from typing import Dict, Tuple

from ..clients import rsd_client
from ..schemas import AgentResult, AgentTask, TaskGraph
from ..services import build_checks, workspace

logger = logging.getLogger(__name__)

# idempotency_key -> (Gate-Entscheidung, Report-Ausgabe)
_GATE_DECISIONS: Dict[str, Tuple[dict, Dict[str, str]]] = {}


class GateBlocked(RuntimeError):
    """Das Gate hat den Build blockiert — ein Retry ändert daran nichts."""

    retryable = False


async def run(task: AgentTask, graph: TaskGraph) -> AgentResult:
    project_id = task.input["project_id"]
    build_hash = workspace.content_hash(project_id)
    key = task.idempotency_key or f"{project_id}:{build_hash}"

    zwischenstand = _GATE_DECISIONS.get(key)
    if zwischenstand is not None:
        # Weder erneut messen noch erneut fragen: Ein zweiter Gate-Aufruf
        # erzeugte einen zweiten Eintrag im Prüfpfad für denselben Build, und
        # der Testlauf würde ein zweites Mal Zeit kosten.
        decision, report_output = zwischenstand
        logger.info("Gate-Entscheidung für %s aus Idempotenz-Cache", key)
    else:
        report = await build_checks.inspect(project_id)
        report_output = report.as_output()
        logger.info(
            "Build %s gemessen: %s",
            project_id,
            {name: wert for name, wert in report.artifacts.items()},
        )
        decision = await rsd_client.gate_check(project_id, build_hash, report.artifacts)
        _GATE_DECISIONS[key] = (decision, report_output)

    status = decision.get("status")
    logger.info("Gate-Entscheidung für %s: %s", project_id, status)

    if status == "blocked":
        # Kein Deployment. Nicht wiederholbar — das Gate entscheidet nicht
        # zufällig anders, nur weil man es nochmal fragt.
        raise GateBlocked(f"Gate blockiert: {decision.get('reason')}")

    endpoint = f"https://{project_id}.builder.local"

    return AgentResult(
        output={
            "status": "ok",
            "build_hash": build_hash,
            "gate_status": str(status),
            "endpoint": endpoint,
            **report_output,
        },
        metrics={"gate_status": str(status)},
    )


def reset() -> None:
    """Nur für Tests."""
    _GATE_DECISIONS.clear()
