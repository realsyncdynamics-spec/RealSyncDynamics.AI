# SPEC-001 / RFC-002–004 — Phase 5 Go-Live Runbook

**Status:** Plan v1.0
**Owner:** Governance Runtime
**Created:** 2026-05-21
**Companion to:** PR #388 (SPEC-001 + RFC-002 + RFC-003 + RFC-004)

Dieses Runbook ist die operative Brücke zwischen den vier RFCs und der
echten Produktion. Drei Zeitfenster, jeweils mit verbindlichen Exit-
Kriterien:

| Fenster | Inhalt | Exit-Kriterium |
|---|---|---|
| Diese Woche | Unit-Tests + First Internal Pilot + Integration-Tests | alle 3 grün, Throughput ≥ 200 events/s p95 |
| Nächste 2 Wochen | Production-Readiness + Second Pilot (friendly customer) | Customer-Feedback liegt vor, Caps + Alerts feuern |
| Nach Woche 2 | Strategische Entscheidung A (Scale) vs. B (Copilot first) | mit Daten gestützt |

---

## §1 Immediate — Diese Woche

### §1.1 Unit Test Suite

Eine Test-Datei pro RFC. Vitest-Pattern, gegen lokale Supabase-Instanz
(`supabase start`).

| Datei | RFC | Was wird geprüft |
|---|---|---|
| `test/runtime/operational-event-backbone.test.ts` | SPEC-001 | Event ordering (global_seq + tenant_seq monoton, lückenfrei), Idempotency-Trigger, Hash-Chain Verifier (Genesis, Forward, Tampered) |
| `test/runtime/subject-ref-lifecycle.test.ts` | RFC-002 | HMAC-Determinismus, Key-Rotation (active→rotating→retired), DSGVO-Export-Signatur, Cross-Tenant RLS-Negativtest |
| `test/runtime/governance-memory-policy.test.ts` | RFC-003 | State-Transition (active→cooling→archived→expired→purged), Retention-Holds (regulatory_hold blockt Purge), supersedes_id Idempotenz, atomic erasure mit subject_ref |
| `test/runtime/intelligence-economics.test.ts` | RFC-004 | Risk-Score-Komposition, Anomaly-Detector-Schwellen, Cost-Attribution-DAG-Propagation, Cap-Pre-Check + Reservation + Settle, RACPO-Formel, Quadranten-Übergänge |

**Test-Pattern für SPEC-001 (Vorlage liegt unter
`test/runtime/operational-event-backbone.test.ts`):**

```ts
// 1. setup: create tenant + membership
// 2. insert N events, assert global_seq strictly increasing
// 3. assert tenant_seq monotone per tenant, gap-free
// 4. attempt UPDATE → expect 42501
// 5. attempt DELETE → expect 42501
// 6. verify_chain(tenant) — all rows valid=true && chain_ok=true
// 7. tamper a row via service-role bypass → verify_chain reports valid=false
```

**Exit-Kriterien:**
- `npm test -- test/runtime` — 100 % grün
- Coverage ≥ 80 % für die geprüften RPCs / Trigger-Funktionen
- CI-Job `unit-tests-runtime` ist required für PR-Merge

### §1.2 First Tenant Pilot — Internal

**Setup:**
1. Staging-Projekt mit der Migration aus PR #388 deployed
2. Ein internes Tenant-Konto (`tenant_id = staging-internal-01`)
3. Synthetische Workload:
   - 50 % Tracker-Scanner-Events (`scan.*`, `tracker.*`)
   - 30 % AI-Inferenz-Events mit Cost-Snapshot
   - 15 % Consent-Events
   - 5 % Incident-Events
4. Ziel-Lastprofil: **200 events/s sustained über 24 h**

**Messmatrix:**

| Metrik | Erwartung | Red Flag |
|---|---|---|
| Insert-Latenz p95 | < 25 ms | > 100 ms |
| Hash-Chain-Verify p99 (10k Events) | < 2 s | > 10 s |
| Partition-Routing-Fehler | 0 | irgendein > 0 |
| RLS-Overhead (Select 1000 rows) | < 50 ms | > 200 ms |
| `runtime_event_tenant_counters`-Contention | < 5 % wait events | > 20 % |
| Memory-Decay-Job-Dauer (10k items) | < 60 s | > 5 min |

**Exit-Kriterien:**
- 7 Tage stabiler Lauf ohne Insert-Fehler
- Messmatrix-Spalte „Erwartung" überall eingehalten
- Mindestens 1 echter Incident künstlich erzeugt + nachverfolgt
  (`incident.opened` → Risk-Score-Anstieg → Quadranten-Übergang)

### §1.3 Integration Tests

Sechs End-to-End-Szenarien, jeweils als E2E-Spec (Playwright) oder als
Vitest-Integrationstest gegen die Staging-DB.

| # | Szenario | Erfolg = |
|---|---|---|
| 1 | Event → Cost Attribution (E2E) | Event mit `cost_units` payload führt zu Ledger-Insert; Propagation entlang causation-DAG akkumuliert korrekt |
| 2 | Risk × Cost = Decision (Red Alert) | Hoch-Risk-Hoch-Cost-Tenant erzeugt → `joint.tenant_quadrant_changed` mit `payload.current = 'red_alert'` innerhalb 60 min |
| 3 | Memory Decay bei persistierten Events | Memory mit `automated_purge_date < now()` ohne Hold wird gepurged; `memory.purged` Event in `runtime_events` mit korrekter Hash-Chain |
| 4 | subject_ref Lifecycle bei DSGVO-Export | Key rotieren → alter `subject_ref` bleibt verify-bar; Export-Bundle enthält Ed25519-Signatur; Signatur valide |
| 5 | Replay × Cost Isolation | Shadow-Replay-Run schreibt `is_simulated=true` Ledger-Zeilen; Cap-Aggregat ignoriert sie |
| 6 | Throttle ≠ Kill | Tenant überschreitet Cap → `cost_check_and_reserve` returnt `throttle`; T0-Events werden trotzdem geschrieben (Audit-Pflicht) |

**Exit-Kriterien:**
- alle 6 Tests grün in CI
- jeder Test setzt seinen Tenant deterministisch auf (kein flaky Shared-State)

---

## §2 Next 2 Weeks

### §2.1 Production Readiness Checklist

| Bereich | Anforderung | Status-Feld |
|---|---|---|
| **Backup** | Tägliches Point-in-Time-Backup von `runtime_events` + `agent_memory` + `tenant_cost_ledger`. Restore-Drill < 30 min auf neue Instanz. | ☐ |
| **Recovery** | Partition-Drop-Skript dokumentiert; Partition-Recreate aus PITR-Snapshot getestet. | ☐ |
| **Monitoring — Caps** | Alert bei Cap-Verbrauch ≥ 80 % (Pager: low), ≥ 95 % (Pager: high). Quelle: `mv_cost_per_tenant` joined mit `tenant_cost_caps`. | ☐ |
| **Monitoring — Risk** | Alert bei `joint.tenant_quadrant_changed → red_alert`. Pager: high, 15-min-Cooldown. | ☐ |
| **Monitoring — Latenz** | Insert-Latenz p99 < 100 ms via Sentry oder OpenTelemetry. | ☐ |
| **Monitoring — Hash-Chain** | täglicher Cron-Job ruft `runtime_events_verify_chain()` für alle Tenants über letzte 24 h. Mismatches → P0-Alert. | ☐ |
| **Incident-Playbook** | Runbook „Risk Score > 90" liegt vor (siehe §2.2). | ☐ |
| **Cost-Audit-Trail** | Cron `cost.cap_reset` einmal pro Monatsanfang als T0-Event. Auditierbar. | ☐ |
| **Secrets** | HMAC-Keys (RFC-002) im Vault, Rotation-Cron quarterly aktiv. | ☐ |
| **DSR-Endpunkte** | Edge-Function `dsr-export` deployed, Ed25519-Signing-Key separat in Vault. | ☐ |
| **Cron-Order** | Migration-Order-Doc (§3) + Cron-Activation-Order-Doc liegen vor. | ☐ |
| **Feature-Flags** | `runtime_event_strict` (Shadow → Strict) und `cost_caps_enforce` als Tenant-Flags vorhanden. | ☐ |

### §2.2 Incident Response Playbook — „Risk Score > 90"

```text
1. PAGER FIRES → on-call ack innerhalb 5 min

2. INITIAL ASSESSMENT (within 15 min)
   a. SELECT * FROM mv_tenant_risk_score WHERE tenant_id = ?
   b. SELECT * FROM mv_risk_consent_7d WHERE tenant_id = ?
      SELECT * FROM mv_risk_ai_loop_24h WHERE tenant_id = ?
      SELECT * FROM mv_risk_memory_inflation_24h WHERE tenant_id = ?
      SELECT * FROM mv_risk_incident_30d WHERE tenant_id = ?
   c. SELECT * FROM v_tenant_risk_cost_quadrant WHERE tenant_id = ?
      → which quadrant? red_alert / investigate?

3. ATTRIBUTION (within 30 min)
   a. Welcher Component dominiert? (siehe §2.1 RFC-004)
   b. Recent timeline: SELECT type, severity, ts, subject_ref
        FROM runtime_events
        WHERE tenant_id = ? AND ts >= now() - INTERVAL '24h'
        ORDER BY tenant_seq DESC LIMIT 200;

4. ACTION DECISION TREE
   - consent_component dominiert → DSB / DSGVO-Team
   - ai_loop_component dominiert → Anti-Loop-Cap setzen
        (RFC-003 hard-cap §3.5), Pause Memory Hot-Path
   - memory_inflation dominiert → Memory-Decay-Cron manuell auslösen
   - incident_component dominiert → existing Incident-Playbook

5. CONFIRM RESOLUTION
   - Risk-Score nach 30 min < 75? → close
   - Score steigt weiter? → escalate to architect

6. POST-MORTEM
   - Conclusion-Events (joint.*) als Beweisfügen
   - feature_hash der RACPO-MV-Zeile dokumentieren
```

### §2.3 Second Tenant Pilot — Friendly Customer

**Auswahl:** DSB-Kanzlei oder Compliance-fokussiertes Startup mit
existierendem Pain („meine Mandanten brauchen einen prüffähigen
DSGVO-Audit-Trail").

**Setup:**
1. Tenant in Produktion provisionieren mit
   `runtime_event_strict = shadow` (RFC-001 Phase 2)
2. 1-Stunde Onboarding-Workshop: Event-Vokabular, was emittiert wird,
   wo der Audit-Trail sichtbar ist
3. Wöchentlicher Feedback-Call

**Mess-Hypothesen (zu bestätigen oder zu widerlegen):**

| Hypothese | Wie messen |
|---|---|
| Der Risk-Score korreliert mit der Help-Desk-Last des Kunden | wöchentlicher Vergleich Risk-Score Δ vs. Support-Tickets Δ |
| Cost-Attribution per `flow_ref` ist granular genug, um Pricing-Diskussionen zu führen | Kunde nennt selbst „diesen Flow würde ich gern stoppen, der kostet zu viel" |
| DSGVO-Export-Bundle ist juristisch verwertbar | Kanzlei nutzt es in einer echten Auskunfts-Anfrage |
| RACPO sagt Pricing-Bedarf vorher | RACPO-Hochzeitspunkt → Pricing-Diskussion innerhalb 14 Tage |

**Exit-Kriterium:** Mindestens 2 der 4 Hypothesen bestätigt nach 14 Tagen.

---

## §3 Deployment Order

Genau diese Reihenfolge, jeweils ein PR pro Schritt:

```text
1. SPEC-001 Migration anwenden (diese PR #388)
   ├── tenant_memberships
   ├── runtime_events (partitioned) + Trigger + Indexes
   ├── runtime_event_cursors
   └── Bootstrap-Partitionen prev_month .. +6 months

2. RFC-002 Migration: subject_ref_keys + mappings + RPCs
3. RFC-003 Migration: agent_memory state extensions + indexes
4. RFC-004 Part A: Risk MVs + subject_risk Trigger + Anomaly RPCs
5. RFC-004 Part B: tenant_cost_ledger + caps + RPCs + Reservation-Sweeper
6. RFC-004 Part C: RACPO MV + Quadranten + Deprecation View + Joint Events

7. Cron-Activation (pg_cron):
   a. cost_reservation_sweep_1min
   b. mv_*_refresh_15min
   c. mv_*_refresh_hourly
   d. emit_quadrant_changes_hourly
   e. memory_decay_hourly
   f. subject_ref_rotation_quarterly

8. Edge-Functions:
   a. governance-event (writer) — emittiert Events mit cost_units
   b. cost-middleware (cost_check_and_reserve + cost_writer_settle)
   c. dsr-export (Ed25519-signed JSON-LD)
   d. memory-decay-worker
   e. subject-ref-erasure-worker

9. Surfaces aktivieren:
   - Read-only Dashboard für Tenant-Risk + Quadranten (intern)
   - Audit-View für DSR-Export-Bundles
```

**Rollback-Strategie:**
- Jede Migration ist transaktional. Bei Fehler bleibt die DB auf dem
  vorigen Stand.
- Cron-Jobs lassen sich einzeln pausieren: `SELECT cron.unschedule('jobname')`.
- Feature-Flag `cost_caps_enforce = false` deaktiviert Pre-Checks
  (Caps werden nicht blockiert, nur protokolliert) → Soft-Rollback ohne
  Schema-Revert.
- Partition-Rollback: `DROP TABLE public.runtime_events_<YYYYMM>` für die
  letzte Partition, dann erneut `runtime_events_ensure_partition()`.

---

## §4 Strategische Entscheidung — A (Scale) vs. B (Copilot)

Siehe Antwort des Owners im PR-Thread. Diese RFC enthält die Daten-Grundlage
für die Entscheidung; die Entscheidung selbst gehört in den
Pilot-Feedback-Report nach Woche 2.

**Kriterien-Matrix:**

| Frage | Antwort entscheidet für |
|---|---|
| Sagt der Risk-Score messbar Support-Last voraus? | A |
| Bestätigen die Pilot-Kunden den Audit-Trail-Wert ohne UI? | A |
| Verstehen die Pilot-Kunden RACPO ohne Erklärung? | B |
| Brauchen sie ein Cockpit um die Insights zu nutzen? | B |
| Ist die Insert-Latenz unter Last stabil? | A |
| Gibt es Compliance-Anfragen, die ein UI verlangen? | B |

Mehrheit pro A → Scale Up. Sonst Copilot.

---

## §5 Acceptance Criteria — Phase 5 Abschluss

- [ ] 4 Unit-Test-Files, ≥ 80 % Coverage der Trigger/RPCs
- [ ] 1 Internal Pilot, 7 Tage stabil, Messmatrix grün
- [ ] 6 Integration-Tests grün in CI
- [ ] Production-Readiness-Checklist komplett ☑
- [ ] Incident-Playbook „Risk > 90" geübt (Tabletop)
- [ ] 1 Friendly-Customer-Pilot live, Feedback-Report nach 14 Tagen
- [ ] Strategische Entscheidung A vs. B im Pilot-Report dokumentiert
- [ ] Deployment-Order §3 in CI / Runbook fest hinterlegt
- [ ] Rollback-Drill durchgeführt (Schema-Revert + Cron-Pause + Feature-Flag)
