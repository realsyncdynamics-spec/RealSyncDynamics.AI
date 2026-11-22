# Kostenregeln je Produkt

**Zweck:** Planbare Nutzung vor und während kostenpflichtiger Schritte. Dieses Dokument legt
Abnahmekriterien fest. Es ist keine Preiszusage, keine Anbieterwahl und kein Beleg, dass die
beschriebenen Anzeigen schon gebaut sind. Preise kommen ausschließlich aus `shared/pricing.ts`,
Status aus `src/product/implementation-status.ts`.

Zusammengeführt aus den Entwürfen #2365 (Telefonassistent), #2366 (Governance OS),
#2367 (Landingpage-Builder) und #2368 (App-Builder). Inhalt unverändert, gemeinsame Regeln
herausgezogen.

## Gemeinsame Regeln (gelten für alle vier Produkte)

1. **Serverseitig, fail-closed.** Verbrauch wird tenant-scoped, idempotent und **vor** dem
   Provideraufruf reserviert. Fehlt eine Grenze oder schlägt die Reservierung fehl, erfolgt kein
   kostenpflichtiger Aufruf. Clientseitige Zähler sind reine Anzeige, keine Autorisierungsquelle.
2. **Hard Cap hält immer.** Am Limit wird neue kostenpflichtige Nutzung blockiert, auch bei
   umgangener UI, parallelen Aufrufen, Retries, Agentenschleifen und Hintergrundjobs.
3. **Ausdrückliche Bestätigung.** Vor jeder kostenpflichtigen Aktion stehen Aktion,
   Verbrauchseinheit, Zeitraum, aktueller Verbrauch und geltende Grenze im Bestätigungsschritt.
   Keine Vorauswahl, die kostenpflichtige Nutzung stillschweigend aktiviert. Wiederkehrende Jobs
   brauchen eine eigene Aktivierung mit Frequenz, Obergrenze und Stop-Option.
4. **Unbekannt bleibt unbekannt.** Fehlende oder veraltete Messdaten erscheinen als
   „nicht verfügbar“ beziehungsweise „noch keine Messdaten“, nie als 0, „kostenlos“ oder
   „unbegrenzt“. Zähler zeigen Zeitraum und Datenstand.
5. **Interne Kosten ≠ Kundenpreis.** Interne Anbieterkosten sind Schätzung/Steuerungswert und
   werden nie als Rechnung oder Kundengebühr dargestellt. Zusatzkosten erscheinen nur, wenn sie aus
   freigegebenen Preisen beziehungsweise belegten Anbieterbedingungen berechnet werden können.
6. **Mandantentrennung.** Tenant A kann weder Nutzungszähler noch Kosten von Tenant B lesen.
7. **Prüfpfad.** Request, Reservierung, Nutzung, Ergebnis und Evidence sind über eine gemeinsame
   Request-ID nachvollziehbar.
8. **Governance bleibt vorrangig.** Kostenkontrolle umgeht keine Governance-Sperre. Veröffentlichen,
   produktiver Zugriff und Produktivänderungen bleiben eigene, freizugebende Aktionen.

**Gemeinsame Nicht-Ziele:** keine neuen oder geänderten Preise, Kreditmengen, Stripe-Artikel,
Anbieter, EU-Hosting-/Compliance-Zusagen oder Produktionsfreigaben.

---

## Telefonassistent

### Herkunft im Repository

- Serverseitige Reservierung und Ablehnung: `supabase/functions/_shared/bot-budget.ts`,
  `bot_usage_limits`, `bot_voice_call_reserve`.
- Minutenlimit: kleinerer Wert aus Plan-Entitlement und explizitem Mandantenlimit.
- Gesprächskosten: `bot_voice_call_costs` aggregiert Telefoniesekunden und gemessene KI-Kosten.
  Die Sicht ist interne Kostenkontrolle und nicht fakturiert.
- Die öffentliche Oberfläche zeigt tatsächlichen Verbrauch und aktive Grenze noch nicht
  zusammenhängend.

### Produktspezifische Regeln

1. Vor Aktivierung eines kostenpflichtigen Anbieters zeigt die Oberfläche die konfigurierte
   Obergrenze für Minuten und interne Kosten samt Abrechnungszeitraum. Keine konfigurierte Grenze
   bedeutet: kostenpflichtige Telefonie bleibt gesperrt.
2. Vor dem ersten kostenpflichtigen Anruf bestätigt der Nutzer die ausgewählte Verbrauchsgrenze.
3. Dashboard und Bot-Detail zeigen Verbrauch, Grenze und Aktualisierungszeitpunkt.
4. Warnungen bei 75 % und 90 %; die UI-Warnung ersetzt nicht die serverseitige Sperre.
5. Preise, Minutenpakete, Anbieter- oder EU-Hosting-Aussagen werden erst öffentlich verwendet,
   wenn sie in der freigegebenen Preisquelle beziehungsweise in belegten Anbieterbedingungen
   nachgewiesen sind.

### Einheitlicher deutscher Anbietertest

Jeder Anbieter wird mit derselben Konfiguration und demselben Skript getestet. Das Testprotokoll
enthält Anbieter-/Modellversion, Region und Einstellungen, Datum, Latenz, Erkennungsfehler,
Übergaben und geschätzten Verbrauch. Gleiche Bedingungen und Wiederholungen sind Pflicht; ein
einzelner Durchlauf entscheidet nicht.

**Skript (ca. 5 Minuten, gleiche Sprechweise und Pausen):**

- **Begrüßung:** „Guten Tag, hier ist Müller Sanitär. Wie kann ich Ihnen helfen?“
- **Störung:** „Unter der Spüle tropft es stark. Können Sie heute noch kommen?“ Agent soll
  Dringlichkeit erfragen, keine unbelegte Zusage machen und eine menschliche Übergabe anbieten.
- **Name und Rückrufnummer:** „Ich heiße Jana Müller. Meine Nummer ist 0176 12345678.“ Prüfen,
  ob Ziffern korrekt wiederholt und bestätigt werden.
- **Terminwunsch:** „Morgen Vormittag wäre gut. Am liebsten zwischen neun und elf.“ Agent soll den
  Wunsch erfassen und Verfügbarkeit nicht erfinden.
- **Unterbrechung/Korrektur:** „Moment, ich muss erst meinen Kalender prüfen … doch lieber am
  Nachmittag.“ Prüfen: Unterbrechung, natürliches Abwarten, Korrektur des Zeitfensters.
- **Schwierige Akustik:** Telefonnummer einmal mit Nebengeräusch und anschließend langsam
  wiederholen. Erfassung muss bestätigt oder an einen Menschen übergeben werden, statt zu raten.
- **Offenlegung und Abschluss:** Agent stellt sich als KI-Assistent vor, fasst Anfrage,
  Kontaktdaten und Terminwunsch knapp zusammen und fragt nach Korrektur.
- **Fallback:** Tester sagt „Ich möchte mit einem Menschen sprechen.“ Agent muss den vereinbarten
  Übergabeweg auslösen oder dessen Nichtverfügbarkeit transparent mitteilen.

Bewertungsskala je Kriterium: 0 = fehlgeschlagen, 1 = teilweise, 2 = korrekt. Kriterien:
Verständlichkeit, deutsche Aussprache, Unterbrechungen, Datenerfassung, keine erfundenen Zusagen,
menschliche Übergabe, Offenlegung, Kostenmessung. Rohaufzeichnungen nur mit gesonderter Freigabe
und festgelegter Löschfrist.

### Prüfbare Abnahme

- Bei fehlender/abgelaufener Budgetkonfiguration startet kein kostenpflichtiger Provider-Call.
- Ein Call oberhalb des Minuten- oder Kostenlimits wird serverseitig abgelehnt, auch wenn die UI
  umgangen wird.
- Verbrauch und Limit stimmen mit der serverseitigen Quelle und dem benannten Zeitraum überein.
- Fehler, Wiederholungen und parallele Anrufe können das Limit nicht stillschweigend überschreiten.
- Der Testbericht enthält Resultate für jeden Skriptpunkt und dieselbe Kostenmessung pro Anbieter;
  bis dahin ist keine Anbieterempfehlung freigegeben.

### Nicht-Ziele

Keine Telefonie-Aktivierung. Keine Zusage von Natürlichkeit, Rechtskonformität oder bestimmter
Latenz ohne Testergebnis und Nachweis.

---

## Governance OS

### Herkunft im Repository

- Der öffentliche Website-Scan ist in `src/product/implementation-status.ts` als kostenlos
  beschrieben.
- Plattformweite Nutzung: `usage_events`, `usage_totals`, `usage_limits_config`,
  `tenant_cost_ledger`, `tenant_cost_caps`.
- Das Kosten-Ledger ist laut `20260603100000_tenant_cost_ledger.sql` interne
  Laufzeitbeobachtung, keine Rechnung; öffentliche Dashboards lesen es nicht.
- Governance-Agent-Aufrufe berechnen teilweise Modellkosten, eine durchgängige Tenant-Ansicht mit
  Limits und Bestätigung ist aber nicht belegt. Eine Produktionsdatenbasis für Prognosen war laut
  Projektstand zuletzt nicht vorhanden.

### Produktspezifische Regeln

1. Der vorhandene kostenlose Website-Scan bleibt kostenlos: keine Upgrade-Pflicht, kein
   nutzungsabhängiger Preis, keine künstliche Verbrauchsanzeige.
2. Für tatsächlich kostenpflichtige KI-Läufe, Exporte, Integrationen oder geplante Jobs gelten die
   gemeinsamen Regeln 1 bis 5. Gebühren werden nicht aus internen Anbieterkosten abgeleitet.
3. Freigabe, Findings, Korrekturen und Nachweise bleiben unabhängig vom Kostenlimit erhalten. Eine
   automatische Wiederholungsprüfung benötigt eine eigene Aktivierung und ein sichtbares Intervall.

### Prüfbare Abnahme

- Der kostenlose Website-Scan erstellt keine kostenpflichtige Stripe-Position und bleibt ohne
  Zahlungsdaten erreichbar.
- Jeder kostenpflichtige Lauf wird vor Provideraufruf mandantenbezogen reserviert und am Hard Cap
  abgelehnt.
- Kostenpflichtige Wiederholung oder Automatik startet erst nach expliziter Aktivierung; Stop
  deaktiviert zukünftige Läufe.
- Das Dashboard weist interne Kostenschätzung nie als Rechnung oder Kundenpreis aus.
- Tenant A kann weder Nutzungszähler noch Kosten von Tenant B lesen.
- Fehlende Messdaten bleiben als unbekannt gekennzeichnet.
- Request, Kostenreservierung, Nutzung, Ergebnis und Evidence sind über eine gemeinsame
  Request-ID im Prüfpfad auffindbar.

### Nicht-Ziele

Keine neue kostenpflichtige Scan-Stufe und keine automatische Dauerüberwachung ohne bestätigte
technische Abnahme.

---

## Landingpage-Builder

### Herkunft im Repository

- SiteOS Builder und anonyme Builds sind in `docs/product/siteos-anonymous-build.md`
  beschrieben; dort sind Kontingente und Kostenbremse als Voraussetzung benannt.
- Plattformweite Verbrauchszählung: `usage_events`, `usage_totals`, `usage_limits_config`,
  `usage-increment`, `src/core/access/usage.ts`, `QuotaBar`.
- Die Zuordnung jeder Landingpage-Aktion zu einem abrechenbaren Kontingent ist nicht durchgängig
  belegt. `siteos.builder` ist ein Entitlement, allein aber kein Nachweis eines
  nutzungsabhängigen Preises.

### Produktspezifische Regeln

1. Der Builder trennt lokale Vorschau, kostenpflichtige KI-Erzeugung, erneute KI-Änderung,
   Speicherung, Übernahme und Veröffentlichung. Nur Aktionen mit tatsächlichem Verbrauch gelten
   als verbrauchsrelevant.
2. Vor einer kostenpflichtigen Erzeugung werden Einheit, Zähler, enthaltenes Kontingent, Grenze
   und mögliche Zusatzkosten aus der kanonischen Tarif-/Entitlement-Quelle gezeigt. Fehlt eine
   belastbare Tarifquelle, wird keine Zahl und keine Zusatzgebühr behauptet; die kostenpflichtige
   Ausführung bleibt gesperrt oder braucht eine explizit bestätigte Kostenobergrenze.
3. Vor Bestätigung werden vorgeschlagene Inhalte und geschätzter Verbrauch angezeigt. Jede neue
   kostenpflichtige Iteration wird erneut angezeigt und bestätigt; automatische Wiederholungen
   berechnen nicht weiter.
4. Fehler und Abbruch lösen keinen verdeckten zweiten Build aus.
5. Preview- und Frontend-Änderungen bewahren das bestehende Backend des Kunden. Speichern oder
   Veröffentlichen ist eine gesonderte Aktion mit eigener Kosten-/Checkout-Vorschau.

### Prüfbare Abnahme

- Die Vorschau ohne Modellaufruf verbraucht keinen Modellaufruf-Zähler.
- Ein kostenpflichtiger Build lässt sich bei erreichtem Hard Cap weder über UI noch direkte API
  starten.
- Wiederholtes Klicken, Netzwerk-Retry oder Abbruch erzeugt höchstens eine reservierte Nutzung je
  Idempotenzschlüssel.
- Ohne bestätigte Preisquelle wird weder eine konkrete Gebühr noch „kostenlos“ für Modellnutzung
  angezeigt.
- Eine neue veröffentlichte Seite kann das bestehende Backend nicht verändern; Veröffentlichung
  verlangt eigene Bestätigung.
- Verbrauch und Ergebnis lassen sich über Prüfpfad und serverseitigen Zähler zur selben
  Projekt-/Request-ID nachvollziehen.

### Nicht-Ziele

Keine automatische Veröffentlichung. Kostenpflichtige Modellnutzung bleibt deaktiviert, bis
Reservierung, Anzeige und Abnahme gemeinsam nachgewiesen sind.

---

## App-Builder

### Herkunft im Repository

- Das Governance-Gate des Bolt-Builders liegt unter
  `src/features/app-builder/bolt/governance-gate.ts`; es blockiert unter anderem nicht
  autorisierte oder produktive Aktionen.
- Plattformweite Nutzungsbausteine: `usage-increment`, `usage_totals`,
  `src/core/access/usage.ts`, `QuotaBar`.
- Kosten-/Nutzungszählung für konkrete App-Builder-Schritte, Providerfehler und Laufzeit ist noch
  nicht vollständig mit den Nutzeraktionen verbunden. Ein Governance-Gate ist kein Kostenlimit.

### Produktspezifische Regeln

1. Aktionen sind mindestens getrennt: Prompt/Plan, Codegenerierung, weitere Änderung,
   Build/Preview, Testlauf, Veröffentlichung, Hosting und externe Integrationen. Nur eine
   tatsächlich verbrauchende Aktion zählt als Nutzung.
2. Reservierung und Hard Cap sind an Tenant, Projekt, Aktion und Idempotenzschlüssel gebunden.
3. Kein stiller Wechsel auf einen teureren Anbieter oder ein anderes Modell. Fallbacks, neue
   Laufzeitdienste und Integrationen benötigen vorherige Anzeige und Zustimmung.
4. Bei Abbruch oder Providerfehler wird die Reservierung anhand tatsächlicher Provider-Nutzung
   abgeglichen. Nicht verbrauchte Einheiten werden freigegeben; unbekannte Nutzung wird sichtbar
   als ungeklärt markiert und nicht als gesicherter Betrag ausgegeben.

### Prüfbare Abnahme

- Promptvorschau ohne Modellzugriff ändert keine Nutzung.
- Jeder kostenpflichtige Modellaufruf reserviert Verbrauch vor dem Provideraufruf; eine
  fehlgeschlagene Reservierung blockiert fail-closed.
- Der Hard Cap hält bei parallelen Aufrufen und Agenten-Retries.
- Ein Request mit gleichem Idempotenzschlüssel erzeugt keine doppelte kostenpflichtige Aktion.
- Die UI zeigt Zeitraum, Ist-Verbrauch, Grenze und Status; bei fehlender Messung ist der Zustand
  ausdrücklich unbekannt.
- Preis-/Kostenwerte sind auf eine freigegebene Quelle und Provider-Modellversion zurückführbar.
- Kein Hintergrundjob und kein Auto-Retry startet nach Erreichen des Limits.
- Tests decken erlaubt, Warnschwelle, Hard Cap, Providerfehler, Doppelklick und Parallelität ab.

### Nicht-Ziele

Keine fiktiven Credits, Wechselkurse, Modellpreise, Hostingkosten oder öffentlichen
Kostenvorteile.
