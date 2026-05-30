# Runbook — Datenbank-Backup & Restore (OF-2)

> **Status:** v1, 2026-05-30. Schließt Open Finding **OF-2** („DB-Backup/PITR-Strategie nicht im Repo nachweisbar").
> **Scope:** Supabase-Postgres der Produktion. Der bestehende `vps-backup.yml` sichert **nur** das VPS-Verzeichnis (statisches Frontend/Configs) — **nicht** die Datenbank. Dieses Runbook dokumentiert die DB-Sicherung.

## Verifizierte Fakten (live, Supabase MCP, 2026-05-30)
| Eigenschaft | Wert |
|---|---|
| Projekt | `RealSyncDynamicsLive` (`ebljyceifhnlzhjfyxup`) |
| Region | **eu-central-1** (EU / Frankfurt — DSGVO-konform) |
| Postgres | 17.6 (GA) |
| Status | ACTIVE_HEALTHY |
| Host | `db.ebljyceifhnlzhjfyxup.supabase.co` |

## Backup-Quelle
Supabase verwaltet Backups plattformseitig. **Welcher Backup-Typ aktiv ist, hängt vom Projekt-Plan und muss im Dashboard bestätigt werden** (nicht via API auslesbar):
- **Daily Backups** (Free/Pro): tägliche automatische Snapshots, Aufbewahrung je nach Plan (Pro: 7 Tage).
- **PITR (Point-in-Time Recovery)** (Pro-Add-on): kontinuierliche WAL-Archivierung, sekundengenaue Wiederherstellung.

> **⚠️ Operator-Aufgabe (nicht aus Repo/Sandbox prüfbar):** Im Supabase-Dashboard unter **Database → Backups** verifizieren, welcher Typ aktiv ist und die Retention dokumentieren. Empfehlung für Enterprise/Gov: **PITR aktivieren** (Pro-Add-on) → RPO von ~Tagen auf ~Minuten.

## Ergänzende Eigen-Sicherung (empfohlen, optional)
Unabhängig vom Plattform-Backup ein periodischer logischer Dump als Zweitkopie:
```
# Manuell / CI (mit DB-Passwort aus Secrets), NICHT in dieses Repo committen:
supabase db dump --project-ref ebljyceifhnlzhjfyxup -f backup_$(date +%F).sql
# Verschlüsselt in EU-Objektspeicher ablegen (z.B. Hetzner/Scaleway EU).
```
*(Nur Konzept — kein Cron/Secret in diesem PR.)*

## Restore-Schritte
### A) Plattform-Restore (Daily/PITR) — Standardweg
1. Supabase-Dashboard → **Database → Backups**.
2. **Daily:** gewünschten Snapshot wählen → „Restore". **PITR:** Zeitpunkt (UTC) wählen → „Restore".
3. Bestätigen (Achtung: überschreibt aktuellen Stand — vorher kommunizieren).
4. Restore-Dauer abwarten (Projekt kurz nicht verfügbar).
5. Nach Restore: **Smoke-Test** (siehe unten).

### B) Restore aus logischem Dump (Fallback)
1. Neues/leeres Supabase-Projekt **in eu-central-1** anlegen (Region halten!).
2. `psql "$RESTORE_DB_URL" -f backup_<datum>.sql`.
3. Edge Functions neu deployen (`supabase functions deploy`), Secrets setzen.
4. `VITE_SUPABASE_URL`/`ANON_KEY` auf neues Projekt umstellen, Frontend neu deployen.
5. Smoke-Test.

### Smoke-Test nach Restore (Pflicht)
```sql
select count(*) from public.tenants;
select count(*) from public.memberships;
select count(*) from public.audit_logs;
select count(*) from supabase_migrations.schema_migrations;  -- Ledger-Stand
```
+ Live: Login, `/app` lädt, ein Tenant sichtbar, ein Governance-Read funktioniert.

## Verantwortlichkeit
| Rolle | Zuständigkeit |
|---|---|
| **Plattform-Owner / super_admin** | Backup-Typ/PITR im Dashboard sicherstellen; Restore-Entscheidung & -Durchführung |
| **On-Call (künftig, P-Operations)** | Restore im Incident-Fall, Smoke-Test, Kommunikation |

## RTO / RPO (Zielwerte)
| Szenario | RPO (max. Datenverlust) | RTO (max. Ausfall) |
|---|---|---|
| Nur Daily Backups | bis 24 h | ~1–2 h (Dashboard-Restore) |
| **PITR aktiv (empfohlen)** | **~Minuten** | ~1–2 h |
| Logischer Dump (Fallback) | bis letztes Dump-Intervall | mehrere Stunden (Neuaufbau) |

> **Empfehlung Enterprise/Gov:** PITR aktivieren → RPO Minuten. Vierteljährlicher **Restore-Drill** (in Staging) zur Verifikation von RTO/RPO + dieses Runbooks.

## Fazit OF-2
**Geschlossen (dokumentiert + Prozess definiert).** Backup-Quelle, Restore-Wege (Plattform + Dump-Fallback), Smoke-Test, Verantwortlichkeit und RTO/RPO sind festgehalten. **Eine offene Operator-Aktion bleibt:** Backup-Typ/PITR im Dashboard verifizieren und Retention eintragen — das ist dashboard-only und kann nicht aus Repo/Sandbox erfolgen.
