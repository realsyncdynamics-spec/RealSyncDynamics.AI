# Market Intelligence MVP

**Stand**: 2026-09-06 · **Branch**: `claude/market-intelligence-mvp-d952g7`
**Route**: `/market-intelligence` (Super-Admin) · **Bewertung**: `src/core/market-intelligence/score.ts`

---

## 1. Ausgangslage — gemessen, nicht vermutet

Gemessen am 2026-09-06 gegen das Live-Projekt `ebljyceifhnlzhjfyxup`
(`market_gaps`, `ceo_briefs`, `research_runs`, `cron.job_run_details`):

| Größe | Wert |
|---|---|
| Markt-Lücken | **129** |
| CEO-Briefs | **122** |
| Scanner-Läufe | **129** |
| Cron `market-scanner-daily` | aktiv, `0 6 * * *`, **124 von 124 Läufen erfolgreich** |
| Letzter Lauf | 2026-09-06 06:00 UTC, `success` |

Der Scanner arbeitet also seit dem 2026-05-05 zuverlässig. **Verwertet wurde
davon nichts:**

| Zustand | Anzahl |
|---|---|
| `market_gaps.status = 'identified'` | **129 von 129** |
| `ceo_briefs.status = 'draft'` | **122 von 122** |
| Versendete Briefs | **0** |
| Ältester unversendeter Brief | **124 Tage** |

Der gesamte Bestand steht im Eingangszustand. Es gibt eine Sammelstelle, aber
keine Auswertung — genau der Fall aus CLAUDE.md §14: fertige Arbeit, die
niemand erreicht.

## 2. Der eigentliche Befund: Die Scanner-Kennzahlen trennen kaum

`market-scanner` lässt das Modell vier Kennzahlen selbst vergeben. Alle vier
sind nahezu konstant:

| Feld | Verteilung (129 Zeilen) | effektive Werte¹ | Urteil |
|---|---|---|---|
| `urgency_score` | 89× 9 · 36× 8 · 2× 7 · 2× 10 | **2,1** | schwach |
| `revenue_potential` | 117× high · 7× medium · 5× very_high | **1,45** | entartet |
| `build_complexity` | 124× medium · 4× low · 1× high | **1,20** | entartet |
| `stripe_model` | 124× subscription · 5× metered | — | entartet |

¹ Perplexität (2^H) statt Anteil des häufigsten Wertes. Der Unterschied ist
nicht kosmetisch: Bei `urgency_score` deckt der häufigste Wert nur 69 %, eine
Schwelle auf den Spitzenanteil hätte das Feld durchgewunken. Effektiv sind es
2,1 Stufen für 129 Einträge, weil die beiden Ausreißer mit je zwei Zeilen
nichts trennen. Die Perplexität sieht genau das.

**Folge**: Eine Rangliste, die überwiegend auf diesen Selbstbewertungen
beruht, wäre vorgetäuschte Genauigkeit. Sie würde sortieren, nicht
priorisieren.

## 3. Was stattdessen trägt — und was nicht funktioniert hat

Der erste Entwurf gewichtete **`reach`**: Wiederkehr einer Job-Kategorie über
**Branchen** hinweg. Gegen den Live-Bestand gemessen ist dieses Signal
**leer** — keine einzige Kategorie kommt in mehr als einer Branche vor. Das
ist kein Datenfehler, sondern die Bedeutung des Feldes: Es enthält
branchengebundene Rollentitel („Sachbearbeiter Bauamt / Ordnungsamt" gibt es
nur in Behörden). Ein Token-Vergleich fand nur Allerweltswörter — „manager" in
fünf Branchen, also Rauschen.

Getragen hat stattdessen **`corroboration`**: die Zahl **verschiedener
Scan-Tage**, an denen dieselbe Job-Kategorie unabhängig gefunden wurde. Der
Scanner läuft genau einmal täglich, ein Tag ist also ein Lauf; zwei Zeilen aus
demselben Lauf zählen nicht doppelt.

| Bestätigt an … Tagen | Job-Kategorien |
|---|---|
| 8 · 7 · 6 · 5 · 4 | je 1 |
| 3 | 5 |
| 2 | 11 |
| 1 | 62 |

Das streut und ist aus den Daten berechnet, nicht vom Modell behauptet.

> **Ehrlich zur Deutung**: Wiederholte Wiederentdeckung kann zweierlei heißen —
> ein hartnäckiges, immer wieder bestätigtes Problem, oder schlicht ein
> Scanner, der sich wiederholt. Beides ist aus den Daten allein nicht zu
> trennen. Deshalb führt `corroboration` die Gewichtung zwar an, aber nicht
> beherrschend, und das Cockpit weist die Zahl als „an N Tagen unabhängig
> bestätigt" aus, statt sie als Marktbreite auszugeben.

## 4. Gewichte — versionsrelevant

```
corroboration 0.25   ← korpus-berechnet, nicht behauptet
demand        0.25   ← Urgency, rangbasiert auf der beobachteten Werteleiter
revenue       0.20
feasibility   0.15   ← invers zur Baukomplexität
freshness     0.15   ← Halbwertszeit 72 Tage (= 6 Rotationszyklen)
```

`demand` normiert **rangbasiert**, nicht absolut: Bei einem Korpus, der nur
7–10 vergibt, würde `urgency/10` alles zwischen 0,7 und 1,0 stauchen.

> **Regel** (analog zu den gdpr-audit-Scoring-Gewichten, CLAUDE.md §5): Diese
> Gewichte und die Ordinal-Stufen bestimmen die Vergleichbarkeit jeder
> bisherigen Priorisierung. Wer sie ändert, entscheidet darüber — das gehört
> entschieden, nicht nebenbei geändert. Gepinnt durch
> `test/market-intelligence/score.test.ts`.

`demand` und `revenue` bleiben trotz schwacher Aussagekraft enthalten, damit
die Bewertung sich sofort schärft, falls der Scanner künftig differenzierter
urteilt — ohne dass die Gewichte erneut angefasst werden müssen.

## 5. Umfang der Änderung

Alles **additiv** (CLAUDE.md §10 — Hinzufügen ist ohne Rückfrage erlaubt).
Kein Grid, keine Farbe, keine Typografie, keine Sektionsreihenfolge geändert;
ausschließlich vorhandene Tokens (`obsidian-*`, `titanium-*`, `security-*`,
`rounded-none`). An `/market-gaps` ist nichts verändert.

| Datei | Art |
|---|---|
| `src/core/market-intelligence/score.ts` | neu — reine, abhängigkeitsfreie Bewertung + Trennschärfe-Diagnose |
| `supabase/migrations/20260906120000_market_intelligence_rpc.sql` | neu — `admin_market_intelligence()`, SECURITY DEFINER, super-admin-gated |
| `src/features/market/MarketIntelligenceView.tsx` | neu — Cockpit |
| `src/App.tsx` | + `lazy()`-Import, + Route `/market-intelligence` |
| `src/features/admin/SuperAdminDashboard.tsx` | + zwei Verweise (Market Intelligence, Markt-Lücken) |
| `test/market-intelligence/score.test.ts` | neu — 26 Tests |

Die Verweise im Super-Admin-Dashboard sind kein Beiwerk: `/market-gaps` war
bisher von **keiner** Oberfläche aus verlinkt. Eine Route ohne Einstiegspunkt
ist nach §14 unsichtbar.

### Sicherheit

`admin_market_intelligence()` folgt dem Muster von `admin_system_health()`
(`20260506190000`): `SECURITY DEFINER`, leerer `search_path`, `REVOKE ALL` +
`GRANT EXECUTE` nur für `authenticated`, und im Rumpf die Prüfung auf
`profiles.is_super_admin`. Ohne Admin-Flag kommt `{"error":"forbidden"}`
zurück, **nicht** ein leeres Ergebnis — ein leeres Ergebnis wäre von „keine
Daten" nicht unterscheidbar.

Kein Multi-Tenant-Bezug: `market_gaps` und `ceo_briefs` sind RealSync-internes
Intel ohne `tenant_id`, so angelegt in `20260505200000_market_research.sql`.

### Noch nicht wirksam

Die Migration ist **unverbucht**, bis `deploy.yml` läuft — die Funktion wurde
bewusst **nicht** out-of-band gegen Produktion angewendet (CLAUDE.md §5:
Eingriffe an Repo und CI vorbei sind ein Governance-Befund, auch gute). Die
SQL-Logik ist stattdessen lesend gegen die Live-Daten geprüft worden.

## 6. Offene Punkte — gehören entschieden, nicht nebenbei geändert

1. **Die Selbstbewertung des Scanners ist unbrauchbar.** Der wirksamste Hebel
   liegt nicht im Cockpit, sondern im Prompt von
   `supabase/functions/market-scanner/index.ts`: Solange das Modell 91 % aller
   Lücken „high" nennt, ist das Feld nicht zu retten. Eine erzwungene
   Verteilung (z. B. Bewertung relativ zu den bereits gefundenen Lücken) wäre
   die eigentliche Korrektur. **Das ändert das Befund-Vokabular und ist damit
   versionsrelevant** — nicht ohne Entscheidung.
2. **122 Briefs, 0 versendet.** Ob der Outreach-Pfad kommt oder das Feature
   aufgegeben wird, entscheidet der Eigentümer. Bis dahin erzeugt der Scanner
   täglich weiter Entwürfe, die niemand liest.
3. **Der Triage-Workflow ist ungenutzt.** `market_gaps.status` kennt
   `validated`/`building`/`launched`/`rejected`; `/market-gaps` kann sie
   setzen. Genutzt wurde es bei 129 Zeilen null Mal.
4. **`stripe_model`** wird bewertet, aber nirgends verwendet — 96 %
   `subscription`. Entweder auswerten oder aus dem Prompt nehmen.
