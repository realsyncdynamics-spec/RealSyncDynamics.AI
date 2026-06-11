# ADR 0004 — openclaw Worker wartet auf SQLite-Journal-Check

**Status:** Open (Pre-Decision)
**Date:** 2026-05-26
**Owner:** Dominik Steiner

## Context

Auf dem VPS läuft `openclaw-app-1` (Hetzner/Hostinger). Inspektion zeigt:

```
Mounts:    /data → Volume openclaw_data
DB_PATH:   /data/store.sqlite
BACKUP_DIR:/data/backups
```

Ein zweiter Container (`worker`) soll laufzeitnah dazukommen. Es gibt
zwei Optionen für das `/data`-Volume:

1. **Geteiltes Volume `openclaw_data`** — Worker und App teilen sich die
   SQLite-Datei. Funktional zusammen, aber SQLite-Mehrprozess-Risiko,
   wenn Journal-Modus nicht WAL ist.
2. **Eigenes Worker-Volume** — Worker bekommt eigene SQLite-Datei,
   funktional getrennt von der App. Sicherer, aber State-Sync zwischen
   App und Worker müsste separat gelöst werden.

## Decision

**Keine Entscheidung treffen, bevor der Journal-Modus der bestehenden
DB geprüft ist.** Kein Worker-Start, kein `docker compose up`, kein
YAML-Apply, kein Touch an `openclaw-app-1`.

## Pre-Condition Check (Read-Only)

Vor finalem `worker:`-Block in `docker-compose.yml` nur lesend prüfen:

```bash
docker exec openclaw-app-1 python - <<'PY'
import sqlite3, os
p = os.environ.get("DB_PATH", "/data/store.sqlite")
print("DB_PATH=", p)
print("exists=", os.path.exists(p))
if os.path.exists(p):
    con = sqlite3.connect(p)
    print("journal_mode=", con.execute("PRAGMA journal_mode;").fetchone()[0])
    print("locking_mode=", con.execute("PRAGMA locking_mode;").fetchone()[0])
    con.close()
PY
```

## Entscheidungsregel nach Check

| `journal_mode` | Folge-Entscheidung |
|---|---|
| `wal` | Geteiltes `openclaw_data` kann erwogen werden — Worker + App auf derselben DB unter WAL-Concurrency. Zweiter Check erforderlich (Locking-Behaviour, Backup-Strategie). |
| `delete` / `truncate` / `persist` / Fehler | **Kein** geteilter Worker auf derselben SQLite-Datei. Worker bekommt eigenes Volume + eigene DB. State-Sync separat lösen (Outbox / Event-Bus / Polling). |

## Consequences (Pending)

- Bis Check-Ergebnis vorliegt: kein `worker:`-Block-Apply
- Bis Check-Ergebnis vorliegt: kein Volume-Provisioning
- Bis Check-Ergebnis vorliegt: kein Compose-Up
- Sobald Check-Ergebnis vorliegt: dieser ADR wird ergänzt mit Final-Decision (Accepted/Rejected) und Begründung

## References

- Chat-Beschluss „Verdict: kein Start. Kein Apply." (Kodee-Kanal)
- `docs/pilot/non-goals.md` — Scope-Disziplin: keine neuen Container ohne klaren Auslöser
