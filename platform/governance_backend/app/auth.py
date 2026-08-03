"""Authentifizierung und Mandantenauflösung.

Bis hierher war jeder Endpoint offen und `tenant_id` eine Konstante. Die
`tenant_id` wurde zwar in jede Zeile geschrieben, aber nie als Lesefilter
benutzt — die RLS-Policies der Migration waren damit wirkungslos, weil beide
Dienste mit einer Datenbankrolle und einem festen Mandanten schreiben. Für
eine Plattform, deren Produkt Mandantentrennung *ist*, war das die Lücke mit
der größten Fallhöhe.

**Wie der Mandant reist.** Der Token bestimmt ihn, nicht der Aufrufer:

  * **Nutzer-Token** (`Authorization: Bearer <token>`) → fest zugeordneter
    Mandant aus `GOVERNANCE_AUTH_TOKENS`. Ein Client kann seinen Mandanten also
    nicht wählen, nur beweisen.
  * **Service-Token** → darf einen Mandanten über `X-Tenant-Id` *behaupten*.
    Nötig, weil der Orchestrator dieses Backend im Hintergrund
    aufruft, lange nachdem die HTTP-Anfrage beantwortet ist. Der Alternative —
    das Nutzer-Token bis dahin aufzubewahren — hieße, fremde Zugangsdaten zu
    speichern.

Innerhalb des Prozesses liegt der Mandant in einem `ContextVar`. Das ist kein
Umweg, sondern der Grund, warum der Hintergrund-Scheduler ihn überhaupt hat:
`asyncio.create_task` kopiert den Kontext, der Wert reist also ohne
zusätzlichen Parameter in den Build hinein.

**Ohne konfigurierte Token ist Auth aus.** Dann gilt der Default-Mandant und
der Dienst sagt das unter `/health` und im Log. Sonst wäre ein Stack ohne
Konfiguration nicht startbar — und ein Dienst, der versehentlich offen läuft,
soll das nicht verstecken.
"""

from __future__ import annotations

import hmac
import logging
import os
from contextvars import ContextVar
from typing import Dict, Optional

from fastapi import Header, HTTPException

logger = logging.getLogger("governance.auth")

# "token:mandanten-uuid,token2:mandanten-uuid"
AUTH_TOKENS_RAW = os.getenv("GOVERNANCE_AUTH_TOKENS", "")

# Token für Dienst-zu-Dienst-Aufrufe (darf X-Tenant-Id setzen).
SERVICE_TOKEN = os.getenv("GOVERNANCE_SERVICE_TOKEN", "")

DEFAULT_TENANT_ID = os.getenv(
    "GOVERNANCE_DEFAULT_TENANT_ID", "00000000-0000-0000-0000-000000000001"
)

_current_tenant: ContextVar[Optional[str]] = ContextVar("tenant_id", default=None)


def _parse_tokens(raw: str) -> Dict[str, str]:
    tokens: Dict[str, str] = {}
    for eintrag in raw.split(","):
        eintrag = eintrag.strip()
        if not eintrag:
            continue
        token, _, mandant = eintrag.partition(":")
        if token and mandant:
            tokens[token.strip()] = mandant.strip()
    return tokens


_TOKENS = _parse_tokens(AUTH_TOKENS_RAW)


def is_enabled() -> bool:
    """True, sobald mindestens ein Token konfiguriert ist."""
    return bool(_TOKENS) or bool(SERVICE_TOKEN)


def _passt(kandidat: str, erwartet: str) -> bool:
    """Konstante Laufzeit — ein Vergleich mit `==` verrät die Trefferlänge."""
    return bool(erwartet) and hmac.compare_digest(kandidat, erwartet)


def _token_aus_header(authorization: Optional[str]) -> str:
    if not authorization:
        return ""
    schema, _, wert = authorization.partition(" ")
    if schema.lower() != "bearer":
        return ""
    return wert.strip()


def resolve_tenant(authorization: Optional[str], x_tenant_id: Optional[str]) -> str:
    """Ermittelt den Mandanten aus den Headern. Wirft bei ungültigem Token."""
    if not is_enabled():
        return DEFAULT_TENANT_ID

    token = _token_aus_header(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Bearer-Token fehlt")

    if _passt(token, SERVICE_TOKEN):
        # Der Dienst darf einen Mandanten behaupten — aber er muss es tun.
        # Ohne Angabe stillschweigend auf den Default zu fallen, würde
        # Dienstaufrufe unbemerkt in den falschen Mandanten schreiben.
        if not x_tenant_id:
            raise HTTPException(
                status_code=400, detail="Service-Token ohne X-Tenant-Id"
            )
        return x_tenant_id

    for bekannt, mandant in _TOKENS.items():
        if _passt(token, bekannt):
            return mandant

    raise HTTPException(status_code=401, detail="Token unbekannt")


async def require_tenant(
    authorization: Optional[str] = Header(default=None),
    x_tenant_id: Optional[str] = Header(default=None),
) -> str:
    """FastAPI-Abhängigkeit: prüft den Token und setzt den Mandantenkontext."""
    mandant = resolve_tenant(authorization, x_tenant_id)
    _current_tenant.set(mandant)
    return mandant


def current_tenant() -> str:
    """Mandant des laufenden Vorgangs.

    Greift auch im Hintergrund-Scheduler, weil `asyncio.create_task` den
    Kontext der Anfrage kopiert, in der der Build gestartet wurde.
    """
    return _current_tenant.get() or DEFAULT_TENANT_ID


def set_tenant(mandant: str) -> None:
    """Setzt den Mandanten direkt — für Tests und Hintergrundjobs."""
    _current_tenant.set(mandant)


def configure(tokens: Optional[Dict[str, str]] = None, service_token: str = "") -> None:
    """Überschreibt die Konfiguration zur Laufzeit — nur für Tests."""
    global _TOKENS, SERVICE_TOKEN
    _TOKENS = dict(tokens or {})
    SERVICE_TOKEN = service_token
