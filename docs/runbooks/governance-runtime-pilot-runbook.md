# Governance Runtime — Pilot & Production Readiness Runbook

**Status:** Operational
**Owner:** Governance Runtime
**Created:** 2026-05-21
**Companion to:** SPEC-001, RFC-002, RFC-003, RFC-004

Ziel: vom heutigen Stand („alle 4 RFCs gemerged, Migration eingecheckt")
zu **10 Production-Tenants** in 5 Wochen, ohne Trust-Verlust durch
unkalibrierte Scores oder Audit-Lücken.

---

## §0 Zeitplan (Kompakt)

| Woche | Stage | Owner | Output |
|---|---|---|---|
| W1 | Internal Pilot | Plattform | Throughput, RLS-Overhead, Memory-Decay-Correctness gemessen |
| W2 | Friendly Customer + Auditor-Console | Plattform + CSM | Erste echte DSR-Export-Bundle, RACPO-Plausibilität |
| W3–W4 | 3 weitere Tenants, RACPO Shadow-Tuning | Plattform + CSM | Kalibrierte Quadranten-Schwellen |
| W5+ | Live-Joint-Events, linear bis 10 Tenants | CSM + Sales | Pricing-Konversation, erste Vertragsgespräche |

**Stop-Bedingungen:** Jede Stage darf nur in die nächste, wenn die §-spezifischen Gates grün sind. Gates sind in §6 zusammengefasst.

---

## §1 Pre-Pilot — Was vor Stage 1 sitzen muss

Diese Punkte sind keine Stretch-Goals — ohne sie kein Pilot.

### §1.1 Code/DB

- [ ] PR #388 gemerged auf `main`
- [ ] Migration `20260602000000_runtime_events_backbone.sql` auf
      Staging-Supabase erfolgreich angewendet
- [ ] `runtime_events_legacy_phase0` rename verifiziert (alte Reads
      brechen kontrolliert, neue Reads gehen auf partitionierte Tabelle)
- [ ] Mindestens 6 Folge-Migrationen vorbereitet (nicht angewendet),
      pro RFC-Sektion eine: `subject_ref_lifecycle`, `agent_memory_decay`,
      `risk_scoring_mvs`, `cost_ledger`, `cost_caps`, `joint_views`

### §1.2 Secrets

- [ ] Vault-Secret `subject_ref_key_<tenant>_v1` pro Pilot-Tenant
      generiert (cryptographically random, 256 bit)
- [ ] Ed25519-Signing-Key für DSR-Export im Vault
      (`dsr_export_signing_key_2026_q2`) + Public-Key im Repo
      unter `infra/dsr-public-keys/`
- [ ] Service-Role-Token für die Pilot-Edge-Functions in
      `supabase functions secrets` gesetzt

### §1.3 Cron

- [ ] `mv_risk_refresh_15min` aktiv
- [ ] `mv_cost_refresh_15min` aktiv
- [ ] `mv_joint_refresh_hourly` aktiv
- [ ] `cost_reservation_sweep_1min` aktiv
- [ ] `emit_quadrant_changes_hourly` **inaktiv** während W1+W2 (Shadow-Mode)

### §1.4 Observability

- [ ] Supabase Logs-Drain nach Sentry für Edge-Functions konfiguriert
- [ ] Postgres Slow-Query-Log auf `> 500 ms` gesetzt
- [ ] Sentry-Alerts für 5xx auf Pilot-Edge-Functions
- [ ] Manuelles Dashboard (SQL): „events/sec", „MV refresh duration",
      „cost_check_and_reserve p99 latency"

---

## §2 Stage 1 — Internal Pilot (Woche 1)

**Ziel:** Bestätigen, dass die Pipeline unter echter Last hält. Kein
Customer-Contact.

### §2.1 Setup

Ein Tenant in Staging-Supabase, der unser eigenes governance-data
(scans, evidence, AI-Risk-Klassifikationen) konsumiert. Wir sind unser
eigener Pilot — wenn das Setup für uns weh tut, ist es für Kunden
unbenutzbar.

- [ ] Pilot-Tenant `pilot-internal` in `public.tenants`
- [ ] 2 Memberships (Plattform-Owner + CSM-Lead) in
      `public.tenant_memberships`
- [ ] Subject-Ref-Key v1 in Vault + Eintrag in `subject_ref_keys`
- [ ] Bestehende interne Cron-Jobs schreiben Events
      gegen den Pilot-Tenant (statt gegen Demo-Tenant)

### §2.2 Was zu messen ist

Die folgenden Metriken laufen über 7 Tage. Werte am Anfang + Ende
festhalten.

| Metrik | Quelle | Akzeptabel | Stop-Schwelle |
|---|---|---|---|
| `runtime_events` insert p99 | `pg_stat_statements` | < 50 ms | > 200 ms |
| Hash-Chain trigger overhead | manuell: insert mit/ohne trigger | < 30% slowdown | > 100% |
| RLS overhead on read | EXPLAIN ANALYZE typische Reader-Query | < 20% slowdown | > 80% |
| Risk Score MV refresh (15 min cron) | timing in cron log | < 60 s | > 5 min |
| Cost ledger insert p99 | `pg_stat_statements` | < 30 ms | > 100 ms |
| Memory state transitions / day | row count delta | matches expected | > 2× erwartet (Inflation?) |
| `runtime_events_verify_chain()` p99 für 10k events | manuelles Bench | < 5 s | > 30 s |

### §2.3 Red Flags

- DB-CPU > 60% sustained — Indexe nicht zur Workload passend
- RLS-Recursion-Warnings im Postgres-Log — `has_tenant_membership` falsch verwendet
- MV-Refresh blockt Reads — `CONCURRENTLY` fehlt oder UNIQUE-Index fehlt
- Hash-Chain-Verify findet Mismatches — `runtime_events_canonical_bytes` Determinismus gebrochen

### §2.4 Gate zu Stage 2

Alle Akzeptanz-Werte aus §2.2 erfüllt UND keine offene Red-Flag. Sonst
Stage 1 verlängern, **nicht** weiter.

---

## §3 Stage 2 — Friendly Customer (Woche 2)

**Ziel:** Erste echte DSR-Anfrage durch eine echte DPO-Person beantwortet
mit dem signierten Export-Bundle.

### §3.1 Friendly-Customer-Kriterien

- DSB-Kanzlei oder Compliance-fokussiertes Startup
- Bereit, Pilot-Vereinbarung zu unterzeichnen (Datenverarbeitung als
  Auftragsverarbeiter, AVV liegt schon im Repo)
- Hat **echtes Volumen** (mindestens 10 Subjects/Tag), nicht nur Demo
- Bereit, in W2 Stand-up-Call mit uns zu führen (Feedback-Schleife)

### §3.2 Onboarding-Schritte

1. Tenant + Memberships anlegen (wie §2.1)
2. Vault-Keys generieren, Eintrag in `subject_ref_keys`
3. Default-Caps in `tenant_cost_caps` setzen (siehe §4.1 für die
   konservativen Pilot-Werte)
4. Kunde streamt seine bestehenden Events via Ingest-Edge-Function
   in den Backbone (`pilot-customer-N`)
5. Verifier nach 24 h manuell laufen lassen:
   `SELECT * FROM runtime_events_verify_chain(<tenant_id>);`
   — alle Zeilen müssen `valid=true AND chain_ok=true`

### §3.3 Erste DSR-Übung

**Spätestens an Tag 4 der Woche 2:**

- CSM bittet Kunde um einen Test-DSR-Antrag (Art. 15 Auskunft) auf
  ein selbst gewähltes Subject
- Wir generieren das JSON-LD-Bundle, signieren, übergeben
- Kunde verifiziert mit unserem Public-Key
- Wenn der Verify-Step bei dem Kunden **out-of-the-box** funktioniert,
  ist das eine harte Validierung des Compliance-Werts. Wenn nicht —
  Lücke schließen, bevor Tenant 3 angefasst wird.

### §3.4 Auditor-Console (parallel, 3 Tage)

Minimaler React-Surface unter `/governance/console` mit vier
Read-Only-Views:

- **Tenant Quadrant** — eine Zeile, zeigt Risk-Score + 30d-Spend + Quadrant
- **RACPO per Flow** — Tabelle mit raw_cost, risk_score, incident_pressure, RACPO
- **Hash-Chain Verify** — Button, läuft `runtime_events_verify_chain()`,
  zeigt erste 10 Mismatches oder ✓
- **DSR Export** — Subject-Ref-Input → Bundle generieren → Download

Kein Schreib-Zugriff, kein State, kein „Settings". Reine Vertriebs-/
CSM-Infrastruktur. Routen via existierender `src/features/governance/`-
Struktur.

### §3.5 Gate zu Stage 3

- [ ] DSR-Bundle wurde von Kunde signaturverifiziert
- [ ] Hash-Chain-Verify komplett grün
- [ ] Auditor-Console live, CSM kann ohne SQL arbeiten
- [ ] Keine `cost.cap_violation_blocked` Events (Caps in W2 großzügig)
- [ ] Eine schriftliche „würde mich kaufen"-Aussage des Kunden (auch
      informell als Slack)

---

## §4 Stage 3 — RACPO Shadow-Tuning (Woche 3–4)

**Ziel:** Quadranten-Schwellen empirisch kalibrieren, bevor sie als
Joint-Audit-Events live gehen.

### §4.1 Pilot-Caps (konservativ)

Während W2–W4 nutzen wir **erhöhte** Caps gegenüber den RFC-Defaults,
damit nicht ein produktiver Kunde durch ein Cap-Limit blockiert wird:

| Limit | Pilot-Wert | RFC-Default |
|---|---|---|
| `llm_usd_monthly` | 1000 | 250 |
| `llm_tokens_monthly` | 20.000.000 | 5.000.000 |
| `replay_simulations` | 500 | 100 |
| `warn_threshold` | 0.90 | 0.80 |

Sonst gilt: jeder rejecte LLM-Call ist ein potenziell verlorener Kunde.

### §4.2 Tuning-Loop

- Cron `emit_quadrant_changes_hourly` läuft, aber in **Shadow-Mode**:
  schreibt Events in eine separate Tabelle `joint_events_shadow`, NICHT
  in `runtime_events`
- Wöchentliche Review der Shadow-Outputs:
  - Welche Tenants kippen in `red_alert`? Manuell prüfen — false-positive
    oder echt?
  - Welche Schwellen (Risk≥50, Cost≥1.5×median) müssen angepasst werden?
  - Welche `flow_ref` würde `deprecate` empfehlen — und stimmen wir
    intern damit überein?
- Nach W4: finale Schwellen in eine kleine Migration einfrieren,
  Cron auf Live-Mode schalten

### §4.3 Gate zu Stage 4

- [ ] Mindestens 3 aktive Pilot-Tenants
- [ ] Quadranten-Verteilung in Shadow ist plausibel (nicht alle in einem
      Quadranten)
- [ ] Keine Kategorie hat 100% false-positives
- [ ] CSM hat 1 internes Review-Meeting pro Woche durchgeführt, mit
      Output dokumentiert in `docs/pilots/quadrant-tuning-log.md`

---

## §5 Stage 4 — Linear Scale-Up (Woche 5+)

**Ziel:** Linear bis 10 Tenants, ohne dass die Plattform implodiert oder
Trust-Schaden entsteht.

### §5.1 Per-Tenant-Onboarding-Checkliste

Pro neuem Tenant exakt diese Liste — keine Variation, kein „shortcut":

- [ ] AVV (Auftragsverarbeitungsvereinbarung) unterzeichnet
- [ ] Tenant in `tenants` angelegt (über Onboarding-Edge-Function, nicht
      manuell)
- [ ] Mindestens 1 Owner-Membership in `tenant_memberships`
- [ ] Subject-Ref-Key v1 generiert + Eintrag in `subject_ref_keys`
- [ ] `tenant_cost_caps` mit Pilot-Werten (siehe §4.1)
- [ ] Erstes Event geschrieben, `runtime_events_verify_chain()` zeigt
      `chain_ok=true` für `tenant_seq=1`
- [ ] Auditor-Console-Login für die Customer-Owner-Person verifiziert
- [ ] CSM hat 30-min-Walkthrough mit der DPO/CISO-Person des Kunden
      gemacht

### §5.2 Joint-Events live

Ab Tenant 4 läuft `emit_quadrant_changes` im **Live-Mode** —
Quadranten-Wechsel emittiert echte `joint.tenant_quadrant_changed`-T1-Events
in den Backbone, sichtbar im Auditor-Console.

`joint.feature_flagged_for_deprecation` bleibt zunächst Shadow — wir
wollen **nicht**, dass Pilot-Tenants Empfehlungen sehen, ihre eigenen
Flows zu deprecaten, bis wir das mit ihnen besprochen haben.

### §5.3 Wachstums-Cap

Maximal **2 neue Tenants pro Woche**. Schneller wachsen ist Erfolg, der
sich rächt: Support, Onboarding und Tuning skalieren nicht linear.

---

## §6 Stage Gates — Zentral

| Gate | Stage davor | Stage danach | Hartes Kriterium |
|---|---|---|---|
| G1 | Pre-Pilot | W1 | §1 vollständig grün |
| G2 | W1 | W2 | §2.4 — Performance-Werte akzeptabel |
| G3 | W2 | W3 | §3.5 — DSR-Bundle Kunde-verifiziert, Console live |
| G4 | W4 | W5 | §4.3 — RACPO-Schwellen kalibriert |
| G5 | continuous | continuous | siehe Production-Readiness §7 |

Verletzung eines Gates ist **Stop-Bedingung**, nicht Verzögerung. Wir
wiederholen die Stage, bis das Gate grün ist.

---

## §7 Production Readiness Checklist (continuous)

Diese Liste läuft **dauerhaft** ab W1 mit. Jede Position MUSS grün sein,
sobald ein zahlender Tenant draufkommt.

### §7.1 Backup & Recovery

- [ ] Supabase PITR (Point-in-Time-Recovery) auf 30 Tage aktiviert
- [ ] Tägliche logical-pg_dump-Backups der `runtime_events` Partitions in
      separate Storage-Bucket (S3-kompatibel, EU-Region)
- [ ] **Restore-Test** mindestens einmal vor W3 durchgeführt:
  - Fresh DB hochfahren
  - Backup einspielen
  - `runtime_events_verify_chain()` auf einer Stichprobe — Hash-Chain
    muss konsistent sein
  - **Ohne erfolgreichen Restore-Test ist W3 gesperrt**

### §7.2 Monitoring

| Signal | Schwelle | Alert |
|---|---|---|
| `llm_usd_monthly` Verbrauch | ≥ 80% | warn (Slack #governance) |
| `llm_usd_monthly` Verbrauch | ≥ 95% | throttle automatisch, page CSM |
| `runtime_events` insert p99 | > 200 ms (5 min average) | page DBA |
| MV refresh duration | > 5 min | warn |
| Edge function 5xx rate | > 1% (5 min window) | page on-call |
| `tenant_risk_score` plötzlich > 90 | jeder Übergang | page CSM (siehe Incident Playbook §7.4) |
| Hash-Chain-Verify findet Mismatches | jeder Fund | **P0 page CTO** |

### §7.3 Cost Attribution Audit

Wöchentlicher Sanity-Check (cron, montag 08:00):

```sql
-- Drift-Check zwischen Ledger und Event-Payload-Snapshot
WITH ledger AS (
    SELECT tenant_id, trace_id, SUM(amount_usd) AS ledger_usd
      FROM public.tenant_cost_ledger
     WHERE is_simulated = false AND settled = true
       AND occurred_at >= now() - INTERVAL '7 days'
     GROUP BY tenant_id, trace_id
),
events AS (
    SELECT tenant_id, trace_id,
           SUM((payload->'cost_units'->>'total')::numeric) AS event_usd
      FROM public.runtime_events
     WHERE ts >= now() - INTERVAL '7 days'
       AND payload ? 'cost_units'
     GROUP BY tenant_id, trace_id
)
SELECT l.tenant_id, l.trace_id, l.ledger_usd, e.event_usd,
       ABS(l.ledger_usd - COALESCE(e.event_usd, 0)) AS drift
  FROM ledger l
  LEFT JOIN events e USING (tenant_id, trace_id)
 WHERE ABS(l.ledger_usd - COALESCE(e.event_usd, 0)) > 0.01;
```

Wenn das Ergebnis nicht leer ist: Drift zwischen Ledger und
Event-Snapshot → P1-Investigation. Bedeutet, dass entweder ein Cost-
Writer nicht doppelt schreibt (Verletzung Kernel-RFC §P4.4) oder Events
mit `cost_units` ohne Ledger-Pendant geschrieben werden.

### §7.4 Incident Response Playbook — Risk Score > 90

Wenn ein Tenant `tenant_risk_score > 90` erreicht:

1. **Stunde 0 (automatisch):**
   - `joint.tenant_quadrant_changed`-Event mit `severity=critical`
   - Slack-Alert in `#governance-incidents` mit Tenant + Score-Components
   - Auditor-Console zeigt `red_alert`-Badge

2. **Stunde 0–2 (CSM-Lead):**
   - Components prüfen (`SELECT * FROM mv_tenant_risk_score WHERE tenant_id = ?`)
   - Welche Component dominiert?
   - `mv_compliance_signals_open` für offene DSGVO/AI-Act/NIS2-Signale prüfen
   - Anomaly-Detector-Outputs der letzten 24 h reviewen

3. **Stunde 2–24 (Plattform + CSM):**
   - Wenn `consent_component` dominant: scan auf Tracker-Liste, Hinweis an Kunde
   - Wenn `ai_loop_component` dominant: Trace-IDs mit max-depth identifizieren,
     `propagate_cost_attribution` ausführen — ist da was kaputt?
   - Wenn `memory_inflation_component` dominant: Memory-Decay-Worker-Logs prüfen,
     ggf. manuelle Decay-Reklassifizierung
   - Wenn `incident_component` dominant: ist das real (Incident wirklich
     offen) oder Stale-Closure?

4. **Stunde 24–72:**
   - Schriftlicher Kunde-Kontakt mit Erklärung
   - Falls Customer-Behavior das Problem ist: AVV-Klausel zitieren,
     Remediation-Plan
   - Falls **wir** das Problem sind: Postmortem in
     `docs/postmortems/{date}-risk-spike-{tenant}.md`

5. **Schließen:**
   - `joint.incident_resolved`-Event mit Root-Cause, schließt das
     `joint.tenant_quadrant_changed` als Closure-Anker

### §7.5 Rollback-Plan

| Lage | Rollback |
|---|---|
| Migration kaputt | Supabase PITR auf Zeitpunkt vor Migration; legacy-Tabelle ist intakt |
| Hash-Chain-Korruption auf einer Partition | Partition aus Backup restoren, Verify-Chain laufen, Tenants in der Partition informieren |
| Cost-Ledger-Drift > 10% | Cost-Writer pausieren (Feature-Flag), forensische Analyse, Reconcile |
| RACPO-Tuning Disaster (alle red_alert) | Cron `emit_quadrant_changes` auf Shadow zurücksetzen (1 SQL-Statement), Audit-Events aus 24h löschen via `DROP PARTITION`-Fast-Path **NICHT** — stattdessen mit `joint.quadrant_correction`-Events korrigieren (append-only Disziplin) |

---

## §8 Decision Point nach W4

Nach Stage 3 (W4) liegen folgende Datenpunkte vor:

- Performance-Profile aus W1 (DB unter Last)
- DSR-Bundle-Akzeptanz aus W2 (sales-fähig?)
- RACPO-Schwellen-Plausibilität aus W3–W4

Entscheidung A (Scale Up linear): grün, wenn alle drei positiv sind.

Entscheidung B (Pause + Copilot Layer): nur, wenn die Auditor-Console
aus §3.4 sich als **unzureichend** für CSM-Arbeit herausstellt — was
empirisch nach 2 Wochen Praxis-Einsatz bewertbar ist, nicht vorher.

Default-Pfad: A. Begründung steht in der Slack-Diskussion zum
Phase-5-Plan: Infrastruktur ist da, ROI sofort messbar, Copilot lässt
sich aus den Pilot-Statistiken später bauen.

---

## §9 Was diese Runbook NICHT abdeckt

- Pricing-Modell — separate Konversation nach §8
- Marketing-Page-Updates — Marketing-Owner
- Vertragsmuster jenseits AVV — Legal-Owner
- Skalierung jenseits 10 Tenants — eigene Iteration des Runbooks, mit
  echten Zahlen aus W5+
