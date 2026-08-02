"""Datenbankanbindung (optional).

Ohne `DATABASE_URL` läuft das Backend weiter gegen den prozesslokalen Speicher —
der Stack startet also auch ohne Postgres. Ist die Variable gesetzt, wandern
Inventar und Befunde in die Datenbank und überleben einen Neustart.

Das ist der Punkt, an dem aus einem Demo-Backend eines wird, dem man einen
Prüfpfad zutraut: Ein Compliance-Nachweis, der beim Deploy verdampft, ist
keiner.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger("governance.db")

DATABASE_URL = os.getenv("DATABASE_URL", "")

_pool = None
_enabled = False


def is_enabled() -> bool:
    """True, wenn ein Verbindungspool steht."""
    return _enabled


async def connect() -> bool:
    """Baut den Pool auf. Gibt zurück, ob Postgres genutzt wird.

    Ein Verbindungsfehler ist bewusst nicht fatal: Das Backend läuft dann im
    In-Memory-Modus weiter und sagt es im Log. Andernfalls würde ein kurz
    nicht erreichbarer Datenbankserver den gesamten Dienst blockieren.
    """
    global _pool, _enabled

    if not DATABASE_URL:
        logger.info("DATABASE_URL nicht gesetzt — In-Memory-Modus")
        return False

    try:
        from psycopg_pool import AsyncConnectionPool

        _pool = AsyncConnectionPool(DATABASE_URL, min_size=1, max_size=10, open=False)
        await _pool.open(wait=True, timeout=10)
        _enabled = True
        logger.info("Postgres-Pool verbunden")
        return True
    except Exception as exc:  # pragma: no cover - abhängig von der Umgebung
        logger.error("Postgres nicht erreichbar (%s) — In-Memory-Modus", exc)
        _pool = None
        _enabled = False
        return False


async def disconnect() -> None:
    global _pool, _enabled
    if _pool is not None:
        await _pool.close()
    _pool = None
    _enabled = False


def pool():
    if _pool is None:
        raise RuntimeError("Kein Datenbank-Pool — is_enabled() vorher prüfen")
    return _pool


async def apply_migrations(sql_path: str) -> None:
    """Wendet die Migration an. Sie ist wiederholbar (siehe 0001_init.sql)."""
    if not _enabled:
        return
    with open(sql_path, encoding="utf-8") as handle:
        sql = handle.read()
    async with pool().connection() as conn:
        await conn.execute(sql)
    logger.info("Migration angewendet: %s", sql_path)


# Mandant des laufenden Vorgangs. Kommt aus dem geprüften Token (siehe
# app/auth.py) und nicht mehr aus einer Konstanten. Ohne konfigurierte Token
# liefert `auth.current_tenant()` den Default — dann ist Auth bewusst aus.
def tenant_id() -> str:
    from ..auth import current_tenant

    return current_tenant()
