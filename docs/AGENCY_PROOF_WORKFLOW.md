# Agentur-Prüfpfad: Umsetzungspaket

Stand: 31.10.2026. Status: Spezifikation, kein Produktionsnachweis.

## Ziel und Einordnung

Eine Agentur wählt eine autorisierte Kundenorganisation und deren Domain,
prüft einen Website-Befund, weist eine Maßnahme zu und exportiert nach einem
erneuten Scan einen nachvollziehbaren Vorher-nachher-Bericht.

Der Auftrag ergänzt den Agentur-Workflow. Er ersetzt nicht den K4-Entscheid
in `PRODUCT_PRIORITIZATION.md`: KI-Mitarbeiter für KMU mit Kundenkontakt
bleiben der dort dokumentierte Kern. Eine neue öffentliche Positionierung
ist nicht Bestandteil dieses Pakets.

## Bestandsaufnahme am Commit 9ca40f3

| Baustein | Nachweis im Quellcode | Konsequenz |
| --- | --- | --- |
| Audit-Einstieg und Ergebnis | `src/App.tsx`: `/audit`, `/audit/result/:auditId` | Vorhandenen Einstieg verwenden |
| Maßnahmen | `src/App.tsx`: `/app/remediation`, `/app/remediation/:planId` | Bestehende Ansichten zuerst auf Verknüpfbarkeit prüfen |
| Evidence Vault | `src/features/evidence-vault/EvidenceVaultAdvancedView.tsx` | Timeline, Snapshots, Integritätsprüfung und Export vorhanden |
| Exportvertrag | `src/features/evidence-vault/evidenceVaultApi.ts` | Bestehendes Bundle mit Events, Kettenspitze und Verifier wiederverwenden |
| Hash-Primitiv | `src/core/runtime/evidence.ts` | Kanonisierung und SHA-256 vorhanden; keine zweite Implementierung |
| Tarifquelle | `shared/pricing.ts` | Starter 79/790 €, Growth 249/2.490 €, Agency 699/6.900 € monatlich/jährlich; nicht die Tarifhypothese 199/399 € übernehmen |

Die Existenz dieser Dateien belegt keinen erfolgreichen produktiven Gesamtfluss.
Server-Autorisierung, Datenverfügbarkeit und Plan-Gates sind separat zu prüfen.
Der aktuelle PDF-Pfad öffnet eine HTML-Druckansicht über `window.open` und
meldet bei blockiertem Popup einen Fehler. Für den Zielablauf ist ein Download
mit anschließender Druckoption vorzusehen.

## Verbindlicher Ablauf

1. Organisation aus bestehenden Mitgliedschaften wählen. Eine Domain ist kein
   Mandantennachweis; Zugriff muss für jeden Lese-, Schreib- und Exportaufruf
   serverseitig geprüft werden.
2. Domain und Prüfumfang wählen. Vor dem Scan die Berechtigung zur Prüfung
   sicherstellen. Alle Seiten- und Zeitlimits des bestehenden Tarifs anwenden.
3. Ersten erfolgreichen Prüflauf als Basis auswählen. Fehlgeschlagene,
   abgebrochene oder unvollständige Läufe sichtbar kennzeichnen.
4. Befund mit Regelkennung, Quelle, Messzeitpunkt und Beleg öffnen. Die
   Darstellung unterscheidet technische Beobachtung und rechtliche Bewertung.
5. Maßnahme mit Verantwortlichem, Fälligkeit und Befundreferenz anlegen.
   Eine Notiz oder Checkbox ist noch kein Nachweis einer Behebung.
6. Erneuten Scan durchführen. Nur vergleichbare erfolgreiche Prüfungen dürfen
   einen Befund als technisch nicht mehr festgestellt ausweisen.
7. Bericht herunterladen: Befunde, Maßnahme, beide Prüfläufe, Änderungen,
   Einschränkungen und überprüfbares Manifest. Fachliche Freigabe separat
   dokumentieren.

## Datenvertrag für den Vergleich

Vor einer Schemaänderung bestehende Audit-, Maßnahmen- und Evidence-Felder
zuordnen. Neue Tabellen nur bei belegter Lücke, als eigenes geprüftes Paket.

| Objekt | Erforderliche Referenzen und Metadaten |
| --- | --- |
| Prüflauf | Organisations-ID, Domain-ID, Lauf-ID, Start/Ende in UTC, Status, Scanner- und Regelversion, Scope und Consent-Szenario |
| Befund | Stabile Regelkennung, betroffene Ressource, Lauf-ID, Schweregrad, Beobachtung, Belegreferenz und Beleg-Hash |
| Maßnahme | Befundreferenz, Bearbeiter, Fälligkeit, Status, Ereigniszeitpunkte |
| Vergleich | Basis- und Folgelauf, Vergleichsversion, Ergebnis pro Befund, Begründung bei Nichtvergleichbarkeit |
| Export | Schemaversion, Erzeugungszeitpunkt, Organisation, Laufreferenzen, Dateiliste und Hashes, Verifikationshinweise |

Befunde anhand von Regelkennung und normalisierter Ressource zuordnen, nicht
anhand veränderlicher Beschreibungstexte. Regel-, Scope- oder Consent-Wechsel
führen ohne geprüfte Kompatibilität zu `nicht vergleichbar`.

Ein Befund kann `neu`, `weiterhin festgestellt`, `nicht mehr festgestellt`
oder `nicht vergleichbar` sein. Ein fehlgeschlagener Folgescan erzeugt niemals
automatisch eine Behebung. Manuelle Erledigung und technische Nachprüfung
bleiben unterschiedliche Ereignisse. Wiederholte Verarbeitung derselben
Lauf-/Befundkombination darf keine doppelten Maßnahmen erzeugen.

## Export und Integrität

- Menschenlesbarer Bericht und maschinenlesbares Manifest aus demselben
  Datenstand; keine rekonstruierten oder erfundenen Messwerte.
- SHA-256 prüft Integrität relativ zum erwarteten Hash. Eine Hash-Kette allein
  schützt nicht gegen vollständiges Neuschreiben durch privilegierte Akteure.
- Signaturen nur als verifiziert ausweisen, wenn Schlüsselkennung,
  Prüfalgorithmus und tatsächliche Verifikation vorhanden sind. Rotation und
  Schlüsselvertrauen dokumentieren; fehlende Signatur sichtbar ausgeben.
- Retention betrifft Belege und Metadaten, nicht nur Hashes. Löschung,
  Berechtigungen und Legal Hold nach bestehenden Regeln berücksichtigen.
- Kein Versprechen von Behördenanerkennung, Zertifizierung oder vollständiger
  Revisionssicherheit. C2PA ist keine Voraussetzung für diesen Export.
- Personenbezogene Daten minimieren. Redigierte Exporte separat manifestieren;
  nicht behaupten, ihr Datei-Hash entspreche dem unveränderten Original.

## Kleine Umsetzungspakete in Reihenfolge

| Paket | Ergebnis | Abnahme |
| --- | --- | --- |
| A: Integration prüfen | Feldzuordnung und ein realer Testdatensatz vom Audit über Maßnahme bis Export | Fehlende Verknüpfung konkret benannt; keine parallelen Ersatzmodule |
| B: Vergleich | Deterministische Vergleichslogik auf bestehenden Daten | Neu, fortbestehend, verschwunden und nicht vergleichbar getestet |
| C: Bedienablauf | Auswahl zweier Läufe, Maßnahmereferenz, Vergleichsansicht | Kein Statusverlust bei Fehlern; tastaturbedienbar und mobil nutzbar |
| D: Export | Bericht und Manifest als Download | Funktioniert mit Popup-Blocker; Belege und Einschränkungen stimmen überein |
| E: Pilotnachweis | Ein autorisierter Kunde durchläuft den vollständigen Ablauf | E2E-Nachweis und Kostenmessung statt bloßer Modul-Existenz |

Gateway, neue NIS2-/DORA-Module, neue Preise und neue Marketing-Claims sind
eigene Vorhaben. Der Gateway-Pilot benötigt insbesondere einen geprüften
Datenfluss, Provider-/Regionsbindung, Redaktion und harte Kostenlimits.

## Abnahmematrix

| Testfall | Erwartung |
| --- | --- |
| Fremde Organisations-, Lauf- oder Export-ID | Serverseitige Ablehnung, kein Inhalt anderer Kunden |
| Fehlende Berechtigung oder Planfreigabe | Kein Scan/Export; verständliche Fehlermeldung |
| Abgebrochener Folgescan | Keine automatische Behebung |
| Regelversion oder Prüfumfang geändert | Nichtvergleichbarkeit sichtbar |
| Identischer erfolgreicher Folgelauf | Unveränderte Befunde korrekt zugeordnet |
| Neue und behobene technische Befunde | Getrennte Ergebnisse mit Quellreferenzen |
| Doppelter Verarbeitungsaufruf | Keine doppelten Maßnahmen/Ereignisse |
| Manipulierte oder fehlende Exportdatei | Verifikation schlägt fehl bzw. meldet unvollständig |
| Popup-Blocker, schmaler Bildschirm, Tastatur | Download und Kernablauf bleiben bedienbar |
| Fehlende Signatur oder fehlender Beleg | Einschränkung sichtbar; kein grünes Vollständigkeitssignal |

## Prüfstatus dieses Dokuments

Quellcode und Routen wurden gelesen; Preise direkt mit `shared/pricing.ts`
abgeglichen. Kein Live-Scan, keine produktive Zahlung, keine Migration und kein
Deployment ausgeführt. In diesem Checkout fehlen `node_modules`; Build,
Typecheck und E2E sind nicht ausgeführt. Dieses Paket ändert ausschließlich
Dokumentation. Implementierung und Produktionsfreigabe sind damit nicht belegt.
