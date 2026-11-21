# Kostenregeln: Governance OS

**Zweck:** Governance-Arbeit soll hinsichtlich aktueller Nutzung und etwaiger kostenpflichtiger Schritte nachvollziehbar sein. Diese Regeln begründen keine neuen Entgelte und ändern keine bestehenden kostenlosen Angebote.

## Herkunft im Repository

- Der öffentliche Website-Scan ist in `src/product/implementation-status.ts` als kostenlos beschrieben.
- Plattformweite Nutzung: `usage_events`, `usage_totals`, `usage_limits_config`, `tenant_cost_ledger`, `tenant_cost_caps`.
- Das Kosten-Ledger ist laut `20260603100000_tenant_cost_ledger.sql` interne Laufzeitbeobachtung, keine Rechnung; öffentliche Dashboards lesen es nicht.
- Governance-Agent-Aufrufe berechnen teilweise Modellkosten, doch eine durchgängige Tenant-Ansicht mit Limits und Bestätigung ist nicht belegt. Produktionsdatenbasis für Prognosen ist laut Projektstand zuletzt nicht vorhanden gewesen.

## Verbindliche Produktregeln

1. Der vorhandene kostenlose Website-Scan bleibt kostenlos. Es erscheinen dafür keine Upgrade-Pflicht, kein nutzungsabhängiger Preis und keine künstliche Verbrauchsanzeige.
2. Für tatsächlich kostenpflichtige KI-Läufe, Exporte, Integrationen oder geplante Jobs wird vor Start ausgewiesen: Aktion, betroffene Nutzungseinheit, Zeitraum, aktueller Verbrauch, Grenze und belegbare Zusatzkosten. Gebühren werden nicht aus internen Anbieterkosten abgeleitet.
3. Vor einer kostenpflichtigen Aktion ist eine ausdrückliche Bestätigung erforderlich. Wiederkehrende Jobs verlangen eine separate Aktivierung mit Frequenz, Obergrenze und Stop-Option.
4. Tenant-scoped Hard Caps und Reservierungen werden serverseitig durchgesetzt. Fehlt ein Limit oder ist die Abrechnung unklar, darf die Aktion keinen unbestätigten Providerverbrauch erzeugen.
5. Der Kunde sieht Kosten-/Verbrauchsdaten nur für den eigenen Mandanten. Interne Anbieter-Kosten und Kundengebühren sind getrennte Werte und Beschriftungen.
6. Zähler zeigen Zeitraum und Datenstand. Bei fehlenden Ledger-/Usage-Daten steht „noch keine Messdaten“; daraus darf nicht „kostenlos“, „0 verbraucht“ oder „unbegrenzt“ abgeleitet werden.
7. Freigabe, Findings, Korrekturen und Nachweise bleiben unabhängig von Kostenlimit erhalten. Eine automatische Wiederholungsprüfung benötigt eine eigene Aktivierung und ein sichtbares Intervall.

## Prüfbare Abnahme

- Der kostenlose Website-Scan erstellt keine kostenpflichtige Stripe-Position und bleibt ohne Zahlungsdaten erreichbar.
- Jeder kostenpflichtige Lauf wird vor Provideraufruf mandantenbezogen reserviert und am Hard Cap abgelehnt.
- Kostenpflichtige Wiederholung oder Automatik kann erst nach expliziter Aktivierung starten; Stop deaktiviert zukünftige Läufe.
- Dashboard weist interne Kostenschätzung nie als Rechnung oder Kundenpreis aus.
- Tenant A kann weder Nutzungszähler noch Kosten von Tenant B lesen.
- Fehlende Messdaten bleiben als unbekannt gekennzeichnet.
- Request, Kostenreservierung, Nutzung, Ergebnis und Evidence sind über eine gemeinsame Request-ID im Prüfpfad auffindbar.

## Nicht-Ziele

Keine Preisänderung, keine neue kostenpflichtige Scan-Stufe, kein öffentliches EU-Hosting-/Compliance-Versprechen und keine automatische Dauerüberwachung ohne bestätigte technische Abnahme.
