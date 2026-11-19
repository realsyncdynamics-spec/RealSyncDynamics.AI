---
title: SF-002 – transaktionaler Factory-Store und Worker-Lease
owner: Plattform-Betrieb
reviewed: 2026-11-20
status: entwurf
---

# SF-002 – Atomic Store, Recovery und Fencing (ausschließlich Simulation)

**Ziel:** SF-001 so ergänzen, dass Datenbank- und Worker-Grenzen vor dem Anschluss an Supabase/GitHub formal prüfbar sind. Dieser Entwicklungsbranch führt **keine Migration und keinen Deploy** durch.

## Implementierte, aber nicht angebundene Verträge

| Datei | Zweck | Grenze |
| --- | --- | --- |
| `packages/ai-os-core/src/factory-contract.ts` | SF-001-Statusmaschine und Mock-Worker | Keine Authentizität oder Persistenz |
| `packages/ai-os-core/src/factory-atomic.ts` | Storage-Port `load + commit` mit Version-CAS; fail-closed bei Speicherfehlern | Keine Datenbankimplementation |
| `packages/ai-os-core/src/factory-lease.ts` | Fencing-Epochen, Lease-Akquisition/Erneuerung/Freigabe als reine Funktionen | Keine Clock-/Worker-Authentifizierung oder Lease-Persistenz |
| `test/ai-os/factory-atomic.test.ts` | 14 Vitest-Fälle mit künstlichem In-Memory-Store | Tests **angelegt**, nicht als bestanden behauptet |

Die Komponenten sind **nicht** im Package-`index.ts` exportiert, nicht ins `ai-os-control` eingebaut und haben keine Routenkonfiguration. Der Test-Store ist eine In-Memory-Fixture mit gemeinsamem `Map`; Wiederinitialisierung der Adapterinstanz **beweist keine Prozess- oder Datenbank-Dauerhaftigkeit**.

## Kritische transaktionale Invarianten für einen echten Postgres-Adapter

1. **Autorität:** Kein vom Client übermitteltes `isOperator`, `scopeId`, `aal2`, Approval-Flag oder Zeitstempel wird zur Freigabe benutzt. Das Gateway ermittelt die Identität serverseitig; betriebliche Rollen und MFA müssen vor Datenzugriff geprüft werden.
2. **Atomarer Schreibvorgang:** Versionsvergleich und neues `factory_jobs`-State, ein append-only `factory_events`-Eintrag, ein eindeutiger `factory_receipts`-Eintrag sowie Budgetreservierung/Abrechnung müssen in **einer** Postgres-Transaktion erfolgen. Kein auseinandergezogener `supabase.from().update()` plus separater Event-`insert()`.
3. **Isolation:** Factory-internes Operator-Scope != Kunden-`tenant_id`. Kein Cross-Tenant-Bypass. Datenbankobjekte bevorzugt im **nicht exponierten Schema**, Zugriff nur über auditierten und explizit autorisierten Serverpfad. Anlegen von Tabellen/Grants/RLS/RPCs erfordert **eigene Migration mit Einzel-Freigabe**.
4. **Idempotenz:** Einzigartiger Schlüssel mindestens je `scope_id + job_id + idempotency_key` und Bindung an denselben **vollständigen** Request-Inhalt. Wiederholung nach verlorenem Commit-Response liefert gespeichertes Ergebnis, widersprüchliche Wiederholung wird abgewiesen.
5. **Optimistic CAS:** `expected_version` gegen die aktuelle Version prüfen; konkurrierende Updates dürfen nie beide gewinnen. Ein verlorener Commit-Response ist nicht als Erfolg zu behandeln.
6. **Budget:** Externe Kosten müssen **vor** Provider-/Worker-Aufruf atomar reserviert sein; Buchung, Erstattung, Verfall und endgültige Abrechnung brauchen einen echten Ledger. Die SF-001-Funktion `mockCostCents` ist keine Geld- oder Token-Sicherheitsgrenze.
7. **Evidenz:** `evidenceRef` wird aktuell nur per Regex geprüft. Künftig müssen gehashte, dauerhaft gespeicherte, tenant-/scope-gebundene und unveränderbar referenzierte Evidenzartefakte mit Job-ID, Commit-SHA, Testlauf, Modell/Tool-Version und Freigabebeleg verknüpft sein. Ein String mit `ev_` reicht nicht.
8. **Leases:** Eindeutige, dauerhaft monotone `epoch` bei jeder erfolgreichen Übernahme; CAS der Lease-Revision, serverseitige Datenbankzeit und maximale TTL. Nach Ablauf muss jeder externe Schritt mit alter Epochennummer durch einen **fenced** Adapter verweigert werden.
9. **Crash/Recovery:** Jobs nicht aus flüchtigem Prozesszustand neu bilden. Keine automatische Rückkehr von `failed` zu `running`. Ein Recovery-Controller muss abgebrochene Leases erkennen, Outbox-Events deduplizieren und einen expliziten neuen Versuch nach Policy/Review anlegen.
10. **Kill Switch:** Beim Widerruf/Abbruch darf kein neuer Tool-Aufruf starten; aktive Worker müssen ihre Lease und Autorisierung vor jeder relevanten Aktion erneut prüfen. Ein Timer oder eine UI-Schaltfläche allein genügt nicht.

## Geplantes transaktionales Datenmodell (kein SQL angewendet)

`factory_jobs`: `scope_id`, `job_id`, `version`, `state`, `spec_hash`, `approved_by`, `approval_expires_at`, `budget_reserved`, `budget_spent`, `created_at`, `updated_at`.

`factory_events`: `scope_id`, `job_id`, `event_seq`, `from_state`, `to_state`, `actor_id`, `evidence_digest`, `created_at` — Unique `(scope_id, job_id, event_seq)`, INSERT-only.

`factory_receipts`: `scope_id`, `job_id`, `idempotency_key`, `payload_hash`, `result_version`, `result_digest` — Unique `(scope_id, job_id, idempotency_key)`.

`factory_worker_leases`: `scope_id`, `job_id`, `revision`, `fencing_epoch`, `holder_id`, `expires_at`. Lease-Änderung atomar zum Job-/Worker-Start, später jeder Commit nur unter passendem Fencing-Epoch.

`factory_approvals`: unveränderlicher `approval_id`, `job_id`, `spec_hash`, `approver_id`, `decision`, `scope_id`, `expires_at`, `evidence_digest`; nur durch serverseitig autorisierten menschlichen Entscheidungsweg.

`factory_cost_ledger`: Reservierung, Verbrauch, Freigabe und Provider-Korrelation pro Job. Kein Write ohne gültige und ausreichende Reservierung.

**Keiner dieser Tabellennamen belegt bestehende Tabellen.** Namen und Schema sind ein Vorschlag für die spätere migrationspflichtige Phase.

## Negative Tests auf der aktuellen Fixture

- Kein Operator; Produktionsmodus; fremder interner Scope; fehlender/corruptierter Job.
- Gleichzeitige Versionsänderungen: maximal ein Commit, zweiter `write_conflict`.
- Datenbankausfall vor Schreibvorgang und „Commit erfolgreich, Antwort verloren“; nur exakte Wiederholung mit identischem Schlüssel.
- Lease an Worker A, Sperre für B; später Übernahme durch B mit höherem Fencing-Epoch, A kann nicht erneuern.
- Falscher Holder oder veraltete Revision; abgelaufene Lease; TTL über zulässigem Limit; Job nicht ausführbar.

## Nachweise und Status

- GitHub-Dateien: **erstellt und lesend überprüfbar**.
- `vitest run test/ai-os/factory-contract.test.ts test/ai-os/factory-atomic.test.ts`: **nicht ausgeführt**.
- Repository-Typecheck, vollständige CI, echte Persistenz-/Crash-/RLS-Tests: **offen**.
- Produktionsfähiger Store: **nicht vorhanden**.
- Reales Worker-Fencing an GitHub/Dateisystem/Provider: **nicht vorhanden**.
- PR #2336 weiterhin Draft: Umgebung `production` nicht als wirksam bestätigte Freigabeschranke anzunehmen.

## SF-002 Gate / Entscheidung

**GO nur für weiteren, isolierten Test- und Vertragsausbau auf dem Entwicklungsbranch.**

**NO-GO für produktiven Datenbankanschluss, Migration, autonome Codeausführung, externe Spendierung, Merge und Deployment**. Vor dem Übergang: Code auf dem Branch lokal/CI prüfen; reale Transaktionsgrenze und ACL/RLS-Konzept reviewen; separaten Migrations- und Security-Freigabeweg einhalten; Produktionsenvironment-Schutz unabhängig nachweisen.

Quellen: [SF-001](software-factory-sf001.md), [AI-OS Einstieg](README.md), [Agent-OS Substrate](../../src/core/agent-os/README.md), [PR-Triage](../../.github/PR_TRIAGE_POLICY.md), [Supabase Database Functions](https://supabase.com/docs/guides/database/functions), [API Grants/RLS](https://supabase.com/docs/guides/api/securing-your-api).
