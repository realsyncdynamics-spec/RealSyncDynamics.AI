"""Prüft, dass alles ins Image kommt, was der Dienst zur Laufzeit liest.

Hintergrund: Der Dockerfile kopierte `app/`, aber nicht `migrations/`. Der
Lifespan öffnet die Migration jedoch ungeschützt beim Start — mit gesetzter
`DATABASE_URL` (was docker-compose tut) brach der Container deshalb mit
`FileNotFoundError` ab, bevor er den Port öffnete.

Keiner der vorhandenen Tests konnte das sehen: Sie laufen alle aus dem
Quellbaum, wo die Datei liegt. Der Fehler existierte ausschließlich im Image.
Dieser Test schließt genau diese Lücke, indem er den Dockerfile gegen die
Pfade prüft, die der Code zur Laufzeit anfasst.
"""

from __future__ import annotations

import re
from pathlib import Path

DIENST = Path(__file__).resolve().parent.parent
DOCKERFILE = DIENST / "Dockerfile"

# Pfade relativ zum Dienstverzeichnis, die zur Laufzeit gelesen werden.
# `main.py` leitet die Migration aus `__file__` ab — im Image liegt sie damit
# neben `app/`, nicht darin.
LAUFZEIT_PFADE = ("migrations/0001_init.sql",)

_COPY = re.compile(r"^\s*COPY\s+(?:--\S+\s+)*(.+)$", re.MULTILINE)


def _kopierte_quellen() -> list[str]:
    """Quellpfade aller COPY-Direktiven (letztes Argument ist das Ziel)."""
    quellen: list[str] = []
    for zeile in _COPY.findall(DOCKERFILE.read_text(encoding="utf-8")):
        teile = zeile.split()
        if len(teile) >= 2:
            quellen.extend(teile[:-1])
    return quellen


def test_laufzeitpfade_liegen_im_image():
    quellen = _kopierte_quellen()

    for pfad in LAUFZEIT_PFADE:
        assert (DIENST / pfad).exists(), f"{pfad} fehlt schon im Quellbaum"
        wurzel = pfad.split("/")[0]
        assert wurzel in quellen or pfad in quellen, (
            f"{DOCKERFILE.name} kopiert '{wurzel}' nicht — der Dienst liest zur "
            f"Laufzeit '{pfad}' und bricht sonst beim Start ab. Kopiert wird: {quellen}"
        )


def test_container_laeuft_nicht_als_root():
    """Ein Prozess, der generierten Code ausfuehrt, soll das nicht als Root tun.

    Nur der Dockerfile ist hier pruefbar — ob der Mountpunkt des Volumes dem
    Nicht-Root-Nutzer wirklich gehoert, zeigt sich erst beim Start mit einem
    Docker-Daemon.
    """
    inhalt = DOCKERFILE.read_text(encoding="utf-8")
    zeilen = [z.strip() for z in inhalt.splitlines() if z.strip().startswith("USER ")]

    assert zeilen, f"{DOCKERFILE.name} setzt kein USER — der Container laeuft als root"
    assert zeilen[-1] != "USER root", "letzte USER-Direktive faellt auf root zurueck"
