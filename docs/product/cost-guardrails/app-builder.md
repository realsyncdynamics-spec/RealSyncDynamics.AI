# Kostenregeln: App-Builder

**Zweck:** Kontrollierte Kosten bei App-Generierung, Codeänderung und Laufzeit. Die Regeln unterscheiden Vorschau von kostenpflichtigen Modell- oder Infrastrukturaktionen.

## Herkunft im Repository

- Der Bolt-Builder-Governance-Gate liegt unter `src/features/app-builder/bolt/governance-gate.ts`; er blockiert unter anderem nicht autorisierte oder produktive Aktionen.
- Plattformweite Nutzungsbausteine sind `usage-increment`, `usage_totals`, `src/core/access/usage.ts` und `QuotaBar`.
- Die Kosten-/Nutzungszählung für konkrete App-Builder-Schritte, Provider-Fehler und Laufzeit ist noch nicht vollständig mit den Nutzeraktionen verbunden. Ein Governance-Gate ist kein Kostenlimit.

## Verbindliche Produktregeln

1. Aktionen sind mindestens getrennt: Prompt/Plan, Codegenerierung, weitere Änderung, Build/Preview, Testlauf, Veröffentlichung, Hosting und externe Integrationen. Nur eine tatsächlich verbrauchende Aktion zählt als Nutzung.
2. Vor einer kostenpflichtigen Modell- oder Infrastrukturaktion zeigt die Oberfläche den Schritt, die Verbrauchseinheit, den Verbrauch im Zeitraum und die geltende Grenze. Zusatzkosten werden nur angezeigt, wenn sie aus freigegebenen Preisen beziehungsweise Anbieterbedingungen berechnet werden können.
3. Jede kostenpflichtige Aktion braucht eine ausdrückliche Bestätigung mit der angegebenen Verbrauchsgrenze. Wiederholungen, automatische Agentenschleifen und Hintergrundjobs stoppen am konfigurierten Hard Cap.
4. Verbrauchsreservierung und Hard Cap liegen serverseitig und sind an Tenant, Projekt, Aktion und Idempotenzschlüssel gebunden. Clientseitige Zähler sind reine Anzeige und keine Autorisierungsquelle.
5. Kein stiller Wechsel auf einen teureren Anbieter oder ein anderes Modell. Fallbacks, neue Laufzeitdienste und Integrationen benötigen vorherige Anzeige und Zustimmung.
6. Bei Abbruch oder Providerfehler wird die Reservierung anhand tatsächlicher Provider-Nutzung reconciled. Nicht verbrauchte Einheiten werden freigegeben; unbekannte Nutzung wird sichtbar als ungeklärt markiert und nicht als gesicherter Betrag ausgegeben.
7. Kostenkontrolle darf keine Governance-Sperre umgehen. Veröffentlichen, produktiver Zugriff und Supabase-/Produktivänderungen bleiben separate freizugebende Aktionen.

## Prüfbare Abnahme

- Promptvorschau ohne Modellzugriff ändert keine Nutzung.
- Jeder kostenpflichtige Modellaufruf reserviert Verbrauch vor dem Provideraufruf; Reservation failure blockiert fail-closed.
- Hard Cap hält bei parallelen Aufrufen und Agenten-Retries.
- Ein Request mit gleichem Idempotenzschlüssel kann keine doppelte kostenpflichtige Aktion erzeugen.
- UI zeigt Zeitraum, Ist-Verbrauch, Grenze und Status; bei fehlender Messung ist der Zustand ausdrücklich unbekannt.
- Preis-/Kostenwerte sind auf eine freigegebene Quelle und Provider-Modellversion zurückführbar.
- Kein Hintergrundjob und kein Auto-Retry startet nach Erreichen des Limits.
- Tests decken erlaubt, Warnschwelle, Hard Cap, Providerfehler, Doppelklick und Parallelität ab.

## Nicht-Ziele

Keine fiktiven Credits, Wechselkurse, Modellpreise, Hostingkosten oder öffentlichen Kostenvorteile. Keine Änderung an Preisen, Stripe-Produkten, Anbietern oder Produktionsfreigaben.
