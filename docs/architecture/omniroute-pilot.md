# OmniRoute-Pilot für RealSyncDynamics.AI

Stand 14.11.2026 · Entscheidungsvorlage · Basis `main@db04d54f`

## Entscheidung

Das bestehende Routing bleibt die Referenz. OmniRoute ist ein Kandidat für genau einen isolierten Cloud-Test. Eine Aufnahme in die Plattform kommt infrage, wenn der Test einen Vorteil bei Kosten oder Ausfallsicherheit zeigt und die Schutzmaßnahmen nachweislich greifen.

**Pilotaufgabe:** Synthetische, fiktive Serviceanfragen für einen Handwerksbetrieb in `Rueckruf`, `Terminwunsch`, `Servicefrage` oder `Unklar` einordnen. Der Aufruf liefert nur die Kategorie. Das Testprogramm bewertet die Ausgabe gegen eine vorab festgelegte Referenz und verwirft ungültige Ausgaben. Die Aufgabe ist am AI Receptionist orientiert. Der Test läuft ohne Telefonie, WhatsApp, Live-Posteingang, Kundendaten, Tools oder Schreibaktionen. Die Klassifizierung ist ein vorgeschlagener Testfall.

## Referenz im Repository

| Bereich | Geprüfter Stand |
| --- | --- |
| Eingang | Der [`governance-router`](../../supabase/functions/governance-router/index.ts) hat einen OpenAI-kompatiblen Eingang. Die serverseitige Schlüsselprüfung liefert den Mandanten. |
| Residenz | Der [`residencyGuard`](../../supabase/functions/_shared/residencyGuard.ts) sperrt unverifizierte Residenz. Der [Katalog](../../supabase/functions/_shared/aiGateway/governanceRouterCatalog.ts) schließt Cloud für `eu_local` auf jeder Stufe aus. Der [lokale Adapter](../../supabase/functions/_shared/aiGateway/serverFromEnv.ts) unterstützt LM Studio oder Ollama. Ältere Router-Betriebsdokumentation zur Residenzentscheidung weicht vom geprüften Code ab. |
| Cloud-Referenz | Das explizite Profil `cloud-fallback` ist für dafür berechtigte Cloud-Mandanten vorgesehen. Die vorhandene [Provider-Kette](../../supabase/functions/_shared/aiGateway/router.ts) nutzt dafür Anthropic als Primäranbieter und kann bei geeigneten Fehlern auf OpenAI wechseln, wenn beide Adapter konfiguriert sind. |
| Prüfpfad | `governance-router` schreibt Ergebnisdaten nach `ai_tool_runs`. Das deckt weder jeden einzelnen Upstream-Versuch ab noch garantiert es persistierte Evidenz bei einem Schreibfehler. Vollständigkeit und die Zuordnung der tatsächlich angefallenen Kosten sind im Pilot gesondert nachzuweisen. |

## Datenfluss und Grenzen

1. Ein internes Testprogramm sendet einen synthetischen Testfall mit serverseitiger Zuordnung zu einem dedizierten Testmandanten an eine isolierte RealSync-Testumgebung. Der Governance-Router authentifiziert den Aufruf, prüft Mandant, Tarifberechtigung, Kontingent, verbindliche Policy und bestätigte Cloud-Residenz. Der Pilot hat standardmäßig keine Freigabe. Der Request-Body bestimmt weder den Mandanten noch Anbieter, Zugangsdaten oder Pilotfreigabe.
2. RealSync wählt serverseitig den direkten Referenzpfad oder für diesen Testfall den OmniRoute-Adapter. Bei `eu_local` gibt es für diesen Cloud-Test keinen Aufruf an OmniRoute. Ungeklärte Autorisierung oder Residenz, eine fehlende oder nicht durchsetzbare Policy-Entscheidung und ein ungeklärtes Budget stoppen den Aufruf vor dem Versand. Die dokumentierte [Sicherheitsabnahme](../security/ai-residency-fail-closed-release-gates-2026-10-21.md) ist Grundlage für die Abnahmetests.
3. Der Adapter verbindet sich privat und authentifiziert mit einer separaten OmniRoute-Instanz auf EU-Infrastruktur. Der Gateway darf nur zu den vorab freigegebenen API-Endpunkten der beiden Vergleichsanbieter weiterleiten. Modelle und Fallback-Paar werden versionsgebunden festgelegt. Die tatsächlichen Inferenz- und Speicherorte der Anbieter sind getrennt vom Standort des Gateways zu prüfen. Anbieter- und Dienstschlüssel bleiben serverseitig, getrennt von Produktionszugängen und mit begrenztem Budget.
4. RealSync führt den Prüfpfad anhand einer serverseitig vergebenen Request-ID. Pro Routing-Entscheidung und Provider-Versuch werden Ergebnis, tatsächlicher Anbieter, Modell, Dauer und verfügbare Nutzungsmetadaten erfasst. Prompts, Antworten und Zugangsdaten gehören nicht in Logs. Ob die gewählte OmniRoute-Version einzelne Versuche und die tatsächliche Nutzung ohne Inhaltsprotokollierung ausgeben kann, wird vor dem Pilot nachgewiesen. Request-Artefakte, Caches, externe Telemetrie und Log-Exporte sind für den Pilot abzuschalten und zu prüfen. `noLog` ist ein möglicher Teil der Konfiguration. Fehlende oder unzuordenbare Evidenz stoppt die Freigabe weiterer Pilotaufrufe, bis der Prüfpfad wieder funktioniert.

## Vergleich und Abnahme

Beide Pfade erhalten beispielsweise 100 identische synthetische Fälle mit gleichen Modellversionen, Promptvorgaben und Antwortgrenzen. Die Referenzlabels werden vorab festgelegt. Normalbetrieb und simulierte Ausfälle laufen getrennt. Beide Pfade erhalten dieselben simulierten Fehler; die Tests benötigen keine absichtliche Störung fremder Anbieter. Tatsächliche Cloud-Kosten werden über Nutzungsmetadaten und Anbietertarife abgeglichen. Die Kostenrechnung umfasst auch Fehlversuche und anteilige Gateway-Betriebskosten.

| Prüfung | Erwartetes Ergebnis |
| --- | --- |
| Schutzmaßnahmen | Kein OmniRoute-Aufruf bei `eu_local`, unbekannter Residenz, unberechtigtem Schlüssel, Fremdmandant, fehlender Policy-Entscheidung oder ausgeschöpftem Budget. Kein Aufruf an nicht freigegebene Ziele. Keine Prompt- oder Antwortinhalte in Logs, Exporten oder Caches. |
| Anbieterfehler | Bei einem freigegebenen vorübergehenden Fehler ist genau ein Versuch beim zweiten zugelassenen Anbieter möglich, sofern Zeit und Budget reichen. Kein wiederholtes Senden durch eine zweite Retry-Schicht. Ein Policy- oder Authentifizierungsfehler endet ohne Fallback. Bei unbekanntem Abrechnungsstatus wird nicht blind wiederholt. |
| Prüfpfad | Jeder gestartete Vorgang und jeder bekannte Provider-Versuch lassen sich der Request-ID zuordnen. Die Abnahme umfasst Ausfall von Gateway, Anbieter und Prüfpfad. Bei ausgeschaltetem Pilot bleibt der direkte Referenzpfad verfügbar. |
| Messbarer Nutzen | Vorgeschlagene Schwellen für den Testbeschluss: mindestens 10 % geringere Gesamtkosten je gültiger Klassifizierung **oder** mindestens 10 Prozentpunkte mehr gültige Klassifizierungen bei simulierten Ausfällen. Zusätzlich keine schlechtere Klassifikationsgüte und höchstens 15 % höhere p95-Latenz im Normalbetrieb. Stichprobengröße, Streuung und eventuelle Mehrkosten gehören zur Entscheidung. Bei unklarem Ergebnis bleibt die Empfehlung beim direkten Pfad. |

## Umsetzung und Freigabe

Der Dokumentationsentwurf definiert den Test. Für eine spätere isolierte Implementierung sind der konkrete Anbieter- und Modellumfang, die Datenflüsse, das Budget und der technische Abschaltweg vorab zu bestätigen. Änderungen an Security-Logik, Deployment oder Infrastruktur durchlaufen die [Repository-Freigaben](../../.github/PR_TRIAGE_POLICY.md). Ein positiver synthetischer Test liefert eine Entscheidungsgrundlage für einen nächsten Schritt mit eigener Freigabe. Er ist keine Einführung in die Kundenruntime.

## Quellen zu OmniRoute

- [Projekt und Lizenz](https://github.com/cheaper-inference/OmniRoute/blob/main/LICENSE)
- [OpenAI-kompatibler Einstieg und Fallback-Konfiguration](https://github.com/cheaper-inference/OmniRoute/blob/release/v3.8.53/docs/guides/SETUP_GUIDE.md)
- [Request-Logging, Aufbewahrung und `noLog`](https://github.com/cheaper-inference/OmniRoute/blob/release/v3.8.53/docs/security/COMPLIANCE.md)

Prüfstatus dieser Vorlage: Repository-Code und öffentliche OmniRoute-Dokumentation gelesen. Installation, Datenfluss, Laufzeitverhalten und Messwerte stehen aus.
