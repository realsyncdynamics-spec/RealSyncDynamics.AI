"""Prüfpfad über Agentenläufe.

Die Plattform verlangt von ihren Kunden einen lückenlosen Prüfpfad über jeden
Modellaufruf — der Builder muss sich daran selbst halten. Jeder Agentenlauf
wird hier protokolliert, auch fehlgeschlagene und abgebrochene.

TODO(Persistenz): Zieltabelle ist `ai_tool_runs` der Hauptplattform. Das
Interface unten ist bewusst schmal, damit der Austausch keine Aufrufer
berührt.
"""

from __future__ import annotations

import logging
from collections import deque
from datetime import datetime, timezone
from typing import Deque, Dict, List, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger("builder.audit")


class AgentRunRecord(BaseModel):
    project_id: str
    task_id: str
    agent_type: str
    attempt: int
    status: str  # completed | failed | blocked | cancelled | timeout
    duration_ms: int
    model: Optional[str] = None
    tokens_in: Optional[int] = None
    tokens_out: Optional[int] = None
    error: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


_RECORDS: Deque[AgentRunRecord] = deque(maxlen=5000)


def record(
    *,
    project_id: str,
    task_id: str,
    agent_type: str,
    attempt: int,
    status: str,
    duration_ms: int,
    metrics: Optional[Dict[str, str]] = None,
    error: Optional[str] = None,
) -> AgentRunRecord:
    """Schreibt einen Agentenlauf in den Prüfpfad."""
    metrics = metrics or {}

    entry = AgentRunRecord(
        project_id=project_id,
        task_id=task_id,
        agent_type=agent_type,
        attempt=attempt,
        status=status,
        duration_ms=duration_ms,
        model=metrics.get("model"),
        tokens_in=_as_int(metrics.get("tokens_in")),
        tokens_out=_as_int(metrics.get("tokens_out")),
        error=error,
    )
    _RECORDS.append(entry)

    logger.info(
        "agent_run project=%s task=%s agent=%s attempt=%d status=%s dauer=%dms",
        project_id,
        task_id,
        agent_type,
        attempt,
        status,
        duration_ms,
    )
    return entry


def _as_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def records(project_id: Optional[str] = None) -> List[AgentRunRecord]:
    entries = list(_RECORDS)
    if project_id:
        entries = [e for e in entries if e.project_id == project_id]
    return entries


def reset() -> None:
    """Nur für Tests."""
    _RECORDS.clear()
