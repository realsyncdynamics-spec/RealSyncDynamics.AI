# RFC: RuntimeEvent Shadow Validation Rollout

**Status:** Proposed
**Author:** Governance Runtime
**Created:** 2026-05-20
**Companion to:** `runtime-event-standard.md`
**Scope:** Documentation only — kein Code, keine Dependencies, kein Runtime-Behavior-Change.

---

## 1. Purpose

Aktuelle Events werden permissiv akzeptiert: `createRuntimeEvent()` füllt Defaults, der Ingest-Endpoint validiert nichts, Konsumenten reden über schwach typisierte Records. Das ist gewollt für Phase 1 (type adoption) — bricht aber, sobald wir strikt werden wollen.

**Append-only Audit-Daten müssen replaybar bleiben.** Wenn wir Validierung später hart einschalten, müssen historische Events weiter gegen ihr historisches Schema lesbar sein — sonst zerbricht die Hash-Chain im Evidence-Vault.

**Zu frühes Ablehnen wäre ein Breaking Behavior Change.** Ein neuer 4xx-Fehler aus dem Ingest-Endpoint bricht Browser-Collectors, AI-Probes und Edge-Sender, die heute Events ohne `spec_version` schicken. Solange wir nicht *wissen*, wie groß der Mismatch-Floor ist, können wir nicht ablehnen.

**Shadow Mode** erlaubt Messung ohne Risiko: jedes Event wird gegen das Schema seiner `spec_version` validiert, aber **niemals abgelehnt** — wir loggen die Mismatches, lassen das Event durch, und werten nach 7–30 Tagen aus, ob striktes Verhalten safe ist.

---

## 2. Definitions

| Term | Bedeutung |
|---|---|
| **RuntimeEvent** | Standard-Envelope für alle Governance-Runtime-Events. Siehe `src/types/runtime-event.ts`. Pflichtfelder: `id`, `spec_version`, `type`, `source`, `severity`, `actor`, `payload`, `review_status`, `created_at`. |
| **`event.spec_version`** | String-Feld im Event-Envelope. Aktuell `'0.1'`. Wird beim Mapping zu `schema_version` 1:1 verwendet. |
| **`schema_version`** | Der String, der das zu nutzende JSON-Schema identifiziert. Identisch zu `event.spec_version`. Schema-Dateien folgen dem Naming `{schema_version}.schema.json`. |
| **Shadow validation** | Event wird gegen Schema geprüft, Ergebnis geloggt, **nicht** abgelehnt. Standard-Verhalten in Phase 2. |
| **Strict validation** | Event wird gegen Schema geprüft, bei Fehlschlag mit HTTP 422 abgelehnt. Erst ab Phase 3, opt-in via Tenant-Flag, ab Phase 4 default. |
| **Validation mismatch** | Ein Event verstößt gegen das Schema seiner `spec_version`. Im Shadow Mode: logged, nicht blockiert. |
| **Tenant flag** | `runtime_event_strict` (`boolean`, Default `false`) pro Tenant. Aktiviert Phase-3-Verhalten für diesen Tenant. |

---

## 3. Schema Versioning Rules

1. **Validator wählt Schema anhand von `event.spec_version`.** Kein "neuestes Schema gewinnt"-Verhalten. Ein Event mit `spec_version='0.1'` wird gegen `0.1.schema.json` validiert, auch wenn `0.2` und `0.3` existieren.
2. **Historische Events werden NIE automatisch gegen neuestes Schema validiert.** Re-Validation gegen ein neueres Schema ist nur ein expliziter Migrations-Schritt — separater PR mit Datensatz-Migration, niemals als Seiteneffekt im Runtime.
3. **Minor Versions (`0.1` → `0.2`) dürfen nur OPTIONALE Felder hinzufügen.** Ein Konsument, der `0.1` versteht, akzeptiert auch ein `0.2`-Event (das nur mehr Felder mitbringt).
4. **Major Versions (`0.x` → `1.0`) dürfen Breaking Requirements einführen.** Felder Pflicht machen, Enums kürzen, Typen ändern. Konsumenten brauchen explizite Major-Bump-Migration.
5. **Alte Events bleiben gegen historisches Schema verifizierbar (append-only).** Schemas werden additiv versioniert; kein `0.1.schema.json` wird je gelöscht oder geändert.

---

## 4. Proposed Schema Location

```
src/schemas/runtime-event/
├── 0.1.schema.json
├── 0.2.schema.json    (zukünftig)
└── README.md
```

- **Pfad:** `src/schemas/runtime-event/{spec_version}.schema.json`
- **Ownership:** Governance Runtime Team (`.github/CODEOWNERS`-Eintrag in der Code-PR ergänzen)
- **Format:** [JSON Schema Draft-07](https://json-schema.org/draft-07/json-schema-release-notes.html) — kompatibel mit AJV, TypeBox, Zod-via-Adapter, Ajv-Flavors
- **Naming Convention:** `{spec_version}.schema.json` (z. B. `0.1.schema.json`)
- **Noch nicht erstellen.** Dieser RFC definiert nur Pfad + Ownership. Die Schemas selbst werden im Code-PR generiert/handgeschrieben.

---

## 5. Shadow Validation Behavior

Für jedes Event, das durch den Validator geht:

1. **RuntimeEvent bauen** — bereits via `createRuntimeEvent()`. Kein Change am Konstruktions-Pfad.
2. **Schema laden** — basierend auf `event.spec_version`. Bei unbekannter Version: `validation_failed` mit `error_paths=['$.spec_version']`, Event passiert weiter.
3. **Validieren** gegen das geladene Schema.
4. **Wenn gültig:** `validation_passed` loggen (kann auf sample-rate gedrosselt werden, z. B. 1%).
5. **Wenn ungültig:** `validation_failed` loggen mit:
   - `event_id`
   - `spec_version`
   - `event_type` (= `event.type`)
   - `source` (= `event.source`)
   - `tenant_id`, `session_id` (wenn vorhanden)
   - `error_paths`: Array von JSON-Pointer-Strings, die im Schema-Output stehen (z. B. `['$.payload.vendor_domain']`)
   - **KEIN** Dump von `event.payload` (PII-Risiko, siehe Sektion 8)
6. **Event NICHT ablehnen.** Kein 4xx, kein Throw.
7. **Event NICHT mutieren.** Validator liest, schreibt nicht.
8. **DB-Write NICHT blockieren.** Wenn der Validator hängt, time-out → durchlassen, separat loggen.

---

## 6. Metrics

Counter-Vorschlag (Implementation im Code-PR — Backend offen):

| Metric | Labels | Bedeutung |
|---|---|---|
| `runtime_event_validation_total` | — | Anzahl aller validierten Events |
| `runtime_event_validation_failed_total` | — | Anzahl Mismatches insgesamt |
| `runtime_event_validation_failed_by_type` | `event_type` | Mismatches pro `RuntimeEventType` |
| `runtime_event_validation_failed_by_source` | `source` | Mismatches pro `RuntimeEventSource` |

**Metrics-Backend:** offen. Kandidaten:
- Supabase Analytics (eigene Tabelle + materialized view)
- PostHog (event-tracking, vorhandene Integration)
- Custom Edge Log → strukturiertes JSON in Function-Logs

Entscheidung im Code-PR — siehe Sektion 9.

---

## 7. Rollout Plan

| Sub-Phase | Was | Aktiv auf | Akzeptanz |
|---|---|---|---|
| **Phase 2a — Unit-only shadow validation** | Validator nur in Vitest-Tests, kein Runtime. Misst welche Test-Events invalid wären gegen das Schema. | Test-Suite | Alle bestehenden Tests bleiben grün; Mismatch-Inventar dokumentiert. |
| **Phase 2b — Runtime shadow validation (non-critical paths)** | Validator läuft auf adoptierten Pfaden (PR #374, #375). Log-only. | `RUNTIME_MOCK_EVENTS_V0`, `DEMO_RUNTIME_EVENTS_V0`, `policyResultToRuntimeEventV0` | 7 Tage ohne crash; Mismatch-Rate dokumentiert. |
| **Phase 2c — Ingest path shadow validation** | Alle eingehenden Events am Ingest-Endpoint werden validiert. Nur Logging, kein Reject. | `governance-event` Edge Function | Mismatch-Log retention 30 Tage; Mismatch-Rate < 1% sustained. |
| **Phase 3 — Tenant-gated strict** | Feature-Flag `runtime_event_strict` pro Tenant. Opt-in. Mismatches → HTTP 422. Erst nach 30 Tagen ohne Mismatches für diesen Tenant. | Tenants mit Flag = `true` | Pilot-Tenant 30 Tage strict ohne 422-Spike. |
| **Phase 4 — Default rejection (nur neue Events)** | Neue Events ohne `spec_version` ablehnen. **Historische Events** (älter als Cutoff-Datum) niemals re-validieren oder ablehnen. Cutoff-Datum wird im Code-PR festgelegt. | Alle Tenants | Phase 3 mindestens 60 Tage stabil. |

**Reihenfolge:** Phase 2a → 2b → 2c → 3 → 4. Phase 2b und 2c dürfen sequenziell oder parallel laufen — siehe Open Question Sektion 9.

---

## 8. Safety Rules

Explizit festgehalten, was im Shadow Mode **NIEMALS** passieren darf:

- ❌ **Kein Reject im Shadow Mode.** Auch nicht "soft reject", "warn-and-continue" mit User-Message — gar nichts.
- ❌ **Keine Validierung historischer Events gegen neuestes Schema.** Wenn ein `0.1`-Event gegen `0.2`-Schema läuft, ist das ein Bug im Validator-Lookup, kein "useful fallback".
- ❌ **Keine DB-Constraints in diesem Rollout.** Keine `CHECK`-Constraints auf `runtime_events.payload`, kein Trigger. Die DB bleibt schema-agnostisch.
- ❌ **Kein PII in Validation-Logs.** `event.payload` wird NICHT in den Mismatch-Log geschrieben. Nur Pointer (`error_paths`), `event_id`, `event_type`, `source`, `tenant_id`. Wer den vollen Payload sehen will, muss separat per `event_id` aus dem Evidence-Vault ziehen — RBAC-geschützt.
- ❌ **Keine Secrets in Payload-Dumps.** Selbst wenn ein Validation-Tool später vollere Logs erlaubt: Secret-Scrubbing-Heuristik (API-Keys, JWTs) muss vor jedem optional verbose-mode laufen.
- ❌ **Kein Abbruch des Event-Flows bei Validierungsfehler.** Validator-Timeout, OOM, Schema-Load-Fail → Event passiert weiter, Validator-Fehler separat loggen.

---

## 9. Open Questions

1. **Validator-Library: AJV vs Zod vs TypeBox?**
   - AJV: klassisches JSON-Schema, weniger TS-native, große Mindshare, Bundle-Size ~50KB
   - Zod: TS-native, kompositional, kein JSON-Schema (Pflicht-Pfad Schema → Zod-Adapter)
   - TypeBox: JSON-Schema-native + TS-Inference, schlankes Bundle, schmalere Community
   - **Entscheidung im Code-PR.** Bevorzugt: Library, die in Browser + Node + Deno läuft.

2. **Schema-Artifact-Location: `src/schemas/` vs standalone package?**
   - `src/schemas/`: simpler, kein neues Package, Edge-Function-Import via Deno-Resolver problematisch (siehe nächste Frage)
   - Standalone `packages/runtime-event-schemas/`: monorepo-style, sauberer Import-Boundary, aber `pnpm`/`turbo`-Setup nötig
   - **Entscheidung im Code-PR.**

3. **Deno Edge Function Import: kann Edge Function `src/schemas/` importieren?**
   - Supabase Edge Functions laufen Deno und resolven `npm:` / `jsr:` / relative Pfade
   - Relative Pfade von `supabase/functions/.../*.ts` zu `src/schemas/*.json` über `../../../src/schemas/...` *müssten* funktionieren, sind aber unüblich
   - Alternative: Schema als JSON in `supabase/functions/_shared/` duplizieren mit Pre-Commit-Check, der Drift verhindert
   - **Entscheidung im Code-PR.**

4. **Metrics-Backend: Supabase Analytics vs PostHog vs custom?**
   - Supabase Analytics: in-house, eine Tabelle (`runtime_event_validation_misses`), Materialized Views
   - PostHog: Track-Event pro Mismatch — gut für Dashboards, aber PII-Sorge bei `tenant_id`-Label
   - Custom: structured-log in Edge-Function-Logs + Log-Forwarder zu SIEM
   - **Entscheidung im Code-PR.**

5. **Mismatch-Log Retention: 7 / 14 / 30 Tage?**
   - 7 Tage: minimal, schnelle Daten-Privacy
   - 14 Tage: Standard für viele Compliance-Tools
   - 30 Tage: gibt Zeit für Monatlich-Roll-Ups und Trending
   - **Vorschlag: 30 Tage** für Phase 2c, 14 Tage ab Phase 3.

6. **Reihenfolge Phase 2b vs 2c: parallele Einführung oder sequenziell?**
   - Sequenziell: 2b liefert Confidence dass der Validator nicht crash't, bevor er an die Ingest-Hot-Path geht
   - Parallel: schneller, aber höheres Crash-Risiko im Ingest
   - **Vorschlag: sequenziell** — 2b für 7 Tage min, dann 2c.

---

## 10. Acceptance Criteria for Moving to Code PR

Ein Code-PR für Shadow Validation darf erst erstellt werden wenn:

- [ ] Dieses RFC reviewed und akzeptiert (mindestens 1 Approver aus Governance Runtime Team)
- [ ] Schema-Pfad (`src/schemas/runtime-event/`) akzeptiert oder Alternative gewählt
- [ ] Validator-Library gewählt (AJV / Zod / TypeBox) — siehe Open Question 1
- [ ] Logging-Format akzeptiert: strukturierter JSON-Log mit Feldern aus Sektion 5; KEIN payload-dump
- [ ] Mindestens 3 adoptierte Pfade bereit für Shadow Validation. Aktuell adoptiert (siehe `runtime-event-standard.md` §7.1):
  - `RUNTIME_MOCK_EVENTS_V0` (#374)
  - `DEMO_RUNTIME_EVENTS_V0` (#374)
  - `policyResultToRuntimeEventV0` (#375)

  ✅ Drei vorhanden, Acceptance erfüllt sobald PRs merged.
- [ ] Deno-Kompatibilität der gewählten Library geklärt (siehe Open Question 3)

---

## Non-Goals (explizit)

- ❌ Keine Validator-Implementation in diesem PR (das ist der Code-PR, der diesem RFC folgt)
- ❌ Keine neue Dependency
- ❌ Kein Ingest-Reject
- ❌ Kein AJV/Zod/TypeBox an Bord
- ❌ Keine DB-Schema-Änderung
- ❌ Keine Cutoff-Datum-Festlegung (gehört in den Code-PR für Phase 4)
- ❌ Keine User-facing-Fehler
