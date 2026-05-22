# RFC-003 — Governance Memory Policy v0.1

**Status:** Draft — Policy & Semantics only (keine Infrastruktur in dieser RFC)
**Owner:** Governance Runtime
**Created:** 2026-05-21
**Companion to:**
[`runtime-kernel-rfc.md`](./runtime-kernel-rfc.md) §P3 (Memory Decay),
[`subject-ref-lifecycle-rfc.md`](./subject-ref-lifecycle-rfc.md) (RFC-002),
[SPEC-001 Migration](../../supabase/migrations/20260602000000_runtime_events_backbone.sql)

**Scope dieser RFC:**

- Verbindliche **Klassifikation** für Memory-Items
- Verbindliche **Decay-Policies** und ihre Auslöser
- Verbindliche **Retention-Constraints**
- **Performance-Erwartung** für Memory-Queries
- **Compliance-Semantik** (DSGVO Art. 5, EU AI Act)
- **Integrationsvertrag** mit `runtime_events`

**Out of scope (folgt in eigenen RFCs / Migrations):**

- Schema-DDL für `agent_memory` (Kernel-RFC §P3.3 hat den Draft, Implementierung in eigener Migration)
- Cron-/Worker-Code (`memory-decay`)
- Materialized-View-Definitionen mit konkretem Refresh-Schedule
- Edge-Functions für Memory-Read/Write

---

## §1 Warum eine Policy ohne Infrastruktur

Memory ohne explizite Policy degeneriert vorhersagbar:

- **Inflation** — Memory wächst linear mit Konversationen, LLM-Kosten linear mit Memory.
- **Hallucination-Carryover** — alte falsche Klassifikationen werden zitiert.
- **Compliance-Drift** — PII liegt jenseits ihrer rechtlichen Aufbewahrungsfrist herum.
- **Inkonsistenz** — verschiedene Agenten interpretieren dieselben Fakten unterschiedlich.

Die Lösung beginnt **nicht** mit einer Tabelle, sondern mit drei Verträgen:

1. **Was ist Memory eigentlich?** (Klassifikation)
2. **Wie altert es?** (Decay)
3. **Wann darf es nicht altern?** (Retention-Constraints)

Erst danach ist Schema/Worker-Diskussion produktiv.

---

## §2 Memory Classification

Jedes Memory-Item gehört zu **genau einer** der folgenden Klassen. Die
Klasse wird beim Insert gesetzt und ist **immutable** — Re-Klassifikation
erfordert ein neues Memory-Item mit Verweis (`supersedes_id`) auf das alte.

### §2.1 Fact

> **Definition:** Eine attestierte Aussage über die Welt, gestützt auf
> Evidence, deren Wahrheit nicht durch Zeitablauf entwertet wird.

| Property | Wert |
|---|---|
| Veränderlichkeit | unveränderlich (immutable) |
| Decay | **kein temporaler Decay**; nur retention-basiert |
| Evidence-Pflicht | mindestens 1 `evidence_ref` |
| Default-Retention | `7y` (DSGVO-konform) |
| Beispiele | „Tracker `googletagmanager.com` lud um 08:14 vor Consent" · „User XYZ hat am 2026-03-12 dem AVV zugestimmt" |

**Hard-Regel:** Ein Fact ohne `evidence_refs` ist **nicht** Fact, sondern
Inference (siehe §2.2).

### §2.2 Inference

> **Definition:** Eine vom System aus anderen Memory-Items oder Events
> abgeleitete Aussage. Wahr **zum Zeitpunkt der Ableitung**, verlangt
> Re-Validation bei neuer Evidenz.

| Property | Wert |
|---|---|
| Veränderlichkeit | verfallbar, nicht mutierbar (neue Inference supersedes alte) |
| Decay | temporal **und** confidence-basiert |
| Evidence-Pflicht | `derived_from` (1..n Refs auf Memory-Items oder Events) |
| Default-Retention | `1y` |
| Beispiele | „Tenant X ist Hochrisiko-Operator nach AI-Act" · „Nutzer-Cluster Y zeigt Drift gegenüber Baseline" |

**Hard-Regel:** Bei neuer widersprechender Evidence MUSS die Inference auf
`stale` gesetzt werden und eine neue Inference mit `supersedes_id`
geschrieben werden. Die alte bleibt **nicht** lebendig.

### §2.3 Correlation

> **Definition:** Eine ausgewiesene Verbindung zwischen zwei oder mehr
> `runtime_events` (oder Memory-Items), die ein anderer Subsystem-Konsument
> als Hinweis interpretieren soll.

| Property | Wert |
|---|---|
| Struktur | `{from, to, kind, weight ∈ [0,1]}` |
| Decay | relevance-basiert (Policy-Änderungen) |
| Evidence-Pflicht | `from` und `to` MÜSSEN existieren (FK-äquivalent, RFC verlangt es) |
| Default-Retention | `3y` |
| Beispiele | „Event A trigger Event B" · „User-Session X korreliert mit Incident I" |

**Hard-Regel:** Eine Correlation ohne Auflösung beider Enden in
`runtime_events` (Subject-Ref / Trace-ID / Event-ID) ist **invalid**.

### §2.4 Risk Signal

> **Definition:** Eine berechnete Skalar-Größe (Score, Klassifikation), die
> sich pro Run / pro Window neu berechnet. Hat kein eigenes Wahrheits-
> Anspruch, sondern ist ein **Hilfssignal**.

| Property | Wert |
|---|---|
| Veränderlichkeit | temporär — überlebt selten länger als der Run, der sie erzeugt |
| Decay | bei jedem Re-Compute überschrieben (logisch: superseded) |
| Evidence-Pflicht | `derived_from` (wie Inference) |
| Default-Retention | `30d` |
| Beispiele | „Tenant-Health-Score: 72/100" · „Drift-Wahrscheinlichkeit für Domain X: 0.43" |

**Hard-Regel:** Risk Signals MÜSSEN ein `computation_id`-Feld tragen, das
sie an einen konkreten Berechnungs-Run bindet. Risk Signals OHNE
`computation_id` sind illegal.

### §2.5 Klassen-Matrix

| Klasse | Decay-Achsen | Evidence | Default Retention | Replayable |
|---|---|---|---|---|
| Fact | retention only | mandatory | 7y | yes |
| Inference | temporal + confidence | mandatory | 1y | yes |
| Correlation | relevance | mandatory | 3y | yes |
| Risk Signal | overwrite on recompute | mandatory | 30d | **no** |

---

## §3 Decay Policies

### §3.1 Temporal Decay — age-based

| Klasse | Half-Life | Cooling-Schwelle | Archive-Schwelle |
|---|---|---|---|
| Fact | n/a (immutable, kein temporaler Decay) | n/a | n/a |
| Inference | 30 Tage | `freshness < 0.5` | `freshness < 0.2` |
| Correlation | 90 Tage | `freshness < 0.5` | `freshness < 0.2` |
| Risk Signal | 7 Tage (oder bis nächster Re-Compute) | nicht zutreffend | sofort bei Recompute |

Freshness-Formel: `freshness = exp(-age_days / half_life_days)`.

### §3.2 Confidence Decay — bei neuer Evidence

Trigger: ein neues `evidence.created`-Event mit überlappendem
`subject_ref` oder `correlation_id`.

| Vorher | Aktion |
|---|---|
| `confidence ≥ 0.8` | Re-Validation-Job einplanen, Memory bleibt `active` |
| `0.5 ≤ confidence < 0.8` | sofort `cooling`, Re-Validation-Job einplanen |
| `confidence < 0.5` | sofort `archived`, kein Re-Validation |

**Atomicity-Anforderung:** Confidence-Decay MUSS in derselben Transaktion
wie das auslösende Event laufen ODER asynchron mit einem Outbox-Pattern,
das im Memory-Event referenziert wird.

### §3.3 Relevance Decay — bei Policy-Änderung

Trigger: `policy.updated` oder `policy.deactivated` mit Bezug zu Memory-Items.

| Memory-Klasse | Aktion |
|---|---|
| Fact | bleibt — nur Inferenzen werden invalidiert |
| Inference | `relevance` halbieren; falls neu < 0.2 → `archived` |
| Correlation | wenn beide Enden noch relevant → unverändert; sonst archive |
| Risk Signal | sofort recompute oder `purged` |

### §3.4 Incident Resolution Decay — nach Closure

Trigger: `incident.closed`.

| Memory-Klasse | Aktion |
|---|---|
| Fact | wenn `compliance_weight ≥ 0.8` → retention-bound; sonst Decay nach §3.1 wieder aufnehmen |
| Inference | Decay-Timer **resetten** (Fresh state) — der Incident-Hold pausierte ihn |
| Correlation | `cooling` falls keine neuen Events innerhalb 7 Tage |
| Risk Signal | sofort `archived` (für Forensik), nach 30 Tage `purged` |

### §3.5 State-Machine

```text
                ┌─────────────┐ create
                │   active    │ ◀────── insert
                └─────────────┘
                       │ §3.1 oder §3.2
                       ▼
                ┌─────────────┐
                │   cooling   │  (LRU-evict aus In-Prompt-Memory)
                └─────────────┘
                       │ §3.1 / §3.3
                       ▼
                ┌─────────────┐
                │   archived  │  (out-of-prompt, on-demand load)
                └─────────────┘
                       │ retention reached + kein hold
                       ▼
                ┌─────────────┐
                │   expired   │  (read-only marker, kein neuer Read)
                └─────────────┘
                       │ purge-grace ablaufen
                       ▼
                ┌─────────────┐
                │   purged    │  (row deleted; subject_ref bleibt im event-log)
                └─────────────┘
```

Genau **diese fünf States** sind zulässig. Andere States ⇒ Schema-Violation.

---

## §4 Retention Constraints

### §4.1 `regulatory_hold`

Setzt sich aus zwei Quellen zusammen:

1. **DSGVO-Pflichten** — z. B. Buchhaltungsdaten 10 Jahre, AVV-Aufzeichnungen
   3 Jahre.
2. **EU AI Act Art. 12** — Logs für Hochrisiko-Systeme MÜSSEN über die
   Lebenszeit des Systems gehalten werden, mindestens 6 Monate nach
   Außerbetriebnahme.

**Hard-Regel:** Memory mit `regulatory_hold = true` darf den State
`purged` **nie** erreichen, solange das Flag gesetzt ist. Der Decay-Worker
MUSS dies vor dem Purge prüfen.

### §4.2 `incident_hold`

Während ein verbundener Incident den State `open` oder `investigating`
hat, ist Decay **angehalten**. Konkret:

- `expired → purged` blockiert
- `archived → expired` blockiert
- Reads sind weiterhin erlaubt

Trigger zum Aufheben: `incident.closed`-Event mit `correlation_id` =
`memory.correlation_id` oder `memory.derived_from`.

### §4.3 `automated_purge_date`

Wird **beim Insert** berechnet und gespeichert:

```text
automated_purge_date =
    created_at
  + retention_class_to_interval(retention_class)
  + purge_grace_interval(7 days)
```

| `retention_class` | Beitrag |
|---|---|
| `forever` | NULL (kein Purge) |
| `7y` | 7 Jahre |
| `3y` | 3 Jahre |
| `1y` | 1 Jahr |
| `90d` | 90 Tage |
| `30d` | 30 Tage |
| `7d` | 7 Tage |
| `ephemeral` | 0 (sofort purgable nach Grace) |

**Hard-Regel:** Wenn `regulatory_hold = true` ODER `incident_hold = true`,
ist `automated_purge_date` als „advisory" zu behandeln — der Worker
prüft die Holds vor dem Delete unabhängig.

### §4.4 Atomicity mit `subject_ref`

Memory-Purge MUSS atomar mit der zugehörigen DSR-Erasure (siehe
RFC-002 §13.3) laufen, wenn das Memory einen `subject_ref` trägt:

1. `subject_ref_mappings.deletion_requested_at` ist gesetzt
2. Retention-Hold der Mapping ist abgelaufen
3. Es gibt **kein** offenes `incident_hold` auf dem Memory

Erst dann darf der Purge laufen. Die Reihenfolge:
- Memory-Row löschen
- `runtime_events`-Audit-Event `memory.purged` schreiben (T0, replayable=true)
- Mapping erst aktualisieren, wenn alle Memory-Items des Subjects purged sind

---

## §5 Memory Query Performance

### §5.1 Materialized Views (Decay-Snapshots)

Wir definieren zwei Materialized Views (DDL in Folge-Migration):

- **`mv_memory_active_per_tenant`** — eine Zeile pro `(tenant_id, classification, state='active')`,
  enthält Count + summierte Token-Größen. Refresh-Window: 15 min.
- **`mv_memory_decay_candidates`** — Memory-Items, deren
  `automated_purge_date < now() + 1 day` und ohne aktiven Hold. Worker
  liest gegen diese View statt gegen die Haupttabelle. Refresh-Window:
  60 min (oder on-demand vor jedem Decay-Run).

**Begründung:** Decay-Worker dürfen die Hot-Path-Indexe der
Memory-Tabelle nicht degradieren. MVs lassen sich isoliert refreshen und
benötigen keine LIVE-Konsistenz.

### §5.2 Risk Signal Rollup

Risk Signals werden **nicht** klassisch dauerhaft gespeichert — sie sind
overwrite-on-recompute (§2.4). Für historische Auswertung:

- Jeder Recompute schreibt **zusätzlich** ein `risk.signal_computed`
  T1-Event in `runtime_events` (Hash-Chain-geschützt).
- Eine Materialized View `mv_risk_signal_history` aggregiert daraus
  Zeitreihen (1d/7d/30d-Buckets), refresht hourly.
- Der „Live"-Wert für Surfaces kommt **immer** aus dem letzten Insert,
  nie aus der MV — sonst ist die Aussage stale.

### §5.3 Index Strategy

| Query | Index |
|---|---|
| `WHERE tenant_id = ? AND state = 'active'` | `(tenant_id, state, state_transitioned_at DESC)` |
| Decay-Worker: `WHERE automated_purge_date < ? AND state IN (...)` | partial `(automated_purge_date)` WHERE `state IN ('archived','expired')` |
| Subject-bezogene Lookup | `(tenant_id, subject_ref)` partial WHERE `subject_ref IS NOT NULL` |
| Re-Validation: `WHERE derived_from @> ?` | GIN auf `derived_from` (JSONB) |

**Hard-Regel:** Kein Memory-Read in der Hot-Path-Konversations-Schleife
darf länger als 50 ms p99 brauchen. Wird das verletzt, ist das ein
P1-Blocker für jeden weiteren Memory-Feature-PR.

---

## §6 Compliance Semantics

### §6.1 DSGVO Art. 5 — Speicherbegrenzung

| Anforderung | Implementierung |
|---|---|
| Personenbezogene Daten so kurz wie möglich speichern | `automated_purge_date` + Decay-Worker |
| Aufbewahrung an Zweck binden | `classification` bestimmt Default-Retention; `regulatory_hold` markiert Rechtsgrundlage |
| Nachweis der Löschung | `memory.purged`-Event in `runtime_events` (T0, hash-chained) |

### §6.2 EU AI Act — Audit Trail über Decay hinweg

Selbst wenn ein Memory-Item `purged` ist, MUSS folgendes nachvollziehbar
bleiben:

1. **Dass** es existiert hat — über `memory.created`-Event mit Hash-Chain-Anker.
2. **Welche Decisions** auf ihm beruhten — über `derived_from`-Refs in
   Inferenzen / Risk Signals, die das Memory referenziert haben.
3. **Wann** und **warum** es purged wurde — über `memory.purged`-Event.

**Hard-Regel:** Ein Memory-Item, das **je** in eine
governance-relevante Decision eingeflossen ist (z. B. `policy.evaluated`
mit `derived_from` = memory_id), MUSS automatisch `retention_class >= 7y`
und `regulatory_hold = true` bekommen — unabhängig von der ursprünglichen
Default-Retention.

### §6.3 Deletion-Atomicity mit `subject_ref`

Siehe §4.4. Zusätzlich:

- **Cryptographic Erasure** (RFC-002 §13.3) reicht alleine **nicht** für
  Memory-Compliance — die Memory-Row hält oft den Klartext-Kontext.
  Memory muss explizit purged werden.
- **Ausnahme:** Memory-Items, die **ausschließlich** den `subject_ref`
  enthalten (keinen Klartext, keinen Payload, der das Subject identifiziert),
  überleben die Crypto-Erasure ohne Compliance-Risiko, weil sie nach der
  Erasure nicht mehr rückführbar sind.

---

## §7 Integration mit Event Backbone

### §7.1 Memory-Events in `runtime_events`

Jede Memory-State-Transition emittiert ein Event:

| State-Transition | Event-Type | Tier | Severity |
|---|---|---|---|
| `null → active` (insert) | `memory.created` | T1 | `info` |
| `active → cooling` | `memory.cooled` | T2 | `info` |
| `cooling → archived` | `memory.archived` | T1 | `info` |
| `archived → expired` | `memory.expired` | T1 | `info` |
| `expired → purged` | `memory.purged` | T0 | `medium` |
| any → `superseded` | `memory.superseded` | T1 | `info` |
| Confidence-Decay (§3.2) | `memory.confidence_decayed` | T1 | `low` oder `medium` |
| Relevance-Decay (§3.3) | `memory.relevance_decayed` | T1 | `low` |

**Payload-Vertrag** (jedes Memory-Event):

```json
{
  "memory_id": "...",
  "classification": "fact|inference|correlation|risk_signal",
  "subject_ref": "...|null",
  "from_state": "active",
  "to_state": "cooling",
  "trigger": "temporal|confidence|relevance|incident_closure|manual",
  "trigger_event_id": "...|null"
}
```

### §7.2 Evidence Trail der Decays

Jeder Decay-Schritt eines Memory-Items, der eine **governance-relevante**
Inference oder einen Fact betrifft, MUSS einen `evidence.created`-Event
schreiben, der das Vorher/Nachher dokumentiert:

```json
{
  "subject_ref": "...",
  "kind": "memory_decay_snapshot",
  "memory_id": "...",
  "before": { "state": "active", "confidence": 0.82, "relevance": 0.91 },
  "after":  { "state": "cooling", "confidence": 0.41, "relevance": 0.91 },
  "trigger_event_id": "..."
}
```

Damit bleibt selbst nach Purge nachvollziehbar, **warum** das Memory
abgebaut wurde — eine Mindestanforderung des AI-Act für Audit-Trail.

### §7.3 Idempotency bei Re-Computation

Re-Berechnung von Inferenzen / Risk Signals ist **idempotent** auf
Memory-Ebene zu halten:

| Mechanismus | Wirkung |
|---|---|
| `computation_id` auf Risk Signal + neuem Inference-Item | gleicher Wert in einer Re-Compute-Schleife ⇒ Insert wird übersprungen (App-Layer) |
| `idempotency_key` auf `runtime_events.memory.*`-Events | Backbone-Dedup (siehe SPEC-001) — keine doppelten Decay-Audits |
| Outbox-Pattern für Confidence-Decay-Jobs | gleicher Trigger-Event-Id ⇒ Job läuft genau einmal |
| `supersedes_id` statt UPDATE | jede Re-Klassifikation ist ein neuer immutable Row |

**Hard-Regel:** Es ist **niemals** zulässig, ein Memory-Item zu
mutieren, um den Decay-State zu „korrigieren". Stattdessen: neues Item
mit `supersedes_id` schreiben, altes auf `expired`.

---

## §8 Acceptance Criteria

- [ ] Memory-Klassifikation §2.1–§2.4 ist die einzige zugelassene
- [ ] Default-Retention-Tabelle (§2.5) ist normativ — Abweichungen
      brauchen begründete `regulatory_hold`-Entscheidung
- [ ] State-Machine §3.5 — genau die fünf States, kein anderer
- [ ] `automated_purge_date` wird beim Insert berechnet
- [ ] `regulatory_hold` und `incident_hold` blockieren Purge, auch wenn
      `automated_purge_date` abgelaufen ist
- [ ] Purge-Atomicity mit `subject_ref` (§4.4) ist im Worker-Code
      einzeln getestet
- [ ] Memory-Events (§7.1) werden in `runtime_events` geschrieben und
      sind in der Hash-Chain enthalten
- [ ] Decay-Worker liest gegen `mv_memory_decay_candidates`, nicht
      gegen Haupttabelle
- [ ] Re-Computation ist idempotent (§7.3)
- [ ] Compliance-Matrix §6.1 / §6.2 ins `docs/compliance/` verlinkt

---

## §9 Open Questions

1. **Cross-Klassen-Übergänge** — darf eine Inference, nachdem Evidence
   sie bestätigt, zu einem Fact „promoted" werden? Vorschlag: Nein —
   stattdessen neuer Fact mit `derived_from` = alte Inference.
   Re-Klassifikation widerspricht §2 (Klasse ist immutable).

2. **Risk-Signal-Retention auf 7y** — wenn ein Risk Signal einmal in
   eine Decision eingeflossen ist (§6.2 Hard-Regel), bekommt es 7y.
   Spannt das die `30d`-Default-Annahme zu stark? Lösungsskizze:
   nur Risk Signals, die **explizit** referenziert werden, bekommen
   7y; reine Recompute-Outputs sterben nach 30d.

3. **Materialized-View-Refresh vs. Live** — können wir die MVs durch
   `REFRESH MATERIALIZED VIEW CONCURRENTLY` ohne Lese-Lock refreshen?
   Postgres-Limit: braucht UNIQUE-Index auf der MV. Akzeptabel.

4. **Inference-Half-Life pro Domain** — 30 Tage ist Default, aber
   z. B. AI-Risk-Klassifikationen sind regulatorisch volatiler. Wir
   erlauben pro-Domain-Override über `decay_profile_ref` (Spalte in
   `agent_memory` in der Folge-Migration).

5. **Subject-Memory-Index vs. Tenant-Volume** — bei großen Tenants
   wird `(tenant_id, subject_ref)` zum Hot-Spot. Partitionierung
   nach `tenant_id` (Hash) für `agent_memory` evaluieren — separater
   RFC, sobald Volumen > 5 Mio. Rows pro Tenant erreicht.

6. **Replay-Semantik für Memory-Events** — Shadow-Replay (siehe
   Kernel-RFC §P1) darf Memory **nicht** mutieren. Die Memory-
   Events selbst werden im Shadow-Mode in `shadow_runtime_events`
   geschrieben — der State-Worker erkennt das und no-op't den
   Memory-Decay.

---

## §10 Was diese RFC NICHT entscheidet

- ❌ Konkrete Schema-Diffs für `agent_memory` (Kernel-RFC §P3.3 ist Draft,
  Migration folgt separat)
- ❌ Worker-Cron-Frequenz (in Decay-Migration zu setzen)
- ❌ Edge-Function-Verträge für `memory-read` / `memory-write`
- ❌ UI-Surfaces für Memory-Inspector
- ❌ LLM-Prompt-Strategie für `cooling`/`archived`-Memory-Items
