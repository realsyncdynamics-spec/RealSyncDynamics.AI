"""Token-Budget je Build.

Bis hierher stand der Verbrauch im Prüfpfad, bremste aber nichts. Auf einer
Plattform, die Module nach Verbrauch abrechnet, ist das die Lücke, die am
schnellsten Geld kostet: Ein Architect, der einen breiten Modulschnitt liefert,
startet zwölf Coder-Läufe, jeder davon mit Retries — und niemand hält an.

**Der Verbrauch wird nicht doppelt gebucht.** Er wird aus dem Prüfpfad gelesen
(`audit_log`), der ihn ohnehin je Lauf mitschreibt. Ein zweiter Zähler wäre ein
zweiter Speicherort für dieselbe Zahl und würde irgendwann abweichen — dann
hätte man zwei Antworten auf die Frage, was ein Build gekostet hat, und keine
davon wäre belastbar.

**Geprüft wird vor jedem Modellaufruf, nicht danach.** Ein Build kann das
Budget deshalb um höchstens einen Aufruf überschreiten: Die Tokens des gerade
laufenden Aufrufs stehen noch nicht im Prüfpfad. Nachträglich abzubrechen wäre
teurer, nicht billiger — bezahlt ist der Aufruf dann ohnehin.

Ein überschrittenes Budget lässt die Task nicht wiederholbar scheitern. Damit
greift dieselbe Mechanik wie beim blockierten Gate: Die Nachfolger werden
blockiert, DevOps deployt nicht, der Governance-Agent aktiviert nichts. Ein
Build, der sein Budget reißt, geht also auch nicht produktiv.

TODO(Abrechnung): Verbrauch je Mandant aggregieren und ans Billing melden.
Aktuell zählt nur der einzelne Build.
"""

from __future__ import annotations

import logging
import os

from . import audit_log

logger = logging.getLogger("builder.budget")

# Obergrenze (Ein- und Ausgabe zusammen) je Build. 0 = unbegrenzt.
#
# Der Default ist bewusst eine echte Zahl und nicht 0: Ein Budget, das
# standardmaessig aus ist, ist kein Budget. Die Grenze greift damit auch dort,
# wo niemand daran gedacht hat, sie zu setzen — und genau dort entstehen die
# Kosten (Retry-Kaskaden, Agent-Schleifen, wiederholtes "nochmal generieren").
#
# 200_000 ist so gewaehlt, dass ein regulaerer Lauf sie nie beruehrt: Eine
# vollstaendige Website-Transformation (ein Audit-Aufruf plus vier PageSpecs)
# liegt bei rund 73_000 Tokens inklusive Ein- und Ausgabe. Selbst mit einer
# Reparaturrunde je Aufruf bleibt mehr als das Doppelte Luft. Wer mehr
# braucht, setzt BUILDER_TOKEN_BUDGET hoch; 0 schaltet die Grenze ab.
TOKEN_BUDGET = int(os.getenv("BUILDER_TOKEN_BUDGET", "200000"))


class BudgetExceeded(RuntimeError):
    """Das Token-Budget des Builds ist aufgebraucht.

    Nicht wiederholbar: Ein zweiter Versuch verbraucht mehr, nicht weniger.
    """

    retryable = False


def is_enabled() -> bool:
    return TOKEN_BUDGET > 0


def used(project_id: str) -> int:
    """Bisher verbrauchte Tokens eines Builds — aus dem Prüfpfad gelesen."""
    return sum(
        (eintrag.tokens_in or 0) + (eintrag.tokens_out or 0)
        for eintrag in audit_log.records(project_id)
    )


def remaining(project_id: str) -> int:
    """Verbleibendes Budget. Ohne Grenze: -1."""
    if not is_enabled():
        return -1
    return max(0, TOKEN_BUDGET - used(project_id))


def ensure_within(project_id: str) -> None:
    """Wirft, wenn das Budget aufgebraucht ist. Vor jedem Modellaufruf."""
    if not is_enabled() or not project_id:
        return

    verbraucht = used(project_id)
    if verbraucht >= TOKEN_BUDGET:
        logger.warning(
            "Budget für %s aufgebraucht: %d von %d Tokens",
            project_id,
            verbraucht,
            TOKEN_BUDGET,
        )
        raise BudgetExceeded(
            f"Token-Budget aufgebraucht: {verbraucht} von {TOKEN_BUDGET} Tokens verbraucht"
        )


def summary(project_id: str) -> dict:
    """Verbrauchsübersicht für die Audit-Antwort."""
    return {
        "tokens_used": used(project_id),
        "token_budget": TOKEN_BUDGET if is_enabled() else None,
        "tokens_remaining": remaining(project_id) if is_enabled() else None,
    }
