"""Event-Bus für Task-Übergänge (Grundlage des SSE-Streams).

Absichtlich ohne Persistenz: Wer sich verbindet, sieht ab dem Zeitpunkt der
Verbindung. Den Ausgangszustand holt sich das Frontend über
`GET /api/v1/builder/task-status`.
"""

from __future__ import annotations

import asyncio
from typing import AsyncIterator, Dict, List, Optional

from pydantic import BaseModel


class TaskEvent(BaseModel):
    project_id: str
    task_id: str
    agent_type: str
    status: str
    attempt: int = 0
    detail: Optional[str] = None


# project_id -> Warteschlangen der verbundenen Abonnenten
_SUBSCRIBERS: Dict[str, List[asyncio.Queue]] = {}

# Begrenzte Queue-Tiefe: ein langsamer Client darf den Scheduler nicht bremsen.
QUEUE_MAXSIZE = 100


def publish(event: TaskEvent) -> None:
    """Verteilt ein Event an alle Abonnenten des Projekts."""
    for queue in list(_SUBSCRIBERS.get(event.project_id, [])):
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            # Langsamer Abonnent: Event verwerfen statt blockieren.
            pass


async def subscribe(project_id: str) -> AsyncIterator[TaskEvent]:
    """Async-Generator über die Events eines Projekts."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_MAXSIZE)
    _SUBSCRIBERS.setdefault(project_id, []).append(queue)
    try:
        while True:
            yield await queue.get()
    finally:
        subscribers = _SUBSCRIBERS.get(project_id, [])
        if queue in subscribers:
            subscribers.remove(queue)
        if not subscribers:
            _SUBSCRIBERS.pop(project_id, None)


def subscriber_count(project_id: str) -> int:
    return len(_SUBSCRIBERS.get(project_id, []))


def reset() -> None:
    """Nur für Tests."""
    _SUBSCRIBERS.clear()
