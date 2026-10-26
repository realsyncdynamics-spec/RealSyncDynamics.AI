---
description: WP14 Enterprise-Zielpreis 1.498 €/Monat netto — Abgleich SSoT, Stripe, Checkout, Entitlements, Anzeige (E-P1)
---

# WP14 — Enterprise-Preis 1.498 €: Abgleich vor dem Merge

**Voraussetzung:** E-P1 (`.claude/os-funnel/PLAN.md` §3) · **Branch:** `docs/wp14-enterprise-preis`
**Art:** Prüfauftrag. Die Umsetzung liegt bereits in #1995 (Checkout, SSoT, Kontingente) und dem
darauf gestapelten #1999 (Anzeige, Beta-Abgrenzung). WP14 baut sie **nicht** ein zweites Mal.

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, .claude/os-funnel/PLAN.md (§3 Nachtrag E-P1, §5 Leitplanken),
.github/PR_TRIAGE_POLICY.md (Abschnitt Produktentscheidungen, WIP-Stopp).

Ein Arbeitspaket pro Session. Eigener Branch von origin/main. Ein PR, Squash.

Verboten ohne separates GO:
- Deploy, Merge, Push auf main
- Supabase-Migration, Stripe-Änderung, Cloudflare/Worker/KV
- echte Provider- oder Agentenaktionen

Immer:
- Tenant nur über JWT user → memberships → tenant_id. Nie aus URL, Body, localStorage.
- Keine Service-Role im Browser.
- Keine Fake-KPIs. Fehlt eine Quelle: Empty State oder Preview-Label.
- Status nur aus src/product/implementation-status.ts: live · preview · coming-soon.
- Keine Claims „vollständig revisionssicher", „autonome Agenten live", „EU-konform garantiert".
- Design-Freeze auf /: keine Tokens umstylen.
- Nur die im WP genannten Dateien ändern. Keine Repo-weiten Refactors.

Prüfung: npm run lint · npm test (betroffene Suites). Nicht ausführbar → im PR begründen.

PR-Text: geänderte Dateien · wiederverwendete Strukturen · live · preview · coming soon · Checks.

**Zusätzlich für WP14:** Keine Preise, Kontingente, Checkout-Regeln oder Produktfunktionen ändern.
Weder auf `main` noch auf den Branches von #1995/#1999. Befunde gehen als Kommentar an den
jeweiligen PR bzw. an den Owner.

## Ausgangslage (gemessen 26.10.2026, `main@4df1fde`)

| Ebene | Stand `main` | Stand #1995 / #1999 |
|---|---|---|
| SSoT `shared/pricing.ts` (Enterprise-Block) | `monthlyEur: 1_249`, `yearlyEur: 12_490`, `priceOnRequest: true`, `purchaseMode: 'inquiry'` | 1.498 €/Monat netto, Self-Service, ohne Testphase, kein Jahres-Checkout (`yearlyCheckoutUnavailable`; 14.980 € nur interner Listenwert) |
| Stripe | Enterprise-Price 1.249 € aus `20261020130000_stripe_live_net_exclusive_price_ids.sql` | Neue Price-ID **fehlt** (Blocker). Vorlage `docs/runbooks/enterprise-stripe-1498.migration.sql.template` + Runbook `enterprise-stripe-1498.md` |
| Checkout `supabase/functions/stripe-checkout/index.ts` | `ENTERPRISE_SELF_SERVICE_BLOCKED` sperrt `enterprise`, `enterprise_yearly` | Vorabprüfung Stripe-Price gegen SSoT (`PRICE_MISMATCH`, `PRODUCT_NOT_CONFIGURED`); `PLAN_STRIPE_EXPECTATIONS.enterprise.productId` noch `null` |
| Entitlements | `PLAN_ENTITLEMENTS.enterprise`, Vertragswerte `-1` | endliche Kontingente, KI-Kosten 250 €/Monat; drei additive Migrationen (`20261024090000`, `20261024090100`, `20261025001345`) |
| Öffentliche Anzeige | „Enterprise anfragen“; Kommentare mit „1.249 €“ in `Faq.tsx`, `AgenciesSolution.tsx`, `SaaSSolution.tsx`, `src/config/pricing.ts` | überall „1.498 €/Monat netto“ aus der SSoT; `/contact-sales`, `/enterprise`, `/enterprise-ai-os`, `/press`, `/fuer-agenturen`, `/pricing` (#1999) |
| Policy / Plan | `PR_TRIAGE_POLICY.md`: „1.249 € ist die höchste Stufe und die einzige Quelle“; `PLAN.md` §1: „Enterprise 1.249 € im SSoT“ | nicht angepasst |

Beide PRs sind `dirty` (Konflikt mit `main`). #1995 ist „Ready“, #1999 ist Draft und erst nach #1995 zu mergen.

## Auftrag

Ziel: Eine belegte Abgleich-Matrix, die zeigt, ob nach dem Merge von #1995 → #1999 jede Ebene
denselben Enterprise-Preis führt und keine Ebene etwas verspricht, das eine andere ablehnt.

Aufgaben:
1. **Stand einfrieren.** Head-SHAs von #1995 und #1999 notieren. Gegen diese SHAs prüfen, nicht gegen
   Beschreibungstexte.
2. **Matrix bauen.** Zeilen: SSoT · `_shared/pricing.generated.ts` · Plan-Katalog-SQL · Stripe-Erwartung
   (`PLAN_STRIPE_EXPECTATIONS`) · Checkout-Pfad · Webhook/Abo-Zuordnung (`stripe-webhook`) · Entitlements
   (`PLAN_ENTITLEMENTS`, Migrationen) · `check-offer-prices.mjs` · öffentliche Seiten · `seo.ts`/`llms.txt` ·
   README · Policy/PLAN. Spalten: `main` · nach #1995 · nach #1999 · Soll (1.498 €/Monat netto) · Befund.
3. **Restfundstellen suchen** auf dem Stand von #1999:
   `grep -rnE "1[.]?249|124900|12[.]?490|auf Anfrage|nach Vertrag|priceOnRequest" src shared supabase/functions scripts public README.md`
   Jede Fundstelle einordnen: Anzeige (muss 1.498 € oder SSoT-Aufruf sein) · Kommentar/Historie (darf bleiben,
   wenn als Altstand markiert) · Logik (Befund).
4. **Stripe-Lücke beschreiben, nicht schließen.** Prüfen, was das Runbook verlangt (Live-Price, `149800` Cent,
   EUR, monatlich, `interval_count = 1`, `tax_behavior = exclusive`, Produkt-ID). Ergebnis: Liste der Werte,
   die der Owner im Stripe-Dashboard anlegen oder bestätigen muss. Keine Price anlegen, keine Migration anlegen.
5. **Steuer-Wording prüfen.** Die Policy verlangt im Pricing-Hinweis „Gemäß § 19 UStG wird keine Umsatzsteuer
   ausgewiesen“. #1995 zeigt „netto“ und setzt `tax_behavior = exclusive`. Befund formulieren: Welche Aussage gilt?
   Nicht selbst entscheiden → offene Frage an den Owner (E-P1, Punkt d).
6. **Ablehnungspfad testen (nur lesen/Tests ausführen).** Belegen, dass ohne gesetzte Price-/Produkt-ID der
   Enterprise-Checkout ablehnt und nichts falsch abrechnet (Tests aus #1995 benennen und laufen lassen, sofern
   lokal möglich).
7. **Ergebnis ablegen.** Matrix und Befundliste als PR-Text dieses WP. Befunde, die Code in #1995/#1999
   betreffen, zusätzlich als je einen Kommentar dort.

Nicht tun: Preise oder Kontingente ändern, #1995/#1999 rebasen oder pushen, Stripe-Objekte anlegen,
Migrationen anlegen, Policy-Text selbst ändern (eigener Docs-PR nach Owner-GO, E-P1 Punkt c).

Akzeptanz:
- Matrix vollständig, jede Zeile mit Datei:Zeile auf den notierten SHAs belegt
- Jede Restfundstelle aus Aufgabe 3 eingeordnet, keine Anzeige mit 1.249 € ohne Befund
- Liste der Stripe-Werte für den Owner, keine Stripe-Änderung
- Offene Owner-Fragen (E-P1 a–e) mit Antwort oder ausdrücklich „offen“
- Diff dieses WP enthält keine Änderung an Preis-, Checkout- oder Entitlement-Dateien
