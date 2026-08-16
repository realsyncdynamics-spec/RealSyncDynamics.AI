# Asset Lifecycle Contract (Phase B1)

**Status**: `proposed` · **Ebene**: 2 (SiteOS / Control Plane) · **Stand**: 2026-08-15

**Zweck**: Übersetzt den vorhandenen Tabellenbestand in einen präzisen Datenvertrag
für den Lebenszyklus `Audit → Asset → Findings → Evidence → Subscription →
Observation Run`. Grundlage für B2–B4.

**Dieses Dokument ändert nichts.** Keine Migration, keine Edge Function, kein
Frontend. Es legt fest, welches Objekt kanonisch ist, welche Relationen gelten
und welche Zustände tatsächlich ableitbar sind. Erst wenn dieser Vertrag steht,
wird gebaut.

Alle Aussagen zum Ist-Zustand sind gegen `supabase/migrations/` und gegen das
Live-Projekt (read-only) geprüft. Zeilenzahlen sind der Produktionsstand vom
2026-08-15.

---

## 1. Welches Objekt ist das Asset?

**`governance_assets` ist das kanonische Asset.** Nicht `websites`.

Die Tabelle trägt bereits neun Typen — der generische Unterbau existiert also,
er wird nur nicht benutzt:

```sql
asset_type IN ('website', 'ai_system', 'vendor', 'model', 'agent',
               'api', 'dataset', 'repository', 'workflow')
```

```text
                 governance_assets
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
       website       ai_system      api
          │
          ↓
       websites  (fachliche Projektion)
```

Begründung: Die Plattform überwacht langfristig nicht nur Websites. Würde
`websites` zum Asset erhoben, stünde in wenigen Monaten dieselbe Frage für
KI-Agent, WhatsApp-Bot, API und Kundenportal erneut an — dann aber mit
gewachsener Datenmenge an der falschen Tabelle.

**Was `websites` bleibt**: die fachliche Projektion des Typs `website` mit allem,
was nur für Websites gilt — Domain, `plan_tier` (`audit`/`rebuild`/`managed`),
kommerzieller Lebenszyklus (`lead → audit_pending → audit_done →
rebuild_in_progress → rebuild_done → live → paused → churned`),
`deployment_host`, `deployment_ip`. Diese Felder gehören nicht in ein
generisches Asset.

---

## 2. Welche Relation verbindet Asset und Website?

**Heute: keine.** Das ist die zentrale Lücke dieses Contracts.

| Tabelle | Verweist auf | Prod-Zeilen |
| --- | --- | --- |
| `websites` | `gdpr_audits` (`latest_audit_id`) | 0 |
| `governance_assets` | — | 1 |
| `scan_runs` | `websites` (`website_id`) | 0 |
| `findings` | `websites` (`website_id`) | 0 |
| `governance_evidence` | `governance_assets` (`asset_id`), `governance_events` (`event_id`) | 1 |

Der Bruch ist damit exakt benennbar: **Beobachtung und Befund hängen an
`websites`, Nachweis hängt an `governance_assets`, und die beiden Tabellen kennen
einander nicht.** Ein Nachweis lässt sich heute keinem Befund zuordnen, weil der
gemeinsame Bezugspunkt fehlt.

**Vertrag**: Genau eine gerichtete Relation, additiv, in B2:

```
websites.governance_asset_id  →  governance_assets(id)     -- NOT NULL nach Backfill
```

Richtung bewusst so: Die Projektion kennt ihr Asset, nicht umgekehrt. Sonst
bräuchte `governance_assets` je Typ eine eigene Spalte und wäre nicht mehr
generisch.

Regeln:
- Ein `websites`-Datensatz ohne Asset ist ungültig (nach B2).
- Ein Asset vom Typ `website` hat höchstens eine `websites`-Projektion.
- `governance_assets.tenant_id` und `websites.tenant_id` müssen übereinstimmen.

---

## 3. Welche Tabelle ist die Evidence-Quelle?

Es gibt zwei Evidence-Tabellen. Sie sind **nicht** redundant, sie haben
verschiedene Aufgaben — und der Vertrag muss das festhalten, sonst wird die
falsche befüllt.

| | `governance_evidence` | `evidence_items` |
| --- | --- | --- |
| Herkunft | maschinell, aus Beobachtung | menschlich, hochgeladen |
| Bezug | `asset_id`, `event_id` | `framework_codes`, `control_ids`, `gap_ids` |
| Integrität | `content_hash` + **`previous_hash`** (Kette) | `file_hash` (Einzelhash) |
| Typen | `screenshot`, `har`, `json`, `log`, `pdf`, `hash`, `policy_snapshot`, `approval`, `pull_request` | `document`, `certificate`, `audit_report`, `training_record`, … |
| Prod-Zeilen | 1 | 0 |

**Vertrag**: Für den Beobachtungspfad ist **`governance_evidence` kanonisch.**
Nur sie hängt am Asset und führt eine Hash-Kette — beides ist Voraussetzung
dafür, dass ein Nachweis später einem Befund zugeordnet und auf Unversehrtheit
geprüft werden kann.

`evidence_items` bleibt der **Dokumenten-Vault** für hochgeladene
Compliance-Artefakte (Zertifikate, Schulungsnachweise, Verträge). Er wird nicht
aus Beobachtungen befüllt.

> **Folgehinweis zu Phase A**: Die Dashboard-Kachel „Evidence Items" zählt heute
> `evidence_items` und misst damit den Dokumenten-Vault, nicht die
> Beobachtungs-Nachweise. Das ist nach diesem Vertrag korrekt, aber
> missverständlich beschriftet. In B4 wird die Kachel entweder umbenannt oder
> um eine zweite ergänzt. **Nicht** stillschweigend auf die Summe beider
> Tabellen ändern — das wäre wieder eine Zahl ohne definierte Metrik.

---

## 4. Was ist ein Observation Run?

**`scan_runs` ist der Observation Run.** Eine Zeile = eine Ausführung eines
Detektors gegen ein Subjekt.

Vorhandene Struktur: `tenant_id`, `website_id`, `detector`, `status`
(`queued → running → completed | failed | cancelled`), `started_at`,
`completed_at`, `duration_ms`, `finding_count`, `severity_max`, `correlation_id`.

Der Zustandsautomat ist bereits durch Constraints abgesichert — ein terminaler
Status verlangt `completed_at`, ein `failed` verlangt eine Fehlermeldung. Das ist
belastbar und wird übernommen.

**Vertrag**:
- Ein Observation Run bezieht sich in B2+ auf das **Asset**, nicht nur auf die
  Website-Projektion (`scan_runs.asset_id`, additiv neben `website_id`).
- Ein Run ohne terminalen Status zählt nicht als Beobachtung.
- Ein fehlgeschlagener Run ist eine Beobachtung **des Systems**, nicht des
  Assets — er darf keinen Asset-Zustand fortschreiben (siehe §6).

---

## 5. Was bedeutet „Monitoring aktiv" technisch?

Heute existieren zwei Monitoring-Träger, und keiner davon ist tenant- und
asset-fähig:

| | `audit_recheck_subscriptions` | `scan_schedules` |
| --- | --- | --- |
| Schlüssel | `email` + `domain` | `tenant_id` + `domains TEXT[]` |
| `tenant_id` | **nein** | ja |
| Asset-Bezug | nein (`last_audit_id → gdpr_audits`) | nein (Domain-Strings) |
| Schreibpfad | **keiner im Repo** | Edge Function `scheduler` |
| Prod-Zeilen | 0 | 0 |

`audit_recheck_subscriptions` gehört zum anonymen Lead-Funnel: E-Mail plus
Domain, ohne Mandant. Es ist **keine** Mandanten-Monitoring-Beziehung und wird
auch keine.

**Vertrag**: Die Monitoring-Beziehung ist eine Relation zwischen **Asset** und
**Zeitplan**, nicht zwischen E-Mail und Domain. `scan_schedules` ist der
Träger, bekommt in B2 aber einen echten Asset-Bezug statt `domains TEXT[]`.

„Monitoring aktiv" für ein Asset bedeutet dann genau:

```
∃ scan_schedules-Zeile mit
      asset-Bezug auf dieses Asset
  AND enabled = true
  AND paused  = false
  AND next_run_at IS NOT NULL
```

Kein Flag am Asset. Keine abgeleitete Vermutung aus `next_reaudit_at`.

---

## 6. Welche Zustände sind tatsächlich ableitbar?

**Der Lebenszyklus wird nicht als Statusspalte geführt.** Eine Spalte
`websites.status = 'continuously_monitored'` wäre exakt das Truth-Layer-Problem
aus Phase A, nur eine Ebene tiefer: ein Wort, das behauptet, was die Datenbasis
nicht trägt.

Stattdessen wird der Zustand serverseitig aus fünf Eingaben abgeleitet:

```text
Asset
   +
letzte Beobachtung (scan_runs)
   +
Evidence-Zustand (governance_evidence)
   +
Governance-Zustand (findings / Risk)
   +
Monitoring-Beziehung (scan_schedules)
        ↓
   Lifecycle-Zustand
```

| Abgeleiteter Zustand | Notwendige und hinreichende Bedingung |
| --- | --- |
| `ANONYMOUS_BASELINE` | `gdpr_audits`-Zeile zur Domain, **kein** Asset |
| `ASSET_CREATED` | Asset existiert, kein abgeschlossener Observation Run |
| `BASELINE_VERIFIED` | ≥ 1 Observation Run mit `status = 'completed'` |
| `EVIDENCE_CREATED` | ≥ 1 `governance_evidence`-Zeile am Asset |
| `MONITORING_ACTIVE` | aktive Monitoring-Beziehung nach §5 |
| `CONTINUOUSLY_OBSERVED` | `MONITORING_ACTIVE` **und** ≥ 2 abgeschlossene Runs |

**Die harte Regel** (Phase-B-Festlegung):

> Kein „Continuous Monitoring"-Status darf angezeigt werden, solange kein
> persistiertes Asset und keine tatsächlich aktive Monitoring-Beziehung
> existieren.

Fehlt eine Voraussetzung, ist das Ergebnis `PENDING` oder `UNKNOWN` — **nie**
`ACTIVE`. Ist eine Eingabe nicht abfragbar, gilt `UNKNOWN`, nicht der zuletzt
bekannte Wert. Das ist dieselbe Fail-closed-Linie wie beim Publish Gate
(`target-architecture.md` §7 G3) und beim Truth Layer (§3.1).

Ein einzelner **fehlgeschlagener** Run schreibt keinen Zustand fort: er belegt,
dass die Beobachtung nicht stattgefunden hat. `CONTINUOUSLY_OBSERVED` verlangt
deshalb abgeschlossene Runs, nicht Versuche.

---

## 7. Der anonyme Audit wird nicht übernommen

Festlegung für B2, mit Vorrang vor jeder Bequemlichkeit:

```text
ANONYM                          NACH REGISTRIERUNG
URL                             Signup
 ↓                               ↓
Free Baseline                   Asset anlegen
 ↓                               ↓
gdpr_audits                     neuer authentifizierter Observation Run
 ↓                               ↓
Ergebnis (Momentaufnahme)       Findings → Evidence → Monitoring
```

Der anonyme Audit wird **nicht** in den Mandanten importiert. Gründe, in dieser
Reihenfolge:

1. `gdpr_audits` enthält `email` und `ip_hash` ohne Mandantenbezug. Diese Daten
   nachträglich einem Tenant zuzuschreiben, ändert den Verarbeitungszweck.
2. Ein Claim-Mechanismus über E-Mail-Gleichheit wäre fragil und
   missbrauchsanfällig — fremde Audits wären über eine bekannte Adresse
   beanspruchbar.
3. Die Evidence-Kette beginnt sauber mit dem ersten authentifizierten Lauf.

Der anonyme Report bleibt sichtbar und dient als **Vergleichsreferenz**:
„Baseline erneut verifizieren" führt einen neuen Lauf aus und stellt beide
Ergebnisse gegenüber. `websites.latest_audit_id` (bereits vorhanden, FK auf
`gdpr_audits`) trägt genau diesen Verweis — als Referenz, nicht als Quelle.

---

## 8. Bestandsaufnahme: bleibt · Projektion · Legacy

| Tabelle | Rolle nach diesem Vertrag |
| --- | --- |
| `governance_assets` | **kanonisch** — das Asset |
| `websites` | **Projektion** des Typs `website` |
| `scan_runs` | **kanonisch** — Observation Run |
| `findings` | **kanonisch** — Befund |
| `governance_evidence` | **kanonisch** — Nachweis aus Beobachtung (Hash-Kette) |
| `evidence_items` | bleibt — Dokumenten-Vault, andere Aufgabe |
| `scan_schedules` | **kanonisch** — Monitoring-Beziehung (braucht Asset-Bezug) |
| `governance_events` | bleibt — Ereignisstrom, Anker für `governance_evidence` |
| `gdpr_audits` | bleibt — anonyme Baseline, **kein** Mandantenobjekt |
| `audit_recheck_subscriptions` | **Legacy** — anonymer Lead-Funnel, ohne Schreiber; kein Mandanten-Monitoring |
| `dashboard_kpis` | **Legacy** — seit #1057 ohne Leser, ohne Schreiber |
| `risk_dashboard_summary` | offen — Leser entfernt, Schreiber existiert nie; Entscheidung in B3 |

Nichts wird gelöscht. Legacy heißt: kein neuer Code schreibt oder liest, und die
Tabelle wird nicht zur Grundlage einer Anzeige.

---

## 9. Defekte, die B2/B3 additiv beheben müssen

Beim Erstellen dieses Vertrags gefunden, alle am Code verifiziert:

| # | Defekt | Fundstelle | Wirkung | Stand |
| --- | --- | --- | --- | --- |
| D1 | keine Relation `websites` ↔ `governance_assets` | beide Migrationen | Befund und Nachweis nicht zusammenführbar | **behoben** (B2, `20260821000000`) |
| D2 | `governance_assets.tenant_id` ist **nullable** | `20260512000000:3` | verletzt die Mandantenregel aus `CLAUDE.md` §3 | **offen** |
| D3 | `findings.scan_run_id` ohne Fremdschlüssel | `20260610200000:45` (im Code als bekannt kommentiert) | Befunde können auf nicht existierende Runs zeigen | **behoben** (B2) |
| D4 | `findings.evidence_ref` ist `TEXT`, kein Fremdschlüssel | `20260610200000` | Nachweisbezug nicht referenziell gesichert | **behoben** (B3, `20260822000000`) |
| D5 | `scan_schedules.domains` ist `TEXT[]` statt Asset-Bezug | `20260701130000` | Monitoring nicht eindeutig einem Asset zuordenbar | **behoben** (B3) |
| D6 | `audit_recheck_subscriptions` ohne Schreibpfad | repo-weit | Cron läuft dauerhaft gegen leere Tabelle | **offen — Produktentscheidung** |

D2 ist der schwerwiegendste: Ein Asset ohne Mandant ist nicht mandantengetrennt
abfragbar. In Produktion existiert genau eine solche Zeile; ein `SET NOT NULL`
würde entweder blind fehlschlagen oder blind zuordnen. Vor der Auflösung muss
geklärt sein, wem sie gehört. Neue Assets tragen den Mandanten seit B2 immer.

**D6 wird bewusst nicht durch eine Migration entschieden.** Der Cron
`audit-recheck-weekly` läuft seit `20260506290000` gegen eine Tabelle, in die
nie jemand schreibt. Zwei Wege stehen offen — den Schreibpfad im anonymen
Lead-Funnel bauen, oder den Cron abstellen. Beides ist eine Produktentscheidung
über einen Funnel, keine Schema-Frage.

> **Abweichung zu §5**: Dort steht, `scan_schedules` bekomme „in B2" den
> Asset-Bezug. Die B2-Migration hat D5 ausdrücklich nach B3 verschoben, weil
> Monitoring nicht zur Brücke Audit → Asset gehört. Der Vollzug in B3 gilt;
> §5 ist an dieser Stelle überholt.

Die Relation ist als Zuordnungstabelle `scan_schedule_assets` umgesetzt, nicht
als Feld: Ein Zeitplan deckt mehrere Domains ab, eine Domain kann in mehreren
Zeitplänen stehen. `domains TEXT[]` bleibt als Ausführungsliste des Dispatchers
bestehen — die Relation steht daneben, nicht an seiner Stelle.

---

## 10. Was B1 ausdrücklich nicht entscheidet

- Keine Migration, kein Spaltenname ist damit final — B2 legt das Schema fest.
- Keine Aussage über die UI. `CONTINUOUSLY_OBSERVED` ist ein abgeleiteter
  Zustand, keine Beschriftung; wie er dargestellt wird, entscheidet B4.
- Keine Aussage darüber, wer den ersten authentifizierten Lauf auslöst
  (Signup-Hook, Onboarding-Schritt oder manuell) — das ist B2.

---

## 11. Reihenfolge

```text
B1  Lifecycle/Data Contract        ← dieses Dokument
        ↓
B2  Audit → Asset
        ↓
B3  Asset → Findings → Evidence → Monitoring
        ↓
B4  SiteOS Experience
```

B3 gilt erst als erfüllt, wenn für ein reales Asset gleichzeitig gilt:

```text
asset        = vorhanden
scan_run     = vorhanden (completed)
findings     > 0
evidence     > 0
subscription = aktiv
```

Nicht „Audit fertig".
