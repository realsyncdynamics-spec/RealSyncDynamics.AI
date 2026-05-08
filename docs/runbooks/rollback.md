# Rollback — Procedure for the Production Stack

Vier Ebenen, je nach „was ist kaputt":

1. **Frontend** (Vite-Bundle auf der VPS) — am häufigsten, am schnellsten
2. **Edge Functions** (Supabase) — selten, aber kritisch (Stripe-Webhook!)
3. **Datenbank-Migration** (append-only → kein DOWN-Skript)
4. **VPS-Snapshot** (Last-Resort-Restore aus dem täglichen Backup)

Jeder Pfad hat eigene SLA-Zielzeiten. Halte dich nach Möglichkeit an Pfad 1
oder 2 — Pfad 3 und 4 sind teurer und erfordern Folgekommunikation an
betroffene Kunden.

---

## Wann rollbacken vs. fix-forward

| Situation | Aktion |
|---|---|
| Hero-CSS kaputt, Text unlesbar | **fix-forward** — kosmetischer PR + redeploy |
| Audit-Engine liefert Müll-Befunde | **fix-forward** — Patch + Methodology-Versions-Bump |
| Stripe-Webhook erkennt Subscriptions nicht mehr | **rollback Pfad 2 sofort** — sonst sammeln sich Diskrepanzen |
| Migration applied wrong constraint, breaks reads | **fix-forward Pfad 3** — Append-Only-Rule, kein Revert-Migration |
| VPS antwortet nicht (gesamte Site offline) | **rollback Pfad 4** wenn Restart nicht hilft |

Faustregel: Rollback ist eine **Bremse**, kein Eingriff. Wer rollbackt,
gewinnt Zeit — nutzt sie aber für Root-Cause-Analyse, nicht zum Pause-Tippen.

---

## Pfad 1 — Frontend-Rollback (Ziel: < 5 min)

`deploy-frontend.yml` deployt `dist/` per rsync. Rollback = vorigen Commit
neu bauen + deployen.

```bash
# Den letzten bekannten guten Commit identifizieren (auf main)
git log --oneline -10

# Manuelle Workflow-Auslösung mit explizitem ref
gh workflow run deploy-frontend.yml --ref <good-sha>

# ODER per Revert-PR (safer, audit-spuren):
gh pr create --title "rollback(frontend): revert <broken-pr-title>" \
             --body "Reverts #<broken-pr-number> due to <reason>" \
             --base main \
             --head rollback-<short-sha>

# Lokal:
git revert <broken-merge-sha> -m 1
git push origin rollback-<short-sha>
```

**Verifikation:** `curl -sI https://realsyncdynamicsai.de/ | head -3` zeigt
`200 OK` mit Cache-Header der frischen Deploy-Run-ID.

---

## Pfad 2 — Edge-Function-Rollback (Ziel: < 10 min)

Edge Functions deployen aktuell manuell via `supabase functions deploy`.
Da git die Wahrheit ist, ist die Prozedur:

```bash
# Identifiziere die letzte gute Function-Version aus git history
git log --oneline -- supabase/functions/<function-name>/

# Stelle den Function-Code auf einen guten Commit zurück
git checkout <good-sha> -- supabase/functions/<function-name>/

# Deploye die zurückgesetzte Version
supabase functions deploy <function-name> --project-ref <ref>

# Commit des Rollbacks (audit-spur), NICHT die files revertieren
git checkout HEAD -- supabase/functions/<function-name>/
```

**Stripe-Webhook-Spezial:** wenn der Webhook >5 min ausfällt, queued Stripe
Events bis zu 72h. Nach Rollback überprüfen: Stripe-Dashboard → Developers
→ Webhooks → Events → "Failed" filter, manuell „Resend" für jedes Event,
das in der Ausfallzeit gequeued wurde.

---

## Pfad 3 — Migration-Rollback (Ziel: NICHT existent, immer fix-forward)

`ci.yml` enforced Append-Only-Regel — eine merged Migration darf NICHT
modifiziert werden. Konsequenz: es gibt **keinen direkten Rollback** für
DB-Schema-Änderungen.

**Fix-forward-Pattern:**

```sql
-- supabase/migrations/<NEXT_TS>_revert_<broken_thing>.sql
-- Reverses migration <BROKEN_TS>_<broken_thing>.sql which introduced
-- a faulty NOT NULL constraint that breaks legacy reads.

ALTER TABLE public.<table> ALTER COLUMN <col> DROP NOT NULL;
```

Migration-Ordnung bleibt linear, neue Zeile, kein History-Rewrite. Die
ursprüngliche kaputte Migration bleibt im git history sichtbar — ist das
Audit-feature, kein Bug.

**Wenn die Migration noch NICHT in production deployed wurde** (z. B. nur
auf einer Staging-DB lief): Append-Only-Regel hat eine Hotfix-Ausnahme.
Im PR-Titel `[hotfix]` voranstellen, dann erlaubt CI die Modifikation der
Original-Migration. Siehe `.github/workflows/ci.yml` step
„Verify migrations are append-only".

---

## Pfad 4 — VPS-Snapshot-Restore (Ziel: < 30 min, last resort)

Tägliche Backups landen auf dem VPS unter
`/var/backups/realsyncdynamicsai/rsd-YYYYMMDD-HHMM.tar.gz` (siehe
`.github/workflows/vps-backup.yml` + `scripts/vps-backup.sh`).

```bash
# SSH auf den VPS
ssh deploy@<vps-host>

# Verfügbare Snapshots auflisten
ls -lh /var/backups/realsyncdynamicsai/

# Den gewünschten Snapshot extrahieren in Staging-Pfad
sudo mkdir -p /opt/restore-staging
cd /opt/restore-staging
sudo tar -xzf /var/backups/realsyncdynamicsai/rsd-YYYYMMDD-HHMM.tar.gz

# Inspiziere — was wird zurückgesetzt?
ls -la /opt/restore-staging/var/www/realsyncdynamicsai.de/
ls -la /opt/restore-staging/etc/nginx/

# Wenn passt: aktivierung
sudo systemctl stop nginx
sudo cp -r /opt/restore-staging/var/www/realsyncdynamicsai.de/* /var/www/realsyncdynamicsai.de/
sudo cp -r /opt/restore-staging/etc/nginx/* /etc/nginx/
sudo nginx -t   # syntax check
sudo systemctl start nginx

# Cleanup staging
sudo rm -rf /opt/restore-staging
```

**Was Pfad 4 NICHT zurücksetzt:**
- Datenbank-State (Supabase ist managed, hat eigene PITR — siehe unten)
- Edge Functions (siehe Pfad 2)
- Let's-Encrypt-Zertifikate (regenerieren via `certbot renew --force-renewal`
  falls Restore alte Zertifikate enthält)

---

## Datenbank-Restore (Supabase managed)

Pfad 4 deckt VPS ab, NICHT Postgres. Supabase bietet zwei Mechanismen:

1. **PITR (Point-In-Time Recovery)** — Pro/Team-Plan, default 7 Tage
   - Dashboard → Database → Backups → Restore from point in time
   - Achtung: Restore erstellt eine NEUE Datenbank, alte URL bleibt.
     Verbindungsumstellung erfordert app-redeploy

2. **Daily-Snapshots** — Free-Plan, Dashboard → Database → Backups
   - Klick „Restore" auf einen Snapshot
   - Selbe Caveat wie PITR

**Wir haben aktuell keinen Restore-Drill durchgeführt.** Folge-Aufgabe
für M2: vierteljährlich einen PITR-Restore in eine Test-Branch laufen
lassen, Rückkehrzeit messen.

---

## Kommunikation während Rollback

Lange Pfad-3- oder Pfad-4-Aktionen → Status öffentlich machen:

1. **Während Incident** — Slack `#status` (intern), Twitter / Status-Page
   wenn vorhanden (M2-Roadmap: status.realsyncdynamicsai.de)
2. **Pilot-Kunden direkt** — Email-Vorlage in `legal-review/incident-email-template.md`
   (TODO — diese Vorlage gibt's noch nicht; bei nächstem Incident schreiben +
   in dieses Repo committen)
3. **Post-mortem** — innerhalb 72h, öffentliches Document in
   `docs/post-mortems/YYYY-MM-DD-<incident-name>.md`. Was passiert ist,
   warum, was geändert wird, damit es nicht wieder passiert.

Vertrauen kommt von Transparenz. Wer Incidents versteckt, bekommt sie
doppelt zurück, wenn ein Kunde sie selbst entdeckt.

---

## Was als nächstes (M2-Roadmap)

- **Status-Page** (status.realsyncdynamicsai.de) mit Uptime-Kuma oder
  Better-Stack
- **Incident-Email-Vorlage** in `legal-review/`
- **Restore-Drill** vierteljährlich (PITR + VPS-Snapshot)
- **Edge-Function-Versioning** statt Manual-Deploy — automatisches Rollback
  per Supabase-Function-Versions-API sobald Stripe-Webhook-Errors einen
  Schwellwert überschreiten
