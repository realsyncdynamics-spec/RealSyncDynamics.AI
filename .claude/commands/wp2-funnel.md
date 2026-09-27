---
description: WP2 Funnel auf /audit ausrichten (Angebots-Copy aus SSoT, Starter-Trial-Drift)
---

# WP2 — Funnel auf `/audit` ausrichten

**Voraussetzung:** ✅ E-F1 entschieden (2026-09-27): 14-Tage-Growth-Testphase. E-F5 offen, nicht blockierend · **Branch:** `feat/wp2-audit-funnel-offer`
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

Aufgaben (E-F1 = 14-Tage-Growth-Testphase — verbindlich, keine Alternative):

   0. BLOCKER vor jeder Trial-Copy — Trial-Ablauf erzwingen:
      create-trial-subscription legt eine kartenlose Testphase an
      (status 'trialing', trial_end, KEINE Stripe-Subscription). Der
      Entitlement-Resolver (Migration 20260920130000_bots_quota_enforcement.sql,
      abo_wirksam) wertet jedes 'trialing' als wirksam, ohne trial_end zu prüfen,
      und kein Job setzt abgelaufene Testphasen zurück. Folge: Growth ohne Ende.
      Fix = Resolver prüft `status = 'trialing' AND trial_end > now()` (oder
      ein Ablauf-Job). Das ist eine Migration → NICHT in dieser Session bauen,
      sondern als eigenes Paket WP2a mit separatem GO. WP2 wird erst gemergt,
      wenn WP2a live ist. Bis dahin: keine neue Trial-Copy, kein neuer
      Trial-Button.
   1. shared/pricing.ts, Starter: trialDays 14 → 0 UND ctaLabel
      „14 Tage kostenlos testen" → Starter-CTA ohne Trial-Versprechen (z. B.
      „Starter buchen"). Invariante als Test: Kein Plan mit trialDays 0 darf in
      ctaLabel/Beschreibung „Tage kostenlos" oder „testen" führen. Danach
      npm run sync:pricing, check:pricing, check:offer-prices.
   2. Angebots-Copy an EINER Stelle (Konstante), von TrialOfferPage, SuccessPage,
      PostRegisterOnboardingPage und PostScanChoiceRow gelesen:
      „Der Scan ist kostenlos. Den Governance-Workspace testen Sie 14 Tage im
      Growth-Paket (249 € / Monat, monatlich kündbar)."
      Preis aus shared/pricing.ts lesen, nicht hart codieren.
   3. Trial im kanonischen Pfad tatsächlich anlegen: Heute ruft nur
      PostRegisterOnboardingPage (verworfener Pfad) create-trial-subscription auf.
      Den BESTEHENDEN Aufruf in den Abschluss von /app/activation übernehmen,
      MIT aktivem Mandanten wie im Original:
      postEdgeFunction('create-trial-subscription',
        { planKey: 'growth', ...(activeTenantId ? { tenantId: activeTenantId } : {}) })
      Ohne tenantId antwortet die Function bei Mehrfach-Mitgliedschaft mit
      TENANT_AMBIGUOUS. Die Function prüft tenantId gegen memberships. —
      per Button „Growth 14 Tage testen", nicht automatisch. Das ist keine neue
      Zahlungslogik, sondern die deployte Function am richtigen Ort.
      Solange dieser Aufruf im kanonischen Pfad fehlt, darf die Trial-Copy dort
      NICHT erscheinen (Test: Copy nur, wenn der Aufruf erreichbar ist).

Ausdrücklich NICHT: Gratis-Code, Stripe-Promotion-Code, Coupon-Einlösung,
manuelle Freischaltung als Angebot.

Zusätzlich:
- PostScanChoiceRow: Karte „Governance-Workspace einrichten" (Ziel /app/activation)
  als primären nächsten Schritt nach dem Scan hervorheben; Badges unverändert ehrlich.
- SuccessPage/Onboarding-Erfolg: „Ihr AI Governance Workspace ist vorbereitet."
  statt „Growth ist bereit." / „🎉 Willkommen" — Trial-Text nur, wenn die Trial
  tatsächlich angelegt wurde.

Nicht tun: neue Zahlungslogik, neue Edge Function, Coupon-Tabelle, Stripe-API-Calls.

Akzeptanz:
- Ein Angebots-Text, eine Quelle, Preis aus SSoT
- Wer den Trial-Text im kanonischen Pfad sieht, kann die Trial dort auch anlegen
- WP2a (Trial-Ablauf) ist live, bevor WP2 gemergt wird
- Starter hat weder trialDays > 0 noch Trial-Wording (Invarianten-Test)
- Test: Trial-Button sendet tenantId des aktiven Mandanten
- Starter ohne Trial im SSoT, Pricing-Checks grün
- Keine Verlinkung auf /unified-entry/scan aus Landing oder /audit
- Tests: test/content/pricingContent.test.ts und betroffene Audit-Tests grün
