# Gate-Verifikation 2026-09-12 — Deployment, Migrationen, Stripe-E2E

**Gemessen am 2026-09-12**, `main` @ `11c92c4` (#1356). Anlass: Drei Gates
standen auf 🟡 und sollten nicht auf Zuruf, sondern je Gate an einer
Primärquelle geschlossen werden. Zwei ließen sich schließen, eines nicht —
und das dritte scheitert an einem konkreten, benennbaren Befund, nicht an
fehlender Zeit.

Verwandt: `docs/runbooks/deployment-kette-messen.md` (Messung vom 2026-09-06,
gleiche Frage, gleicher Schluss).

---

## 1. Ergebnis vorweg

| Gate | Stand | Belegt durch |
|---|---|---|
| 1 — Cloudflare-Deployment | 🟢 | Marker-String im ausgelieferten Live-Chunk, §2 |
| 2 — Supabase-Migrationen | 🟢 | Vollabgleich Prod ↔ Repo, 0 Differenz, §3 |
| 3 — Stripe-E2E bis `/build` | 🟡 | **nicht** belegt — letzte Zahlungsspur ist 4 Tage älter als der Live-Preiskatalog, §4 |

---

## 2. Gate 1 — Welcher Commit ist live?

### Was hier *kein* Beleg ist

Der Workflow **„Deploy to Cloudflare Pages"** meldete auf `11c92c4`
`success` (Run #1297). Das ist kein Deploy-Beleg. Die Job-Liste desselben
Laufs:

| Job | Ergebnis |
|---|---|
| `Build SPA` | success |
| `Deploy to Cloudflare Pages` | **skipped** |
| `Smoke test live routes` | **skipped** |

Beide hängen an `needs.build.outputs.cf_ready`; ohne hinterlegte
Cloudflare-Zugangsdaten bleiben sie aus. Ausgeliefert wird über die
Cloudflare-Git-Integration. Der Workflow schreibt das selbst in seine
Step-Summary — wer nur den grünen Haken sieht, liest das Gegenteil.

### Was der Beleg ist

Ein Fingerabdruck im ausgelieferten Bundle. `11c92c4` führt den Testid
`build-studio-upgrade` ein; vorher gab es ihn nicht:

```bash
git log --oneline -S'build-studio-upgrade' -- src
# 11c92c4 feat(build): App Builder + Frontend Designer — siteos.* entitlement gates (#1356)
```

Dann von der Live-Seite aus dem Entry-Bundle zum Lazy-Chunk hangeln:

```bash
curl -sS https://realsyncdynamicsai.de/ | grep -oE '/assets/index-[^"]+\.js'
#   /assets/index-D83Qy6G1.js
curl -sS https://realsyncdynamicsai.de/assets/index-D83Qy6G1.js \
  | grep -oE '"assets/BuildStudioPage-[^"]+\.js"'
#   "assets/BuildStudioPage-C014IeUE.js"
curl -sS https://realsyncdynamicsai.de/assets/BuildStudioPage-C014IeUE.js \
  | grep -c 'build-studio-upgrade'
#   1
```

Derselbe Chunk (27.207 Bytes) enthält außerdem `siteos.builder`,
`siteos.publish` und `limit.sites`.

**Schluss:** Die Produktion liefert Code aus, den es vor `11c92c4` nicht gab.
`main` HEAD ist live. Kein Dashboard, kein Screenshot nötig — der Beweis
liegt in der ausgelieferten Datei.

Diese Methode ist wiederverwendbar: Für jeden Commit, der einen neuen
String-Literal einführt, lässt sich so ohne Cloudflare-Zugang prüfen, ob er
live ist.

---

## 3. Gate 2 — Sind die Migrationen durch?

Primärquelle ist die Produktionsinstanz selbst (`ebljyceifhnlzhjfyxup`,
RealSyncDynamicsLive, `eu-central-1`, `ACTIVE_HEALTHY`), nicht ein
Migrations-Log und kein Screenshot.

Abgeglichen wurde `supabase_migrations.schema_migrations` gegen die
Dateinamen in `supabase/migrations/` — **in beide Richtungen**, weil nur eine
Richtung eine in Prod von Hand angewandte Migration nicht sieht:

```
nur_lokal_fehlt_in_prod : 0
nur_in_prod_fehlt_lokal : 0
```

338 Versionen im Repo, 338 in Produktion, deckungsgleich. Die drei jüngsten
entsprechen den letzten Commits auf `main`:

| Version | Name | Commit |
|---|---|---|
| `20260912170000` | `siteos_builder_entitlements` | #1357 |
| `20260912171000` | `canonical_plan_catalog` | #1357 |
| `20260912180000` | `cron_trio_dedicated_keys` | #1355 |

---

## 4. Gate 3 — Stripe-E2E: warum es 🟡 bleibt

Ein echter Checkout bis `/build` lässt sich aus einer Agent-Session nicht
auslösen. Prüfbar ist aber die **Spur**, die ein solcher Durchlauf in
Produktion hinterlassen müsste — und genau die fehlt:

| Quelle | Zeilen | Neuester Eintrag |
|---|---|---|
| `stripe_payment_events` | 18 | 2026-09-08 20:33:41 |
| `webhook_events` | 27 | 2026-09-08 20:33:45 |
| `subscriptions` (aktiv/trial) | 5 | 2026-09-08 20:33:46 |
| `subscriptions` (gesamt) | 6 | 2026-09-01 06:25:45 |
| `entitlement_grants` (aktiv) | 1 | 2026-09-12 07:56:23 |

**Der Befund:** Die letzte Zahlungsspur stammt vom **2026-09-08**. Der
Live-Preiskatalog wurde am **2026-09-12** neu gesetzt
(`20260912055500_stripe_live_catalog_price_ids`), die Builder-Entitlements
ebenfalls (`20260912170000`). Es ist also seit dem Setzen der Live-Price-IDs
**kein einziger Checkout** durchgelaufen. Gate 3 ist nicht „noch nicht
dokumentiert", es ist **noch nicht passiert**.

Der Katalog selbst ist bereit — die Voraussetzung stimmt, nur der Durchlauf
fehlt:

| Plan | Preis | `stripe_price_id` |
|---|---|---|
| Free Audit | 0,00 € | — (korrekt) |
| Starter | 79,00 € | gesetzt |
| Growth | 249,00 € | gesetzt |
| Agency | 699,00 € | gesetzt |
| Enterprise | 1.249,00 € | gesetzt |
| Partner | 1.999,00 € | gesetzt |

### Was Gate 3 schließt

Ein Checkout auf einem der bezahlten Pläne, danach dieselbe Abfrage: Sobald
`stripe_payment_events`, `webhook_events` und `subscriptions` einen Eintrag
**nach dem 2026-09-12 05:55** tragen und der Account `/build` mit gesetztem
`siteos.builder` erreicht, ist das Gate belegt — mit Zeitstempel statt
Zusicherung.

---

## 5. Regel, die daraus folgt

Ein grüner Haken ist keine Quelle. Er ist die Zusammenfassung eines Laufs,
dessen entscheidende Jobs übersprungen sein können — belegt am Gate 1 dieses
Dokuments. Ein Gate schließt nur, was man an der Sache selbst misst: an der
ausgelieferten Datei, an der Produktionsdatenbank, an der Zahlungsspur.
