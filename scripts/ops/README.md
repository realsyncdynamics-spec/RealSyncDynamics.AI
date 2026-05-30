# scripts/ops — CLI-first VPS Operations

Reproduzierbare Befehle für die RealSyncDynamics-Production-Infrastruktur
auf dem Hostinger-VPS `srv1622293` (187.77.89.1).

Prinzip:
- jeder manuelle Klickpfad wird durch ein Skript ersetzt
- alle Skripte sind idempotent
- destruktive Operationen fragen explizit nach
- Read-Only zuerst, Mutation nur mit `--apply`

## Verfügbare Skripte

### VPS / Docker

| Skript | Modus | Zweck |
|---|---|---|
| `doctor.sh` | Read-Only | Vollständige VPS-Diagnose (Container, Ports, Traefik-Routing, Ollama-Triage, Reachability) |
| `status.sh` | Read-Only | Kurzer Status: was läuft, was hört, was antwortet |
| `logs.sh` | Read-Only | Container-Logs tailen mit konsistenten Defaults |

### Supabase

| Skript | Modus | Zweck |
|---|---|---|
| `supabase-status.sh` | Read-Only | Link-Status, Migration-Drift-Übersicht, Function-Liste |
| `supabase-functions-deploy.sh` | Write (mit Confirm) | Edge-Function-Deploy mit korrektem `verify_jwt`-Flag aus `config.toml` |
| `supabase-migration-drift.sh` | Read-Only + lokales File | Klassifiziert local-only vs. remote-only Migrations, schreibt Repair-Vorschläge nach `.migration-drift-suggested.sh` (gitignored, manuell review) |
| `supabase-secrets.sh` | Mixed | `list`/`set`/`unset`/`push`/`diff` von Edge-Function-Secrets — Ersatz für Dashboard |

ENV für Supabase-Skripte:
- `SUPABASE_ACCESS_TOKEN` — PAT (account → Access Tokens)
- `SUPABASE_PROJECT_ID` — Project-Ref (xxxx in xxxx.supabase.co)

## Ausführungsort

Alle Skripte sind so gebaut, dass sie **auf dem VPS** laufen. Sie
funktionieren auch lokal soweit `docker` verfügbar ist — Skripte die
auf Container zugreifen, die nur auf dem VPS existieren, geben
verständliche Fehlermeldungen.

## Einstieg

```bash
# Einmalig nach git pull auf dem VPS:
chmod +x scripts/ops/*.sh

# Dann:
scripts/ops/doctor.sh            # vollständige Diagnose
scripts/ops/status.sh            # kurzer Überblick
scripts/ops/logs.sh kodee-ollama # Container-Logs
```

## Konventionen

- Exit-Code `0` = OK
- Exit-Code `1` = harter Fehler (Operator soll eingreifen)
- Exit-Code `2` = falsche Argumente
- Exit-Code `3` = Pre-Flight-Check failed (z.B. Container existiert nicht)
- Output ist strukturiert mit `──── Section ────` Trennern, damit
  copy-paste in Chat oder Tickets sauber funktioniert.
