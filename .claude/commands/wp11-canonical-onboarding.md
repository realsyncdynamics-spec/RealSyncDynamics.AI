---
description: WP11 Ein kanonischer Onboarding-Pfad Scan → Welcome → Activation → Command Center (M1)
---

# WP11 — Kanonischer Onboarding-Pfad

**Voraussetzung:** Owner-Entscheid E-F5 (Empfehlung `/audit`) · **Masterplan:** §3 M1 · **Branch:** `feat/wp11-canonical-onboarding`

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, docs/strategy/MASTERPLAN_2026-2027.md (nur den genannten Abschnitt),
.claude/os-funnel/PLAN.md (§5 Leitplanken).

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

Befund: 6+ Einstiege ohne gemeinsamen Pfad nach der Registrierung.
- /audit → /onboarding/:scanId (GovernanceOnboarding)
- /welcome (Welcome.tsx) → /setup-assistant → /app/dashboard
- /unified-entry/{scan,entscheidung,preview,trial-offer,register,onboarding,success}
  (src/App.tsx ~1160–1230; src/unified-entry/mock-data.ts noch über src/unified-entry/index.ts im Einsatz)
- /app/activation (GovernanceActivationView, persistiert in governance_activations)

Zielpfad:
`/audit (Scan) → /welcome (Registrierung) → Workspace + Firmenprofil → /app/activation
(KI-Systeme erfassen) → /app/dashboard (Command Center)`

Aufgaben:
1. Pfad-Konstante `src/config/onboardingFlow.ts`: Schritte, Routen, Abschluss-Kriterium je Schritt.
   Welcome, SetupAssistant, GovernanceOnboarding und Activation lesen „nächster Schritt" daraus.
2. Redirects per `<Navigate replace>` in src/App.tsx:
   /unified-entry/scan → /audit (sofern E-F5 so entschieden), /unified-entry/register → /welcome,
   /unified-entry/onboarding → /app/activation, /unified-entry/success → /app/dashboard.
   /unified-entry/transformation bleibt (Builder-Erstbau, siehe CLAUDE.md).
   Query-Parameter (scanId, utm_*) beim Redirect erhalten.
3. scanId vom Scan bis Activation durchreichen, damit Befunde vorbefüllt werden (nur, wo die
   bestehende API das schon kann; sonst Preview-Hinweis).
4. Funnel-Events über `trackMarketingEvent` (src/lib/marketingAnalytics.ts), nur nach Consent:
   scan_completed, signup_completed, workspace_created, activation_completed, first_evidence_created.
   Zeitstempel so, dass Time-to-First-Evidence auswertbar ist.
5. mock-data.ts: entfernen, wenn nach den Redirects nichts mehr importiert; sonst Restimporte im PR benennen.

Nicht tun: neue Seiten bauen, Activation-Logik umbauen, Migrationen, Preis-/Trial-Logik (M6).

Akzeptanz:
- e2e-Spec (Playwright, vorhandene Struktur): /audit → … → /app/dashboard ohne Sackgasse
- Alle alten /unified-entry-Ziele außer transformation leiten um (Unit-/Route-Test)
- 5 Funnel-Events feuern nur mit Consent
- npm run lint, npm test, npm run build grün
