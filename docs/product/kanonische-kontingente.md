# Kanonische Kontingente — Entscheidung, Diff und Bestandsrisiko

**Stand: 2026-08-25, gemessen auf `aee1980`.** Schritte 1–4 des
Canonical-Entitlement-AP. Schritt 5 (Gates bauen) ist ausdrücklich **nicht**
Teil dieser Datei: kein Planwert geändert, kein Entitlement repariert, kein
Trigger gesetzt, kein bestehendes Gate angefasst.

---

## 1. Die Entscheidung

Am 2026-08-25 hat der Eigentümer die kanonische Quelle festgelegt — in **zwei
Schritten**, weil die erste Fassung für Vertragspläne zu grob war.

### 1.1 Die erste Fassung

> `plan.limits.*` ist die kanonische kommerzielle Quelle. Was dem Kunden
> verkauft und angezeigt wird, ist der maximal durchsetzbare Wert.

### 1.2 Die Verfeinerung — Planart entscheidet

Der Diff aus §3 hat gezeigt, dass diese Regel wörtlich angewandt einen
individuell verhandelten Enterprise-Vertrag durch die öffentliche Preisseite
gedeckelt hätte. Die endgültige Regel:

| Planart | Kanonische Quelle |
|---|---|
| **Self-Service / öffentlich verkauft** (`free`, `starter`, `growth`; ebenso die stillgelegten `agency`, `partner`) | `plan.limits` — die veröffentlichte Preisseite |
| **Enterprise / individuell vertraglich** (`availability: 'contract'`) | **der Vertrag**, nicht die öffentliche Preisseite |
| **Technisches Entitlement** (`PLAN_ENTITLEMENTS['limit.*']`, `product_entitlements`) | abgeleitet aus der jeweils kanonischen kommerziellen Quelle — **nie selbst die Wahrheit** |
| **Gate** | darf **erst** gegen einen eindeutig kanonischen Wert prüfen |

Das schließt zwei Fehler in beide Richtungen aus:

- Enterprise darf **nicht** durch die öffentliche Preisseite gedeckelt werden,
  wenn der Vertrag höhere Kontingente vorsieht.
- Die höhere technische Berechtigung darf **nicht** als Vertragsrecht
  ausgelegt werden. `-1` in der Datenbank ist kein Beleg für eine Zusage.

### 1.2a Wie die Regel ausführbar wurde — Entscheidung vom 2026-08-31

§1.2 war ein Jahr lang spezifiziert und nicht ausführbar: Das Schema kennt
keinen Ort für einen vertragsspezifischen Wert (§4a). Der Eigentümer hat sich
am 2026-08-31 für **Option A** aus
`enterprise-quelle-entscheidungsvorlage.md` entschieden — die Kodierung wird
benannt, statt einen Ort dafür zu bauen:

> Auf Plänen mit `availability: 'contract'` bedeutet `-1` bei einem
> `limit.*`-Key: **Das System begrenzt hier nicht. Der Vertrag tut es.**

Das ist ausdrücklich **keine** Auflösung der Quelle. Der Vertrag liegt dem
System weiterhin nicht vor; §1.4 gilt unverändert, auf diesen acht Feldern
entsteht kein Gate. Was sich ändert: Der Satz zwei Absätze weiter oben —
„`-1` ist kein Beleg für eine Zusage" — gilt weiter für Self-Service-Pläne,
auf Vertragsplänen ist `-1` jetzt die festgelegte Kodierung des Vorbehalts.

**Der Preis dieser Entscheidung, offen benannt:** Unter A ist jeder
Enterprise-Vertrag technisch unbegrenzt. Ein Vertrag mit vereinbarter
**Obergrenze** („bis zu 50 Sitze") ist nicht durchsetzbar und damit nicht
abschließbar, ohne vorher auf **Option B** (Tenant-Overrides) zu wechseln.
Der erste solche Vertrag ist der benannte Auslöser dafür — die Frage
verschwindet nicht, sie bekommt einen Termin.

**Die Bedingung, gemessen statt behauptet** (2026-08-31, Live-Projekt
`ebljyceifhnlzhjfyxup`): 0 Enterprise-Verträge, 0 `entitlement_grants`,
5 Tenants, 5 Subscriptions. A wird also für null Bestandsfälle gewählt und
bleibt umkehrbar; B und C hätten heute Schema bzw. Katalog angefasst, um ein
Problem zu lösen, das noch kein Kunde hat.

**Woran es hängt:** `test/billing/limit-canonicity.test.ts`, Fall
„Vertragspläne tragen ausschliesslich `-1` als Kontingent". Er schlägt fehl,
sobald ein Vertragsplan einen endlichen `limit.*`-Wert bekommt — das ist die
maschinelle Meldung, dass der Auslöser für B eingetreten ist.

### 1.3 Die Schutzklausel

> Bei Bestandskunden darf die Korrektur **nicht stillschweigend als Downgrade**
> wirken. Wo ein Kunde heute aufgrund eines höheren bestehenden Entitlements
> mehr nutzen kann, ist vor der Reduktion zu klären, ob dieses höhere Recht
> vertraglich oder kommunikativ zugesagt wurde.

### 1.4 Die Reihenfolge

> **Canonical Entitlements → Datenbereinigung → Gates → Tests.** Nicht
> andersherum. Kein neues Enforcement gegen einen Wert, dessen kanonische
> Quelle nicht aufgelöst ist.

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

### 3.1 Preisseite ist **strenger** (12)

Bei den vier Nicht-Vertragsplänen kürzt die Korrektur; bei den acht
Enterprise-Zeilen sagt sie nichts, weil dort der Vertrag gilt (§4).

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

Alle neun auf stillgelegten, aber öffentlich verkauften Plänen; Preisseite
ist kanonisch.

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

## 4. Die 21 Divergenzen, neu bewertet gegen die verfeinerte Regel

Die Planart entscheidet, welche Spalte überhaupt eine Wahrheit enthält.

| Klasse | Anzahl | Kanonische Quelle | Auflösung |
|---|---:|---|---|
| **A** — Enterprise | 8 | **Vertrag** | **unbestimmt** — keine der beiden Spalten gilt |
| **B** — Starter, Growth | 3 | Preisseite | Datenfehler; Korrektur auf den Preisseitenwert |
| **C** — Agency (Kürzung) | 1 | Preisseite | wie B, nur Bestandskunden |
| **D** — Agency, Partner (Ausweitung) | 9 | Preisseite | Korrektur weitet aus, niemand verliert |

### Klasse A — Enterprise: unbestimmt, nicht „gekürzt" ⚠️

Die alte Fassung dieses Abschnitts nannte diese acht Fälle „Enterprise
verliert unbegrenzt". Unter der verfeinerten Regel ist das **falsch
formuliert**: Enterprise verliert nichts, weil die Preisseite hier gar nicht
kanonisch ist. Die richtige Aussage ist:

> Für diese acht Werte ist die kanonische Quelle der Vertrag — und der liegt
> dem System nicht vor. Der Wert ist **unbestimmt**, bis er es tut.

Weder die 20 der Preisseite noch das `-1` der Berechtigung darf als Wahrheit
gesetzt werden. Ein Gate auf diesen acht Feldern ist damit für Enterprise
**blockiert**, nicht nur ungeklärt.

### Klasse B — die drei Kürzungen auf verkauften Self-Service-Plänen

`starter.seats` 3→1, `starter.auditReports` 5→2, `growth.auditReports` 20→12.

Hier ist die öffentliche Zusage eindeutig, also ist die Divergenz ein
**Datenfehler**. Die Anweisung des Eigentümers lautet, ihn „zugunsten des
Kunden" zu behandeln. Meine Lesart — ausdrücklich als Lesart gekennzeichnet,
weil der Satz zwei Deutungen zulässt:

- Der **kanonische Wert** ist der Preisseitenwert (1 Sitz, 2 bzw. 12 Exporte).
  Die Regel aus §1.2 lässt hier nichts anderes zu.
- „Zugunsten des Kunden" betrifft den **Übergang**: Wer heute drei Mitglieder
  hat, verliert keines. Bestand bleibt, Neuanlage wird geprüft — genau die
  Bestandsregel aus Entscheidung 5.

Daraus folgt eine Reihenfolge, die nicht umkehrbar ist: **erst** der
Bestandsschutz-Mechanismus, **dann** die Wertkorrektur. Umgekehrt stünde ein
Starter-Tenant mit drei Mitgliedern nach der Korrektur über dem Limit, ohne
dass eine Regel ihn schützt.

Sollte stattdessen gemeint gewesen sein, dass der **höhere** Wert gilt, wäre
das eine Änderung der Preisseite und keine Datenbereinigung — dann bitte
widersprechen.

#### ✅ Erledigt am 2026-09-01 — korrigiert, ohne Mechanismus

Die Reihenfolge oben setzt voraus, dass es jemanden zu schützen gibt. Vor der
Entscheidung gemessen, gegen das Live-Projekt `ebljyceifhnlzhjfyxup`:

| | |
|---|---:|
| Starter-Abos | **0** |
| Growth-Abos | 1, Status **`past_due`** |
| `usage_counters` · `usage_events` · `usage_totals` | 0 · 0 · 0 |
| `feature_usage` · `quota_alerts` · `audit_jobs` | 0 · 0 · 0 |
| Mitglieder je Tenant | **genau 1** bei allen fünf |

**Es gibt niemanden zu schützen.** Die Sitzplatz-Kürzung von 3 auf 1 träfe
selbst dann keinen Tenant, wenn ein Starter-Abo existierte — kein Workspace hat
ein zweites Mitglied. Kein Kunde verliert eine Fähigkeit, die er heute nutzt.

Der Eigentümer hat deshalb entschieden, **jetzt zu korrigieren und keinen
Bestandsschutz-Mechanismus zu bauen**. Umgesetzt in
`20260903050000_align_starter_growth_quota_entitlements.sql`; die Werte in
`PLAN_ENTITLEMENTS` und in `product_entitlements` stehen jetzt auf der
Preisseite.

**Warum kein Mechanismus** — ein struktureller Befund, der hier festgehalten
gehört: `entitlement_grants` ist **produktförmig**. `product_id`, `plan_key`
und `purchase_reference` sind `NOT NULL`; eine Spalte für Entitlement-Key oder
Wert gibt es nicht. Die Tabelle kann „dieser Tenant behält `team_seats = 3`"
gar nicht ausdrücken. Ein Override je Schlüssel hätte eine Schemaänderung
gebraucht — für null bis einen Bestandsfall.

**Falls er später doch gebraucht wird**, ist die Richtung günstig: Ein
Bestandsschutz muss einen Wert *anheben*, und der Auflöser führt mit
`CASE WHEN bool_or(value = -1) THEN -1 ELSE MAX(value) END` zusammen — ein
anhebender Grant gewinnt von selbst, ohne dass die Regel gebrochen werden
muss. Das ist der Unterschied zum Enterprise-Fall (§1.2a), wo ein Override
hätte *senken* müssen.

**Der Preis dieser Entscheidung:** Das Fenster war offen, weil niemand
betroffen war. Es schließt mit dem ersten zahlenden Starter- oder
Growth-Kunden. Käme die Divergenz zurück, wäre die Korrektur dann ein echtes
Downgrade und §1.3 griffe erneut — diesmal mit Bestandskunden. Dagegen sichert
`test/billing/limit-canonicity.test.ts`, Fall „führt keine Kürzung mehr auf
verkauften Self-Service-Plänen".

### Klasse C und D — die stillgelegten Pläne

Agency und Partner wurden öffentlich verkauft, also ist die Preisseite auch
für sie kanonisch. Neun Fälle weiten aus (niemand verliert), einer kürzt
(`agency.auditReports` 100→50, nur Bestandskunden).

Bemerkenswert an D: Bei Partner ist die **Preisseite die großzügigere** —
`apiCallsPerMonth` 1.000.000 gegen 100.000. Die Regel „Preisseite ist
kanonisch" schneidet also in beide Richtungen; sie ist keine Sparmaßnahme.

---

## 4a. Der strukturelle Befund: es gibt keinen Ort für einen Vertragswert

Die Regel „für Enterprise ist der Vertrag kanonisch" setzt voraus, dass das
System einen vertragsspezifischen Wert **speichern** kann. Gemessen am Schema:
**kann es nicht.**

`tenant_entitlements()` löst ausschließlich über Produkte auf:

```
subscriptions.stripe_price_id ─┐
                               ├─→ products ─→ product_entitlements ─→ entitlements
entitlement_grants.product_id ─┘
```

`entitlement_grants` gewährt ein **ganzes Produkt** (`product_id`), nicht
einen einzelnen Key mit einem eigenen Wert. Eine Tabelle für
tenant-spezifische Überschreibungen existiert nicht — geprüft, nicht
geschlossen: keine Fundstelle für `tenant_entitlement_overrides`,
`entitlement_override` oder `contract_limit` in Migrationen, `src/` oder
`supabase/functions/`.

Die Zusammenführungsregel lautet zudem `-1 gewinnt, sonst MAX`. Ein Grant
könnte einen Wert also nur **anheben**, nie senken.

### Was das für die Regel bedeutet

Drei Wege, keiner entschieden — Abwägung mit gemessenen Kosten in
`docs/product/enterprise-quelle-entscheidungsvorlage.md`:

- **A** — `-1` offiziell als „vertraglich geregelt / unbegrenzt" spezifizieren
- **B** — Tenant-Overrides (`tenant × entitlement_key × value`)
- **C** — ein Produkt je Vertragsvariante

Die Messung, die dort die Auswahl verschiebt: Es gibt **null**
Enterprise-Verträge (Live-Projekt, 2026-08-25). B und C lösen damit ein
Problem, das heute niemand hat.

**Bis zur Entscheidung gilt:** Die Enterprise-Regel ist **spezifiziert und
unimplementiert**. Sie darf nicht als Fachlogik behandelt werden — der
Auflöser kann sie nicht deterministisch ausführen, solange kein
vertragsspezifischer Wert persistierbar ist.

### Eine Lesart des Ist-Zustands, ausdrücklich als Lesart

Dass Enterprise heute in acht Feldern `-1` trägt, ist unter der neuen Regel
**nicht sinnlos**: `-1` ist genau die Kodierung von „das System begrenzt hier
nicht — der Vertrag entscheidet". Möglich, dass die Divergenz nie ein Fehler
war, sondern die einzige Ausdrucksform, die das Schema für „vertraglich
geregelt" anbietet.

Ich kann das nicht belegen — es gibt keinen Kommentar und keine Migration, die
es sagt. Deshalb steht es hier als Lesart und nicht als Befund. Für die
Entscheidung ist es trotzdem erheblich: Trifft sie zu, ist der Ist-Zustand
bereits richtig und es fehlt nur die Dokumentation.

> **Verbindlich, bis Option A ausdrücklich gewählt ist:** `-1` wird **nicht**
> als Vertragswert umgedeutet. Die Deutung bleibt eine Hypothese und steht in
> keinem Code und in keinem Test. Wer sie zur Semantik machen will, wählt
> Option A — und schreibt sie hin.

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

Verbindlich ist die Kette aus §1.4: **Canonical Entitlements →
Datenbereinigung → Gates → Tests.**

1. **Enterprise-Quelle entscheiden** (Klasse A + §4a). Nicht nur „welche Zahl
   gilt", sondern **wo der Vertragswert steht**. Ohne Speicherort ist die
   Regel nicht umsetzbar, sondern nur formuliert. Vorlage mit gemessenen
   Kosten: `enterprise-quelle-entscheidungsvorlage.md`. Das ist ein
   **Architekturentscheid**, kein Wert-Fix — der nächste PR darf nicht
   einfach die Enterprise-Werte korrigieren.
2. **Bestandsschutz vor Wertkorrektur.** Erst der Trigger-Mechanismus
   (Entscheidung 5), dann die drei Kürzungen der Klasse B.
3. **Die neun Ausweitungen** (Klasse D) laufen unabhängig; sie nehmen
   niemandem etwas.
4. **Erst danach Gates**: `team_seats`, `compliance_exports_monthly`,
   `domains`/`bots`, `webhooks.enabled` — und für Enterprise nur auf Feldern,
   deren Quelle aufgelöst ist.

Der Grund für die Reihenfolge steht in der Entscheidung selbst: Sonst entsteht
technisch korrektes Enforcement gegen eine Zahl, die niemand als verbindlich
bezeichnet hat — der Fehler, den dieser Audit gefunden hat.
