"""DevOps-Agent: baut, prüft das CI/CD-Gate und deployt.

Input  (task.input): project_id, risk_tier, required_gates (+ Coder-Output)
Output (task.output): build_hash, gate_status, endpoint

Der Gate-Aufruf ist der Punkt, an dem der Builder die Governance nicht umgehen
kann: ohne `approved`/`warning` gibt es kein Deployment.

TODO(Build): echten Container-Build ausführen und den Digest als build_hash
verwenden statt eines Platzhalters.
"""

from __future__ import annotations

import logging
import uuid
from typing import Dict

from ..clients import rsd_client
from ..schemas import AgentTask

logger = logging.getLogger(__name__)


async def run(task: AgentTask) -> Dict[str, str]:
    project_id = task.input["project_id"]

    # TODO(Build): echter Build; build_hash = Image-Digest.
    build_hash = f"sha256:{uuid.uuid4().hex}"

    # TODO(Artefakte): Werte aus dem tatsächlichen Build ableiten
    # (Testreport, Logging-Config, Model Card, PII-Scan-Report).
    artifacts = {
        "tests_passed": False,
        "audit_logging_active": False,
        "model_card_included": False,
        "transparency_notice_enabled": False,
        "pii_scan_passed": False,
    }

    decision = await rsd_client.gate_check(project_id, build_hash, artifacts)
    logger.info("Gate-Entscheidung für %s: %s", project_id, decision.get("status"))

    if decision.get("status") == "blocked":
        # Kein Deployment — die Task gilt als fehlgeschlagen.
        raise RuntimeError(f"Gate blockiert: {decision.get('reason')}")

    # TODO(Deploy): Traefik-Route + Container ausrollen, danach
    # /api/v1/inventory/activate mit dem echten Endpoint aufrufen.
    return {
        "status": "stub",
        "build_hash": build_hash,
        "gate_status": str(decision.get("status")),
        "endpoint": "",
    }
