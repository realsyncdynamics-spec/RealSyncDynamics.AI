---
description: WP2 Funnel auf /audit ausrichten (Angebots-Copy aus SSoT, Starter-Trial-Drift)
---

# WP2 — Funnel auf `/audit` ausrichten

**Voraussetzung:** E-F1 (Angebot) und E-F5 entschieden · **Branch:** `feat/wp2-audit-funnel-offer`
**Freigabe:** Preise/Angebot = Einzel-Freigabe im PR

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, .claude/os-funnel/PLAN.md (§1 Ist-Befund, §5 Leitplanken).

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

## Auftrag

WICHTIG: Der kanonische Einstieg ist /audit + gdpr_audits
(docs/product/canonical-funnel-decision.md). /unified-entry/scan ist verworfen:
es erfindet auditId=urlscan-<Zeitstempel> und schreibt keinen Datensatz.
ScanEntryPage NICHT ausbauen, NICHT aus Landing/Funnel verlinken.

Ziel-Funnel (alles existiert, wird nur verbunden und ehrlich beschriftet):
Besucher → /audit (kostenlos, gdpr_audits) → Risiko sichtbar
→ PostScanChoiceRow → /welcome?next=/app/activation (Konto, Audit-Claim)
→ /app/activation (AI-OS-Setup, WP3) → /app/dashboard (Command Center)

Bestand:
- src/pages/AuditLanding.tsx, src/components/audit/PostScanChoiceRow.tsx
- src/unified-entry/pages/TrialOfferPage.tsx, SuccessPage.tsx,
  PostRegisterOnboardingPage.tsx (nur Copy)
- shared/pricing.ts (trialDays), supabase/functions/create-trial-subscription (nur lesen)

Aufgaben (Variante nach E-F1):

A) E-F1 = 14-Tage-Growth-Trial behalten
   1. shared/pricing.ts: Starter trialDays 14 → 0 (Copy und Edge Function sagen
      „nur Growth"). Danach npm run sync:pricing, check:pricing, check:offer-prices.
   2. Angebots-Copy an EINER Stelle (Konstante), von TrialOfferPage, SuccessPage,
      PostRegisterOnboardingPage und PostScanChoiceRow gelesen:
      „Der Scan ist kostenlos. Den Governance-Workspace testen Sie 14 Tage im
      Growth-Paket (249 € / Monat, monatlich kündbar)."
      Preis aus shared/pricing.ts lesen, nicht hart codieren.

B) E-F1 = Gratis-Code 1 Monat Growth
   1. Wie A.1.
   2. KEINE Code-Einlösung bauen. Copy:
      „Der Scan ist kostenlos. Für den Governance-Workspace erhalten Sie einen
      Gratis-Code für den ersten Monat des Growth-Pakets (249 €, monatlich
      kündbar). Einlösung im Checkout."
   3. Einlösung erfolgt über den bestehenden Stripe-Checkout
      (allow_promotion_codes: true). Den Promotion-Code legt Dominik im
      Stripe-Dashboard an — NICHT in dieser Session. Bis dahin Badge PREVIEW und
      Hinweis „Freischaltung manuell über Sales".

In beiden Varianten:
- PostScanChoiceRow: Karte „Governance-Workspace einrichten" (Ziel /app/activation)
  als primären nächsten Schritt nach dem Scan hervorheben; Badges unverändert ehrlich.
- SuccessPage/Onboarding-Erfolg: „Ihr AI Governance Workspace ist vorbereitet."
  statt „Growth ist bereit." / „🎉 Willkommen" — Trial-Text nur, wenn die Trial
  tatsächlich angelegt wurde.

Nicht tun: neue Zahlungslogik, neue Edge Function, Coupon-Tabelle, Stripe-API-Calls.

Akzeptanz:
- Ein Angebots-Text, eine Quelle, Preis aus SSoT
- Starter ohne Trial im SSoT, Pricing-Checks grün
- Keine Verlinkung auf /unified-entry/scan aus Landing oder /audit
- Tests: test/content/pricingContent.test.ts und betroffene Audit-Tests grün
