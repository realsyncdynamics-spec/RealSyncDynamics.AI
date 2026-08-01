"""Governance-Agent: schließt den Build gegenüber dem Governance-Backend ab.

Läuft als letzter Knoten des Graphen und erst nach erfolgreichem DevOps-Schritt.
Zwei Aufgaben:

  1. Das Projekt im Inventar aktivieren (Endpoint + Deployment-Zeitpunkt).
  2. Ein Telemetrie-Event melden, damit die Laufzeitüberwachung greift.

Die Reihenfolge ist der Punkt: Ein blockiertes Gate lässt den DevOps-Task
scheitern, dessen Nachfolger — also genau dieser Agent — wird blockiert und
aktiviert folglich **nichts**. Ein blockierter Build darf im Inventar nie als
produktiv erscheinen.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from ..clients import rsd_client
from ..schemas import AgentResult, AgentTask, TaskGraph

logger = logging.getLogger(__name__)


async def run(task: AgentTask, graph: TaskGraph) -> AgentResult:
    project_id = task.input["project_id"]

    devops_task = graph.by_id("task_devops")
    devops_output = devops_task.output if devops_task and devops_task.output else {}

    endpoint = devops_output.get("endpoint", "")
    gate_status = devops_output.get("gate_status", "unknown")

    if not endpoint:
        # Ohne Deployment-Endpoint gibt es nichts zu aktivieren.
        logger.warning("Governance-Task für %s ohne Endpoint — keine Aktivierung", project_id)
        return AgentResult(
            output={"status": "skipped", "reason": "kein Endpoint aus dem DevOps-Schritt"},
            retryable=False,
        )

    timestamp = datetime.now(timezone.utc).isoformat()
    await rsd_client.activate_inventory(project_id, endpoint, timestamp)
    await rsd_client.send_telemetry(
        project_id,
        "deployment_completed",
        gate_status=gate_status,
        build_hash=devops_output.get("build_hash", ""),
        region="eu",
    )

    return AgentResult(
        output={
            "status": "activated",
            "endpoint": endpoint,
            "gate_status": gate_status,
            "deployment_timestamp": timestamp,
        },
        metrics={"gate_status": gate_status},
    )
