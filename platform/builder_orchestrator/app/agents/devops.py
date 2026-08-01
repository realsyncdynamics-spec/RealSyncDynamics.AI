"""DevOps-Agent: baut, prüft das CI/CD-Gate und deployt.

Input  (task.input): project_id, risk_tier, required_gates (+ Coder-Outputs)
Output (task.output): build_hash, gate_status, endpoint

Der Gate-Aufruf ist der Punkt, an dem der Builder die Governance nicht umgehen
kann: ohne `approved`/`warning` gibt es kein Deployment.

**Idempotenz** ist hier keine Kür. Der Task hat Außenwirkung — jeder Gate-Aufruf
erzeugt einen Eintrag im Prüfpfad, jedes Deployment kostet. Ein Retry muss
deshalb denselben `build_hash` verwenden und ein bereits entschiedenes Gate
nicht erneut aufrufen.

TODO(Build): echten Container-Build ausführen und den Digest als build_hash
verwenden statt eines abgeleiteten Platzhalters.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Dict

from ..clients import rsd_client
from ..schemas import AgentResult, AgentTask, TaskGraph

logger = logging.getLogger(__name__)

# idempotency_key -> bereits getroffene Gate-Entscheidung
_GATE_DECISIONS: Dict[str, dict] = {}


class GateBlocked(RuntimeError):
    """Das Gate hat den Build blockiert — ein Retry ändert daran nichts."""

    retryable = False


def _build_hash(task: AgentTask, graph: TaskGraph) -> str:
    """Deterministischer Hash über die Coder-Ergebnisse.

    Deterministisch heißt: ein Retry derselben Task erzeugt denselben Hash.
    Genau das macht den Gate-Aufruf idempotent.
    """
    parts = [task.input.get("project_id", "")]
    for coder_task in sorted(graph.tasks, key=lambda t: t.id):
        if coder_task.agent_type == "coder" and coder_task.output:
            parts.append(f"{coder_task.id}:{coder_task.output.get('files', '')}")
    digest = hashlib.sha256("|".join(parts).encode()).hexdigest()
    return f"sha256:{digest}"


async def run(task: AgentTask, graph: TaskGraph) -> AgentResult:
    project_id = task.input["project_id"]
    build_hash = _build_hash(task, graph)
    key = task.idempotency_key or f"{project_id}:{build_hash}"

    # TODO(Artefakte): Werte aus dem tatsächlichen Build ableiten
    # (Testreport, Logging-Config, Model Card, PII-Scan-Report).
    artifacts = {
        "tests_passed": False,
        "audit_logging_active": False,
        "model_card_included": False,
        "transparency_notice_enabled": False,
        "pii_scan_passed": False,
    }

    # Idempotenz: eine bereits getroffene Entscheidung wird nicht erneut geholt.
    decision = _GATE_DECISIONS.get(key)
    if decision is None:
        decision = await rsd_client.gate_check(project_id, build_hash, artifacts)
        _GATE_DECISIONS[key] = decision
    else:
        logger.info("Gate-Entscheidung für %s aus Idempotenz-Cache", key)

    status = decision.get("status")
    logger.info("Gate-Entscheidung für %s: %s", project_id, status)

    if status == "blocked":
        # Kein Deployment. Nicht wiederholbar — das Gate entscheidet nicht
        # zufällig anders, nur weil man es nochmal fragt.
        raise GateBlocked(f"Gate blockiert: {decision.get('reason')}")

    # TODO(Deploy): Traefik-Route + Container ausrollen und den echten Endpoint
    # zurückgeben. Die Aktivierung im Inventar macht der Governance-Agent.
    endpoint = f"https://{project_id}.builder.local"

    return AgentResult(
        output={
            "status": "stub",
            "build_hash": build_hash,
            "gate_status": str(status),
            "endpoint": endpoint,
        },
        metrics={"gate_status": str(status)},
    )


def reset() -> None:
    """Nur für Tests."""
    _GATE_DECISIONS.clear()
