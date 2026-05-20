# RFC: EvidenceBundleBuilder v0

**Status:** Proposed
**Owner:** Governance Runtime
**Created:** 2026-05-20
**Companion to:** [`evidence-graph-rfc.md`](./evidence-graph-rfc.md), [`runtime-event-standard.md`](./runtime-event-standard.md)
**Scope:** Documentation only — kein Code, keine Dependencies, kein DB-Schema, kein PDF-Renderer.

---

## 1. Purpose

**Was löst der EvidenceBundleBuilder?**

Der Evidence Graph (siehe [`evidence-graph-rfc.md`](./evidence-graph-rfc.md)) speichert die kausale Governance-History — Nodes, Relations, immutability, supersedes-Pattern. Das ist die **Quelle** der Wahrheit, kein lieferbares Produkt.

Der **EvidenceBundleBuilder** liest aus diesem Graphen und erzeugt strukturierte, exportierbare, manipulationssichere Bündel für die externe Nutzung. Er ist die **Brücke zwischen dem Evidence Graph und monetisierbaren Outputs**.

### Abgrenzung: Bundle ≠ Raw Export

| Raw DB Export | EvidenceBundle |
|---|---|
| Tabellen-Dump | Semantisch strukturiertes Dokument |
| Keine Reihenfolge-Garantie | Traversal in `created_at`-Order |
| Kein Hash-Anker | Hash-Chain von Leaf zu Root |
| Kein Zweck-Kontext | Explicit `bundle_purpose` (ai-act-proof / dsgvo-audit / incident-report) |
| Nicht manipulationssicher | Tamper-evident via Hash-Chain |
| Schema-Drift möglich | `spec_version`-Anker |

### Use-Cases

- **AI-Act Compliance Proof** — Aufsicht fragt: „Welcher Stand zum Zeitpunkt X?" → Bundle mit `bundle_purpose='ai-act-proof'`, `anchor_root` = AIModelNode-Version, traversiert nur AI-relevante Pfade
- **DSGVO DSB-Audit-Paket** — DSB will Bundle aller Incidents im letzten Quartal → Multi-Incident-Bundle als AuditBundleNode-Composite
- **Insurance Incident Report** — Versicherung fragt nach Beweis-Paket zu einem konkreten Vorfall → IncidentNode als anchor_root, Traversal zu allen verbundenen Evidence/Remediation/Policy-Knoten
- **Regulatorischer Replay** — „Zeige uns den Zustand am 12. März 14:32" → Builder filtert nodes mit `created_at <= T`, baut Bundle vom Snapshot
- **Automated Periodic Audit Export** — Monatliches Bundle aller High-Severity-Incidents als JSON für Compliance-Archiv

---

## 2. Design Principles

1. **Read-only.** Der Builder schreibt **niemals** in den Graph. Kein UPDATE, kein INSERT, kein DELETE. Selbst wenn `AuditBundleNode` als Ergebnis in den Graph zurückgeschrieben wird (Phase C2), tut das eine **separate** Schreib-API — nicht der Builder.
2. **Deterministisch.** Gleicher Graph-Zustand + gleiche Builder-Options → gleiches Bundle, byte-für-byte. Inklusive `bundle_id`-Vergabe? Nein — `bundle_id` ist `egn_<uuid>`, also bewusst nicht-deterministisch. Aber `bundle_hash` ist es.
3. **Tamper-evident.** Jedes Bundle enthält eine `hash_chain` von den Blatt-Knoten zur Wurzel. Wer einen Knoten manipuliert, bricht die Chain — ein Verifier erkennt das ohne DB-Zugriff.
4. **Export-Format-agnostisch.** JSON ist kanonisch. PDF und CSV sind **abgeleitete Sichten** auf das JSON, kein eigenes Quell-Format.
5. **Append-only safe.** Bundles sind Point-in-Time-Snapshots (`created_at` markiert den Schnitt-Zeitpunkt). Spätere Events erweitern den Graph, **überschreiben** aber nichts im Bundle. Wer ein altes Bundle re-rendert, muss `created_at` als Filter respektieren.
6. **Composable.** Ein Bundle kann andere Bundles referenzieren — siehe `AuditBundleNode.includes` (Evidence-Graph-RFC § 3g). Ein quarterly-Audit kann monthly-Bundles aggregieren ohne Duplikation der Source-Knoten.

---

## 3. Bundle Structure

Output-Shape des Builders:

```ts
EvidenceBundle {
  bundle_id: string                    // egn_ prefixed
  spec_version: '0.1'
  tenant_id?: string
  created_at: string                   // ISO-8601, point-in-time
  anchor_root: EvidenceGraphNodeId     // root node of the traversal
  nodes: EvidenceGraphNode[]           // all nodes in traversal order
  relations: EvidenceRelation[]        // all relations between included nodes
  hash_chain: HashChainEntry[]         // content_hash per node in order
  export_format: 'json'                // canonical; pdf/csv are derived
  metadata: BundleMetadata
}

BundleMetadata {
  traversal_depth: number
  node_count: number
  relation_count: number
  earliest_event: string               // ISO-8601
  latest_event: string                 // ISO-8601
  bundle_purpose?: string              // e.g. 'ai-act-proof' | 'dsgvo-audit' | 'incident-report'
}

HashChainEntry {
  node_id: EvidenceGraphNodeId
  content_hash: string                 // SHA-256 of canonical JSON
  predecessor_hash?: string            // hash of previous entry
}
```

### Feld-Verträge

| Feld | Pflicht | Erläuterung |
|---|---|---|
| `bundle_id` | ✓ | `egn_<uuid>` — neue ID pro Build-Run. KEIN content-addressable Hash (das ist `bundle_hash` separat, wenn benötigt) |
| `spec_version` | ✓ | `'0.1'` hardcoded. Bumps folgen Evidence-Graph-RFC § 3 Versioning-Regeln |
| `tenant_id` | empfohlen | Nur weglassen bei cross-tenant-Bundles für Aufsichtsbehörden (separate Privileg-Surface, nicht Default) |
| `created_at` | ✓ | Zeitpunkt des Build-Laufs, nicht des spätesten Event |
| `anchor_root` | ✓ | Start-Knoten der Traversierung |
| `nodes` | ✓ | Alle besuchten Knoten in `created_at`-Order |
| `relations` | ✓ | Alle Kanten zwischen `nodes` (transitiv vollständig) |
| `hash_chain` | ✓ | Längeneinheitlich zu `nodes.length`, jeder Eintrag deckt ein Node ab |
| `metadata.earliest_event` / `metadata.latest_event` | ✓ | Min/Max von `nodes[].created_at` |
| `bundle_purpose` | optional | Maschinenlesbar für Filter/Routing — Konvention: lowercase-kebab-case |

---

## 4. Builder Interface (planned, not implemented)

TypeScript-Pseudocode der **geplanten** Phase-C1-API — wird **nicht** in diesem RFC-PR implementiert:

```ts
// Planned — not implemented in this PR
interface EvidenceBundleBuilderOptions {
  anchor_root: EvidenceGraphNodeId;    // start traversal here
  tenant_id?: string;
  max_depth?: number;                  // default: 10
  include_relations?: EvidenceRelationType[];  // default: all
  bundle_purpose?: string;
}

interface EvidenceBundleBuilder {
  build(options: EvidenceBundleBuilderOptions): Promise<EvidenceBundle>;
  verify(bundle: EvidenceBundle): VerificationResult;
  export(bundle: EvidenceBundle, format: 'json' | 'pdf-ready'): string;
}

interface VerificationResult {
  ok: boolean;
  broken_hash_indices: number[];       // indices into hash_chain that don't match
  reason?: string;
}
```

**Wichtige Verträge:**

- `build()` ist **READ-ONLY**. Liest aus dem Graph-Store (Backend-Wahl gemäß [`evidence-graph-rfc.md`](./evidence-graph-rfc.md) § 7). Schreibt nicht.
- `verify()` ist **OFFLINE**. Kein DB-Roundtrip — rein über das übergebene Bundle. Erlaubt Audit-Verifikation ohne Quell-System-Zugriff.
- `export()` ist **DETERMINISTISCH**. Gleiches Bundle → gleicher String, byte-für-byte.

---

## 5. Hash Chain Algorithm

### Schritte

1. **Traversierung** der `nodes` in `created_at`-Order (earliest first). Bei Tie-Break (gleiches `created_at`): `node_id`-lexikographisch.
2. **Canonical JSON** pro Node: `JSON.stringify(node, sorted_keys, excluding content_hash field)`. Rekursive Key-Sortierung, `undefined`-Felder gedroppt, non-finite Numbers abgelehnt.
3. **`content_hash`** = `SHA-256(canonical_json)`. Hex-encoded, lowercase, 64 chars.
4. **`predecessor_hash`** = `content_hash` des vorherigen `HashChainEntry`. Für das erste Element `undefined`.
5. **Bundle Root Hash** (optional, in Metadata oder als separates Feld) = `SHA-256(content_hash_1 || content_hash_2 || ... || content_hash_n)`. Erlaubt single-string-Vergleich für Audit-Vergleiche.

### Warum diese Konstruktion

| Eigenschaft | Wie sie erreicht wird |
|---|---|
| **Manipulation einzelner Knoten** wird erkannt | Verändertes Node → neuer `content_hash` → bricht `predecessor_hash` des Folge-Eintrags |
| **Reihenfolge-Manipulation** wird erkannt | Tausch zweier Knoten → bricht beide `predecessor_hash` |
| **Hinzufügen** eines Knotens wird erkannt | Bundle hat fixe `node_count` in Metadata → Längen-Mismatch |
| **Verifier braucht keine DB** | Alle Hashes im Bundle selbst; `verify()` arbeitet rein lokal |
| **Schema-Drift wird erkannt** | `spec_version` ist Teil des canonical JSON → Bump bricht alle Hashes |

### Was NICHT geleistet wird

- ❌ **Authentication des Bundles** (von wem signiert): das ist eine separate Layer — RFC 3161 / in-house Signaturen kommen in Phase D, nicht hier
- ❌ **Cross-Bundle-Integrität** (welches Bundle ist „älter"): externer Trust-Anker nötig (z. B. Timestamp-Server)
- ❌ **Confidentiality**: Hashes verraten Existenz, nicht Inhalt — aber Bundles selbst enthalten Klartext der Nodes

---

## 6. Export Formats

### JSON (canonical)

- Volles `EvidenceBundle` als strukturiertes JSON.
- Maschinen-lesbar.
- Geeignet für API-Transfer, Archivierung, automatisierten Replay.
- Filename-Konvention: `evidence-bundle-{bundle_id}-{YYYY-MM-DD}.json`

### PDF-ready JSON

- Identische Struktur wie JSON, plus optionales Feld `display_hints` pro Node:
  ```json
  {
    "node_id": "egn_...",
    "node_type": "incident",
    "display_hints": { "label": "Pre-Consent Tracker", "icon": "alert", "color": "amber" },
    ...
  }
  ```
- Ein nachgelagerter PDF-Renderer konsumiert das ohne Domain-Wissen.
- **Keine PDF-Generierung in diesem RFC** — nur das Format-Vertrag.

### CSV (planned)

- Flache Tabelle der Events mit Spalten: `node_id`, `node_type`, `event_type`, `severity`, `created_at`, `content_hash`.
- Für Spreadsheet-Audits, Pivot-Tables, schnelle Sortierung.
- Verliert Graph-Struktur (Relations gehen verloren) — nur als sekundäre Sicht gedacht.

---

## 7. Phase Rollout

| Phase | Deliverable | Status |
|---|---|---|
| **Phase B1 — Typed Evidence Layer** | `EvidenceGraphNode`-Types existieren (RuntimeEventNode, EvidenceNode, IncidentNode), keine Builder | ✅ implementiert (PR #379) |
| **Phase C1 — Builder MVP** | `EvidenceBundleBuilder.build()` für RuntimeEventNode + EvidenceNode-Chain. JSON-Export. Kein PDF. Test: 1 RuntimeEventNode + 1 EvidenceNode → valides Bundle mit korrekter Hash-Chain | planned |
| **Phase C2 — Incident + Remediation** | IncidentNode + RemediationNode in Traversierung. `bundle_purpose`-Routing. `AuditBundleNode`-Creation (schreibt **als neues Node** in den Graph zurück; nicht der Builder, sondern eine separate Write-API) | planned |
| **Phase D — Verify + Export + Schedule** | PDF-ready-Export. CSV-Export. `verify()`-API. Periodischer automatisierter Export (cron-Trigger) | planned |

**Akzeptanz zwischen Phasen:**

- C1 → C2: build() für Anchor-Chain mit 2 Knoten + Hash-Chain-Verifikation grün
- C2 → D: end-to-end Incident-Bundle mit ≥ 3 Knoten-Typen + JSON-Roundtrip-Test bestanden
- D ready: PDF-Renderer prototypisch + Periodic-Cron auf 1 Demo-Tenant 7 Tage stabil

---

## 8. Acceptance Criteria

- [ ] `EvidenceBundle`-Struktur dokumentiert mit allen Pflichtfeldern
- [ ] Hash-Chain-Algorithmus Schritt-für-Schritt beschrieben
- [ ] Builder-Interface als Pseudocode dokumentiert (nicht implementiert)
- [ ] Export-Formate aufgelistet (json, pdf-ready, csv)
- [ ] Phase-Rollout-Plan definiert (B1 → C1 → C2 → D)
- [ ] **Read-only-Vertrag** explizit festgehalten
- [ ] **Keine Code-Änderungen** in diesem PR
- [ ] `npm run lint` + `npm test` + `npm run build` grün

---

## Open Questions

1. **`bundle_hash` als separates Top-Level-Feld oder nur in Metadata?** Argument für Top-Level: schneller Vergleich. Argument gegen: redundant zu letztem `hash_chain[n].content_hash` plus Concatenation. Vorschlag: Phase C1 ohne, Phase D ergänzt wenn echter Bedarf entsteht.

2. **Cycle-Detection im Traversal-Algorithmus?** Der Evidence-Graph erlaubt theoretisch Zyklen (`supersedes`-Kanten, `linked_to`). Vorschlag: `visited`-Set + `max_depth` als Hard-Stop. Detail in Phase C1.

3. **`bundle_purpose` als String-Enum oder Free-Form?** Free-Form ist flexibler, Enum ist linterbar. Vorschlag: Free-Form mit dokumentierter Konvention (siehe § 3) und optionalem `display_hints`-Mapping in Phase D.

4. **PDF-ready `display_hints` — wer pflegt das Mapping?** Pro Node-Type ein Standard-Hint, oder pro Use-Case (ai-act-proof vs. dsgvo-audit)? Vorschlag: per-Node-Type-Default, Use-Case-Override optional in Builder-Options.

5. **Signierte Bundles (Phase D+)?** RFC 3161 vs. in-house Ed25519 vs. AWS KMS — separate ADR.

---

## Non-Goals (explizit)

- ❌ Keine Implementation in diesem PR
- ❌ Keine Library-Wahl für JSON-Schema-Validation (das ist [`runtime-event-shadow-validation-rfc.md`](./runtime-event-shadow-validation-rfc.md) Thema)
- ❌ Keine PDF-Engine-Wahl
- ❌ Keine Verträge mit Aufsichtsbehörden über Bundle-Formate (separate Sales-Diskussion)
- ❌ Kein Anfassen von `src/core/runtime/governanceEvents.ts` (frozen)
- ❌ Keine neue Dependency
- ❌ Keine DB-Schema-Änderung
