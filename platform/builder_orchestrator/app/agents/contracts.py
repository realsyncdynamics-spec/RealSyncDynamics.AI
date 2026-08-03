"""Ausgabeverträge der generierenden Agenten.

Diese Modelle sind zweierlei zugleich: das JSON-Schema, das dem Modell als
Structured-Output-Vorgabe mitgegeben wird, **und** die Validierung der Antwort.
Beides aus einer Quelle — sonst driften Vorgabe und Prüfung auseinander, und
genau in diese Lücke fällt dann ein Modelloutput, der zwar der Vorgabe folgt,
aber am Parser scheitert.

Bewusst keine freien Dictionaries: `extra="forbid"` erzeugt
`additionalProperties: false` im Schema, was Structured Outputs verlangen. Wo
inhaltlich eine Abbildung nötig wäre (Datei → Inhalt), steht deshalb eine
Liste mit festen Feldern.
"""

from __future__ import annotations

from typing import List

from pydantic import BaseModel, ConfigDict, Field


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Feature(_Strict):
    name: str
    description: str
    # Grober Aufwand — steuert später die Reihenfolge im Backlog.
    priority: int = 3


class PlannerOutput(_Strict):
    features: List[Feature] = Field(default_factory=list)
    open_questions: List[str] = Field(default_factory=list)
    # Vom Modell erkannte Compliance-Pflichten (Transparenzhinweis, Model Card,
    # PII-Scan). Sie landen im Task-Output und damit im Prüfpfad.
    compliance_notes: List[str] = Field(default_factory=list)


class ApiEndpoint(_Strict):
    method: str
    path: str
    description: str


class ArchitectOutput(_Strict):
    schema_sql: str
    # Der Modulschnitt: Aus dieser Liste entsteht je Eintrag eine Coder-Task.
    # Deshalb wird sie unten in `sanitize_modules` hart normalisiert — der
    # Wert wandert in eine Task-ID.
    modules: List[str] = Field(default_factory=list)
    api_contract: List[ApiEndpoint] = Field(default_factory=list)


class GeneratedFile(_Strict):
    path: str
    content: str


class CoderOutput(_Strict):
    files: List[GeneratedFile] = Field(default_factory=list)
    tests: List[GeneratedFile] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)


# Obergrenze für den Fan-out. Ohne sie bestimmt die Modellantwort, wie viele
# parallele Coder-Läufe ein einzelner Build auslöst — also auch, wie viel er
# kostet.
MAX_MODULES = 12

_ERLAUBT = set("abcdefghijklmnopqrstuvwxyz0123456789-_")


def sanitize_modules(modules: List[str]) -> List[str]:
    """Macht Modellausgaben als Task-ID-Bestandteil brauchbar.

    Modulnamen gehen in `task_coder:<modul>` ein. Ein Name mit Leerzeichen,
    Doppelpunkt oder Slash würde IDs erzeugen, die sich nicht mehr eindeutig
    zurücklesen lassen — und Duplikate lassen `insert_spawned` werfen.
    """
    sauber: List[str] = []
    for modul in modules:
        normalisiert = "".join(
            zeichen for zeichen in modul.strip().lower().replace(" ", "_") if zeichen in _ERLAUBT
        )
        if normalisiert and normalisiert not in sauber:
            sauber.append(normalisiert)
    return sauber[:MAX_MODULES]
