# RFC: Evidence Graph Architecture v0

> **Phase B1 Status:** `src/types/evidence-graph.ts` implementiert. RuntimeEventNode, EvidenceNode, IncidentNode + Factory-Funktionen (`createRuntimeEventNode`, `createEvidenceNode`, `createIncidentNode`, `createEvidenceRelation`) verfügbar. Pure Type-Layer — keine DB-Schreibung, keine Validation. Siehe `src/types/evidence-graph.test.ts` für Vertragstests.

**Status:** Proposed
**Author:** Governance Runtime
**Created:** 2026-05-20
**Companion to:** `runtime-event-standard.md`, `runtime-event-shadow-validation-rfc.md`
**Scope:** Documentation only — kein Code, keine Dependencies, kein DB-Schema, kein Graph-Backend.

---

## 1. Purpose

**Why a graph?** Ein flacher Event-Log beantwortet die Frage *„was ist passiert?"* — er beantwortet aber nicht *„warum ist es passiert?"*, *„welche Findings haben zu welchem Incident geführt?"*, *„welche Policy hat dieses Evidence bewertet?"*, *„wer hat das wann behoben?"*.

Eine Governance-Runtime muss diese Kausal-Ketten **verifizierbar reproduzieren** können — sechs Monate nach dem Vorfall, vor einer Aufsichtsbehörde, mit einer Hash-Chain die Manipulation ausschließt. Das ist nicht „Finding-Storage". Das ist **causal governance history**.

**Schlüssel-Abgrenzung:**

| | Finding Storage | Causal Governance History |
|---|---|---|
| Frage | „welche Findings gibt es?" | „wie entstand dieser Incident aus welchem Trail von Events, Evidence, Policies und Reviews?" |
| Datenmodell | Tabelle | Gerichteter, immutabler Graph |
| Manipulationssicherheit | RLS + Audit-Log | Hash-Chain + supersedes-Pattern |
| Replay | Snapshot der Tabelle | Re-Walk des Graphen zum Zeitpunkt T |

**Verankerung im Standard-Stack:**

- Der Evidence Graph baut **auf** `RuntimeEvent` v0 auf (siehe [`docs/architecture/runtime-event-standard.md`](./runtime-event-standard.md)).
- Jeder Pfad im Graph **startet** an einem `RuntimeEventNode`, der einen `RuntimeEvent` 1:1 verlinkt (nicht dupliziert).
- Shadow-Validation des Events ist Voraussetzung für saubere Graph-Anker (siehe [`runtime-event-shadow-validation-rfc.md`](./runtime-event-shadow-validation-rfc.md)).

---

## 2. Design Principles

1. **Immutable.** Knoten werden **niemals** mutiert nach Erstellung. Keine UPDATE-Statements auf existierende Knoten — keine Ausnahme.
2. **Replayable.** Der vollständige Graph-Zustand kann aus geordneten Events rekonstruiert werden. Wer `created_at` hat, hat den Graph.
3. **Hashable.** Jeder Knoten hat einen content-addressable Hash: `SHA-256(JSON.stringify(node, sorted keys))`, wobei das `hash`-Feld selbst von der Hash-Berechnung **ausgenommen** ist.
4. **Logically first, storage later.** Graph-Semantik wird vor jedem Backend-Commitment definiert. Die Storage-Wahl ist eine separate Entscheidung in Phase D.
5. **Additive only.** Neue Knoten **erweitern** den Graphen — sie überschreiben nichts. Korrekturen passieren via `supersedes`-Kante (siehe §5).

---

## 3. Node Types

Neun Knotentypen. Jeder hat:
- `node_id` (string, unique global)
- `node_type` (string-Literal, siehe unten)
- `tenant_id` (string, Pflicht bei jedem Knoten — keine Cross-Tenant-Knoten)
- `created_at` (ISO-8601-Timestamp)

Diese vier Felder sind in jeder Tabelle implizit, daher in den per-type-Spezifikationen unten nicht wiederholt.

### a) `RuntimeEventNode`

Verpackt einen `RuntimeEvent`; verankert alle anderen Knoten.

| Pflicht | Optional |
|---|---|
| `node_type: 'runtime_event'`, `event_id` (→ `RuntimeEvent.id`) | `spec_version` |

Beschreibung: Eintritts-Knoten in den Graph. Jeder andere Knoten zeigt direkt oder transitiv auf einen `RuntimeEventNode` zurück.

### b) `EvidenceNode`

Ein Stück Evidence, das während eines Governance-Checks gesammelt wurde.

| Pflicht | Optional |
|---|---|
| `node_type: 'evidence'`, `evidence_type` (`'scan_result'\|'policy_match'\|'vendor_response'\|'manual_review'\|'ai_finding'`), `anchored_by` (→ `RuntimeEventNode.node_id`) | `content_hash` (SHA-256 des Roh-Artefakts), `source_ref` (URL oder Pfad), `severity` |

Beschreibung: Konkretes Beweis-Artefakt — DOM-Snapshot, HAR-Frame, KI-Klassifikations-Output, Vendor-Antwort, manueller Review-Eintrag.

### c) `IncidentNode`

Ein Governance-Incident, ausgelöst durch eine oder mehrere Evidence-Knoten.

| Pflicht | Optional |
|---|---|
| `node_type: 'incident'`, `triggered_by[]` (→ `EvidenceNode.node_id[]`) | `title`, `severity`, `status` (`'open'\|'investigating'\|'resolved'\|'closed'`), `detected_by` (Agent oder System) |

Beschreibung: Aggregations-Knoten. Mehrere Evidence-Knoten können zu einem Incident konsolidiert werden.

### d) `PolicyNode`

Eine Policy, die ausgewertet wurde (pass/fail/warning).

| Pflicht | Optional |
|---|---|
| `node_type: 'policy'`, `policy_id`, `policy_version`, `evaluated_against` (→ `EvidenceNode.node_id` oder `RuntimeEventNode.node_id`) | `outcome` (`'pass'\|'fail'\|'warning'\|'skipped'`), `rule_ref` |

Beschreibung: Snapshot einer Policy-Auswertung. Eine Policy kann gegen mehrere Knoten ausgewertet werden — pro Auswertung ein eigener `PolicyNode`.

### e) `VendorNode`

Ein Drittanbieter oder ein KI-Modell, das an einem Event beteiligt war.

| Pflicht | Optional |
|---|---|
| `node_type: 'vendor'`, `vendor_id`, `vendor_name` | `vendor_type` (`'ai_model'\|'saas'\|'api'\|'human'`), `risk_score`, `last_reviewed_at` |

Beschreibung: Repräsentation einer Drittpartei. Wird referenziert von Evidence-Knoten, die mit dem Vendor interagiert haben.

### f) `RemediationNode`

Eine Aktion, die unternommen wurde, um einen Incident zu lösen.

| Pflicht | Optional |
|---|---|
| `node_type: 'remediation'`, `resolves` (→ `IncidentNode.node_id`) | `action_type` (`'automated'\|'manual'\|'deferred'`), `performed_by`, `completed_at`, `outcome_summary` |

Beschreibung: Schließt eine Kausalkette ab — ein Incident hat eine oder mehrere Remediation-Knoten.

### g) `AuditBundleNode`

Eine Sammlung von Knoten, gruppiert für einen formalen Audit-Export.

| Pflicht | Optional |
|---|---|
| `node_type: 'audit_bundle'`, `includes[]` (→ beliebige `node_id[]`) | `bundle_hash`, `export_format` (`'pdf'\|'json'\|'csv'`), `exported_at` |

Beschreibung: Materialisiert einen Audit-Snapshot — z. B. „alle Knoten von Tenant X im Zeitraum Y für Aufsichtsbehörde Z".

### h) `AIModelNode`

Eine spezifische KI-Modell-Version, die in einem Governance-Workflow genutzt wurde.

| Pflicht | Optional |
|---|---|
| `node_type: 'ai_model'`, `model_id`, `model_name`, `model_version` | `provider`, `capability_tags[]`, `risk_classification` (`'low'\|'medium'\|'high'\|'critical'`) |

Beschreibung: Versioned-Modell-Knoten. Wichtig für AI-Act-Klassifikation: welches Modell hat zum Zeitpunkt X welches Finding produziert.

### i) `ConsentNode`

User- oder Tenant-Consent-Eintrag für KI-Nutzung.

| Pflicht | Optional |
|---|---|
| `node_type: 'consent'`, `consent_type` (`'data_processing'\|'ai_inference'\|'audit_access'\|'vendor_sharing'`) | `consented_by`, `expires_at`, `revoked_at`, `legal_basis` |

Beschreibung: DSGVO/AI-Act-Anker. Verknüpft Consent-Entscheidungen mit der Evidence-Kette, in der sie wirken.

---

## 4. Relation Types

Neun Relationstypen. Relationen sind **gerichtet** und **annotated** (nicht namenlose Edges).

| Relation | Source | Target | Beschreibung |
|---|---|---|---|
| `caused_by` | `IncidentNode` | `EvidenceNode` | Incident wurde durch dieses Evidence ausgelöst (Einzel-Anker). |
| `detected_by` | `EvidenceNode` | `AIModelNode` | Evidence wurde durch dieses KI-Modell erkannt. |
| `generated_by` | `EvidenceNode` | `RuntimeEventNode` | Evidence wurde aus diesem RuntimeEvent generiert. |
| `resolved_by` | `IncidentNode` | `RemediationNode` | Incident wurde durch diese Aktion gelöst. |
| `linked_to` | beliebig | beliebig | Generische bidirektionale Assoziation. **Sparsam einsetzen** — wer immer `linked_to` nutzt, hat das Modell nicht verstanden. |
| `anchored_by` | `EvidenceNode` | `RuntimeEventNode` | Evidence ist an dieses RuntimeEvent verankert (Pflicht-Kante; vgl. §3b `anchored_by`-Feld). |
| `triggered_by` | `IncidentNode` | `EvidenceNode[]` | Incident wurde durch diese Evidence-Knoten ausgelöst (Mehrfach-Anker, vgl. §3c `triggered_by[]`-Feld). |
| `supersedes` | beliebig | beliebig | Neuer Knoten ersetzt einen logisch veralteten Knoten — der alte Knoten wird **NICHT gelöscht**. |
| `related_to` | `PolicyNode` | `IncidentNode` | Policy-Auswertung steht in Zusammenhang mit diesem Incident. |

Hinweis zur Doppel-Modellierung `anchored_by` / `triggered_by`: Beide existieren als Knoten-Feld (siehe §3) UND als explizite Kante (siehe §4). Beim Materialisieren in einem Storage-Backend (Phase D) wird das harmonisiert — die Kante ist die kanonische Darstellung; das Knoten-Feld ist eine Denormalisierung für schnelle Read-Pfade.

---

## 5. Immutability & Replay Contract

**Kernregeln — keine Ausnahmen:**

1. **Knoten werden niemals geändert oder gelöscht.** Kein `UPDATE` auf existierende `node_id`. Kein `DELETE`.
2. **Korrekturen erzeugen einen neuen Knoten** mit Kante `supersedes → old_node_id`. Beide Knoten leben in der Datenbank weiter — Konsumenten filtern via „letzter Knoten in der supersedes-Kette".
3. **Graph-Zustand zum Zeitpunkt T** = alle Knoten mit `created_at ≤ T`. Punkt.
4. **Replay** = alle Knoten in `created_at`-Reihenfolge re-lesen und ggf. supersedes-Resolved aufbauen.

**Hash-Berechnung:**

```
node.hash = SHA-256(canonical_json(node, sorted keys, excluding "hash" field))
```

- Canonical JSON: rekursiv sortierte Keys, keine Whitespace-Differenzen, `undefined`-Felder gedroppt, non-finite Numbers abgelehnt.
- `hash`-Feld wird vor der Berechnung temporär entfernt — sonst zirkulärer Bezug.

**Warum das matters:**

| Use-case | Warum Immutability nötig |
|---|---|
| Forensik | Aufsicht fragt: „was hat das System um 14:32 gewusst?" → Replay zum Zeitpunkt T |
| Regulatorische Compliance | DSGVO Art. 30 / AI Act Art. 12 fordern *„aufzeichnen, was passiert ist"*, nicht *„aufzeichnen, was wir jetzt davon halten"* |
| Drift-Detection | Vergleich `state_at(T-30d)` ↔ `state_at(T)` ist nur möglich wenn niemand zwischen T-30d und T mutiert hat |

---

## 6. Relation to RuntimeEvent v0

- `RuntimeEventNode` ist die **1:1-Wrapper-Hülle** um einen `RuntimeEvent`. Felder werden **nicht dupliziert** — nur `event_id` wird im Knoten gespeichert.
- **Jeder Pfad im Graph startet an einem `RuntimeEventNode`.** Ein Knoten, der nicht (transitiv) auf einen RuntimeEvent zeigt, ist ein Modell-Bug.
- Referenz: `src/types/runtime-event.ts` (`spec_version='0.1'`).
- **`src/core/runtime/governanceEvents.ts` ist NICHT Teil dieses Graphen.** Diese Datei ist als „frozen Phase A" markiert (Doku-Notice „BREAKING change to evidence trail"); ihre Konvergenz mit dem v0-Standard wird in einer eigenen ADR adressiert. Bis dahin: keine Kreuzreferenzen aus dem Evidence Graph dorthin.

---

## 7. Storage Candidates (non-prescriptive)

**Keine Entscheidung in diesem RFC.** Diese Sektion listet die Optionen, die in einer separaten Phase-D-RFC ausgewertet werden.

a) **Flat JSON files (dev/test only).** Schnell für Prototypen, kein Concurrent-Write-Modell, keine Indexierung. Akzeptabel für Test-Fixtures.

b) **Supabase Postgres mit JSONB-Spalten (most pragmatic for current stack).** Eine Tabelle pro Node-Typ oder ein generisches `evidence_graph_nodes(node_type, payload jsonb, ...)`. RLS pro Tenant. Existierender Stack — kein neues Service-Setup nötig.

c) **Postgres + `pg_graphql`.** Erlaubt GraphQL-Queries direkt auf Postgres-Schema. Erspart eine eigene Query-Layer, fügt aber Tooling-Komplexität hinzu.

d) **Dedicated Graph DB (Neo4j, Memgraph).** Nur sinnvoll, wenn die Query-Patterns (z. B. „finde alle Pfade Länge ≤ 4 von Incident X zu RuntimeEvent Y") in Postgres-Recursive-CTEs nicht performant lösbar sind. **Heute keine Evidenz, dass das so ist.**

e) **Event-sourced append-only table (preferred for immutability guarantee).** Eine globale, append-only-Tabelle `evidence_graph_events` mit einer Zeile pro Knoten-Erstellung, plus Materialized Views für aktuelle Adjacency. Maximale Immutability-Garantie, höhere Query-Komplexität für Read-Pfade.

**Hinweis:** Storage-Entscheidung deferred zu Phase B implementation RFC.

---

## 8. Phase Rollout Plan

| Phase | Was | Status |
|---|---|---|
| **Phase A — RFC** | Dieses Dokument. Reviewed und akzeptiert. Kein Code. | **JETZT** |
| **Phase B1** | `RuntimeEventNode`-Wrapper-Type in TypeScript. `EvidenceNode`-Type. Basic `anchored_by`-Relation. Voraussetzung: PRs #373–#376 gemerged. | geplant |
| **Phase B2** | `IncidentNode` + `PolicyNode`. Relationen `caused_by`, `detected_by`. Integration mit `policyResultToRuntimeEventV0()` (PR #375). | geplant |
| **Phase C** | Vollständige Node-Type-Library (alle 9 Typen + alle 9 Relations). Graph-Query-Helpers (keine externe Dependency). `AuditBundleNode`-Export. | geplant |
| **Phase D** | Storage-Implementation (Backend gewählt). Replay-Validation. Drift-Detection über Time-Window. | geplant |

**Zwischen-Phasen-Verträge:**

- Phase B1 darf ohne Storage-Layer existieren (TypeScript-Types + In-Memory-Helper reichen für Tests).
- Phase B2 setzt auf Phase B1 auf — Edges zwischen den vorhandenen Typen.
- Phase C ist die Feature-Vollständigkeit — danach gibt es keine neuen Node/Relation-Typen ohne RFC-Bump auf v0.2.
- Phase D ist die Persistenz-Entscheidung.

---

## 9. Open Questions

1. **`node_id` — UUID v4 oder content-addressable Hash?**
   UUID v4: einfacher, deterministisch ID-vergebbar vor Knoten-Build.
   Content-Hash: stärkere Immutability-Garantie („gleicher Knoten → gleiche ID"), aber re-keying bei Korrekturen.
   **Vorschlag:** UUID v4 für ID, separates `hash`-Feld für content-Verifikation.

2. **Relationen first-class Nodes oder Edge-Metadaten?**
   Variante A: jede Relation ist eine eigene Tabellenzeile (`(source_id, target_id, relation_type, created_at)`).
   Variante B: Relationen sind Felder am Source-Knoten (z. B. `IncidentNode.triggered_by[]`).
   **Tradeoff:** Variante B ist schneller zu lesen, Variante A erlaubt Annotations auf der Relation selbst.

3. **Cross-Tenant-Graph-Queries für Multi-Tenant-Audits?**
   Aufsichtsbehörden brauchen u. U. Cross-Tenant-Sicht (z. B. „alle Vendor-Knoten für 'openai' über alle Tenants"). Wie regeln wir das ohne RLS-Bruch?
   **Vorschlag:** dedizierte `audit_super_role` mit separater RLS-Policy, nur Read-Only, Audit-Log pro Query.

4. **Maximale Graph-Tiefe vor Performance-Degradation?**
   Recursive-CTE in Postgres ist O(tiefe × kanten). Bei einem Incident, der über 6 Months 20 Remediations + 50 Evidence-Knoten + 12 Policy-Knoten sammelt, wird die Pfad-Suche teuer.
   **Vorschlag:** materialisierte Adjacency-Views, max-depth-Parameter in jeder Query.

5. **`ConsentNode` in-graph oder separates Consent-Ledger?**
   In-graph: einheitliche Daten-Sicht, einfacher Audit-Bundle-Export.
   Separates Ledger: kleinere Graph-Tabellen, klarere DSGVO-Verantwortlichkeit, evtl. eigener Retention-Cycle.
   **Vorschlag:** in-graph als `ConsentNode`, aber mit ABBYY-Style-Pointer auf einen Backend-Consent-Ledger, falls eine Trennung später nötig wird.

---

## 10. Acceptance Criteria

- [ ] Alle 9 Node-Typen dokumentiert mit Required/Optional-Feldern
- [ ] Alle 9 Relation-Typen dokumentiert mit Source/Target-Constraints
- [ ] Immutability-Contract definiert (keine Mutationen, `supersedes`-Pattern)
- [ ] Replay-Contract definiert
- [ ] Beziehung zu RuntimeEvent v0 dokumentiert
- [ ] Storage-Kandidaten gelistet (non-prescriptive)
- [ ] Phase-Rollout-Plan definiert
- [ ] **Keine Code-Änderungen** in diesem PR
- [ ] `npm run lint` passt (Markdown-Lint, falls konfiguriert)
- [ ] PR-Beschreibung enthält Node-Type-Summary-Tabelle

---

## Non-Goals (explizit)

- ❌ Keine TypeScript-Datei in diesem PR
- ❌ Kein Schema-File (`.json`, `.sql`)
- ❌ Keine neue Dependency
- ❌ Keine Festlegung auf Neo4j / Memgraph / einen spezifischen Graph-DB als „die" Lösung
- ❌ Kein Eingriff in `src/core/runtime/governanceEvents.ts`
- ❌ Kein AJV / Zod
- ❌ Keine API-Definition für Graph-Queries
- ❌ Keine UI-Mockups für Graph-Visualisierung
