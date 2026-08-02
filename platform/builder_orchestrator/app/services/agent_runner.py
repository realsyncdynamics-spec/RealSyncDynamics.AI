"""Ausführung der Agent-Tasks.

Der Scheduler arbeitet `ready_tasks()` mit begrenzter Nebenläufigkeit ab, bis
der Graph terminal ist. Er kennt keine Agentenlogik — die steckt in den
Handlern aus `AGENT_DISPATCH`.

Vier Eigenschaften, die den Unterschied zum vorherigen Statuswechsel-Stub
ausmachen:

  * **Kein Doppel-Dispatch** — `_INFLIGHT` verhindert, dass dieselbe Task
    zweimal gleichzeitig läuft, auch wenn die Schleife mehrfach angestoßen wird.
  * **Fehler-Propagierung** — ein `failed` Task blockiert seine Nachfolger,
    statt den Graphen still hängen zu lassen.
  * **Idempotenz** — Tasks mit Außenwirkung behalten über Retries hinweg
    denselben Schlüssel, damit kein zweiter Gate-Eintrag entsteht.
  * **Trace über die Queue-Grenze** — der Kontext reist als Carrier auf der
    Task mit, statt sich auf den ambienten Kontext zu verlassen.

TODO(Queue): `_dispatch` gegen eine externe Queue (Redis/RQ, Celery) tauschen.
Die Aufrufer sehen davon nichts — sie rufen weiterhin `run_graph`.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Awaitable, Callable, Dict, Optional, Set

from opentelemetry import context as otel_context
from opentelemetry import propagate, trace

from ..agents import architect, coder, devops, governance, planner
from ..schemas import AgentResult, AgentTask, TaskGraph
from . import audit_log, events, task_graph
from .events import TaskEvent

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

AgentHandler = Callable[[AgentTask, TaskGraph], Awaitable[AgentResult]]

# agent_type -> Handler
AGENT_DISPATCH: Dict[str, AgentHandler] = {
    "planner": planner.run,
    "architect": architect.run,
    "coder": coder.run,
    "devops": devops.run,
    "governance": governance.run,
}

MAX_CONCURRENCY = int(os.getenv("BUILDER_MAX_CONCURRENCY", "4"))
RETRY_BASE_SECONDS = float(os.getenv("BUILDER_RETRY_BASE_SECONDS", "2"))

# project_id -> Menge der aktuell laufenden Task-IDs
_INFLIGHT: Dict[str, Set[str]] = {}

# project_id -> Anzahl aktiver Scheduler-Schleifen (Refcount, siehe run_graph)
_RUNNERS: Dict[str, int] = {}

# project_id -> {task_id: asyncio-Handle}. Nur damit lässt sich ein laufender
# Task hart abbrechen; ohne Handle bliebe nur das Setzen eines Flags.
_HANDLES: Dict[str, Dict[str, "asyncio.Task"]] = {}


class GraphCancelled(RuntimeError):
    """Der Graph wurde während der Ausführung abgebrochen."""


# --------------------------------------------------------------------------
# Öffentliche API
# --------------------------------------------------------------------------


async def enqueue_initial_tasks(graph: TaskGraph) -> TaskGraph:
    """Startet die Ausführung des Graphen im Hintergrund.

    Kehrt sofort zurück — der Aufrufer (HTTP-Request) wartet nicht auf den
    Build. Der Fortschritt kommt über `task-status` oder den SSE-Stream.
    """
    await task_graph.save_graph(graph)

    if all(t.is_terminal() for t in graph.tasks):
        logger.warning("Graph %s ist bereits terminal — nichts zu starten.", graph.project_id)
        return graph

    # TODO(Queue): hier stattdessen einen Queue-Job einstellen.
    asyncio.create_task(run_graph(graph.project_id))
    return graph


async def run_graph(project_id: str) -> Optional[TaskGraph]:
    """Arbeitet den Graphen ab, bis nichts mehr laufen kann."""
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
    _INFLIGHT.setdefault(project_id, set())

    # Mehrere Scheduler auf demselben Projekt sind erlaubt (Retry-Anstoß,
    # doppelter Enqueue). Der In-Flight-Speicher wird deshalb erst abgeräumt,
    # wenn der letzte von ihnen fertig ist — sonst zieht der erste ihn dem
    # zweiten unter den Füßen weg.
    _RUNNERS[project_id] = _RUNNERS.get(project_id, 0) + 1

    try:
        while True:
            graph = await task_graph.get_graph(project_id)
            if graph is None:
                return None

            if graph.cancelled:
                await _cancel_graph(graph)
                return graph

            inflight = _INFLIGHT.setdefault(project_id, set())
            ready = [t for t in graph.ready_tasks() if t.id not in inflight]

            if not ready and not inflight:
                return graph  # terminal

            if ready:
                handles = _HANDLES.setdefault(project_id, {})
                laufend = []
                for task in ready:
                    handle = asyncio.create_task(_dispatch(project_id, task.id, semaphore))
                    handles[task.id] = handle
                    laufend.append((task.id, handle))
                # return_exceptions: ein abgebrochener Task darf die Schleife
                # nicht mitreißen — sie muss danach noch aufräumen können.
                await asyncio.gather(*(h for _, h in laufend), return_exceptions=True)
                for task_id, _ in laufend:
                    handles.pop(task_id, None)
            else:
                # Nur noch laufende Tasks: kurz warten statt heiß zu drehen.
                await asyncio.sleep(0.01)
    finally:
        _RUNNERS[project_id] = _RUNNERS.get(project_id, 1) - 1
        if _RUNNERS[project_id] <= 0:
            _RUNNERS.pop(project_id, None)
            _INFLIGHT.pop(project_id, None)
            _HANDLES.pop(project_id, None)


async def cancel_graph(project_id: str) -> Optional[TaskGraph]:
    """Bricht den Build ab (graceful).

    Semantik, damit sie nicht überschätzt wird: Es wird **nichts Neues mehr
    eingeplant**, und alle noch nicht terminalen Tasks werden als `cancelled`
    markiert. Ein bereits laufender Agentenaufruf wird **nicht** mitten im
    Aufruf abgeschossen — er läuft zu Ende oder bis zu seiner Zeitgrenze. Das
    ist Absicht: Ein DevOps-Task, der gerade deployt, darf nicht auf halber
    Strecke abbrechen.

    TODO(hartes Cancel): Für teure LLM-Läufe zusätzlich das asyncio-Task-Handle
    festhalten und `.cancel()` aufrufen, wenn der Nutzer sofort abbrechen will.
    """
    graph = await task_graph.get_graph(project_id)
    if graph is None:
        return None

    graph.cancelled = True
    await task_graph.set_cancelled(project_id, True)

    # Laufende Tasks hart abbrechen — aber nur die, die es vertragen.
    # Ein DevOps-Task mitten im Deployment läuft zu Ende; ein LLM-Aufruf nicht.
    for task_id, handle in list(_HANDLES.get(project_id, {}).items()):
        task = graph.by_id(task_id)
        if task is not None and task.interruptible and not handle.done():
            logger.info("Breche laufenden Task %s ab", task_id)
            handle.cancel()

    # Läuft gerade kein Scheduler, muss hier direkt aufgeräumt werden.
    if not _INFLIGHT.get(project_id):
        await _cancel_graph(graph)

    return await task_graph.get_graph(project_id)


# --------------------------------------------------------------------------
# Interna
# --------------------------------------------------------------------------


async def _dispatch(project_id: str, task_id: str, semaphore: asyncio.Semaphore) -> None:
    """Reserviert die Task und führt sie aus (genau einmal gleichzeitig)."""
    inflight = _INFLIGHT.setdefault(project_id, set())
    if task_id in inflight:
        return
    inflight.add(task_id)

    try:
        async with semaphore:
            await _run_task(project_id, task_id)
    finally:
        inflight.discard(task_id)


async def _run_task(project_id: str, task_id: str) -> None:
    """Führt eine Task inklusive Retries aus und schreibt das Ergebnis."""
    graph = await task_graph.get_graph(project_id)
    if graph is None:
        return
    task = graph.by_id(task_id)
    if task is None or task.is_terminal():
        return

    handler = AGENT_DISPATCH.get(task.agent_type)
    if handler is None:
        task.status = "failed"
        task.output = {"error": f"Kein Handler für agent_type={task.agent_type}"}
        graph.propagate_block(task.id, f"Vorgänger {task.id} ohne Handler")
        await _persist(graph, task)
        return

    # Trace-Kontext für die spätere Queue-Grenze mitgeben.
    if not task.otel_carrier:
        propagate.inject(task.otel_carrier)
    parent = propagate.extract(task.otel_carrier)

    while True:
        task.attempt += 1
        task.status = "running"
        await _persist(graph, task)

        started = time.perf_counter()
        token = otel_context.attach(parent)
        try:
            with tracer.start_as_current_span(f"agent.{task.agent_type}") as span:
                span.set_attribute("project_id", project_id)
                span.set_attribute("task_id", task.id)
                span.set_attribute("agent_type", task.agent_type)
                span.set_attribute("attempt", task.attempt)
                span.set_attribute("risk_tier", task.input.get("risk_tier", ""))

                result = await asyncio.wait_for(
                    handler(task, graph), timeout=task.timeout_seconds
                )
                span.set_attribute("status", "completed")
        except asyncio.CancelledError:
            # Harter Abbruch von außen. Der Task wird als abgebrochen vermerkt
            # und die Ausnahme weitergereicht, damit asyncio sauber abwickelt.
            duration = _ms(started)
            audit_log.record(
                project_id=project_id,
                task_id=task.id,
                agent_type=task.agent_type,
                attempt=task.attempt,
                status="cancelled",
                duration_ms=duration,
            )
            task.status = "failed"
            task.output = {"reason": "cancelled"}
            # `shield`: Der Vermerk muss die Abbruch-Ausnahme überleben, sonst
            # bliebe der Task in der Datenbank auf `running` stehen.
            await asyncio.shield(task_graph.save_task(project_id, task))
            _publish(project_id, task, detail="cancelled")
            raise
        except asyncio.TimeoutError:
            duration = _ms(started)
            audit_log.record(
                project_id=project_id,
                task_id=task.id,
                agent_type=task.agent_type,
                attempt=task.attempt,
                status="timeout",
                duration_ms=duration,
                error=f"Zeitgrenze {task.timeout_seconds}s überschritten",
            )
            if await _maybe_retry(graph, task, retryable=True):
                continue
            await _fail(graph, task, "timeout", f"Zeitgrenze {task.timeout_seconds}s überschritten")
            return
        except Exception as exc:  # noqa: BLE001 - Agentenfehler sind erwartbar
            duration = _ms(started)
            retryable = getattr(exc, "retryable", True)
            audit_log.record(
                project_id=project_id,
                task_id=task.id,
                agent_type=task.agent_type,
                attempt=task.attempt,
                status="failed",
                duration_ms=duration,
                error=str(exc),
            )
            logger.warning("Task %s fehlgeschlagen (Versuch %d): %s", task.id, task.attempt, exc)
            if await _maybe_retry(graph, task, retryable=retryable):
                continue
            await _fail(graph, task, "failed", str(exc))
            return
        finally:
            otel_context.detach(token)

        # Erfolg.
        duration = _ms(started)
        audit_log.record(
            project_id=project_id,
            task_id=task.id,
            agent_type=task.agent_type,
            attempt=task.attempt,
            status="completed",
            duration_ms=duration,
            metrics=result.metrics,
        )

        task.output = result.output
        task.status = "completed"

        if result.spawn:
            graph.insert_spawned(task.id, result.spawn)

        if result.spawn:
            # Neue Tasks und die umgehängten Abhängigkeiten betreffen mehrere
            # Zeilen — hier ist der Vollschreibvorgang der richtige.
            await task_graph.save_graph(graph)
            _publish(graph.project_id, task)
        else:
            await _persist(graph, task)
        return


async def _maybe_retry(graph: TaskGraph, task: AgentTask, *, retryable: bool) -> bool:
    """Entscheidet über einen weiteren Versuch und wartet das Backoff ab."""
    if not retryable or task.attempt >= task.max_attempts:
        return False

    graph_state = await task_graph.get_graph(graph.project_id)
    if graph_state is not None and graph_state.cancelled:
        return False

    delay = RETRY_BASE_SECONDS * (2 ** (task.attempt - 1))
    logger.info("Task %s wird in %.1fs erneut versucht", task.id, delay)
    await asyncio.sleep(delay)
    return True


async def _fail(graph: TaskGraph, task: AgentTask, status: str, reason: str) -> None:
    """Setzt die Task auf failed und blockiert alle Nachfolger."""
    task.status = "failed"
    task.output = {"error": reason, "reason": status}

    blocked = graph.propagate_block(task.id, f"Vorgänger {task.id} fehlgeschlagen: {reason}")

    await _persist(graph, task)
    if blocked:
        await task_graph.save_tasks(graph.project_id, blocked)
    for blocked_task in blocked:
        _publish(graph.project_id, blocked_task, detail=reason)


async def _cancel_graph(graph: TaskGraph) -> None:
    """Bricht alle noch nicht terminalen Tasks ab."""
    abgebrochen: list[AgentTask] = []
    for task in graph.tasks:
        if task.is_terminal():
            continue
        task.status = "failed"
        task.output = {"reason": "cancelled"}
        audit_log.record(
            project_id=graph.project_id,
            task_id=task.id,
            agent_type=task.agent_type,
            attempt=task.attempt,
            status="cancelled",
            duration_ms=0,
        )
        _publish(graph.project_id, task, detail="cancelled")
        abgebrochen.append(task)

    await task_graph.save_tasks(graph.project_id, abgebrochen)
    await task_graph.set_cancelled(graph.project_id, True)


async def _persist(graph: TaskGraph, task: AgentTask) -> None:
    """Schreibt genau die geänderte Task — nicht den ganzen Graphen.

    Zwei nebenläufige Tasks würden sich beim Zurückschreiben des kompletten
    Graphen gegenseitig überschreiben, sobald der Speicher Kopien liefert
    (Datenbank-Backend) statt einer gemeinsamen Objektreferenz.
    """
    await task_graph.save_task(graph.project_id, task)
    _publish(graph.project_id, task)


def _publish(project_id: str, task: AgentTask, detail: Optional[str] = None) -> None:
    events.publish(
        TaskEvent(
            project_id=project_id,
            task_id=task.id,
            agent_type=task.agent_type,
            status=task.status,
            attempt=task.attempt,
            detail=detail,
        )
    )


def _ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


def reset() -> None:
    """Nur für Tests."""
    _INFLIGHT.clear()
    _RUNNERS.clear()
    _HANDLES.clear()
