# Merge-Reihenfolge #1129 → #1140 und die Legacy-Semantik

**Beschluss des Eigentümers vom 2026-08-25.** Festgehalten, weil zwei offene
PRs dieselbe Datei aus derselben Basis umschreiben und die Reihenfolge über
das Ergebnis entscheidet.

---

## 1. Die Lage

| | #1129 | #1140 |
|---|---|---|
| Branch | `claude/realsyncdynamics-funnel-refactor-gzbd4g` | `fix/current-funnel-pricing-frontend` |
| Basis | `1657e23` | `1657e23` — **dieselbe** |
| Inhalt | Entitlement-Governance, Plan-Verfügbarkeit, Legacy-Sperre, Drift- und Kanonizitäts-Gates | Commercial SSoT auf `free_audit → starter → growth → business → enterprise` |
| Umfang | 96 Dateien | 3 Dateien, davon `shared/pricing.ts` −1767 Zeilen |
| Zustand am 2026-08-25 14:15 UTC | **grün**, mergefähig, Draft | **rot** (Lint), Draft |

Beide schreiben `shared/pricing.ts` um. In der jetzigen Form sind sie nicht
beide mergebar.

## 2. Die beschlossene Reihenfolge

```
#1129  →  Merge  →  #1140 rebase  →  Commercial SSoT  →  CI  →  UI/Checkout
```

1. #1129 ist die **Baseline für AP-Canon und Entitlement-Governance**.
2. Vor dem Merge: den grünen Stand bestätigen, nicht annehmen.
3. #1140 danach auf den Merge-Commit von #1129 rebasen.
4. Erst dann die Commercial SSoT auf die neue Leiter umstellen.
5. **Legacy-Pläne werden dabei nicht als Alias auf neue kommerzielle Produkte
   umgebogen** — siehe §4.

UI, Landingpage, Dashboard-CTAs und Checkout-UX kommen zuletzt, nicht
zwischendurch.

## 3. Verifikation des Merge-Stands

Gemessen auf `7df8da6`, dem Head von #1129:

| Prüfung | Ergebnis |
|---|---|
| `npm run lint` | grün |
| `npm run build` | grün, 89 Seiten prerendert |
| `npm test` | **3611 grün**, 0 rot |
| `npm run check:pricing` | Deno-Zwilling und Plan-Katalog synchron |
| `npm run check:limits` | 21 bekannte Divergenzen, keine neue |
| `npm run check:edge-functions` | kein blockierender Drift |
| CI auf GitHub | **14/14 grün** |
| `git merge origin/main` | „Already up to date" — kein Konflikt |
| Basis `main` | unverändert bei `1657e23` |

## 4. Die Legacy-Semantik — und warum #1129 sie schon erfüllt

Der Beschluss lautet:

> Nicht `agency → business`, `partner → enterprise`, sondern `agency →
> Legacy-Agency-Produkt`, `partner → Legacy-Partner-Produkt`, mit
> `availability = legacy` und ohne neuen Checkout. Ein bestehender
> `agency`-Kunde bleibt `agency`. Kein Legacy-Plan wird rückwirkend zu einem
> anderen Produkt umgeschrieben.

Gemessen gegen `shared/pricing.ts` auf `7df8da6`:

| Eingabe | `normalizePlanKey` | `planByKey().id` | Rang | wählbar |
|---|---|---|---:|---|
| `agency` | `agency` | `agency` | 3 | **nein** |
| `agency_yearly` | `agency_yearly` | `agency` | — | **nein** |
| `partner` | `partner` | `partner` | 5 | **nein** |
| `partner_yearly` | `partner_yearly` | `partner` | — | **nein** |
| `scale` | `partner` | `partner` | — | **nein** |

```
PLAN_ORDER    free → starter → growth → agency → enterprise → partner
LEGACY_PLANS  agency(legacy), partner(legacy)
SALES_PLANS   free, starter, growth, enterprise
Entitlements  agency 55 · partner 57   (unverändert)
```

Kein Legacy-Plan wird umgeschrieben; keiner ist wählbar; die Entitlements
bleiben vollständig. Der Verkauf ist an beiden Enden geschlossen —
`stripe-checkout` weist `availability === 'legacy'` mit `PLAN_RETIRED` ab,
`CheckoutPage` leitet vorher auf `/pricing` um.

**Punkt 5 des Beschlusses ist damit keine Änderung an #1129, sondern eine
Korrektur an #1140.** `scale` bleibt als reiner Eingabe-Alias auf `partner`
bestehen — das ist ein Altbezeichner desselben Produkts, kein Umbiegen auf
ein anderes.

## 5. Der Katalog darf keine zweite Wahrheit sein

Die verbindliche Kette:

```
shared/pricing.ts
      ├── supabase/functions/_shared/pricing.generated.ts
      ├── PLAN_ENTITLEMENTS
      ├── Plan-Katalog-Migration (*_canonical_plan_catalog.sql)
      ├── Stripe-Plan-Konfiguration
      └── Drift- und Kanonizitäts-Gates
```

Nicht: SSoT und SQL-Migration nebeneinander mit je eigener Wahrheit.

### Der Vorfall, der die Regel nötig macht

`20260808140000_canonical_plan_catalog.sql` auf `main` führt `agency`,
`partner` und die Preise 699/1249/1999 — und **keine Zeile für `business`**.
#1140 hat die SSoT umgestellt, den Katalog nicht mitgezogen und im selben PR
den Testfall „die Plan-Katalog-Migration entspricht `shared/pricing.ts`"
entfernt.

Die Folge nach einem Deploy: `tenant_entitlements()` löst über
`products.default_for_plan_key` auf. Ohne `business`-Zeile fiele ein
zahlender Business-Kunde auf den Free-Audit-Fallback. Betroffen heute: **null**
Abos (gemessen: 3× `free_audit`, 1× `growth` in der Testphase). Die Mine ist
scharf, sobald der erste Business-Vertrag entsteht.

### Warum keine CI-Stufe es bemerkt hat

`check:pricing`, `check:entitlements` und `check:limits` liefen in **keinem**
Workflow. Der gelöschte Test war die einzige Stelle.

**Behoben mit diesem Commit:** `check:pricing` und `check:limits` laufen jetzt
im `build`-Job von `.github/workflows/ci.yml`, zwischen Edge-Function-Syntax
und den Unit-Tests. `check:pricing` ist genau der Guard, der den fehlenden
`business`-Katalogeintrag gemeldet hätte.

**Offen:** `check:entitlements` vergleicht gegen eine echte Datenbank. Der
`db`-Job hat eine PostgreSQL mit allen angewandten Migrationen, aber kein
Node-Setup. Das nachzurüsten ist ein eigener, kleiner Schritt — dann prüft CI
den Katalog nicht nur als Datei, sondern als angewandtes Schema.

## 6. Was beim Rebase von #1140 zu erwarten ist

Diese Artefakte aus #1129 hängen an der heutigen Leiter und brauchen beim
Umbau auf `business` eine bewusste Entscheidung, keine mechanische Anpassung:

| Artefakt | Was zu klären ist |
|---|---|
| `Plan.availability` + `SALES_PLANS`/`LEGACY_PLANS` | bleibt tragend; `business` kommt als `self_service` dazu |
| `limit-canonicity-baseline.json` | 13 der 21 Zeilen liegen auf `agency`/`partner`; sie bleiben gültig, solange die Pläne als Legacy bestehen |
| `test/billing/ap2-package-model.test.ts` | 43 Fälle auf dem AP2-Modell |
| `test/governance/monitoring-cadence.test.ts` | Kadenz für agency/partner |
| `20260831000000_ap2_package_model.sql` | vergibt Entitlements an agency/partner |
| `20260831010000_canonical_plan_catalog.sql` | muss um `business` erweitert neu erzeugt werden |
| `PLAN_ENTITLEMENTS` | braucht einen `business`-Eintrag |

Unter der Legacy-Semantik aus §4 ist der Rebase deutlich kleiner als unter
der Alias-Variante: agency und partner bleiben, es kommt einer dazu.

## 7. Offen und unverändert

Die beiden Entscheidungen aus AP-Canon bleiben unberührt von dieser
Reihenfolge:

1. **Enterprise-Quelle** — wo der Vertragswert steht
   (`enterprise-quelle-entscheidungsvorlage.md`).
2. **Die drei Kürzungen auf Starter und Growth** — Bestandsschutz vor
   Wertkorrektur.

Ebenso gesperrt: AP5 (Stripe-Preise), AP9, AP10, die Legacy-Leiter
(bronze/silver/gold) und die Gates selbst.
