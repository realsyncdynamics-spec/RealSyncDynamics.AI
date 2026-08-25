# Kanonische Kontingente — Entscheidung, Diff und Bestandsrisiko

**Stand: 2026-08-25, gemessen auf `aee1980`.** Schritte 1–4 des
Canonical-Entitlement-AP. Schritt 5 (Gates bauen) ist ausdrücklich **nicht**
Teil dieser Datei: kein Planwert geändert, kein Entitlement repariert, kein
Trigger gesetzt, kein bestehendes Gate angefasst.

---

## 1. Die Entscheidung

Am 2026-08-25 hat der Eigentümer festgelegt:

> **`plan.limits.*` ist die kanonische kommerzielle Quelle.**
> Was dem Kunden verkauft und angezeigt wird, ist der maximal durchsetzbare
> Wert. `PLAN_ENTITLEMENTS['limit.*']` wird nicht als zweite Wahrheit
> behandelt.

Mit einer Schutzklausel, die genauso verbindlich ist:

> Bei Bestandskunden darf die Korrektur **nicht stillschweigend als Downgrade**
> wirken. Wo ein Kunde heute aufgrund eines höheren bestehenden Entitlements
> mehr nutzen kann, ist vor der Reduktion zu klären, ob dieses höhere Recht
> vertraglich oder kommunikativ zugesagt wurde.

**Gate-Regel:** Kein neues Enforcement gegen divergierende Werte, bevor die
kanonische Quelle hergestellt ist.

Die weiteren fünf Entscheidungen desselben Tages stehen in §5.

---

## 2. Eine Korrektur meiner eigenen Zahl

Frühere Fassungen dieser Arbeit nannten **„15 Divergenzen von 42 Paaren"**.
Beides ist falsch. Die Zahl stammte aus einer Auszählung, nicht aus einem
Paarvergleich mit einer festgelegten Zuordnung.

Der Vergleich mit der Zuordnung aus `scripts/check-limit-canonicity.mjs`
ergibt:

| | |
|---|---:|
| Felder in `PlanLimits` | 12 |
| davon mit Entitlement-Gegenstück | **9** |
| vergleichbare Paare (über 6 Pläne) | **38** |
| deckungsgleich | **17** |
| **abweichend** | **21** |
| nur auf der Preisseite (kein Entitlement) | 16 |
| nur in der Berechtigung (kein Preisseiten-Feld) | 26 |

`free` hat überhaupt keine `limit.*`-Berechtigungen — deshalb 38 statt 54
Paare. Das ist kein Fehler: Der kostenlose Einstieg wird nicht über
Kontingente geführt.

Das ist der vierte Fall in diesem Audit, in dem eine Zählung eine Messung
vorgetäuscht hat. Die Zahl steht ab jetzt in einem Skript, nicht in einem
Absatz.

---

## 3. Der vollständige Diff

Die Richtung ist entscheidend, weil sie bestimmt, wer etwas verliert. `-1`
heißt „unbegrenzt".

### 3.1 Preisseite ist **strenger** — die Korrektur kürzt (12)

| Plan | Feld | Key | Preisseite | Berechtigung |
|---|---|---|---:|---:|
| `starter` | `seats` | `limit.team_seats` | 1 | 3 |
| `starter` | `auditReportsPerMonth` | `limit.compliance_exports_monthly` | 2 | 5 |
| `growth` | `auditReportsPerMonth` | `limit.compliance_exports_monthly` | 12 | 20 |
| `agency` | `auditReportsPerMonth` | `limit.compliance_exports_monthly` | 50 | 100 |
| `enterprise` | `bots` | `limit.bots` | 20 | unbegrenzt |
| `enterprise` | `answersPerMonth` | `limit.bot_messages_monthly` | 50.000 | unbegrenzt |
| `enterprise` | `domains` | `limit.domains` | 25 | unbegrenzt |
| `enterprise` | `automationRunsPerMonth` | `limit.automation_runs_monthly` | 2.000 | unbegrenzt |
| `enterprise` | `seats` | `limit.team_seats` | 50 | unbegrenzt |
| `enterprise` | `apiCallsPerMonth` | `limit.api_calls_monthly` | 250.000 | unbegrenzt |
| `enterprise` | `auditReportsPerMonth` | `limit.compliance_exports_monthly` | 200 | unbegrenzt |
| `enterprise` | `bulkJobsPerMonth` | `limit.bulk_jobs_monthly` | 500 | unbegrenzt |

### 3.2 Preisseite ist **großzügiger** — die Korrektur weitet aus (9)

| Plan | Feld | Key | Preisseite | Berechtigung |
|---|---|---|---:|---:|
| `agency` | `answersPerMonth` | `limit.bot_messages_monthly` | 25.000 | 10.000 |
| `agency` | `apiCallsPerMonth` | `limit.api_calls_monthly` | 50.000 | 25.000 |
| `agency` | `bulkJobsPerMonth` | `limit.bulk_jobs_monthly` | 100 | 50 |
| `partner` | `answersPerMonth` | `limit.bot_messages_monthly` | 100.000 | 50.000 |
| `partner` | `domains` | `limit.domains` | 100 | 50 |
| `partner` | `automationRunsPerMonth` | `limit.automation_runs_monthly` | 10.000 | 2.500 |
| `partner` | `seats` | `limit.team_seats` | 100 | 50 |
| `partner` | `apiCallsPerMonth` | `limit.api_calls_monthly` | 1.000.000 | 100.000 |
| `partner` | `bulkJobsPerMonth` | `limit.bulk_jobs_monthly` | unbegrenzt | 500 |

**Diese neun sind harmlos.** Der Kunde bekommt, was auf der Preisseite steht;
niemand verliert etwas. Sie sind trotzdem Divergenzen und gehören bereinigt —
sonst prüft ein späteres Gate gegen die kleinere Zahl und der Kunde erlebt ein
Limit, das ihm nie genannt wurde.

---

## 4. Das Bestandsrisiko — vier Klassen, nicht eine

Die Schutzklausel aus §1 greift nicht überall gleich. Nach Schwere:

### Klasse A — Enterprise verliert „unbegrenzt" (8 Fälle) ⚠️

**Das ist der schwerste Fall, und er war in der Entscheidung nicht sichtbar.**

Enterprise ist seit AP2 ein **Vertragsplan** (`availability: 'contract'`,
`purchaseMode: 'inquiry'`). Die Berechtigung sagt in **acht von neun**
vergleichbaren Feldern `unbegrenzt`; die Preisseite nennt endliche Zahlen.

Wörtlich angewandt macht die Entscheidung aus einem unbegrenzten
Enterprise-Vertrag einen mit 20 Bots, 25 Domains und 50 Sitzen.

Die naheliegende Erklärung ist, dass die Zahlen auf der Preisseite für einen
Vertragsplan **Richtwerte** sind und der Vertrag gilt — aber das ist eine
Vermutung, und Vermutungen sind in diesem Audit dreimal falsch gewesen.

> **Offen und ausdrücklich nicht entschieden:** Gilt für `enterprise` die
> Preisseite oder der Vertrag? Vor einer Antwort darf an Enterprise-Werten
> nichts geändert werden.

### Klasse B — verkaufte Self-Service-Pläne kürzen (3 Fälle)

`starter.seats` 3→1, `starter.auditReports` 5→2, `growth.auditReports` 20→12.

Diese drei treffen **aktive, selbst gebuchte Kunden**. Ein Starter-Tenant mit
heute drei Mitgliedern hätte nach der Korrektur einen zu viel. Die
Bestandsregel aus Entscheidung 5 („Bestand bleibt, Neuanlage wird geprüft")
löst genau das — sie muss hier also **vor** der Wertkorrektur greifen, nicht
danach.

### Klasse C — stillgelegte Pläne kürzen (1 Fall)

`agency.auditReports` 100→50. Trifft nur Bestandskunden eines Plans, der nicht
mehr verkauft wird. Geringes Volumen, aber dieselbe Frage: Wurde die 100
jemals zugesagt?

### Klasse D — Ausweitungen (9 Fälle)

Kein Risiko. Siehe §3.2.

---

## 5. Die übrigen fünf Entscheidungen vom 2026-08-25

Festgehalten, damit die nächste Sitzung sie nicht neu verhandelt.

| # | Gegenstand | Entscheidung |
|---|---|---|
| 2 | `limit.llm_queries_monthly` | **Stillgelegt.** Kein Gate, kein Metering. `ai_calls_monthly` + `ai_tokens_monthly` sind die tatsächlichen Metriken. Zu dokumentieren als **bewusste Ablösung**, nicht als fehlendes Feature |
| 3 | `limit.evidence_storage_gb` | **Berechtigung jetzt** für alle sieben Pläne gemäß `plan.limits.evidenceStorageGb`. **Nicht jetzt**: Storage-Scanner, Byte-Metering, Überschreitungslogik, Overage-Billing. Eigenes Arbeitspaket |
| 4 | `limit.api_calls_monthly` | **Beides, orthogonal.** Stundenlimit je API-Schlüssel = Missbrauchsschutz (`429`). Monatsgrenze je Tenant = kommerzielles Entitlement. Langfristig auf **eine** kanonische Verbrauchsquelle zusammenführen, sonst entstehen erneut zwei Wahrheiten |
| 5 | `limit.domains` / `limit.bots` | **DB-Trigger + Bestandsschutz.** Bestand bleibt, `INSERT` wird gegen das aktuelle Entitlement geprüft. Niemals vorhandene Zeilen löschen |
| 6 | `webhooks.enabled` | **Aufgenommen — als Feature-Gate, nicht als Kontingent.** Bekommt einen echten Enforcement-Point. Ausdrücklich **nicht** rückwirkend eines der sieben Kontingente |

Unberührt bleiben: `sla.priority` (organisatorische Zusage, kein Gate), die
übrigen sechs `DISPLAY_ONLY`-Keys (keine automatische Gate-Annahme) und die
sieben `UNKNOWN`-Keys (bleiben `UNKNOWN`, bis Verhalten oder
Produktentscheidung geklärt ist). Belege: `entitlement-reality-map.md`.

---

## 6. Der Guard

`npm run check:limits` (`scripts/check-limit-canonicity.mjs`) vergleicht beide
Seiten bei jedem Lauf.

Er ist bewusst eine **Ratsche**, keine Schranke:

| Fall | Verhalten |
|---|---|
| Divergenz steht in der Grundlinie | INFO, Code 0 |
| Divergenz neu hinzugekommen | **FAIL**, Code 1 |
| Divergenz aus der Grundlinie verschwunden | **FAIL**, Code 1 — Grundlinie pflegen |

Warum nicht sofort rot: Die Bereinigung ist eine Entscheidung mit
Bestandskundenwirkung (§4). Ein Guard, der sie erzwingt, würde sie als
Nebenwirkung eines grünen CI-Laufs treffen — genau die Vermischung von Audit
und Reparatur, die vermieden werden soll. Bis dahin verhindert die Ratsche das
Einzige, was ohne Entscheidung passieren kann: **neue** Divergenzen.

Die Grundlinie steht in `scripts/limit-canonicity-baseline.json` — 21 Zeilen,
jede mit Plan, Feld, beiden Werten, Richtung und Grund.

Beide Richtungen sind mutationsgeprüft: eine künstlich eingebaute Divergenz
(`growth.domains` 3→4) und eine künstlich behobene (`starter.seats` 1→3)
lassen den Guard fallen, der unveränderte Stand nicht.

---

## 7. Was als Nächstes ansteht — und in welcher Reihenfolge

1. **Enterprise klären** (Klasse A). Ohne diese Antwort ist die kanonische
   Quelle für acht Werte unbestimmt.
2. **Bestandsregel vor Wertkorrektur.** Erst der Trigger-Mechanismus mit
   Bestandsschutz (Entscheidung 5), dann die drei Kürzungen auf verkauften
   Plänen (Klasse B) — nicht umgekehrt.
3. **Die neun Ausweitungen** (Klasse D) können unabhängig davon laufen; sie
   nehmen niemandem etwas.
4. **Erst danach Gates.** `team_seats`, `compliance_exports_monthly`,
   `domains`/`bots`, `webhooks.enabled`.

Der Grund für diese Reihenfolge steht in der Entscheidung selbst: Sonst
entsteht technisch korrektes Enforcement gegen eine falsche Zahl — der Fehler,
den dieser Audit gerade gefunden hat.
