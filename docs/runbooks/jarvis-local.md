# RealSync JARVIS Local — erster vertikaler Abschnitt (Pilot)

**Status:** Quellcode-Pilot. Kein produktiver Rollout, keine UI- oder Voice-Freischaltung.
Baut auf dem vorhandenen Agent OS und dem vorhandenen Ollama-Adapter auf,
ohne Governance OS, Voice Agent, Cloudflare, Supabase oder Landingpages umzubauen.

## Voraussetzungen (auf dem eigenen Computer)

- Node.js und die Abhängigkeiten des bestehenden RealSync-Repositories
- Lokal installiertes Ollama, erreichbar unter 127.0.0.1:11434
- Einmalig heruntergeladenes Chatmodell, beispielsweise qwen2.5:7b

Einmalig im Terminal (bei laufendem Ollama):

    ollama pull qwen2.5:7b

Danach kann die eigentliche Frage ohne Internet beantwortet werden, sofern
Modell und Laufzeit lokal vorhanden sind.

## Start (im Repository-Verzeichnis)

    npm ci
    npx tsx apps/jarvis-local/cli.ts --model qwen2.5:7b "Wo läuft Jarvis?"

Eine eigene lokale Textnotiz explizit freigeben:

    npx tsx apps/jarvis-local/cli.ts --note ./notizen/ziele.md "Welche Ziele stehen in meiner Notiz?"

Mehrere Dateien werden mit wiederholtem --note übergeben. Es werden maximal
10 reguläre Dateien zu je 16 KB eingelesen. Kein automatischer Dateiscan,
keine Netzlaufwerksindizierung, keine Browser-Anbindung, keine Dateiänderungen.

## Bereits implementiert

1. Aufruf über den bestehenden Agent-OS-Orchestrator; er protokolliert den
   Task-Status und die Antwort in seinem **flüchtigen** In-Memory-Store.
2. Verwendung des vorhandenen OllamaAdapter für /api/tags und /api/chat.
3. Endpunkt **fest auf 127.0.0.1:11434** gesetzt. Kein konfigurierbarer
   Remote-Host und kein cloudfähiger AiGateway-Fallback in diesem Pfad.
4. Strenge Kontexttrennung über tenant_id; nur aktive Memory-Einträge des
   jeweiligen Tasks gelangen an das lokale Modell.
5. Notizdaten gelten als nicht vertrauenswürdiger Kontext und erhalten
   keine Werkzeugberechtigung. Der Agent kann nur antworten, nichts ausführen.
6. Fehler beim lokalen Modell führen zu einem fehlgeschlagenen Task,
   nicht zu einer Cloud-Wiederholung.

## Was **noch nicht** implementiert oder nachgewiesen ist

- Kein dauerhaftes Jarvis-Gedächtnis: Notizen bleiben als Dateien erhalten,
  werden jedoch nur auf explizite Angabe bei jeder CLI-Ausführung neu geladen.
- Noch keine semantischen Embeddings, kein lokaler Vektorindex, keine 3D-Galaxy.
- Noch keine Mikrofonaufnahme, STT, Kokoro/Piper oder Sprach-Streaming.
- Keine Verbindung zur App-Shell, zum kommerziellen Voice Agent, zur
  Governance-Policy-Runtime oder zu Tools mit Schreibberechtigungen.
- In-Memory-Events sind **kein** revisionssicherer Evidence Vault.
  Der bestehende Persistenzpfad wurde nicht umgestellt.
- Ohne echten Lauf auf einem Computer mit Ollama ist die Funktion nur
  quellen- und testseitig überprüft. Ein Offline-/Airgap-Livetest steht aus.

## Prüfen

    npx vitest run test/core/agent-os/local-jarvis.test.ts
    npm run lint

Die Tests verwenden einen simulierten lokalen HTTP-Transport. Sie beweisen
keine tatsächliche Modellinstallation oder Sprachqualität.

## Sicherheits- und Integrationsregeln

- Nur lesender Pilot; keine automatisierten Dateischreibzugriffe.
- Keine Auto-Freigabe von Entscheidungen und keine Tool-Ausführung.
- Cloud-Synchronisation darf erst als gesonderte, explizit autorisierte
  Funktion mit Policy-/Tenant-Prüfung hinzukommen.
- Kein öffentliches Produktversprechen über einen produktiven Agent OS
  bis Runtime, Berechtigungen, Audit und Persistenz abgenommen sind.
- Vor kommerzieller Nutzung Lizenzen der ausgewählten Modelle und Voices
  prüfen sowie Hardware- und Betriebskosten transparent benennen.

Nächster isolierter Schritt: lokales, dauerhaftes Notiz-/Memory-Backend mit
Quellenverweisen und atomarer Speicherung. Erst danach Voice und Galaxy.
