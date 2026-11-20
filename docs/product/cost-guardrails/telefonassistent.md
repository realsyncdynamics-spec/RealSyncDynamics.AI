# Kostenregeln: Telefonassistent

**Zweck:** Planbare Nutzung vor und während Telefonie. Dieses Dokument definiert Abnahmekriterien, keine Preiszusage und keine Anbieterwahl.

## Herkunft im Repository

- Serverseitige Reservierung und Ablehnung: `supabase/functions/_shared/bot-budget.ts`, `bot_usage_limits`, `bot_voice_call_reserve`.
- Minutenlimit: kleinerer Wert aus Plan-Entitlement und explizitem Mandantenlimit.
- Gesprächskosten: `bot_voice_call_costs` aggregiert Telefoniesekunden und gemessene KI-Kosten. Die Sicht ist interne Kostenkontrolle und nicht fakturiert.
- Die öffentliche Oberfläche zeigt den tatsächlichen Verbrauch und die aktive Grenze noch nicht zusammenhängend.

## Verbindliche Produktregeln

1. Vor Aktivierung eines kostenpflichtigen Anbieters zeigt die Oberfläche die konfigurierte Obergrenze für Minuten und interne Kosten samt Abrechnungszeitraum. Keine konfigurierte Grenze bedeutet: kostenpflichtige Telefonie bleibt gesperrt.
2. Vor dem ersten kostenpflichtigen Anruf bestätigt der Nutzer die ausgewählte Verbrauchsgrenze. Keine Vorauswahl, die eine kostenpflichtige Nutzung stillschweigend aktiviert.
3. Der Server reserviert Minuten und Budget vor dem Anbieteraufruf. Grenz- oder Konfigurationsfehler stoppen den Anruf fail-closed.
4. Dashboard und Bot-Detail zeigen Verbrauch, Grenze und Aktualisierungszeitpunkt. Fehlende oder veraltete Daten erscheinen als „nicht verfügbar“, nie als 0 oder unbegrenzt.
5. Warnungen erscheinen bei 75 % und 90 %; am Hard Cap wird neue kostenpflichtige Nutzung blockiert. Die UI-Warnung ersetzt nicht die serverseitige Sperre.
6. Interne Anbieter-Kosten werden klar als Schätzung/Steuerungswert gekennzeichnet und niemals als Kundenrechnung dargestellt.
7. Preise, Minutenpakete, Anbieter- oder EU-Hosting-Aussagen werden erst öffentlich verwendet, wenn sie in der freigegebenen Preisquelle beziehungsweise in belegten Anbieterbedingungen nachgewiesen sind.

## Einheitlicher deutscher Anbietertest

Jeder Anbieter wird mit derselben Konfiguration und demselben Skript getestet. Testprotokoll enthält Anbieter-/Modellversion, Region und Einstellungen, Datum, Latenz, Erkennungsfehler, Übergaben und geschätzten Verbrauch. Gleiche Bedingungen und Wiederholungen sind Pflicht; ein einzelner Durchlauf entscheidet nicht.

**Skript (ca. 5 Minuten, gleiche Sprechweise und Pausen):**

- **Begrüßung:** „Guten Tag, hier ist Müller Sanitär. Wie kann ich Ihnen helfen?“
- **Störung:** „Unter der Spüle tropft es stark. Können Sie heute noch kommen?“ Agent soll Dringlichkeit erfragen, keine unbelegte Zusage machen und eine menschliche Übergabe anbieten.
- **Name und Rückrufnummer:** „Ich heiße Jana Müller. Meine Nummer ist 0176 12345678.“ Prüfen, ob Ziffern korrekt wiederholt und bestätigt werden.
- **Terminwunsch:** „Morgen Vormittag wäre gut. Am liebsten zwischen neun und elf.“ Agent soll Wunsch erfassen und Verfügbarkeit nicht erfinden.
- **Unterbrechung/Korrektur:** „Moment, ich muss erst meinen Kalender prüfen … doch lieber am Nachmittag.“ Prüfen: Unterbrechung, natürliches Abwarten, Korrektur des Zeitfensters.
- **Schwierige Akustik:** Telefonnummer einmal mit Nebengeräusch und anschließend langsam wiederholen. Erfassung muss bestätigt oder an einen Menschen übergeben werden, statt zu raten.
- **Offenlegung und Abschluss:** Agent stellt sich als KI-Assistent vor, fasst Anfrage, Kontaktdaten und Terminwunsch knapp zusammen und fragt nach Korrektur.
- **Fallback:** Tester sagt „Ich möchte mit einem Menschen sprechen.“ Agent muss den vereinbarten Übergabeweg auslösen oder dessen Nichtverfügbarkeit transparent mitteilen.

Bewertungsskala je Kriterium: 0 = fehlgeschlagen, 1 = teilweise, 2 = korrekt. Kriterien: Verständlichkeit, deutsche Aussprache, Unterbrechungen, Datenerfassung, keine erfundenen Zusagen, menschliche Übergabe, Offenlegung, Kostenmessung. Rohaufzeichnungen nur mit gesonderter Freigabe und festgelegter Löschfrist.

## Prüfbare Abnahme

- Bei fehlender/abgelaufener Budgetkonfiguration startet kein kostenpflichtiger Provider-Call.
- Ein Call oberhalb des Minuten- oder Kostenlimits wird serverseitig abgelehnt, auch wenn die UI umgangen wird.
- Verbrauch und Limit stimmen mit der serverseitigen Quelle und dem benannten Zeitraum überein; unbekannter Verbrauch wird nicht als 0 gerendert.
- Fehler, Wiederholungen und parallele Anrufe können das Limit nicht stillschweigend überschreiten.
- Der Testbericht enthält Resultate für jeden Skriptpunkt und dieselbe Kostenmessung pro Anbieter; bis dahin ist keine Anbieterempfehlung freigegeben.

## Nicht-Ziele

Keine Änderung an Anbieter, Preis, Stripe, EU-Datenresidenz oder Telefonie-Aktivierung. Keine Zusage von Natürlichkeit, Rechtskonformität oder bestimmter Latenz ohne Testergebnis und Nachweis.
