# RealSync – verbindliche Infrastruktur- und Produktregel 2027

Stand: 20. November 2026 · Vorgabe von Dominik Steiner

## Verbindlicher Grundsatz

**Jedes bestehende und zukünftige RealSync-Produkt wird unter dem Dach von RealSync Dynamics & AI in die gemeinsame Plattform integriert. Es erhält eine eigene Produkt-Landingpage auf realsyncdynamicsai.de, verwendet das gemeinsame weiße Designsystem und nutzt die zentralen Plattformdienste.**

Die Regel gilt für Konzeption, Design, Entwicklung und Abnahme. Sie beschreibt den verbindlichen Zielzustand; ihre Dokumentation ist kein Nachweis, dass alle Bestandteile bereits umgesetzt oder live sind.

## Marke und Produkteinstieg

Die Hauptseite ist der zentrale Einstieg und verlinkt alle Produkte über einen Produktkatalog. Jede Produktseite erklärt Nutzen, Funktionen, belegten Status, Tarifzuordnung und den nächsten passenden Schritt.

| Bereich | Verbindlicher Zielpfad |
|---|---|
| Dachmarke und Produktkatalog | `/` |
| Governance OS | `/governance-os` |
| Voice Agent | `/voice-agent` |
| App Builder | `/app-builder` |
| Software Factory | `/software-factory` |
| Automation OS | `/automation-os` |
| Creative Studio | `/creative-studio` |

Diese Tabelle definiert die Zielstruktur. Die technische Existenz und Erreichbarkeit jeder Route ist separat zu prüfen. Neue Produkte werden nach demselben Muster ergänzt. Abweichungen von dieser Architekturvorgabe benötigen eine ausdrückliche Entscheidung von Dominik Steiner; sie dürfen nicht eigenständig eingeführt werden.

## Gemeinsame Infrastruktur

Die verbindliche technische Basis ist React/Vite/Tailwind für das Frontend, Supabase für Datenbank und zentrale Backend-Dienste, Cloudflare Pages für das Plattform-Frontend und Stripe für die Abrechnung. Produktspezifische Dienste werden an diese gemeinsame Basis angebunden.

Alle Produkte nutzen ein gemeinsames Kundenkonto und Dashboard sowie die zentrale Unternehmensverwaltung und Abrechnung. Sie sind einzeln buchbar und miteinander kombinierbar; Produktberechtigungen werden innerhalb derselben Plattform verwaltet.

Produkte nutzen die vorhandene zentrale Anmeldung, Mandantenverwaltung, Rollen und Rechte, Abrechnung, Tarif- und Produktberechtigungen sowie Governance, Protokollierung und Nachweise. Die Berechtigung für einen Mandanten und ein Produkt wird serverseitig geprüft.

Produktbezogene Konfiguration, Daten und Laufzeiten bleiben fachlich getrennt und mandantenisoliert. Neue technische Dienste werden als begründete Erweiterung der gemeinsamen Plattform angebunden. Eine eigene Landingpage rechtfertigt kein zusätzliches Konto-, Billing- oder Backend-System. Änderungen an Hosting, DNS, Datenbank, Secrets oder produktiven Diensten benötigen einen gesonderten konkreten Auftrag.

## Einheitliches Design und SYNC

Alle Seiten verwenden ein gemeinsames weißes Designsystem mit denselben Schriften, Abständen, Navigationen, Buttons und Basiskomponenten. Produktakzente und Hero-Bühnen unterscheiden die Angebote.

SYNC bleibt die feste Markenfigur. Der Haupt-Hero soll die freigegebene Higgsfield-Animation derselben Figur zeigen. Bis der Originalexport vorliegt und geprüft ist, verwendet er das vorhandene SYNC-Modell beziehungsweise dessen Standbild. Produkt-Heroes verwenden dieselbe Figurenidentität mit passendem Produktmotiv. Reduzierte Bewegung, fehlendes WebGL und Ladefehler erhalten ein zugängliches Standbild.

## Fester Kundenweg

1. Hauptseite: Produkt entdecken und auswählen.
2. Produkt-Landingpage: Nutzen, Funktionen, tatsächlichen Status und Tarif verstehen.
3. Produkteinstieg: Anmeldung beziehungsweise vorhandenes Konto verwenden; falls erforderlich den freigegebenen Tarif buchen.
4. Einrichtung: Produkt im richtigen Mandanten konfigurieren und erforderliche Integrationen verbinden.
5. Nutzung: freigeschaltete Funktionen im gemeinsamen Dashboard bedienen.

Telefonassistenten und WhatsApp-Agenten werden über die jeweilige Produktseite angeboten und anschließend eingerichtet. Die bestehende technische Zuordnung eines WhatsApp-Angebots ist vor Umsetzung zu prüfen. Ein öffentlicher Startseiten-Assistent ist eine gesonderte Funktion und ersetzt diesen Kundenweg nicht.

## Wahrheit über Status und Preise

| Status | Bedeutung |
|---|---|
| Live | Im vorgesehenen Betrieb tatsächlich verfügbar und überprüft |
| Implementiert | Code vorhanden; vollständige Betriebsabnahme gegebenenfalls noch offen |
| Preview | Als Vorschau oder Demo nutzbar, Umfang sichtbar begrenzt |
| Geplant | Noch nicht nutzbar |

Statusangaben werden mit `src/product/implementation-status.ts` und Betriebsnachweisen abgeglichen; Preise stammen aus `shared/pricing.ts` und dem freigegebenen Billing-Katalog. Eine Landingpage, ein grüner Build oder eine Animation belegt keine funktionierende Telefonie, WhatsApp-Anbindung oder Abrechnung.

## Abnahme je Produkt

- Vom zentralen Produktkatalog aus erreichbar; Zielroute funktioniert direkt.
- Gemeinsames weißes Design, passende Produktbühne und konsistente SYNC-Figur.
- Verständlicher Einstieg mit korrekter Weiterleitung zur Einrichtung.
- Zentrale Anmeldung, Mandant, Rollen und Produktberechtigung funktionieren.
- Status und Tarif stimmen mit den maßgeblichen Quellen überein.
- Desktop, Mobilgeräte und relevante Medien-Fallbacks sind geprüft.
- Externe Integrationen und kostenpflichtige Aktionen besitzen einen eigenen Funktionsnachweis.

## Verankerung und Umsetzung

Die globale `AGENTS.md` verlinkt diese Regel als verbindliche Vorgabe. Das Website-Profil in
`docs/claude/CONTEXT_POLICY.md` und die Produktabnahme in `.github/pull_request_template.md`
verwenden dieselbe Grundlage. Frühere dunkle Designvorgaben sind durch das gemeinsame weiße
Designsystem ersetzt.

Die Repository-Verankerung beschreibt den Entwicklungs- und Abnahmevertrag. Sie belegt weder
die vollständige technische Umsetzung noch einen Live-Betrieb der Produkte. Offene Funktions-,
Browser- und Integrationsprüfungen sind je Produkt am geprüften Commit nachzuweisen. Eine
automatische Prüfung aller Anforderungen ist mit dieser Dokumentationsänderung nicht eingerichtet.

Historische PR-Stände aus der ursprünglichen Vorgabedatei vom 20. November 2026 werden hier
nicht als aktueller Betriebsnachweis übernommen. Aktuelle Nachweise gehören in den jeweiligen PR.
