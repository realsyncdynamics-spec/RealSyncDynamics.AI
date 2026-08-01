"""OpenTelemetry-Setup (minimal, für beide Services identisch aufgebaut).

Ohne `OTEL_EXPORTER_OTLP_ENDPOINT` werden Spans auf stdout ausgegeben — das
reicht für lokale Entwicklung und macht das Tracing sichtbar, ohne dass ein
Collector im Compose-Stack laufen muss.

TODO(Observability): OTLP-Collector (Tempo/Jaeger) als Compose-Service
ergänzen und `OTEL_EXPORTER_OTLP_ENDPOINT` setzen.
"""

from __future__ import annotations

import logging
import os

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

logger = logging.getLogger(__name__)

_INITIALIZED = False


def setup_tracing(app, service_name: str) -> None:
    """Initialisiert TracerProvider und instrumentiert die FastAPI-App."""
    global _INITIALIZED
    if _INITIALIZED:
        return

    resource = Resource.create(
        {
            "service.name": service_name,
            "service.namespace": "realsyncdynamics",
            "deployment.environment": os.getenv("ENVIRONMENT", "local"),
        }
    )
    provider = TracerProvider(resource=resource)

    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint:
        try:
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

            provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint)))
        except Exception as exc:  # pragma: no cover - Exporter optional
            logger.warning("OTLP-Exporter nicht verfügbar (%s), nutze Console-Exporter", exc)
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    else:
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    trace.set_tracer_provider(provider)

    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(app)
    except Exception as exc:  # pragma: no cover - Instrumentation optional
        logger.warning("FastAPI-Instrumentation nicht aktiv: %s", exc)

    _INITIALIZED = True


def get_tracer(name: str):
    """Tracer-Handle für manuelle Spans in den Endpoints."""
    return trace.get_tracer(name)
