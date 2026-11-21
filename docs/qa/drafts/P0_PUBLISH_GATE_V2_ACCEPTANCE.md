# RealSync P0 — Publishing-Gate / transaktionale Outbox — Abnahmeplan

**Stand 20.11.2026, isolierter Entwurf. Kein GO für Main, Migration, Deployment oder Live-Send.**

## Bestandsprüfung (lesend, verbundene Systeme)

- GitHub-Hauptrepository `realsyncdynamics-spec/RealSyncDynamics.AI`, zuletzt geprüfter Main-HEAD `7185bd48b41a0762fdbeba1c8aa95f3e615d34e5`.
- Produktive Supabase-DB `RealSyncDynamicsLive` ist erreichbar. Das Schema enthält `distribution_queue_entries`, `distribution_audit_log`, `memberships` und `distribution_queue_claim_next`.
- Die Distribution Queue enthält beim Abgleich 0 Zeilen. Dies erlaubt keine Aussage über vergangene Zustellungen.
- Aktuelle Claim-RPC: `pending/auto`, `approved` und wiederholbare `failed`-Einträge werden ohne separate Freigabequittung claimbar; direkte RPC-Berechtigung besteht für `service_role`, nicht für `anon`/`authenticated`.
- Browserbasierte authenticated-INSERT-Policy prüft Tenant-Mitgliedschaft, aber **nicht** auf `pending`/`approval_status=pending`. Status-Constraints erlauben auch `approved`.
- Der bestehende Worker nutzt die V1-Claim-/Ack-/Fail-RPCs und schickt externe Requests. Einige Adapter erzeugen synthetische externe IDs statt echter Provider-Nachweise.
- Es gibt aktuell **keine** ausgeführte, durchgängige Staging-PostgreSQL-Abnahme für diesen Patch.

## P0 Designentscheidungen

1. `distribution_queue_entries` **bleibt** einzige persistente Outbox; keine zweite parallele Versandqueue.
2. Das **human gate** wird per DB-RPC durch einen authentifizierten Tenant-Owner entschieden. Die Funktion liest `auth.uid()` statt freie Reviewer-Strings zu vertrauen. Die Prüfung einer belastbaren Echtheits-/Sitzungsbestätigung liegt außerhalb dieses Patches.
3. Ein einmaliger Approval-Receipt ist append-only, mandanten-, kanal- und SHA-256-Inhalts-gebunden.
4. Queue-Zustandswechsel + Approval-Receipt + Audit-Log werden in **einer PostgreSQL-Transaktion** erfasst.
5. Claim V2 verwendet `FOR UPDATE ... SKIP LOCKED`, eine UUID-Lease und einen stabilen Idempotenzschlüssel.
6. Bei Timeout/ungeklärter Providerantwort bleibt die Lease blockiert. Kein automatischer Replay bei ungewissem Zustellstatus.
7. V1-RPCs verlieren `service_role`-Ausführungsrechte; Migration bedeutet zunächst **kein Publishing**, solange kein separat geprüfter V2-Worker vorhanden ist.
8. `distribution_queue_entries` bleibt für Nutzer lesbar (bestehende RLS), aber **nicht direkt beschreibbar**. Pending-Drafts müssen nach Migration über einen noch zu spezifizierenden gesicherten Intake aufgenommen werden. Bestehende Client-Integrationen können dadurch unterbrochen werden.

## Zwingende Staging-Abnahmematrix (nicht ausgeführt)

| ID | Negativ-/Positivfall | Muss gelten |
|---|---|---|
| PG01 | `anon` direct insert als `approved` | 42501 / keine Zeile |
| PG02 | `authenticated` direct insert als `approved` | 42501 / keine Zeile |
| PG03 | Auth-User ohne Owner-Rolle ruft Approve V2 | 42501 / keine Änderung |
| PG04 | Tenant-A-Owner genehmigt Tenant-B-Beitrag | 42501 / keine Änderung |
| PG05 | Tenant-Owner genehmigt pending exakt einmal | 1 Approval-Receipt, Queue `approved`, 1 Audit-Ereignis |
| PG06 | Erneute Genehmigung | Ablehnung / keine zweite Quittung |
| PG07 | Failure-Injektion bei Receipt-/Audit-Insert | Gesamte Transaktion rollback, keine halbe Freigabe |
| PG08 | Vor Versand wird Body/Channel/Hashtags/Post-Data geändert | Claim V2 liefert keine Zeile |
| PG09 | Ohne Approval-Receipt wird `status=approved` gesetzt | Claim V2 liefert keine Zeile |
| PG10 | Verfallene Freigabe nach 48 h | Claim V2 liefert keine Zeile |
| PG11 | Zwei gleichzeitige Worker claimen denselben Auftrag | Genau einer erhält Lease |
| PG12 | Abgelaufene Lease ohne Provider-Receipt | **Kein** automatischer Replay; manueller Abgleich erforderlich |
| PG13 | Ack mit falschem Token / synthetischem Receipt | Ablehnung |
| PG14 | Erfolgreicher Ack mit verifiziertem Provider-Receipt | Queue `published`, Audit-Ereignis, eindeutige externe ID |
| PG15 | Fehler mit sicher bestätigter Nichtzustellung | Begrenztes Retry mit gleicher Idempotenzkennung |
| PG16 | Provider-Timeout / unklarer Zustand | Kein Retry; manueller Abgleich |
| PG17 | V1-Claim-/Ack-/Fail-RPC mit service_role | Zugriff verweigert |
| PG18 | Unautorisierter Zugriff auf Approval-Receipts | RLS/GRANT verweigert |
| PG19 | Gleichzeitige Updates, geänderte Payload nach Claim | V2-Complete verweigert Bestätigung |
| PG20 | Persistenz nach Worker-Neustart, Outbox und Audit | Keine verlorenen Aufträge oder doppelte Freigaben |

## Wichtig: Was dieser Patch *noch nicht* löst

- **Kein V2-Publisher-Worker.** Dieser SQL-Entwurf darf nicht isoliert für Produktion ausgerollt werden. V1 wird absichtlich fail-closed.
- **Keine PostgreSQL-Integrationsausführung** hier; die 19 automatisierten Tests sind rein statische Quelltextkontrollen, keine Beweise für Transaktions- oder Rollbackverhalten.
- Keine End-to-End-Reconciliation mit YouTube, Instagram, TikTok, LinkedIn oder Resend. Der DB-Receipt-String kann nicht selbst die Echtheit der Providerantwort prüfen; das muss ein kontrollierter Adapter erledigen.
- Keine Freigabe-/Widerrufs-UI; kein RLS-E2E-Test für Supabase Auth; kein realer Cron-/Worker-Live-Test.
- Die reine In-Memory-`DistributionQueue` kann weiterhin `auto` publizieren, wenn ein echter Publisher dort registriert wird. **Vor Rollout muss dieser alternative Live-Pfad abgeschaltet oder an dieselbe Freigabe gebunden werden.**
- Externe APIs sind nicht mit der DB-Transaktion atomarisierbar. Genau-einmal-Zustellung braucht Provider-Idempotenz und Abgleich; andernfalls keine blinden Wiederholungen.
- Kein Migrations-Rollback nach Produktivsendungen entworfen; Wiederherstellung muss eigene versionierte, getestete Freigabe haben.

## Reihenfolge bis Go-Live

1. SQL-Review gegen aktuelle Schema-Definitionen und bestehende Cron-/Worker-Abhängigkeiten; `supabase migration new` im echten Repo verwenden und Dateinamen dort generieren.
2. Isolierte lokale oder explizit freigegebene Staging-DB: Migration, `PG01–PG20` und Rollback prüfen. **Nicht** RealSyncDynamicsLive.
3. V2-Worker mit vertrauenswürdigem Provider-Receipt, idempotentem Versand und explizitem Reconciliation-Pfad erstellen; dauerhaft fail-closed per Feature-Flag.
4. Alternate/In-Memory Publishing-Gate schließen; gesicherten Pending-Intake ergänzen.
5. Staging-E2E mit isolierten Testkanälen: Retry, Timeout, Provider-Ack, 24h+-Reconciliation, Auditevents.
6. Nach vollständiger unabhängiger Abnahme erst getrennte GO-Entscheidungen für Merge, Migration, Deployment und Live-Versand.

## Kosten & Änderungen

- Externe API-Aufrufe im Entwurf: **0**.
- Änderungen an `main`, Produktivdaten, Secrets, DNS und Live-Worker: **0**.
- Neue Kosten: **0 bestätigt**; für Staging ist eine Kostenermittlung und Zustimmung vor etwaiger Aktivierung erforderlich.