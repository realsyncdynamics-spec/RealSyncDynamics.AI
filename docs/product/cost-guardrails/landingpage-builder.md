# Kostenregeln: Landingpage-Builder

**Zweck:** Der Kunde soll vor einer kostenpflichtigen Erzeugung wissen, welche Nutzung anfällt und wo seine Grenze liegt. Dies ist ein Produktvertrag, keine Behauptung, dass die Anzeigen schon gebaut sind.

## Herkunft im Repository

- Der SiteOS Builder und anonyme Builds sind in `docs/product/siteos-anonymous-build.md` beschrieben; dort sind Kontingente und Kostenbremse als Voraussetzung benannt.
- Plattformweite Verbrauchszählung: `usage_events`, `usage_totals`, `usage_limits_config`, `usage-increment`, `src/core/access/usage.ts`, `QuotaBar`.
- Die genaue Zuordnung jeder Landingpage-Aktion zu einem abrechenbaren Kontingent ist nicht durchgängig belegt. `siteos.builder` ist ein Entitlement, aber allein kein Nachweis eines nutzungsabhängigen Preises.

## Verbindliche Produktregeln

1. Der Builder trennt lokale Vorschau, kostenpflichtige KI-Erzeugung, erneute KI-Änderung, Speicherung, Übernahme und Veröffentlichung. Nur Aktionen mit tatsächlichem Verbrauch werden als verbrauchsrelevant bezeichnet.
2. Vor einer kostenpflichtigen Erzeugung werden Einheit, aktueller Zähler, enthaltenes Kontingent, Grenze und mögliche Zusatzkosten aus der kanonischen Tarif-/Entitlement-Quelle gezeigt. Fehlt eine belastbare Tarifquelle, darf keine Zahl oder Zusatzgebühr behauptet werden; kostenpflichtige Ausführung bleibt gesperrt oder benötigt eine explizite bestätigte Kostenobergrenze.
3. Vor Bestätigung werden vorgeschlagene Inhalte und der geschätzte Verbrauch angezeigt. Jede neue kostenpflichtige Iteration wird erneut angezeigt und bestätigt; automatische Wiederholungen dürfen nicht weiterberechnen.
4. Verbrauch wird tenant-scoped, serverseitig, idempotent und vor Modellaufruf reserviert. Bei fehlgeschlagener Reservierung kein Modellaufruf. Fehler und Abbruch dürfen keinen verdeckten zweiten Build auslösen.
5. Aktueller Verbrauch, Zeitraum und Limit sind im Builder sichtbar. Fehlende Daten bleiben „nicht verfügbar“ statt „0“ oder „unbegrenzt“.
6. Preview- und Frontend-Änderungen bewahren das bestehende Backend des Kunden. Speichern oder Veröffentlichen ist eine gesonderte Aktion mit eigener Kosten-/Checkout-Vorschau.

## Prüfbare Abnahme

- Die Vorschau ohne Modellaufruf verbraucht keinen Modellaufruf-Zähler.
- Ein kostenpflichtiger Build lässt sich bei erreichtem Hard Cap weder über UI noch direkte API starten.
- Vor einer kostenpflichtigen Ausführung stehen Aktion, Einheit, Zeitraum, aktuelle Nutzung und anwendbare Grenze im Bestätigungsschritt.
- Wiederholtes Klicken, Netzwerk-Retry oder Abbruch erzeugt höchstens eine reservierte Nutzung je Idempotenzschlüssel.
- Ohne bestätigte Preisquelle wird weder eine konkrete Gebühr noch „kostenlos“ für Modellnutzung angezeigt.
- Eine neue veröffentlichte Seite kann das bestehende Backend nicht verändern; Veröffentlichung verlangt eigene Bestätigung.
- Verbrauch und Ergebnis lassen sich über Prüfpfad und serverseitigen Zähler zu derselben Projekt-/Request-ID nachvollziehen.

## Nicht-Ziele

Keine neuen Preise, Kreditmengen, Stripe-Artikel, automatische Veröffentlichung oder EU-Hosting-Zusage. Kostenpflichtige Modellnutzung bleibt deaktiviert, bis Reservierung, Anzeige und Abnahme gemeinsam nachgewiesen sind.
