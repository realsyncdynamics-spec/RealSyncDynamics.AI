# Confidence / Evidence Model — Definition

**Erstellt:** 2026-05-26
**Modus:** Dokumentation des Soll-Schemas. Keine Migration, keine Code-Aenderung. Ziel: technische Sprache fuer Findings, die der Realitaet der Detection-Engine entspricht — „technisch beobachtet" statt „juristisch behauptet".

---

## 1. Warum dieses Modell?

Die aktuellen Findings-Tabellen (`gdpr_audits`, `marketing_compliance_findings`, `governance_events`, `enterprise_agent_runs`) speichern Findings als JSONB mit `severity` und `evidence` als unstrukturierte Felder. Es gibt:

- **kein** `confidence_score`
- **kein** `evidence_level`
- **kein** `verification_status`
- **kein** `rule_version`
- **kein** `detection_engine_version`
- **kein** `evidence_schema_version`
- **kein** strukturiertes `evidence_refs` (Evidence ist inline JSON, keine Referenz auf `audit_evidence`-Rows)

Konsequenz: Wir sagen heute „Tracker X wurde pre-consent geladen, Severity high" — wir koennen aber spaeter nicht zeigen *wie sicher* die Detection war, *welche Regelversion* das gepruegt hat, oder *welche Engine-Version* lief. Fuer einen DSGVO-Auditor sind das nicht-optionale Felder.

---

## 2. Soll-Felder pro Finding

### 2.1 `confidence_score`

Typ: `numeric(3,2)` mit Range `0.00` bis `1.00`.

Interpretation:

| Range | Bedeutung |
|---|---|
| `0.95 – 1.00` | Direkte Beobachtung mit eindeutigem Signal (z.B. `gtag('config', 'G-...')`-Call im DOM) |
| `0.75 – 0.94` | Hohe Wahrscheinlichkeit, aber Heuristik (z.B. Hostname-Match auf `google-analytics.com`, ohne Init-Call gesehen) |
| `0.50 – 0.74` | Indirekt geschlossen (z.B. Cookie mit `_ga`-Praefix gesetzt, aber Skript nicht direkt geladen) |
| `0.00 – 0.49` | Schwaches Signal, sollte nicht als Finding angezeigt werden, eher als „Hinweis" |

Score ist nicht subjektiv — er kommt aus der Detection-Regel. Beispiel: `pre_consent_tracker.evaluate()` gibt `{ detected: true, confidence: 0.95, signals: [...] }` zurueck. Der Wert wird mit dem Finding persistiert.

### 2.2 `evidence_level`

Typ: `enum`. Werte:

| Wert | Bedeutung |
|---|---|
| `observed` | Direkte Beobachtung: Request-Log, DOM-Snapshot, Cookie-Dump zeigen den Sachverhalt unmittelbar |
| `inferred` | Logisch aus anderen Beobachtungen geschlossen, ohne direkte Sichtung |
| `partial` | Teil-Evidence vorhanden — z.B. Header sichtbar, aber Body geblockt |
| `unverified` | Detection ausgeloest, aber externe Verifikation (z.B. zweite Quelle) hat nicht stattgefunden |

### 2.3 `verification_status`

Typ: `enum`. Beschreibt, ob *nach* der initialen Detection eine Verifikation stattgefunden hat.

| Wert | Bedeutung |
|---|---|
| `verified` | Wiederholter Scan / zweite Detection-Engine bestaetigt den Befund |
| `partial` | Eine Folge-Pruefung hat zugestimmt, eine andere nicht — manueller Review noetig |
| `failed` | Re-Check konnte den Befund nicht reproduzieren — Original-Finding moeglicherweise transient |
| `not_checked` | Nur die initiale Detection liegt vor |

Default fuer neue Findings: `not_checked`. Aenderung erfolgt durch einen separaten Verifikations-Lauf (z.B. weekly Cron mit deterministischem Re-Scan).

### 2.4 `rule_id` und `rule_version`

Typ: `text`, beide nicht-null.

`rule_id` identifiziert die Regel logisch (z.B. `pre_consent_tracker`, `csp_missing`, `ttdsg-25-cookie-without-consent`).

`rule_version` ist Semver (`MAJOR.MINOR.PATCH`). Bumps:

- **Patch**: Heuristik gefeintunt, Verhalten identisch fuer alle Test-Surfaces
- **Minor**: Detection-Range erweitert (mehr True-Positives) — Golden-Dataset zeigt nur „mehr Findings, keine alten weg"
- **Major**: Semantik geaendert (was vorher als Finding zaehlte, zaehlt nicht mehr oder umgekehrt)

Aktuell sind alle Regeln hardcoded in `services/playwright-scanner/src/scanner.ts` ohne Versionsnummer. Die Migration zum versionierten Modell waere:

1. `TRACKER_PATTERNS`-Array bekommt eine `version`-Spalte pro Pattern
2. Detection-Output enthaelt `rule_version` pro Finding
3. `findings.rule_version` wird gespeichert

### 2.5 `detection_engine_version`

Typ: `text`, Semver. Identifiziert die *Engine*, nicht die Regel.

Aktuell existiert `SCANNER_VERSION = '1.0.0'` in `services/playwright-scanner/src/scanner.ts`. Diese Konstante muesste mit jedem Finding persistiert werden, damit man spaeter sagen kann: „dieser Befund stammt aus Engine 1.2.3, Regel-Set 4.5.6".

Cookie-Scan-Edge-Function (`supabase/functions/cookie-scan/index.ts`) hat keine eigene Versionierung. Soll: synchron mit `SCANNER_VERSION` oder eigene `COOKIE_SCAN_ENGINE_VERSION`.

### 2.6 `evidence_schema_version`

Typ: `text`, Semver. Identifiziert das Format des `evidence`-Payloads.

Heute ist `evidence` ein freies JSONB-Feld ohne Schema. Soll: pro Finding-Typ ein dokumentiertes JSON-Schema mit Version. Beispiel:

```json
{
  "evidence_schema_version": "1.0.0",
  "evidence": {
    "request_url": "https://www.google-analytics.com/g/collect?v=2&tid=G-XXXX&...",
    "request_method": "POST",
    "loaded_at_ms_after_pageload": 142,
    "consent_state_at_time": "no_consent",
    "consent_manager_detected": false
  }
}
```

So weiss der spaetere Reader: „Format 1.0.0 hat genau diese 5 Felder, kein mehr, kein weniger".

### 2.7 `evidence_refs`

Typ: `uuid[]`, Referenzen auf `audit_evidence.id` (oder die governance-Variante `governance_evidence.id`).

Aktuell ist Evidence inline in `gdpr_audits.issues[].evidence`. Das macht das Datenmodell sperrig: Screenshots, HAR-Files, DOM-Snapshots werden in S3/Supabase-Storage gehalten, aber die Verknuepfung erfolgt heute ueber lose Konventionen.

Soll: `findings.evidence_refs[]` zeigt auf die strukturierten Rows in `audit_evidence`. Jeder Eintrag dort hat `type` (`screenshot` / `request_log` / `cookie_dump` / `dom_snapshot` / `script_reference` / `response_header`), `storage_url`, `content_hash`. Damit:

- Evidence ist deduplizierbar (mehrere Findings zeigen auf dieselbe Evidence-Row)
- Hash-Chain ist trennbar von Finding-Lifecycle
- C2PA-Manifeste koennen pro Evidence-Row signiert werden

---

## 3. Vollstaendiges Soll-Schema fuer ein `finding`

```typescript
type Finding = {
  finding_id: string;                       // UUID v7 (sortable, neu in v7-Spec)
  tenant_id: string;                        // RLS-Scope
  audit_id: string;                         // Parent-Audit / Parent-Run
  rule_id: string;                          // z.B. 'pre_consent_tracker'
  rule_version: string;                     // SemVer, z.B. '1.2.0'
  detection_engine_version: string;         // SemVer der Engine, z.B. '1.0.0'
  evidence_schema_version: string;          // SemVer des evidence-JSONs, z.B. '1.0.0'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence_score: number;                 // 0.00 - 1.00
  evidence_level: 'observed' | 'inferred' | 'partial' | 'unverified';
  verification_status: 'verified' | 'partial' | 'failed' | 'not_checked';
  evidence: Record<string, unknown>;        // Schema durch evidence_schema_version definiert
  evidence_refs: string[];                  // FK -> audit_evidence.id
  detected_at: string;                      // ISO timestamp
  verified_at: string | null;               // ISO timestamp, falls Re-Check stattfand
};
```

---

## 4. Migrations-Strategie (Soll, nicht Implementierung)

Das Modell ist additiv anwendbar, ohne bestehende Findings zu zerstoeren:

1. **Migration A — Spalten ergaenzen.** Auf jeder Findings-Tabelle (`gdpr_audits.issues` als JSONB-Migration, `marketing_compliance_findings`, `governance_events`, `enterprise_agent_runs.findings[]`-JSONB) die neuen Felder als `null`-able hinzufuegen. Bestehende Rows bekommen `null`-Werte.

2. **Migration B — Defaults populieren.** Backfill-Job (separates Skript, kein Migration-File): fuer bestehende Findings `evidence_level='unverified'`, `verification_status='not_checked'`, `confidence_score=NULL`, `rule_version='0.0.0'`, `detection_engine_version='0.0.0'`, `evidence_schema_version='0.0.0'`. Markiert sie als legacy.

3. **Migration C — Engine-Code instrumentieren.** `services/playwright-scanner/src/scanner.ts` und `supabase/functions/cookie-scan/index.ts` geben die neuen Felder mit jedem Finding zurueck. Bei Lookup-basierten Regeln: pro `TRACKER_PATTERNS`-Eintrag eine `rule_version`-Spalte.

4. **Migration D — Read-Side.** `AuditResultView`, `ComplianceMatrix`, PDF-Reports lesen die neuen Felder und rendern sie unter dem Disclaimer „im aktuellen Scan erkannt, Confidence: 0.95, verifiziert" statt blossem „Severity: high".

5. **Migration E — NOT-NULL.** Nach 30 Tagen, wenn alle neuen Findings die Felder tragen und die Backfill-Werte stehen, koennen die Spalten `NOT NULL` werden.

Jede dieser Migrationen ist ein eigener PR. Keine alle-auf-einmal.

---

## 5. Sprach-Implikationen fuer Reports

Mit Confidence/Evidence-Model laesst sich die Sprache in Audit-Reports praezisieren:

| Statt | Besser |
|---|---|
| „Sie verletzen DSGVO Art. 5" | „Im aktuellen Scan wurde ein Tracker-Request vor Consent beobachtet (Confidence 0.95). Dies ist je nach Kontext pruefungsrelevant nach DSGVO Art. 5 Abs. 1 lit. a und TTDSG § 25" |
| „Garantiert konform" | „Im aktuellen Scan wurden keine pre-consent Tracker-Requests beobachtet. Evidence verfuegbar" |
| „Rechtssicher" | „Verification Status: verified (Wiederholungs-Scan in 24h Differenz hat denselben Befund) " |
| „Bussgeld-Risiko 4% Jahresumsatz" | (entfaellt — gehoert nicht in einen Detection-Report) |

Die Begruendung „technisch beobachtet" ist defensiv tragfaehig, auch wenn ein Anwalt drauf schaut. „Garantiert" ist es nicht.

---

## 6. Was dieses Modell NICHT macht

- Es ersetzt keine juristische Bewertung. Confidence-Score sagt nichts ueber Rechtmaessigkeit, nur ueber Detection-Sicherheit
- Es ersetzt keinen Anwalt-Review im konkreten Streitfall
- Es macht die Detection nicht „besser" — es macht die Aussagen *messbar*

---

## 7. Akzeptanz-Kriterien fuer eine spaetere Implementierung

Wenn ein Folge-PR das Modell umsetzt, muss er erfuellen:

1. **Migrationen additiv.** Keine Bestandsdaten zerstoert. Append-only-Tabellen bleiben append-only
2. **Backfill-Konsistenz.** Vor und nach Backfill liefert dieselbe Query dieselbe Row-Count (nur neue Spalten)
3. **Engine-Output instrumentiert.** Detection-Engine liefert die neuen Felder mit jedem Finding (ggf. mit Default `unverified`/`0.0.0`)
4. **Golden-Dataset-Tests aktualisiert.** `expected.json` enthaelt die neuen Felder mit erwarteten Werten — Detection-Aenderungen sind im Diff sichtbar (siehe `docs/testing/golden-dataset-plan.md`)
5. **Reports nutzen die Felder.** PDF-Export, SPA-View, JSON-Export rendern Confidence und Evidence-Level mit
6. **Versionierung gepflegt.** `rule_version` und `detection_engine_version` werden bei jedem Commit, der `TRACKER_PATTERNS` oder Detection-Code beruehrt, bewusst gebumped

---

## 8. Keine Aenderungen aus diesem Dokument

Dieses Dokument ist Spezifikation. Implementierung (Migration, Engine-Instrumentierung, Read-Side, Backfill) erfolgt in separaten PRs nach Operator-Stabilisierung — nicht in diesem.
