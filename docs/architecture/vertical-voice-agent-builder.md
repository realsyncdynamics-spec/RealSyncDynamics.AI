# Vertical Voice Agent Builder — inkrementeller Implementierungsplan

Status: **Foundation branch; nicht produktiv aktiviert** (24.10.2026).

## Architekturentscheidung

Vertikale Sprachagenten sind **Vorlagen innerhalb** des RealSync Governance OS,
kein autonomes Nebenprodukt. Runtime-Entscheidungen laufen über die bestehende
Voice Policy und bestehende Tool-Runner-Grenze. Die bestehende Architektur in
`docs/architecture/voice-agent-v0.1.md` bleibt normativ, bis eine eigene
Änderung geprüft und freigegeben wird.

## Zielablauf

1. Admin wählt Branche und konfiguriert Agentennamen, Business-KB und Begrüßung.
2. Admin prüft erlaubte Tools, Human-Handoff und Einwilligungs-/Transparenztexte.
3. Agent wird im Sandbox-Webkanal getestet. Testdaten sind keine Produktionsdaten.
4. Freigabe durch berechtigte Person, Policy-Validierung und Evidence-Protokoll.
5. Erst danach Kanal Web aktivieren; Telefonkanal **separat** nach SIP-, DPA-,
   Provider-, Routing-, Missbrauchs- und Notfallprüfung.
6. Betrieb: Gesprächsmetriken, blockierte Aktionen, Freigaben, Retention,
   Löschung und Not-Aus im Tenant-Dashboard.

## Abgrenzung Foundation

**Im Branch umgesetzt:** typsichere Branchenvorlagen für Handwerk, Metzgerei,
Kanzlei; restriktive Tool-Schnittmenge; Draft/Pause-Sperre; Validierung von
Phone, Recording, Retention und menschlicher Übergabe; Unit-Tests.

**Nicht umgesetzt:** GUI, WebRTC/Streaming-ASR/TTS, SIP, Telefonprovider,
DB-Migration/RLS, persistente Konfiguration, Nummernverwaltung, Billing,
Tool-Runner, End-to-End-Tests oder Produktionsdeploy. Diese Punkte dürfen
nicht aus dem Vorhandensein der Vorlagen als funktionierend dargestellt werden.

## Folge-PRs — klein und getrennt

A. UI: geschützter `/app/voice/builder`-Wizard, Preview, Branchen-Auswahl;
   Route gesondert wegen Hotspot `src/App.tsx`.
B. Backend: tenant-isolierte Agent-Konfiguration, RLS und additive Migration
   in **einem separat freigegebenen** Migration-PR; keine Secret-Ausgabe.
C. Web-Vorschau: Browser-Mikrofon, Speech-to-Text und Text-to-Speech mit
   Abschaltung, Anzeigen von KI-Identität und ausdrücklicher Einwilligung,
   wo erforderlich; keine unerlaubte Datenübertragung.
D. Actions: ausschließlich vorhandene `evaluateVoiceToolRequest`/
   Evidence-Gates nutzen; Termin-Aktion verlangt menschliche Freigabe,
   keine direkte CRM-/Kalender-Schreiboperation aus Modelltext.
E. Telefonie: EU-Datenflussprüfung, SIP-Anbieter-Vertrag, Webhook-Signatur,
   Nummernzuordnung, parallele Calls, Aufzeichnungsoption aus,
   Notfall-/Fehlerrouting und Kostengrenzen.
F. Dashboard: Sessions, nur notwendige Metadaten, Alerts, Widerruf,
   Löschworkflow, Evidence-Link und Kill Switch.
G. Pilot: synthetische Tests; Missbrauchstests, Datenschutz-/Security-Review,
   Kostenlasttest, Rollback, danach kontrollierte Aktivierung.

## Unverhandelbare Gates

- Fail-closed bei ungeklärtem Tenant, Auth, Tool-Recht, Consent oder Kill Switch.
- Sprachmodell gibt niemals endgültige Policy-Entscheidungen.
- Kein Audio-Mitschnitt per Default; keine stille Transkriptablage.
- Transparenz der KI-Interaktion; erforderliche Rechtsgrundlage,
  Informationspflichten und AV-Verträge vor Kundendaten.
- Rechtsanwalts-Template gibt **keine Rechtsberatung**, bestätigt **kein**
  Mandat und entscheidet **keine Fristen**.
- Kein Merge, keine Migration und kein Produktionsdeploy ohne separate Freigabe.
