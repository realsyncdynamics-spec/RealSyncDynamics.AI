# Profil: Voice Runtime

Ebene 3. Gilt zusätzlich zu `AGENTS.md`, lockert nichts davon.
Jede Änderung an Policy, Tool-Rechten, Session-Zustand, Kill-Switch oder Einwilligung
ist Security-Arbeit → zusätzlich `security.md`.

## Pfade

Schreiben: `apps/agent-runtime/**` (Quelle `src/`, Tests `test/`, `README.md`).
Pflichtlektüre: `apps/agent-runtime/README.md`, bei Voice-Builder-Arbeit
`docs/architecture/vertical-voice-agent-builder.md` (falls vorhanden).

## Prüfungen

```bash
cd apps/agent-runtime && npm run typecheck && npm test
```

CI: `Backend Services CI` → Job `apps/agent-runtime`. Läuft das lokal nicht vollständig
(fehlende Pakete, Stubs, andere Versionen), Ergebnis als `TEILWEISE` melden.

## Sicherheitsanforderungen

- Mandant, Agent, Tool-Grant, Zähler, Rate-Limit, Kill-Switch und Einwilligung kommen aus
  dem serverseitigen Session-Zustand, nie aus dem Request-Body (SEC-01, SEC-05).
- Kill-Switch vor jeder Entscheidung und vor dem Executor frisch lesen; Lesefehler = gestoppt.
- Unverifizierte Einwilligung = abgelehnt.
- Schreibende Tools bleiben gesperrt, bis die Prüfung atomar mit dem Schreibzugriff erfolgt.
  Keine Env- oder Konfigurationsschalter, die das umgehen.
- Jede Entscheidung erzeugt Evidence an derselben Request-ID.

## Eskalation

Push auf `main` unter `apps/agent-runtime/**` deployt heute automatisch auf den VPS
(`.github/workflows/deploy-agent-runtime-vps.yml`). Merge = Deploy → Deploy-Freigabe nötig.
Persistenz-Änderungen (neue Spalten, RPCs) → `database.md`, Migration nur einzeln freigegeben.
