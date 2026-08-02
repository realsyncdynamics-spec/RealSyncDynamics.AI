"""Persistenzschicht für Task-Graphen.

Zwei Implementierungen hinter einem Interface: prozesslokal (Default) und
Postgres (sobald `DATABASE_URL` gesetzt ist).

**Warum das Interface feiner ist als `get`/`save`:** Der Scheduler führt Tasks
nebenläufig aus, und `_run_task` lädt den Graphen selbst. Im In-Memory-Fall ist
das dieselbe Objektreferenz — Mutationen sind sofort für alle sichtbar. Mit
einer Datenbank bekommt jede Task eine eigene Kopie; würde jede den **ganzen**
Graphen zurückschreiben, überschriebe die zuletzt fertige die Statusänderungen
der anderen (lost update).

Deshalb gibt es `save_task` / `save_tasks`: Geschrieben wird nur, was sich
tatsächlich geändert hat. Das Problem verschwindet strukturell, ohne Sperren.
"""

from __future__ import annotations

import asyncio
import json
from typing import Dict, Iterable, List, Optional, Protocol

from ..schemas import AgentTask, TaskGraph
from . import db


class GraphRepository(Protocol):
    """Vertrag, gegen den Scheduler und Endpoints arbeiten."""

    async def get(self, project_id: str) -> Optional[TaskGraph]: ...

    async def save(self, graph: TaskGraph) -> None:
        """Legt den Graphen samt aller Tasks an bzw. schreibt ihn komplett."""

    async def save_task(self, project_id: str, task: AgentTask) -> None:
        """Schreibt genau eine Task."""

    async def save_tasks(self, project_id: str, tasks: Iterable[AgentTask]) -> None:
        """Schreibt mehrere Tasks (z.B. nach einer Blockier-Propagierung)."""

    async def set_cancelled(self, project_id: str, cancelled: bool) -> None: ...

    async def list_ids(self) -> List[str]: ...


class InMemoryGraphRepository:
    """Prozesslokaler Speicher.

    Die Task-Methoden sind No-Ops: Der Aufrufer hält bereits eine Referenz auf
    dasselbe Objekt, die Mutation ist also schon passiert.
    """

    def __init__(self) -> None:
        self._graphs: Dict[str, TaskGraph] = {}
        self._lock = asyncio.Lock()

    async def get(self, project_id: str) -> Optional[TaskGraph]:
        return self._graphs.get(project_id)

    async def save(self, graph: TaskGraph) -> None:
        async with self._lock:
            self._graphs[graph.project_id] = graph

    async def save_task(self, project_id: str, task: AgentTask) -> None:
        return None

    async def save_tasks(self, project_id: str, tasks: Iterable[AgentTask]) -> None:
        return None

    async def set_cancelled(self, project_id: str, cancelled: bool) -> None:
        graph = self._graphs.get(project_id)
        if graph is not None:
            graph.cancelled = cancelled

    async def list_ids(self) -> List[str]:
        return list(self._graphs)

    def reset(self) -> None:
        self._graphs.clear()


class PostgresGraphRepository:
    """Postgres-Backend. Tasks liegen in eigenen Zeilen (siehe Modul-Docstring)."""

    async def get(self, project_id: str) -> Optional[TaskGraph]:
        async with db.pool().connection() as conn:
            cursor = await conn.execute(
                "select cancelled from builder_task_graphs where project_id = %s",
                (project_id,),
            )
            head = await cursor.fetchone()
            if head is None:
                return None

            cursor = await conn.execute(
                f"select {_TASK_COLUMNS} from builder_agent_tasks"
                " where project_id = %s order by position",
                (project_id,),
            )
            rows = await cursor.fetchall()

        return TaskGraph(
            project_id=project_id,
            cancelled=head[0],
            tasks=[_to_task(row) for row in rows],
        )

    async def save(self, graph: TaskGraph) -> None:
        async with db.pool().connection() as conn:
            await conn.execute(
                """
                insert into builder_task_graphs (project_id, tenant_id, cancelled)
                     values (%s, %s, %s)
                on conflict (project_id) do update
                        set cancelled = excluded.cancelled, updated_at = now()
                """,
                (graph.project_id, db.tenant_id(), graph.cancelled),
            )
            for task in graph.tasks:
                await self._upsert(conn, graph.project_id, task)

    async def save_task(self, project_id: str, task: AgentTask) -> None:
        async with db.pool().connection() as conn:
            await self._upsert(conn, project_id, task)

    async def save_tasks(self, project_id: str, tasks: Iterable[AgentTask]) -> None:
        async with db.pool().connection() as conn:
            for task in tasks:
                await self._upsert(conn, project_id, task)

    async def set_cancelled(self, project_id: str, cancelled: bool) -> None:
        async with db.pool().connection() as conn:
            await conn.execute(
                "update builder_task_graphs set cancelled = %s, updated_at = now()"
                " where project_id = %s",
                (cancelled, project_id),
            )

    async def list_ids(self) -> List[str]:
        async with db.pool().connection() as conn:
            cursor = await conn.execute("select project_id from builder_task_graphs")
            return [row[0] for row in await cursor.fetchall()]

    @staticmethod
    async def _upsert(conn, project_id: str, task: AgentTask) -> None:
        await conn.execute(
            """
            insert into builder_agent_tasks (
                project_id, task_id, tenant_id, agent_type, status, input, output,
                depends_on, attempt, max_attempts, timeout_seconds,
                idempotency_key, otel_carrier, interruptible
            ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (project_id, task_id) do update set
                status          = excluded.status,
                input           = excluded.input,
                output          = excluded.output,
                depends_on      = excluded.depends_on,
                attempt         = excluded.attempt,
                max_attempts    = excluded.max_attempts,
                timeout_seconds = excluded.timeout_seconds,
                idempotency_key = excluded.idempotency_key,
                otel_carrier    = excluded.otel_carrier,
                interruptible   = excluded.interruptible,
                updated_at      = now()
            """,
            (
                project_id,
                task.id,
                db.tenant_id(),
                task.agent_type,
                task.status,
                json.dumps(task.input),
                json.dumps(task.output) if task.output is not None else None,
                task.depends_on,
                task.attempt,
                task.max_attempts,
                task.timeout_seconds,
                task.idempotency_key,
                json.dumps(task.otel_carrier),
                task.interruptible,
            ),
        )


_TASK_COLUMNS = (
    "task_id, agent_type, status, input, output, depends_on, attempt, "
    "max_attempts, timeout_seconds, idempotency_key, otel_carrier, interruptible"
)


def _as_dict(value):
    if value is None:
        return None
    return json.loads(value) if isinstance(value, str) else value


def _to_task(row) -> AgentTask:
    return AgentTask(
        id=row[0],
        agent_type=row[1],
        status=row[2],
        input=_as_dict(row[3]) or {},
        output=_as_dict(row[4]),
        depends_on=list(row[5] or []),
        attempt=row[6],
        max_attempts=row[7],
        timeout_seconds=row[8],
        idempotency_key=row[9],
        otel_carrier=_as_dict(row[10]) or {},
        interruptible=row[11],
    )


# Prozessweite Instanz. `select_backend` wird beim Start aufgerufen.
_repository: GraphRepository = InMemoryGraphRepository()


def get_repository() -> GraphRepository:
    return _repository


def set_repository(repository: GraphRepository) -> None:
    global _repository
    _repository = repository


def select_backend() -> str:
    """Wählt das Backend anhand der Datenbankverbindung."""
    global _repository
    if db.is_enabled():
        _repository = PostgresGraphRepository()
        return "postgres"
    _repository = InMemoryGraphRepository()
    return "memory"
