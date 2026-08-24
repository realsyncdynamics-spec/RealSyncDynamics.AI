# AP2 — Paketumbau auf drei Self-Service-Stufen

**Stand: 2026-08-24.** Umgesetzt und gegen eine echte PostgreSQL geprüft.

Freigegeben vom Eigentümer, im Umfang:

> Paketmodell auf drei bezahlte Pakete umbauen · `policy.packs` ab Starter ·
> WhatsApp als 99-€-Add-on · AP1 als kanonische Entitlement-Basis verwenden ·
> die beiden in AP1 sichtbar gewordenen Widersprüche gezielt bereinigen.

**AP5 (Stripe-Preise) bleibt gesperrt.** Diese Arbeit hat kein Stripe-Objekt
angelegt, geändert oder gelesen.

---

## 1. Die Leiter danach

| Stufe | Preis | Vertrieb | Was sich geändert hat |
|---|---|---|---|
| Free Audit | 0 € | Self-Service | — |
| Starter | 79 € | Self-Service | Policy Packs, Website-Bot, WhatsApp als Add-on |
| Growth | 249 € | Self-Service | API, Webhooks, Scheduler, Bulk Jobs, Evidence Advanced, C2PA, Provenance |
| Enterprise | 1.249 € | **Vertrag** (`inquiry`) | kein Self-Service-Checkout mehr |
| Agency | 699 € | **stillgelegt** | nicht mehr wählbar; bestehende Abos laufen weiter |
| Partner | 1.999 € | **stillgelegt** | dito |

Der neue Unterschied steckt in `Plan.availability` — bewusst getrennt von
`purchaseMode`:

```
purchaseMode   „welche Art von Stripe-Session?"    free · checkout · inquiry · one_time
availability   „darf das heute noch jemand neu wählen?"  self_service · contract · legacy
```

Beides zusammenzulegen ginge schief: Ein stillgelegter Plan behält seinen
Kaufmodus, weil seine bestehenden Abos unverändert weiter abrechnen.

---

## 2. Die zwei Widersprüche aus AP1 — an der Wurzel behoben

AP1 hatte die Anzeige an die Datenbank gebunden und dabei sichtbar gemacht,
dass beide auseinandergehen. AP2 hat die Lücke nicht dadurch geschlossen,
dass die Anzeige nachgibt, sondern indem der Plan bekam, was er ohnehin
zusagte.

| Modul | vor AP1 | nach AP1 | **nach AP2** | Warum |
|---|---|---|---|---|
| `governance_core` | ab Growth | ab Agency | **ab Starter** | `policy.packs` liegt jetzt auf Starter |
| `website_chat` | ab Starter | ab Growth | **ab Starter** | `bots.enabled` / `bots.chat` liegen jetzt auf Starter |

### 2.1 `policy.packs` ab Starter

Der Befund aus `zielzustand-paketmodell.md` §1.2: Eine Governance-Plattform,
deren Kern die Policy Packs sind, gewährte sie erst in der vierten Stufe. Ein
Kunde zahlte 249 € für Governance und bekam die Regelwerke nicht — obwohl die
Feature-Liste von Starter wörtlich „Policy Packs: DSGVO und EU AI Act" nennt.

### 2.2 Starter bekommt den Bot, den sein Plan verspricht

`plan.limits` sagt für Starter seit jeher `bots: 1` und
`answersPerMonth: 500`, `plan.channels` nennt `website`, und die Feature-Liste
verspricht „1 Governance-Bot mit 500 Antworten (Website)". Zur Laufzeit fehlten
`bots.enabled` und `bots.chat` — der Kunde bezahlte einen Bot, den der Server
ihm verweigerte.

Die Kontingente `limit.bots = 1` und `limit.bot_messages_monthly = 500` kommen
mit. Ihre Werte sind **nicht neu gewählt**, sondern aus `plan.limits`
übernommen — sonst entstünde genau die Lücke wieder, die AP1 gefunden hat.

---

## 3. Wohin die Agency-Fähigkeiten gewandert sind

Agency entfällt als Self-Service. Seine exklusiven Berechtigungen wären damit
unverkäuflich geworden. Nach `zielzustand-paketmodell.md` §1.1:

| Key | vorher nur auf | **jetzt** |
|---|---|---|
| `api.access` | agency, enterprise, partner | Growth |
| `webhooks.enabled` | dito | Growth |
| `scheduler.enabled` | dito | Growth |
| `evidence.advanced` | dito | Growth |
| `bulk.jobs` | dito | Growth |
| `c2pa.export` | dito | Growth |
| `provenance.advanced` | dito | Growth |
| `whitelabel.reports` / `whitelabel.dashboard` | dito | Add-on „White Label", buchbar ab Growth |
| `bots.voice` | dito | Add-on „Voice", buchbar ab Growth |
| `org.governance`, `sso.enabled`, `sla.priority` | enterprise, partner | bleiben Enterprise |

**Kein Plan verliert dabei etwas.** Die oberen Stufen trugen alle betroffenen
Keys bereits; AP2 hängt nur um. Gemessen:

| Plan | Keys vorher | Keys nachher |
|---|---:|---:|
| free_audit | 9 | 9 |
| starter | 18 | **23** |
| growth | 38 | **47** |
| agency | 55 | 55 |
| enterprise | 59 | 59 |
| partner | 57 | 57 |
| governance_launch | 16 | 16 |

Die Jahresvarianten erben identisch (`starter_yearly` 23, `growth_yearly` 47).

### 3.1 Drei Werte, die neu gewählt werden mussten

Für Growth gab es keinen Vorwert. Sie sind bewusst deutlich unter Agency
angesetzt — Growth ist ein Ein-Mandanten-Plan:

| Wert | Growth | zum Vergleich Agency |
|---|---:|---:|
| `bulkJobsPerMonth` / `limit.bulk_jobs_monthly` | 10 | 100 bzw. 50 |
| `apiKeys` | 3 | 10 |

`apiCallsPerMonth` ist **kein** neuer Wert: 5.000 stand als
`limit.api_calls_monthly` längst auf Growth — ohne `api.access` war das ein
totes Kontingent. Es wird jetzt nur endlich erreichbar.

---

## 4. WhatsApp — ein Preis, für den richtigen Plan

Der Widerspruch aus `zielzustand-paketmodell.md` §3.2 war doppelt verkehrt:
Das 99-€-Add-on war für Starter — den einzigen Plan **ohne** WhatsApp — nicht
buchbar, und wurde Growth und darüber angeboten, die den Kanal bereits
enthalten.

| Was | vorher | nachher |
|---|---|---|
| `ADDONS.whatsapp.availableFor` | growth, agency, enterprise, partner | **starter** |
| `starter.addons` | *(leer)* | **`['whatsapp']`** |
| `growth.addons` / `enterprise.addons` | enthielten `whatsapp` | ohne `whatsapp` |
| `BOOKABLE_MODULES.whatsapp_bot.priceEur` | 39 € | **99 €** |
| `MODULE_ADDON_PRICE_DIVERGENCE` | `voice_bot`, `whatsapp_bot` | nur `voice_bot` |

`starter.channels` bleibt `['website']`: Der Kanal kommt mit dem Add-on, nicht
mit dem Plan.

### 4.1 Eine bewusste Abweichung vom Plan

`implementierungsplan-paketmodell.md` AP2.3 sagt, die Marketplace-Kachel
`whatsapp_bot` „entfällt". Umgesetzt ist stattdessen: **der zweite Preis
entfällt, die Kachel bleibt.** Begründung: WhatsApp ist weiterhin buchbar, und
ein Dienst, den man kaufen kann, gehört dorthin, wo der Kunde ihn sucht
(`CLAUDE.md` §14 — kein fertiges Angebot unsichtbar machen). Der Marketplace
rendert `BOOKABLE_MODULES`, nicht `ADDONS`; ein Entfernen hätte WhatsApp im
Dashboard verschwinden lassen. Die Preisabweichung, wegen der die Kachel im
Plan entfallen sollte, ist damit trotzdem aufgelöst — beide Stellen nennen
99 €.

Offen bleibt Voice: 99 € als Modul gegen 150 € als Add-on. Das ist kein
Versehen, sondern der Rest einer Kalkulation, die für Telefonie noch aussteht
(Minutenpreise, STT/TTS). Wer sie angleicht, ohne gerechnet zu haben, ersetzt
eine benannte Abweichung durch eine verdeckte.

---

## 5. Was mit Agency und Partner geschieht

`plan_catalog.active = false`. Sonst **nichts**:

- `products`, `product_entitlements` und Stripe-Preise: unverändert
- laufende Subscriptions: unverändert
- `plan.addons` der beiden Pläne: unverändert — ein Bestandskunde verliert
  kein Add-on, nur weil sein Plan nicht mehr verkauft wird
- `PLAN_ORDER`: enthält sie weiterhin, damit `planRank()` und `isUpgrade()`
  für Bestandskunden die richtige Antwort geben

`tenant_entitlements()` liest `plan_catalog` gar nicht — die Auflösung geht
über `products`. Rückgängig zu machen mit `active = true`; die Migration
enthält deshalb kein `DELETE`.

### 5.1 Gegenprobe gegen eine echte Datenbank

Gemessen an einer PostgreSQL 16 mit allen 292 Migrationen, über
`tenant_entitlements()` mit gesetzter Mitgliedschaft:

| Fall | Entitlements | Stichprobe |
|---|---:|---|
| Bestandskunde auf **Agency** (stillgelegt) | **55** | `whitelabel.reports` weiterhin vorhanden |
| Neukunde auf **Starter** | **23** | `policy.packs` = 1, `bots.chat` = 1 |

Beide Migrationen sind idempotent: Der zweite Lauf fügt null Zeilen hinzu, und
`active = false` überlebt den erneuten Katalog-Lauf (`ON CONFLICT DO UPDATE`
schreibt `active` nicht).

Die Paritätsprüfung `npm run check:entitlements --matrix` gegen dieselbe
Datenbank ergibt **null Differenzen** über alle sieben Pläne.

---

## 6. Was dabei aufgefallen ist — berichtet, nicht behoben

**Partner verspricht SSO, bekommt es aber nicht.** `permissions.sso` ist dort
`true`, `sso.enabled` liegt in der Datenbank nur auf Enterprise. Der Fehler ist
älter als AP2 und liegt außerhalb des freigegebenen Umfangs; Partner ist
inzwischen zudem stillgelegt. Festgehalten als eigener Testfall in
`test/billing/ap2-package-model.test.ts`, damit die nächste Sitzung ihn als
bekannt erkennt.

**`UnifiedPricingGrid` hat keinen einzigen Aufrufer.** Die Komponente ist tot;
die Preisseite rendert `PUBLIC_PRICING_TIERS` direkt. Nicht entfernt — das
wäre nach `CLAUDE.md` §10.3 fragepflichtig.

**Die Preisseite steht noch auf fünf Karten.** Siehe §7.

---

## 7. Was AP2 bewusst **nicht** angefasst hat

Die Oberfläche listet die Pläne an vier Stellen über `PUBLIC_PRICING_TIERS`,
jeweils in einem `lg:grid-cols-5`, und `PricingTeaserSection` trägt die
Überschrift „Free Audit · Starter · Growth · Agency · Enterprise · Partner".

Beides ist eine Änderung an Bestehendem: das Grid nach `CLAUDE.md` §10.1
(gesperrt), die Überschrift nach §10.3 (fragepflichtig). Die Datenschicht ist
vollständig umgestellt und autorisiert korrekt; die Preisseite zeigt bis zu
einer Entscheidung weiterhin fünf Karten.

**Das ist kein halber Umbau, sondern die Trennlinie der Freigabe.** Wer sie
auflöst, braucht dafür eine eigene Antwort — und dann sind es zwei
Änderungen: `lg:grid-cols-5` → `lg:grid-cols-3` und die Überschrift ohne
Agency und Partner.

---

## 8. Wie es abgesichert ist

| Netz | Was es prüft |
|---|---|
| `test/billing/ap2-package-model.test.ts` (42 Fälle) | Kein Plan verliert einen Key; genau die geplanten Keys kommen dazu; `permissions` und Entitlements sagen dasselbe; Legacy-Pläne bleiben vollständig; WhatsApp-Preis und -Zuordnung; die Migration legt keinen Key an und löscht nichts |
| `test/billing/entitlement-vocabulary.test.ts` | Das gemessene Marketplace-Verhalten; kein Vorschlag auf einen stillgelegten Plan |
| `test/market/module-catalog.test.ts` | Strenge Monotonie über die **wählbaren** Pläne |
| `npm run check:pricing` | Deno-Zwilling und Katalog-Migration gegen die Quelle |
| `npm run check:entitlements` | Quelle gegen eine echte Datenbank, in beide Richtungen |
