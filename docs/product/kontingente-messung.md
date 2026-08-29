# Die sieben unbewachten Kontingente — Messung

**Stand: 2026-08-25, gemessen auf `1690dc8`.** Read-only: kein Code geändert,
keine Migration ausgeführt, kein Stripe-Objekt angefasst.

Auftrag: für jedes der sieben Kontingente aus
`claims-reality-audit.md` §1.1 zehn Fragen beantworten, **bevor** etwas
implementiert wird. Der Eigentümer hat dazu eine Einteilung vorgeschlagen —
sie wird hier gegen die Messung gehalten, nicht übernommen.

---

## 0. Der Blocker: Preisseite und Berechtigung nennen verschiedene Zahlen

Vor jeder Einzelfrage steht ein Befund, der alle sieben betrifft.

Jedes Kontingent existiert **zweimal**: als `plan.limits.<feld>` in
`shared/pricing.ts` (das ist, was der Kunde auf der Preisseite liest) und als
`limit.<key>` in `product_entitlements` (das ist, wogegen ein Gate prüfen
würde). Gemessen über alle sieben Pläne und sieben Felder: **15 von 42 Paaren
weichen ab.**

Auf den Plänen, die heute verkauft werden:

| Plan | Feld | Preisseite | Berechtigung |
|---|---|---:|---:|
| Starter | Sitze | **1** | **3** |
| Starter | Compliance-Exporte | **2** | **5** |
| Growth | Compliance-Exporte | **12** | **20** |

Auf Enterprise und Partner ist es größer: `seats` 50 gegen unbegrenzt,
`domains` 25 gegen unbegrenzt, `api_calls` 250.000 gegen unbegrenzt, bei
Partner 1.000.000 gegen 100.000 — dort steht die Berechtigung **unter** der
Zusage.

**Das ist der Grund, warum hier noch nichts implementiert werden darf.** Ein
Gate prüft gegen die Berechtigung. Ein Starter-Kunde liest „1 Sitz" und
bekäme drei; ein Partner liest „1 Mio. API-Aufrufe" und würde bei 100.000
abgewiesen. Beides wäre schlimmer als der heutige Zustand, in dem gar nicht
geprüft wird — denn heute stimmt wenigstens niemand ab, morgen widerspräche
die Software der Rechnung.

Genau diese Klasse von Widerspruch war der Anlass für AP1. Sie ist bei den
booleschen Keys behoben und bei den Zahlen offen geblieben, weil AP1 nur
Vorhandensein verglichen hat, nicht Werte.

> **Zu entscheiden, bevor irgendein Kontingent ein Gate bekommt:** Welche der
> beiden Zahlen gilt? Danach zieht die andere nach, und ein Test hält sie
> zusammen — so wie `check:entitlements` es für die Existenz schon tut.

---

## 1. Die Messung, Kontingent für Kontingent

Zehn Fragen je Kontingent, verkürzt auf die Antworten, die etwas ändern.

### 1.1 `limit.team_seats` — Sitze

| Frage | Antwort |
|---|---|
| Planwert | `plan.limits.seats` **und** `limit.team_seats` — **abweichend auf Starter, Enterprise, Partner** |
| Verbrauchsstelle | `tenant-invite` (Edge Function), `memberships.insert` beim Annehmen der Einladung |
| Usage-Counter | nein — und richtig so: Sitze sind ein **Bestand**, kein Monatsverbrauch. `COUNT(*)` statt `usage_events` |
| Enforcement-Point | **keiner** |
| Monatsgrenze | nein |
| Stripe/Metering | nein |
| Bei Überschreitung | nichts, das Mitglied entsteht |
| Upgrade wirkt | sofort — Bestandsprüfung liest den neuen Wert beim nächsten Versuch |
| Tests | keine |
| Echtes Versprechen | ja, steht auf der Preisseite |

**Bewertung: Prüfpunkt nachrüsten — stimmt mit dem Vorschlag überein.** Es
gibt genau einen serverseitigen Ort, `tenant-invite`. Die Prüfung ist ein
`COUNT(*)` gegen `memberships`, kein `consumeUsage()`: Ein Sitz wird nicht
verbraucht, er wird belegt und wieder frei.

### 1.2 `limit.domains` — Domains

| Frage | Antwort |
|---|---|
| Planwert | `plan.limits.domains` und `limit.domains` — abweichend auf Enterprise, Partner |
| Verbrauchsstelle | **`websites` wird im Browser angelegt** (`src/features/governance/scans/scansApi.ts`), geschützt nur durch RLS |
| Usage-Counter | nein, Bestand |
| Enforcement-Point | keiner |
| Bei Überschreitung | nichts |
| Tests | keine |

**Bewertung: Prüfpunkt nachrüsten ja — aber nicht dort, wo der Vorschlag ihn
vermutet.** Es gibt keinen Edge-Function-Pfad, den man ergänzen könnte. Die
Zeile entsteht direkt aus dem Browser. Ein Gate braucht deshalb einen
**Datenbank-Trigger** (oder eine RLS-Policy mit Unterabfrage) — also eine
Migration, keinen Function-Patch. Das ist eine andere Art von Arbeit und ein
anderes Risiko: Ein Trigger, der falsch greift, blockiert Bestandskunden
beim Anlegen.

### 1.3 `limit.bots` — Bots

| Frage | Antwort |
|---|---|
| Planwert | `plan.limits.bots` und `limit.bots` — abweichend nur auf Enterprise (20 gegen unbegrenzt) |
| Verbrauchsstelle | **`createBot()` im Browser** (`src/features/bots/api.ts`), Insert über RLS |
| Usage-Counter | nein, Bestand |
| Enforcement-Point | keiner |
| Upgrade wirkt | sofort |
| Tests | keine |

**Bewertung: wie `domains` — Trigger, nicht Function.** Beide teilen dasselbe
Muster und sollten dieselbe Lösung bekommen; zwei verschiedene Mechanismen
für dieselbe Frage wären der Anfang der nächsten Divergenz.

### 1.4 `limit.compliance_exports_monthly` — Compliance-Exporte

| Frage | Antwort |
|---|---|
| Planwert | `plan.limits.auditReportsPerMonth` und `limit.compliance_exports_monthly` — **abweichend auf Starter (2/5), Growth (12/20), Agency, Enterprise** |
| Verbrauchsstelle | `governance-audit-report-gen`, `audit-report-pdf` — beides Edge Functions |
| Usage-Counter | nein |
| Enforcement-Point | keiner; beide Functions enthalten **null** Entitlement-Code |
| Monatsgrenze | ja, im Namen und in `usage_limits_config` als `included` |
| Stripe | nein |
| Tests | keine |

**Bewertung: Prüfpunkt nachrüsten — der sauberste der sieben.** Zwei
Edge Functions, ein etabliertes Muster (`consumeUsage()`), eine echte
Monatsgrenze. Hier gibt es nichts zu erfinden. Blockiert allein durch §0:
Zwei gegen fünf ist ein Faktor 2,5.

### 1.5 `limit.llm_queries_monthly` — LLM-Abfragen

| Frage | Antwort |
|---|---|
| Planwert | nur `limit.llm_queries_monthly` (Starter 100, Growth 500, darüber unbegrenzt) — **kein Gegenstück in `plan.limits`** |
| Verbrauchsstelle | **keine.** Der Key kommt ausschließlich in Migrationen vor — nicht in `src/`, nicht in `supabase/functions/` |
| Usage-Counter | keiner |
| `usage_limits_config` | **kein Eintrag** — im Gegensatz zu allen anderen |
| Tests | keine |

**Bewertung: hier weiche ich vom Vorschlag ab.** `metered` ist die richtige
Antwort für einen Verbrauch, den man misst. Diesen gibt es nicht — und er
wird auch nicht gebraucht: Der LLM-Verbrauch läuft bereits über
`limit.ai_calls_monthly` und `limit.ai_tokens_monthly`, **beide hart
durchgesetzt** (`_shared/ai.ts`, Vorprüfung → 402).

`limit.llm_queries_monthly` sieht nach einem **Vorläufer** aus, den
`ai_calls_monthly` abgelöst hat: gleiche Bedeutung, kein Konfigurationseintrag,
keine Aufrufstelle, keine Werte in `plan.limits`. Ihn jetzt zu verdrahten
hieße, ein zweites Zählwerk für dieselbe Sache zu bauen.

**Vorschlag: als abgelöst kennzeichnen, nicht löschen** (Regel: nichts
entfernen, nur weil es nicht mehr Teil eines Pakets ist) — und die Zahl von
der Preisseite nehmen, falls sie dort steht. Das ist eine Entscheidung, keine
Messung; sie gehört Ihnen.

### 1.6 `limit.evidence_storage_gb` — Nachweisspeicher

| Frage | Antwort |
|---|---|
| Planwert | `plan.limits.evidenceStorageGb` für **alle sieben** Pläne (0,5 bis 500 GB) — das Entitlement dagegen **nur auf `governance_launch`** |
| Verbrauchsstelle | keine Messung im Repo; kein Byte-Zähler |
| Usage-Counter | keiner |
| Enforcement-Point | keiner |
| Stripe | nein |
| Tests | keine |

**Bewertung: `metered` ist das richtige Ziel — aber es fehlt die
Voraussetzung.** Metering setzt eine Messgröße voraus, und die gibt es nicht:
Niemand zählt belegte Bytes. Der erste Schritt ist deshalb nicht das Metering,
sondern die **Messung** (Größe je Tenant aus dem Storage-Bucket bzw. aus
`audit_evidence`), und zwar als eigener Schritt mit eigenem Ergebnis.

Dazu kommt eine zweite Lücke: Sechs von sieben Plänen versprechen
Speicherplatz, ohne dass eine Berechtigung dazu existiert. Bevor gemetert
wird, gehört sie angelegt — sonst misst man gegen nichts.

### 1.7 `limit.api_calls_monthly` — API-Aufrufe

| Frage | Antwort |
|---|---|
| Planwert | `plan.limits.apiCallsPerMonth` und `limit.api_calls_monthly` — **abweichend auf Agency, Enterprise, Partner** (Partner: 1.000.000 gegen 100.000) |
| Verbrauchsstelle | `api-gateway` (Drittanbieter-Zugriffe), `api-audit` |
| Usage-Counter | **zwei, konkurrierend**: `api_usage` (vom Gateway) und `api_calls` (von `api-audit`). Keiner davon ist `usage_events` |
| Enforcement-Point | **es gibt einen** — aber einen anderen: `api-gateway` prüft `api_keys.rate_limit_requests` **pro Stunde** gegen `api_usage` und antwortet mit `429` |
| Monatsgrenze | nein — die bestehende Grenze ist stündlich und je Schlüssel, nicht monatlich und je Plan |
| Stripe | `usage_limits_config` führt den Key als `metered`, eine Anbindung existiert nicht |
| Tests | keine |

**Bewertung: `metered` ja — aber der Ausgangspunkt ist ein anderer als
gedacht.** Es wird nicht bei null angefangen. Es gibt bereits eine
Durchsetzung, zwei Zählwerke und einen Planwert, der an keines von beiden
angebunden ist. Die Arbeit ist deshalb **Zusammenführung**, nicht Neubau —
und die erste Frage lautet, ob das Stundenlimit je Schlüssel und die
Monatsgrenze je Plan nebeneinander bestehen sollen (beide haben ihren Sinn:
das eine gegen Lastspitzen, das andere gegen Mengenmissbrauch).

---

## 2. Zusammenfassung: Vorschlag gegen Messung

| Kontingent | Vorschlag | Messung bestätigt? | Was anders ist |
|---|---|---|---|
| `team_seats` | Prüfpunkt | **ja** | Bestandsprüfung (`COUNT`), nicht `consumeUsage` |
| `domains` | Prüfpunkt | **ja, anderer Ort** | Browser-Insert → **DB-Trigger**, keine Edge Function |
| `bots` | Prüfpunkt | **ja, anderer Ort** | dito |
| `compliance_exports_monthly` | Prüfpunkt | **ja** | — der sauberste Fall |
| `llm_queries_monthly` | `metered` | **nein** | Kein Verbrauch, kein Zähler, abgelöst von `ai_calls_monthly` → stilllegen statt metern |
| `evidence_storage_gb` | `metered` | **ja, aber später** | Es fehlt jede Speichermessung **und** die Berechtigung auf sechs Plänen |
| `api_calls_monthly` | `metered` | **ja, anderer Ausgangspunkt** | Es gibt bereits ein Stundenlimit und zwei Zählwerke — Zusammenführung, kein Neubau |

Die drei Klassen aus dem Auftrag halten der Messung stand. Nur die Zuordnung
verschiebt sich in drei Fällen, und einer fällt ganz heraus.

---

## 3. Was zu entscheiden ist, bevor Code entsteht

1. **§0 — welche Zahl gilt?** Preisseite oder Berechtigung. Fünfzehn Paare,
   drei davon auf verkauften Plänen. Ohne diese Entscheidung prüft jedes Gate
   gegen einen Wert, den der Kunde nirgends liest.
2. **`llm_queries_monthly`** — abgelöst kennzeichnen oder doch verdrahten?
3. **`evidence_storage_gb`** — Berechtigung für die übrigen sechs Pläne
   anlegen, und die Speichermessung als eigenen Schritt planen.
4. **`api_calls_monthly`** — Stundenlimit je Schlüssel und Monatsgrenze je
   Plan nebeneinander, oder eines ersetzt das andere?
5. **`domains` und `bots`** — Trigger als Mechanismus bestätigen. Ein Trigger
   greift auch bei Bestandskunden, die heute über ihrem Wert liegen; ob deren
   vorhandene Zeilen bleiben (ja) und ob sie neue anlegen dürfen (nein) ist
   eine Produktentscheidung.

**Erst danach Code.** Diese Datei ist Messung und Vorschlag, keine Umsetzung.
