# SF-002 – verifizierender Sandbox-Worker

Stand 20.11.2026. **Branch-Prototyp, nicht deployed, keine PR-/Merge-/Produktionsfreigabe.** Baut auf SF-001 auf und ergänzt ein lokales, begrenztes Ausführungssystem. Kein zweites AI-OS.

## Dateien und Funktion

- `apps/factory-worker/spec.mjs`: strikt validiertes Job-Manifest und statische Befehls-Positivliste.
- `apps/factory-worker/worker.mjs`: Detached-HEAD-Abgleich, Shell-freie Node-Ausführung, Zeit- und Output-Limits, JSON-Ergebnis mit Hashes statt Klartext-Logs.
- `apps/factory-worker/Dockerfile`: Non-Root-Image; Container-Härtungsparameter werden beim Start durch den Operator vorgegeben.
- `apps/factory-worker/test/worker.test.mjs`: Testfälle für Eingabevalidierung, verbotene Befehle, SHA-Bindung und Limits.
- `apps/factory-worker/README.md`: manuelle GitHub-Checkout-/Docker-Smoke-Anleitung, ohne Token und ohne produktive Verbindung.

## Nicht umgesetzt

Keine Bearbeitung fremder oder eigener Quellen durch KI, kein Editor-/Coding-Agent, kein REA-Adapter, kein automatischer Checkout-Dienst, keine Queue, keine Kunden-Funktionen, kein produktives Dashboard, keine Datenbank- und Evidence-Speicherung. Der spätere Schreibworker benötigt eine eigene ausführlich geprüfte Isolations- und Berechtigungsarchitektur.

## Prüf- und Freigabegates

1. Unit: `node --test apps/factory-worker/test/worker.test.mjs`.
2. Syntax: `node --check apps/factory-worker/spec.mjs`, `node --check apps/factory-worker/worker.mjs`.
3. Docker-Smoke in eigener Sandbox mit einer freigegebenen Commit-SHA (noch offen).
4. Negative Docker-Tests: falscher SHA, unbekannter Befehl, unzulässige Felder, Timeout, fehlende Abhängigkeiten (noch offen).
5. Gesamtprojekt-Typecheck, Vitest, GitHub-Checks auf Branch-/PR-Head (noch offen).
6. Unabhängige Sicherheitsabnahme, bevor Code fremder Dritter in einer Worker-Umgebung ausgeführt wird.

## Sicherheit und Betriebsentscheidungen

- Docker hat Zugriff nur auf eine explizite Input-Datei und einen Read-only-Checkout; Netzwerk = none, User = 10001, Capabilities = none, Limits für Ressourcen; kein Host-Docker-Socket.
- Commit-SHA-Prüfung der `.git/HEAD`-Datei ist **kein** kryptografischer Beweis für die Checkout-Herkunft; Host-Vertrauen und attestierte Quellen sind separat notwendig.
- Ausgabe-SHA-256-Hashes und In-Memory-Protokolle sind **keine** revisionssicheren Governance-Evidenzen.
- Keine Agenten-Installation, kein `npm install`, kein Deployment, kein GitHub-Schreibtoken.
- Anbindung an das bestehende AI-OS erst nach überprüfter Authentifizierung, Autorisierung, Auditpersistenz, Kill-Switch und Kostenreservierung.
- Die Feature-PR-Sperre aus `.github/PR_TRIAGE_POLICY.md` bleibt zu beachten; SF-002 wird zunächst auf der vorhandenen isolierten Branch entwickelt.

**Nächste sichere Einheit:** SF-002 als Docker-Smoke auf separater Testumgebung nachweisen; erst danach SF-003 (REA-Adapter mit Read-only-MCP-Rechten) spezifizieren.
