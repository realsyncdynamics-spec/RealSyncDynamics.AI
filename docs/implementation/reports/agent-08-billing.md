# Agent 08 – Billing / Unit Economics (Welle 1, Epic #1972)

Stand: 23.10.2026. Repo-HEAD `b4f8a2f` (= `refs/heads/main` laut `git ls-remote`; die lokale Ref `origin/main` = `4df1fde` ist veraltet, `b4f8a2f` enthält u. a. PR #1950 = `b2a6529`).
Strikt lesend. Keine Stripe-, Supabase- oder Provider-Calls. Ausgeführt wurden nur Prüfskripte ohne Schreibzugriff und ohne Netzwerk (Code vorher gelesen):
`node scripts/check-offer-prices.mjs` (ohne `--update`), `node scripts/sync-model-prices.mjs --check`, `node scripts/sync-shared-pricing.mjs --check`, `node --experimental-strip-types scripts/check-limit-canonicity.mjs`. `check-entitlement-parity.mjs` wurde **nicht** ausgeführt, weil es `api.supabase.com` abfragt (`scripts/check-entitlement-parity.mjs:86`).
Status je Aussage: **VERIFIZIERT** (Code/Datei gelesen bzw. Skript gelaufen) · **ABGELEITET** (Schluss aus dem Code, nicht zur Laufzeit geprüft, oder externe Quelle) · **BLOCKIERT** (Grund angegeben).

---

## Kurzfazit

1. **Steuer:** Auf `main` gilt die Regelbesteuerung: Preise netto zzgl. 19 % USt, `PRICING_TAX_MODE = 'EU_STANDARD'` (`shared/pricing.ts:3012`), Stripe Tax ist in allen Checkout-Wegen an (`supabase/functions/_shared/checkout-tax.ts:103`). Das kam mit PR #1950 (gemergt am 23.10.2026). `.github/PR_TRIAGE_POLICY.md:54` schreibt aber weiter den § 19-Hinweis vor. Vier § 19-Branches sind verwaist und veraltet. VERIFIZIERT
2. **Bot-Preise aus dem Epic = bestehende Governance-Pläne:** Starter 79 €, Growth 249 €, Agency 699 € (`shared/pricing.ts:593/673/772`). Bei den Zahlen gibt es keinen Konflikt. Ein Konflikt entsteht nur, wenn eigene „Bot-Pläne“ mit denselben Namen kommen. Enterprise 1.249 € bleibt die höchste Stufe. VERIFIZIERT
3. **Starter-Bot antwortet nicht:** Starter wirbt mit „1 Governance-Bot mit 500 Antworten“ (`shared/pricing.ts:657`). Es fehlt aber `ai.tool.bot_reply` in `PLAN_ENTITLEMENTS.starter` (ab `shared/pricing.ts:1977`) und im DB-Spiegel (`supabase/migrations/20260927112804_entitlement_catalog_mirror.sql:391-417`). `runAiTool` sperrt deshalb mit 403 (`supabase/functions/_shared/ai.ts`, `gateFeature`). Akzeptanz 6 („korrekte Starter-Entitlements“) ist für Bots heute nicht erfüllbar. VERIFIZIERT (statisch) / Laufzeit ABGELEITET
4. **Harte Stopps fehlen oder sind lückenhaft:**
   - Voice-Minuten werden erst nach dem Auflegen gebucht; vor dem Anruf prüft niemand.
   - `limit.ai_cost_monthly_cents` wird nur gezählt, nie durchgesetzt.
   - Der USD-Deckel hängt nicht am Plan: Standard 250 USD je Mandant.
   - Offene Reservierungen zählen nicht mit; der Deckel ist fail-open bei Infrastrukturfehlern.
   - `consumeUsage` ist nicht atomar und fail-open, wenn der Key fehlt.

   VERIFIZIERT
5. **Testphase:** heute 14 Tage (Stripe) bzw. 14 Tage kartenlos nur für Growth, fest im Code. Dazu läuft die Beta: Growth kostenlos bis 31.01.2027 für jeden Mandanten. Für „genau 72 h, durchsetzbar, kein Verbrauch danach“ fehlen eine Einheit in Stunden in der SSoT, Trial-eigene Kontingente, eine Missbrauchssperre pro Person und eine Entscheidung zur Beta. VERIFIZIERT
6. **Webhook:**
   - Signaturprüfung und Idempotenz über `event.id` sind vorhanden.
   - Nicht retry-sicher bei Abbruch mitten in der Verarbeitung (Event gilt dann als erledigt).
   - Keine Reihenfolgesicherung.
   - Kein Handler für `async_payment_succeeded` (SEPA-Einmalkauf).
   - Erstattungen entziehen keine Rechte.

   VERIFIZIERT
7. **Test- und Live-Keys:** Es gibt einen einzigen `STRIPE_SECRET_KEY` bzw. Vault-Eintrag `stripe_secret_key` und ein einziges Supabase-Projekt (`secrets.SUPABASE_PROJECT_ID`). Stripe-Testmodus in Welle 2 und 3 braucht deshalb ein eigenes Staging-Projekt. PR #1819 (`STRIPE_MODE`) wurde ohne Merge geschlossen. VERIFIZIERT
8. **Unit Economics:** Web-Chat-LLM-Kosten sind klein (≈ 0,7–1,6 Ct pro Antwort mit `claude-sonnet-4-6`). Margen bis 80–90 % am Plan-Cap. Die Margenkiller sind:
   - WhatsApp-Servicenachrichten ab 01.10.2026 (≈ 0,0456 € pro Nachricht über 1.000 Freinachrichten je Nummer): Agency mit einer Nummer am Cap nur ~27 % Marge.
   - Voice ohne Stopp.
   - Die Gratis-Beta.
   - Worst-Case-Prompts (bis 0,165 USD pro Antwort).

   ABGELEITET

---

## A) Preis-Wahrheit

### A.1 Plan-Tabelle (SSoT `shared/pricing.ts`)

| Plan | Preis netto (€) | Intervall | Kauf | Trial | Kern-Limits (Preisseite) | Bot-Entitlements (`PLAN_ENTITLEMENTS`) | Quelle |
|---|---|---|---|---|---|---|---|
| Free Audit | 0 | – | free | 0 | 0 Bots, 1 Domain, 1 Seat | keine | `shared/pricing.ts:531-582` |
| Starter | 79 / Jahr 790 (Jahr nicht buchbar) | Monat | checkout, self_service | 14 | 1 Bot, 500 Antworten, 1 Domain, 1 Site, 25 Runs, 1 Seat, keine API | `bots.enabled`, `bots.chat`, `limit.bots 1`, `limit.bot_messages_monthly 500`, **kein `ai.tool.bot_reply`, keine `limit.ai_*`** | `:587-662`, `:1977-1996` |
| Growth | 249 / 2.490 | Monat | checkout | 14 | 2 Bots, 2.000 Antw., 3 Domains, 3 Sites, 100 Runs, 5 Seats, 5.000 API | `bot_reply`, WhatsApp, `ai_calls 2000`, `ai_tokens 2 Mio.`, `ai_cost_monthly_cents 2000`, kein Voice | `:667-758`, `:2006-2044` |
| Agency | 699 / 6.900 | Monat | checkout | **0** | 10 Bots, 10.000 Antw., 10 Domains, 10 Sites, 500 Runs, 15 Seats, 50.000 API | + Voice `limit.bot_voice_minutes_monthly 500`, `ai_cost 10000` | `:766-849`, `:2061-2104` |
| Enterprise | 1.249 (Listenpreis, `priceOnRequest: true`) | Vertrag | inquiry, contract | 0 | 20 Bots, 50.000 Antw. (Anzeige) | alles `-1` (Vertrag) | `:852-944`, `:2124-2168` |
| Partner | 1.999 / 19.000 | legacy | inquiry | 0 | 50 Bots, 100.000 Antw. | Voice 2.500 Min. | `:949-1033` |
| Governance Launch | 349 einmalig | one_time | one_time | 0 | 1 Bot, 1.000 Antw., 3 Seats | kein `bot_reply` | `:1047-1115` |

Alle Werte VERIFIZIERT.

Add-ons (VERIFIZIERT):
- Response Pack 49 €, nur Growth, +5.000 Antworten (`:1238-1257`)
- WhatsApp 99 €, nur Starter, 500 Konversationen (`:1260-1283`)
- **Voice 150 €/Monat zzgl. 0,25 €/Min.**, nur Growth, Grant 500 Min. (`:1287-1310`)
- Modulpreis `voice_bot` 99 € „zzgl. Telefonie je Minute“ (`:1583-1591`), offen als `MODULE_ADDON_PRICE_DIVERGENCE = ['voice_bot']` (`:1524`)

### A.2 Weitere Preisquellen und Abweichungen

| Quelle | Aussage | Abweichung | Status |
|---|---|---|---|
| `src/components/landing/v6/useLandingV6.ts:405-453` | Preise aus der SSoT; in der Beta „0 €“ mit durchgestrichenem Listenpreis, Steuerhinweis aus `COMPANY.taxMode` | keine (SSoT-gebunden) | VERIFIZIERT |
| `src/config/beta.ts:29-46` | `publicOffer: true`; Starter, Growth und Agency „kostenlos bis 31. Januar 2027“ | Preisseite zeigt 0 € statt 79/249/699 | VERIFIZIERT |
| `README.md:197-200` | „Enterprise (ab 1.500 €)“, SSoT = `src/config/pricing.ts` | **widerspricht** 1.249 € und `shared/pricing.ts` als SSoT | VERIFIZIERT |
| `shared/model-prices.ts:7` | Kommentar „Starter €79 … Enterprise+ €1.999“ | „Enterprise+“ ist laut Policy verboten (`.github/PR_TRIAGE_POLICY.md:54`); 1.999 € ist Partner (legacy) | VERIFIZIERT |
| `shared/pricing.ts:2990` `PRICING_TRUST_NOTE` | „14 Tage kostenlos testen“ | kollidiert mit dem Epic-Ziel 72 h und der Beta-Aussage | VERIFIZIERT |
| `src/config/seo.ts:319`, `src/pages/Press.tsx:12` u. a. | Enterprise „auf Anfrage“ | konsistent mit `priceOnRequest` | VERIFIZIERT |
| `scripts/check-offer-prices.mjs` | Lauf: „Kein öffentlicher Betrag ohne einlösbaren Kaufpfad“, 0 Fundstellen; nicht einlösbar: 790/2490/6900 (Jahr), 1249/12490 (Enterprise), 1999/19000 (Partner) | – | VERIFIZIERT (Lauf exit 0) |
| `scripts/check-limit-canonicity.mjs` | 43 Paare, 25 deckungsgleich, **18 bekannte Divergenzen**, z. B. Agency apiCalls 50.000 (Preisseite) vs. 25.000 (Entitlement), Agency bulkJobs 100 vs. 50, Partner seats 100 vs. 50 | Preisseite verspricht mehr API-Calls, als Agency serverseitig bekommt | VERIFIZIERT (Lauf) |
| `sync-shared-pricing --check`, `sync-model-prices --check` | Deno-Zwillinge synchron | – | VERIFIZIERT |
| `check-entitlement-parity.mjs` | gleicht gegen die Prod-DB ab | nicht ausgeführt | BLOCKIERT (Netzwerk/Prod-Call) |

### A.3 Epic-Bot-Preise vs. Bestand

- Starter 79 €, Growth 249 € und Agency 699 € sind **identisch** mit den bestehenden Plänen. Es entsteht kein Zahlenkonflikt, Enterprise 1.249 € bleibt die höchste Stufe. VERIFIZIERT
- Ein Konflikt entsteht nur bei einem separaten „Bot-Plan“ mit gleichem Namen (doppelte Plan-Keys, Stripe-Mapping über `products.default_for_plan_key`, `UNIQUE(tenant_id)` in `subscriptions` → ein Mandant kann nicht Governance-Starter und Bot-Starter parallel haben). Die Policy „Bots nur als abgegrenztes Modul“ spricht für Add-ons/Module (`BookableModuleId`, `shared/pricing.ts:1441ff`), nicht für eine zweite Plan-Leiter. ABGELEITET
- Die Bot-Inhalte der Pläne decken das Epic nur teilweise ab: Starter ohne Bot-Antwort (Kurzfazit 3), Growth ohne Voice, Voice erst ab Agency oder per Add-on 150 €. VERIFIZIERT
- Preisänderungen sind laut `.github/PR_TRIAGE_POLICY.md` Einzel-Freigabe. Siehe offene Fragen.

### A.4 Steuer – siehe „Konflikte zur Entscheidung durch Dominik“ (a)

---

## B) Stripe-Fluss

### B.1 Checkout-Erzeugung (`supabase/functions/stripe-checkout/index.ts`)

Alle Punkte VERIFIZIERT:
- JWT-Prüfung, Rolle owner/admin (`:145-152`).
- Plan-Key gegen die SSoT normalisiert (`:104-108`). Abgewiesen werden `free` (`:109`), `inquiry` (`:112`), `legacy` (`:121`) und Enterprise hart (`ENTERPRISE_SELF_SERVICE_BLOCKED`, `:43`, `:137-141`).
- Price-ID nur aus `public.products.default_for_plan_key`, Positivliste `price_…` (`:183-195`). Keine Price-ID im Code.
- Customer: zuerst wiederverwenden, dann `customers.search` nach `tenant_id`, dann idempotent anlegen (`:260-279`).
- Modus `subscription`/`payment` nur aus `plan.purchaseMode` (`:230`).
- Trial nur, wenn `plan.trialDays > 0` und der Mandant noch keinen hatte (`:244-246`; `customer.ts:40-52`).
- Steuer über `checkoutTaxParams` (`:319-323`).
- Nebenbefund: `base = origin ?? body.return_url ?? SITE` (`:222`). `success_url` kann über Origin/Body auf fremde Hosts zeigen. Das ist ein geringes Risiko (nur der Kunde selbst), sollte aber auf eine Allowlist. ABGELEITET

### B.2 Webhook (`supabase/functions/stripe-webhook/index.ts`)

| Punkt | Ist | Bewertung | Status |
|---|---|---|---|
| Signatur | `constructEventAsync(raw, sig, WEBHOOK_SECRET)` auf dem Raw-Body (`:85-90`); ohne Header 400 (`:73`) | korrekt | VERIFIZIERT |
| Idempotenz | Insert `webhook_events(id=event.id)` **vor** der Verarbeitung; Duplikat → 200 (`:96-113`); bei Exception Row löschen → Stripe-Retry (`:185-189`) | Bei Timeout oder Isolate-Abbruch ohne Exception bleibt die Row stehen. Der Retry wird als Duplikat quittiert, das Event geht **dauerhaft verloren**. Kein Status `processing`/`done`. | VERIFIZIERT (Code), Auswirkung ABGELEITET |
| Retry-Seiteneffekte | `checkout.session.completed` → Grant (idempotent), Welcome-Mail, Rebuild-Trigger, Ad-Conversion, Steuerprüfung (`:173-181`). Wirft ein späterer Schritt, wiederholt Stripe alles. | Mails und Conversions können doppelt laufen | ABGELEITET |
| Reihenfolge | `syncSubscriptionFromStripe` upsertet den Payload ohne Vergleich von `event.created`; nur verspätete Terminal-Events einer abgelösten Subscription werden ignoriert (`_shared/stripe-subscription-sync.ts`, Block `TERMINALE_STATUS`) | Ein älteres `subscription.updated` kann einen neueren Status überschreiben (z. B. `trialing` nach `active`) | VERIFIZIERT |
| Price → Plan | `price.metadata.plan_key`, dann `products.stripe_price_id`, sonst **`free_audit`** (`resolvePlanKeyFromItem`) | Eine unbekannte Price-ID stuft einen zahlenden Kunden still auf Free; kein Alarm | VERIFIZIERT |
| Plan → Entitlements | `tenant_entitlements_resolve()` (`supabase/migrations/20260928160000_wp2a_trial_end_expiry.sql`): neueste `subscriptions`-Zeile; `active`; `trialing` bis `trial_end`; `past_due` 7 Tage Grace; dann Produkt über `stripe_price_id` bzw. `plan_key`; Grants und Add-ons werden per MAX bzw. SUM vereinigt | sauber, serverseitig | VERIFIZIERT |
| Einmalkauf | `recordOneTimePurchase` → `entitlement_grants` UNIQUE(source, purchase_reference=session.id) (`:339-420`); `payment_status != paid` → `revoked` | Kein `case 'checkout.session.async_payment_succeeded'` (0 Treffer, obwohl `:406` darauf verweist). **SEPA-Einmalkäufe bleiben ohne Rechte.** | VERIFIZIERT |
| Erstattung/Dispute | `charge.refunded` → nur `stripe_payment_events` (`:169-171`, `:677ff`); kein Handler für `charge.dispute.*` | Erstattete Einmalkäufe behalten ihren Grant | VERIFIZIERT |
| Seats | Webhook speichert `quantity`; `limit.team_seats` wird auf main **nicht** durchgesetzt; PR #1907 (Draft, offen, Head `eb360de`) setzt es in `tenant-invite` durch, nicht atomar | Draft-PR fortführen | VERIFIZIERT (PR-Text) |
| Kündigung/Downgrade | Portal (`stripe-portal`); `cancel_at_period_end` und `canceled_at` werden synchronisiert; `canceled` → Resolver liefert Free-Rechte; Add-on-Grants werden widerrufen (`syncAddonItems`) | funktional; Daten bleiben, Rechte fallen weg | VERIFIZIERT |
| `past_due` | 7 Tage volle Rechte (Resolver) | Nach einer fehlgeschlagenen ersten Abbuchung am Trial-Ende gibt es 7 Tage bezahlte Nutzung ohne Zahlung (Akzeptanz 6) | VERIFIZIERT |

### B.3 Issues #1039 und #923 – Ist-Stand je Punkt

| Punkt (#923/#1039) | Repo-Stand | Status |
|---|---|---|
| Live-Price 349 € one_time in `products` | Migrationen und Issue-Text vom 25.08. | VERIFIZIERT (Issue), aktueller DB-Stand BLOCKIERT (kein DB-Zugriff) |
| `checkout-siteos-project`/`stripe-webhook` deployed | laut Issue vom 25.08. ACTIVE | BLOCKIERT (keine Prod-Abfrage erlaubt) |
| Live-Webhook-Endpoint in Stripe | Issue: „zero webhook endpoints configured“ | BLOCKIERT (Stripe-Dashboard/API verboten). Laut Repo unverändert offen (beide Issues offen, letzte Aktualisierung 25.08.) |
| `checkout.session.completed` → `entitlement_grants` | Code vorhanden (B.2), SEPA-Lücke | VERIFIZIERT (Code) |
| SiteOS-Zugriff nach dem Kauf | nicht geprüft (Agent 02/10) | – |

### B.4 Test- vs. Live-Key-Trennung (nur Namen)

Alle Punkte VERIFIZIERT:
- Server: `STRIPE_SECRET_KEY` (34×), `STRIPE_WEBHOOK_SECRET` (17×), Vault `stripe_secret_key`/`stripe_webhook_secret`, `STRIPE_METER_SHARED_SECRET`, Client `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_CONNECT_CLIENT_ID`. Kein `STRIPE_TEST_SECRET_KEY` und keine Mode-Variable. `STRIPE_MODE` gibt es nur lokal in `scripts/provision-stripe-vault.sh:57-58`, abgeleitet aus dem Key-Präfix.
- Vault-first, env-fallback (`stripe-checkout/index.ts:56-66`, `stripe-webhook/index.ts:56-67`). **Wer den Vault-Wert setzt, schaltet Prod zwischen Test und Live um.** Live-Price-IDs in `products` (Migration `20261020130000_stripe_live_net_exclusive_price_ids.sql`) funktionieren mit einem Test-Key nicht und umgekehrt.
- CI kennt genau ein Supabase-Projekt: `secrets.SUPABASE_PROJECT_ID` (18×), z. B. `.github/workflows/deploy.yml:38`. Kein Staging-Projekt. `STRIPE_TEST_MODE` ist nur ein Skip-Schalter für E2E (`.github/workflows/e2e.yml:30`, `tests/e2e/checkout.spec.ts:3`). `docker/realsync-web-staging/.env.example:16` sieht `pk_test` vor, ein Server-Gegenstück fehlt.
- PR #1819 „Testmodus-Schalter (STRIPE_MODE) für die Beta“ wurde am 23.10.2026 ohne Merge geschlossen.
- Gefahr: Welle 2/3 verlangt „Stripe test mode only“. Gegen das einzige Projekt hieße das Live-Key oder Prod-Umschaltung. Ein Live-Key in Nicht-Prod-Pfaden ist möglich, weil `.env.docker.example:88` `STRIPE_SECRET_KEY="sk_live_..."` als Muster zeigt und es keinen Guard gibt, der in Nicht-Prod `sk_live` ablehnt.
- Kosmetisch: `src/features/admin/pages/AdminAPIKeysPage.tsx:25` zeigt einen maskierten Mock `sk_live_51H2L8axx••••` (Demo-Daten, kein Secret; irreführend). VERIFIZIERT (Datei), kein echter Wert.

---

## C) Trial / Testphase

### C.1 Ist-Implementierung (drei parallele Wege)

| Weg | Dauer | Start | Ablauf | Serverseitig? | Beleg |
|---|---|---|---|---|---|
| Stripe-Trial im Checkout | `plan.trialDays` = 14 (Starter, Growth), 0 (Agency, Enterprise) | Checkout `trial_period_days` | Stripe setzt den Status; Resolver akzeptiert `trialing` bis `trial_end` | ja | `stripe-checkout/index.ts:244-246`; `shared/pricing.ts:662/758/849/944` |
| Kartenloser Growth-Trial | **fest 14 Tage im Code** (`14 * 24 * 60 * 60 * 1000`), nur `planKey === 'growth'` | `create-trial-subscription` | Resolver (Zeit); Status bleibt `trialing` | ja (Resolver); jedes Mitglied darf starten, nicht nur owner/admin | `supabase/functions/create-trial-subscription/index.ts` |
| Beta | Growth bis `2027-01-31T23:00Z` | `beta-enroll` (owner/admin) | Resolver; Server-Schalter `BETA_PHASE`, Frontend `VITE_BETA_PHASE` (zwei getrennte Schalter) | ja | `beta-enroll/logic.ts:17,20,83-87`; `src/config/beta.ts:16-29` |

Durchsetzung: `tenant_entitlements_resolve` zählt `trialing` nur bis `COALESCE(trial_end, trial_ends_at)` (Migration `20260928160000`, getestet laut Kommentar in `test/runtime/db/trial-expiry.db.test.ts`). VERIFIZIERT

Wechselwirkungen:
- `decideEnrollment` verlängert einen abgelaufenen kartenlosen Growth-Trial ausdrücklich auf das Beta-Ende (`logic.ts:69`).
- Eine Testphase gibt es nur **einmal pro Mandant**, nicht pro Person, E-Mail oder Karte (`customer.ts:40-52`; `create-trial-subscription` prüft nur den Mandanten). Neue Mandanten bekommen erneut eine Testphase.

VERIFIZIERT

### C.2 Was für „genau 72 h, durchsetzbare Limits, abgelaufene Trials verbrauchen nichts“ fehlt (Akzeptanz 1 + 6)

1. **Einheit:** `trialDays: number` (`shared/pricing.ts:496`) hat keine Stunden. Nötig ist z. B. `trialHours: 72` in der SSoT plus Generator-Sync. Checkout müsste `subscription_data.trial_end = now + 72 h` statt `trial_period_days` setzen. Stripe verlangt dafür, soweit bekannt, mindestens 48 h Vorlauf, 72 h liegen darüber. ABGELEITET (Stripe-Doku-Wissen, nicht live geprüft)
2. **Kartenloser Pfad:** feste 14 Tage und nur Growth in `create-trial-subscription`. Muss auf die SSoT umgestellt werden, mit Ziel-Plan (Starter?) und Rollenprüfung owner/admin. VERIFIZIERT
3. **Trial-eigene Kontingente:** Heute gilt im Trial das volle Plankontingent (Growth: 2.000 Antworten, 2 Mio. Tokens, USD-Deckel 250 USD). Nötig ist ein eigenes Produkt `trial_72h` in `products`/`product_entitlements` mit kleinen Caps (z. B. 100 Antworten, 0 Voice, WhatsApp nur Sandbox, LLM-Deckel wenige €), das der Resolver bei `status='trialing'` wählt. VERIFIZIERT (Ist) / Vorschlag
4. **Missbrauch:** Sperre pro Person, E-Mail-Domain bzw. Karten-Fingerprint (Stripe `payment_method.card.fingerprint`) in einer eigenen Tabelle. Heute: beliebig viele Mandanten, also beliebig viele Testphasen. VERIFIZIERT (Lücke)
5. **„Kein bezahlter Verbrauch nach Ablauf“:**
   - (a) Der USD-Deckel `cost_check_and_reserve` hängt nicht am Plan (Standard 250 USD, `20260604000000_economic_intelligence.sql:186-193`).
   - (b) `past_due` gibt 7 Tage volle Rechte, auch nach einem Trial ohne erfolgreiche erste Zahlung.
   - (c) Voice-Minuten werden nicht vorab geprüft (D).
   - (d) `consumeUsage` ist nicht atomar.
   - (e) Monatszähler sind an den Kalendermonat gebunden (`usage.ts` `periodMonth`), nicht an das Trial-Fenster.

   VERIFIZIERT
6. **Beta vs. 72 h:** Die Beta (bis 31.01.2027, Growth gratis, öffentlich beworben) widerspricht einer 72-h-Testphase direkt. Dominik muss entscheiden. VERIFIZIERT (Konflikt)
7. Nebenwirkung: `customer.subscription.trial_will_end` feuert bei Stripe 3 Tage vor Ende, bei 72 h also sofort beim Start (`stripe-webhook/index.ts:131-136` bucht `trial_will_end`). Mail-Flows prüfen. ABGELEITET
8. Werbetext: `PRICING_TRUST_NOTE` „14 Tage“ (`shared/pricing.ts:2990`) und die 14-Tage-Texte in `useLandingV6.ts:424-425` folgen `trialDays` bzw. müssen angepasst werden. VERIFIZIERT

---

## D) Metering / Quota / Kostenobergrenzen

| Pfad | Erfassung | Vorab-Stopp | Lücke | Beleg | Status |
|---|---|---|---|---|---|
| `ai-gateway` (Issue #1646) | `usage_events` `limit.ai_calls_monthly` +1 und `limit.ai_tokens_monthly` +Tokens **nach** dem Call | nur Rate-Limit pro Isolate (In-Memory-Maps); keine Monatsquote | ohne `tenantId` wird nichts gebucht (`handler.ts:101`). Cloud-Fallback hart aus (`ai-gateway/index.ts:155`), daher Ollama-Kosten = VPS, nicht pro Token | `ai-gateway/index.ts:186-187`, `handler.ts:280-295,470-494` | VERIFIZIERT. #1646 teilweise erledigt (Zuordnung über Principal vorhanden; PR #1674 geschlossen) |
| `runAiTool` (Bots, Agenten) | `ai_tool_runs.cost_usd` aus `shared/model-prices.ts`; `usage_events` calls, tokens, `ai_cost_monthly_cents` | Vorab: `ai_calls` und `ai_tokens` (Zählerprüfung, nicht atomar); USD-Reservierung | **`limit.ai_cost_monthly_cents` wird nur gebucht (`_shared/ai.ts:389`), nie geprüft.** Reserve-Fehler → „proceeding“ (fail-open, `_shared/ai.ts:330`). Preis fehlt → 503 (fail-closed, gut) | `_shared/ai.ts:151-170,226-330` | VERIFIZIERT |
| USD-Deckel `cost_check_and_reserve` | `tenant_cost_ledger` | `throttle`, wenn used + estimate > cap | Cap aus `tenant_cost_caps`, Standard **250 USD pro Mandant und Monat unabhängig vom Plan**. Reservierungen werden mit `cost_kind='reservation'` geschrieben, die Summe zählt nur `llm_input`/`llm_output`, also **zählen offene Reservierungen nicht**. Kein Lock, parallele Calls überschießen | `20260604000000_economic_intelligence.sql:162-243` | VERIFIZIERT |
| Bot-Antworten (Chat, WhatsApp) | `consumeUsage('limit.bot_messages_monthly')` | ja, aber Prüfung und Insert nicht atomar. **`planLimit === null` (Key fehlt) → unbegrenzt** | Race bei Parallelität; fail-open bei fehlendem Key | `_shared/usage.ts` `consumeUsage`; `bot-chat/index.ts:109`; `whatsapp-webhook/index.ts:160` | VERIFIZIERT |
| WhatsApp-Konversationen | `recordUsage('limit.whatsapp_conversations_monthly')` | **nein** | Add-on verspricht 500 Konversationen, nicht durchgesetzt | `whatsapp-webhook/index.ts:189` | VERIFIZIERT |
| Voice-Minuten | `recordUsage('limit.bot_voice_minutes_monthly', ceil(sec/60))` nach dem Auflegen | **nein**, nur `gateFeature('bots.voice')` | Kein Minutenstopp vor oder während des Anrufs, keine maximale Anrufdauer im Code gefunden. Agency 500 Min., Enterprise −1 | `bot-voice-webhook/index.ts:168-171,221,271` | VERIFIZIERT |
| Stripe-Metering | `stripe-meter-sync` stündlich (Cron-Migration `20260506100000`), `stripe-token-meter-sync` | – | Ob in Stripe Metered-Preise für Voice-Overage (0,25 €/Min.) existieren und gemappt sind | – | BLOCKIERT (kein Stripe-/DB-Zugriff) |

Modellpreistabelle (`shared/model-prices.ts`):
- Nur `provider: 'anthropic'` (`:41`), Quelle `'anthropic-pricing-2026-06-24'`, statisch gepflegt.
- `scripts/sync-model-prices.mjs` kopiert nur in den Deno-Zwilling; es holt keine Preise.
- `bot_reply` = `claude-sonnet-4-6` zu 3/15 USD je 1 Mio. Tokens (`20260628120200_bots_ai_tool.sql:16-25`, Tabelle `:162-168`).
- Google/OpenAI-Tools hätten keinen Preis, also `MODEL_PRICE_MISSING`.
- Alles in USD, kein Wechselkurs in der Pipeline.

VERIFIZIERT

Issue #1153 (Voice/Storage), offen:
- Gefordert sind Voice-Add-on 99 € + 0,22 €/Min., `storage_pack` 9 €/10 GB und Agency `self_service`.
- Ist: Voice-Add-on 150 € + 0,25 €/Min. (`shared/pricing.ts:1287-1291`), kein `storage_pack` in `AddOnId` (`:1183-1189`), Agency ist bereits `self_service` (`:777`), Divergenz `voice_bot` 99 € offen (`:1524`).
- Punkt 3 aus #1153 ist erledigt, 4 und 5 sind offen.

VERIFIZIERT

---

## E) Unit Economics (Akzeptanz 8): Modell je Plan

Alle Zahlen in diesem Abschnitt sind ABGELEITET. Rechenskript: `/tmp/claude-0/-home-user-RealSyncDynamics-AI/f7cd4ce3-3e59-5612-9832-d4dbd1e437cd/scratchpad/wave1/ue.mjs` (außerhalb des Repos). Es sind **keine gemessenen Kosten**: Echte Kosten lassen sich aus `ai_tool_runs.cost_usd`, `usage_events` und `tenant_cost_ledger` messen, das ist aber **BLOCKIERT** (keine Prod-DB-Abfrage erlaubt).

### E.1 Annahmen

- **Wechselkurs:** 1 USD = 0,90 € (Annahme, Abrufdatum keines; ±10 % Sensitivität beachten).
- **LLM (Repo-Tabelle):** `claude-sonnet-4-6` Input 3 USD, Output 15 USD je 1 Mio. Tokens (`shared/model-prices.ts:162-168`).
  - Basis pro Antwort: 1.500 Input-Tokens (System-Prompt + Persona + Verlauf + Nachricht, `bot-chat/index.ts:146`) und 200 Output. Ergibt 0,0075 USD.
  - Pessimistisch: 4.000/400, ergibt 0,018 USD.
  - Worst Case: `maxInputChars` 200.000 (`_shared/ai.ts` `runAiTool`) ≈ 50.000 Tokens Input plus `max_tokens` 1.024 Output, ergibt **0,165 USD pro Antwort**.
  - Kein Prompt-Caching angenommen.
  - Konversation = 4 Bot-Antworten.
- **WhatsApp (Meta, DE):**
  - Seit 01.07.2025 Preis pro Nachricht.
  - **Ab 01.10.2026 sind Servicenachrichten über 1.000 Freinachrichten je Business-Nummer und Monat kostenpflichtig**, ebenso Utility-Nachrichten im 24-h-Fenster.
  - DE-Satz ≈ 0,0456 € je Utility- bzw. Servicenachricht, Marketing ≈ 0,1131 €.
  - Quellen: [Meta Pricing-Doku](https://developers.facebook.com/docs/whatsapp/pricing) (Abruf 23.10.2026; Regeln und Daten); EUR-Satz nur von Drittanbietern: [ChatMaxima Oktober 2026](https://chatmaxima.com/blog/whatsapp-service-message-pricing-october-2026/), [meetergo](https://help.meetergo.com/en/integrations/automation/whatsapp-pricing) (Abruf 23.10.2026). Den offiziellen EUR-Rate-Card-CSV vor Budgetierung prüfen. BSP-Aufschläge sind nicht enthalten.
- **Telefonie (Twilio DE):**
  - Inbound Ortsnetz 0,0100 USD/Min., Ortsnummer 1,35 USD/Monat, Mobilnummer 30 USD/Monat.
  - Outbound Festnetz 0,0283 USD/Min., Mobil aus dem EWR 0,0420 USD/Min.
  - Quelle: [Twilio Voice Pricing DE](https://www.twilio.com/en-us/voice/pricing/de), Stand August 2026 (Abruf 23.10.2026).
- **Spracherkennung:**
  - Das Repo nutzt Twilio `<Gather input="speech">` (`bot-voice-webhook/index.ts:6-9`). Twilio nennt 0,02 USD je 15 s Gather bzw. 0,07 USD/Min. Headline bzw. 0,018–0,025 USD pro Nutzung; die Angaben widersprechen sich.
  - Quellen: [Twilio Speech Recognition](https://twilio.com/speech-recognition), [Twilio Voice Pricing](https://www.twilio.com/voice/pricing) (Abruf 23.10.2026).
  - Vergleich: Deepgram Nova-3 Streaming 0,0048–0,0077 USD/Min., Aura-2 TTS 0,030 USD/1.000 Zeichen ([Deepgram Pricing](https://deepgram.com/pricing), Abruf 23.10.2026).
- **Voice pro Minute:**
  - Basis: Inbound 0,010 + STT 0,04 (≈ 50 % Sprechzeit) + TTS 0,0225 (≈ 750 Zeichen) + LLM 0,0225 (3 Turns) = 0,095 USD ≈ **0,086 €/Min.**
  - Pessimistisch: 0,010 + 0,07 + 0,045 + 0,054 = 0,179 USD ≈ **0,161 €/Min.**
- **Stripe (EWR-Standardkarte):** 1,5 % + 0,25 €, Stripe Billing 0,7 % des Billing-Volumens, Stripe Tax 0,5 % pro Transaktion (No-Code) bzw. 0,45 € (API), SEPA 0,35 €. Gebühren fallen auf den **Bruttobetrag** an. Quelle: [stripe.com/de/pricing](https://stripe.com/de/pricing) (Abruf 23.10.2026).
- **Infrastruktur pro Mandant (Annahme):** Starter 3 €, Growth 5 €, Agency 10 € pro Monat (anteilig Supabase, Cloudflare, VPS/Ollama, E-Mail). Nicht gemessen, BLOCKIERT für Ist-Werte.
- **Nicht enthalten:** Support, Onboarding, Akquise, Rechts- und Steuerberatung, Chargebacks.

### E.2 Ergebnis je Plan und Steuervariante (Web-Chat, Plan-Cap voll ausgeschöpft)

„Budget“ = Netto × (1 − Zielmarge) − Stripe − Infra = verfügbare variable Kosten.

**Variante A: Netto zzgl. 19 % USt (Stand main, EU_STANDARD).** Kunde zahlt brutto 94,01 / 296,31 / 831,81 €.

| Plan | Netto | Stripe | LLM am Cap (Basis/pess.) | DB-Marge am Cap (Basis/pess.) | max. Web-Konv. bei 60 % / 70 % (Basis) | pess. | max. Voice-Min. bei 70 % (Basis/pess.) |
|---|---|---|---|---|---|---|---|
| Starter (500 Antw.) | 79,00 | 2,79 | 3,38 / 8,10 € | 88,4 % / 82,4 % | 955 / 663 | 398 / 276 | 209 / 111 |
| Growth (2.000) | 249,00 | 8,25 | 13,50 / 32,40 € | 89,3 % / 81,7 % | 3.198 / 2.275 | 1.332 / 948 | 718 / 381 |
| Agency (10.000) | 699,00 | 22,71 | 67,50 / 162,00 € | 85,7 % / 72,1 % | 9.144 / 6.555 | 3.810 / 2.731 | 2.070 / 1.098 |

**Variante B: Listenpreise als Brutto inkl. 19 % USt.** Netto 66,39 / 209,24 / 587,39 €.

| Plan | Netto | Stripe | DB-Marge am Cap (Basis/pess.) | max. Web-Konv. 60 % / 70 % (Basis) | Voice-Min. bei 70 % (Basis/pess.) |
|---|---|---|---|---|---|
| Starter | 66,39 | 2,38 | 86,8 % / 79,7 % | 784 / 538 | 169 / 90 |
| Growth | 209,24 | 6,97 | 87,8 % / 78,8 % | 2.656 / 1.881 | 594 / 315 |
| Agency | 587,39 | 19,12 | 83,6 % / 67,5 % | 7.623 / 5.447 | 1.720 / 913 |

**Variante C (historisch, § 19 UStG, Brutto = Netto, keine Stripe-Tax-Gebühr):** Starter 89,4 %, Growth 90,3 %, Agency 86,7 % (Basis). Bei § 19 entfallen USt und die Stripe-Tax-Gebühr. Der Kunde zahlt weniger als in A. Ein späterer Wechsel aus C kostet bei gleichem Endpreis 16 % Netto (Variante B).

Auswirkungen Brutto/Netto:
- Variante B senkt den Nettoerlös um 16 % (79 → 66,39 €), die Budgets für variable Kosten um ~18–19 %.
- Variante A erhöht den Kundenpreis um 19 % (B2B mit Vorsteuerabzug neutral, für Kleinbetriebe ohne Vorsteuerabzug nicht).
- Stripe-Gebühren auf brutto: in A ~0,4–0,5 Prozentpunkte höher als in C.

### E.3 Kanäle mit Kostensprung

- **WhatsApp am Cap, eine Nummer:**
  - Growth: 1.000 kostenpflichtige Nachrichten ≈ 45,60 €, Marge sinkt auf 70,9 % (A) bzw. 66,0 % (B).
  - **Agency: 9.000 × 0,0456 ≈ 410 €, Marge 27 % (A) bzw. 13,7 % (B).**
  - Mit 10 Nummern (je 1.000 frei) ≈ 0 €.
  - Wer zahlt Meta, die Plattform oder der Kunde über seine eigene WABA? Siehe offene Fragen.
- **Voice:**
  - Agency enthält 500 Minuten: 42,75–80,55 € Kosten.
  - Voice-Add-on SSoT, wenn 500 Minuten inklusive sind: 150 € Erlös, 68 % / 43 % Marge.
  - Wenn jede Minute 0,25 € kostet und 500 Minuten der Cap sind: 275 € Erlös, ≈ 81 % / 67 %.
  - Vorschlag #1153 (99 € + 0,22 €/Min.): mit 500 inklusive 53 % / 15 %; jede Minute berechnet ≈ 76 % / 58 %.
  - **Eine Overage-Abrechnung ist nicht belegt (BLOCKIERT)**, und einen Hard Stop gibt es nicht.
- **Worst Case LLM:** 2.000 Growth-Antworten × 0,165 USD ≈ 331 USD > Netto-Erlös. Begrenzt wird das heute nur durch den Plan-unabhängigen Deckel von 250 USD ≈ 225 €, also **eine negative Marge ist möglich**.
- **Beta:** Erlös 0 € bei Growth-Kontingent, also **pro Beta-Mandant bis ≈ 13,50–32,40 € LLM plus bis 45,60 € WhatsApp pro Monat Verlust, im Worst Case bis zum Deckel von ≈ 225 €.** Mandanten sind unbegrenzt anlegbar.

### E.4 Break-even und Stopp-Schwellen (Vorschlag, nicht entschieden)

Break-even (DB = 0) Web-Chat, Variante A:
- Starter ≈ (79 − 5,79) / 0,027 € ≈ 2.700 Konversationen (bei Cap 125 nicht erreichbar).
- Growth ≈ 8.900.
- Agency ≈ 22.700.

Kritisch sind nur die Caps-Umgehungen (fail-open, Voice, WhatsApp, Beta).

Stopp-Schwellen, abgeleitet aus 70 % Zielmarge (Variante A, Basis):

| Plan | LLM-Deckel €/Monat (statt 250 USD) | Warnschwelle | Voice-Hard-Stop | WhatsApp-kostenpflichtige Nachrichten |
|---|---|---|---|---|
| Starter | ≈ 18 € | 80 % | 0 (nicht im Plan) | 0 (Add-on separat) |
| Growth | ≈ 60 € | 80 % | 0 ohne Add-on | ≤ ~1.300 |
| Agency | ≈ 175 € | 80 % | 500 Min. hart, danach nur mit belegter Metered-Abrechnung | ≤ ~3.800 |

Die bestehenden Werte `limit.ai_cost_monthly_cents` (Growth 2.000 = 20, Agency 10.000 = 100; Einheit unklar, € oder USD) wären strenger und sinnvoll, **sind aber nicht durchgesetzt**.

---

## F) Margenrisiken (Top 10) mit Gegenmaßnahme

| # | Risiko | Beleg | Gegenmaßnahme |
|---|---|---|---|
| 1 | Voice ohne Hard Stop; Minuten erst nach dem Auflegen gebucht; Enterprise unbegrenzt | `bot-voice-webhook/index.ts:168-171` | Restminuten vor jedem Gather prüfen, Twilio `timeLimit` pro Anruf, Stopp bei 100 %, Overage nur mit belegtem Metered-Preis |
| 2 | Gratis-Beta bis 31.01.2027 mit Growth-Kontingent, unbegrenzt viele Mandanten | `beta-enroll/logic.ts:17-20`, `src/config/beta.ts:29` | Beta-Produkt mit eigenen Mini-Caps; eine Beta pro Person/Domain; Beta-Ende oder 72 h entscheiden |
| 3 | Trial-Missbrauch: eine Testphase pro Mandant statt pro Person/Karte | `stripe-checkout/customer.ts:40-52`, `create-trial-subscription` | `trial_claims`-Tabelle (user_id, E-Mail-Domain, Karten-Fingerprint) |
| 4 | Plan-Kostenlimit `limit.ai_cost_monthly_cents` nicht durchgesetzt; USD-Deckel plan-unabhängig 250 USD | `_shared/ai.ts:389`; `economic_intelligence.sql:186-193` | `tenant_cost_caps` aus dem Plan ableiten (Trigger beim Abo-Sync) bzw. `ai_cost` vorab prüfen |
| 5 | Reservierungen zählen nicht, kein Lock, fail-open bei Reserve-Fehler | `economic_intelligence.sql:203-243`; `_shared/ai.ts:330` | Reservierungen in die SUM einbeziehen, `pg_advisory_xact_lock(tenant)`, fail-closed |
| 6 | `consumeUsage` nicht atomar und fail-open bei fehlendem Key | `_shared/usage.ts` | SQL-Funktion „check+insert“ in einer Transaktion mit Lock; fehlender Key bei bezahlten Features = Sperre |
| 7 | WhatsApp-Servicenachrichten ab 01.10.2026 kostenpflichtig; Konversationslimit nicht durchgesetzt | `whatsapp-webhook/index.ts:189`; Meta-Doku | Pro Nummer zählen, Stopp vor Versand, Kunde bringt eigene WABA (Meta zahlt der Kunde) oder Durchreichung |
| 8 | USD-Providerkosten bei EUR-Preisen, Wechselkurs nicht modelliert | `shared/model-prices.ts` (nur USD) | Wechselkurs-Puffer 10 % in den Caps, Wechselkurs als Konfiguration, Quartalsreview |
| 9 | Worst-Case-Prompt 200.000 Zeichen pro Bot-Antwort | `_shared/ai.ts` `maxInputChars`, `bot-chat` | Bot-Input auf z. B. 8.000 Zeichen kappen, Verlauf auf N Turns, Prompt-Caching |
| 10 | Webhook-Lücken: SEPA-Einmalkauf ohne Rechte; Erstattung ohne Entzug; Event-Verlust bei Abbruch; unbekannte Price → Free | B.2 | Status-Spalte, `async_payment_*`, `charge.refunded` und `dispute` → Grant widerrufen, Alarm bei Fallback auf `free_audit` |
| + | `past_due` 7 Tage volle Rechte nach dem Trial | Resolver `20260928160000` | Grace nur für bereits einmal bezahlte Abos |
| + | Starter-Bot-Versprechen ohne Bot-Antwort-Recht (Erstattungs- und Claim-Risiko) | `shared/pricing.ts:657` vs. `:1977ff` | Entitlement ergänzen (Preisentscheidung) oder Claim entfernen |

---

## Konflikte zur Entscheidung durch Dominik

Hier wird nur dokumentiert, nichts entschieden.

### (a) Steuer: § 19 UStG vs. Regelbesteuerung

**Stand main (`b4f8a2f`): USt-pflichtig, netto zzgl. 19 %.** VERIFIZIERT
- `shared/pricing.ts:3012` `PRICING_TAX_MODE = 'EU_STANDARD'`; Hinweis `:2996` „Angebot nur für Unternehmer (B2B) – alle Preise zzgl. gesetzlicher Umsatzsteuer.“
- `supabase/functions/_shared/checkout-tax.ts:103` `automatic_tax.enabled = taxMode === 'EU_STANDARD'`; `TAX_CHECKED_MARKETS = ['DE']` (`:32`); USt-IdNr.-Erfassung, Rechnungsadresse Pflicht.
- `stripe-webhook` markiert abweichende Steuerfälle zur manuellen Prüfung (`stripe-webhook/index.ts:554ff`).
- Migration `20261020130000_stripe_live_net_exclusive_price_ids.sql`: products auf neue Netto-Live-Preise (`tax_behavior: exclusive`). Ob angewendet: BLOCKIERT (kein DB-Zugriff).
- AGB B2B-Klausel `src/features/legal/LegalTerms.tsx:94`; Impressum „USt-IdNr. noch nicht vergeben“ `src/features/legal/Impressum.tsx:134`; `src/enterprise-os/pages/LegalPage.tsx:139` „zzgl. der gesetzlichen Umsatzsteuer“.
- Eingeführt durch **PR #1950** (gemergt 23.10.2026 14:13Z, Commit `b2a6529`, 20 Dateien, +780/−63). Er enthält den Inhalt von #1939.
- **Issue #1938 (offen):** Stripe Tax, Steuerregistrierungen und `tax_behavior: exclusive` auf allen Live-Preisen im Dashboard. Repo-seitig weitgehend vorbereitet, Stripe-seitig BLOCKIERT (nicht prüfbar).

**Branches (lesend über GitHub-API; lokal nicht gefetcht):**

| Branch | Head | Inhalt (Diff des eigenen Commits) | PR | Passt zur USt-Pflicht? |
|---|---|---|---|---|
| `fix/stripe-tax-kleinunternehmer-19` | `61f7cea` (10.10.) | 1 Commit, 2 Dateien, +11/−5: `stripe-checkout` `automatic_tax: false`, § 19-Satz in `invoice-email` | keiner | **Nein**, das Gegenteil. Basis veraltet (vor `checkout-tax.ts`) |
| `fix/checkout-steuer-p19` | `54fe190` (10.10.) | 3 Commits (`315df0a`, `4721b16`, `54fe190`): erste Version von `checkout-tax.ts` mit Modus EXEMPT, DE-Sperre, `billing_country` Pflicht | **#1844** geschlossen 15.10., nicht gemergt | Nein für EXEMPT. Die Mechanik ging modusneutral in #1950 auf |
| `fix/stripe-checkout-tax-mode-2026-10-10` | `9cc250e` (10.10.) | 3 Commits (`c2794a2`: 1 Datei +6/−4 `stripe-checkout`; Test; Doku „§19 checkout boundaries“) | keiner | Nein, durch #1950 überholt |
| `fix/pricing-tax-eu-standard` | `aeef898` (20.10.) | 1 Commit, 9 Dateien, +19/−18: `PRICING_TAX_MODE = EU_STANDARD`, § 19-Texte ersetzt | **#1939** geschlossen 23.10. 14:33Z (Inhalt über #1950 gemergt) | **Ja**, ist auf main |
| zusätzlich `feat/vat-regelbesteuerung` | `ff05a6f` | Regelbesteuerung (Draft) | **#1896** geschlossen 23.10. | ja, überholt |
| zusätzlich `chore/vat-stripe-exclusive-prices` | `39b138a` | Stripe-Live-Plan und SQL (Doku-Draft) | **#1897** geschlossen 23.10. | ja, überholt |

Exaktes `git diff --stat origin/main...origin/<branch>`: BLOCKIERT, weil die Branch-Refs lokal nicht vorhanden sind und `git fetch` laut Auftrag vermieden werden soll. Statt eines Drei-Punkt-Diffs wurden die Commit-Stats über `mcp__github__get_commit` und `list_commits` erhoben (siehe Tabelle).

Historie: PR #1716 (gemergt 03.10., § 19-Hinweis) → #1748 (Regelbesteuerung, geschlossen 10.10.) → #1844 (§ 19-Checkout, geschlossen 15.10.) → #1939/#1950 (USt-pflichtig, 23.10.). #1336 (12.09., `automatic_tax` an) und #1587/#1588 (§ 19-Varianten, geschlossen 29.09.).

**Verbleibende § 19-Fundstellen (pfad:zeile), Stand main** (VERIFIZIERT per grep, ohne `.archive/`, Lockfiles, `*.generated.ts`, Migrationen):

- **Normativ, überholt:**
  - `.github/PR_TRIAGE_POLICY.md:54` („Im Pricing-Hinweis steht: Gemäß § 19 UStG …“)
  - `.claude/os-funnel/OKTOBER-2026.md:36,54,74,155,197,232` (E-O3 „§ 19 festgelegt“)
- **Dormanter Code** (nur im Modus EXEMPT aktiv, korrekt modusabhängig):
  - `shared/pricing.ts:3000-3002,3008`
  - `supabase/functions/_shared/checkout-tax.ts:14-15,56`
  - `supabase/functions/stripe-checkout/index.ts:283-284`
  - `supabase/functions/stripe-webhook/index.ts:554`
  - `src/config/company.ts:58`
- **Veraltete Texte:**
  - `src/i18n/handoff.ts:19-20,84,191` (`pricingFoot` „§ 19 UStG“). Wird in `src/features/billing/PricingPage.tsx:131` nur bei EXEMPT gezeigt, also aktuell nicht sichtbar.
  - `src/lib/compliance-notices.ts:212`
  - `src/config/company.ts:166`
- **Fachfremd, korrekt:** `src/features/finance/TaxRemindersView.tsx:255`, `test/features/finance/deadlineCatalog.test.ts:60,112` (Steuerfristen-Profil „Kleinunternehmer“ als Kundenoption).
- **Doku:** `legal-review/STRIPE-FIRST-CHARGE-VERIFICATION.md:15,22,24`, `legal-review/STRIPE-PAYMENT-LINKS.md:37-38`, `docs/audit/04_REPORT.md:65`, `docs/audit/02_CLAIMS_REALITY_MATRIX.md:121`.
- **Tests, die § 19 jetzt ausschließen** (korrekt): `test/landing/landing-v2.test.tsx:109`, `test/billing/checkout-tax.test.ts:16,74,120-138,215-230`, `e2e/impressum.spec.ts:17,55-63`, `scripts/qa-governance-test.ts:191-206`.

**Brutto/Netto in der Rechnung:** E.2, Varianten A (Netto zzgl. 19 %, main) und B (Listenpreis als Brutto inkl. 19 %).
- Unterschied Netto-Erlös −16 %, Budget für variable Kosten −18 bis −19 %.
- Agency mit WhatsApp am Cap: 27 % (A) vs. 13,7 % (B).

**Offene Entscheidung:**
1. Bleibt es bei Netto-Preisen nur für B2B (Variante A, main), oder werden die Listenpreise als Brutto gesetzt (B)?
2. `.github/PR_TRIAGE_POLICY.md:54` und `OKTOBER-2026.md` auf die USt-Pflicht anpassen?
3. Die vier § 19-Branches löschen bzw. archivieren?
4. Die USt-IdNr. fehlt noch (`Impressum.tsx:133-134`). Reverse Charge EU-B2B ist bis dahin gesperrt (`checkout-tax.ts` Kommentar „bleibt es bei Deutschland“).

### (b) Enterprise 1.249 € (Policy) vs. „Enterprise per Vertrag / auf Anfrage“

**Aussage „1.249 € höchste Stufe / einzige Quelle“:**
- `.github/PR_TRIAGE_POLICY.md:54`
- `shared/pricing.ts:863` (`monthlyEur: 1_249`, `yearlyEur: 12_490`)
- `src/config/pricing.ts:307-312` (Listenbetrag „1.249“ bleibt in `priceString`; `test/contracts/audit-contract.test.ts` hält ihn fest)
- `check-offer-prices` führt 1249 € als „Betrag ohne Self-Service-Kaufpfad“

**Aussage „auf Anfrage / nach Vertrag“** (gleichzeitig wahr im Code):
- `shared/pricing.ts:852` („Preis auf Anfrage“), `:864` `priceOnRequest: true`, `:868-869` `purchaseMode: 'inquiry'`, `availability: 'contract'`, `:877` („autorisiert ist -1 (Vertrag)“); `PLAN_ENTITLEMENTS.enterprise` alles `-1` (`:2124-2168`)
- `supabase/functions/stripe-checkout/index.ts:43,137-141` (`ENTERPRISE_CONTRACT_ONLY`, „vertraglich vereinbart und manuell fakturiert“)
- `src/config/pricing.ts:301,312` (`ON_REQUEST_LABEL = 'Auf Anfrage'`, „nur per Vertrag“)
- `src/components/landing/v6/useLandingV6.ts:405-409` („Auf Anfrage“)
- `src/pages/Faq.tsx:63,70-71` („Enterprise nach Vertrag“, „kann 1.249 € nicht einloesen“)
- `src/pages/niche/AgenturenLanding.tsx:51`
- `src/pages/SaasAnbieterLanding.tsx:79`
- `src/pages/LegalTechLanding.tsx:122`
- `src/pages/solutions/AgenciesSolution.tsx:161,208,213,234`
- `src/pages/solutions/SaaSSolution.tsx:201`
- `src/config/seo.ts:319`, `src/pages/Press.tsx:12`, `src/pages/DataGuardAlternative.tsx:74`, `src/pages/ProlianceAlternative.tsx:63`
- `src/components/landing/v4/LandingV4Sections.tsx:688,815,900`, `src/components/landing/GovernanceFooter.tsx:83`
- `src/features/billing/CheckoutPage.tsx:216`, `src/features/billing/PlanSelector.tsx:39`
- `src/lib/optimizer/tiers.ts:88` („nie €1249 als Angebot zeigen“), `src/product/implementation-status.ts:373-376`, `src/i18n/handoff.ts:84`, `src/core/ai-gateway/governanceRouterCatalog.ts:279`

**Abweichende dritte und vierte Werte:**
- `README.md:200` „Enterprise (ab 1.500 €)“
- `shared/model-prices.ts:7` „Enterprise+ €1.999“ (Partner, legacy, `shared/pricing.ts:955,960`)

**Offene Entscheidung:** Ist 1.249 € ein öffentlich zugesicherter Festpreis (dann `priceOnRequest` entfernen und einen Kaufpfad oder Angebotsprozess definieren) oder ein interner Listenpreis „auf Anfrage“ (dann Policy-Wortlaut präzisieren und README korrigieren)?

---

## Abhängigkeiten zu offenen PRs/Issues

| PR/Issue | Bezug | Empfehlung |
|---|---|---|
| **#1907** (Draft, Seats, Head `eb360de`) | `limit.team_seats` in `tenant-invite`; nicht atomar; Free und Starter können danach niemanden einladen | fortführen (atomarer DB-Trigger als Folge); Verhaltensänderung braucht Dominiks Freigabe |
| **#1938** (offen, Stripe Tax) | Stripe-Dashboard-Seite der USt-Umstellung | manuell durch Dominik; Repo-Teil durch #1950 erledigt |
| **#1039 / #923** (offen) | Live-Webhook-Endpoint fehlt (Stand 25.08.); E2E-Nachweis | Stripe-seitig BLOCKIERT; Webhook-Härtung (WP-B1) vor dem Live-Nachweis |
| **#1646** (offen) | ai-gateway Aufrufer und Mandantenzuordnung | teilweise erledigt (bookUsage); fehlend: Vorab-Quote und Service-Pfad ohne Mandant |
| **#1153** (offen) | Voice 99 € + 0,22 €/Min., `storage_pack` | Preisentscheidung; Margenrechnung E.3 |
| **#1961** (offen) AI-Residency & Bot-Policy | berührt `_shared/ai.ts`/`bot-chat` (gleiche Dateien wie WP-B3) | seriell, nach #1961 |
| **#1967 / #1969** Beta-Dashboard / Beta | Beta-Logik vs. 72-h-Trial | Entscheidung Beta vs. 72 h vor WP-B2 |
| **#1918** Onboarding | Trial-Start im Onboarding | Schnittstelle zu WP-B2 abstimmen |
| **#1869** Audit-Claim-Security | Claim-Matrix (Starter-Bot-Claim) | WP-B4 dort verlinken |
| #1819 (geschlossen) STRIPE_MODE | Test/Live-Trennung | nicht reaktivieren ohne Staging-Entscheidung (WP-B6) |
| #1650 Schema Drift | `subscriptions.trial_end` vs. `trial_ends_at` doppelt | in WP-B2 berücksichtigen |

---

## Vorschläge für Welle 2

Welle 1 erzeugt keine PRs. Migrationen und Shared Types liegen laut Epic beim Orchestrator. Alle Pakete sind klein und als Draft gedacht.

1. **WP-B1 Webhook-Härtung**
   - Ziel: Event-Status (`received/processing/done/failed`) statt Insert-first; Reihenfolgesicherung (Subscription per `stripe.subscriptions.retrieve` neu laden oder `last_event_created` vergleichen); `checkout.session.async_payment_succeeded/failed`; `charge.refunded`/`charge.dispute.*` → Grant widerrufen; Alarm bei Fallback auf `free_audit`; Seiteneffekte (Mails, Conversions) mit eigener Idempotenz.
   - Dateien: `supabase/functions/stripe-webhook/index.ts`, `supabase/functions/_shared/stripe-subscription-sync.ts`, neue additive Migration (Spalten an `webhook_events`), `test/billing/*`, `test/edge/*`.
   - PR: neu (kein offener PR deckt das ab).
   - Risiko: mittel (Zahlungspfad, Live-Webhook).
   - Tests: Vitest mit Event-Fixtures (Duplikat, Abbruch, Out-of-order, SEPA async, Refund); DB-Test der Migration.
2. **WP-B2 72-h-Trial (nach Entscheidung Beta vs. 72 h)**
   - Ziel: `trialHours` in der SSoT; Checkout `trial_end`; `create-trial-subscription` aus der SSoT und nur owner/admin; Trial-Produkt mit eigenen Caps; `trial_claims` pro Person/Domain/Karte; keine `past_due`-Grace ohne vorherige Zahlung.
   - Dateien: `shared/pricing.ts` (+ `pricing.generated.ts` via `sync:pricing`), `supabase/functions/stripe-checkout/{index,customer}.ts`, `supabase/functions/create-trial-subscription/index.ts`, `supabase/functions/beta-enroll/logic.ts`, Migration (Resolver plus Trial-Produkt), `src/components/landing/v6/useLandingV6.ts` (nur Texte), `test/runtime/db/trial-expiry.db.test.ts`.
   - PR: neu; berührt `shared/pricing.ts`, also Hotspot, seriell.
   - Risiko: hoch (Preis- und Claim-Änderung, Einzel-Freigabe).
   - Tests: DB-Test „Stunde 71 aktiv / Stunde 73 Free“, Wiederholungs-Trial abgewiesen, Webhook-Fixture `trialing → past_due`.
3. **WP-B3 Harte Stopps und Kostendeckel**
   - Ziel: atomares `consume_usage()` in SQL (Lock pro Mandant und Key, fail-closed bei fehlendem Key für bezahlte Features); Vorab-Prüfung `limit.ai_cost_monthly_cents`; `tenant_cost_caps` aus dem Plan; Reservierungen zählen; fail-closed bei Reserve-Fehler; Voice-Restminuten vor jedem Gather plus Twilio `timeLimit`; WhatsApp-Konversationen vorab; Bot-Input-Kappung.
   - Dateien: `supabase/functions/_shared/{usage,ai,cost-cap}.ts`, `supabase/functions/{bot-voice-webhook,whatsapp-webhook,bot-chat}/index.ts`, Migration (neue Funktion, Cap-Ableitung).
   - PR: neu, nach #1961 (gleiche Dateien).
   - Risiko: hoch (kann echte Nutzung sperren). Rollout mit Warnmodus.
   - Tests: Parallelitätstest (N gleichzeitige Calls am letzten Kontingent), Voice-Stopp, Deckel-Überschuss.
4. **WP-B4 Starter-Bot-Entitlement**
   - Ziel: Claim und Runtime angleichen, also entweder `ai.tool.bot_reply` plus `limit.ai_calls/tokens/cost` für Starter oder Claim `shared/pricing.ts:657` ändern.
   - Dateien: `shared/pricing.ts` (`PLAN_ENTITLEMENTS`), neue Spiegel-Migration via `gen:entitlement-mirror`.
   - Risiko: mittel (Preis/Leistung, Einzel-Freigabe).
   - Tests: `entitlement-catalog-parity.test.ts`, `check:limits`.
5. **WP-B5 Seats**
   - Ziel: **PR #1907 fortführen**, danach atomarer Trigger wie bei `limit.bots`.
   - Dateien: `supabase/functions/tenant-invite`, `_shared/seat-limit.ts`.
   - Risiko: niedrig bis mittel.
   - Tests: vorhanden (12 Tests im PR), plus Race-Test.
6. **WP-B6 Stripe-Test/Live-Trennung und Staging**
   - Ziel: separates Supabase-Staging-Projekt mit eigenem `products`-Katalog (Test-Price-IDs); Guard „`sk_live` nur in Prod“ (Prüfung des Key-Präfixes gegen `ENVIRONMENT`); Doku. Voraussetzung für die Stripe-Tests in Welle 3/4.
   - Dateien: `.github/workflows/*` (Agent 12), `scripts/provision-stripe-vault.sh`, `getSecret` in `stripe-checkout`/`stripe-webhook`.
   - PR: neu; #1819 nicht wiederbeleben ohne Entscheidung.
   - Risiko: mittel (Secrets, CI).
   - Tests: Unit-Test des Guards, Staging-Smoke.
7. **WP-B7 Steuer- und Preis-Text-Aufräumen (nach Entscheidung a/b)**
   - Ziel: `PR_TRIAGE_POLICY.md:54`, `README.md:200`, `shared/model-prices.ts:7`, `src/i18n/handoff.ts:84,191`, `src/lib/compliance-notices.ts:212`, `legal-review/*` angleichen; verwaiste Branches schließen.
   - Risiko: niedrig (Docs/Copy), Policy-Datei nur mit Dominiks OK.
   - Tests: `check:offer-prices`, Landing-Tests.
8. **WP-B8 Gemessene Unit Economics**
   - Ziel: Provider-Kostentabelle für Nicht-LLM (WhatsApp, Twilio, STT/TTS) analog `shared/model-prices.ts` mit Quelle und Datum; Ansicht „Kosten je Mandant und Monat“ aus `ai_tool_runs.cost_usd`, `usage_events` und Minuten × Satz; Wechselkurs als Konfiguration; Margenalarm unter 60 %.
   - Dateien: `shared/provider-prices.ts` (neu), `src/features/billing/UsageView.tsx` bzw. Admin-View (Agent 09), lesende RPC.
   - Risiko: niedrig.
   - Tests: Snapshot der Kostenrechnung, Paritätstest Deno-Zwilling.
9. **WP-B9 Modellpreistabelle erweitern**
   - Ziel: Google/OpenAI-Preise, falls Tools sie nutzen (sonst 503 `MODEL_PRICE_MISSING`); Prüfung, welche `ai_tools` Nicht-Anthropic-Provider tragen.
   - Dateien: `shared/model-prices.ts` (+ generated).
   - Risiko: niedrig.
   - Tests: `check:model-prices`, `model-prices-ssot.test.ts`.

---

## Blocker / offene Fragen an Dominik

**Blocker:**
- Prod-DB (tatsächliche `products`-, `product_entitlements`-, `tenant_cost_caps`-Zeilen, gemessene Kosten je Mandant, Zahl der Beta-Mandanten): **BLOCKIERT**, Prod-Abfragen sind laut Brief verboten. Akzeptanz 8 („real measured“) lässt sich ohne lesenden Zugriff auf `ai_tool_runs`/`tenant_cost_ledger` nicht belegen.
- Stripe-Seite (Webhook-Endpoint #1039, Tax-Registrierung #1938, Netto-Price-IDs aktiv, Metered-Preis für Voice-Overage): **BLOCKIERT**, Stripe-Calls sind verboten.
- Exakter Drei-Punkt-Diff der Steuer-Branches: **BLOCKIERT** ohne `git fetch`; ersatzweise Commit-Stats über die GitHub-API.

**Offene Fragen (nicht entschieden):**
1. Steuer: Netto zzgl. USt nur B2B (main) oder Brutto-Listenpreise? Policy-Text § 19 aktualisieren? § 19-Branches löschen?
2. Enterprise: öffentlicher Festpreis 1.249 € oder „auf Anfrage“ mit internem Listenpreis? README „ab 1.500 €“ korrigieren?
3. Bot-Angebot: Sollen Starter/Growth/Agency (79/249/699 €) die Bot-Pläne **sein** (Bot-Leistung in die Pläne), oder werden Bots als Modul/Add-on verkauft? Keine zweite Plan-Leiter mit gleichen Namen?
4. Starter: Bot-Antworten wirklich freischalten (`ai.tool.bot_reply` plus KI-Kontingent) oder Claim „1 Bot mit 500 Antworten“ zurücknehmen?
5. 72-h-Trial vs. offene Beta bis 31.01.2027 vs. „14 Tage“: Was gilt ab wann, und für welchen Plan (Epic: Starter)? Mit oder ohne Karte?
6. Trial-Kontingente: Freigabe kleiner Trial-Caps (Vorschlag: 100 Antworten, 0 Voice, WhatsApp nur Sandbox, LLM ≤ 5 €)?
7. Kostendeckel: plan-abhängige LLM-Deckel (Vorschlag ≈ 18/60/175 € für 70 % Marge) statt 250 USD pauschal? Fail-closed bei Ledger-Ausfall akzeptabel?
8. Voice: Preis 150 € + 0,25 €/Min. (SSoT) oder 99 € + 0,22 €/Min. (#1153)? Sind 500 Minuten inklusive oder ist 500 der Cap? Hard Stop am Cap? Agency-inklusive 500 Minuten beibehalten?
9. WhatsApp: Zahlt der Kunde Meta direkt (eigene WABA/Nummer) oder die Plattform? Wenn die Plattform zahlt: Nachrichten-Caps pro Plan bzw. Durchreichung, sonst Agency-Marge ≈ 14–27 % am Cap.
10. Staging: Ein eigenes Supabase-Projekt plus Stripe-Testkonto für Welle 3/4 bereitstellen? Ohne das ist „Stripe test mode only“ nicht umsetzbar.
11. `past_due`-Grace von 7 Tagen auch direkt nach dem Trial (ohne jemals bezahlt) oder nur für Bestandszahler?
12. PR #1907 (Seats): Verhaltensänderung freigeben (Free/Starter ohne Einladungen)?
