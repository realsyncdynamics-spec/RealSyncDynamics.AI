# Add-on-Buchung, Zugriffsregister, Durchsetzung — Umsetzung AP5–AP9

**Stand: 2026-09-01. PR #1195 gemerged; die drei Migrationen sind in
Produktion verbucht (gemessen per Management-API, `20260904000000`,
`20260904000100`, `20260904000200`). Die drei Entscheidungsfragen aus §6 hat
der Eigentümer am selben Tag freigegeben („go") — Umfang in CLAUDE.md §10,
Umsetzung im Folge-PR.**

Bezug: `docs/product/implementierungsplan-paketmodell.md` (AP5–AP9),
`docs/product/zielzustand-paketmodell.md` §0 und §5,
`docs/product/entitlement-reality-map.md` (die 16 offenen Keys),
`docs/product/canonical-funnel-decision.md` (Einstieg).

Dieses Dokument beschreibt den **umgesetzten** Zustand. Was fehlt, steht als
Lücke da, nicht als Absicht.

---

## 0. Das Versprechen, das damit einlösbar wird

> Ein neues Modul ist künftig ein neuer Entitlement-Key plus ein Stripe-Price
> — kein neues Paket. (`zielzustand-paketmodell.md` §0)

Vor dieser Umsetzung stimmte der Satz nur zur Hälfte: Der Key existierte,
der Preis nicht, und dazwischen fehlte alles — kein Produkt für Add-ons,
kein Schreiber für `subscription_addons`, kein Auflöser, der ein Kontingent
addiert, keine Fläche, auf der ein Kunde bucht. Was ein Kunde im Dashboard
sah, entschieden vier Vokabulare gleichzeitig; ~110 von 122 Routen hatten
gar kein Gate.

Jetzt gilt die Kette:

```
shared/pricing.ts  AddOn.grants  ──►  plan_addons.grants + products (internal_addon_<id>)
                                       + product_entitlements           (Katalog-Migration, generiert)
Kunde bucht  ──►  subscription-addons  ──►  Stripe subscription item
                                        ──►  subscription_addons (Zeile)
                                        ──►  entitlement_grants (source = addon_subscription)
tenant_entitlements()  ──►  Plan ∪ Einmal-Grants (MAX)  +  Add-on-Grants (limit: SUM × Menge)
Dashboard  ──►  featureAccess.ts (Route → Key)  ──►  RouteEntitlementGate in der Shell
Server     ──►  gateFeature(key) in jeder kostenverursachenden Function
```

---

## 1. Was geändert wurde

### 1.1 Quelle (`shared/pricing.ts`)

| Neu | Zweck |
|---|---|
| `AddOn.grants` | je Key sein Wert — die Rechte des Add-ons, aus denen der Generator `product_entitlements` erzeugt |
| `AddOn.perUnit` | Mengen-Add-ons (heute keines) |
| `ENTITLEMENT_DEPENDENCIES` | die vier Abhängigkeiten aus AP8, `[key, braucht]` |
| `addonMissingDependencies()` | beim Buchen: was fehlt dem Mandanten |
| `addonBookableOnPlan()` | Quelle ist `plan.addons`, nicht `availableFor` — Bestandskunden auf Agency behalten ihre Add-ons |
| `addonOfferStatus()` | der eine Zustand je Add-on: `booked · not_for_plan · included · missing_dependency · not_purchasable · bookable` |
| `addonPricePreview()` | alt, Zuschlag, neu — kein Betrag außerhalb der Quelle |
| `ADDON_PRODUCT_PREFIX` | Sentinel `internal_addon_<id>` für die `products`-Zeile |

Die Rechte je Add-on sind aus den Bullets und den benachbarten Modulen
(`BOOKABLE_MODULES.unlocks`) abgeleitet, nicht erfunden — jeder Key existiert
in der Datenbank (`entitlement-vocabulary.test.ts`):

| Add-on | gewährt |
|---|---|
| WhatsApp (99 €, Starter) | `bots.whatsapp`, `bots.enabled`, `bots.multi_channel`, 500 WhatsApp-Konversationen |
| Voice (150 €) | `bots.voice`, `bots.enabled`, `bots.human_handoff`, 500 Voice-Minuten |
| Response Pack (49 €) | +5.000 Bot-Antworten |
| Compliance Pack (149 €) | `evidence.advanced`, `reports.export`, +100 Compliance-Exporte |
| Agency Bot Pack (199 €) | +5 Governance-Bots |
| White Label (299 €) | `whitelabel.reports`, `whitelabel.dashboard` |

**Kontingente sind additiv.** Ein Response Pack auf Growth ergibt 7.000, nicht
das Maximum von 2.000 und 5.000. Das ist die eine Änderung am Auflöser.

### 1.2 Datenbank

`20260904000000_addon_booking_schema.sql` (additiv):

- `plan_addons`: `stripe_price_id` (vom Betreiber, nie vom Generator),
  `product_id`, `grants`, `per_unit`
- `entitlement_dependencies` — Tabelle zu AP8, gelesen beim Buchen
- `entitlement_grants`: Quelle `addon_subscription`, `quantity`, `addon_id`,
  Stripe-Subscription und -Position
- `subscription_addons`: `tenant_id`, `status`, `removed_at`, `stripe_price_id`
- `tenant_entitlements()`: Add-on-Grants getrennt aggregiert, `limit`-Keys
  summiert (× Menge), boolesche vereinigt, `-1` schlägt alles, Add-on-Grants
  nur mit wirksamem Abo (Grace Period gilt mit). Signatur,
  Mitgliedschaftsprüfung, Service-Role-Pfad unverändert.

`20260904000100_canonical_plan_catalog.sql` (generiert): Katalog samt
Add-on-Produkten, `product_entitlements` je Add-on, Abhängigkeiten.

`20260904000200_workflows_current_plans.sql`: siehe §6.1.

Gegen echtes Postgres geprüft: `test/runtime/db/addon-entitlements.db.test.ts`
(13 Fälle — Addition, Menge, Booleans, Einmal-Grant bleibt MAX, `-1`,
Widerruf, Grace Period, Kündigung, Mandantentrennung, Browser = Server).
Beide Migrationen wurden zusätzlich als Ganzes gegen eine lokale
PostgreSQL 16 ausgeführt.

### 1.3 Buchung (`supabase/functions/subscription-addons`)

`POST { tenant_id, action: 'list' | 'add' | 'remove', addon_id?, quantity? }`

- `list` für jedes Mitglied: Plan, Abo-Zustand (inkl. Grace-Tage),
  wirksame Entitlements, jedes Add-on mit Zustand und Preisvorschau
- `add` / `remove` nur owner/admin; Abo muss `active`/`trialing` sein
  (`past_due` → erst Zahlung klären)
- Buchung erzeugt **Stripe-Position, Zeile, Grant** — und nur wenn
  `plan_addons.stripe_price_id` eine echte `price_…` trägt; sonst
  `ADDON_NOT_PURCHASABLE`, und `list` zeigt das Add-on als
  `not_purchasable`. Kein Knopf greift ins Leere.
- Idempotent über die Item-ID; der Webhook (`stripe-webhook`,
  `syncAddonItems`) bestätigt dieselben Zeilen und beendet Positionen, die
  Stripe nicht mehr führt. `pickPlanItem()` verhindert, dass ein
  Add-on-Price als Plan gelesen wird.

### 1.4 Fläche „Mein Plan" (`/app/marketplace`, AP7)

`MyPlanSection` über den Modulkarten: Plan und Monatsbetrag (Plan + Add-ons),
nächste Abrechnung, Hinweis bei `past_due` mit verbleibenden Tagen,
Enthaltenes (Kontingente mit Werten, Fähigkeiten als Chips), gebuchte Add-ons
mit Kündigung, zubuchbare mit Vorschau **alt + Zuschlag = neu, voll ab
Datum** vor jeder Aktivierung, nicht buchbare mit Grund. Vorhandene Klassen,
keine neue Optik.

### 1.5 Zugriffsregister (`src/core/access/featureAccess.ts`)

Eine Quelle für „Route → Key". `RouteEntitlementGate` in der
`GovernanceBrowserShell` prüft jede Route der Shell gegen die wirksamen
Entitlements (`TenantProvider`, also `tenant_entitlements()` mit Grace Period
und Grants) und zeigt statt der Fläche den Weg: Marketplace, Plan, Add-on.
26 Routen-Präfixe, ausschließlich boolesche Keys (kein Gate gegen ein
divergierendes Kontingent, CLAUDE.md §7), nichts, was der Free-Plan enthält.

Getestet in `test/core/feature-access.test.ts`: jede Route existiert, jeder
Key ist bekannt und verkäuflich, und **Navigation und Register öffnen für
dieselben Self-Service-Pläne**. Der Test hat zwei Widersprüche gefunden und
die Navigation bekam dafür die Gate-Art `entitlement`:

| Kachel | vorher (Navigation) | Fläche/Server | jetzt |
|---|---|---|---|
| Evidence Vault (erweitert) | ab Starter (`permissions.evidenceVault`) | `evidence.advanced`, ab Growth | ab Growth |
| Policy Packs | ab Free (Modul `dsgvo`) | `policy.packs`, ab Starter | ab Starter |

Außerdem: `getActivePlanForTenant()` folgt jetzt der Grace Period — ein
Kunde in der Frist sah seine Navigation gesperrt, während Server und
Marketplace ihm alles gewährten. Die fünf `/app/admin/*`-Unterseiten und
`/app/cockpit/brief` hatten keinen Auth-Wrapper; `AppGate` ist additiv.

### 1.6 Durchsetzung (AP9, Welle 1 und 2)

| Function | vorher | jetzt |
|---|---|---|
| `appointment-book` | prüfte nur `bot.capabilities.appointments` (Kundenflag) | zusätzlich `bots.appointments` |
| `order-intake` | prüfte nur `bot.capabilities.orders` | zusätzlich `bots.orders` |
| `telegram-webhook` | kein Gate vor dem KI-Gateway | `bots.multi_channel` für alle Token-kostenden Pfade; Verbinden bleibt frei |
| `governance-webhooks` | nur Rolle | `webhooks.enabled` beim Anlegen und Einschalten; Ausschalten und Widerruf frei |
| `api-webhook-deliver` | **keinerlei Prüfung** | nur Service-Role-Bearer (wie `scheduler-dispatch`) |
| `compliance-remediation-execute` | **keinerlei Prüfung** | nur Service-Role-Bearer |

**Welle 3 (2026-09-01)** — die letzten Keys, die die Reality Map als
`UNKNOWN` führte:

| Function | vorher | jetzt |
|---|---|---|
| `tenant-branding-update` | Rolle aus einem **unverifizierten** JWT-Payload, `tenant_id` aus einem Claim, den niemand setzt (0 von 6 Nutzern in Produktion) → jeder Aufruf 401; nur PATCH, `functions.invoke()` sendet POST | `requireUser`, `tenant_id` aus dem Body, Rolle owner/admin, dann `whitelabel.reports`; POST und PATCH; nur bekannte Spalten |
| `ai-act-risk-inventory` | Mitgliedschaft | zusätzlich `governance.risk_register` für alle Operationen — derselbe Key wie das Zugriffsregister für `/app/risk-inventory` |
| `compliance-alert-trigger` | **keinerlei Prüfung**; schrieb Alerts für beliebige Tenants, rief Kunden-Webhooks | nur Service-Role-Bearer; E-Mail-Aktionen nur mit `alerts.email`, der Alert selbst wird immer protokolliert |
| `audit-monitor-cron` | `verify_jwt = false`, **keinerlei Prüfung** — jeder konnte alle Domains scannen lassen | Service-Role-Bearer (wie im Dateikopf seit jeher verlangt); Versand nur mit `alerts.email`, Ergebnis wird immer gespeichert |
| `governance-risk-escalate` | **keinerlei Prüfung**; Service-Role-Insert in `governance_incidents` beliebiger Tenants | nur Service-Role-Bearer; `tenant_id` und `event_id` Pflicht |

Bewusst **nicht** gegated: `governance-risk-score`. Die Neuberechnung
hängt am KI-Register (`governance.ai_register`, im Free-Plan) und wird aus
`/app/assets/:id` aufgerufen — ein Gate auf `governance.risk_register`
sperrte eine freie Fläche. `email-notify-send` versendet Kontingent-Hinweise
zur API-Nutzung; das sind Kontoauskünfte, keine Compliance-Alerts, und
bleiben ohne Plan-Gate.

Nebenbefund: `src/features/api/OAuth2ConfigView.tsx` fragte `enterprise.tier`,
`partner.tier`, `agency.tier`, `growth.tier` als Entitlement-Keys ab — die
gab es nie, jeder Kunde sah „starter". Der Plan kommt jetzt aus
`useEntitlements().tier` (Abo-Zeile).

`test/edge/entitlement-gates.test.ts` hält die Gates in der Quelle fest.

### 1.7 Einstieg — derselbe Flow, jedes Mal

| Befund | Fix |
|---|---|
| `/recommendation/:id` ohne Router-State: „Keine Empfehlung verfügbar" | Empfehlung wird aus `gdpr_audits` neu gerechnet (`loadSharedAudit.ts`, derselbe Rechenweg) |
| `/onboarding/:id` ohne State: Sackgasse (`example.com`-Fallback) | Befunde werden nachgeladen |
| `/pricing` verlor `audit_id` an der Karte | `withAuditContext()` auf dem CTA |
| zwei Merkplätze für das offene Audit (`sessionStorage` vs. `localStorage`), zwei Schreibwege (RPC vs. nie deployte Function) | ein Leser für beide Merkplätze, ein Schreibweg (RPC `claim_gdpr_audit`); `audit-claim` aus `UNBACKED_CALLERS` |
| `/checkout/success` doppelt registriert, zweite Seite unerreichbar | Route und Datei entfernt |
| `/welcome?next=` im `SIGNED_IN`-Handler ohne Whitelist | dieselbe Whitelist wie `finalizeAndNavigate` |

---

## 2. Geänderte Dateien (Auszug)

| Datei | Art |
|---|---|
| `shared/pricing.ts` | Add-on-Modell, Abhängigkeiten, Angebotszustand, Preisvorschau; `ai.tool.workflows` für Growth+ |
| `scripts/generate-plan-catalog-sql.ts` | erzeugt Add-on-Produkte, Rechte, Abhängigkeiten |
| `supabase/migrations/20260904000000_addon_booking_schema.sql` | Schema + Auflöser |
| `supabase/migrations/20260904000100_canonical_plan_catalog.sql` | generiert |
| `supabase/migrations/20260904000200_workflows_current_plans.sql` | Workflows für aktuelle Pläne |
| `supabase/functions/subscription-addons/index.ts` | **neu** |
| `supabase/functions/stripe-webhook/index.ts` | `syncAddonItems`, `pickPlanItem` |
| `supabase/functions/{appointment-book,order-intake,telegram-webhook,governance-webhooks,api-webhook-deliver,compliance-remediation-execute}` | Gates / Auth |
| `src/core/access/{featureAccess.ts,RouteEntitlementGate.tsx,entitlementLabels.ts}` | **neu** |
| `src/components/governance-os/{GovernanceBrowserShell,governanceModules,governanceBrowserTypes}` | Gate in der Shell, Gate-Art `entitlement` |
| `src/features/market/{MyPlanSection.tsx,useSubscriptionAddons.ts,subscriptionAddons.ts}` | **neu** |
| `src/features/audit/loadSharedAudit.ts` | **neu** |
| `src/pages/{GovernanceRecommendation,GovernanceOnboarding,Welcome}.tsx`, `src/features/billing/PricingPage.tsx` | Flow |
| `src/core/onboarding/claimAudit.ts`, `src/features/audit/pendingAudit.ts` | ein Merkplatz-Leser, ein Schreibweg |
| `src/lib/billing/planAccess.ts` | Grace Period |
| `src/App.tsx` | AppGate auf Admin-Unterseiten, tote Route entfernt |

---

## 3. Was der Betreiber tun muss (AP5 — außerhalb des Repos)

Kein Add-on ist buchbar, bis je Add-on ein wiederkehrender Stripe-Price
existiert. Das braucht die ausdrückliche Freigabe des Eigentümers
(`implementierungsplan-paketmodell.md` AP5) und läuft außerhalb des Repos:

1. In Stripe je Add-on ein Produkt mit **monatlichem** Price anlegen
   (Beträge aus `shared/pricing.ts`, EUR, `tax_behavior` wie die Pläne).
2. Die Price-IDs eintragen — **nur** diese Spalte, nie den Katalog anfassen:

   ```sql
   update public.plan_addons set stripe_price_id = 'price_…', updated_at = now()
    where addon_id = 'whatsapp';
   ```

3. ~~`subscription-addons` deployen~~ — **erledigt** mit Deploy-Lauf
   33562518753 (2026-09-01, 21:49 UTC): Version 1, `ACTIVE`,
   `verify_jwt: true`. Der Eintrag in `UNBACKED_CALLERS` ist entfernt, die
   Produktionsliste nachgemessen (181 = 181).

Bis Schritt 2 erledigt ist, zeigt „Mein Plan" jedes Add-on als „Buchung
folgt". Das ist die Wahrheit, nicht ein Platzhalter.

---

## 4. Tests

| Lauf | Ergebnis |
|---|---|
| `npm run lint` | grün |
| `npm run check:pricing` · `check:limits` · `check:offer-prices` · `check:edge-syntax` · `check:edge-refs` | grün |
| `test/billing/addon-booking.test.ts` | 43 Fälle |
| `test/runtime/db/addon-entitlements.db.test.ts` | 13 Fälle gegen PostgreSQL 16 |
| `test/core/feature-access.test.ts` | Register ↔ App.tsx ↔ Navigation |
| `test/edge/entitlement-gates.test.ts` | Gates in der Quelle |
| `test/market/subscription-addons.test.ts` | Helfer der Fläche |

---

## 5. Was bewusst nicht gemacht wurde

- **Keine Stripe-Objekte angelegt** (AP5 braucht Freigabe).
- **Keine Änderung an `availableFor`** — sichtbar auf der Preisseite
  (§10.3). Siehe §6.2.
- **Keine Änderung der Landing nach dem Checkout** (`/app/billing`) — siehe
  §6.3.
- **Kein Umbau von `/unified-entry/*` und `/os/*`** — eigene Trichter mit
  eigener Anmeldung; sie berühren bestehende Funktionen (§10.3).
- **Keine Gates auf Kontingente** (21 bekannte Divergenzen, `check:limits`).
- **Terminbuchung und weitere Domain nicht als Add-on** — die Booking Engine
  rechnet keine Slots (`reality-matrix.md` §2), und für Domains gibt es
  keinen Pfad zum Hinzufügen. Verkauft wird nur, was liefert.

---

## 6. Befunde für den Eigentümer

### 6.1 Workflows wurden verkauft und waren für jeden zahlenden Kunden gesperrt

`ai.tool.workflows` lag ausschließlich auf der Fremdleiter (silver, gold,
enterprise_public). `/app/workflows` und `workflow-trigger` prüfen genau
diesen Key. Growth nennt `workflows` als Modul. **Behoben** durch
`20260904000200`: Growth 100 Läufe, Agency 1.000, Enterprise unbegrenzt,
Partner 2.500. Die Werte sind gewählt, nicht gemessen — Growth wie seine
Automationsläufe, Agency wie der Vorwert von gold.

### 6.2 `availableFor` nennt Enterprise für Add-ons, die Enterprise schon enthält

Voice, Response Pack, Agency Bot Pack, White Label und Compliance Pack
führen Enterprise in `availableFor`; Enterprise trägt die Keys bereits mit
unbegrenzten Kontingenten. Zur Laufzeit meldet `addonOfferStatus()` sie als
`included` — verkauft wird nichts ohne Gegenwert. Die Liste selbst ist auf
der Preisseite sichtbar (`GovernanceBotsSection`), deshalb unverändert.

**Freigegeben und umgesetzt (2026-09-01)**: `availableFor` der fünf Add-ons
nennt nur noch Growth (Katalog-Migration `20260904000300`). `plan.addons`
von Enterprise bleibt — Bestandsverträge behalten, was sie gebucht haben.

### 6.3 Nach dem Kauf landen Kunden an vier verschiedenen Orten

`/checkout/success` → `/app/billing`; `/welcome` und `/setup-assistant` →
`/app/dashboard`; `/unified-entry/success` → `/app/dashboard` ohne
`/welcome`; `/os/welcome` → `/os/app`. Der Auftrag „am Ende immer derselbe
Flow" spricht für **ein** Ziel: `/app/dashboard` (dort steht die Karte
„Dein nächster Schritt", die aus dem übernommenen Audit rechnet).

**Freigegeben und umgesetzt (2026-09-01)**: `/checkout/success` leitet nach
`/app/dashboard?subscription=…&plan=…`; der Knopf ebenso. Damit landen
`/welcome`, `/setup-assistant`, `/unified-entry/success` und der Checkout am
selben Ort. `/os/welcome` → `/os/app` bleibt als Rest der zweiten Oberfläche.

### 6.4 Zwei weitere Trichter mit eigener Anmeldung

`/unified-entry/register` → `/unified-entry/onboarding` → `/app/dashboard`
umgeht `/welcome` (kein Setup-Assistent, keine `onboarded_at`-Prüfung).
`/os/login` und `/os/app/*` sind eine zweite App-Oberfläche **ohne
Auth-Wrapper**. `/flow/login` führt nach `/os/login`. `/scan/start`,
`/chatbot/start`, `/phonebot/start` sind Stubs mit `alert()`. `/demo` und
`/trial` sind 404. Entfernen oder umleiten greift in Bestehendes ein.

**Freigegeben und umgesetzt (2026-09-01)**: `/unified-entry/register`
leitet nach `/welcome?next=/unified-entry/onboarding` (Parameter bleiben),
`/flow/login` nach `/welcome`, und alle zwölf `/os/app/*`-Routen stehen
hinter `AppGate`. Die Stubs `/scan/start`, `/chatbot/start`,
`/phonebot/start` und die 404 auf `/demo` und `/trial` sind nicht Teil der
Freigabe und bleiben offen.

### 6.5 Was der Reality Map noch fehlt

Mit Welle 3 (§1.6) sind `alerts.email`, `whitelabel.reports`,
`whitelabel.dashboard` und `governance.risk_register` serverseitig
durchgesetzt. `whitelabel.dashboard` hängt über `ENTITLEMENT_DEPENDENCIES`
an `whitelabel.reports` und läuft über dieselbe Function — ein eigenes Gate
gäbe es erst, wenn das Dashboard-Theming einen eigenen Schreibpfad bekommt.

Unverändert `UNKNOWN`: `bots.human_handoff` — im Repo existiert kein
Übergabe-Mechanismus. Das ist keine Gate-Frage, sondern eine Zusage ohne
Software dahinter; entscheiden muss der Eigentümer, ob die Fähigkeit gebaut
oder aus der Feature-Liste genommen wird.

Zwei Betriebsbefunde aus der Messung vom 2026-09-01 (`cron.job` in
Produktion): Für `audit-monitor-cron` und `email-notify-send` ist **kein**
Cron-Job registriert. Monitoring-Drift-Alerts und Kontingent-E-Mails werden
heute also nicht versendet, unabhängig vom Plan. Die Service-Role-Pflicht
auf `audit-monitor-cron` bricht deshalb nichts Laufendes — sie legt nur
fest, wie der Job aufzusetzen ist (Dateikopf der Function).
