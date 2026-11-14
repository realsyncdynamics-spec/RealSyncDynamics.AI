# /ap3-policy-ssot — Session-Auftrag

> **Stand:** 2026-11-02 · gemessen gegen `main@abdef53` (Klon, nur gelesen) · **Status: freigegeben.**
> **E-AP0–E-AP4 entschieden am 2026-11-02 (Dominik Steiner): alle wie empfohlen** (§3).
> Schließt O6 aus `.claude/os-funnel/governed-evolution.md`. Voraussetzung für Governed Evolution (E-GE7) und für O4.
> Ersetzt den rekonstruierten Entwurf vom 2026-11-01 (#2127, erster Commit). Maßgeblich ist diese Fassung.

Du arbeitest an **AP-3: `governance_policies` als Tenant-SSoT mit adressierbaren Versionen.**
Pro Teilpaket genau ein Branch, ein PR. Argument: `3a` | `3b` | `3c` | `3d`. Ohne Argument: stopp und nachfragen.

---

## 1. Ziel

Jede Mandanten-Policy hat eine **Versionsnummer**. Jede Änderung, auch die Anlage, erzeugt eine **unveränderliche Revision** mit Auslöser und Quelle. Der Policy-Satz eines Mandanten ist zu jedem Änderungszeitpunkt als **Snapshot** adressierbar. Damit kann ein Vorschlag später als Diff gegen eine Version formuliert, simuliert (E-GE6) und belegt werden.

**Nicht Ziel:** Evolution-Signale, Vorschläge (`kind = 'policy_change'`, E-GE8), Replay, UI, neue Policy-Typen, Änderungen an Policy-Packs-Inhalten, Preise oder Claims.

---

## 2. Ist-Befund (`main@abdef53`)

| # | Befund | Beleg | Konsequenz |
|---|---|---|---|
| **F1** | AP-1a, AP-1b, AP-1c, AP-1d und AP-2 sind **nirgends definiert**. Sie stehen nur als Namen in `PLAN.md` §4 (Z. 205 f.). Kein Auftrag, kein Branch, kein Dokument. | `grep -rn "AP-1a\|AP-2"` → nur `PLAN.md` | Entschieden über **E-AP0** |
| **F2** | Die PDP kompiliert aus **zwei** Quellen: `ai_policies` (Mandant **und** global, `tenant_id IS NULL`) und `governance_policies` (nur Mandant). | `supabase/functions/_shared/pdp/decide.ts` Z. 68–86 | Entschieden über **E-AP1** |
| **F3** | `ai_policies` hat im Code **keinen Schreiber**. Zeilen entstehen nur per Seed in `20260510_ai_governance_core.sql`. Ob es Mandantenzeilen in Produktion gibt, ist **nicht gemessen**. | `grep` auf `from('ai_policies')`: nur Lesezugriffe | In 3a: eine lesende Abfrage (Anzahl je `tenant_id IS NULL`) mit GO |
| **F4** | Vier Schreibwege für `governance_policies`, keiner vergibt eine Version, keiner schreibt Evidence: `governance-resources` (anlegen, ein/aus, ändern; nur `audit()`), `provision-tenant` (Klon aus Vorlage), `policy-packs` (Einfügen, `condition` ändern; `audit()`), Migrations-Seeds. | `governance-resources/index.ts` Z. 277/310/351, `provision-tenant/index.ts` Z. 224, `policy-packs/index.ts` Z. 84/95 | Ein gemeinsamer Schreibpfad (3c) und ein DB-Trigger als Rückhalt (3b) |
| **F5** | `governance_policy_versions` sichert den **alten** Stand nach UPDATE/DELETE, nicht bei INSERT, ohne Versionsnummer, ohne Auslöser. Der Trigger deckt auch `governance_assets` ab. **Kein Code liest die Tabelle.** | `20260620000004_governance_policy_versions.sql` Z. 36 f.; `grep` in `src/`, `shared/`, `supabase/functions/`, `test/` leer | Entschieden über **E-AP2** |
| **F6** | `policy_snapshots.version` ist ein FNV-1a-Inhaltshash über die kompilierten Policies (`core.ts` Z. 293 ff.) und wird **nur beim Entscheiden** persistiert (`decide.ts` Z. 99 ff.). Eine Änderung ohne nachfolgende Entscheidung hat keinen Snapshot. | `_shared/pdp/core.ts`, `_shared/pdp/decide.ts` | Entschieden über **E-AP3** |
| **F7** | Zwei Auswerter lesen dieselbe Tabelle: die Alt-Engine (`governance-ingest` → `_shared/policyEngine.ts`) und die PDP v2 (Shadow-Vergleich). | `governance-ingest/index.ts` Z. 212, `pdp_shadow_log` | AP-3 ändert **keine** Auswertung, nur Speicherung und Versionierung |
| **F8** | ADR 0010 und `docs/specs/governed-self-evolution/*` verlangen `policy_version` in `GovernanceDecision` (`DOMAIN_CONTRACTS.md` Z. ~151). `.claude/os-funnel/governed-evolution.md` verweist auf **keines** der beiden. | `docs/adr/0010-native-evolution-governance.md`, `docs/specs/governed-self-evolution/` | Entschieden über **E-AP4** |
| **F9** | `docs/` ist budgetiert (`.claude/context-budget.json`). | B10 im PLAN | Kein neues Dokument unter `docs/`; Auftrag und Notizen unter `.claude/` |
| **F10** | `GOVERNANCE_BOUNDARY_SPEC.md` erlaubt mandantenübergreifendes Lernen, wenn es „explizit klassifiziert und autorisiert“ ist (Z. 203; ähnlich `EVIDENCE_AND_AUDIT_REQUIREMENTS.md` Z. 56). E-GE5 (2026-11-01, in #2126) **schließt es aus**, auch anonymisiert. Nach E-AP4 führen die Specs die Verträge — hier widersprechen sie einer Owner-Entscheidung. | `docs/specs/governed-self-evolution/GOVERNANCE_BOUNDARY_SPEC.md` Z. 203 | In 3a nach Merge von #2126: Spec-Satz auf E-GE5 einengen (ändern, nicht vergrößern; Budget prüfen) |
| **F11** | `persistSnapshot` ist **Best-effort** (Fehler werden nur geloggt) und der Snapshot kommt aus einem Instanz-Cache mit 30 s TTL (`PDP_CACHE_TTL_MS`). Für Snapshot-beim-Schreiben reicht das nicht: ein Cache-Treffer kann den Stand **vor** der Änderung liefern, ein stiller Fehler hinterlässt eine Revision ohne Snapshot. | `_shared/pdp/decide.ts` Z. 33, 63 ff., 99 ff. | Regeln für 3d (§4) |

---

## 3. Owner-Entscheidungen

**Entschieden am 2026-11-02 (Dominik Steiner): alle wie empfohlen.**

| ID | Frage | Entscheidung | Begründung |
|---|---|---|---|
| **E-AP0** | Gilt die Reihenfolge AP-1a → … → AP-3 noch? | ✅ **AP-3 eigenständig freigegeben.** AP-1a bis AP-2 werden im PLAN als „nicht beauftragt“ geführt. | Eine Abhängigkeit von Paketen ohne Inhalt blockiert nur. AP-3 ändert keine Auswertung (F7). |
| **E-AP1** | Rolle von `ai_policies` | ✅ **Global = Plattform-Basis, nur lesend. Mandanten-Regeln nur in `governance_policies`.** Gibt es Mandantenzeilen in `ai_policies` (F3), folgt ein eigenes Paket zur Übernahme, nicht in AP-3. | Hält AP-3 klein. Ein Mandant ändert nie globale Regeln. |
| **E-AP2** | `governance_policy_versions` erweitern oder ablösen? | ✅ **Neue Tabelle `governance_policy_revisions`** (nur Policies, Nachher-Stand, append-only). Die alte Tabelle bleibt unverändert für Assets. | Die alte Tabelle mischt Assets und Policies, speichert den Vorher-Stand und hat keinen Leser. Umbau wäre riskanter als Neuanlage. |
| **E-AP3** | Snapshot beim Schreiben? | ✅ **Ja:** nach jeder Revision den kompilierten Policy-Satz des Mandanten nach `policy_snapshots` schreiben (gleiche `snapshotVersion`, `UNIQUE (tenant_id, version)` dedupliziert) und die Snapshot-Version an der Revision speichern. | Ohne das gibt es für Replay (E-GE6) keine Basis zum Änderungszeitpunkt. |
| **E-AP4** | Welche Governed-Evolution-Spec führt? | ✅ **ADR 0010 + `docs/specs/…` führen die Verträge**, `.claude/os-funnel/governed-evolution.md` den Plan- und Bestandsabgleich. Beide verweisen aufeinander (Einzeiler je Datei). Owner-Entscheidungen (E-GE*) gehen vor; widerspricht eine Spec, wird die Spec angepasst (F10). | Keine Doppelpflege von Feldlisten. |

---

## 4. Teilpakete

```
E-AP0–E-AP4 entschieden (2026-11-02)
      │
      ├─► 3a  Plan + Lesemessung + Spec-Abgleich (nur Doku, kein Code)
      ├─► 3b  Migration: Version + Revisionen (separates GO, Test zuerst)
      ├─► 3c  Ein Schreibpfad + Evidence (Edge Functions)
      └─► 3d  Snapshot beim Schreiben (E-AP3)
```

Reihenfolge: 3a → 3b → 3c → 3d. Jedes Paket setzt das vorige auf `main` voraus.

### 3a — Plan, Messung, Spec-Abgleich (risikolos)

- `PLAN.md` §4: AP-Zeilen nach E-AP0 nachziehen (AP-1a–AP-2 „nicht beauftragt“), AP-3 mit Teilpaketen eintragen.
- `governed-evolution.md`: O6 auf „Auftrag liegt vor“ setzen, Verweis auf ADR 0010 (E-AP4). **Erst nach Merge von #2126**, sonst Konflikt in §7.
- ADR 0010: Einzeiler-Verweis auf `.claude/os-funnel/governed-evolution.md`. `GOVERNANCE_BOUNDARY_SPEC.md` Z. 203 und `EVIDENCE_AND_AUDIT_REQUIREMENTS.md` Z. 56 auf E-GE5 einengen (F10). Nur ändern, nicht vergrößern; `npm run check:context`.
- Lesende Abfrage nur mit GO, Ergebnis nur als Aggregat in den PR-Text:
  ```sql
  select (tenant_id is null) as global, count(*) from public.ai_policies group by 1;
  select count(*) as policies, count(distinct tenant_id) as tenants from public.governance_policies;
  ```

### 3b — Migration (Risiko hoch, separates GO)

**Test zuerst** (`test/runtime/db/policy-revisions.db.test.ts`), dann Migration `supabase/migrations/<ts>_ap3_policy_revisions.sql`:

1. `governance_policies.version int not null default 1`.
2. `BEFORE UPDATE`-Trigger: `version := old.version + 1`, **nur** wenn sich ein fachliches Feld ändert (`condition`, `action`, `enforce_action`, `mode`, `enabled`, `severity`, `policy_type`, `name`, `description`, `environment`). Reine `updated_at`-Änderungen erhöhen nicht. Feldliste vor dem Schreiben gegen das aktuelle Schema prüfen.
3. Neue Tabelle `governance_policy_revisions`:
   `id`, `tenant_id NOT NULL`, `policy_id`, `version`, `op` (`insert`/`update`/`delete`), `row` jsonb (Nachher-Stand, bei `delete` der letzte Stand), `changed_by uuid NULL`, `change_source text` (`ui`/`policy_pack`/`provision`/`migration`/`unknown`), `snapshot_version text NULL`, `created_at`. `UNIQUE (policy_id, version, op)`.
4. `AFTER INSERT/UPDATE/DELETE`-Trigger (SECURITY DEFINER, `search_path` fest) schreibt die Revision. Bei UPDATE **nur, wenn `new.version <> old.version`**: Ein UPDATE ohne fachliche Änderung (Version bleibt gleich) schreibt keine Revision, sonst verletzt das zweite unveränderte Update `UNIQUE (policy_id, version, op)` und rollt den Schreibzugriff zurück (erreichbar z. B. über `togglePolicy` in `governance-resources`, das einen bereits gesetzten `enabled`-Wert erneut schreibt). `changed_by`/`change_source` aus `current_setting('app.change_actor', true)` bzw. `app.change_source`, sonst `NULL`/`unknown`.
5. Append-only: UPDATE und DELETE auf `governance_policy_revisions` per Trigger sperren (Muster aus `20260901090000_evidence_append_only_anchors.sql`). **Ausnahme:** das einmalige Setzen von `snapshot_version` von `NULL` auf einen Wert (für 3d); alle anderen Spalten bleiben gesperrt.
6. RLS: Mitglieder lesen ihren Mandanten (über `memberships`, Muster aus `20260723000001_rls_recursion_fix_security_definer.sql`), keine Client-Schreibrechte.
7. Backfill: für jede bestehende Policy eine Revision `op='insert'`, `version=1`, `change_source='migration'`.

Testfälle: Anlage → Revision v1 · fachliche Änderung → v2 + Revision · nur `updated_at` → keine neue Version und keine Revision · dasselbe unveränderte UPDATE zweimal hintereinander (z. B. `enabled` auf den bestehenden Wert) → keine Revision, kein Fehler · Löschen → Revision `delete` · UPDATE/DELETE auf Revisionen schlägt fehl (außer `snapshot_version` NULL → Wert, genau einmal) · fremder Mandant liest nichts · Client kann nicht schreiben · Backfill vollständig.

### 3c — Ein Schreibpfad und Evidence

- Neues Modul `supabase/functions/_shared/policyStore.ts` mit `createPolicy`, `updatePolicy`, `setPolicyEnabled`, `insertFromTemplate`. Jede Funktion setzt `app.change_actor`/`app.change_source` (per RPC in derselben Transaktion oder als Spalte; Weg in der Session festlegen und begründen).
- Umstellen: `governance-resources`, `provision-tenant`, `policy-packs`. Bestehende `audit()`-Aufrufe bleiben.
- Je Änderung ein Evidence-Eintrag über `append_governance_evidence` (verkettet, wie `governance-approvals/evidence.ts`): Policy-ID, Version, Quelle, Auslöser.
- Rolle unverändert: `owner`/`admin` über `memberships`, Mandant aus der Zeile, nie aus dem Body.
- Tests: `test/edge/` je umgestellte Function, inkl. Fehlerfall (Evidence-Schreiben scheitert → Antwort meldet Fehler, keine stille Änderung).

### 3d — Snapshot beim Schreiben (E-AP3)

- Nach jeder Revision den Snapshot **ohne Cache** laden (eigene Funktion oder Parameter, nicht `loadSnapshot` mit Cache-Treffer, F11), persistieren, `snapshot_version` an die Revision schreiben.
- **Nicht best-effort:** Scheitert Laden oder Persistieren, bleibt `snapshot_version` `NULL` und die Antwort meldet den Fehler. Kein stiller Erfolg. Fehlende Snapshots sind per Abfrage auffindbar (Revisionen mit `snapshot_version IS NULL`).
- Cache in `decide.ts` für den Mandanten invalidieren.
- O1b gleich mitnehmen? **Nein**, eigener PR (`governance-ingest`).

---

## 5. Ausdrücklich nicht in AP-3

- `evolution_*`-Tabellen, Vorschläge, Approvals-`kind` (E-GE8), Replay (O5)
- Änderungen an der Auswertung (`policyEngine.ts`, `core.ts`-Kompilierung, PEP-Modus)
- Übernahme von `ai_policies`-Mandantenzeilen (E-AP1, Folgepaket)
- UI, Landing, Claims, Preise
- `governance_policy_versions` umbauen oder löschen

## 6. Leitplanken (PLAN §5)

Kein Deploy, kein Merge, kein Push auf `main`. **Keine Supabase-Migration auf Produktion ohne separates GO** (betrifft 3b und die Abfrage in 3a). Tenant nur über `JWT → memberships → tenant_id`. Keine Service-Role im Browser. Status-Vokabular `live`/`preview`/`coming-soon`. Bei > 20 offenen PRs: stopp.

## 7. Prüfung

`npm run lint` · `npm test` (betroffene Suites, DB-Tests aus 3b) · `npm run check:fabrication` · `npm run check:context` · `npm run build`. Für 3b zusätzlich: Migration lokal gegen eine frische DB und gegen einen Stand mit Bestandsdaten (Backfill).

## 8. PR-Text (Definition of Done)

Teilpaket · Bezug auf E-AP0–E-AP4 · gemessener `main`-Hash · geänderte Dateien · neue Tabellen/Trigger mit RLS-Beschreibung · Testfälle mit Ergebnis · was ist **live** (nichts Kundensichtbares) / **preview** / **coming soon** (Governed Evolution bleibt Coming Soon) · welche Checks liefen und welche nicht.
