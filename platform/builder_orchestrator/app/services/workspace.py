"""Ablage der generierten Dateien auf Platte.

Bisher lagen Coder-Ergebnisse im Task-Output und damit in einer JSONB-Spalte.
Das trägt nicht: Ein Modul mit vielen Dateien sprengt die Zeile, und der
DevOps-Schritt kann daraus nichts bauen — bauen heißt, Dateien an einem Pfad
zu haben.

**Der Pfad kommt aus einer Modellantwort.** Das ist der Grund, warum dieses
Modul mehr Prüfung als Code enthält. Ein generiertes `path` kann
`../../../etc/passwd`, `/etc/cron.d/x` oder ein Symlink-Ziel sein — ohne
Kontrolle schreibt der Builder dorthin, wohin das Modell zeigt. Es gilt
deshalb, ohne Ausnahme:

  * relative Pfade, keine absoluten,
  * nach Auflösung muss das Ziel **unterhalb** des Projektverzeichnisses
    liegen (fängt `..`, Symlinks und Kombinationen davon),
  * Obergrenzen für Dateizahl und Größe, damit eine Antwort nicht die Platte
    füllt.

Verstöße sind keine Warnung, sondern ein Fehler: Der Coder-Task scheitert und
der Befund landet im Prüfpfad.

TODO(Volume): Der Root liegt im Container-Dateisystem. Für echte Builds gehört
er auf ein Volume, das der Build-Runner mounten kann.
"""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
from pathlib import Path
from typing import Iterable, List, Tuple

logger = logging.getLogger("builder.workspace")

WORKSPACE_ROOT = Path(os.getenv("BUILDER_WORKSPACE_ROOT", "/tmp/builder_workspaces"))

# Obergrenzen je Modul. Sie schützen nicht vor Absicht, sondern vor einer
# entgleisten Antwort — ein Modell, das in einer Schleife Dateien erzeugt.
MAX_FILES_PER_MODULE = int(os.getenv("BUILDER_MAX_FILES_PER_MODULE", "200"))
MAX_FILE_BYTES = int(os.getenv("BUILDER_MAX_FILE_BYTES", str(512 * 1024)))


class UnsafePathError(ValueError):
    """Der Zielpfad verlässt das Projektverzeichnis oder ist unbrauchbar.

    Nicht wiederholbar: Dieselbe Antwort erzeugt denselben Pfad.
    """

    retryable = False


class WorkspaceLimitError(ValueError):
    """Datei- oder Mengenlimit überschritten."""

    retryable = False


def project_root(project_id: str) -> Path:
    """Verzeichnis eines Projekts. `project_id` wird mitgeprüft."""
    if not project_id or "/" in project_id or "\\" in project_id or ".." in project_id:
        raise UnsafePathError(f"Unbrauchbare project_id: {project_id!r}")
    return WORKSPACE_ROOT / project_id


def resolve_target(base: Path, relative: str) -> Path:
    """Löst einen Pfad aus der Modellantwort gegen `base` auf.

    Wirft, sobald das Ergebnis nicht unterhalb von `base` liegt. Die Auflösung
    passiert über `Path.resolve()`, damit auch Symlinks und gemischte Formen
    (`a/../../b`) erfasst werden — eine reine Textprüfung auf `..` würde genau
    daran vorbeigehen.
    """
    if not relative or not relative.strip():
        raise UnsafePathError("Leerer Dateipfad")
    if "\x00" in relative:
        raise UnsafePathError("Dateipfad enthält ein Nullbyte")

    candidate = Path(relative)
    if candidate.is_absolute() or (len(relative) > 1 and relative[1] == ":"):
        raise UnsafePathError(f"Absoluter Pfad nicht erlaubt: {relative!r}")

    base_resolved = base.resolve()
    target = (base_resolved / candidate).resolve()

    if target == base_resolved or base_resolved not in target.parents:
        raise UnsafePathError(f"Pfad verlässt das Projektverzeichnis: {relative!r}")

    return target


def write_module(project_id: str, module: str, files: Iterable[Tuple[str, str]]) -> List[str]:
    """Schreibt die Dateien eines Moduls und gibt das Manifest zurück.

    Jedes Modul bekommt ein eigenes Unterverzeichnis. Damit können die
    Coder-Tasks parallel schreiben, ohne sich in die Quere zu kommen — sie
    teilen sich kein Verzeichnis.

    Rückgabe sind die projektrelativen Pfade. Sie ersetzen den Dateiinhalt im
    Task-Output: Was im Prüfpfad zählt, ist welche Dateien entstanden sind.
    """
    modul_wurzel = resolve_target(project_root(project_id), module)
    modul_wurzel.mkdir(parents=True, exist_ok=True)

    wurzel = project_root(project_id).resolve()
    manifest: List[str] = []

    for index, (pfad, inhalt) in enumerate(files):
        if index >= MAX_FILES_PER_MODULE:
            raise WorkspaceLimitError(
                f"Modul {module}: mehr als {MAX_FILES_PER_MODULE} Dateien"
            )

        roh = inhalt.encode("utf-8")
        if len(roh) > MAX_FILE_BYTES:
            raise WorkspaceLimitError(
                f"{pfad}: {len(roh)} Bytes über dem Limit von {MAX_FILE_BYTES}"
            )

        ziel = resolve_target(modul_wurzel, pfad)
        ziel.parent.mkdir(parents=True, exist_ok=True)
        ziel.write_bytes(roh)
        manifest.append(str(ziel.relative_to(wurzel)))

    logger.info("Modul %s/%s: %d Dateien geschrieben", project_id, module, len(manifest))
    return manifest


def list_files(project_id: str) -> List[Path]:
    """Alle Dateien eines Projekts — Grundlage für Build-Hash und Prüfungen."""
    wurzel = project_root(project_id)
    if not wurzel.exists():
        return []
    return sorted(pfad for pfad in wurzel.rglob("*") if pfad.is_file())


def content_hash(project_id: str) -> str:
    """Hash über Pfade **und** Inhalte aller generierten Dateien.

    Deterministisch über die sortierte Dateiliste — ein Retry derselben Task
    trifft denselben Workspace und damit denselben Hash. Genau das macht den
    Gate-Aufruf idempotent. Ein Hash nur über die Pfade täte das nicht: Zwei
    Builds mit gleichem Modulschnitt, aber anderem Inhalt wären ununterscheidbar.
    """
    digest = hashlib.sha256()
    wurzel = project_root(project_id).resolve()

    for pfad in list_files(project_id):
        digest.update(str(pfad.relative_to(wurzel)).encode("utf-8"))
        digest.update(b"\0")
        digest.update(pfad.read_bytes())
        digest.update(b"\0")

    return f"sha256:{digest.hexdigest()}"


def read_text(pfad: Path) -> str:
    """Liest eine Datei tolerant — generierter Inhalt ist nicht garantiert UTF-8."""
    return pfad.read_text(encoding="utf-8", errors="replace")


def clear(project_id: str) -> None:
    """Räumt das Projektverzeichnis ab (Tests, Neuanlage)."""
    shutil.rmtree(project_root(project_id), ignore_errors=True)
