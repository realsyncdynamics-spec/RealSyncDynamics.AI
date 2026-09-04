# Implementierungsplan — Core + Add-on Governance-Modell

**Stand: 2026-08-24. Plan, noch keine Umsetzung.**

> **Stand der Umsetzung, 2026-09-01.** Gemessen am Repo, nicht am Plan:
>
> | AP | Stand | Wo |
> |---|---|---|
> | AP1 Namensraum | umgesetzt (2026-08-30) | `20260830000000_canonical_entitlement_vocabulary.sql` |
> | AP2 Paketumbau | umgesetzt (2026-08-24) | `docs/product/ap2-paketumbau.md` |
> | AP3 Legacy | mittelbar — der generierte Katalog deaktiviert alles außerhalb der Quelle; kein eigener, kommentierter Schritt | `*_canonical_plan_catalog.sql` |
> | AP4 Grace Period | umgesetzt (2026-08-29) | `20260829000000_grace_period.sql` |
> | AP5 Stripe-Prices | **Schema da, Prices fehlen** — Betreiberschritt mit Freigabe | `docs/product/addon-booking.md` §3 |
> | AP6 Buchung | umgesetzt | `supabase/functions/subscription-addons`, Webhook `syncAddonItems` |
> | AP7 „Mein Plan" | umgesetzt | `src/features/market/MyPlanSection.tsx` |
> | AP8 Abhängigkeiten | umgesetzt | `entitlement_dependencies`, `ENTITLEMENT_DEPENDENCIES` |
> | AP9 Durchsetzung | Welle 1 und 2 umgesetzt, Welle 3 offen | `docs/product/addon-booking.md` §1.6, §6.5 |
> | AP10 Preis-Konsumenten | umgesetzt (2026-08-30/31) | CLAUDE.md §10 |
> | AP11 Aufräumen | erster Schnitt umgesetzt (2026-09-04): 52 verwaiste Dateien entfernt, Kommentar korrigiert; offen: sechs ungeroutete Views mit Backend, 14 Folge-Waisen, 19 doppelte Basenamen in Gebrauch | `docs/product/ap11-aufraeumen.md` |
>
> Hergang, Vertrag und offene Entscheidungen: `docs/product/addon-booking.md`.

Verbindliche Spezifikation: `docs/product/zielzustand-paketmodell.md` (Commit
`28a9b1e`), ergänzt um die fünf Entscheidungen des Eigentümers vom 2026-08-24.
Bestandsaufnahme: `docs/product/pricing-packaging-entscheidungsbericht.md`.

---

## 0. Die fünf entschiedenen Punkte

| Punkt | Entscheidung |
|---|---|
| WhatsApp | **99 €** als Starter-Add-on, in Growth enthalten. Die 39 € entfallen aus dem Marketplace. |
| `policy.packs` | **ab Starter** verfügbar |
| Sechs Fremdleiter-Keys | **stilllegen, nicht löschen** — raus aus dem kanonischen Verkaufsmodell |
| Grace Period | **7 Tage** `past_due`, danach bezahlte Entitlements pausieren |
| 1249 € „Enterprise WhatsApp" | **streichen** |

## 0.1 Zwei Regeln, die über allem stehen

**Nichts wird entfernt, nur weil es nicht mehr Teil eines Pakets ist.** Eine
Funktion, die aus dem Verkaufsmodell fällt, bleibt technisch erhalten und wird
allein über Entitlements und Produktkatalog inaktiv gestellt. Das gilt für
Agency, Partner, die Fremdleiter und jedes Modul, das im neuen Zuschnitt keinen
Platz findet.

**Daten überleben jede Umstellung.** Mandanten, Prüfpfade, Evidence,
Konfigurationen und historische Audits bleiben unangetastet — bei der
Migration wie bei der Grace Period.

---

## 1. Arbeitspakete und ihre Abhängigkeiten

```
AP1  Kanonisches Entitlement-Modell
      ├──→ AP2  Paketumbau
      │          ├──→ AP5  Stripe-Add-on-Prices ──→ AP6  Add-on-Buchung ──→ AP7  Dashboard
      │          └──→ AP3  Legacy stilllegen
      ├──→ AP8  Abhängigkeiten
      ├──→ AP9  Durchsetzung nachrüsten
      └──→ AP10 /pricing/whatsapp entkoppeln

AP4  Grace Period          (unabhängig — kann sofort starten)
AP11 Aufräumen             (zuletzt, Fragepflicht)
```

**AP4 ist bewusst ohne Vorbedingung.** Es behebt, dass ein nicht zahlender
Kunde heute unbegrenzt weiterläuft, und berührt weder Pakete noch Namen.

---

## AP1 — Kanonisches Entitlement-Modell

**Ziel:** Ein Namensraum. `unlocks` und `addon_id` werden zu Listen von
Entitlement-Keys.

### AP1.1 Die Bestandsaufnahme des Mappings

19 `unlocks`-Werte stehen 63 Entitlement-Keys gegenüber. **Zwölf lassen sich
zuordnen, sieben haben keinen Key** — das Zusammenführen ist deshalb keine
Umbenennung, sondern braucht neue Keys.

| `unlocks` | Entitlement-Key | Status |
|---|---|---|
| `ai_bots` | `bots.enabled` | vorhanden |
| `alerts` | `alerts.email` | vorhanden |
| `audit_center` | `website.scan` | vorhanden |
| `compliance_reports` | `compliance.export` | vorhanden |
| `drift_detection` | `monitoring.drift` | vorhanden |
| `dsgvo` | `governance.dsgvo_directory` | vorhanden |
| `eu_ai_act` | `governance.ai_register` | vorhanden |
| `evidence_vault` | `evidence.basic_vault` | vorhanden |
| `monitoring` | `monitoring.monthly` | vorhanden |
| `policy_engine` | `policy.packs` | vorhanden |
| `remediation` | `fix.snippets` | vorhanden |
| `voice` | `bots.voice` | vorhanden |
| `whatsapp` | — | **neu: `channel.whatsapp`** |
| `website_chat` | — | **neu: `channel.website_chat`** |
| `human_handoff` | — | **neu: `bots.human_handoff`** |
| `multi_channel_messaging` | — | **neu: `channel.multi`** |
| `nis2` | — | **neu: `framework.nis2`** |
| `iso_27001` | — | **neu: `framework.iso27001`** |
| `risk_register` | — | **neu: `governance.risk_register`** |

Dazu aus dem Zielzustand §5: `booking.enabled` für die Terminbuchung, deren Key
heute ebenfalls fehlt.

**Acht neue Keys insgesamt.** Alle boolesch.

### AP1.2 Was zu tun ist

| Was | Wo |
|---|---|
| acht Entitlements anlegen | Migration, additiv |
| `unlocks` auf Entitlement-Keys umstellen | `shared/pricing.ts` |
| `plan_addons` um `entitlement_keys jsonb` erweitern | Migration, additiv |
| Übersetzungstabelle entfernen | `src/core/billing/entitlements.ts` |
| `npm run sync:pricing` | erzeugt `pricing.generated.ts` neu |

### AP1.3 Test

Ein Test, der **jeden** `unlocks`-Wert und **jeden** `addon_id`-Eintrag gegen
die Entitlement-Tabelle prüft. Ein Wert ohne Key bricht ihn. Damit kann das
dritte Vokabular nicht zurückkehren.

**Akzeptanz:** `grep` über `src/` findet keine Zuordnung von `unlocks`-Werten
auf Modul-IDs mehr; der neue Test ist grün.

**Risiko:** gering, rein additiv. `unlocks` wird heute nur von
`moduleCatalog.ts` gelesen.

---

## AP2 — Paketumbau ✅ umgesetzt am 2026-08-24

> **Ergebnis und Abweichungen: `docs/product/ap2-paketumbau.md`.** Zwei
> Dinge sind anders gelaufen als hier geplant:
>
> 1. **AP2.3** — `BOOKABLE_MODULES.whatsapp_bot` ist **nicht** entfallen.
>    Entfallen ist der zweite Preis (39 € → 99 €); die Marketplace-Kachel
>    bleibt, weil der Marketplace `BOOKABLE_MODULES` rendert und WhatsApp
>    sonst im Dashboard verschwunden wäre.
> 2. **Die Oberfläche ist bewusst offen geblieben.** Die Preisseite zeigt
>    weiterhin fünf Karten; `lg:grid-cols-5` und die Überschrift mit Agency
>    und Partner fallen unter `CLAUDE.md` §10.1 bzw. §10.3 und brauchen eine
>    eigene Entscheidung.
>
> Zusätzlich behoben, weil es dieselbe Wurzel hat: Starter bekommt
> `bots.enabled` und `bots.chat` samt Kontingenten — `plan.limits` sagte dort
> seit jeher `bots: 1`.



**Ziel:** Drei Self-Service-Stufen, Enterprise als Vertrag. Die Berechtigungen
der entfallenden Stufen bekommen ein Zuhause.

### AP2.1 Entitlements umhängen (additiv)

Nach `zielzustand-paketmodell.md` §1.1. Alle Einträge sind **Ergänzungen** an
Starter bzw. Growth — kein Plan verliert etwas:

| Nach **Starter** | Nach **Growth** | **Add-on** | **Enterprise** |
|---|---|---|---|
| `policy.packs` | `api.access` | `whitelabel.dashboard` | `org.governance` |
| | `webhooks.enabled` | `whitelabel.reports` | `sso.enabled` |
| | `scheduler.enabled` | `bots.voice` | `sla.priority` |
| | `evidence.advanced` | `channel.whatsapp` | |
| | `bulk.jobs` | | |
| | `c2pa.export` | | |
| | `provenance.advanced` | | |

`channel.whatsapp` zusätzlich **in Growth enthalten** (Entscheidung 1).

### AP2.2 Agency und Partner

`agency` und `partner` werden **nicht gelöscht**. Sie werden im Katalog
inaktiv gestellt (`plan_catalog.active = false`), behalten ihre Produkte,
Preise und Entitlements. Ein bestehendes Abo darauf funktioniert unverändert
weiter — die Auflösung geht über `products`, nicht über den Katalog.

Wirkung: Sie verschwinden aus der Preisseite und aus jeder Auswahl, bleiben
aber gültig, wo sie gebucht sind.

### AP2.3 WhatsApp

| Was | Von | Nach |
|---|---|---|
| Preis im Marketplace | 39 € | **99 €** |
| `availableFor` des Add-ons | `growth, agency, enterprise, partner` | **`starter`** |
| in Growth | Kanal enthalten | unverändert enthalten |
| `BOOKABLE_MODULES.whatsapp_bot` | eigenes Modul mit 39 € | **entfällt** — geht im Add-on auf |

### AP2.4 Dateien

`shared/pricing.ts`, eine Migration für `product_entitlements`, eine neue
Katalog-Migration (`*_canonical_plan_catalog.sql`, weil die alte nach dem
Deploy unveränderlich ist), `npm run sync:pricing`, `npm run check:pricing`.

### AP2.5 Test

- Kein bezahlter Plan verliert einen Key gegenüber heute (Vorher/Nachher-Vergleich)
- `policy.packs` liegt auf Starter, Growth, Agency, Enterprise, Partner
- WhatsApp: 99 €, `availableFor` enthält `starter`
- der bestehende Monotonie-Test bleibt grün

**Risiko:** mittel. Der Katalog wird neu geschrieben; die alte Migration bleibt
unangetastet. **Rollback:** neue Katalog-Migration durch eine weitere ersetzen.

---

## AP3 — Legacy kontrolliert stilllegen

**Ziel:** `bronze`, `silver`, `gold`, `enterprise_public` und die drei
verwaisten `(default)`-Produkte sind nicht mehr Teil des aktiven Modells.

### AP3.1 Vorbedingung — messen, nicht annehmen

Vor dem Stilllegen ist zu prüfen, ob ein Mandant daran hängt:

```sql
select s.plan_key, count(*)
from subscriptions s
where s.plan_key in ('bronze','silver','gold','enterprise_public')
   or s.stripe_price_id in (select stripe_price_id from products where default_for_plan_key is null)
group by 1;
```

Stand 2026-08-24: **keine**. Die Prüfung gehört trotzdem in den Schritt, weil
sich das bis zur Umsetzung ändern kann. Ist das Ergebnis nicht leer, wird der
Schritt gestoppt und berichtet.

### AP3.2 Vorgehen

- `plan_catalog.active = false` für die Legacy-Keys
- `products` bleiben **unverändert** — sie tragen die Entitlements bestehender Abos
- ein Kommentar in der Migration nennt Datum, Entscheidung und Grund

### AP3.3 Die sechs Keys ohne Zuhause

`ai.tool.code_explain`, `ai.tool.log_analyze`, `barcode.issue`,
`provenance.basic`, `public-sector.mode`, `watermark.apply` hängen
ausschließlich an der Fremdleiter. Nach Entscheidung 3 sind sie **stillgelegt,
nicht gelöscht**: Die Keys bleiben in `entitlements`, die Zuordnungen bleiben an
den Legacy-Produkten, und sie werden in keinen aktiven Plan übernommen.

Ein Kommentar in der Migration hält fest, dass das Absicht ist — sonst liest die
nächste Sitzung es als Versehen.

**Risiko:** gering, sofern AP3.1 leer ist. **Rollback:** `active = true`.

---

## AP4 — Grace Period (unabhängig, kann sofort starten)

**Ziel:** `past_due` gewährt sieben Tage, danach pausieren die bezahlten
Entitlements.

### AP4.1 Der Befund, der das nötig macht

`tenant_entitlements()` fragt **nicht** nach `subscriptions.status`. Ein Abo in
`past_due` liefert heute unbegrenzt weiter — es gibt faktisch keine
Ablaufsteuerung.

### AP4.2 Die fehlende Information

`subscriptions` hat **keine Spalte, die festhält, wann `past_due` begann**.
Vorhanden sind `status`, `current_period_end`, `canceled_at`, `updated_at` —
keine davon taugt: `updated_at` ändert sich bei jeder Änderung,
`current_period_end` wird von Stripe je nach Konfiguration fortgeschrieben.

**Neu:** `subscriptions.past_due_since timestamptz NULL`, gesetzt von
`stripe-webhook` bei `invoice.payment_failed`, geleert bei
`invoice.payment_succeeded` und bei jedem Wechsel nach `active`.

### AP4.3 Die Auflösung

```
status = 'active' | 'trialing'                        → alle Entitlements
status = 'past_due' und past_due_since > now() - 7d   → alle Entitlements
status = 'past_due' und past_due_since <= now() - 7d  → Free-Plan
status = 'canceled' | 'unpaid' | 'incomplete_expired' → Free-Plan
past_due_since IS NULL bei status='past_due'          → alle Entitlements
```

Die letzte Zeile ist bewusst großzügig: Fehlt der Zeitstempel (Altdaten, oder
das Webhook-Ereignis kam nie an), darf der Kunde **nicht** ausgesperrt werden.
Eine fehlende Information ist kein Zahlungsverzug.

„Free-Plan" heißt: Der Auflöser fällt auf das `free_audit`-Produkt zurück, wie
er es heute schon für Mandanten ohne Subscription tut. **Nichts wird gelöscht** —
Mandant, Domains, Evidence, Prüfpfad und Konfiguration bleiben.

### AP4.4 Ruht die Überwachung?

Entscheidung des Eigentümers steht aus; meine Empfehlung war **ruhen**.
Umsetzung: Der Recheck-Cron prüft `monitoring.*` über dieselbe Auflösung und
überspringt pausierte Mandanten automatisch — es ist also keine eigene Logik
nötig, sobald AP4.3 steht.

### AP4.5 Test

- fünf Fälle aus AP4.3 gegen eine echte PostgreSQL
- `past_due` am Tag 6 → vollständige Entitlements; am Tag 8 → Free-Satz
- `past_due_since IS NULL` → vollständige Entitlements
- nach `active` → sofort wieder vollständig
- ein Test, der belegt, dass Mandant und Daten unberührt bleiben

**Risiko:** **hoch** — die Function autorisiert alles. Sie ist `SECURITY
DEFINER`; die Mitgliedschaftsprüfung und das `EXECUTE`-Recht müssen erhalten
bleiben (siehe die Lehre aus PR #1124). **Rollback:** vorherige Fassung per
`CREATE OR REPLACE` zurückspielen.

---

## AP5 — Stripe-Add-on-Prices

**Ziel:** Jedes Add-on hat einen wiederkehrenden Price.

| Add-on | Preis | Intervall |
|---|---|---|
| WhatsApp-Kanal | 99 € | Monat |
| Voice-Kanal | 150 € | Monat |
| Response Pack | 49 € | Monat |
| White Label | 299 € | Monat |
| Weitere Domain | 19 € | Monat, Menge |
| Weiteres Unternehmen | 49 € | Monat, Menge |
| Terminbuchung | 29 € | Monat |

Dazu `plan_addons.stripe_price_id text NULL` (additiv) und das Eintragen der
erzeugten IDs.

**Nicht in diesem Schritt:** Website-Builder (`package_deploy` liefert nicht
aus), Advanced AI Governance (kein Datenfluss), Compliance Pack (überschneidet
sich mit `policy.packs`, das nach AP2 in Starter wandert).

**Risiko:** gering im Repo, **außerhalb** aber echt — Stripe-Objekte werden
angelegt. Erst nach ausdrücklicher Freigabe für diesen Schritt, getrennt von
der Freigabe des Plans.

---

## AP6 — Add-on-Buchung

**Ziel:** Ein Kunde bucht ein Add-on aus dem Dashboard; es wird zu einer
Position seines bestehenden Abos.

### AP6.1 Was vorhanden ist

`subscription_addons` existiert mit `subscription_id`, `addon_key`,
**`stripe_item_id`**, `quantity` — leer und ohne Schreiber. Die Tabelle wartet
genau auf diesen Schritt.

### AP6.2 Was zu bauen ist

| Fall | Vorgehen |
|---|---|
| Erstkauf mit Add-on | `stripe-checkout` um weitere `line_items` erweitern |
| Add-on zu bestehendem Abo | neue Function oder Erweiterung: `subscriptions.items.create` |
| Add-on kündigen | `subscriptions.items.del`, Zeile entfernen |
| Persistenz | `subscription_addons` schreiben, Webhook hält sie synchron |
| Entitlements | Add-on-Produkt in `products`, Keys in `product_entitlements`; der Auflöser vereinigt sie über `entitlement_grants` oder eine Erweiterung um Add-on-Produkte |

**Zu entscheiden im Entwurf:** ob Add-ons über `entitlement_grants` (vorhanden,
additiv, funktioniert sofort) oder über eine eigene Vereinigung im Auflöser
laufen. Empfehlung: **`entitlement_grants`** — der Weg existiert, ist getestet
und braucht keine Änderung an der autorisierenden Function.

### AP6.3 Test

- Buchung erzeugt Stripe-Position **und** Zeile **und** wirksames Entitlement
- Kündigung entfernt alle drei
- doppelte Buchung desselben Add-ons ist idempotent
- ein Mandant kann kein Add-on für einen fremden Mandanten buchen

**Risiko:** **hoch** — Geldfluss. Jeder Pfad braucht einen Test gegen einen
Stripe-Testmodus, kein Live-Objekt.

---

## AP7 — Dashboard „Mein Plan"

**Ziel:** Zwei Listen und eine Preisvorschau, auf der bestehenden Fläche
`/app/marketplace`.

| Element | Inhalt |
|---|---|
| Kopf | Plan, Monatspreis, nächste Abrechnung |
| Enthalten | Entitlements des Plans, mit Kontingenten |
| Zubuchbar | Add-ons, die `availableFor` erlaubt und die nicht gebucht sind |
| Vorschau | **alter Betrag, Zuschlag, neuer Betrag, Datum** — vor jeder Aktivierung |
| Status | bei `past_due`: sichtbarer Hinweis mit verbleibenden Tagen |

**Kein neues Dashboard.** `/app/marketplace` aus PR #1129 wird ausgebaut; die
35 bestehenden Dashboards bleiben unangetastet.

**Design:** ausschließlich vorhandene Komponenten, Klassen und Tokens (CLAUDE.md
§10.2 — Ergänzen ist frei, neue Optik nicht).

---

## AP8 — Abhängigkeiten

**Ziel:** Kein Kunde bucht ein Modul, das ohne sein Fundament nichts tut.

Neue Tabelle `entitlement_dependencies (entitlement_id, requires_entitlement_id)`.
Geprüft wird **beim Buchen**, nicht bei der Auflösung — der Auflöser bleibt
unberührt.

Bekannte Abhängigkeiten aus dem Bestand: `bots.voice` → `bots.enabled`;
`channel.whatsapp` → `bots.enabled`; `whitelabel.dashboard` →
`whitelabel.reports`; `provenance.advanced` → `provenance.basic`.

Fehlt eine Abhängigkeit, nennt die Oberfläche sie und bietet an, beides zusammen
zu buchen.

---

## AP9 — Durchsetzung nachrüsten

**Ziel:** Was ein Plan nicht enthält, ist auch über die API nicht erreichbar.

**Ausgangslage:** 18 von 178 Functions prüfen Entitlements, 57 prüfen die
Mitgliedschaft. Der Wächter `_shared/entitlements.ts` liegt bereit.

**Reihenfolge nach Schadenshöhe, nicht alphabetisch:**

| Welle | Auswahl | Warum zuerst |
|---|---|---|
| 1 | Functions, die **Kosten verursachen** — KI-Aufrufe, Telefonie, Bots, Bulk-Jobs | ein ungeschützter Endpunkt kostet echtes Geld |
| 2 | Functions, die **fremde Systeme erreichen** — Webhooks, Connectors, Deploy | Wirkung außerhalb des Systems |
| 3 | Functions, die **Daten ausleiten** — Exporte, Berichte, API | Vertraulichkeit |
| 4 | der Rest | |

**Je Function:** `requireFeature()` oder `requireQuota()` mit dem passenden
Key, plus ein Test, der den 403-Fall belegt. Ohne Test ist die Prüfung eine
Behauptung.

**Warum nach AP1:** Wer vorher verdrahtet, verdrahtet Keys, die danach
umbenannt werden.

---

## AP10 — Alle öffentlichen Preis-Konsumenten auf die kanonische Quelle

> **Umfang neu gefasst am 2026-08-24** auf ausdrückliche Anweisung des
> Eigentümers nach dem AP2-Abgleich: „AP10 sollte nicht nur ‚Landing Page
> anpassen' heißen. Sondern: Alle öffentlichen Pricing-Konsumenten müssen
> dieselbe kanonische Pricing-Quelle verwenden."
>
> Der Grund ist nicht Kosmetik. Solange eine Seite ihre Beträge selbst
> führt, existieren zwei Preisquellen nebeneinander — genau die Drift, die
> AP1 und AP2 beseitigen sollten. Eine Preisänderung in
> `shared/pricing.ts` erreicht sie nicht, und niemand merkt es, weil kein
> Test die Seite gegen die Quelle hält.

**Ziel:** Keine Preise in React-Komponenten (CLAUDE.md §6, Auftrag §4) —
und ein Guard, der das hält.

**Bekannte Fundstellen** (Stand 2026-08-24, beide gemessen):

1. **`/pricing/whatsapp`** (`src/pages/WhatsAppPricingPage.tsx`)
   - die vier hartkodierten Tarife durch die Quelle ersetzen
   - die **1249 €** streichen (Entscheidung 5); Enterprise verweist auf
     `/contact-sales`
   - den lokalen `ADDONS`-Block der Seite durch die Quelle ersetzen
2. **`/realsync-landing`** (`src/marketing/landing/RealSyncDynamicsLanding.tsx`)
   - fünf Plan-Karten mit hart codierten Beträgen im JSX, **inklusive
     Agency und Partner** — seit AP2 sachlich falsch
   - Karten aus `SELLABLE_PRICING_TIERS` erzeugen statt einzeln zu schreiben

**Vor der Umsetzung**: Erst suchen, dann bauen. Die beiden Fundstellen sind
gemessen, nicht bewiesen vollständig — eine Suche nach Beträgen in `src/`
gehört an den Anfang, sonst bleibt die dritte Seite unentdeckt.

**Danach**: ein Guard, der eine neue hart codierte Preisangabe in `src/`
findet, damit die Bereinigung hält. Ohne ihn ist AP10 in drei Monaten
wieder fällig.

**Achtung:** Das ist eine Änderung an bestehendem, öffentlich sichtbarem Text
und Preis, bei `/realsync-landing` zusätzlich am Layout (§10.1). Durch
Entscheidung 1 und 5 ist der Preisteil gedeckt; der Layout-Teil braucht eine
eigene Antwort.

---

## AP11 — Aufräumen (zuletzt)

Sieben Dashboards ohne Route, 20 doppelte Komponenten-Dateinamen, der veraltete
Kommentar zu `FreeTierDashboard` in `App.tsx`.

**Entfernen greift in Bestehendes ein und unterliegt der Fragepflicht nach
CLAUDE.md §10.3.** Dieser Schritt wird deshalb als Liste vorgelegt, nicht
selbständig ausgeführt.

---

## 2. Reihenfolge

| Welle | Pakete | parallel möglich |
|---|---|---|
| 1 | **AP4** (Grace Period) · **AP1** (Namensraum) | ja — unabhängig voneinander |
| 2 | **AP2** (Paketumbau) | nach AP1 |
| 3 | **AP3** (Legacy) · **AP8** (Abhängigkeiten) · **AP9** (Durchsetzung, Welle 1) · **AP10** | nach AP2 bzw. AP1 |
| 4 | **AP5** (Stripe-Prices) → **AP6** (Buchung) → **AP7** (Dashboard) | streng nacheinander |
| 5 | **AP9** (Wellen 2–4) · **AP11** (Aufräumen) | zuletzt |

**Nach jeder Welle:** `npm run lint`, `npm run build`, `npm test`,
`npm run check:pricing`, `node scripts/pre-deploy-lint.mjs`, und bei Migrationen
ein vollständiger Lauf gegen eine lokale PostgreSQL.

---

## 3. Was ausdrücklich nicht gemacht wird

- **Keine Funktion entfernen**, weil sie aus einem Paket fällt
- **Kein Produkt löschen** — inaktiv stellen genügt
- **Keine destruktive Migration**
- **Keine zweite Billing-Architektur** — `stripe-checkout`, `stripe-webhook`,
  `stripe-portal` werden erweitert, nicht ersetzt
- **Kein neues Dashboard** — `/app/marketplace` wird ausgebaut
- **Keine Änderung an RLS**, an der Signatur von `tenant_entitlements()` oder
  an der Mitgliedschaftsprüfung
- **Kein Website-Builder im Add-on-Katalog**, solange `package_deploy` nicht
  ausliefert

---

## 4. Was vor dem Start noch fehlt

| # | Frage | Blockiert |
|---|---|---|
| 1 | Ruht die Überwachung während der Grace Period? | AP4.4 — der Rest von AP4 ist unabhängig davon |
| 2 | Freigabe für das Anlegen echter Stripe-Prices | AP5 und alles danach |

Frage 1 blockiert nur einen Teilaspekt; **AP4 und AP1 können sofort beginnen.**
