# Production Readiness Report — 2026-06-10

> Auftrag: "brutale Abnahmeprüfung" der realen Produktion (Supabase, Stripe,
> GitHub Pages) statt indirekter Reports. Diese Befunde stammen aus
> Live-SQL-Queries gegen `ebljyceifhnlzhjfyxup`, Live-Stripe-Account
> `acct_1TYVIyREjTWueUcG`, Code-Lesung der relevanten Edge Functions und
> `curl` gegen `https://realsyncdynamicsai.de`.

## Status-Tabelle

| Bereich | Status | Kurzfassung |
|---|---|---|
| Scan | ✅ funktioniert | `gdpr-audit` läuft produktiv: 67 Audits insgesamt, 61/67 mit `fetched_status=200`. Eigener Self-Audit von `realsyncdynamicsai.de` lief am 2026-06-09 erfolgreich durch. |
| Report | ✅ funktioniert (im Browser) | Scan-Ergebnis (Score, Befunde) wird sofort im Frontend gerendert, JSON-Response korrekt befüllt. |
| E-Mail | ❌ **komplett tot** | `vault.secrets`/`vault.decrypted_secrets` enthalten **keinen** `resend_api_key`. `audit-report-email` antwortet immer mit `{ok:true, skipped:"no_api_key"}`. **0 von 67** `gdpr_audits` haben `email_sent_at` gesetzt — auch der eigene Test-Audit vom Vortag nicht. Identisch zum Stand vom 2026-05-12 (Runbook `p0-pilot-blockers.md`) — **seit ~1 Monat keine Änderung**. |
| Trial | ⚠️ Code korrekt, aber unbewiesen | `/pricing` und `/checkout` zeigen korrekt "14 Tage kostenlos testen · keine Kosten bis Tag 15". `stripe-checkout` setzt `trial_period_days=14` bei Pilot-Flag. **Aber**: kann nicht End-to-End verifiziert werden, weil der Checkout selbst (siehe Stripe) vermutlich fehlschlägt. |
| Stripe | ❌ **sehr wahrscheinlich komplett tot** | `vault.secrets` enthält **weder** `stripe_secret_key` **noch** `stripe_webhook_secret`. `stripe-checkout/index.ts` liest `STRIPE_SECRET_KEY` **nur** aus `Deno.env` (kein Vault-Fallback, anders als `stripe-webhook`) — laut `credentials-activation.md` steht dort der Platzhalter `sk_live_PLACEHOLDER_KEY` (16 Zeichen). Jeder echte Stripe-Call (`customers.create`, `checkout.sessions.create`) würde mit "Invalid API Key provided" → HTTP 500 fehlschlagen. `stripe-webhook` gibt sofort HTTP 500 zurück, da beide Secrets fehlen. **Live-Beweis**: 0 Zeilen in `subscriptions`, `stripe_trial_events`, `stripe_payment_events`, `stripe_invoices`; `webhook_events` hat nur 4 Zeilen, alles `v2.core.event_destination.ping` vom 2026-06-08 (Connectivity-Pings, keine echten Business-Events, anderes Format als das, was die Funktion erwartet). Im Stripe-Account selbst: **0 aktive Subscriptions**. **Positiv**: Produkte/Preise sind korrekt verknüpft — `public.products.stripe_price_id` für `starter` (`price_1TfsV8REjTWueUcGCdOO6bT2`, €79) zeigt auf einen real existierenden, aktiven Stripe-Preis im aktuellen Account. |
| Dashboard | ✅ funktioniert | Echte Magic-Link-Logins für 2 reale Accounts (`realsyncdynamics@gmail.com`, `steinerdominik1982@gmail.com`) in den Auth-Logs. 4 Zeilen in `tenants`/`memberships`. `/app` antwortet HTTP 200. |
| Monitoring | ❓ nicht verifiziert | Sentry-Konfiguration in dieser Runde nicht geprüft — offener Punkt für die nächste Runde. |

## Kern-Befund: ein einziger Root Cause für Email + Stripe

Beide kritischen Ausfälle (E-Mail, Stripe/Subscriptions) haben **dieselbe
Ursache**: Supabase Vault fehlen die drei Secrets `resend_api_key`,
`stripe_secret_key`, `stripe_webhook_secret`. Das ist **exakt** der Zustand,
der bereits in zwei separaten Runbooks dokumentiert ist:

- `docs/runbooks/p0-pilot-blockers.md` (Stand 2026-05-12)
- `docs/runbooks/credentials-activation.md`

→ Seit mindestens einem Monat **keine Änderung am Vault-Zustand**. Das ist
keine Code-Frage mehr — der Code (`stripe-checkout`, `stripe-webhook`,
`audit-report-email`) ist auf Vault-Secrets vorbereitet (teils mit
Env-Fallback, teils nicht) und die Stripe-Produkte/Preise sind korrekt
konfiguriert. Es fehlt ausschließlich die **Provisionierung der drei Keys**
durch den Founder (Resend-Dashboard, Stripe-Dashboard → Vault).

## Zusätzlicher Befund (klein, nicht P0)

`/welcome`, `/login`, `/setup`, `/checkout/success` liefern **HTTP 404**,
obwohl sie inhaltlich die korrekte SPA-Shell ausliefern (GitHub-Pages-SPA-
Routing-Quirk — Browser rendern via React-Router trotzdem korrekt). Kann
Crawler, Social-Previews und ggf. Stripe-Redirect-Handling beeinträchtigen.
Severity: niedrig, aber sollte vor Test 5 (echte Zahlung) im Hinterkopf
behalten werden, da `/checkout/success` der Stripe-Redirect-Ziel-URL ist.

## Was das für die 5 angeforderten Tests bedeutet

| Test | Ausführbar? |
|---|---|
| 1: eigene Domain durch Funnel | Scan/Report ja, E-Mail nein (siehe oben) |
| 2: neue Gmail-Adresse | Scan/Report ja, E-Mail kommt **nicht an** (kein Resend-Key) |
| 3: neue Outlook-Adresse | dito — E-Mail-Zustellung kann nicht sinnvoll getestet werden, solange `resend_api_key` fehlt |
| 4: Mobilgerät | noch nicht durchgeführt |
| 5: Zahlung mit Testkarte | wird mit hoher Wahrscheinlichkeit mit HTTP 500 ("Invalid API Key") an `stripe-checkout` scheitern, solange `stripe_secret_key` fehlt |

## Empfohlener nächster Schritt

Die drei P0-Vault-Secrets provisionieren (`resend_api_key`,
`stripe_secret_key`, `stripe_webhook_secret`) gemäß
`docs/runbooks/p0-pilot-blockers.md` bzw. `credentials-activation.md`. Das
ist reine Konfiguration in Resend-/Stripe-Dashboard + Supabase Vault — kein
Code-Deploy nötig. **Erst danach** sind Tests 2, 3 und 5 überhaupt
aussagekräftig durchführbar; alles andere wäre wieder ein "indirekter
Report".

Sobald die Secrets gesetzt sind, kann ich die Backfill-Mails für die 67
liegengebliebenen Audits anstoßen und Test 1/2/3/5 live durchführen.
