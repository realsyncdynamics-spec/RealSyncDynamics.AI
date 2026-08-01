"""Persistenzschicht für Task-Graphen.

Der Speicher liegt weiterhin im Prozess, aber hinter einem Interface. Der
Umstieg auf Postgres ist damit eine zweite Implementierung von
`GraphRepository` und kein Umbau der Aufrufer.

Zielschema (Skizze, analog zu `enterprise_agent_runs` der Hauptplattform):

    create table builder_task_graphs (
      project_id  text primary key,
      tenant_id   uuid not null,
      cancelled   boolean not null default false,
      graph       jsonb not null,          -- serialisierter TaskGraph
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now()
    );
    alter table builder_task_graphs enable row level security;

TODO(Persistenz): PostgresGraphRepository ergänzen. Wichtig dabei: `save`
muss optimistisch sperren (updated_at-Vergleich), sonst überschreiben zwei
parallel laufende Tasks die Statusänderungen des jeweils anderen.
"""

from __future__ import annotations

import asyncio
from typing import Dict, List, Optional, Protocol

from ..schemas import TaskGraph


class GraphRepository(Protocol):
    """Vertrag, gegen den Scheduler und Endpoints arbeiten."""

    async def get(self, project_id: str) -> Optional[TaskGraph]: ...

    async def save(self, graph: TaskGraph) -> None: ...

    async def list_ids(self) -> List[str]: ...


class InMemoryGraphRepository:
    """Prozesslokaler Speicher. Ausreichend für den Draft, nicht für Prod."""

    def __init__(self) -> None:
        self._graphs: Dict[str, TaskGraph] = {}
        self._lock = asyncio.Lock()

    async def get(self, project_id: str) -> Optional[TaskGraph]:
        return self._graphs.get(project_id)

    async def save(self, graph: TaskGraph) -> None:
        async with self._lock:
            self._graphs[graph.project_id] = graph

    async def list_ids(self) -> List[str]:
        return list(self._graphs)

    # --- nur für Tests ---

    def reset(self) -> None:
        self._graphs.clear()


# Prozessweite Instanz. Austauschbar über `set_repository` (Tests, spätere
# Postgres-Implementierung).
_repository: GraphRepository = InMemoryGraphRepository()


def get_repository() -> GraphRepository:
    return _repository


def set_repository(repository: GraphRepository) -> None:
    global _repository
    _repository = repository
